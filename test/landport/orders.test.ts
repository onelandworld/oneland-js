import * as _ from 'lodash';
import { BigNumber as EthBigNumber } from 'ethers';
import { BigNumber } from 'bignumber.js';
import {
  sleep,
  withAliceOrBobOwningNFT,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingERC20,
  getERC20Balance,
} from '../utils';
import {
  ERC20_TOKEN_ADDRESS,
  ERC20_TOKEN_DECIMAL,
  ERC721_ADDRESS,
  ERC721_TOKEN_ID,
  provider,
  erc721Abi,
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
  test('Swapping NFT with native Ether/Matic/BNB does not work', async () => {
    const [nftOwner] = await withAliceOrBobOwningNFT();

    // Create Sell Order
    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftOwnerPort.createSellOrder({
        asset,
        accountAddress: nftOwner.address,
        startAmount: 0.01,
      })
    ).rejects.toThrow('Trading with native ether is not supported');
  }, 600000 /*10 minutes timeout*/);

  test('Swapping NFT with ERC20 works', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    const [nftOwnerERC20Balance, nftTakerERC20Balance] =
      await withAliceAndBobHavingERC20(nftOwner, nftTaker);

    // Create Sell Order
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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Fulfill order
    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await nftTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: nftTaker.address,
    });

    // Assert NFT is transferred
    const nftOwnerAddress = await erc721Abi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(nftOwnerAddress).toEqual(nftTaker.address);

    // Asset ERC20 is transferred
    const updatedNFTOwnerERC20Balance = await getERC20Balance(nftOwner.address);
    expect(updatedNFTOwnerERC20Balance).toBeCloseTo(
      nftOwnerERC20Balance + price
    );
    const updatedNFTTakerERC20Balance = await getERC20Balance(nftTaker.address);
    expect(updatedNFTTakerERC20Balance).toBeCloseTo(
      nftTakerERC20Balance - price
    );
  }, 600000 /*10 minutes timeout*/);

  test('Could not sell NFT with 0 ERC20 price', async () => {
    const [nftOwner] = await withAliceOrBobOwningNFT();

    // Create Sell Order
    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftOwnerPort.createSellOrder({
        asset,
        accountAddress: nftOwner.address,
        startAmount: 0,
        paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      })
    ).rejects.toThrow('Starting price must be a number > 0');
  }, 600000 /*10 minutes timeout*/);

  test('Could not sell not-owned NFT', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();

    const asset = {
      tokenAddress: ERC721_ADDRESS,
      tokenId: ERC721_TOKEN_ID + '',
      schemaName: WyvernSchemaName.ERC721,
    };
    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftTakerPort.createSellOrder({
        asset,
        accountAddress: nftTaker.address,
        startAmount: 0.01,
        paymentTokenAddress: ERC20_TOKEN_ADDRESS,
      })
    ).rejects.toThrow(/You don't own enough to do that/);
  }, 600000 /*10 minutes timeout*/);

  test('Cancelled Orders could not be matched', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingERC20(nftOwner, nftTaker);

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
    });

    await nftOwnerPort.cancelOrder({
      order,
      accountAddress: nftOwner.address,
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftTakerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: nftTaker.address,
      })
    ).rejects.toThrow(/execution reverted: First order has invalid parameters/);
  }, 600000 /*10 minutes timeout*/);

  test('Order could not be matched with lower price', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);

    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    const [nftOwnerERC20Balance, nftTakerERC20Balance] =
      await withAliceAndBobHavingERC20(nftOwner, nftTaker);

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
        .add(mockMinExpirationMinutesGetter() + 1, 'minute')
        .unix(),
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // Try to lower the price
    buyOrder.basePrice = toBaseUnitAmount(new BigNumber(0.005), ERC20_TOKEN_DECIMAL);

    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftTakerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: nftTaker.address,
      })
    ).rejects.toThrow(/error/);

    await nftOwnerPort.cancelOrder({
      order,
      accountAddress: nftOwner.address,
    });
  }, 600000 /*10 minutes timeout*/);

  test('Expired Orders could not be matched', async () => {
    mockMinExpirationMinutesGetter.mockReturnValue(1);

    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingERC20(nftOwner, nftTaker);

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
      // order expires 1 minute later
      expirationTime: dayjs().add(1, 'minute').unix(),
    });

    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    // sleep 1 minute to wait for the order to expire
    await sleep(60 * 1000);
    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await expect(
      nftTakerPort.fulfillOrder({
        order: buyOrder,
        accountAddress: nftTaker.address,
      })
    ).rejects.toThrow(/execution reverted: First order has invalid parameters/);
  }, 600000 /*10 minutes timeout*/);

  test('Order could not be matched twice', async () => {
    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingERC20(nftOwner, nftTaker);

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
    });
    const orderJson = orderToJSON(order);
    const buyOrder = orderFromJSON(orderJson);

    const nftTakerPort = new LandPort(
      provider,
      { network: configs.network },
      nftTaker.signer,
      (msg: any) => console.log(msg)
    );
    await nftTakerPort.fulfillOrder({
      order: buyOrder,
      accountAddress: nftTaker.address,
    });

    // Assert NFT is transferred
    const nftOwnerAddress = await erc721Abi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(nftOwnerAddress).toEqual(nftTaker.address);

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
