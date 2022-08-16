import * as _ from 'lodash';
import { withAliceOrBobOwningNFT, withAliceAndBobHavingEther } from '../utils';
import {
  ERC20_TOKEN_ADDRESS,
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
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await nftOwnerPort.createSellOrder({
      asset,
      accountAddress: nftOwner.address,
      startAmount: price,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Sell orders with null endAmount should be with SaleKind.FixedPrice', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await nftOwnerPort.createSellOrder({
      asset,
      accountAddress: nftOwner.address,
      startAmount: price,
      endAmount: null,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Sell orders with same startAmount and endAmount should be with SaleKind.FixedPrice', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await nftOwnerPort.createSellOrder({
      asset,
      accountAddress: nftOwner.address,
      startAmount: price,
      endAmount: price,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);

  test('Offer orders should always be with SaleKind.FixedPrice', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const price = 0.01;
    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    const order = await nftTakerPort.createBuyOrder({
      asset,
      accountAddress: nftTaker.address,
      startAmount: price,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      expirationTime: dayjs()
        .add(MIN_EXPIRATION_MINUTES + 1, 'minute')
        .unix(),
    });

    expect(order.saleKind).toEqual(SaleKind.FixedPrice);
  }, 600000 /*10 minutes timeout*/);
});
