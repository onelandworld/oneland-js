import {ethers, BigNumber} from 'ethers';
import {BigNumber as BigNumberJS} from 'bignumber.js';
import {
  MAX_EXPIRATION_MONTHS,
  NULL_ADDRESS,
  MAX_DIGITS_IN_UNSIGNED_256_INT,
} from '../constants';

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
  if (address == NULL_ADDRESS) {
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
  const unit = BigNumber.from(10).pow(decimals);
  const baseUnitAmount = amount.mul(unit);
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
  const randomNumber = BigNumberJS.random(MAX_DIGITS_IN_UNSIGNED_256_INT);
  const factor = new BigNumberJS(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1);
  const salt = randomNumber.times(factor).integerValue();
  return BigNumber.from(salt.toFixed());
}
