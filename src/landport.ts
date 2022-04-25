import * as _ from 'lodash';
import { ethers } from 'ethers';
/* eslint-disable node/no-extraneous-import */
import { TypedDataSigner } from '@ethersproject/abstract-signer';
import { BigNumber } from 'bignumber.js';
import {
  Network,
  Order,
  UnhashedOrder,
  SaleKind,
  Asset,
  OrderSide,
  OneLandAPIConfig,
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
  WyvernAtomicizerAbi,
  WyvernStaticAbi,
  ERC20Abi__factory,
  ERC721Abi__factory,
  StaticMarketAbi,
  WETHAbi,
} from './typechain';
import {
  WyvernRegistry,
  WyvernExchange,
  WyvernAtomicizer,
  WyvernStatic,
  StaticMarket,
  WETH,
} from './contracts';
import {
  getDefaultOrderExpirationTimestamp,
  validateAndFormatWalletAddress,
  toBaseUnitAmount,
  generatePseudoRandomSalt,
  getWyvernAsset,
  getOrderHash,
  domainToSign,
  eip712Order,
  signTypedDataAsync,
  makeBigNumber,
  toEthBigNumber,
  fromEthBigNumber,
  assignOrdersToSides,
  constructWyvernV3AtomicMatchParameters,
  orderToJSON,
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
  ONELAND_FEE_RECIPIENT,
  DEFAULT_ONELAND_FEE_BASIS_POINTS,
  MAX_ONELAND_FEE_BASIS_POINTS,
  MAX_DEV_FEE_BASIS_POINTS,
} from './constants';
import { OneLandAPI } from './api';

export class LandPort {
  private _network: Network;
  private _provider: ethers.providers.JsonRpcProvider;
  private _signer: ethers.Signer & TypedDataSigner;
  private readonly api: OneLandAPI;
  private _wyvernRegistryAbi: WyvernRegistryAbi;
  private _wyvernExchangeAbi: WyvernExchangeAbi;
  private _wyvernAtomicizerAbi: WyvernAtomicizerAbi;
  private _wyvernStaticAbi: WyvernStaticAbi;
  private _staticMarketAbi: StaticMarketAbi;
  private _wethAbi: WETHAbi;
  private logger: (arg: string) => void;

  constructor(
    provider: ethers.providers.JsonRpcProvider,
    apiConfig: OneLandAPIConfig,
    signer?: ethers.Signer & TypedDataSigner,
    logger?: (arg: string) => void
  ) {
    apiConfig.network = apiConfig.network || Network.Main;
    this._provider = provider;
    this._signer = signer;
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
    this._wyvernAtomicizerAbi = WyvernAtomicizer.getAbiClass(
      this._network,
      this._provider
    );
    this._wyvernStaticAbi = WyvernStatic.getAbiClass(
      this._network,
      this._provider
    );
    this._staticMarketAbi = StaticMarket.getAbiClass(
      this._network,
      this._provider
    );
    this._wethAbi = WETH.getAbiClass(this._network, this._provider);

    // Debugging: default to nothing
    this.logger = logger || ((arg: string) => arg);
  }

  public async wrapEth({
    amountInEth,
    accountAddress,
  }: {
    amountInEth: number;
    accountAddress: string;
  }) {
    const decimals = await this._wethAbi.decimals();
    const amount = toBaseUnitAmount(new BigNumber(amountInEth), decimals);

    const wethAbi = this._wethAbi.connect(
      this._signer || this._provider.getSigner(accountAddress)
    );
    const transaction = await wethAbi.deposit({
      from: accountAddress,
      value: toEthBigNumber(amount),
    });
    await transaction.wait();
  }

  public async unwrapWeth({
    amountInEth,
    accountAddress,
  }: {
    amountInEth: number;
    accountAddress: string;
  }) {
    const decimals = await this._wethAbi.decimals();
    const amount = toBaseUnitAmount(new BigNumber(amountInEth), decimals);

    const wethAbi = this._wethAbi.connect(
      this._signer || this._provider.getSigner(accountAddress)
    );
    const transaction = await wethAbi.withdraw(toEthBigNumber(amount), {
      from: accountAddress,
    });
    await transaction.wait();
  }

