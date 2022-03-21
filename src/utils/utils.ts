import {ethers, BigNumber as EthBigNumber} from 'ethers';
/* eslint-disable node/no-extraneous-import */
import {
  TypedDataSigner,
  TypedDataDomain,
  TypedDataField,
} from '@ethersproject/abstract-signer';
import {BigNumber} from 'bignumber.js';
import {
  MAX_EXPIRATION_MONTHS,
  NULL_ADDRESS,
  MAX_DIGITS_IN_UNSIGNED_256_INT
} from '../constants';
import {
  Asset,
  WyvernAsset,
  WyvernSchemaName,
  UnhashedOrder,
  ECSignature,
  Order,
  UnsignedOrder,
  OrderJSON,
  OrderSide,
  HowToCall,
  OrderCall,
  WyvernAtomicMatchParameters
} from '../types';
import {eip712} from './eip712';

export const eip712Order = {
  name: 'Order',
  fields: [
    {name: 'registry', type: 'address'},
    {name: 'maker', type: 'address'},
    {name: 'staticTarget', type: 'address'},
    {name: 'staticSelector', type: 'bytes4'},
    {name: 'staticExtradata', type: 'bytes'},
    {name: 'maximumFill', type: 'uint256'},
    {name: 'listingTime', type: 'uint256'},
    {name: 'expirationTime', type: 'uint256'},
    {name: 'salt', type: 'uint256'},
  ],
};

/**
 * The longest time that an order is valid for is six months from the current date
 * @returns unix timestamp
 */
export const getMaxOrderExpirationTimestamp = () => {
  const maxExpirationDate = new Date();

  maxExpirationDate.setDate(
    maxExpirationDate.getDate() + MAX_EXPIRATION_MONTHS
  );

  return Math.round(maxExpirationDate.getTime() / 1000);
};

/**
 * Validates that an address exists, isn't null, and is properly
 * formatted for Wyvern and OneLand
 * @param address input address
 */
export function validateAndFormatWalletAddress(address: string): string {
  if (!address) {
    throw new Error('No wallet address found');
  }
  if (!ethers.utils.isAddress(address)) {
    throw new Error('Invalid wallet address');
  }
  if (address === NULL_ADDRESS) {
    throw new Error('Wallet cannot be the null address');
  }
  return address.toLowerCase();
}

/**
 * A baseUnit is defined as the smallest denomination of a token. An amount expressed in baseUnits
 * is the amount expressed in the smallest denomination.
 * E.g: 1 unit of a token with 18 decimal places is expressed in baseUnits as 1000000000000000000
 * @param   amount      The amount of units that you would like converted to baseUnits.
 * @param   decimals    The number of decimal places the unit amount has.
 * @return  The amount in baseUnits.
 */
export function toBaseUnitAmount(
  amount: BigNumber,
  decimals: number
): BigNumber {
  const unit = new BigNumber(10).pow(decimals);
  const baseUnitAmount = amount.times(unit);
  return baseUnitAmount;
}

/**
 * Generates a pseudo-random 256-bit salt.
 * The salt can be included in an 0x order, ensuring that the order generates a unique orderHash
 * and will not collide with other outstanding orders that are identical in all other parameters.
 * @return  A pseudo-random 256-bit number that can be used as a salt.
 */
export function generatePseudoRandomSalt(): BigNumber {
  // BigNumber.random returns a pseudo-random number between 0 & 1 with a passed in number of decimal places.
  // Source: https://mikemcl.github.io/bignumber.js/#random
  const randomNumber = BigNumber.random(MAX_DIGITS_IN_UNSIGNED_256_INT);
  const factor = new BigNumber(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1);
  const salt = randomNumber.times(factor).integerValue();
  return new BigNumber(salt.toFixed());
}

/**
 * Get the Wyvern representation of a fungible asset
 * @param asset The asset to trade
 * @param quantity The number of items to trade
 */
