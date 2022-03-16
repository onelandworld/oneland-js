import * as _ from 'lodash';
import {ethers, Signer} from 'ethers';
import {Network} from '../../types';
import {SandboxLandAbi, SandboxLandAbi__factory} from '../../typechain';
import {deployed} from '../deployed';

export class SandboxLand {
  static getContractAddress(network: Network): string {
    return _.get(deployed, `${network}.SandboxLand`);
  }

  static getAbiClass(
    network: Network,
    signerOrProvider: Signer | ethers.providers.Provider
  ): SandboxLandAbi {
    return SandboxLandAbi__factory.connect(
      this.getContractAddress(network),
      signerOrProvider
    );
  }
}
