import { OneLandAPI, OneLandAPIConfig } from '../../src';
import { configs } from '../configs';

const apiConfig: OneLandAPIConfig = {
  network: configs.network,
};

const landApi = new OneLandAPI(apiConfig);

beforeAll(() => {});

describe('oneland api', () => {
  it('API works', () => {
    expect(1 + 1).toEqual(2);
  });
});
