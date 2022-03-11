// tslint:disable:no-consecutive-blank-lines ordered-imports align trailing-comma enum-naming
// tslint:disable:whitespace no-unbound-method no-trailing-whitespace
// tslint:disable:no-unused-variable
import {
    AwaitTransactionSuccessOpts,
    EncoderOverrides,
    ContractFunctionObj,
    ContractTxFunctionObj,
    SendTransactionOpts,
    BaseContract,
    SubscriptionManager,PromiseWithTransactionHash,
    methodAbiToFunctionSignature,
    linkLibrariesInBytecode,
} from '@0x/base-contract';
import { schemas } from '@0x/json-schemas';
import {
    BlockParam,
    BlockParamLiteral,
    BlockRange,
    CallData,
    ContractAbi,
    ContractArtifact,
    DecodedLogArgs,
    LogWithDecodedArgs,
    MethodAbi,
    TransactionReceiptWithDecodedLogs,
    TxData,
    TxDataPayable,
    TxAccessListWithGas,
    SupportedProvider,
} from 'ethereum-types';
import { AbiEncoder, BigNumber, classUtils, EncodingRules, hexUtils, logUtils, providerUtils } from '@0x/utils';
import { EventCallback, IndexedFilterValues, SimpleContractArtifact } from '@0x/types';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { assert } from '@0x/assert';
import * as ethers from 'ethers';
// tslint:enable:no-unused-variable


export type WyvernExchangeEventArgs =
    | WyvernExchangeOrderApprovedEventArgs
    | WyvernExchangeOrderFillChangedEventArgs
    | WyvernExchangeOrdersMatchedEventArgs;

export enum WyvernExchangeEvents {
    OrderApproved = 'OrderApproved',
    OrderFillChanged = 'OrderFillChanged',
    OrdersMatched = 'OrdersMatched',
}

export interface WyvernExchangeOrderApprovedEventArgs extends DecodedLogArgs {
    hash: string;
    registry: string;
    maker: string;
    staticTarget: string;
    staticSelector: string;
    staticExtradata: string;
    maximumFill: BigNumber;
    listingTime: BigNumber;
    expirationTime: BigNumber;
    salt: BigNumber;
    orderbookInclusionDesired: boolean;
}

export interface WyvernExchangeOrderFillChangedEventArgs extends DecodedLogArgs {
    hash: string;
    maker: string;
    newFill: BigNumber;
}

export interface WyvernExchangeOrdersMatchedEventArgs extends DecodedLogArgs {
    firstHash: string;
    secondHash: string;
    firstMaker: string;
    secondMaker: string;
    newFirstFill: BigNumber;
    newSecondFill: BigNumber;
    metadata: string;
}


