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

export function toEthBigNumber(num: BigNumber): EthBigNumber {
  return EthBigNumber.from(num.toFixed());
}

export function fromEthBigNumber(num: EthBigNumber): BigNumber {
  return new BigNumber(num.toHexString(), 16);
}
