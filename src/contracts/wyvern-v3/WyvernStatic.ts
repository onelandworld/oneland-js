import * as _ from 'lodash';
import { ethers, Signer } from 'ethers';
import { Network } from '../../types';
import { WyvernStaticAbi, WyvernStaticAbi__factory } from '../../typechain';
import { deployed } from '../deployed';

export class WyvernStatic {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.wyvern.WyvernStatic`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernStaticAbi {
    return WyvernStaticAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
