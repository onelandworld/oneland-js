import {BigNumber, BigNumberish, BytesLike} from 'ethers';

export enum Network {
  Main = 'mainnet',
  Rinkeby = 'rinkeby',
}

/**
 * Wyvern fee method
 * ProtocolFee: Charge maker fee to seller and charge taker fee to buyer.
 * SplitFee: Maker fees are deducted from the token amount that the maker receives. Taker fees are extra tokens that must be paid by the taker.
 */
export enum FeeMethod {
  ProtocolFee = 0,
  SplitFee = 1,
}

export enum OrderSide {
  Buy = 0,
  Sell = 1,
}

export enum SaleKind {
  FixedPrice = 0,
  EnglishAuction = 1,
  DutchAuction = 2,
}

export interface ECSignature {
  v: number;
  r: string;
  s: string;
}

export interface WyvernOrder {
  registry: string;
  exchange: string;
  maker: string;
  staticTarget: string;
  staticSelector: string;
  staticExtradata: string;
  paymentToken: string;
  maximumFill: BigNumber;
  listingTime: BigNumber;
  expirationTime: BigNumber;
  salt: BigNumber;
}

export interface WyvernNFTAsset {
  id: string;
  address: string;
}
export interface WyvernFTAsset {
  id?: string;
  address: string;
  quantity: string;
}
export type WyvernAsset = WyvernNFTAsset | WyvernFTAsset;

// Abstractions over Wyvern assets for bundles
export interface WyvernBundle {
  assets: WyvernAsset[];
  schemas: WyvernSchemaName[];
  name?: string;
  description?: string;
  external_link?: string;
}

interface ExchangeMetadataForAsset {
  asset: WyvernAsset;
  schema: WyvernSchemaName;
  referrerAddress?: string;
}

interface ExchangeMetadataForBundle {
  bundle: WyvernBundle;
  referrerAddress?: string;
}

export type ExchangeMetadata =
  | ExchangeMetadataForAsset
  | ExchangeMetadataForBundle;

export interface UnhashedOrder extends WyvernOrder {
  feeMethod: FeeMethod;
  side: OrderSide;
  saleKind: SaleKind;
  quantity: BigNumber;

  metadata: ExchangeMetadata;
}

export interface UnsignedOrder extends UnhashedOrder {
  hash?: string;
}

export interface OneLandUser {
  username: string;
}

/**
 * The OneLand account object appended to orders, providing extra metadata, profile images and usernames
 */
export interface OneLandAccount {
  // Wallet address for this account
  address: string;

  // This account's profile image - by default, randomly generated by the server
  profileImgUrl?: string;

  // More information explicitly set by this account's owner on OneLand
  user?: OneLandUser;
}

export interface Token {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
}

/**
 * Full annotated Fungible Token spec with OneLand metadata
 */
export interface OneLandFungibleToken extends Token {
  imageUrl?: string;
  ethPrice?: string;
  usdPrice?: string;
}

/**
 * Orders don't need to be signed if they're pre-approved
 * with a transaction on the contract to approveOrder_
 */
export interface Order extends UnsignedOrder, Partial<ECSignature> {
  // Read-only server-side appends
  createdTime?: BigNumber;
  currentPrice?: BigNumber;
  makerAccount?: OneLandAccount;
  takerAccount?: OneLandAccount;

  paymentTokenContract?: OneLandFungibleToken;
  feeRecipientAccount?: OneLandAccount;
  cancelledOrFinalized?: boolean;
  markedInvalid?: boolean;
  nonce?: number;
}

export interface OneLandAPIConfig {
  network?: Network;
  apiKey?: string;
  apiBaseUrl?: string;
}

// Wyvern Schemas
export enum WyvernSchemaName {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC721v3 = 'ERC721v3',
  ERC1155 = 'ERC1155',
  // ENSShortNameAuction = 'ENSShortNameAuction',
}

/**
 * Simple, unannotated asset spec
 */
export interface Asset {
  // The asset's token ID, or null if ERC-20
  tokenId: string | null;
  // The asset's contract address
  tokenAddress: string;
  // The Wyvern schema name (e.g. "ERC721") for this asset
  schemaName?: WyvernSchemaName;
  // Optional for ENS names
  name?: string;
  // Optional for fungible items
  decimals?: number;
}

