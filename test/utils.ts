import * as _ from 'lodash';
import { ethers, BigNumber as EthBigNumber } from 'ethers';
import {
  Alice,
  Bob,
  ERC721_TOKEN_ID,
  provider,
  erc721Abi,
  erc20Abi,
} from './constants';
import { Account } from './types';

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Expect Alice or Bob owns the nft asset
export const withAliceOrBobOwningNFT = async () => {
  const nftOwnerAddress = await erc721Abi.ownerOf(
    EthBigNumber.from(ERC721_TOKEN_ID)
  );
  expect([Alice.address, Bob.address]).toContain(nftOwnerAddress);
  const nftOwner: Account = nftOwnerAddress === Alice.address ? Alice : Bob;
  const nftTaker: Account = nftOwner === Alice ? Bob : Alice;
  return [nftOwner, nftTaker];
};

// Assert Alice and Bob's Ether balance
const minimalEthBalance = 0.1;
export const withAliceAndBobHavingEther = async () => {
  const balanceOfAliceBN = await provider.getBalance(Alice.address);
  const balanceOfAlice = _.toNumber(ethers.utils.formatEther(balanceOfAliceBN));
  expect(balanceOfAlice).toBeGreaterThanOrEqual(minimalEthBalance);

  const balanceOfBobBN = await provider.getBalance(Bob.address);
  const balanceOfBob = _.toNumber(ethers.utils.formatEther(balanceOfBobBN));
  expect(balanceOfBob).toBeGreaterThanOrEqual(minimalEthBalance);
};

export const getERC20Balance = async (address: string) => {
  const erc20Decimal = await erc20Abi.decimals();
  const balanceBN = await erc20Abi.balanceOf(address);
  return _.toNumber(ethers.utils.formatUnits(balanceBN, erc20Decimal));
};

// Assert Alice and Bob's ERC20 balance
const minimalERC20Balance = 0.1;
export const withAliceAndBobHavingERC20 = async (
  nftOwner: Account,
  nftTaker: Account
) => {
  const nftOwnerERC20Balance = await getERC20Balance(nftOwner.address);
  expect(nftOwnerERC20Balance).toBeGreaterThanOrEqual(minimalERC20Balance);

  const nftTakerERC20Balance = await getERC20Balance(nftTaker.address);
  expect(nftTakerERC20Balance).toBeGreaterThanOrEqual(minimalERC20Balance);

  return [nftOwnerERC20Balance, nftTakerERC20Balance];
};
