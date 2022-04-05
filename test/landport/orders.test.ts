import * as _ from 'lodash';
import {
  withAliceOrBobOwningLand,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingWETH,
} from '../utils';
import { LandPort } from '../../src';

describe('landport orders', () => {
  it('LandPort Order Works', async () => {
    const [landOwner, landBuyer] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH();
  }, 600000 /*10 minutes timeout*/);
});
