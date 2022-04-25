import * as _ from 'lodash';
import { ethers, Signer } from 'ethers';
import { Network } from '../types';
import { WETHAbi, WETHAbi__factory } from '../typechain';
import { deployed } from './deployed';

export class WETH {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.WETH`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WETHAbi {
    return WETHAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
