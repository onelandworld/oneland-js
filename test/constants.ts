import { ethers } from 'ethers';
import { OneLandAPI, AssetContractType, WyvernSchemaName } from '../src';
import { Account, Network } from './types';
import { ERC20Abi__factory, ERC721Abi__factory } from '../src/typechain';
import { configs } from './configs';

export const ERC721_ADDRESS = (() => {
  switch (configs.network) {
    case Network.Mumbai:
      return '0xbf0708f39b945894eaD70debeE3AeeA352d10ce2';
    case Network.Rinkeby:
    default:
      return '0x815f7BC6cF9826C676E16d7797de17d2dab0B693';
  }
})();

export const ERC721_TOKEN_ID = (() => {
  switch (configs.network) {
    case Network.Mumbai:
      return 163012;
    case Network.Rinkeby:
    default:
      return 18884;
  }
})();

export const WETH_ADDRESS = (() => {
  switch (configs.network) {
    case Network.Mumbai:
      return '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa';
    case Network.Rinkeby:
    default:
      return '0xc778417E063141139Fce010982780140Aa0cD5Ab';
  }
})();

export const WETH_DECIMAL = 18;

export const provider = (() => {
  switch (configs.network) {
    case Network.Mumbai:
      return new ethers.providers.JsonRpcProvider(
        `https://polygon-mumbai.infura.io/v3/${configs.infura.projectId}`,
        'maticmum'
      );
    case Network.Rinkeby:
    default:
      return new ethers.providers.JsonRpcProvider(
        `https://rinkeby.infura.io/v3/${configs.infura.projectId}`,
        'rinkeby'
      );
  }
})();

export const sandboxLandAbi = ERC721Abi__factory.connect(
  ERC721_ADDRESS,
  provider
);

export const wethAbi = ERC20Abi__factory.connect(WETH_ADDRESS, provider);

export const Alice: Account = {
  address: '0xB6Ec64c617f0C4BFb886eE993d80C6234673e845',
  signer: new ethers.Wallet(configs.accounts.aliceSecret, provider),
};

export const Bob: Account = {
  address: '0x64A1337cB99a170692f4Eaa3A42730cEF525ffc3',
  signer: new ethers.Wallet(configs.accounts.bobSecret, provider),
};

export const Caro: Account = {
  address: '0xd6c56f7e7d9C0B42cFdb3F05c7436bAbA01CFe39',
  signer: new ethers.Wallet(configs.accounts.caroSecret, provider),
};

export const Dave: Account = {
  address: '0xBa7Bc2e4EF990cc608fa9539f4ea04dD52178440',
  signer: new ethers.Wallet(configs.accounts.daveSecret, provider),
};

export const mockApiGetAsset = jest.fn();
jest
  .spyOn(OneLandAPI.prototype, 'getAsset')
  .mockImplementation(mockApiGetAsset);

mockApiGetAsset.mockImplementation(
  async (
    {
      tokenAddress,
      tokenId,
    }: {
      tokenAddress: string;
      tokenId: string | null;
    },
    retries = 1
  ) => {
    return {
      tokenAddress,
      tokenId: tokenId || '',
      schemaName: WyvernSchemaName.ERC721,
      assetContract: {
        name: 'Sandbox Land',
        address: ERC721_ADDRESS,
        type: AssetContractType.NonFungible,
        schemaName: WyvernSchemaName.ERC721,
      },
      collection: {
        name: 'Sandbox Land',
        slug: 'sandbox',
        description: '',
        createdDate: new Date(),
      },
      name: '',
      description: '',
      owner: { address: '' },
      orders: null,
      buyOrders: null,
      sellOrders: null,
      isPresale: false,
    };
  }
);
