import * as _ from 'lodash';
import { BigNumber as EthBigNumber } from 'ethers';
import {
  withAliceOrBobOwningLand,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingWETH,
  getWETHBalance,
} from '../utils';
import {
  RINKEBY_WETH_ADDRESS,
  RINKEBY_SANDBOX_LAND_ADDRESS,
  RINKEBY_SANDBOX_LAND_TOKEN_ID,
  provider,
  sandboxLandAbi,
  Caro,
} from '../constants';
import { LandPort, Network, WyvernSchemaName } from '../../src';

const mockDefaultOnelandFeeBasisPointsGetter = jest.fn();
const mockOnelandFeeRecipientGetter = jest.fn();
jest.mock('../../src/constants/fees', () => {
  // const originalModule = jest.requireActual('../../src/constants/fees');
  return {
    // ...originalModule,
    get DEFAULT_ONELAND_FEE_BASIS_POINTS() {
      return mockDefaultOnelandFeeBasisPointsGetter();
    },
    get MAX_ONELAND_FEE_BASIS_POINTS() {
      return 3000;
    },
    get MAX_DEV_FEE_BASIS_POINTS() {
      return 3000;
    },
    get ONELAND_FEE_RECIPIENT() {
      return mockOnelandFeeRecipientGetter();
    },
  };
});

describe('landport order fees', () => {
  beforeEach(() => {
    mockDefaultOnelandFeeBasisPointsGetter.mockClear();
    mockOnelandFeeRecipientGetter.mockClear();
  });

  test('Oneland fees works', async () => {
    // Set oneland fee to 1%
    mockDefaultOnelandFeeBasisPointsGetter.mockReturnValue(100);
    // Set oneland fee recipient to Caro
    mockOnelandFeeRecipientGetter.mockReturnValue(Caro.address);

    const price = 0.01;
    const onelandFee =
      (price * mockDefaultOnelandFeeBasisPointsGetter()) / 10000;
    const amount = price - onelandFee;

    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);
    const onelandFeeRecipientWETHBalance = await getWETHBalance(
      mockOnelandFeeRecipientGetter()
    );

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
    expect(updatedLandOwnerWETHBalance).toBeCloseTo(
      landOwnerWETHBalance + amount,
      3
    );
    const updatedOnelandFeeRecipientWETHBalance = await getWETHBalance(
      mockOnelandFeeRecipientGetter()
    );
    expect(updatedOnelandFeeRecipientWETHBalance).toBeCloseTo(
      onelandFeeRecipientWETHBalance + onelandFee,
      3
    );
    const updatedLandTakerWETHBalance = await getWETHBalance(landTaker.address);
    expect(updatedLandTakerWETHBalance).toBeCloseTo(
      landTakerWETHBalance - amount - onelandFee,
      3
    );
  }, 600000 /*10 minutes timeout*/);
});