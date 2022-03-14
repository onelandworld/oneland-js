import {ethers} from 'ethers';
import {Network, LandPortConfig} from './types';

export class LandPort {
  private _network: Network;
  private _provider: ethers.providers.Provider;

  constructor(
    provider: ethers.providers.Provider,
    landPortConfig: LandPortConfig
  ) {
    this._provider = provider;
    this._network = landPortConfig.network;
  }

  public async ping() {
    return 'OK';
  }
}
