import * as _ from 'lodash';
import { Network } from './types';

require('dotenv').config({ path: './test/.env' });

const getEnv = (value: string, defaultValue: any): any => {
  return process.env[value] || defaultValue;
};

export const configs = {
  network:
    getEnv('NETWORK', '') === 'mumbai' ? Network.Mumbai : Network.Rinkeby,
  accounts: {
    aliceSecret: getEnv('ALICE_SECRET', ''),
    bobSecret: getEnv('BOB_SECRET', ''),
    caroSecret: getEnv('CARO_SECRET', ''),
    daveSecret: getEnv('DAVE_SECRET', ''),
  },
  infura: {
    projectId: getEnv('INFURA_PROJECT_ID', ''),
  },
};
