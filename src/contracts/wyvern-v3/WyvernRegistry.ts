import * as _ from 'lodash';
import { ethers, Signer } from 'ethers';
import { Network } from '../../types';
import { deployed } from '../deployed';
import { WyvernRegistryAbi, WyvernRegistryAbi__factory } from '../../typechain';
import { delay } from '../../utils';
import { NULL_ADDRESS } from '../../constants';

export class WyvernRegistry {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.WyvernRegistry`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernRegistryAbi {
    return WyvernRegistryAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }

  static async getProxy(
    wyvernRegistryAbi: WyvernRegistryAbi,
    accountAddress: string,
    retries = 0
  ): Promise<string | null> {
    let proxyAddress = await wyvernRegistryAbi.proxies(accountAddress);

    if (_.isEmpty(proxyAddress) || proxyAddress === NULL_ADDRESS) {
      if (retries > 0) {
        await delay(1000);
        return await WyvernRegistry.getProxy(
          wyvernRegistryAbi,
          accountAddress,
          retries - 1
        );
      }
      proxyAddress = null;
    }
    return proxyAddress;
  }

  static async registerProxy(
    wyvernRegistryAbi: WyvernRegistryAbi,
    accountAddress: string
  ): Promise<string> {
    const transaction = await wyvernRegistryAbi.registerProxyFor(
      accountAddress
    );
    await transaction.wait();

    const proxyAddress = await WyvernRegistry.getProxy(
      wyvernRegistryAbi,
      accountAddress
    );
    if (!proxyAddress) {
      throw new Error('Failed to register proxy for your account.');
    }

    return proxyAddress;
  }
}
