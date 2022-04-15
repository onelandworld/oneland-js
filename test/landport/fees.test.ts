import * as _ from 'lodash';
import { BigNumber as EthBigNumber } from 'ethers';
import {
  withAliceOrBobOwningLand,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingWETH,
} from '../utils';
import {
  RINKEBY_WETH_ADDRESS,
  RINKEBY_SANDBOX_LAND_ADDRESS,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
  sandboxLandAbi,
} from '../constants';
import { LandPort, Network, WyvernSchemaName } from '../../src';

describe('landport order fees', () => {
  test.only('WETH Fees', async () => {
    const [landOwner, landBuyer] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    await withAliceAndBobHavingWETH();

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
    const order = await landOwnerPort.createSellOrder({
      asset,
      accountAddress: landOwner.address,
      startAmount: 0.01,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
    });

    // Fulfill order
    const landBuyerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landBuyer.signer,
      (msg: any) => console.log(msg)
    );
    await landBuyerPort.fulfillOrder({
      order,
      accountAddress: landBuyer.address,
    });

    // Assert NFT is transferred
    const landOwnerAddress = await sandboxLandAbi.ownerOf(
      EthBigNumber.from(RINKEBY_SANDBOX_LAND_TOKEN_ID)
    );
    expect(landOwnerAddress).toEqual(landBuyer.address);
  }, 600000 /*10 minutes timeout*/);
});
