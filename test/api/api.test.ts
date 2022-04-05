import { OneLandAPI, OneLandAPIConfig, Network } from '../../src';

const apiConfig: OneLandAPIConfig = {
  network: Network.Rinkeby,
};

const landApi = new OneLandAPI(apiConfig);

beforeAll(() => {});

describe('oneland api', () => {
  it('API works', () => {
    expect(1 + 1).toEqual(2);
  });
});
