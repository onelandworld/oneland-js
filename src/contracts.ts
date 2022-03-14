import {ethers, Signer} from 'ethers';
import {Network} from './types';
import {
  WyvernRegistryAbi,
  WyvernRegistryAbi__factory,
  WyvernExchangeAbi,
  WyvernExchangeAbi__factory,
} from './typechain';

export class WyvernRegistry {
  getContractAddress(network: Network): string {
    return network === Network.Rinkeby
      ? '0xa16Cd54E5E111ad32a0e9065F7C85984fE2fE968'
      : '';
  }

  getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernRegistryAbi {
    return WyvernRegistryAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}

export class WyvernExchange {
  getContractAddress(network: Network): string {
    return network === Network.Rinkeby
      ? '0x3D7FA4926b8306714A62eA41fCf241a793AA255a'
      : '';
  }

  getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernExchangeAbi {
    return WyvernExchangeAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
