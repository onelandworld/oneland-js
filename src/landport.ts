import { ethers } from 'ethers';
import { BigNumber } from 'bignumber.js';
import {
  Network,
  Order,
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
  WyvernAtomicMatchParameters,
} from './types';
import {
  WyvernRegistryAbi,
  WyvernExchangeAbi,
  WyvernStaticAbi,
  ERC20Abi__factory,
  ERC721Abi__factory,
  StaticMarketAbi,
  StaticMarketAbi__factory,
} from './typechain';
import {
  WyvernRegistry,
  WyvernExchange,
  WyvernStatic,
  StaticMarket,
} from './contracts';
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
  makeBigNumber,
  toEthBigNumber,
  fromEthBigNumber,
  assignOrdersToSides,
  constructWyvernV3AtomicMatchParameters,
  orderToJSON,
  eip712,
  delay,
  debug,
} from './utils';
import {
  NULL_ADDRESS,
  MAX_UINT_256,
  NULL_BLOCK_HASH,
  ZERO_BYTES32,
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
import { tokens } from './tokens';
import { OneLandAPI } from './api';

export class LandPort {
  private _network: Network;
  private _provider: ethers.providers.Web3Provider;
  private readonly api: OneLandAPI;
  private _wyvernRegistryAbi: WyvernRegistryAbi;
  private _wyvernExchangeAbi: WyvernExchangeAbi;
  private _wyvernStaticAbi: WyvernStaticAbi;
  private _staticMarketAbi: StaticMarketAbi;
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
      this._provider.getSigner()
    );
    this._wyvernStaticAbi = WyvernStatic.getAbiClass(
      this._network,
      this._provider
    );
    this._staticMarketAbi = StaticMarket.getAbiClass(
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
    debug('_makeSellOrder', order);

    await this._sellOrderValidationAndApprovals({ order, accountAddress });

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

    return this.validateAndPostOrder(orderWithSignature);
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

    const { basePrice, extra, paymentToken, reservePrice } =
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

    const { staticTarget, staticSelector, staticExtradata } =
      this._getStaticCallTargetAndExtraData({
        paymentTokenAddress,
        side: OrderSide.Sell,
        tokenAddress: asset.tokenAddress,
        tokenId: asset.tokenId,
        sellingPrice: basePrice,
      });

    return {
      registry: this._wyvernRegistryAbi.address,
      exchange: this._wyvernExchangeAbi.address,
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
      tokenAddress: asset.tokenAddress,
      tokenId: asset.tokenId,
      paymentToken,
      basePrice,
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
    debug('order.metadata', order.metadata);
    debug('wyAssets', wyAssets);

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
    debug(`_approveAll, account: ${accountAddress}, proxy: ${proxyAddress}`);

    if (!proxyAddress) {
      proxyAddress = await WyvernRegistry.registerProxy(
        this._wyvernRegistryAbi,
        accountAddress
      );
    }
    const contractsWithApproveAll: Set<string> = new Set();

    debug(`_approveAll, wyAssets: ${wyAssets}`);

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
  ): Promise<(ECSignature & { nonce?: number }) | null> {
    signerAddress = signerAddress || order.maker;

    const orderForSigning = {
      maker: order.maker,
      registry: order.registry,
      staticTarget: order.staticTarget,
      staticSelector: order.staticSelector,
      staticExtradata: order.staticExtradata,
      maximumFill: order.maximumFill.toFixed(),
      listingTime: order.listingTime.toFixed(),
      expirationTime: order.expirationTime.toFixed(),
      salt: order.salt.toFixed(),
    };

    const domain = domainToSign(
      order.exchange,
      this._network === Network.Main ? 1 : 4
    );
    const types = {
      Order: eip712Order.fields,
    };
    const value = {
      ...orderForSigning,
    };
    // debug('signTypedDataAsync, domain', domain);
    // debug('signTypedDataAsync, types', types);
    // debug('signTypedDataAsync, value', value);

    const ecSignature = await signTypedDataAsync(
      this._provider.getSigner(),
      domain,
      types,
      value
    );
    return { ...ecSignature };
  }

  /**
   * Fullfill or "take" an order for an asset, either a buy or sell order
   * @param param0 __namedParamaters Object
   * @param order The order to fulfill, a.k.a. "take"
   * @param accountAddress The taker's wallet address
   * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
   * @param referrerAddress The optional address that referred the order
   * @returns Transaction hash for fulfilling the order
   */
  public async fulfillOrder({
    order,
    accountAddress,
    recipientAddress,
    referrerAddress,
  }: {
    order: Order;
    accountAddress: string;
    recipientAddress?: string;
    referrerAddress?: string;
  }): Promise<string> {
    // debug('fulfillOrder', order);

    const matchingOrder = this._makeMatchingOrder({
      order,
      accountAddress,
      recipientAddress: recipientAddress || accountAddress,
    });
    // debug('matchingOrder', matchingOrder);

    const hashedMatchingOrder = {
      ...matchingOrder,
      hash: getOrderHash(matchingOrder),
    };
    // debug('hashedMatchingOrder', hashedMatchingOrder);

    let matchingOrderSignature;
    try {
      matchingOrderSignature = await this.authorizeOrder(
        hashedMatchingOrder,
        accountAddress
      );
    } catch (error) {
      console.error(error);
      throw new Error('You declined to authorize your auction');
    }
    const matchingOrderWithSignature = {
      ...hashedMatchingOrder,
      ...matchingOrderSignature,
    };

    const { buy, sell } = assignOrdersToSides(
      order,
      matchingOrderWithSignature
    );

    const metadata = this._getMetadata(order, referrerAddress);
    const transaction = await this._atomicMatch({
      buy,
      sell,
      accountAddress,
      metadata,
    });
    await transaction.wait();
    return transaction.hash;
  }

  public _makeMatchingOrder({
    order,
    accountAddress,
    recipientAddress,
  }: {
    order: UnsignedOrder;
    accountAddress: string;
    recipientAddress: string;
  }): UnsignedOrder {
    accountAddress = validateAndFormatWalletAddress(accountAddress);
    recipientAddress = validateAndFormatWalletAddress(recipientAddress);

    const { staticTarget, staticSelector, staticExtradata } =
      this._getStaticCallTargetAndExtraData({
        paymentTokenAddress: order.paymentToken,
        side: OrderSide.Buy,
        tokenAddress: order.tokenAddress,
        tokenId: order.tokenId,
        buyingPrice: order.basePrice,
      });

    const times = this._getTimeParameters({
      expirationTimestamp: 0,
      isMatchingOrder: true,
    });

    // const feeRecipient =  ONELAND_FEE_RECIPIENT;

    const matchingOrder: UnhashedOrder = {
      registry: order.registry,
      exchange: order.exchange,
      maker: accountAddress,
      quantity: order.quantity,
      maximumFill: order.maximumFill,
      feeMethod: order.feeMethod,
      side: (order.side + 1) % 2,
      saleKind: SaleKind.FixedPrice,
      staticTarget: staticTarget,
      staticSelector: staticSelector,
      staticExtradata: staticExtradata,
      recipientAddress,
      tokenAddress: order.tokenAddress,
      tokenId: order.tokenId,
      paymentToken: order.paymentToken,
      basePrice: order.basePrice,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: order.metadata,
    };

    return matchingOrder;
  }

  private _getMetadata(order: Order, referrerAddress?: string) {
    const referrer = referrerAddress || order.metadata.referrerAddress;
    if (referrer && ethers.utils.isAddress(referrer)) {
      return referrer;
    }
    return undefined;
  }

  private async _atomicMatch({
    buy,
    sell,
    accountAddress,
    metadata = NULL_BLOCK_HASH,
  }: {
    buy: Order;
    sell: Order;
    accountAddress: string;
    metadata?: string;
  }) {
    let value;
    let shouldValidateBuy = true;
    let shouldValidateSell = true;
    // Only check buy, but shouldn't matter as they should always be equal

    if (sell.maker.toLowerCase() === accountAddress.toLowerCase()) {
      // USER IS THE SELLER, only validate the buy order
      await this._sellOrderValidationAndApprovals({
        order: sell,
        accountAddress,
      });
      shouldValidateSell = false;
    } else if (buy.maker.toLowerCase() === accountAddress.toLowerCase()) {
      // USER IS THE BUYER, only validate the sell order
      await this._buyOrderValidationAndApprovals({
        order: buy,
        counterOrder: sell,
        accountAddress,
      });
      shouldValidateBuy = false;

      // If using ETH to pay, set the value of the transaction to the current price
      if (buy.paymentToken === NULL_ADDRESS) {
        // value = await this._getRequiredAmountForTakingSellOrder(sell);
      }
    } else {
      // User is neither - matching service
    }

    debug('** Buy order: ', buy);
    debug('** Sell order: ', sell);
    debug(
      `accountAddress: ${accountAddress}, shouldValidateSell: ${shouldValidateSell}, shouldValidateBuy: ${shouldValidateBuy}`
    );

    await this._validateMatch({
      buy,
      sell,
      accountAddress,
      shouldValidateBuy,
      shouldValidateSell,
    });

    // Construct call data
    const erc721Abi = ERC721Abi__factory.connect(
      sell.tokenAddress,
      this._provider.getSigner()
    );
    const recipientAddress = buy.recipientAddress || accountAddress;
    const data = (
      await erc721Abi.populateTransaction.transferFrom(
        sell.maker,
        recipientAddress,
        sell.tokenId
      )
    ).data!;
    const calldata = {
      target: sell.tokenAddress,
      howToCall: 0,
      data,
    };
    // debug('** call data', data);

    let countercalldata;
    if (sell.paymentToken === NULL_ADDRESS) {
      const counterdata = (
        await this._wyvernStaticAbi.populateTransaction.test()
      ).data!;
      countercalldata = {
        target: this._wyvernStaticAbi.address,
        howToCall: 0,
        data: counterdata,
      };
    } else {
      // Assume ERC20 token
      const erc20Abi = ERC20Abi__factory.connect(
        sell.paymentToken,
        this._provider
      );
      const counterdata = (
        await erc20Abi.populateTransaction.transferFrom(
          buy.maker,
          sell.maker,
          toEthBigNumber(sell.basePrice)
        )
      ).data!;
      countercalldata = {
        target: erc20Abi.address,
        howToCall: 0,
        data: counterdata,
      };
    }

    // debug('** counterdata', counterdata);

    const args: WyvernAtomicMatchParameters =
      constructWyvernV3AtomicMatchParameters(
        sell,
        calldata,
        {
          v: sell.v || 0,
          r: sell.r || NULL_BLOCK_HASH,
          s: sell.s || NULL_BLOCK_HASH,
        },
        buy,
        countercalldata,
        {
          v: buy.v || 0,
          r: buy.r || NULL_BLOCK_HASH,
          s: buy.s || NULL_BLOCK_HASH,
        },
        ZERO_BYTES32
      );

    // debug('_wyvernExchangeAbi.atomicMatch_', args);
    const trans = await this._wyvernExchangeAbi.atomicMatch_(
      args[0],
      args[1],
      args[2],
      args[3],
      args[4],
      args[5],
      args[6],
      args[7],
      args[8],
      {
        from: accountAddress,
        value:
          sell.paymentToken === NULL_ADDRESS
            ? toEthBigNumber(sell.basePrice)
            : toEthBigNumber(new BigNumber(0)),
      }
    );
    return trans;
  }

  /**
   * Validate against Wyvern that a buy and sell order can match
   * @param param0 __namedParameters Object
   * @param buy The buy order to validate
   * @param sell The sell order to validate
   * @param accountAddress Address for the user's wallet
   * @param shouldValidateBuy Whether to validate the buy order individually.
   * @param shouldValidateSell Whether to validate the sell order individually.
   * @param retries How many times to retry if validation fails
   */
  public async _validateMatch(
    {
      buy,
      sell,
      accountAddress,
      shouldValidateBuy = false,
      shouldValidateSell = false,
    }: {
      buy: Order;
      sell: Order;
      accountAddress: string;
      shouldValidateBuy?: boolean;
      shouldValidateSell?: boolean;
    },
    retries = 1
  ): Promise<boolean> {
    try {
      if (shouldValidateBuy) {
        const buyValid = await this._validateOrder(buy);
        this.logger(`Buy order is valid: ${buyValid}`);

        if (!buyValid) {
          throw new Error(
            'Invalid buy order. It may have recently been removed. Please refresh the page and try again!'
          );
        }
      }

      if (shouldValidateSell) {
        const sellValid = await this._validateOrder(sell);
        this.logger(`Sell order is valid: ${sellValid}`);

        if (!sellValid) {
          throw new Error(
            'Invalid sell order. It may have recently been removed. Please refresh the page and try again!'
          );
        }
      }

      return true;
    } catch (error) {
      debug(error);

      if (retries <= 0) {
        throw new Error(
          `Error matching this listing: ${
            error instanceof Error ? error.message : ''
          }. Please contact the maker or try again later!`
        );
      }
      await delay(500);
      return await this._validateMatch(
        { buy, sell, accountAddress, shouldValidateBuy, shouldValidateSell },
        retries - 1
      );
    }
  }

  // For creating email whitelists on order takers
  public async _createEmailWhitelistEntry({
    order,
    buyerEmail,
  }: {
    order: UnhashedOrder;
    buyerEmail: string;
  }) {
    const asset = 'asset' in order.metadata ? order.metadata.asset : undefined;
    if (!asset || !asset.id) {
      throw new Error('Whitelisting only available for non-fungible assets.');
    }
    await this.api.postAssetWhitelist(asset.address, asset.id, buyerEmail);
  }

  public async _validateOrder(order: Order): Promise<boolean> {
    const signature = ethers.utils.defaultAbiCoder.encode(
      ['uint8', 'bytes32', 'bytes32'],
      [order.v, order.r, order.s]
    );

    const isValid = await this._wyvernExchangeAbi.validateOrderAuthorization_(
      order.hash!,
      order.maker,
      signature
    );
    debug(`** validateOrderAuthorization_, ${isValid}`);
    return isValid;
  }

  // Throws
  public async _buyOrderValidationAndApprovals({
    order,
    counterOrder,
    accountAddress,
  }: {
    order: UnhashedOrder;
    counterOrder?: Order;
    accountAddress: string;
  }) {
    const tokenAddress = order.paymentToken;

    if (tokenAddress !== NULL_ADDRESS) {
      const balance = await this.getTokenBalance({
        accountAddress,
        tokenAddress,
      });

      /* NOTE: no buy-side auctions for now, so sell.saleKind === 0 */
      let minimumAmount = makeBigNumber(order.basePrice);
      if (counterOrder) {
        minimumAmount = await this._getRequiredAmountForTakingSellOrder(
          counterOrder
        );
      }

      // Check WETH balance
      if (balance.toNumber() < minimumAmount.toNumber()) {
        if (
          tokenAddress === tokens[this._network].canonicalWrappedEther.address
        ) {
          throw new Error('Insufficient balance. You may need to wrap Ether.');
        } else {
          throw new Error('Insufficient balance.');
        }
      }

      // Check token approval
      // This can be done at a higher level to show UI
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount,
      });
    }

    // Check order formation
    const buyValid = await this._wyvernExchangeAbi.validateOrderParameters_(
      order.registry,
      order.maker,
      order.staticTarget,
      order.staticSelector,
      order.staticExtradata,
      toEthBigNumber(makeBigNumber(1)),
      toEthBigNumber(order.listingTime),
      toEthBigNumber(order.expirationTime),
      toEthBigNumber(order.salt)
    );
    if (!buyValid) {
      console.error(order);
      throw new Error(
        "Failed to validate buy order parameters. Make sure you're on the right network!"
      );
    }
  }

  private async _getRequiredAmountForTakingSellOrder(sell: Order) {
    // TODO: calculate price based on parameters like sell kind, fee, etc
    return sell.basePrice;
  }

  /**
   * Post an order to the OneLand orderbook.
   * @param order The order to post. Can either be signed by the maker or pre-approved on the Wyvern contract using approveOrder.
   * @returns The order as stored by the orderbook
   */
  public async validateAndPostOrder(order: Order): Promise<Order> {
    // Validation is called server-side
    const confirmedOrder = await this.api.postOrder(orderToJSON(order));
    return confirmedOrder;
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
   * Get the balance of a fungible token.
   * Convenience method for getAssetBalance for fungibles
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param tokenAddress The address of the token to check balance for
   * @param schemaName Optional schema name for the fungible token
   * @param retries Number of times to retry if balance is undefined
   */
  public async getTokenBalance(
    {
      accountAddress,
      tokenAddress,
      schemaName = WyvernSchemaName.ERC20,
    }: {
      accountAddress: string;
      tokenAddress: string;
      schemaName?: WyvernSchemaName;
    },
    retries = 1
  ) {
    const asset: Asset = {
      tokenId: null,
      tokenAddress,
      schemaName,
    };
    return this.getAssetBalance({ accountAddress, asset }, retries);
  }

  /**
   * Get an account's balance of any Asset.
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param asset The Asset to check balance for
   * @param retries How many times to retry if balance is 0
   */
  public async getAssetBalance(
    { accountAddress, asset }: { accountAddress: string; asset: Asset },
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
      return await this.getAssetBalance({ accountAddress, asset }, retries - 1);
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
      // debug('Calling erc721Abi.setApprovalForAll...');
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
    const { tokens } = await this.api.getPaymentTokens({
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
      ? fromEthBigNumber(ethers.utils.parseEther(startAmount.toString()))
      : toBaseUnitAmount(new BigNumber(startAmount), token.decimals);

    const extra = isEther
      ? fromEthBigNumber(ethers.utils.parseEther(priceDiff.toString()))
      : toBaseUnitAmount(new BigNumber(priceDiff), token.decimals);

    const reservePrice = englishAuctionReservePrice
      ? isEther
        ? fromEthBigNumber(
            ethers.utils.parseEther(englishAuctionReservePrice.toString())
          )
        : toBaseUnitAmount(
            new BigNumber(englishAuctionReservePrice),
            token.decimals
          )
      : undefined;

    return { basePrice, extra, paymentToken, reservePrice };
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

  public _getStaticCallTargetAndExtraData({
    paymentTokenAddress,
    side,
    tokenAddress,
    tokenId,
    sellingPrice,
    buyingPrice,
  }: {
    paymentTokenAddress: string;
    side: OrderSide;
    tokenAddress?: string;
    tokenId?: string;
    sellingPrice?: BigNumber;
    buyingPrice?: BigNumber;
  }): {
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  } {
    let staticTarget, staticSelector, staticExtradata;

    const paymentToken = paymentTokenAddress.toLocaleLowerCase();
    const isEther = paymentToken === NULL_ADDRESS;
    // Swap ERC721 with Ether
    if (isEther) {
      staticTarget = this._wyvernStaticAbi.address;
      staticSelector = this._wyvernStaticAbi.interface.getSighash('anyAddOne');
      staticExtradata = '0x';
    } else {
      // Swap ERC721 with ERC20 token, Sell side
      if (side === OrderSide.Sell) {
        staticTarget = this._staticMarketAbi.address;
        staticSelector = this._staticMarketAbi.interface.getSighash(
          'ERC721ForERC20(bytes,address[7],uint8[2],uint256[6],bytes,bytes)'
        );
        // debug(tokenAddress!, paymentToken, tokenId, sellingPrice);
        staticExtradata = ethers.utils.defaultAbiCoder.encode(
          ['address[2]', 'uint256[2]'],
          [
            [tokenAddress!, paymentToken],
            [tokenId, toEthBigNumber(sellingPrice!)],
          ]
        );
      }
      // Swap ERC721 with ERC20 token, Buy side
      else {
        staticTarget = this._staticMarketAbi.address;
        staticSelector = this._staticMarketAbi.interface.getSighash(
          'ERC20ForERC721(bytes,address[7],uint8[2],uint256[6],bytes,bytes)'
        );
        staticExtradata = ethers.utils.defaultAbiCoder.encode(
          ['address[2]', 'uint256[2]'],
          [
            [paymentToken, tokenAddress!],
            [tokenId, toEthBigNumber(buyingPrice!)],
          ]
        );
      }
    }

    return {
      staticTarget,
      staticSelector,
      staticExtradata,
    };
  }
}