/* istanbul ignore next */
// tslint:disable:array-type
// tslint:disable:no-parameter-reassignment
// tslint:disable-next-line:class-name
export class WyvernExchangeContract extends BaseContract {
    /**
     * @ignore
     */
public static deployedBytecode: string | undefined;
public static contractName = 'WyvernExchange';
    private readonly _methodABIIndex: { [name: string]: number } = {};
private readonly _subscriptionManager: SubscriptionManager<WyvernExchangeEventArgs, WyvernExchangeEvents>;
public static async deployFrom0xArtifactAsync(
        artifact: ContractArtifact | SimpleContractArtifact,
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: (ContractArtifact | SimpleContractArtifact) },
            chainId: BigNumber,
            registryAddrs: string[],
            customPersonalSignPrefix: string,
    ): Promise<WyvernExchangeContract> {
        assert.doesConformToSchema('txDefaults', txDefaults, schemas.txDataSchema);
        if (artifact.compilerOutput === undefined) {
            throw new Error('Compiler output not found in the artifact file');
        }
        const provider = providerUtils.standardizeOrThrow(supportedProvider);
        const bytecode = artifact.compilerOutput.evm.bytecode.object;
        const abi = artifact.compilerOutput.abi;
        const logDecodeDependenciesAbiOnly: { [contractName: string]: ContractAbi } = {};
        if (Object.keys(logDecodeDependencies) !== undefined) {
            for (const key of Object.keys(logDecodeDependencies)) {
                logDecodeDependenciesAbiOnly[key] = logDecodeDependencies[key].compilerOutput.abi;
            }
        }
        return WyvernExchangeContract.deployAsync(bytecode, abi, provider, txDefaults, logDecodeDependenciesAbiOnly, chainId,
registryAddrs,
customPersonalSignPrefix
);
    }

    public static async deployWithLibrariesFrom0xArtifactAsync(
        artifact: ContractArtifact,
        libraryArtifacts: { [libraryName: string]: ContractArtifact },
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: (ContractArtifact | SimpleContractArtifact) },
            chainId: BigNumber,
            registryAddrs: string[],
            customPersonalSignPrefix: string,
    ): Promise<WyvernExchangeContract> {
        assert.doesConformToSchema('txDefaults', txDefaults, schemas.txDataSchema);
        if (artifact.compilerOutput === undefined) {
            throw new Error('Compiler output not found in the artifact file');
        }
        const provider = providerUtils.standardizeOrThrow(supportedProvider);
        const abi = artifact.compilerOutput.abi;
        const logDecodeDependenciesAbiOnly: { [contractName: string]: ContractAbi } = {};
        if (Object.keys(logDecodeDependencies) !== undefined) {
            for (const key of Object.keys(logDecodeDependencies)) {
                logDecodeDependenciesAbiOnly[key] = logDecodeDependencies[key].compilerOutput.abi;
            }
        }
        const libraryAddresses = await WyvernExchangeContract._deployLibrariesAsync(
            artifact,
            libraryArtifacts,
            new Web3Wrapper(provider),
            txDefaults
        );
        const bytecode = linkLibrariesInBytecode(
            artifact,
            libraryAddresses,
        );
        return WyvernExchangeContract.deployAsync(bytecode, abi, provider, txDefaults, logDecodeDependenciesAbiOnly, chainId,
registryAddrs,
customPersonalSignPrefix
);
    }

    public static async deployAsync(
        bytecode: string,
        abi: ContractAbi,
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: ContractAbi },
            chainId: BigNumber,
            registryAddrs: string[],
            customPersonalSignPrefix: string,
    ): Promise<WyvernExchangeContract> {
        assert.isHexString('bytecode', bytecode);
        assert.doesConformToSchema('txDefaults', txDefaults, schemas.txDataSchema);
        const provider = providerUtils.standardizeOrThrow(supportedProvider);
        const constructorAbi = BaseContract._lookupConstructorAbi(abi);
        [chainId,
registryAddrs,
customPersonalSignPrefix
] = BaseContract._formatABIDataItemList(
            constructorAbi.inputs,
            [chainId,
registryAddrs,
customPersonalSignPrefix
],
            BaseContract._bigNumberToString,
        );
        const iface = new ethers.utils.Interface(abi);
        const deployInfo = iface.deployFunction;
        const txData = deployInfo.encode(bytecode, [chainId,
registryAddrs,
customPersonalSignPrefix
]);
        const web3Wrapper = new Web3Wrapper(provider);
        const txDataWithDefaults = await BaseContract._applyDefaultsToContractTxDataAsync(
            {
                data: txData,
                ...txDefaults,
            },
            web3Wrapper.estimateGasAsync.bind(web3Wrapper),
        );
        const txHash = await web3Wrapper.sendTransactionAsync(txDataWithDefaults);
        logUtils.log(`transactionHash: ${txHash}`);
        const txReceipt = await web3Wrapper.awaitTransactionSuccessAsync(txHash);
        logUtils.log(`WyvernExchange successfully deployed at ${txReceipt.contractAddress}`);
        const contractInstance = new WyvernExchangeContract(txReceipt.contractAddress as string, provider, txDefaults, logDecodeDependencies);
        contractInstance.constructorArgs = [chainId,
registryAddrs,
customPersonalSignPrefix
];
        return contractInstance;
    }

    /**
     * @returns      The contract ABI
     */
    public static ABI(): ContractAbi {
        const abi = [
            { 
                inputs: [
                    {
                        name: 'chainId',
                        type: 'uint256',
                    },
                    {
                        name: 'registryAddrs',
                        type: 'address[]',
                    },
                    {
                        name: 'customPersonalSignPrefix',
                        type: 'bytes',
                    },
                ],
                outputs: [
                ],
                stateMutability: 'nonpayable',
                type: 'constructor',
            },
            { 
                anonymous: false,
                inputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                        indexed: true,
                    },
                    {
                        name: 'registry',
                        type: 'address',
                        indexed: false,
                    },
                    {
                        name: 'maker',
                        type: 'address',
                        indexed: true,
                    },
                    {
                        name: 'staticTarget',
                        type: 'address',
                        indexed: false,
                    },
                    {
                        name: 'staticSelector',
                        type: 'bytes4',
                        indexed: false,
                    },
                    {
                        name: 'staticExtradata',
                        type: 'bytes',
                        indexed: false,
                    },
                    {
                        name: 'maximumFill',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'listingTime',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'expirationTime',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'salt',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'orderbookInclusionDesired',
                        type: 'bool',
                        indexed: false,
                    },
                ],
                name: 'OrderApproved',
                outputs: [
                ],
                type: 'event',
            },
            { 
                anonymous: false,
                inputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                        indexed: true,
                    },
                    {
                        name: 'maker',
                        type: 'address',
                        indexed: true,
                    },
                    {
                        name: 'newFill',
                        type: 'uint256',
                        indexed: false,
                    },
                ],
                name: 'OrderFillChanged',
                outputs: [
                ],
                type: 'event',
            },
            { 
                anonymous: false,
                inputs: [
                    {
                        name: 'firstHash',
                        type: 'bytes32',
                        indexed: false,
                    },
                    {
                        name: 'secondHash',
                        type: 'bytes32',
                        indexed: false,
                    },
                    {
                        name: 'firstMaker',
                        type: 'address',
                        indexed: true,
                    },
                    {
                        name: 'secondMaker',
                        type: 'address',
                        indexed: true,
                    },
                    {
                        name: 'newFirstFill',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'newSecondFill',
                        type: 'uint256',
                        indexed: false,
                    },
                    {
                        name: 'metadata',
                        type: 'bytes32',
                        indexed: true,
                    },
                ],
                name: 'OrdersMatched',
                outputs: [
                ],
                type: 'event',
            },
            { 
                inputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                    },
                ],
                name: 'approveOrderHash_',
                outputs: [
                ],
                stateMutability: 'nonpayable',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'registry',
                        type: 'address',
                    },
                    {
                        name: 'maker',
                        type: 'address',
                    },
                    {
                        name: 'staticTarget',
                        type: 'address',
                    },
                    {
                        name: 'staticSelector',
                        type: 'bytes4',
                    },
                    {
                        name: 'staticExtradata',
                        type: 'bytes',
                    },
                    {
                        name: 'maximumFill',
                        type: 'uint256',
                    },
                    {
                        name: 'listingTime',
                        type: 'uint256',
                    },
                    {
                        name: 'expirationTime',
                        type: 'uint256',
                    },
                    {
                        name: 'salt',
                        type: 'uint256',
                    },
                    {
                        name: 'orderbookInclusionDesired',
                        type: 'bool',
                    },
                ],
                name: 'approveOrder_',
                outputs: [
                ],
                stateMutability: 'nonpayable',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'address',
                    },
                    {
                        name: 'index_1',
                        type: 'bytes32',
                    },
                ],
                name: 'approved',
                outputs: [
                    {
                        name: '',
                        type: 'bool',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'uints',
                        type: 'uint256[16]',
                    },
                    {
                        name: 'staticSelectors',
                        type: 'bytes4[2]',
                    },
                    {
                        name: 'firstExtradata',
                        type: 'bytes',
                    },
                    {
                        name: 'firstCalldata',
                        type: 'bytes',
                    },
                    {
                        name: 'secondExtradata',
                        type: 'bytes',
                    },
                    {
                        name: 'secondCalldata',
                        type: 'bytes',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'metadata',
                        type: 'bytes32',
                    },
                    {
                        name: 'signatures',
                        type: 'bytes',
                    },
                ],
                name: 'atomicMatch_',
                outputs: [
                ],
                stateMutability: 'payable',
                type: 'function',
            },
            { 
                inputs: [
                ],
                name: 'codename',
                outputs: [
                    {
                        name: '',
                        type: 'string',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'address',
                    },
                    {
                        name: 'index_1',
                        type: 'bytes32',
                    },
                ],
                name: 'fills',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'registry',
                        type: 'address',
                    },
                    {
                        name: 'maker',
                        type: 'address',
                    },
                    {
                        name: 'staticTarget',
                        type: 'address',
                    },
                    {
                        name: 'staticSelector',
                        type: 'bytes4',
                    },
                    {
                        name: 'staticExtradata',
                        type: 'bytes',
                    },
                    {
                        name: 'maximumFill',
                        type: 'uint256',
                    },
                    {
                        name: 'listingTime',
                        type: 'uint256',
                    },
                    {
                        name: 'expirationTime',
                        type: 'uint256',
                    },
                    {
                        name: 'salt',
                        type: 'uint256',
                    },
                ],
                name: 'hashOrder_',
                outputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'orderHash',
                        type: 'bytes32',
                    },
                ],
                name: 'hashToSign_',
                outputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                ],
                name: 'name',
                outputs: [
                    {
                        name: '',
                        type: 'string',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'address',
                    },
                ],
                name: 'registries',
                outputs: [
                    {
                        name: '',
                        type: 'bool',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                    },
                    {
                        name: 'fill',
                        type: 'uint256',
                    },
                ],
                name: 'setOrderFill_',
                outputs: [
                ],
                stateMutability: 'nonpayable',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'hash',
                        type: 'bytes32',
                    },
                    {
                        name: 'maker',
                        type: 'address',
                    },
                    {
                        name: 'signature',
                        type: 'bytes',
                    },
                ],
                name: 'validateOrderAuthorization_',
                outputs: [
                    {
                        name: '',
                        type: 'bool',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'registry',
                        type: 'address',
                    },
                    {
                        name: 'maker',
                        type: 'address',
                    },
                    {
                        name: 'staticTarget',
                        type: 'address',
                    },
                    {
                        name: 'staticSelector',
                        type: 'bytes4',
                    },
                    {
                        name: 'staticExtradata',
                        type: 'bytes',
                    },
                    {
                        name: 'maximumFill',
                        type: 'uint256',
                    },
                    {
                        name: 'listingTime',
                        type: 'uint256',
                    },
                    {
                        name: 'expirationTime',
                        type: 'uint256',
                    },
                    {
                        name: 'salt',
                        type: 'uint256',
                    },
                ],
                name: 'validateOrderParameters_',
                outputs: [
                    {
                        name: '',
                        type: 'bool',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                ],
                name: 'version',
                outputs: [
                    {
                        name: '',
                        type: 'string',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
        ] as ContractAbi;
        return abi;
    }

    protected static async _deployLibrariesAsync(
        artifact: ContractArtifact,
        libraryArtifacts: { [libraryName: string]: ContractArtifact },
        web3Wrapper: Web3Wrapper,
        txDefaults: Partial<TxData>,
        libraryAddresses: { [libraryName: string]: string } = {},
    ): Promise<{ [libraryName: string]: string }> {
        const links = artifact.compilerOutput.evm.bytecode.linkReferences;
        // Go through all linked libraries, recursively deploying them if necessary.
        for (const link of Object.values(links)) {
            for (const libraryName of Object.keys(link)) {
                if (!libraryAddresses[libraryName]) {
                    // Library not yet deployed.
                    const libraryArtifact = libraryArtifacts[libraryName];
                    if (!libraryArtifact) {
                        throw new Error(`Missing artifact for linked library "${libraryName}"`);
                    }
                    // Deploy any dependent libraries used by this library.
                    await WyvernExchangeContract._deployLibrariesAsync(
                        libraryArtifact,
                        libraryArtifacts,
                        web3Wrapper,
                        txDefaults,
                        libraryAddresses,
                    );
                    // Deploy this library.
                    const linkedLibraryBytecode = linkLibrariesInBytecode(
                        libraryArtifact,
                        libraryAddresses,
                    );
                    const txDataWithDefaults = await BaseContract._applyDefaultsToContractTxDataAsync(
                        {
                            data: linkedLibraryBytecode,
                            ...txDefaults,
                        },
                        web3Wrapper.estimateGasAsync.bind(web3Wrapper),
                    );
                    const txHash = await web3Wrapper.sendTransactionAsync(txDataWithDefaults);
                    logUtils.log(`transactionHash: ${txHash}`);
                    const { contractAddress } = await web3Wrapper.awaitTransactionSuccessAsync(txHash);
                    logUtils.log(`${libraryArtifact.contractName} successfully deployed at ${contractAddress}`);
                    libraryAddresses[libraryArtifact.contractName] = contractAddress as string;
                }
            }
        }
        return libraryAddresses;
    }

    public getFunctionSignature(methodName: string): string {
        const index = this._methodABIIndex[methodName];
        const methodAbi = WyvernExchangeContract.ABI()[index] as MethodAbi; // tslint:disable-line:no-unnecessary-type-assertion
        const functionSignature = methodAbiToFunctionSignature(methodAbi);
        return functionSignature;
    }

    public getABIDecodedTransactionData<T>(methodName: string, callData: string): T {
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernExchangeContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        const abiDecodedCallData = abiEncoder.strictDecode<T>(callData);
        return abiDecodedCallData;
    }

    public getABIDecodedReturnData<T>(methodName: string, callData: string): T {
        if (this._encoderOverrides.decodeOutput) {
            return this._encoderOverrides.decodeOutput(methodName, callData);
        }
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernExchangeContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        const abiDecodedCallData = abiEncoder.strictDecodeReturnValue<T>(callData);
        return abiDecodedCallData;
    }

    public getSelector(methodName: string): string {
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernExchangeContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        return abiEncoder.getSelector();
    }

    public approveOrderHash_(
            hash: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('hash', hash);
        const functionSignature = 'approveOrderHash_(bytes32)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<void
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [hash
            ]);
            },
        };
    }
    public approveOrder_(
            registry: string,
            maker: string,
            staticTarget: string,
            staticSelector: string,
            staticExtradata: string,
            maximumFill: BigNumber,
            listingTime: BigNumber,
            expirationTime: BigNumber,
            salt: BigNumber,
            orderbookInclusionDesired: boolean,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('registry', registry);
            assert.isString('maker', maker);
            assert.isString('staticTarget', staticTarget);
            assert.isString('staticSelector', staticSelector);
            assert.isString('staticExtradata', staticExtradata);
            assert.isBigNumber('maximumFill', maximumFill);
            assert.isBigNumber('listingTime', listingTime);
            assert.isBigNumber('expirationTime', expirationTime);
            assert.isBigNumber('salt', salt);
            assert.isBoolean('orderbookInclusionDesired', orderbookInclusionDesired);
        const functionSignature = 'approveOrder_(address,address,address,bytes4,bytes,uint256,uint256,uint256,uint256,bool)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<void
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [registry.toLowerCase(),
            maker.toLowerCase(),
            staticTarget.toLowerCase(),
            staticSelector,
            staticExtradata,
            maximumFill,
            listingTime,
            expirationTime,
            salt,
            orderbookInclusionDesired
            ]);
            },
        };
    }
    public approved(
            index_0: string,
            index_1: string,
    ): ContractTxFunctionObj<boolean
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('index_0', index_0);
            assert.isString('index_1', index_1);
        const functionSignature = 'approved(address,bytes32)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<boolean
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<boolean
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0.toLowerCase(),
            index_1
            ]);
            },
        };
    }
    public atomicMatch_(
            uints: BigNumber[],
            staticSelectors: string[],
            firstExtradata: string,
            firstCalldata: string,
            secondExtradata: string,
            secondCalldata: string,
            howToCalls: Array<number|BigNumber>,
            metadata: string,
            signatures: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernExchangeContract;
            assert.isArray('uints', uints);
            assert.isArray('staticSelectors', staticSelectors);
            assert.isString('firstExtradata', firstExtradata);
            assert.isString('firstCalldata', firstCalldata);
            assert.isString('secondExtradata', secondExtradata);
            assert.isString('secondCalldata', secondCalldata);
            assert.isArray('howToCalls', howToCalls);
            assert.isString('metadata', metadata);
            assert.isString('signatures', signatures);
        const functionSignature = 'atomicMatch_(uint256[16],bytes4[2],bytes,bytes,bytes,bytes,uint8[2],bytes32,bytes)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<void
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [uints,
            staticSelectors,
            firstExtradata,
            firstCalldata,
            secondExtradata,
            secondCalldata,
            howToCalls,
            metadata,
            signatures
            ]);
            },
        };
    }
    public codename(
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernExchangeContract;
        const functionSignature = 'codename()';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<string
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<string
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, []);
            },
        };
    }
    public fills(
            index_0: string,
            index_1: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('index_0', index_0);
            assert.isString('index_1', index_1);
        const functionSignature = 'fills(address,bytes32)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<BigNumber
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0.toLowerCase(),
            index_1
            ]);
            },
        };
    }
    public hashOrder_(
            registry: string,
            maker: string,
            staticTarget: string,
            staticSelector: string,
            staticExtradata: string,
            maximumFill: BigNumber,
            listingTime: BigNumber,
            expirationTime: BigNumber,
            salt: BigNumber,
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('registry', registry);
            assert.isString('maker', maker);
            assert.isString('staticTarget', staticTarget);
            assert.isString('staticSelector', staticSelector);
            assert.isString('staticExtradata', staticExtradata);
            assert.isBigNumber('maximumFill', maximumFill);
            assert.isBigNumber('listingTime', listingTime);
            assert.isBigNumber('expirationTime', expirationTime);
            assert.isBigNumber('salt', salt);
        const functionSignature = 'hashOrder_(address,address,address,bytes4,bytes,uint256,uint256,uint256,uint256)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<string
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<string
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [registry.toLowerCase(),
            maker.toLowerCase(),
            staticTarget.toLowerCase(),
            staticSelector,
            staticExtradata,
            maximumFill,
            listingTime,
            expirationTime,
            salt
            ]);
            },
        };
    }
    public hashToSign_(
            orderHash: string,
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('orderHash', orderHash);
        const functionSignature = 'hashToSign_(bytes32)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<string
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<string
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [orderHash
            ]);
            },
        };
    }
    public name(
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernExchangeContract;
        const functionSignature = 'name()';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<string
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<string
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, []);
            },
        };
    }
    public registries(
            index_0: string,
    ): ContractTxFunctionObj<boolean
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('index_0', index_0);
        const functionSignature = 'registries(address)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<boolean
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<boolean
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0.toLowerCase()
            ]);
            },
        };
    }
    public setOrderFill_(
            hash: string,
            fill: BigNumber,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('hash', hash);
            assert.isBigNumber('fill', fill);
        const functionSignature = 'setOrderFill_(bytes32,uint256)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<void
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [hash,
            fill
            ]);
            },
        };
    }
    public validateOrderAuthorization_(
            hash: string,
            maker: string,
            signature: string,
    ): ContractTxFunctionObj<boolean
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('hash', hash);
            assert.isString('maker', maker);
            assert.isString('signature', signature);
        const functionSignature = 'validateOrderAuthorization_(bytes32,address,bytes)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<boolean
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<boolean
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [hash,
            maker.toLowerCase(),
            signature
            ]);
            },
        };
    }
    public validateOrderParameters_(
            registry: string,
            maker: string,
            staticTarget: string,
            staticSelector: string,
            staticExtradata: string,
            maximumFill: BigNumber,
            listingTime: BigNumber,
            expirationTime: BigNumber,
            salt: BigNumber,
    ): ContractTxFunctionObj<boolean
