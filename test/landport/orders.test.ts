import * as _ from 'lodash';
import { ethers, BigNumber as EthBigNumber } from 'ethers';
import {
  withAliceOrBobOwningLand,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingWETH,
  getWETHBalance
} from '../utils';
import {
  RINKEBY_WETH_ADDRESS,
  RINKEBY_SANDBOX_LAND_ADDRESS,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
  sandboxLandAbi,
} from '../constants';
import { LandPort, Network, WyvernSchemaName } from '../../src';

describe('landport orders', () => {
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
    const [landOwnerWETHBalance, landTakerWETHBalance] = await withAliceAndBobHavingWETH(landOwner, landTaker);

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

    // Fulfill order
    const landTakerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landTaker.signer,
      (msg: any) => console.log(msg)
    );
    await landTakerPort.fulfillOrder({
      order,
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

  // TODO
  test('Could not sell NFT with 0 ERC20 price', async () => {
    expect(1 + 1).toEqual(2);
  });

  // TODO
  test('Could not sell not-owned NFT', async () => {
    expect(1 + 1).toEqual(2);
  });

  // TODO
  test('Cancelled Orders could not be matched', async () => {
    expect(1 + 1).toEqual(2);
  });

  // TODO
  test('Order could not be matched twice', async () => {
    expect(1 + 1).toEqual(2);
  });
});
