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
  const landBuyer: Account = landOwner === Alice ? Bob : Alice;
  return [landOwner, landBuyer];
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

// Assert Alice and Bob's WETH balance
const minimalWETHBalance = 0.1;
export const withAliceAndBobHavingWETH = async () => {
  const wethDecimal = await wethAbi.decimals();

  const balanceOfAliceBN = await wethAbi.balanceOf(Alice.address);
  const balanceOfAlice = _.toNumber(
    ethers.utils.formatUnits(balanceOfAliceBN, wethDecimal)
  );
  expect(balanceOfAlice).toBeGreaterThanOrEqual(minimalWETHBalance);

  const balanceOfBobBN = await wethAbi.balanceOf(Bob.address);
  const balanceOfBob = _.toNumber(
    ethers.utils.formatUnits(balanceOfBobBN, wethDecimal)
  );
  expect(balanceOfBob).toBeGreaterThanOrEqual(minimalWETHBalance);
};
