import * as _ from 'lodash';
import { ethers, Signer } from 'ethers';
import { Network } from '../../types';
import { StaticMarketAbi, StaticMarketAbi__factory } from '../../typechain';
import { deployed } from '../deployed';

export class StaticMarket {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.wyvern.StaticMarket`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): StaticMarketAbi {
    return StaticMarketAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
