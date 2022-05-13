import * as _ from 'lodash';
import { withAliceOrBobOwningLand, withAliceAndBobHavingEther } from '../utils';
import {
  RINKEBY_WETH_ADDRESS,
  RINKEBY_SANDBOX_LAND_ADDRESS,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
} from '../constants';
import {
  LandPort,
  Network,
  WyvernSchemaName,
  SaleKind,
  MIN_EXPIRATION_MINUTES,
} from '../../src';

const dayjs = require('dayjs');

describe('order salekind', () => {
  test('Sell orders with empty endAmount should be with SaleKind.FixedPrice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
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
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      endAmount: null,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
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
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: price,
      endAmount: price,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
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
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landTakerPort.createBuyOrder({
      asset,
      accountAddress: landTaker.address,
      startAmount: price,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);
});
