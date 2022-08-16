import * as _ from 'lodash';
import { BigNumber as EthBigNumber } from 'ethers';
import {
  withAliceOrBobOwningNFT,
  withAliceAndBobHavingEther,
  withAliceAndBobHavingERC20,
  getERC20Balance,
} from '../utils';
import {
  ERC20_TOKEN_ADDRESS,
  ERC721_ADDRESS,
  ERC721_TOKEN_ID,
  provider,
  erc721Abi,
  Caro,
  Dave,
  mockApiGetAsset,
} from '../constants';
import { LandPort, WyvernSchemaName, AssetContractType } from '../../src';
import { configs } from '../configs';

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
      name: 'ERC721 Test',
      address: ERC721_ADDRESS,
      type: AssetContractType.NonFungible,
      schemaName: WyvernSchemaName.ERC721,
    },
    collection: {
      name: 'ERC721 Test',
      slug: 'erc721test',
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

    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    const [nftOwnerERC20Balance, nftTakerERC20Balance] =
      await withAliceAndBobHavingERC20(nftOwner, nftTaker);
    const onelandFeeRecipientWETHBalance = await getERC20Balance(
      mockOnelandFeeRecipientGetter()
    );

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
    const order = await nftTakerPort.createBuyOrder({
      asset,
      accountAddress: nftTaker.address,
      startAmount: price,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
    });

    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    await nftOwnerPort.fulfillOrder({
      order,
      accountAddress: nftOwner.address,
    });

    // Assert NFT is transferred
    const nftOwnerAddress = await erc721Abi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(nftOwnerAddress).toEqual(nftTaker.address);

    // Asset WETH is transferred
    const updatedNFTOwnerERC20Balance = await getERC20Balance(nftOwner.address);
    expect(updatedNFTOwnerERC20Balance).toBeCloseTo(
      nftOwnerERC20Balance + amount,
      3
    );
    const updatedOnelandFeeRecipientWETHBalance = await getERC20Balance(
      mockOnelandFeeRecipientGetter()
    );
    expect(updatedOnelandFeeRecipientWETHBalance).toBeCloseTo(
      onelandFeeRecipientWETHBalance + onelandFee,
      3
    );
    const updatedNFTTakerERC20Balance = await getERC20Balance(nftTaker.address);
    expect(updatedNFTTakerERC20Balance).toBeCloseTo(
      nftTakerERC20Balance - amount - onelandFee,
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

    const [nftOwner, nftTaker] = await withAliceOrBobOwningNFT();
    await withAliceAndBobHavingEther();
    const [nftOwnerERC20Balance, nftTakerERC20Balance] =
      await withAliceAndBobHavingERC20(nftOwner, nftTaker);
    const onelandFeeRecipientWETHBalance = await getERC20Balance(
      mockOnelandFeeRecipientGetter()
    );
    const devFeeRecipientWETHBalance = await getERC20Balance(
      mockDevFeeRecipient
    );

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
    const order = await nftTakerPort.createBuyOrder({
      asset,
      accountAddress: nftTaker.address,
      startAmount: price,
      paymentTokenAddress: ERC20_TOKEN_ADDRESS,
    });

    const nftOwnerPort = new LandPort(
      provider,
      { network: configs.network },
      nftOwner.signer,
      (msg: any) => console.log(msg)
    );
    await nftOwnerPort.fulfillOrder({
      order,
      accountAddress: nftOwner.address,
    });

    // Assert NFT is transferred
    const nftOwnerAddress = await erc721Abi.ownerOf(
      EthBigNumber.from(ERC721_TOKEN_ID)
    );
    expect(nftOwnerAddress).toEqual(nftTaker.address);

    // Asset WETH is transferred
    const updatedNFTOwnerERC20Balance = await getERC20Balance(nftOwner.address);
    expect(updatedNFTOwnerERC20Balance).toBeCloseTo(
      nftOwnerERC20Balance + amount,
      3
    );
    const updatedOnelandFeeRecipientWETHBalance = await getERC20Balance(
      mockOnelandFeeRecipientGetter()
    );
    expect(updatedOnelandFeeRecipientWETHBalance).toBeCloseTo(
      onelandFeeRecipientWETHBalance + onelandFee,
      3
    );
    const updatedDevFeeRecipientWETHBalance = await getERC20Balance(
      mockDevFeeRecipient
    );
    expect(updatedDevFeeRecipientWETHBalance).toBeCloseTo(
      devFeeRecipientWETHBalance + devFee,
      3
    );
    const updatedNFTTakerERC20Balance = await getERC20Balance(nftTaker.address);
    expect(updatedNFTTakerERC20Balance).toBeCloseTo(
      nftTakerERC20Balance - amount - onelandFee - devFee,
      3
    );
  }, 600000 /*10 minutes timeout*/);
});
