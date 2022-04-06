import { ethers } from 'ethers';
/* eslint-disable node/no-extraneous-import */
import { TypedDataSigner } from '@ethersproject/abstract-signer';

export interface Account {
  address: string;
  signer: ethers.Signer & TypedDataSigner;
}