export function getWyvernAsset(
  asset: Asset,
  quantity = new BigNumber(1)
): WyvernAsset {
  const wyvernSchema = asset.schemaName as WyvernSchemaName;
  const tokenId = asset.tokenId !== null ? asset.tokenId.toString() : undefined;

  switch (wyvernSchema) {
    case WyvernSchemaName.ERC20:
      return {
        address: asset.tokenAddress.toLowerCase(),
        quantity: quantity.toString(),
      };
    case WyvernSchemaName.ERC721:
    case WyvernSchemaName.ERC721v3:
    case WyvernSchemaName.ERC1155:
      return {
        id: tokenId,
        address: asset.tokenAddress.toLowerCase(),
      };
  }
}

export const domainToSign = (exchange, chainId) => {
  return {
    name: 'Wyvern Exchange',
    version: '3.1',
    chainId,
    verifyingContract: exchange,
  };
};

export const structToSign = (order, exchange, chainId) => {
  return {
    name: eip712Order.name,
    fields: eip712Order.fields,
    domain: {
      name: 'Wyvern Exchange',
      version: '3.1',
      chainId,
      verifyingContract: exchange,
    },
    data: order,
  };
};

export const hashOrder = (order: any) => {
  return (
    '0x' +
    eip712
      .structHash(eip712Order.name, eip712Order.fields, order)
      .toString('hex')
  );
};

export const parseSig = (bytes: any) => {
  bytes = bytes.substr(2);
  const r = '0x' + bytes.slice(0, 64);
  const s = '0x' + bytes.slice(64, 128);
  const v = parseInt('0x' + bytes.slice(128, 130), 16);
  return {v, r, s};
};

/**
 * Get the non-prefixed hash for the order
 * (Fixes a Wyvern typescript issue and casing issue)
 * @param order order to hash
 */
export function getOrderHash(order: UnhashedOrder) {
  const orderWithStringTypes = {
    ...order,
    maker: order.maker.toLowerCase(),
    side: order.side.toString(),
    saleKind: order.saleKind.toString(),
    feeMethod: order.feeMethod.toString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return hashOrder(orderWithStringTypes as any);
}

/**
 * Sign messages using web3 signTypedData signatures
 * @param message message to sign
 * @returns A signature if provider can sign, otherwise null
 */
export async function signTypedDataAsync(
  signer: TypedDataSigner,
  domain: TypedDataDomain,
  types: Record<string, Array<TypedDataField>>,
  value: Record<string, any>
): Promise<ECSignature> {
  const signature = await signer._signTypedData(domain, types, value);
  return parseSig(signature);
}

/**
 * Special fixes for making BigNumbers using web3 results
 * @param arg An arg or the result of a web3 call to turn into a BigNumber
 */
 export function makeBigNumber(arg: number | string | BigNumber): BigNumber {
  // Zero sometimes returned as 0x from contracts
  if (arg === "0x") {
    arg = 0;
  }
  // fix "new BigNumber() number type has more than 15 significant digits"
  arg = arg.toString();
  return new BigNumber(arg);
}

export function toEthBigNumber(num: BigNumber): EthBigNumber {
  return EthBigNumber.from(num.toFixed());
}

export function fromEthBigNumber(num: EthBigNumber): BigNumber {
  return new BigNumber(num.toHexString(), 16);
}

/**
 * Assign an order and a new matching order to their buy/sell sides
 * @param order Original order
 * @param matchingOrder The result of _makeMatchingOrder
 */
 export function assignOrdersToSides(
  order: Order,
  matchingOrder: UnsignedOrder
): { buy: Order; sell: Order } {
  const isSellOrder = order.side == OrderSide.Sell;

  let buy: Order;
  let sell: Order;
  if (!isSellOrder) {
    buy = order;
    sell = {
      ...matchingOrder,
      v: buy.v,
      r: buy.r,
      s: buy.s,
    };
  } else {
    sell = order;
    buy = {
      ...matchingOrder
    };
  }

  return { buy, sell };
}

export function constructWyvernV3AtomicMatchParameters(
  order: Order,
  call: OrderCall,
  sig: ECSignature,
  counterorder: Order,
  countercall: OrderCall,
  countersig: ECSignature,
  metadata: string
): WyvernAtomicMatchParameters {

  return [
    [order.registry, order.maker, order.staticTarget, toEthBigNumber(order.maximumFill), toEthBigNumber(order.listingTime), toEthBigNumber(order.expirationTime), toEthBigNumber(order.salt), call.target,
      counterorder.registry, counterorder.maker, counterorder.staticTarget, toEthBigNumber(counterorder.maximumFill), toEthBigNumber(counterorder.listingTime), toEthBigNumber(counterorder.expirationTime), toEthBigNumber(counterorder.salt), countercall.target],
    [order.staticSelector, counterorder.staticSelector],
    order.staticExtradata, call.data, counterorder.staticExtradata, countercall.data,
    [call.howToCall, countercall.howToCall],
    metadata,
    ethers.utils.defaultAbiCoder.encode(['bytes', 'bytes'], [
      ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]) + (''),
      ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes32', 'bytes32'], [countersig.v, countersig.r, countersig.s]) + ('')
    ])
  ];
}

