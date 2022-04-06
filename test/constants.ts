import { ethers } from 'ethers';
import { Account } from './types';
import { ERC20Abi__factory, ERC721Abi__factory } from '../src/typechain';

require('dotenv').config({ path: './test/.env' });

export const RINKEBY_SANDBOX_LAND_ADDRESS =
  '0x815f7BC6cF9826C676E16d7797de17d2dab0B693';
export const RINKEBY_SANDBOX_LAND_TOKEN_ID = 18884;

export const RINKEBY_WETH_ADDRESS =
  '0xc778417E063141139Fce010982780140Aa0cD5Ab';

export const provider = new ethers.providers.JsonRpcProvider(
  `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
  'rinkeby'
);
export const sandboxLandAbi = ERC721Abi__factory.connect(
  RINKEBY_SANDBOX_LAND_ADDRESS,
  provider
);
export const wethAbi = ERC20Abi__factory.connect(
  RINKEBY_WETH_ADDRESS,
  provider
);

export const Alice: Account = {
  address: '0xB6Ec64c617f0C4BFb886eE993d80C6234673e845',
  signer: new ethers.Wallet(process.env.ALICE_SECRET, provider),
};

export const Bob: Account = {
  address: '0x64A1337cB99a170692f4Eaa3A42730cEF525ffc3',
  signer: new ethers.Wallet(process.env.BOB_SECRET, provider),
};
