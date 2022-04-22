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
  Dave,
} from '../constants';
import {
  LandPort,
  OneLandAPI,
  Network,
  WyvernSchemaName,
  AssetContractType,
} from '../../src';

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

const mockApiGetAsset = jest.fn();
jest
  .spyOn(OneLandAPI.prototype, 'getAsset')
  .mockImplementation(mockApiGetAsset);

const mockApiGetAssetResult = ({
  tokenAddress,
  tokenId,
  onelandFeeBasisPoints,
  devFeeBasisPoints,
  devFeeRecipient,
}: {
  tokenAddress: string;
  tokenId: string | null;
  onelandFeeBasisPoints: number;
  devFeeBasisPoints: number;
  devFeeRecipient: string;
}) => {
  return {
    tokenAddress,
    tokenId: tokenId || '',
    schemaName: WyvernSchemaName.ERC721,
    assetContract: {
      name: 'Sandbox Land',
      address: RINKEBY_SANDBOX_LAND_ADDRESS,
      type: AssetContractType.NonFungible,
      schemaName: WyvernSchemaName.ERC721,
    },
    collection: {
      name: 'Sandbox Land',
      slug: 'sandbox',
      description: '',
      createdDate: new Date(),
      onelandFeeBasisPoints,
      devFeeBasisPoints,
      payoutAddress: devFeeRecipient,
    },
    name: '',
    description: '',
    owner: { address: '' },
    orders: null,
    buyOrders: null,
    sellOrders: null,
    isPresale: false,
  };
};

describe('landport offer fees', () => {
  beforeEach(() => {
    mockDefaultOnelandFeeBasisPointsGetter.mockClear();
    mockOnelandFeeRecipientGetter.mockClear();
    mockApiGetAsset.mockClear();
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
    const order = await landTakerPort.createBuyOrder({
      asset,
      accountAddress: landTaker.address,
      startAmount: price,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
    });

    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await landOwnerPort.fulfillOrder({
      order,
      accountAddress: landOwner.address,
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

  test('Oneland fees and dev fees work', async () => {
    // Set oneland fee to 1%
    mockDefaultOnelandFeeBasisPointsGetter.mockReturnValue(100);
    // Set oneland fee recipient to Caro
    mockOnelandFeeRecipientGetter.mockReturnValue(Caro.address);
    // Overwrite oneland fee to 2% (for this collection only)
    const mockCollectionOnelandFeeBasisPoints = 200;
    // Set dev fee to 5% and recipient to Dave
    const mockDevFeeBasisPoints = 500;
    const mockDevFeeRecipient = Dave.address;
    mockApiGetAsset.mockImplementation(
      async (
        {
          tokenAddress,
          tokenId,
        }: {
          tokenAddress: string;
          tokenId: string | null;
        },
        retries = 1
      ) => {
        return mockApiGetAssetResult({
          tokenAddress,
          tokenId,
          onelandFeeBasisPoints: mockCollectionOnelandFeeBasisPoints,
          devFeeBasisPoints: mockDevFeeBasisPoints,
          devFeeRecipient: mockDevFeeRecipient,
        });
      }
    );

    const price = 0.01;
    const onelandFee = (price * mockCollectionOnelandFeeBasisPoints) / 10000;
    const devFee = (price * mockDevFeeBasisPoints) / 10000;
    const amount = price - onelandFee - devFee;

    const [landOwner, landTaker] = await withAliceOrBobOwningLand();
    await withAliceAndBobHavingEther();
    const [landOwnerWETHBalance, landTakerWETHBalance] =
      await withAliceAndBobHavingWETH(landOwner, landTaker);
    const onelandFeeRecipientWETHBalance = await getWETHBalance(
      mockOnelandFeeRecipientGetter()
    );
    const devFeeRecipientWETHBalance = await getWETHBalance(
      mockDevFeeRecipient
    );

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
    const order = await landTakerPort.createBuyOrder({
      asset,
      accountAddress: landTaker.address,
      startAmount: price,
      paymentTokenAddress: RINKEBY_WETH_ADDRESS,
    });

    const landOwnerPort = new LandPort(
      provider,
      { network: Network.Rinkeby },
      landOwner.signer,
      (msg: any) => console.log(msg)
    );
    await landOwnerPort.fulfillOrder({
      order,
      accountAddress: landOwner.address,
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
    const updatedDevFeeRecipientWETHBalance = await getWETHBalance(
      mockDevFeeRecipient
    );
    expect(updatedDevFeeRecipientWETHBalance).toBeCloseTo(
      devFeeRecipientWETHBalance + devFee,
      3
    );
    const updatedLandTakerWETHBalance = await getWETHBalance(landTaker.address);
    expect(updatedLandTakerWETHBalance).toBeCloseTo(
      landTakerWETHBalance - amount - onelandFee - devFee,
      3
    );
  }, 600000 /*10 minutes timeout*/);
});
