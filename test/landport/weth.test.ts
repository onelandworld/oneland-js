import * as _ from 'lodash';
import { ethers } from 'ethers';
import { Alice, provider } from '../constants';
import { getWETHBalance } from '../utils';
import { LandPort, Network } from '../../src';

const minimalEthBalance = 0.1;

describe('weth', () => {
  it('Swap between ETH and WETH works', async () => {
    const initEthBalanceBN = await provider.getBalance(Alice.address);
    const initEthBalance = _.toNumber(
      ethers.utils.formatEther(initEthBalanceBN)
    );
    expect(initEthBalance).toBeGreaterThanOrEqual(minimalEthBalance);

    const initWethBalance = await getWETHBalance(Alice.address);

    const amount = 0.01;
    const landPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      Alice.signer,
      (msg: any) => console.log(msg)
    );

    await landPort.wrapEth({
      amountInEth: amount,
      accountAddress: Alice.address,
    });
    const ethBalanceAfterWrapBN = await provider.getBalance(Alice.address);
    const ethBalanceAfterWrap = _.toNumber(
      ethers.utils.formatEther(ethBalanceAfterWrapBN)
    );
    const wethBalanceAfterWrap = await getWETHBalance(Alice.address);

    expect(wethBalanceAfterWrap).toBeCloseTo(initWethBalance + amount, 3);
    // considering GAS
    expect(ethBalanceAfterWrap).toBeLessThan(initEthBalance - amount);

    await landPort.unwrapWeth({
      amountInEth: amount,
      accountAddress: Alice.address,
    });
    const ethBalanceAfterUnwrapBN = await provider.getBalance(Alice.address);
    const ethBalanceAfterUnwrap = _.toNumber(
      ethers.utils.formatEther(ethBalanceAfterUnwrapBN)
    );
    const wethBalanceAfterUnwrap = await getWETHBalance(Alice.address);

    expect(wethBalanceAfterUnwrap).toBeCloseTo(
      wethBalanceAfterWrap - amount,
      3
    );
    expect(ethBalanceAfterUnwrap).toBeLessThan(ethBalanceAfterWrap + amount);
    expect(ethBalanceAfterUnwrap).toBeLessThan(initEthBalance);
  }, 600000 /*10 minutes timeout*/);
});
