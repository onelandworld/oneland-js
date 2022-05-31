import * as _ from 'lodash';
import { BigNumber as EthBigNumber } from 'ethers';
import { BigNumber } from 'bignumber.js';
import {
  sleep,
  withAliceOrBobOwningLand,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingWETH,
  getWETHBalance,
} from '../utils';
import {
  WETH_ADDRESS,
  WETH_DECIMAL,
  ERC721_ADDRESS,
  ERC721_TOKEN_ID,
  provider,
  sandboxLandAbi,
  Caro,
  mockApiGetAsset,
} from '../constants';
import {
  LandPort,
  WyvernSchemaName,
  toBaseUnitAmount,
  orderToJSON,
  orderFromJSON,
  NULL_ADDRESS,
} from '../../src';
import { configs } from '../configs';

const dayjs = require('dayjs');

const mockMinExpirationMinutesGetter = jest.fn();
jest.mock('../../src/constants/orders', () => {
  return {
    get MIN_EXPIRATION_MINUTES() {
      return mockMinExpirationMinutesGetter();
    },
    get DEFAULT_EXPIRATION_DAYS() {
      return 7;
    },
    get MAX_EXPIRATION_MONTHS() {
      return 6;
    },
    get ORDER_MATCHING_LATENCY_SECONDS() {
      return 60 * 60 * 24 * 7;
    },
  };
});

describe('landport offers', () => {
  beforeEach(() => {
    mockMinExpirationMinutesGetter.mockClear();
    mockApiGetAsset.mockClear();
  });

  // Note: Use test.only(...) to run specific test only
  test('Making offer with Ether/Matic does not work', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landTakerPort.createBuyOrder({
        asset,
        accountAddress: landTaker.address,
        startAmount: 0.01,
        paymentTokenAddress: NULL_ADDRESS,
      })
    ).rejects.toThrow('ERC20 payment token required');
  }, 600000 /*10 minutes timeout*/);

  test('Offering with WETH works', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);

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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await landOwnerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: landOwner.address,
    });

    // Assert NFT is transferred
    const landOwnerAddress = await sandboxLandAbi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(landOwnerAddress).toEqual(landTaker.address);

    // Asset WETH is transferred
    const updatedLandOwnerWETHBalance = await getWETHBalance(landOwner.address);
    expect(updatedLandOwnerWETHBalance).toBeCloseTo(
      landOwnerWETHBalance + price
    );
    const updatedLandTakerWETHBalance = await getWETHBalance(landTaker.address);
    expect(updatedLandTakerWETHBalance).toBeCloseTo(
      landTakerWETHBalance - price
    );
  }, 600000 /*10 minutes timeout*/);

  test('Could not offer with 0 ERC20 price', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landTakerPort.createBuyOrder({
        asset,
        accountAddress: landTaker.address,
        startAmount: 0,
        paymentTokenAddress: WETH_ADDRESS,
      })
    ).rejects.toThrow('Starting price must be a number > 0');
  }, 600000 /*10 minutes timeout*/);

  test('Could not offer and match for self-owned NFT', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    const order = await landOwnerPort.createBuyOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: 0.01,
      paymentTokenAddress: WETH_ADDRESS,
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landTakerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: landTaker.address,
      })
    ).rejects.toThrow(/You don't own enough to do that/);
  }, 600000 /*10 minutes timeout*/);

  test('Cancelled offers could not be matched', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
      accountAddress: landOwner.address,
      startAmount: price,
      paymentTokenAddress: WETH_ADDRESS,
    });

    await landTakerPort.cancelOrder({
      order,
      accountAddress: landTaker.address,
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landOwnerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: landOwner.address,
      })
    ).rejects.toThrow(
      'Invalid buy order. It may have recently been removed. Please refresh the page and try again!'
    );
  }, 600000 /*10 minutes timeout*/);

  test('Offers could not be matched with higher price', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);

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
        .add(mockMinExpirationMinutesGetter() + 1, 'minute')
        .unix(),
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Try to higher the price
    buyOrder.basePrice = toBaseUnitAmount(new BigNumber(0.02), WETH_DECIMAL);

    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landOwnerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: landOwner.address,
      })
    ).rejects.toThrow(/error/);
  }, 600000 /*10 minutes timeout*/);

  test('Expired offers could not be matched', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);

    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
      accountAddress: landOwner.address,
      startAmount: price,
      paymentTokenAddress: WETH_ADDRESS,
      // order expires 1 minute later
      expirationTime: dayjs().add(1, 'minute').unix(),
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // sleep 1 minute to wait for the order to expire
    await sleep(60 * 1000);
    const landOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landOwnerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: landOwner.address,
      })
    ).rejects.toThrow(/Invalid buy order/);
  }, 600000 /*10 minutes timeout*/);

  test('Offer could only be fulfilled by NFT owner', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);

    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
        .add(mockMinExpirationMinutesGetter() + 1, 'minute')
        .unix(),
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Caro wants to fulfill this buy order
    const landPortOfCaro = new LandPort(
      provider,
      { network: configs.network },
      Caro.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landPortOfCaro.fulfillOrder({
        order: buyOrder,
        accountAddress: Caro.address,
      })
    ).rejects.toThrow(/error/);
  }, 600000 /*10 minutes timeout*/);
});
