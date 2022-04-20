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
  RINKEBY_WETH_ADDRESS,
  RINKEBY_WETH_DECIMAL,
  RINKEBY_SANDBOX_LAND_ADDRESS,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
  sandboxLandAbi,
  Caro,
} from '../constants';
import {
  LandPort,
  Network,
  WyvernSchemaName,
  toBaseUnitAmount,
  orderToJSON,
  orderFromJSON,
} from '../../src';

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
  });

  // Note: Use test.only(...) to run specific test only
  test('Swapping NFT with Ether not works', async () => {
    const [landOwner] = await withAliceOrBobOwningLand();

    // Create Sell Order
    const asset = {
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Fulfill order
    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await landTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: landTaker.address,
    });

    // Assert NFT is transferred
    const landOwnerAddress = await sandboxLandAbi.ownerOf(
      EthBigNumber.from(RINKEBY_SANDBOX_LAND_TOKEN_ID)
    );
    expect(landOwnerAddress).toEqual(landTaker.address);

    // Asset WETH is transferred
    const updatedLandOwnerWETHBalance = await getWETHBalance(landOwner.address);
    expect(updatedLandOwnerWETHBalance).toEqual(landOwnerWETHBalance + price);
    const updatedLandTakerWETHBalance = await getWETHBalance(landTaker.address);
    expect(updatedLandTakerWETHBalance).toEqual(landTakerWETHBalance - price);
  }, 600000 /*10 minutes timeout*/);

  test('Could not sell NFT with 0 ERC20 price', async () => {
    const [landOwner] = await withAliceOrBobOwningLand();

    // Create Sell Order
    const asset = {
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landOwnerPort.createSellOrder({
        asset,
        accountAddress: landOwner.address,
        startAmount: 0,
        paymentTokenAddress: RINKEBY_WETH_ADDRESS,
      })
    ).rejects.toThrow('Starting price must be a number > 0');
  }, 600000 /*10 minutes timeout*/);

  test('Could not sell not-owned NFT', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();

    const asset = {
      tokenAddress: RINKEBY_SANDBOX_LAND_ADDRESS,
      tokenId: RINKEBY_SANDBOX_LAND_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landTakerPort.createSellOrder({
        asset,
        accountAddress: landTaker.address,
        startAmount: 0.01,
        paymentTokenAddress: RINKEBY_WETH_ADDRESS,
      })
    ).rejects.toThrow(/You don't own enough to do that/);
  }, 600000 /*10 minutes timeout*/);

  test('Cancelled Orders could not be matched', async () => {
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
    });

    await landOwnerPort.cancelOrder({
      order,
      accountAddress: landOwner.address,
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
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
    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);

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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Try to lower the price
    buyOrder.basePrice = toBaseUnitAmount(
      new BigNumber(0.005),
      RINKEBY_WETH_DECIMAL
    );

    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      landTakerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: landTaker.address,
      })
    ).rejects.toThrow(/error/);
  }, 600000 /*10 minutes timeout*/);

  test('Expired Orders could not be matched', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);

    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH(landOwner, landTaker);

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
      // order expires 1 minute later
      expirationTime: dayjs().add(1, 'minute').unix(),
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // sleep 1 minute to wait for the order to expire
    await sleep(60 * 1000);
    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await landTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: landTaker.address,
    });

    // Assert NFT is transferred
    const landOwnerAddress = await sandboxLandAbi.ownerOf(
      EthBigNumber.from(RINKEBY_SANDBOX_LAND_TOKEN_ID)
    );
    expect(landOwnerAddress).toEqual(landTaker.address);

    // Now Caro wants to fulfill this order again
    const landPortOfCaro = new LandPort(
      provider,
      { network: Network.Rinkeby },
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
