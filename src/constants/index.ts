import { BigNumber } from 'bignumber.js';

export * from './orders';
export * from './fees';

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const NULL_BLOCK_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const MAX_DIGITS_IN_UNSIGNED_256_INT = 78;
export const MAX_UINT_256 = new BigNumber(2).pow(256).minus(1);


export const TestProjects = [
  {
    id: 1,
    name: "The Sandbox",
    contract: "0x815f7bc6cf9826c676e16d7797de17d2dab0b693"
  }
]

export const ProdProjects = [
  {
    id: 1,
    name: "The Sandbox",
    contract: "0x5cc5b05a8a13e3fbdb0bb9fccd98d38e50f90c38"
  },
  {
    id: 2,
    name: "Decentraland",
    contract: "0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d"
  },
  {
    id: 3,
    name: "Cryptovoxels",
    contract: "0x79986af15539de2db9a5086382daeda917a9cf0c"
  },
  {
    id: 4,
    name: "Somnium Space",
    contract: "0x913ae503153d9a335398d0785ba60a2d63ddb4e2"
  },
  {
    id: 5,
    name: "Worldwide Webb",
    contract: "0xa1d4657e0e6507d5a94d06da93e94dc7c8c44b51"
  },
  {
    id: 6,
    name: "NFT Worlds",
    contract: "0xbd4455da5929d5639ee098abfaa3241e9ae111af"
  }
]

