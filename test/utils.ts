import * as _ from 'lodash';
import { ethers, BigNumber as EthBigNumber } from 'ethers';
import {
  Alice,
  Bob,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
  sandboxLandAbi,
  wethAbi,
} from './constants';
import { Account } from './types';

// Expect Alice or Bob owns the land asset
export const withAliceOrBobOwningLand = async () => {
  const landOwnerAddress = await sandboxLandAbi.ownerOf(
    EthBigNumber.from(RINKEBY_SANDBOX_LAND_TOKEN_ID)
  );
  expect([Alice.address, Bob.address]).toContain(landOwnerAddress);
  const landOwner: Account = landOwnerAddress === Alice.address ? Alice : Bob;
  const landTaker: Account = landOwner === Alice ? Bob : Alice;
  return [landOwner, landTaker];
};

// Asset Alice and Bob's Ether balance
const minimalEthBalance = 0.1;
export const withAliceAndBobHavingEther = async () => {
  const balanceOfAliceBN = await provider.getBalance(Alice.address);
  const balanceOfAlice = _.toNumber(ethers.utils.formatEther(balanceOfAliceBN));
  expect(balanceOfAlice).toBeGreaterThanOrEqual(minimalEthBalance);

  const balanceOfBobBN = await provider.getBalance(Bob.address);
  const balanceOfBob = _.toNumber(ethers.utils.formatEther(balanceOfBobBN));
  expect(balanceOfBob).toBeGreaterThanOrEqual(minimalEthBalance);
};

export const getWETHBalance = async (address: string) => {
  const wethDecimal = await wethAbi.decimals();
  const balanceBN = await wethAbi.balanceOf(address);
  return _.toNumber(
    ethers.utils.formatUnits(balanceBN, wethDecimal)
  );
}

// Assert Alice and Bob's WETH balance
const minimalWETHBalance = 0.1;
export const withAliceAndBobHavingWETH = async (landOwner: Account, landTaker: Account) => {
  const landOwnerWETHBalance = await getWETHBalance(landOwner.address);
  expect(landOwnerWETHBalance).toBeGreaterThanOrEqual(minimalWETHBalance);

  const landTakerWETHBalance = await getWETHBalance(landTaker.address);
  expect(landTakerWETHBalance).toBeGreaterThanOrEqual(minimalWETHBalance);
  
  return [landOwnerWETHBalance, landTakerWETHBalance];
};
