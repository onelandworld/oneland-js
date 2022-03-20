import {ethers} from 'ethers';
import {BigNumber} from 'bignumber.js';
import {
  Network,
  UnhashedOrder,
  SaleKind,
  Asset,
  OrderSide,
  OneLandAPIConfig,
  FeeMethod,
  ComputedFees,
  WyvernSchemaName,
  WyvernAsset,
  WyvernNFTAsset,
  WyvernFTAsset,
  OneLandAsset,
  UnsignedOrder,
  ECSignature,
} from './types';
import {
  WyvernRegistryAbi,
  WyvernExchangeAbi,
  WyvernStaticAbi,
  ERC20Abi__factory,
  ERC721Abi__factory,
} from './typechain';
import {WyvernRegistry, WyvernExchange, WyvernStatic} from './contracts';
import {
  getMaxOrderExpirationTimestamp,
  validateAndFormatWalletAddress,
  toBaseUnitAmount,
  generatePseudoRandomSalt,
  getWyvernAsset,
  getOrderHash,
  domainToSign,
  structToSign,
  eip712Order,
  signTypedDataAsync,
  toEthBigNumber,
  fromEthBigNumber,
  eip712,
  delay,
} from './utils';
import {
  NULL_ADDRESS,
  MAX_UINT_256,
  MIN_EXPIRATION_MINUTES,
  MAX_EXPIRATION_MONTHS,
  ORDER_MATCHING_LATENCY_SECONDS,
  INVERSE_BASIS_POINT,
  ONELAND_FEE_RECIPIENT,
  DEFAULT_BUYER_FEE_BASIS_POINTS,
  DEFAULT_SELLER_FEE_BASIS_POINTS,
  DEFAULT_MAX_BOUNTY,
  ONELAND_SELLER_BOUNTY_BASIS_POINTS,
} from './constants';
import {OneLandAPI} from './api';

export class LandPort {
  private _network: Network;
  private _provider: ethers.providers.Web3Provider;
  private readonly api: OneLandAPI;
  private _wyvernRegistryAbi: WyvernRegistryAbi;
  private _wyvernExchangeAbi: WyvernExchangeAbi;
  private _wyvernStaticAbi: WyvernStaticAbi;
  private logger: (arg: string) => void;

  constructor(
    provider: ethers.providers.Web3Provider,
    apiConfig: OneLandAPIConfig,
    logger?: (arg: string) => void
  ) {
    apiConfig.network = apiConfig.network || Network.Main;
    this._provider = provider;
    this._network = apiConfig.network;
    this.api = new OneLandAPI(apiConfig);
    this._wyvernRegistryAbi = WyvernRegistry.getAbiClass(
      this._network,
      this._provider
    );
    this._wyvernExchangeAbi = WyvernExchange.getAbiClass(
      this._network,
      this._provider
    );
    this._wyvernStaticAbi = WyvernStatic.getAbiClass(
      this._network,
      this._provider
    );

    // Debugging: default to nothing
    this.logger = logger || ((arg: string) => arg);
  }