export const orderFromJSON = (order: OrderJSON): Order => {
  const createdDate = new Date(`${order.createdTime}Z`);

  const fromJSON: Order = {
    registry: order.registry,
    exchange: order.exchange,
    maker: order.maker,
    staticTarget: order.staticTarget.toLowerCase(),
    staticSelector: order.staticSelector.toLocaleLowerCase(),
    staticExtradata: order.staticExtradata.toLocaleLowerCase(),
    maximumFill: new BigNumber(order.maximumFill),
    listingTime: new BigNumber(order.listingTime),
    expirationTime: new BigNumber(order.expirationTime),
    salt: new BigNumber(order.salt),

    tokenAddress: order.tokenAddress,
    tokenId: order.tokenId,

    hash: order.hash,
    paymentToken: order.paymentToken,
    basePrice: new BigNumber(order.basePrice),
    recipientAddress: order.recipientAddress,

    feeMethod: order.feeMethod,
    side: order.side,
    saleKind: order.saleKind,
    quantity: new BigNumber(order.quantity),

    v: order.v,
    r: order.r,
    s: order.s,

    metadata: order.metadata,
    createdTime: new BigNumber(Math.round(createdDate.getTime() / 1000))
  };

  // Use client-side price calc, to account for buyer fee (not added by server) and latency
  // fromJSON.currentPrice = estimateCurrentPrice(fromJSON);

  return fromJSON;
};

/**
 * Convert an order to JSON, hashing it as well if necessary
 * @param order order (hashed or unhashed)
 */
export const orderToJSON = (order: Order): OrderJSON => {
  const asJSON: OrderJSON = {
    registry: order.registry.toLocaleLowerCase(),
    exchange: order.exchange.toLowerCase(),
    maker: order.maker.toLowerCase(),
    staticTarget: order.staticTarget.toLowerCase(),
    staticSelector: order.staticSelector.toLocaleLowerCase(),
    staticExtradata: order.staticExtradata.toLocaleLowerCase(),
    maximumFill: order.maximumFill.toFixed(),
    listingTime: order.listingTime.toFixed(),
    expirationTime: order.expirationTime.toFixed(),
    salt: order.salt.toFixed(),

    tokenAddress: order.tokenAddress,
    tokenId: order.tokenId,

    hash: order.hash,
    paymentToken: order.paymentToken,
    basePrice: order.basePrice.toFixed(),
    recipientAddress: order.recipientAddress,

    feeMethod: order.feeMethod,
    side: order.side,
    saleKind: order.saleKind,
    quantity: order.quantity.toFixed(),

    v: order.v,
    r: order.r,
    s: order.s,

    metadata: order.metadata,
    createdTime: order.createdTime ? order.createdTime.toFixed() : undefined,
  };
  return asJSON;
};

export function debug(message?: any, ...optionalParams: any[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, ...optionalParams);
  }
}
