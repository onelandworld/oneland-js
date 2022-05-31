import * as _ from 'lodash';
import { withAliceOrBobOwningLand, withAliceAndBobHavingEther } from '../utils';
import {
  WETH_ADDRESS,
  ERC721_ADDRESS,
  ERC721_TOKEN_ID,
  provider,
  mockApiGetAsset,
} from '../constants';
import {
  LandPort,
  WyvernSchemaName,
  SaleKind,
  MIN_EXPIRATION_MINUTES,
} from '../../src';
import { configs } from '../configs';

const dayjs = require('dayjs');

describe('order salekind', () => {
  beforeEach(() => {
    mockApiGetAsset.mockClear();
  });

  test('Sell orders with empty endAmount should be with SaleKind.FixedPrice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      paymentTokenAddress: WETH_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Sell orders with null endAmount should be with SaleKind.FixedPrice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      endAmount: null,
      paymentTokenAddress: WETH_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Sell orders with same startAmount and endAmount should be with SaleKind.FixedPrice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      endAmount: price,
      paymentTokenAddress: WETH_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Offer orders should always be with SaleKind.FixedPrice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landTakerPort.createBuyOrder({
      asset,
      accountAddress: landTaker.address,
      startAmount: price,
      paymentTokenAddress: WETH_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);
});