> {
        const self = this as any as WyvernExchangeContract;
            assert.isString('registry', registry);
            assert.isString('maker', maker);
            assert.isString('staticTarget', staticTarget);
            assert.isString('staticSelector', staticSelector);
            assert.isString('staticExtradata', staticExtradata);
            assert.isBigNumber('maximumFill', maximumFill);
            assert.isBigNumber('listingTime', listingTime);
            assert.isBigNumber('expirationTime', expirationTime);
            assert.isBigNumber('salt', salt);
        const functionSignature = 'validateOrderParameters_(address,address,address,bytes4,bytes,uint256,uint256,uint256,uint256)';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<boolean
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<boolean
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [registry.toLowerCase(),
            maker.toLowerCase(),
            staticTarget.toLowerCase(),
            staticSelector,
            staticExtradata,
            maximumFill,
            listingTime,
            expirationTime,
            salt
            ]);
            },
        };
    }
    public version(
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernExchangeContract;
        const functionSignature = 'version()';
        const selector = self._lookupAbiEncoder(functionSignature).getSelector();

        return {
            selector,
            async sendTransactionAsync(
                txData?: Partial<TxData> | undefined,
                opts: SendTransactionOpts = { shouldValidate: true },
            ): Promise<string> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData },
                    this.estimateGasAsync.bind(this),
                );
                if (opts.shouldValidate !== false) {
                    await this.callAsync(txDataWithDefaults);
                }
                return self._web3Wrapper.sendTransactionAsync(txDataWithDefaults);
            },
            awaitTransactionSuccessAsync(
                txData?: Partial<TxData>,
                opts: AwaitTransactionSuccessOpts = { shouldValidate: true },
            ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
                return self._promiseWithTransactionHash(this.sendTransactionAsync(txData, opts), opts);
            },
            async estimateGasAsync(
                txData?: Partial<TxData> | undefined,
            ): Promise<number> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.estimateGasAsync(txDataWithDefaults);
            },
            async createAccessListAsync(
                txData?: Partial<TxData> | undefined,
                defaultBlock?: BlockParam,
            ): Promise<TxAccessListWithGas> {
                const txDataWithDefaults = await self._applyDefaultsToTxDataAsync(
                    { data: this.getABIEncodedTransactionData(), ...txData }
                );
                return self._web3Wrapper.createAccessListAsync(txDataWithDefaults, defaultBlock);
            },
            async callAsync(
                callData: Partial<CallData> = {},
                defaultBlock?: BlockParam,
            ): Promise<string
            > {
                BaseContract._assertCallParams(callData, defaultBlock);
                const rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<string
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, []);
            },
        };
    }

    /**
     * Subscribe to an event type emitted by the WyvernExchange contract.
     * @param eventName The WyvernExchange contract event you would like to subscribe to.
     * @param indexFilterValues An object where the keys are indexed args returned by the event and
     * the value is the value you are interested in. E.g `{maker: aUserAddressHex}`
     * @param callback Callback that gets called when a log is added/removed
     * @param isVerbose Enable verbose subscription warnings (e.g recoverable network issues encountered)
     * @return Subscription token used later to unsubscribe
     */
    public subscribe<ArgsType extends WyvernExchangeEventArgs>(
        eventName: WyvernExchangeEvents,
        indexFilterValues: IndexedFilterValues,
        callback: EventCallback<ArgsType>,
        isVerbose: boolean = false,
        blockPollingIntervalMs?: number,
    ): string {
        assert.doesBelongToStringEnum('eventName', eventName, WyvernExchangeEvents);
        assert.doesConformToSchema('indexFilterValues', indexFilterValues, schemas.indexFilterValuesSchema);
        assert.isFunction('callback', callback);
        const subscriptionToken = this._subscriptionManager.subscribe<ArgsType>(
            this.address,
            eventName,
            indexFilterValues,
            WyvernExchangeContract.ABI(),
            callback,
            isVerbose,
            blockPollingIntervalMs,
        );
        return subscriptionToken;
    }

    /**
     * Cancel a subscription
     * @param subscriptionToken Subscription token returned by `subscribe()`
     */
    public unsubscribe(subscriptionToken: string): void {
        this._subscriptionManager.unsubscribe(subscriptionToken);
    }

    /**
     * Cancels all existing subscriptions
     */
    public unsubscribeAll(): void {
        this._subscriptionManager.unsubscribeAll();
    }

    /**
     * Gets historical logs without creating a subscription
     * @param eventName The WyvernExchange contract event you would like to subscribe to.
     * @param blockRange Block range to get logs from.
     * @param indexFilterValues An object where the keys are indexed args returned by the event and
     * the value is the value you are interested in. E.g `{_from: aUserAddressHex}`
     * @return Array of logs that match the parameters
     */
    public async getLogsAsync<ArgsType extends WyvernExchangeEventArgs>(
        eventName: WyvernExchangeEvents,
        blockRange: BlockRange,
        indexFilterValues: IndexedFilterValues,
    ): Promise<Array<LogWithDecodedArgs<ArgsType>>> {
        assert.doesBelongToStringEnum('eventName', eventName, WyvernExchangeEvents);
        assert.doesConformToSchema('blockRange', blockRange, schemas.blockRangeSchema);
        assert.doesConformToSchema('indexFilterValues', indexFilterValues, schemas.indexFilterValuesSchema);
        const logs = await this._subscriptionManager.getLogsAsync<ArgsType>(
            this.address,
            eventName,
            blockRange,
            indexFilterValues,
            WyvernExchangeContract.ABI(),
        );
        return logs;
    }

    constructor(
        address: string,
        supportedProvider: SupportedProvider,
        txDefaults?: Partial<TxData>,
        logDecodeDependencies?: { [contractName: string]: ContractAbi },
        deployedBytecode: string | undefined = WyvernExchangeContract.deployedBytecode,
        encoderOverrides?: Partial<EncoderOverrides>,
    ) {
        super('WyvernExchange', WyvernExchangeContract.ABI(), address, supportedProvider, txDefaults, logDecodeDependencies, deployedBytecode, encoderOverrides);
        classUtils.bindAll(this, ['_abiEncoderByFunctionSignature', 'address', '_web3Wrapper']);
this._subscriptionManager = new SubscriptionManager<WyvernExchangeEventArgs, WyvernExchangeEvents>(
            WyvernExchangeContract.ABI(),
            this._web3Wrapper,
        );
WyvernExchangeContract.ABI().forEach((item, index) => {
            if (item.type === 'function') {
                const methodAbi = item as MethodAbi;
                this._methodABIIndex[methodAbi.name] = index;
            }
        });
    }
}

// tslint:disable:max-file-line-count
// tslint:enable:no-unbound-method no-parameter-reassignment no-consecutive-blank-lines ordered-imports align
// tslint:enable:trailing-comma whitespace no-trailing-whitespace
