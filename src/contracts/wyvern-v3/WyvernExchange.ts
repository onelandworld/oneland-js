import * as _ from 'lodash';
import {ethers, Signer} from 'ethers';
import {Network} from '../../types';
import {WyvernExchangeAbi, WyvernExchangeAbi__factory} from '../../typechain';
import {deployed} from '../deployed';

export class WyvernExchange {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.WyvernExchange`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): WyvernExchangeAbi {
    return WyvernExchangeAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
