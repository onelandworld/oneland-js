import * as _ from 'lodash';
import { ethers, Signer } from 'ethers';
import { Network } from '../../types';
import {
  WyvernAtomicizerAbi,
  WyvernAtomicizerAbi__factory,
} from '../../typechain';
import { deployed } from '../deployed';

export class WyvernAtomicizer {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.wyvern.WyvernAtomicizer`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernAtomicizerAbi {
    return WyvernAtomicizerAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