/**
 * The basis point values of each type of fee
 */
interface OneLandFees {
  // Fee for OneLand levied on sellers
  onelandSellerFeeBasisPoints: number;
  // Fee for OneLand levied on buyers
  onelandBuyerFeeBasisPoints: number;
  // Fee for the collection owner levied on sellers
  devSellerFeeBasisPoints: number;
  // Fee for the collection owner levied on buyers
  devBuyerFeeBasisPoints: number;
}

/**
 * Fully computed fees including bounties and transfer fees
 */
export interface ComputedFees extends OneLandFees {
  // Total fees. dev + oneland
  totalBuyerFeeBasisPoints: number;
  totalSellerFeeBasisPoints: number;

  // Fees that the item's creator takes on every transfer
  transferFee: BigNumber;
  transferFeeTokenAddress: string | null;

  // Fees that go to whoever refers the order to the taker.
  // Comes out of OneLand fees
  sellerBountyBasisPoints: number;
}

export type OneLandCollection = Partial<OneLandFees>;

export enum AssetContractType {
  Fungible = 'fungible',
  SemiFungible = 'semi-fungible',
  NonFungible = 'non-fungible',
  Unknown = 'unknown',
}

export interface OneLandAssetContract extends Partial<OneLandFees> {
  // Name of the asset's contract
  name: string;
  // Address of this contract
  address: string;
  // Type of token (fungible/NFT)
  type: AssetContractType;
  // Wyvern Schema Name for this contract
  schemaName: WyvernSchemaName;

  // Total fee levied on sellers by this contract, in basis points
  sellerFeeBasisPoints?: number;
  // Total fee levied on buyers by this contract, in basis points
  buyerFeeBasisPoints?: number;

  // Description of the contract
  description?: string;
  // Contract's Etherscan / OneLand symbol
  tokenSymbol?: string;
  // Image for the contract
  imageUrl?: string;
  // Object with stats about the contract
  stats?: object;
  // Array of trait types for the contract
  traits?: object[];
  // Link to the contract's main website
  externalLink?: string;
  // Link to the contract's wiki, if available
  wikiLink?: string;
}

export interface OneLandAsset extends Asset {
  assetContract: OneLandAssetContract;
  collection: OneLandCollection;
  // The asset's given name
  name: string;
  // Description of the asset
  description: string;
  // Owner of the asset
  owner: OneLandAccount;
  // Orders on the asset. Null if asset was fetched in a list
  orders: Order[] | null;
  // Buy orders (offers) on the asset. Null if asset in a list and didn't prefetch buy orders
  buyOrders: Order[] | null;
  // Sell orders (auctions) on the asset. Null if asset in a list and didn't prefetch sell orders
  sellOrders: Order[] | null;

  // Whether the asset is on a pre-sale (so token ids aren't real)
  isPresale: boolean;
  // The cached and size-optimized image url for this token
  imageUrl?: string;
  // The image preview url for this token.
  // Note: Loses gif animation and may have issues with SVGs
  imagePreviewUrl?: string;
  // The original image url for this token
  imageUrlOriginal?: string;
  // Thumbnail url for this token
  imageUrlThumbnail?: string;
  // Link to token on OneLand
  onelandLink?: string;
  // Link to token on dapp's site
  externalLink?: string;
  // Array of traits on this token
  traits?: object[];
  // Number of times this token has been traded (sold)
  numSales?: number;
  // Data about the last time this token was sold
  // lastSale: AssetEvent | null;
  // The suggested background color for the image url
  backgroundColor?: string | null;
  // The per-transfer fee, in base units, for this asset in its transfer method
  transferFee?: BigNumber | string | null;
  // The transfer fee token for this asset in its transfer method
  transferFeePaymentToken?: OneLandFungibleToken | null;
}

/**
 * Query interface for Fungible Assets
 */
export interface OneLandFungibleTokenQuery
  extends Partial<OneLandFungibleToken> {
  limit?: number;
  offset?: number;
  // Typescript bug requires this duplication
  symbol?: string;
}
