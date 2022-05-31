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

describe('landport orders', () => {
  beforeEach(() => {
    mockMinExpirationMinutesGetter.mockClear();
    mockApiGetAsset.mockClear();
  });

  // Note: Use test.only(...) to run specific test only
  test('Swapping NFT with Ether/Matic does not work', async () => {
    const [landOwner] = await withAliceOrBobOwningLand();

    // Create Sell Order
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
    await expect(
      landOwnerPort.createSellOrder({
        asset,
        accountAddress: landOwner.address,
        startAmount: 0.01,
      })
    ).rejects.toThrow('Trading with ETH is not supported');
  }, 600000 /*10 minutes timeout*/);

  test('Swapping NFT with WETH works', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);

    // Create Sell Order
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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Fulfill order
    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await landTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: landTaker.address,
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

  test('Could not sell NFT with 0 ERC20 price', async () => {
    const [landOwner] = await withAliceOrBobOwningLand();

    // Create Sell Order
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
    await expect(
      landOwnerPort.createSellOrder({
        asset,
        accountAddress: landOwner.address,
        startAmount: 0,
        paymentTokenAddress: WETH_ADDRESS,
      })
    ).rejects.toThrow('Starting price must be a number > 0');
  }, 600000 /*10 minutes timeout*/);

  test('Could not sell not-owned NFT', async () => {
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
      landTakerPort.createSellOrder({
        asset,
        accountAddress: landTaker.address,
        startAmount: 0.01,
        paymentTokenAddress: WETH_ADDRESS,
      })
    ).rejects.toThrow(/You don't own enough to do that/);
  }, 600000 /*10 minutes timeout*/);

  test('Cancelled Orders could not be matched', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
    });

    await landOwnerPort.cancelOrder({
      order,
      accountAddress: landOwner.address,
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
    ).rejects.toThrow(/execution reverted: First order has invalid parameters/);
  }, 600000 /*10 minutes timeout*/);

  test('Order could not be matched with lower price', async () => {
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
        .add(mockMinExpirationMinutesGetter() + 1, 'minute')
        .unix(),
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Try to lower the price
    buyOrder.basePrice = toBaseUnitAmount(new BigNumber(0.005), WETH_DECIMAL);

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
    ).rejects.toThrow(/error/);

    await landOwnerPort.cancelOrder({
      order,
      accountAddress: landOwner.address,
    });
  }, 600000 /*10 minutes timeout*/);

  test('Expired Orders could not be matched', async () => {
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
      // order expires 1 minute later
      expirationTime: dayjs().add(1, 'minute').unix(),
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // sleep 1 minute to wait for the order to expire
    await sleep(60 * 1000);
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
    ).rejects.toThrow(/execution reverted: First order has invalid parameters/);
  }, 600000 /*10 minutes timeout*/);

  test('Order could not be matched twice', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landTakerPort = new LandPort(
      provider,
      { network: configs.network },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await landTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: landTaker.address,
    });

    // Assert NFT is transferred
    const landOwnerAddress = await sandboxLandAbi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(landOwnerAddress).toEqual(landTaker.address);

    // Now Caro wants to fulfill this order again
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
