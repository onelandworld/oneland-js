import * as _ from 'lodash';
import {
  OneLandAPIConfig,
  Network,
  OneLandAsset,
  AssetContractType,
  WyvernSchemaName,
  OneLandFungibleTokenQuery,
  OneLandFungibleToken,
  OrderJSON,
  Order,
} from './types';
import { orderFromJSON } from './utils';
import { deployed } from './contracts/deployed';
import axios from 'axios';
import { ProdProjects, TestProjects } from './constants';
// TODO: fetch from backend API service
export class OneLandAPI {
  public readonly hostUrl: string;


  private _network: Network;

  constructor(config: OneLandAPIConfig) {
    this._network = config.network!;
    if (config.hostUrl) {
      this.hostUrl = config.hostUrl;
    } else {
      switch (config.network) {
        case Network.Rinkeby:
          this.hostUrl = 'https://test-api.oneland.world';
          break;
        case Network.Main:
        default:
          this.hostUrl = 'https://api.oneland.world';
          break;
      }
    } 
  }

  public getProject(contract: string) {
    const address = contract.toLowerCase();
    if (this._network === Network.Main) {
      return ProdProjects.find((item) => item.contract === address);
    }
    return TestProjects.find((item) => item.contract === address);
  }

  private toOnelandAsset(asset: any): OneLandAsset {
    return {
      tokenAddress: asset.landContractAddress[0],
      tokenId: asset.token_id,
      schemaName: WyvernSchemaName.ERC721,
      assetContract: {
        name: asset.landName,
        address: asset.landContractAddress[0],
        type: AssetContractType.NonFungible,
        schemaName: WyvernSchemaName.ERC721,
      },
      collection: {
        name: asset.landName,
        slug: asset.landName,
        description: '',
        createdDate: new Date(),
        payoutAddress: '',
      },
      name: '',
      description: '',
      owner: { address: asset.owner_address },
      orders: null,
      buyOrders: null,
      sellOrders: null,
      isPresale: false,
    };
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
    const p = this.getProject(tokenAddress);
    if (!p) throw new Error(`not support tokenAddrees: ${tokenAddress}`);
    return axios
      .get(
        `${this.hostUrl}/api/v1/lands/project/${p.id}/lands/detail/${tokenId}`
      )
      .then((asset) => this.toOnelandAsset(asset.data.data))
      .catch((error) => {
        if (retries > 0)
          return this.getAsset({ tokenAddress, tokenId }, retries - 1);
        else throw error;
      });
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
  ): Promise<{ tokens: OneLandFungibleToken[] }> {
    let tokens =
      this._network === Network.Main
        ? [
            {
              name: 'Wrapped Ether',
              symbol: 'WETH',
              decimals: 18,
              address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
            {
              name: 'USD Coin',
              symbol: 'USDC',
              decimals: 6,
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
            {
              name: 'Tether USD',
              symbol: 'USDT',
              decimals: 6,
              address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          ]
        : [
            {
              name: 'Wrapped Ether',
              symbol: 'WETH',
              decimals: 18,
              address: '0xc778417e063141139fce010982780140aa0cd5ab',
            },
            {
              name: 'USD Coin',
              symbol: 'USDC',
              decimals: 6,
              address: '0x19d31b7e068b5e1ec77fbc66116d686c82f169c2',
            },
            {
              name: 'Tether USD',
              symbol: 'USDT',
              decimals: 6,
              address: '0xd92e713d051c37ebb2561803a3b5fbabc4962431',
            },
          ];
    if (query.address) {
      tokens = tokens.filter((item) => item.address === query.address);
    }
    return { tokens };
  }

  /**
   * Send an order to the orderbook.
   * Throws when the order is invalid.
   * IN NEXT VERSION: change order input to Order type
   * @param order Order JSON to post to the orderbook
   * @param retries Number of times to retry if the service is unavailable for any reason
   */
  public async postOrder(orderJson: OrderJSON, retries = 2): Promise<Order> {
    return axios
      .post(`${this.hostUrl}/api/market/order`, orderJson)
      .then(() => orderFromJSON(orderJson))
      .catch((error) => {
        if (retries > 0) return this.postOrder(orderJson, retries - 1);
        else throw error;
      });
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