  public async createSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity = 1,
    maximumFill = 1,
    listingTime,
    expirationTime = getMaxOrderExpirationTimestamp(),
    waitForHighestBid = false,
    englishAuctionReservePrice,
    paymentTokenAddress,
    extraBountyBasisPoints = 0,
    buyerAddress,
    buyerEmail,
  }: {
    asset: Asset;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    quantity?: number;
    maximumFill?: number;
    listingTime?: number;
    expirationTime?: number;
    englishAuctionReservePrice?: number;
    waitForHighestBid?: boolean;
    paymentTokenAddress?: string;
    extraBountyBasisPoints?: number;
    buyerAddress?: string;
    buyerEmail?: string;
  }) {
    const order = await this._makeSellOrder({
      asset,
      quantity,
      maximumFill,
      accountAddress,
      startAmount,
      endAmount,
      listingTime,
      expirationTime,
      waitForHighestBid,
      englishAuctionReservePrice,
      paymentTokenAddress: paymentTokenAddress || NULL_ADDRESS,
      extraBountyBasisPoints,
      buyerAddress: buyerAddress || NULL_ADDRESS,
    });
    console.log('after _makeSellOrder', order);

    await this._sellOrderValidationAndApprovals({order, accountAddress});

    if (buyerEmail) {
      // TODO:
    }

    const hashedOrder = {
      ...order,
      hash: getOrderHash(order),
    };
    let signature;
    try {
      signature = await this.authorizeOrder(hashedOrder);
    } catch (error) {
      console.error(error);
      throw new Error('You declined to authorize your auction');
    }

    const orderWithSignature = {
      ...hashedOrder,
      ...signature,
    };

    // TODO: post Order to backend service
    return orderWithSignature;
  }

  public async _makeSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity,
    maximumFill = 1,
    listingTime,
    expirationTime = getMaxOrderExpirationTimestamp(),
    waitForHighestBid,
    englishAuctionReservePrice = 0,
    paymentTokenAddress,
    extraBountyBasisPoints,
    buyerAddress,
  }: {
    asset: Asset;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    quantity: number;
    maximumFill: number;
    waitForHighestBid: boolean;
    englishAuctionReservePrice?: number;
    listingTime?: number;
    expirationTime?: number;
    paymentTokenAddress: string;
    extraBountyBasisPoints: number;
    buyerAddress: string;
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(accountAddress);
    const quantityBN = new BigNumber(quantity);
    const maximumFillBN = new BigNumber(maximumFill);

    const wyAsset = getWyvernAsset(asset, quantityBN);
    const oneLandAsset = await this.api.getAsset(asset);

    const {
      totalSellerFeeBasisPoints,
      totalBuyerFeeBasisPoints,
      sellerBountyBasisPoints,
    } = await this.computeFees({
      asset: oneLandAsset,
      side: OrderSide.Sell,
      extraBountyBasisPoints,
    });

    const orderSaleKind =
      endAmount !== null && endAmount !== startAmount
        ? SaleKind.DutchAuction
        : SaleKind.FixedPrice;

    const {basePrice, extra, paymentToken, reservePrice} =
      await this._getPriceParameters(
        OrderSide.Sell,
        paymentTokenAddress,
        expirationTime,
        startAmount,
        endAmount,
        waitForHighestBid,
        englishAuctionReservePrice
      );

    const times = this._getTimeParameters({
      expirationTimestamp: expirationTime,
      listingTimestamp: listingTime,
      waitingForBestCounterOrder: waitForHighestBid,
    });

    const {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      feeRecipient,
      feeMethod,
    } = this._getSellFeeParameters(
      totalBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints,
      waitForHighestBid,
      sellerBountyBasisPoints
    );

    const {staticTarget, staticSelector, staticExtradata} =
      await this._getStaticCallTargetAndExtraData({
        asset: oneLandAsset,
        useTxnOriginStaticCall: waitForHighestBid,
      });

    const registry = WyvernRegistry.getContractAddress(this._network);
    const exchange = WyvernExchange.getContractAddress(this._network);
    return {
      registry,
      exchange,
      maker: accountAddress,
      // taker: buyerAddress,
      quantity: quantityBN,
      maximumFill: maximumFillBN,
      // makerRelayerFee,
      // takerRelayerFee,
      // makerProtocolFee,
      // takerProtocolFee,
      // makerReferrerFee,
      // waitingForBestCounterOrder: waitForHighestBid,
      // englishAuctionReservePrice: reservePrice
      //   ? BigNumber.from(reservePrice)
      //   : undefined,
      feeMethod,
      // feeRecipient,
      side: OrderSide.Sell,
      saleKind: orderSaleKind,
      staticTarget,
      staticSelector,
      staticExtradata,
      paymentToken,
      // basePrice,
      // extra,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: {
        asset: wyAsset,
        schema: asset.schemaName as WyvernSchemaName,
      },
    };
  }

  // Throws
  public async _sellOrderValidationAndApprovals({
    order,
    accountAddress,
  }: {
    order: UnhashedOrder;
    accountAddress: string;
  }) {
    const wyAssets =
      'bundle' in order.metadata
        ? order.metadata.bundle.assets
        : order.metadata.asset
        ? [order.metadata.asset]
        : [];
    const schemaNames =
      'bundle' in order.metadata && 'schemas' in order.metadata.bundle
        ? order.metadata.bundle.schemas
        : 'schema' in order.metadata
        ? [order.metadata.schema]
        : [];
    const tokenAddress = order.paymentToken;
    console.log('order.metadata', order.metadata);
    console.log('wyAssets', wyAssets);

    await this._approveAll({
      schemaNames,
      wyAssets,
      accountAddress,
    });

    // For fulfilling bids,
    // need to approve access to fungible token because of the way fees are paid
    // This can be done at a higher level to show UI
    if (tokenAddress !== NULL_ADDRESS) {
      const proxyAddress = await WyvernRegistry.getProxy(
        this._wyvernRegistryAbi,
        accountAddress
      );
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount: order.quantity,
        proxyAddress,
      });
    }

    // Check sell parameters
    const sellValid = await this._wyvernExchangeAbi.validateOrderParameters_(
      order.registry,
      order.maker,
      order.staticTarget,
      order.staticSelector,
      order.staticExtradata,
      toEthBigNumber(order.maximumFill),
      toEthBigNumber(order.listingTime),
      toEthBigNumber(order.expirationTime),
      toEthBigNumber(order.salt)
    );

    if (!sellValid) {
      console.error(order);
      throw new Error(
        "Failed to validate sell order parameters. Make sure you're on the right network!"
      );
    }
  }

  public async _approveAll({
    schemaNames,
    wyAssets,
    accountAddress,
    proxyAddress,
  }: {
    schemaNames: WyvernSchemaName[];
    wyAssets: WyvernAsset[];
    accountAddress: string;
    proxyAddress?: string;
  }) {
    proxyAddress =
      proxyAddress ||
      (await WyvernRegistry.getProxy(
        this._wyvernRegistryAbi,
        accountAddress,
        0
      )) ||
      undefined;
    console.log(
      `_approveAll, account: ${accountAddress}, proxy: ${proxyAddress}`
    );

    if (!proxyAddress) {
      proxyAddress = await WyvernRegistry.registerProxy(
        this._wyvernRegistryAbi,
        accountAddress
      );
    }
    const contractsWithApproveAll: Set<string> = new Set();

    console.log(`_approveAll, wyAssets: ${wyAssets}`);

    return Promise.all(
      wyAssets.map(async (wyAsset, i) => {
        const schemaName = schemaNames[i];
        // Verify that the taker owns the asset
        let isOwner;
        try {
          isOwner = await this._ownsAssetOnChain({
            accountAddress,
            proxyAddress,
            wyAsset,
            schemaName,
          });
        } catch (error) {
          // let it through for assets we don't support yet
          isOwner = true;
        }
        if (!isOwner) {
          const minAmount = 'quantity' in wyAsset ? wyAsset.quantity : 1;
          console.error(
            `Failed on-chain ownership check: ${accountAddress} on ${schemaName}:`,
            wyAsset
          );
          throw new Error(
            `You don't own enough to do that (${minAmount} base units of ${
              wyAsset.address
            }${wyAsset.id ? ' token ' + wyAsset.id : ''})`
          );
        }
        switch (schemaName) {
          case WyvernSchemaName.ERC721:
          case WyvernSchemaName.ERC721v3:
          case WyvernSchemaName.ERC1155:
            // Handle NFTs and SFTs
            // eslint-disable-next-line no-case-declarations
            const wyNFTAsset = wyAsset as WyvernNFTAsset;
            return await this.approveSemiOrNonFungibleToken({
              tokenId: wyNFTAsset.id.toString(),
              tokenAddress: wyNFTAsset.address,
              accountAddress,
              proxyAddress,
              schemaName,
              skipApproveAllIfTokenAddressIn: contractsWithApproveAll,
            });
          case WyvernSchemaName.ERC20:
            // Handle FTs
            // eslint-disable-next-line no-case-declarations
            const wyFTAsset = wyAsset as WyvernFTAsset;
            if (contractsWithApproveAll.has(wyFTAsset.address)) {
              // Return null to indicate no tx occurred
              return null;
            }
            contractsWithApproveAll.add(wyFTAsset.address);
            return await this.approveFungibleToken({
              tokenAddress: wyFTAsset.address,
              accountAddress,
              proxyAddress,
            });
        }
      })
    );
  }

  /**
   * Generate the signature for authorizing an order
   * @param order Unsigned wyvern order
   * @returns order signature in the form of v, r, s, also an optional nonce
   */
  public async authorizeOrder(
    order: UnsignedOrder,
    signerAddress?: string
  ): Promise<(ECSignature & {nonce?: number}) | null> {
    signerAddress = signerAddress || order.maker;

    // We need to manually specify each field because OS orders can contain unrelated data
    const orderForSigning = {
      maker: order.maker,
      registry: order.registry,
      staticTarget: order.staticTarget,
      staticSelector: order.staticSelector,
      staticExtradata: order.staticExtradata,
      maximumFill: order.maximumFill.toFixed(),
      listingTime: order.listingTime.toFixed(),
      expirationTime: order.expirationTime.toFixed(),
      salt: order.salt.toFixed()
    };

    const domain = domainToSign(
      order.exchange,
      this._network === Network.Main ? 1 : 4
    );
    const types = {
      Order: eip712Order.fields,
    };
    const value = {
      ...orderForSigning
    };

    const ecSignature = await signTypedDataAsync(
      this._provider.getSigner(),
      domain,
      types,
      value
    );
    return {...ecSignature};
  }

  /**
   * Check if an account, or its proxy, owns an asset on-chain
   * @param accountAddress Account address for the wallet
   * @param proxyAddress Proxy address for the account
   * @param wyAsset asset to check. If fungible, the `quantity` attribute will be the minimum amount to own
   * @param schemaName WyvernSchemaName for the asset
   */
  public async _ownsAssetOnChain({
    accountAddress,
    proxyAddress,
    wyAsset,
    schemaName,
  }: {
    accountAddress: string;
    proxyAddress?: string | null;
    wyAsset: WyvernAsset;
    schemaName: WyvernSchemaName;
  }): Promise<boolean> {
    const asset: Asset = {
      tokenId: wyAsset.id || null,
      tokenAddress: wyAsset.address,
      schemaName,
    };

    const minAmount = new BigNumber(
      'quantity' in wyAsset ? wyAsset.quantity : 1
    );

    const accountBalance = await this.getAssetBalance({
      accountAddress,
      asset,
    });
    if (accountBalance.gte(minAmount)) {
      return true;
    }

    proxyAddress =
      proxyAddress ||
      (await WyvernRegistry.getProxy(this._wyvernRegistryAbi, accountAddress));
    if (proxyAddress) {
      const proxyBalance = await this.getAssetBalance({
        accountAddress: proxyAddress,
        asset,
      });
      if (proxyBalance.gte(minAmount)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get an account's balance of any Asset.
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param asset The Asset to check balance for
   * @param retries How many times to retry if balance is 0
   */
  public async getAssetBalance(
    {accountAddress, asset}: {accountAddress: string; asset: Asset},
    retries = 1
  ): Promise<BigNumber> {
    const schema = asset.schemaName as WyvernSchemaName;
    if (schema === WyvernSchemaName.ERC20) {
      const erc20Abi = ERC20Abi__factory.connect(
        asset.tokenAddress,
        this._provider
      );
      const count = await erc20Abi.balanceOf(accountAddress);
      return fromEthBigNumber(count);
    } else if (
      schema === WyvernSchemaName.ERC721 ||
      schema === WyvernSchemaName.ERC721v3
    ) {
      const erc721Abi = ERC721Abi__factory.connect(
        asset.tokenAddress,
        this._provider
      );
      const count = await erc721Abi.balanceOf(accountAddress);
      return fromEthBigNumber(count);
    } else {
      // TODO:
    }

    if (retries <= 0) {
      throw new Error('Unable to get current owner from smart contract');
    } else {
      await delay(500);
      // Recursively check owner again
      return await this.getAssetBalance({accountAddress, asset}, retries - 1);
    }
  }

  /**
   * Approve a non-fungible token for use in trades.
   * Requires an account to be initialized first.
   * Called internally, but exposed for dev flexibility.
   * Checks to see if already approved, first. Then tries different approval methods from best to worst.
   * @param param0 __namedParameters Object
   * @param tokenId Token id to approve, but only used if approve-all isn't
   *  supported by the token contract
   * @param tokenAddress The contract address of the token being approved
   * @param accountAddress The user's wallet address
   * @param proxyAddress Address of the user's proxy contract. If not provided,
   *  will attempt to fetch it from Wyvern.
   * @param skipApproveAllIfTokenAddressIn an optional list of token addresses that, if a token is approve-all type, will skip approval
   * @param schemaName The Wyvern schema name corresponding to the asset type
   * @returns Transaction hash if a new transaction was created, otherwise null
   */
  public async approveSemiOrNonFungibleToken({
    tokenId,
    tokenAddress,
    accountAddress,
    proxyAddress,
    skipApproveAllIfTokenAddressIn = new Set(),
    schemaName = WyvernSchemaName.ERC721,
  }: {
    tokenId: string;
    tokenAddress: string;
    accountAddress: string;
    proxyAddress?: string;
    skipApproveAllIfTokenAddressIn?: Set<string>;
    schemaName?:
      | WyvernSchemaName.ERC721
      | WyvernSchemaName.ERC721v3
      | WyvernSchemaName.ERC1155;
  }): Promise<string | null> {
    if (!proxyAddress) {
      proxyAddress =
        (await WyvernRegistry.getProxy(
          this._wyvernRegistryAbi,
          accountAddress
        )) || undefined;
      if (!proxyAddress) {
        throw new Error('Uninitialized account');
      }
    }

    // TODO: Handle ERC1155 approval
    const erc721Abi = ERC721Abi__factory.connect(
      tokenAddress,
      this._provider.getSigner()
    );
    const isApprovedForAll = await erc721Abi.isApprovedForAll(
      accountAddress,
      proxyAddress
    );

    if (isApprovedForAll) {
      // Supports ApproveAll
      this.logger('Already approved proxy for all tokens');
      return null;
    }

    // Suppose `ApproveAll` is supported
    if (skipApproveAllIfTokenAddressIn.has(tokenAddress)) {
      this.logger(
        'Already approving proxy for all tokens in another transaction'
      );
      return null;
    }
    try {
      console.log('Calling erc721Abi.setApprovalForAll...');
      const transaction = await erc721Abi.setApprovalForAll(proxyAddress, true);
      await transaction.wait();
      skipApproveAllIfTokenAddressIn.add(tokenAddress);
      return transaction.hash;
    } catch (error) {
      console.error(error);
      this.logger(
        'Failed to get permission to approve all these tokens for trading. Trying to approve one.'
      );
    }

    // May not support ApproveAll (ERC721 v1 or v2)
    this.logger('Contract may not support Approve All');
    try {
      const transaction = await erc721Abi.approve(proxyAddress, tokenId);
      await transaction.wait();
      return transaction.hash;
    } catch (error) {
      console.error(error);
      throw new Error(
        "Couldn't get permission to approve the token for trading. Their contract might not be implemented correctly."
      );
    }
  }

  /**
   * Approve a fungible token (e.g. W-ETH) for use in trades.
   * Called internally, but exposed for dev flexibility.
   * Checks to see if the minimum amount is already approved, first.
   * @param param0 __namedParameters Object
   * @param accountAddress The user's wallet address
   * @param tokenAddress The contract address of the token being approved
   * @param proxyAddress The user's proxy address. If unspecified, uses the Wyvern token transfer proxy address.
   * @param minimumAmount The minimum amount needed to skip a transaction. Defaults to the max-integer.
   * @returns Transaction hash if a new transaction occurred, otherwise null
   */
  public async approveFungibleToken({
    accountAddress,
    tokenAddress,
    proxyAddress,
    minimumAmount = MAX_UINT_256,
  }: {
    accountAddress: string;
    tokenAddress: string;
    proxyAddress?: string;
    minimumAmount?: BigNumber;
  }): Promise<string | null> {
    proxyAddress =
      proxyAddress ||
      (await WyvernRegistry.getProxy(this._wyvernRegistryAbi, accountAddress));

    const erc20Abi = ERC20Abi__factory.connect(
      tokenAddress,
      this._provider.getSigner()
    );
    const approvedAmount = await erc20Abi.allowance(
      accountAddress,
      proxyAddress
    );

    if (fromEthBigNumber(approvedAmount).gte(minimumAmount)) {
      this.logger('Already approved enough currency for trading');
      return null;
    }

    this.logger(
      `Not enough token approved for trade: ${approvedAmount} approved to transfer ${tokenAddress}`
    );

    const transaction = await erc20Abi.approve(
      proxyAddress,
      toEthBigNumber(MAX_UINT_256),
      {
        from: accountAddress,
      }
    );
    await transaction.wait();
    return transaction.hash;
  }

  /**
   * Get the listing and expiration time parameters for a new order
   * @param expirationTimestamp Timestamp to expire the order (in seconds), or 0 for non-expiring
   * @param listingTimestamp Timestamp to start the order (in seconds), or undefined to start it now
   * @param waitingForBestCounterOrder Whether this order should be hidden until the best match is found
   */
  private _getTimeParameters({
    expirationTimestamp = getMaxOrderExpirationTimestamp(),
    listingTimestamp,
    waitingForBestCounterOrder = false,
    isMatchingOrder = false,
  }: {
    expirationTimestamp?: number;
    listingTimestamp?: number;
    waitingForBestCounterOrder?: boolean;
    isMatchingOrder?: boolean;
  }) {
    const maxExpirationDate = new Date();

    maxExpirationDate.setMonth(
      maxExpirationDate.getMonth() + MAX_EXPIRATION_MONTHS
    );

    const maxExpirationTimeStamp = Math.round(
      maxExpirationDate.getTime() / 1000
    );

    const minListingTimestamp = Math.round(Date.now() / 1000);

    if (!isMatchingOrder && expirationTimestamp === 0) {
      throw new Error('Expiration time cannot be 0');
    }
    if (listingTimestamp && listingTimestamp < minListingTimestamp) {
      throw new Error('Listing time cannot be in the past.');
    }
    if (listingTimestamp && listingTimestamp >= expirationTimestamp) {
      throw new Error('Listing time must be before the expiration time.');
    }

    if (waitingForBestCounterOrder && listingTimestamp) {
      throw new Error('Cannot schedule an English auction for the future.');
    }
    if (parseInt(expirationTimestamp.toString()) !== expirationTimestamp) {
      throw new Error('Expiration timestamp must be a whole number of seconds');
    }
    if (expirationTimestamp > maxExpirationTimeStamp) {
      throw new Error('Expiration time must not exceed six months from now');
    }

    if (waitingForBestCounterOrder) {
      listingTimestamp = expirationTimestamp;
      // Expire one week from now, to ensure server can match it
      // Later, this will expire closer to the listingTime
      expirationTimestamp =
        expirationTimestamp + ORDER_MATCHING_LATENCY_SECONDS;

      // The minimum expiration time has to be at least fifteen minutes from now
      const minEnglishAuctionListingTimestamp =
        minListingTimestamp + MIN_EXPIRATION_MINUTES * 60;

      if (
        !isMatchingOrder &&
        listingTimestamp < minEnglishAuctionListingTimestamp
      ) {
        throw new Error(
          `Expiration time must be at least ${MIN_EXPIRATION_MINUTES} minutes from now`
        );
      }
    } else {
      // Small offset to account for latency
      listingTimestamp =
        listingTimestamp || Math.round(Date.now() / 1000 - 100);

      // The minimum expiration time has to be at least fifteen minutes from now
      const minExpirationTimestamp =
        listingTimestamp + MIN_EXPIRATION_MINUTES * 60;

      if (!isMatchingOrder && expirationTimestamp < minExpirationTimestamp) {
        throw new Error(
          `Expiration time must be at least ${MIN_EXPIRATION_MINUTES} minutes from the listing date`
        );
      }
    }

    return {
      listingTime: new BigNumber(listingTimestamp),
      expirationTime: new BigNumber(expirationTimestamp),
    };
  }

  /**
   * Compute the `basePrice` and `extra` parameters to be used to price an order.
   * Also validates the expiration time and auction type.
   * @param tokenAddress Address of the ERC-20 token to use for trading.
   * Use the null address for ETH
   * @param expirationTime When the auction expires, or 0 if never.
   * @param startAmount The base value for the order, in the token's main units (e.g. ETH instead of wei)
   * @param endAmount The end value for the order, in the token's main units (e.g. ETH instead of wei). If unspecified, the order's `extra` attribute will be 0
   */
  private async _getPriceParameters(
    orderSide: OrderSide,
    tokenAddress: string,
    expirationTime: number,
    startAmount: number,
    endAmount?: number,
    waitingForBestCounterOrder = false,
    englishAuctionReservePrice?: number
  ) {
    const priceDiff = endAmount ? startAmount - endAmount : 0;
    const paymentToken = tokenAddress.toLowerCase();
    const isEther = tokenAddress === NULL_ADDRESS;
    const {tokens} = await this.api.getPaymentTokens({
      address: paymentToken,
    });
    const token = tokens[0];

    // Validation
    if (isNaN(startAmount) || startAmount === null || startAmount < 0) {
      throw new Error('Starting price must be a number >= 0');
    }
    if (!isEther && !token) {
      throw new Error(`No ERC-20 token found for '${paymentToken}'`);
    }
    if (isEther && waitingForBestCounterOrder) {
      throw new Error(
        'English auctions must use wrapped ETH or an ERC-20 token.'
      );
    }
    if (isEther && orderSide === OrderSide.Buy) {
      throw new Error('Offers must use wrapped ETH or an ERC-20 token.');
    }
    if (priceDiff < 0) {
      throw new Error(
        'End price must be less than or equal to the start price.'
      );
    }
    if (priceDiff > 0 && expirationTime === 0) {
      throw new Error(
        'Expiration time must be set if order will change in price.'
      );
    }
    if (englishAuctionReservePrice && !waitingForBestCounterOrder) {
      throw new Error('Reserve prices may only be set on English auctions.');
    }
    if (
      englishAuctionReservePrice &&
      englishAuctionReservePrice < startAmount
    ) {
      throw new Error(
        'Reserve price must be greater than or equal to the start amount.'
      );
    }

    const basePrice = isEther
      ? ethers.utils.parseEther(startAmount.toString())
      : toBaseUnitAmount(new BigNumber(startAmount), token.decimals);

    const extra = isEther
      ? ethers.utils.parseEther(priceDiff.toString())
      : toBaseUnitAmount(new BigNumber(priceDiff), token.decimals);

    const reservePrice = englishAuctionReservePrice
      ? isEther
        ? ethers.utils.parseEther(englishAuctionReservePrice.toString())
        : toBaseUnitAmount(
            new BigNumber(englishAuctionReservePrice),
            token.decimals
          )
      : undefined;

    return {basePrice, extra, paymentToken, reservePrice};
  }

  /**
   * Compute the fees for an order
   * @param param0 __namedParameters
   * @param asset Asset to use for fees. May be blank ONLY for multi-collection bundles.
   * @param side The side of the order (buy or sell)
   * @param accountAddress The account to check fees for (useful if fees differ by account, like transfer fees)
   * @param extraBountyBasisPoints The basis points to add for the bounty. Will throw if it exceeds the assets' contract's OneLand fee.
   */
  public async computeFees({
    asset,
    side,
    accountAddress,
    extraBountyBasisPoints = 0,
  }: {
    asset?: OneLandAsset;
    side: OrderSide;
    accountAddress?: string;
    extraBountyBasisPoints?: number;
  }): Promise<ComputedFees> {
    let onelandBuyerFeeBasisPoints = DEFAULT_BUYER_FEE_BASIS_POINTS;
    let onelandSellerFeeBasisPoints = DEFAULT_SELLER_FEE_BASIS_POINTS;
    let devBuyerFeeBasisPoints = 0;
    let devSellerFeeBasisPoints = 0;
    let transferFee = new BigNumber(0);
    let transferFeeTokenAddress = null;
    let maxTotalBountyBPS = DEFAULT_MAX_BOUNTY;

    if (asset) {
      onelandBuyerFeeBasisPoints =
        +asset.collection.onelandBuyerFeeBasisPoints || 0;
      onelandSellerFeeBasisPoints =
        +asset.collection.onelandSellerFeeBasisPoints || 0;
      devBuyerFeeBasisPoints = +asset.collection.devBuyerFeeBasisPoints || 0;
      devSellerFeeBasisPoints = +asset.collection.devSellerFeeBasisPoints || 0;

      maxTotalBountyBPS = onelandSellerFeeBasisPoints;
    }

    // Compute transferFrom fees
    if (side === OrderSide.Sell && asset) {
      // Server-side knowledge
      transferFee = asset.transferFee
        ? new BigNumber(asset.transferFee)
        : transferFee;
      transferFeeTokenAddress = asset.transferFeePaymentToken
        ? asset.transferFeePaymentToken.address
        : transferFeeTokenAddress;
    }

    // Compute bounty
    const sellerBountyBasisPoints =
      side === OrderSide.Sell ? extraBountyBasisPoints : 0;

    // Check that bounty is in range of the oneland fee
    const bountyTooLarge =
      sellerBountyBasisPoints + ONELAND_SELLER_BOUNTY_BASIS_POINTS >
      maxTotalBountyBPS;
    if (sellerBountyBasisPoints > 0 && bountyTooLarge) {
      let errorMessage = `Total bounty exceeds the maximum for this asset type (${
        maxTotalBountyBPS / 100
      }%).`;
      if (maxTotalBountyBPS >= ONELAND_SELLER_BOUNTY_BASIS_POINTS) {
        errorMessage += ` Remember that OneLand will add ${
          ONELAND_SELLER_BOUNTY_BASIS_POINTS / 100
        }% for referrers with OneLand accounts!`;
      }
      throw new Error(errorMessage);
    }

    return {
      totalBuyerFeeBasisPoints:
        onelandBuyerFeeBasisPoints + devBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints:
        onelandSellerFeeBasisPoints + devSellerFeeBasisPoints,
      onelandBuyerFeeBasisPoints,
      onelandSellerFeeBasisPoints,
      devBuyerFeeBasisPoints,
      devSellerFeeBasisPoints,
      sellerBountyBasisPoints,
      transferFee,
      transferFeeTokenAddress,
    };
  }

  /**
   * Validate fee parameters
   * @param totalBuyerFeeBasisPoints Total buyer fees
   * @param totalSellerFeeBasisPoints Total seller fees
   */
  private _validateFees(
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number
  ) {
    const maxFeePercent = INVERSE_BASIS_POINT / 100;

    if (
      totalBuyerFeeBasisPoints > INVERSE_BASIS_POINT ||
      totalSellerFeeBasisPoints > INVERSE_BASIS_POINT
    ) {
      throw new Error(
        `Invalid buyer/seller fees: must be less than ${maxFeePercent}%`
      );
    }

    if (totalBuyerFeeBasisPoints < 0 || totalSellerFeeBasisPoints < 0) {
      throw new Error('Invalid buyer/seller fees: must be at least 0%');
    }
  }

  public _getSellFeeParameters(
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number,
    waitForHighestBid: boolean,
    sellerBountyBasisPoints = 0
  ) {
    // Use buyer as the maker when it's an English auction, so Wyvern sets prices correctly
    const feeRecipient = waitForHighestBid
      ? NULL_ADDRESS
      : ONELAND_FEE_RECIPIENT;

    // Swap maker/taker fees when it's an English auction,
    // since these sell orders are takers not makers
    const makerRelayerFee = waitForHighestBid
      ? new BigNumber(totalBuyerFeeBasisPoints)
      : new BigNumber(totalSellerFeeBasisPoints);
    const takerRelayerFee = waitForHighestBid
      ? new BigNumber(totalSellerFeeBasisPoints)
      : new BigNumber(totalBuyerFeeBasisPoints);

    return {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee: new BigNumber(0),
      takerProtocolFee: new BigNumber(0),
      makerReferrerFee: new BigNumber(sellerBountyBasisPoints),
      feeRecipient,
      feeMethod: FeeMethod.SplitFee,
    };
  }

  public async _getStaticCallTargetAndExtraData({
    asset,
    useTxnOriginStaticCall,
  }: {
    asset: OneLandAsset;
    useTxnOriginStaticCall: boolean;
  }): Promise<{
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  }> {
    // TODO: Do the real check
    const staticTarget = WyvernStatic.getContractAddress(this._network);
    // const iface = new ethers.utils.Interface('function any(bytes memory, address[7] memory, AuthenticatedProxy.HowToCall[2] memory, uint[6] memory, bytes memory, bytes memory)');
    // const staticSelector = iface.getSighash('any');
    const staticSelector = this._wyvernStaticAbi.interface.getSighash('any');

    return {
      staticTarget,
      staticSelector,
      staticExtradata: '0x',
    };
  }
}
