import * as _ from 'lodash';
import {
  OneLandAPIConfig,
  Network,
  OneLandAsset,
  AssetContractType,
  WyvernSchemaName,
  OneLandFungibleTokenQuery,
  OneLandFungibleToken,
} from './types';
import {deployed} from './contracts/deployed';

// TODO: fetch from backend API service
export class OneLandAPI {
  public readonly hostUrl: string;

  public readonly apiBaseUrl: string;

  private _network: Network;

  constructor(config: OneLandAPIConfig) {
    this._network = config.network!;
    switch (config.network) {
      case Network.Rinkeby:
        this.apiBaseUrl = '';
        this.hostUrl = '';
        break;
      case Network.Main:
      default:
        this.apiBaseUrl = '';
        this.hostUrl = '';
        break;
    }
  }

  public async getAsset(
    {
      tokenAddress,
      tokenId,
    }: {
      tokenAddress: string;
      tokenId: string | null;
    },
    retries = 1
  ): Promise<OneLandAsset> {
    return {
      tokenAddress,
      tokenId: tokenId || '',
      schemaName: WyvernSchemaName.ERC721,
      assetContract: {
        name: 'Sandbox Land',
        address: _.get(deployed, `${this._network}.SandboxLand`),
        type: AssetContractType.NonFungible,
        schemaName: WyvernSchemaName.ERC721,
      },
      collection: {},
      name: '',
      description: '',
      owner: {address: ''},
      orders: null,
      buyOrders: null,
      sellOrders: null,
      isPresale: false,
    };
  }

  /**
   * Fetch list of fungible tokens from the API matching parameters
   * @param query Query to use for getting orders. A subset of parameters on the `OneLandAssetJSON` type is supported
   * @param page Page number, defaults to 1. Can be overridden by
   * `limit` and `offset` attributes from OneLandFungibleTokenQuery
   * @param retries Number of times to retry if the service is unavailable for any reason
   */
  public async getPaymentTokens(
    query: OneLandFungibleTokenQuery = {},
    page = 1,
    retries = 1
  ): Promise<{tokens: OneLandFungibleToken[]}> {
    return {
      tokens: [
        {
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          address: _.get(deployed, `${this._network}.USDT`),
        },
      ],
    };
  }

 /**
 * Create a whitelist entry for an asset to prevent others from buying.
 * Buyers will have to have verified at least one of the emails
 * on an asset in order to buy.
 * This will throw a 403 if the given API key isn't allowed to create whitelist entries for this contract or asset.
 * @param tokenAddress Address of the asset's contract
 * @param tokenId The asset's token ID
 * @param email The email allowed to buy.
 */
  public async postAssetWhitelist(
    tokenAddress: string,
    tokenId: string | number,
    email: string
    ): Promise<boolean> {
    return true;
  }
}