  public async createBuyOrder({
    asset,
    accountAddress,
    startAmount,
    expirationTime = getDefaultOrderExpirationTimestamp(),
    paymentTokenAddress,
  }: {
    asset: Asset;
    accountAddress: string;
    startAmount: number;
    expirationTime?: number;
    paymentTokenAddress: string;
    sellOrder?: UnhashedOrder;
  }): Promise<Order> {
    if (
      !paymentTokenAddress ||
      paymentTokenAddress.toLocaleLowerCase() === NULL_ADDRESS
    ) {
      throw new Error('ERC20 payment token required');
    }

    const order = await this._makeBuyOrder({
      asset,
      quantity: 1,
      maximumFill: 1,
      accountAddress,
      startAmount,
      expirationTime,
      paymentTokenAddress,
    });

    await this._buyOrderValidationAndApprovals({ order, accountAddress });
    const hashedOrder = {
      ...order,
      hash: getOrderHash(order),
    };
    let signature;
    try {
      signature = await this.authorizeOrder(hashedOrder);
    } catch (error) {
      console.error(error);
      throw new Error('You declined to authorize your offer');
    }

    const orderWithSignature = {
      ...hashedOrder,
      ...signature,
    };
    return this.validateAndPostOrder(orderWithSignature);
  }

  public async createSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    listingTime,
    expirationTime = getDefaultOrderExpirationTimestamp(),
    waitForHighestBid = false,
    englishAuctionReservePrice,
    paymentTokenAddress,
    onStep,
  }: {
    asset: Asset;
    accountAddress: string;
    startAmount: number;
    endAmount?: number;
    listingTime?: number;
    expirationTime?: number;
    englishAuctionReservePrice?: number;
    waitForHighestBid?: boolean;
    paymentTokenAddress?: string;
    onStep?: (step: number) => void;
  }) {
    if (!paymentTokenAddress || paymentTokenAddress === NULL_ADDRESS) {
      throw new Error('Trading with ETH is not supported');
    }
    let step = 0;
    function nextStep<T>(param?: T) {
      step++;
      onStep && onStep(step);
      return param;
    }
    const order = await this._makeSellOrder({
      asset,
      quantity: 1,
      maximumFill: 1,
      accountAddress,
      startAmount,
      endAmount,
      listingTime,
      expirationTime,
      waitForHighestBid,
      englishAuctionReservePrice,
      paymentTokenAddress: paymentTokenAddress || NULL_ADDRESS,
    });
    debug('_makeSellOrder', order);

    await this._sellOrderValidationAndApprovals({ order, accountAddress });
    nextStep();

    const hashedOrder = {
      ...order,
      hash: getOrderHash(order),
    };
    let signature;
    try {
      signature = await this.authorizeOrder(hashedOrder);
      nextStep();
    } catch (error) {
      console.error(error);
      throw new Error('You declined to authorize your auction');
    }

    const orderWithSignature = {
      ...hashedOrder,
      ...signature,
    };

    return this.validateAndPostOrder(orderWithSignature).then(nextStep);
  }

  public async _makeBuyOrder({
    asset,
    quantity,
    maximumFill,
    accountAddress,
    startAmount,
    expirationTime = getDefaultOrderExpirationTimestamp(),
    paymentTokenAddress,
  }: {
    asset: Asset;
    quantity: number;
    maximumFill: number;
    accountAddress: string;
    startAmount: number;
    expirationTime?: number;
    paymentTokenAddress: string;
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(accountAddress);
    const quantityBN = new BigNumber(quantity);
    const maximumFillBN = new BigNumber(maximumFill);

    const wyAsset = getWyvernAsset(asset, quantityBN);
    const oneLandAsset = await this.api.getAsset(asset);

    const { basePrice, extra, paymentToken } = await this._getPriceParameters(
      OrderSide.Buy,
      paymentTokenAddress,
      expirationTime,
      startAmount
    );

    const { amount, onelandFee, onelandFeeRecipient, devFee, devFeeRecipient } =
      await this.computeFees({
        asset: oneLandAsset,
        basePrice,
      });

    const times = this._getTimeParameters({
      expirationTimestamp: expirationTime,
    });

    const { staticTarget, staticSelector, staticExtradata } =
      this._getStaticCallData({
        paymentTokenAddress,
        tokenAddress: asset.tokenAddress,
        tokenId: asset.tokenId,
        side: OrderSide.Buy,
        buyingPrice: basePrice,
        amount,
        onelandFee,
        onelandFeeRecipient,
        devFee,
        devFeeRecipient,
      });

    return {
      registry: this._wyvernRegistryAbi.address,
      exchange: this._wyvernExchangeAbi.address,
      maker: accountAddress,
      quantity: quantityBN,
      maximumFill: maximumFillBN,
      amount,
      onelandFee,
      onelandFeeRecipient,
      devFee,
      devFeeRecipient,
      side: OrderSide.Buy,
      saleKind: SaleKind.FixedPrice,
      staticTarget,
      staticSelector,
      staticExtradata,
      tokenAddress: asset.tokenAddress,
      tokenId: asset.tokenId,
      paymentToken,
      basePrice,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: {
        asset: wyAsset,
        schema: asset.schemaName as WyvernSchemaName,
      },
    };
  }

  public async _makeSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity = 1,
    maximumFill = 1,
    listingTime,
    expirationTime = getDefaultOrderExpirationTimestamp(),
    waitForHighestBid,
    englishAuctionReservePrice = 0,
    paymentTokenAddress,
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
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(accountAddress);
    const quantityBN = new BigNumber(quantity);
    const maximumFillBN = new BigNumber(maximumFill);

    const wyAsset = getWyvernAsset(asset, quantityBN);
    const oneLandAsset = await this.api.getAsset(asset);

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

    const { amount, onelandFee, onelandFeeRecipient, devFee, devFeeRecipient } =
      await this.computeFees({
        asset: oneLandAsset,
        basePrice,
      });

    const { staticTarget, staticSelector, staticExtradata } =
      this._getStaticCallData({
        paymentTokenAddress,
        side: OrderSide.Sell,
        tokenAddress: asset.tokenAddress,
        tokenId: asset.tokenId,
        sellingPrice: basePrice,
        amount,
        onelandFee,
        onelandFeeRecipient,
        devFee,
        devFeeRecipient,
      });

    return {
      registry: this._wyvernRegistryAbi.address,
      exchange: this._wyvernExchangeAbi.address,
      maker: accountAddress,
      quantity: quantityBN,
      maximumFill: maximumFillBN,
      amount,
      onelandFee,
      onelandFeeRecipient,
      devFee,
      devFeeRecipient,
      side: OrderSide.Sell,
      saleKind: orderSaleKind,
      staticTarget,
      staticSelector,
      staticExtradata,
      tokenAddress: asset.tokenAddress,
      tokenId: asset.tokenId,
      paymentToken,
      basePrice,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: {
        asset: wyAsset,
        schema: asset.schemaName as WyvernSchemaName,
      },
    };
  }

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

  public async _getProxy(accountAddress: string) {
    let proxyAddress = await WyvernRegistry.getProxy(
      this._wyvernRegistryAbi,
      accountAddress,
      0
    );

    if (!proxyAddress) {
      proxyAddress = await WyvernRegistry.registerProxy(
        this._wyvernRegistryAbi.connect(
          this._signer || this._provider.getSigner(accountAddress)
        ),
        accountAddress
      );
    }
    return proxyAddress;
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
    proxyAddress = proxyAddress || (await this._getProxy(accountAddress));
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
      this._signer || this._provider.getSigner(signerAddress),
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
  }: {
    order: Order;
    accountAddress: string;
    recipientAddress?: string;
  }): Promise<string> {
    // debug('fulfillOrder', order);
    const proxyAccount = await this._getProxy(accountAddress);
    debug(`fulfillOrder, ${accountAddress} proxy: ${proxyAccount}`);

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

    const transaction = await this._atomicMatch({
      buy,
      sell,
      accountAddress,
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

    const side = (order.side + 1) % 2;
    const { staticTarget, staticSelector, staticExtradata } =
      this._getStaticCallData({
        paymentTokenAddress: order.paymentToken,
        side,
        tokenAddress: order.tokenAddress,
        tokenId: order.tokenId,
        sellingPrice: order.basePrice,
        buyingPrice: order.basePrice,
        amount: order.amount,
        onelandFee: order.onelandFee,
        onelandFeeRecipient: order.onelandFeeRecipient,
        devFee: order.devFee,
        devFeeRecipient: order.devFeeRecipient,
      });

    const times = this._getTimeParameters({
      expirationTimestamp: 0,
      isMatchingOrder: true,
    });

    const matchingOrder: UnhashedOrder = {
      registry: order.registry,
      exchange: order.exchange,
      maker: accountAddress,
      quantity: order.quantity,
      maximumFill: order.maximumFill,
      side,
      saleKind: SaleKind.FixedPrice,
      staticTarget: staticTarget,
      staticSelector: staticSelector,
      staticExtradata: staticExtradata,
      tokenAddress: order.tokenAddress,
      tokenId: order.tokenId,
      paymentToken: order.paymentToken,
      basePrice: order.basePrice,
      amount: order.amount,
      onelandFee: order.onelandFee,
      onelandFeeRecipient: order.onelandFeeRecipient,
      devFee: order.devFee,
      devFeeRecipient: order.devFeeRecipient,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: order.metadata,
    };

    return matchingOrder;
  }

  /**
   * Cancel an order on-chain, preventing it from ever being fulfilled.
   * @param order The order to cancel
   * @param accountAddress The order maker's wallet address
   */
  public async cancelOrder({
    order,
    accountAddress,
  }: {
    order: Order;
    accountAddress: string;
  }): Promise<void> {
    const hash = getOrderHash(order);
    const wyvernExchangeAbi = this._wyvernExchangeAbi.connect(
      this._signer || this._provider.getSigner(accountAddress)
    );
    const trans = await wyvernExchangeAbi.setOrderFill_(
      hash,
      toEthBigNumber(order.maximumFill),
      {
        from: accountAddress,
      }
    );
    await trans.wait();
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
  }: {
    buy: Order;
    sell: Order;
    accountAddress: string;
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

    debug('Buy order: ', buy);
    debug('Sell order: ', sell);
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
    let firstCall, secondCall;
    const isEther = sell.paymentToken === NULL_ADDRESS;

    if (isEther) {
      const res = await this._getCallDataForEtherOrder({ sell, buy });
      firstCall = res.firstCall;
      secondCall = res.secondCall;
    } else {
      const { onelandFee, devFee } = sell;
      const withFees = !(
        onelandFee.eq(new BigNumber(0)) && devFee.eq(new BigNumber(0))
      );

      const res = !withFees
        ? await this._getCallDataForERC20Orders({ sell, buy })
        : await this._getCallDataForERC20OrdersWithFees({ sell, buy });
      firstCall = res.firstCall;
      secondCall = res.secondCall;
    }

    const args: WyvernAtomicMatchParameters =
      constructWyvernV3AtomicMatchParameters(
        sell,
        firstCall,
        {
          v: sell.v || 0,
          r: sell.r || NULL_BLOCK_HASH,
          s: sell.s || NULL_BLOCK_HASH,
        },
        buy,
        secondCall,
        {
          v: buy.v || 0,
          r: buy.r || NULL_BLOCK_HASH,
          s: buy.s || NULL_BLOCK_HASH,
        },
        ZERO_BYTES32
      );

    // debug('_wyvernExchangeAbi.atomicMatch_', args);
    const wyvernExchangeAbi = this._wyvernExchangeAbi.connect(
      this._signer || this._provider.getSigner(accountAddress)
    );
    const trans = await wyvernExchangeAbi.atomicMatch_(
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

  private async _getCallDataForEtherOrder({
    sell,
    buy,
  }: {
    sell: Order;
    buy: Order;
  }) {
    const erc721Abi = ERC721Abi__factory.connect(
      sell.tokenAddress,
      this._signer || this._provider.getSigner(buy.maker)
    );
    const recipientAddress = buy.maker;
    const data = (
      await erc721Abi.populateTransaction.transferFrom(
        sell.maker,
        recipientAddress,
        sell.tokenId
      )
    ).data!;
    const firstCall = {
      target: sell.tokenAddress,
      howToCall: 0,
      data,
    };

    const secondCallData = (
      await this._wyvernStaticAbi.populateTransaction.test()
    ).data!;
    const secondCall = {
      target: this._wyvernStaticAbi.address,
      howToCall: 0,
      data: secondCallData,
    };

    return { firstCall, secondCall };
  }

  private async _getCallDataForERC20Orders({
    sell,
    buy,
  }: {
    sell: Order;
    buy: Order;
  }) {
    const erc721Abi = ERC721Abi__factory.connect(
      sell.tokenAddress,
      this._signer || this._provider.getSigner(buy.maker)
    );
    const erc20Abi = ERC20Abi__factory.connect(
      sell.paymentToken,
      this._signer || this._provider.getSigner(buy.maker)
    );

    const data = (
      await erc721Abi.populateTransaction.transferFrom(
        sell.maker,
        buy.maker,
        sell.tokenId
      )
    ).data!;
    const firstCall = {
      target: sell.tokenAddress,
      howToCall: 0,
      data,
    };

    const secondCallData = (
      await erc20Abi.populateTransaction.transferFrom(
        buy.maker,
        sell.maker,
        toEthBigNumber(sell.basePrice)
      )
    ).data!;
    const secondCall = {
      target: erc20Abi.address,
      howToCall: 0,
      data: secondCallData,
    };

    return { firstCall, secondCall };
  }

  private async _getCallDataForERC20OrdersWithFees({
    sell,
    buy,
  }: {
    sell: Order;
    buy: Order;
  }) {
    const { amount, onelandFee, onelandFeeRecipient, devFee, devFeeRecipient } =
      sell;
    const erc721Abi = ERC721Abi__factory.connect(
      sell.tokenAddress,
      this._signer || this._provider.getSigner(buy.maker)
    );
    const erc20Abi = ERC20Abi__factory.connect(
      sell.paymentToken,
      this._signer || this._provider.getSigner(buy.maker)
    );

    const firstERC721Call = (
      await erc721Abi.populateTransaction.transferFrom(
        sell.maker,
        buy.maker,
        sell.tokenId
      )
    ).data!;
    const firstData = (
      await this._wyvernAtomicizerAbi.populateTransaction.atomicize(
        [erc721Abi.address],
        [0],
        [(firstERC721Call.length - 2) / 2],
        firstERC721Call
      )
    ).data!;
    const firstCall = {
      target: this._wyvernAtomicizerAbi.address,
      howToCall: 1,
      data: firstData,
    };

    const secondAtomicizeCallAddrs = [],
      secondAtomicizeCallValues = [],
      secondAtomicizeCallDataLengths = [];
    let secondAtomicizeCallDatas = '';
    {
      const erc20CallData = (
        await erc20Abi.populateTransaction.transferFrom(
          buy.maker,
          sell.maker,
          toEthBigNumber(amount)
        )
      ).data!;
      secondAtomicizeCallAddrs.push(erc20Abi.address);
      secondAtomicizeCallValues.push(0);
      secondAtomicizeCallDataLengths.push((erc20CallData.length - 2) / 2);
      secondAtomicizeCallDatas = erc20CallData;
    }
    if (onelandFee.gt(new BigNumber(0))) {
      const erc20CallData = (
        await erc20Abi.populateTransaction.transferFrom(
          buy.maker,
          onelandFeeRecipient,
          toEthBigNumber(onelandFee)
        )
      ).data!;
      secondAtomicizeCallAddrs.push(erc20Abi.address);
      secondAtomicizeCallValues.push(0);
      secondAtomicizeCallDataLengths.push((erc20CallData.length - 2) / 2);
      secondAtomicizeCallDatas =
        secondAtomicizeCallDatas + erc20CallData.slice(2);
    }
    if (devFee.gt(new BigNumber(0))) {
      const erc20CallData = (
        await erc20Abi.populateTransaction.transferFrom(
          buy.maker,
          devFeeRecipient,
          toEthBigNumber(devFee)
        )
      ).data!;
      secondAtomicizeCallAddrs.push(erc20Abi.address);
      secondAtomicizeCallValues.push(0);
      secondAtomicizeCallDataLengths.push((erc20CallData.length - 2) / 2);
      secondAtomicizeCallDatas =
        secondAtomicizeCallDatas + erc20CallData.slice(2);
    }

    const secondData = (
      await this._wyvernAtomicizerAbi.populateTransaction.atomicize(
        secondAtomicizeCallAddrs,
        secondAtomicizeCallValues,
        secondAtomicizeCallDataLengths,
        secondAtomicizeCallDatas
      )
    ).data!;

    const secondCall = {
      target: this._wyvernAtomicizerAbi.address,
      howToCall: 1,
      data: secondData,
    };

    return { firstCall, secondCall };
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
    debug(`validateOrderAuthorization_, ${isValid}`);
    return isValid;
  }

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
        if (tokenAddress === this._wethAbi.address) {
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
      this._signer || this._provider.getSigner(accountAddress)
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
      this._signer || this._provider.getSigner(accountAddress)
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
    expirationTimestamp = getDefaultOrderExpirationTimestamp(),
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
    if (isNaN(startAmount) || startAmount === null || startAmount <= 0) {
      throw new Error('Starting price must be a number > 0');
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
   */
  public async computeFees({
    asset,
    basePrice,
  }: {
    asset: OneLandAsset;
    basePrice: BigNumber;
  }): Promise<{
    amount: BigNumber;
    onelandFee: BigNumber;
    onelandFeeRecipient: string;
    devFee: BigNumber;
    devFeeRecipient: string;
  }> {
    const onelandFeeRecipient = ONELAND_FEE_RECIPIENT;

    let onelandFeeBasisPoints = DEFAULT_ONELAND_FEE_BASIS_POINTS;
    const onelandFeeBasisPointsOverwrittenByCollection = _.get(
      asset,
      'collection.onelandFeeBasisPoints',
      -1
    );
    if (onelandFeeBasisPointsOverwrittenByCollection >= 0) {
      onelandFeeBasisPoints = _.min([
        onelandFeeBasisPointsOverwrittenByCollection,
        MAX_ONELAND_FEE_BASIS_POINTS,
      ]);
    }

    let devFeeBasisPoints = 0;
    const devFeeBasisPointsOfCollection = _.get(
      asset,
      'collection.devFeeBasisPoints',
      -1
    );
    if (devFeeBasisPointsOfCollection >= 0) {
      devFeeBasisPoints = _.min([
        devFeeBasisPointsOfCollection,
        MAX_DEV_FEE_BASIS_POINTS,
      ]);
    }

    const devFeeRecipient = _.get(
      asset,
      'collection.payoutAddress',
      NULL_ADDRESS
    );

    const onelandFee = basePrice
      .times(new BigNumber(onelandFeeBasisPoints))
      .div(new BigNumber(10000));
    const devFee =
      devFeeRecipient === NULL_ADDRESS
        ? new BigNumber(0)
        : basePrice
            .times(new BigNumber(devFeeBasisPoints))
            .div(new BigNumber(10000));
    const amount = basePrice.minus(onelandFee).minus(devFee);

    debug(
      `oneland fee: ${onelandFee.toFixed()}, oneland fee recipient: ${onelandFeeRecipient}`
    );
    debug(
      `dev fee: ${devFee.toFixed()}, dev fee recipient: ${devFeeRecipient}`
    );

    return {
      amount,
      onelandFee,
      onelandFeeRecipient,
      devFee,
      devFeeRecipient,
    };
  }

  public _getStaticCallData({
    paymentTokenAddress,
    side,
    tokenAddress,
    tokenId,
    sellingPrice,
    buyingPrice,
    amount,
    onelandFee,
    onelandFeeRecipient,
    devFee,
    devFeeRecipient,
  }: {
    paymentTokenAddress: string;
    side: OrderSide;
    tokenAddress: string;
    tokenId: string;
    sellingPrice?: BigNumber;
    buyingPrice?: BigNumber;
    amount: BigNumber;
    onelandFee: BigNumber;
    onelandFeeRecipient: string;
    devFee: BigNumber;
    devFeeRecipient: string;
  }): {
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  } {
    const isEther = paymentTokenAddress.toLocaleLowerCase() === NULL_ADDRESS;

    if (isEther) {
      return this._getStaticCallDataForEtherOrder({ tokenAddress, tokenId });
    }

    const withFees = !(
      onelandFee.eq(new BigNumber(0)) && devFee.eq(new BigNumber(0))
    );
    if (!withFees) {
      return this._getStaticCallDataForERC20Order({
        paymentTokenAddress,
        tokenAddress,
        tokenId,
        side,
        sellingPrice,
        buyingPrice,
      });
    } else {
      return this._getStaticCallDataForERC20OrderWithFees({
        paymentTokenAddress,
        tokenAddress,
        tokenId,
        side,
        amount,
        onelandFee,
        onelandFeeRecipient,
        devFee,
        devFeeRecipient,
      });
    }
  }

  // TODO
  private _getStaticCallDataForEtherOrder({
    tokenAddress,
    tokenId,
  }: {
    tokenAddress: string;
    tokenId: string;
  }): {
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  } {
    const staticTarget = this._wyvernStaticAbi.address;
    const staticSelector =
      this._wyvernStaticAbi.interface.getSighash('anyAddOne');
    const staticExtradata = '0x';
    return {
      staticTarget,
      staticSelector,
      staticExtradata,
    };
  }

  private _getStaticCallDataForERC20Order({
    paymentTokenAddress,
    tokenAddress,
    tokenId,
    side,
    sellingPrice,
    buyingPrice,
  }: {
    paymentTokenAddress: string;
    tokenAddress: string;
    tokenId: string;
    side: OrderSide;
    sellingPrice?: BigNumber;
    buyingPrice?: BigNumber;
  }): {
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  } {
    const paymentToken = paymentTokenAddress.toLocaleLowerCase();
    let staticTarget, staticSelector, staticExtradata;
    // Swap ERC721 with ERC20 token, Sell side
    if (side === OrderSide.Sell) {
      staticTarget = this._staticMarketAbi.address;
      staticSelector = this._staticMarketAbi.interface.getSighash(
        'ERC721ForERC20(bytes,address[7],uint8[2],uint256[6],bytes,bytes)'
      );
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
    return {
      staticTarget,
      staticSelector,
      staticExtradata,
    };
  }

  private _getStaticCallDataForERC20OrderWithFees({
    paymentTokenAddress,
    tokenAddress,
    tokenId,
    side,
    amount,
    onelandFee,
    onelandFeeRecipient,
    devFee,
    devFeeRecipient,
  }: {
    paymentTokenAddress: string;
    tokenAddress: string;
    tokenId: string;
    side: OrderSide;
    amount: BigNumber;
    onelandFee: BigNumber;
    onelandFeeRecipient: string;
    devFee: BigNumber;
    devFeeRecipient: string;
  }): {
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
  } {
    const paymentToken = paymentTokenAddress.toLocaleLowerCase();
    const staticTarget = this._wyvernStaticAbi.address;
    let staticSelector, staticExtradata;
    if (side === OrderSide.Sell) {
      staticSelector = this._wyvernStaticAbi.interface.getSighash(
        'split(bytes,address[7],uint8[2],uint256[6],bytes,bytes)'
      );
      // 	`split` extraData part 1 (staticCall of order)
      const selectorA = this._wyvernStaticAbi.interface.getSighash(
        'sequenceExact(bytes,address[7],uint8,uint256[6],bytes)'
      );
      const selectorA1 = this._wyvernStaticAbi.interface.getSighash(
        'transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)'
      );
      const edParamsA1 = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [tokenAddress, tokenId]
      );
      const extradataA = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [
          [this._wyvernStaticAbi.address],
          [(edParamsA1.length - 2) / 2],
          [selectorA1],
          edParamsA1,
        ]
      );

      //	`split` extraData part 2 (staticCall of counter order)
      const selectorB = this._wyvernStaticAbi.interface.getSighash(
        'sequenceExact(bytes,address[7],uint8,uint256[6],bytes)'
      );

      const extradataBAddresses = [],
        extradataBParamsLength = [],
        extradataBSelectors = [];
      let extradataBParams = '';
      //    transfer `amount` to seller
      {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20Exact(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256'],
          [paymentToken, toEthBigNumber(amount)]
        );
        extradataBAddresses.push(this._wyvernStaticAbi.address);
        extradataBSelectors.push(selector);
        extradataBParamsLength.push((edParams.length - 2) / 2);
        extradataBParams = edParams;
      }
      //    transfer onelandFee
      if (onelandFee.gt(new BigNumber(0))) {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20ExactTo(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'address'],
          [paymentToken, toEthBigNumber(onelandFee), onelandFeeRecipient]
        );
        extradataBAddresses.push(this._wyvernStaticAbi.address);
        extradataBSelectors.push(selector);
        extradataBParamsLength.push((edParams.length - 2) / 2);
        extradataBParams = extradataBParams + edParams.slice(2);
      }
      //    transfer `devFee` to collection owner
      if (devFee.gt(new BigNumber(0))) {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20ExactTo(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'address'],
          [paymentToken, toEthBigNumber(devFee), devFeeRecipient]
        );
        extradataBAddresses.push(this._wyvernStaticAbi.address);
        extradataBSelectors.push(selector);
        extradataBParamsLength.push((edParams.length - 2) / 2);
        extradataBParams = extradataBParams + edParams.slice(2);
      }

      const extradataB = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [
          extradataBAddresses,
          extradataBParamsLength,
          extradataBSelectors,
          extradataBParams,
        ]
      );

      // `split` extraData combined
      staticExtradata = ethers.utils.defaultAbiCoder.encode(
        ['address[2]', 'bytes4[2]', 'bytes', 'bytes'],
        [
          [this._wyvernStaticAbi.address, this._wyvernStaticAbi.address],
          [selectorA, selectorB],
          extradataA,
          extradataB,
        ]
      );
    } else {
      staticSelector = this._wyvernStaticAbi.interface.getSighash(
        'split(bytes,address[7],uint8[2],uint256[6],bytes,bytes)'
      );
      // 	`split` extraData part 1 (staticCall of order)

      const selectorA = this._wyvernStaticAbi.interface.getSighash(
        'sequenceExact(bytes,address[7],uint8,uint256[6],bytes)'
      );

      const extradataAAddresses = [],
        extradataAParamsLength = [],
        extradataASelectors = [];
      let extradataAParams = '';
      //    transfer `amount` to seller
      {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20Exact(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256'],
          [paymentToken, toEthBigNumber(amount)]
        );
        extradataAAddresses.push(this._wyvernStaticAbi.address);
        extradataASelectors.push(selector);
        extradataAParamsLength.push((edParams.length - 2) / 2);
        extradataAParams = edParams;
      }
      //    transfer onelandFee
      if (onelandFee.gt(new BigNumber(0))) {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20ExactTo(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'address'],
          [paymentToken, toEthBigNumber(onelandFee), onelandFeeRecipient]
        );
        extradataAAddresses.push(this._wyvernStaticAbi.address);
        extradataASelectors.push(selector);
        extradataAParamsLength.push((edParams.length - 2) / 2);
        extradataAParams = extradataAParams + edParams.slice(2);
      }
      //    transfer `devFee` to collection owner
      if (devFee.gt(new BigNumber(0))) {
        const selector = this._wyvernStaticAbi.interface.getSighash(
          'transferERC20ExactTo(bytes,address[7],uint8,uint256[6],bytes)'
        );
        const edParams = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'address'],
          [paymentToken, toEthBigNumber(devFee), devFeeRecipient]
        );
        extradataAAddresses.push(this._wyvernStaticAbi.address);
        extradataASelectors.push(selector);
        extradataAParamsLength.push((edParams.length - 2) / 2);
        extradataAParams = extradataAParams + edParams.slice(2);
      }

      const extradataA = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [
          extradataAAddresses,
          extradataAParamsLength,
          extradataASelectors,
          extradataAParams,
        ]
      );

      //	`split` extraData part 2 (staticCall of counter order)
      const selectorB = this._wyvernStaticAbi.interface.getSighash(
        'sequenceExact(bytes,address[7],uint8,uint256[6],bytes)'
      );
      const selectorB1 = this._wyvernStaticAbi.interface.getSighash(
        'transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)'
      );
      const edParamsB1 = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [tokenAddress, tokenId]
      );
      const extradataB = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes4[]', 'bytes'],
        [
          [this._wyvernStaticAbi.address],
          [(edParamsB1.length - 2) / 2],
          [selectorB1],
          edParamsB1,
        ]
      );

      // `split` extraData combined
      staticExtradata = ethers.utils.defaultAbiCoder.encode(
        ['address[2]', 'bytes4[2]', 'bytes', 'bytes'],
        [
          [this._wyvernStaticAbi.address, this._wyvernStaticAbi.address],
          [selectorA, selectorB],
          extradataA,
          extradataB,
        ]
      );
    }

    return {
      staticTarget,
      staticSelector,
      staticExtradata,
    };
  }
}
