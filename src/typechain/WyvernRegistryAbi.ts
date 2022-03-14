/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface WyvernRegistryAbiInterface extends utils.Interface {
  contractName: "WyvernRegistryAbi";
  functions: {
    "DELAY_PERIOD()": FunctionFragment;
    "contracts(address)": FunctionFragment;
    "delegateProxyImplementation()": FunctionFragment;
    "endGrantAuthentication(address)": FunctionFragment;
    "grantInitialAuthentication(address)": FunctionFragment;
    "initialAddressSet()": FunctionFragment;
    "name()": FunctionFragment;
    "owner()": FunctionFragment;
    "pending(address)": FunctionFragment;
    "proxies(address)": FunctionFragment;
    "registerProxy()": FunctionFragment;
    "registerProxyFor(address)": FunctionFragment;
    "registerProxyOverride()": FunctionFragment;
    "renounceOwnership()": FunctionFragment;
    "revokeAuthentication(address)": FunctionFragment;
    "startGrantAuthentication(address)": FunctionFragment;
    "transferAccessTo(address,address)": FunctionFragment;
    "transferOwnership(address)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "DELAY_PERIOD",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "contracts", values: [string]): string;
  encodeFunctionData(
    functionFragment: "delegateProxyImplementation",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "endGrantAuthentication",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "grantInitialAuthentication",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "initialAddressSet",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "name", values?: undefined): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(functionFragment: "pending", values: [string]): string;
  encodeFunctionData(functionFragment: "proxies", values: [string]): string;
  encodeFunctionData(
    functionFragment: "registerProxy",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "registerProxyFor",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "registerProxyOverride",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "revokeAuthentication",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "startGrantAuthentication",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "transferAccessTo",
    values: [string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [string]
  ): string;

  decodeFunctionResult(
    functionFragment: "DELAY_PERIOD",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "contracts", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "delegateProxyImplementation",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "endGrantAuthentication",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "grantInitialAuthentication",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "initialAddressSet",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "name", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "pending", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "proxies", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "registerProxy",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "registerProxyFor",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "registerProxyOverride",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "revokeAuthentication",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "startGrantAuthentication",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferAccessTo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;

  events: {
    "OwnershipTransferred(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "OwnershipTransferred"): EventFragment;
}

export type OwnershipTransferredEvent = TypedEvent<
  [string, string],
  { previousOwner: string; newOwner: string }
>;

export type OwnershipTransferredEventFilter =
  TypedEventFilter<OwnershipTransferredEvent>;

export interface WyvernRegistryAbi extends BaseContract {
  contractName: "WyvernRegistryAbi";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: WyvernRegistryAbiInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    DELAY_PERIOD(overrides?: CallOverrides): Promise<[BigNumber]>;

    contracts(arg0: string, overrides?: CallOverrides): Promise<[boolean]>;

    delegateProxyImplementation(overrides?: CallOverrides): Promise<[string]>;

    endGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    grantInitialAuthentication(
      authAddress: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    initialAddressSet(overrides?: CallOverrides): Promise<[boolean]>;

    name(overrides?: CallOverrides): Promise<[string]>;

    owner(overrides?: CallOverrides): Promise<[string]>;

    pending(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;

    proxies(arg0: string, overrides?: CallOverrides): Promise<[string]>;

    registerProxy(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    registerProxyFor(
      user: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    registerProxyOverride(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    renounceOwnership(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    revokeAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    startGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    transferAccessTo(
      from: string,
      to: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  DELAY_PERIOD(overrides?: CallOverrides): Promise<BigNumber>;

  contracts(arg0: string, overrides?: CallOverrides): Promise<boolean>;

  delegateProxyImplementation(overrides?: CallOverrides): Promise<string>;

  endGrantAuthentication(
    addr: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  grantInitialAuthentication(
    authAddress: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  initialAddressSet(overrides?: CallOverrides): Promise<boolean>;

  name(overrides?: CallOverrides): Promise<string>;

  owner(overrides?: CallOverrides): Promise<string>;

  pending(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

  proxies(arg0: string, overrides?: CallOverrides): Promise<string>;

  registerProxy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  registerProxyFor(
    user: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  registerProxyOverride(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  renounceOwnership(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  revokeAuthentication(
    addr: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  startGrantAuthentication(
    addr: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  transferAccessTo(
    from: string,
    to: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  transferOwnership(
    newOwner: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    DELAY_PERIOD(overrides?: CallOverrides): Promise<BigNumber>;

    contracts(arg0: string, overrides?: CallOverrides): Promise<boolean>;

    delegateProxyImplementation(overrides?: CallOverrides): Promise<string>;

    endGrantAuthentication(
      addr: string,
      overrides?: CallOverrides
    ): Promise<void>;

    grantInitialAuthentication(
      authAddress: string,
      overrides?: CallOverrides
    ): Promise<void>;

    initialAddressSet(overrides?: CallOverrides): Promise<boolean>;

    name(overrides?: CallOverrides): Promise<string>;

    owner(overrides?: CallOverrides): Promise<string>;

    pending(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    proxies(arg0: string, overrides?: CallOverrides): Promise<string>;

    registerProxy(overrides?: CallOverrides): Promise<string>;

    registerProxyFor(user: string, overrides?: CallOverrides): Promise<string>;

    registerProxyOverride(overrides?: CallOverrides): Promise<string>;

    renounceOwnership(overrides?: CallOverrides): Promise<void>;

    revokeAuthentication(
      addr: string,
      overrides?: CallOverrides
    ): Promise<void>;

    startGrantAuthentication(
      addr: string,
      overrides?: CallOverrides
    ): Promise<void>;

    transferAccessTo(
      from: string,
      to: string,
      overrides?: CallOverrides
    ): Promise<void>;

    transferOwnership(
      newOwner: string,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "OwnershipTransferred(address,address)"(
      previousOwner?: string | null,
      newOwner?: string | null
    ): OwnershipTransferredEventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): OwnershipTransferredEventFilter;
  };

  estimateGas: {
    DELAY_PERIOD(overrides?: CallOverrides): Promise<BigNumber>;

    contracts(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    delegateProxyImplementation(overrides?: CallOverrides): Promise<BigNumber>;

    endGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    grantInitialAuthentication(
      authAddress: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    initialAddressSet(overrides?: CallOverrides): Promise<BigNumber>;

    name(overrides?: CallOverrides): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    pending(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    proxies(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    registerProxy(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    registerProxyFor(
      user: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    registerProxyOverride(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    renounceOwnership(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    revokeAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    startGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    transferAccessTo(
      from: string,
      to: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    DELAY_PERIOD(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    contracts(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    delegateProxyImplementation(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    endGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    grantInitialAuthentication(
      authAddress: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    initialAddressSet(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    name(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    pending(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    proxies(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    registerProxy(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    registerProxyFor(
      user: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    registerProxyOverride(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    renounceOwnership(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    revokeAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    startGrantAuthentication(
      addr: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    transferAccessTo(
      from: string,
      to: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    transferOwnership(
      newOwner: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}