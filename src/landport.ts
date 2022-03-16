import {ethers, BigNumber} from 'ethers';
import {
  Network,
  UnhashedOrder,
  SaleKind,
  Asset,
  OrderSide,
  OneLandAPIConfig,
  FeeMethod,
  ComputedFees,
} from './types';
import {
  WyvernRegistryAbi,
  WyvernExchangeAbi,
  WyvernStaticAbi,
} from './typechain';
import {WyvernRegistry, WyvernExchange, WyvernStatic} from './contracts';
import {
  getMaxOrderExpirationTimestamp,
  validateAndFormatWalletAddress,
  toBaseUnitAmount,
  generatePseudoRandomSalt,
} from './utils';
import {
  NULL_ADDRESS,
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
import {OneLandAsset} from '.';

export class LandPort {
  private _network: Network;
  private _provider: ethers.providers.Provider;
  private readonly api: OneLandAPI;
  private _wyvernRegistryAbi: WyvernRegistryAbi;
  private _wyvernExchangeAbi: WyvernExchangeAbi;
  private _wyvernStaticAbi: WyvernStaticAbi;

  constructor(
    provider: ethers.providers.Provider,
    apiConfig: OneLandAPIConfig
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
    paymentTokenAddress,
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
    paymentTokenAddress?: string;
    buyerAddress?: string;
    buyerEmail?: string;
  }) {}

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
    const quantityBN = BigNumber.from(quantity);
    const maximumFillBN = BigNumber.from(maximumFill);

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
      endAmount != null && endAmount !== startAmount
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

    return {
      registry: WyvernRegistry.getContractAddress(this._network),
      exchange: WyvernExchange.getContractAddress(this._network),
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
      // paymentToken,
      // basePrice,
      // extra,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
    };
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
    if (parseInt(expirationTimestamp.toString()) != expirationTimestamp) {
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
      listingTime: BigNumber.from(listingTimestamp),
      expirationTime: BigNumber.from(expirationTimestamp),
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
    const priceDiff = endAmount != null ? startAmount - endAmount : 0;
    const paymentToken = tokenAddress.toLowerCase();
    const isEther = tokenAddress == NULL_ADDRESS;
    const {tokens} = await this.api.getPaymentTokens({
      address: paymentToken,
    });
    const token = tokens[0];

    // Validation
    if (isNaN(startAmount) || startAmount == null || startAmount < 0) {
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
    if (priceDiff > 0 && expirationTime == 0) {
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
      : toBaseUnitAmount(BigNumber.from(startAmount), token.decimals);

    const extra = isEther
      ? ethers.utils.parseEther(priceDiff.toString())
      : toBaseUnitAmount(BigNumber.from(priceDiff), token.decimals);

    const reservePrice = englishAuctionReservePrice
      ? isEther
        ? ethers.utils.parseEther(englishAuctionReservePrice.toString())
        : toBaseUnitAmount(
            BigNumber.from(englishAuctionReservePrice),
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
    let transferFee = BigNumber.from(0);
    let transferFeeTokenAddress = null;
    let maxTotalBountyBPS = DEFAULT_MAX_BOUNTY;

    if (asset) {
      onelandBuyerFeeBasisPoints = +asset.collection.onelandBuyerFeeBasisPoints;
      onelandSellerFeeBasisPoints =
        +asset.collection.onelandSellerFeeBasisPoints;
      devBuyerFeeBasisPoints = +asset.collection.devBuyerFeeBasisPoints;
      devSellerFeeBasisPoints = +asset.collection.devSellerFeeBasisPoints;

      maxTotalBountyBPS = onelandSellerFeeBasisPoints;
    }

    // Compute transferFrom fees
    if (side == OrderSide.Sell && asset) {
      // Server-side knowledge
      transferFee = asset.transferFee
        ? BigNumber.from(asset.transferFee)
        : transferFee;
      transferFeeTokenAddress = asset.transferFeePaymentToken
        ? asset.transferFeePaymentToken.address
        : transferFeeTokenAddress;
    }

    // Compute bounty
    const sellerBountyBasisPoints =
      side == OrderSide.Sell ? extraBountyBasisPoints : 0;

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
    this._validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints);
    // Use buyer as the maker when it's an English auction, so Wyvern sets prices correctly
    const feeRecipient = waitForHighestBid
      ? NULL_ADDRESS
      : ONELAND_FEE_RECIPIENT;

    // Swap maker/taker fees when it's an English auction,
    // since these sell orders are takers not makers
    const makerRelayerFee = waitForHighestBid
      ? BigNumber.from(totalBuyerFeeBasisPoints)
      : BigNumber.from(totalSellerFeeBasisPoints);
    const takerRelayerFee = waitForHighestBid
      ? BigNumber.from(totalSellerFeeBasisPoints)
      : BigNumber.from(totalBuyerFeeBasisPoints);

    return {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee: BigNumber.from(0),
      takerProtocolFee: BigNumber.from(0),
      makerReferrerFee: BigNumber.from(sellerBountyBasisPoints),
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
