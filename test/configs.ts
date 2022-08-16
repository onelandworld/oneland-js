import * as _ from 'lodash';
import { Network } from './types';

require('dotenv').config({ path: './test/.env' });

const getEnv = (value: string, defaultValue: any): any => {
  return process.env[value] || defaultValue;
};

const getNetwork = (): Network => {
  const network = getEnv('NETWORK', '');
  switch(network) {
    case 'mumbai':
      return Network.Mumbai;
    case 'bsctestnet':
      return Network.BscTestnet;
    case 'rinkeby':
    default:
      return Network.Rinkeby;
  }
}

export const configs = {
  network: getNetwork(),
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
