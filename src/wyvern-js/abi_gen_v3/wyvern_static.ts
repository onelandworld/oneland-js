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
    PromiseWithTransactionHash,
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



/* istanbul ignore next */
// tslint:disable:array-type
// tslint:disable:no-parameter-reassignment
// tslint:disable-next-line:class-name
export class WyvernStaticContract extends BaseContract {
    /**
     * @ignore
     */
public static deployedBytecode: string | undefined;
public static contractName = 'WyvernStatic';
    private readonly _methodABIIndex: { [name: string]: number } = {};
public static async deployFrom0xArtifactAsync(
        artifact: ContractArtifact | SimpleContractArtifact,
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: (ContractArtifact | SimpleContractArtifact) },
            atomicizerAddress: string,
    ): Promise<WyvernStaticContract> {
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
        return WyvernStaticContract.deployAsync(bytecode, abi, provider, txDefaults, logDecodeDependenciesAbiOnly, atomicizerAddress
);
    }

    public static async deployWithLibrariesFrom0xArtifactAsync(
        artifact: ContractArtifact,
        libraryArtifacts: { [libraryName: string]: ContractArtifact },
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: (ContractArtifact | SimpleContractArtifact) },
            atomicizerAddress: string,
    ): Promise<WyvernStaticContract> {
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
        const libraryAddresses = await WyvernStaticContract._deployLibrariesAsync(
            artifact,
            libraryArtifacts,
            new Web3Wrapper(provider),
            txDefaults
        );
        const bytecode = linkLibrariesInBytecode(
            artifact,
            libraryAddresses,
        );
        return WyvernStaticContract.deployAsync(bytecode, abi, provider, txDefaults, logDecodeDependenciesAbiOnly, atomicizerAddress
);
    }

    public static async deployAsync(
        bytecode: string,
        abi: ContractAbi,
        supportedProvider: SupportedProvider,
        txDefaults: Partial<TxData>,
        logDecodeDependencies: { [contractName: string]: ContractAbi },
            atomicizerAddress: string,
    ): Promise<WyvernStaticContract> {
        assert.isHexString('bytecode', bytecode);
        assert.doesConformToSchema('txDefaults', txDefaults, schemas.txDataSchema);
        const provider = providerUtils.standardizeOrThrow(supportedProvider);
        const constructorAbi = BaseContract._lookupConstructorAbi(abi);
        [atomicizerAddress
] = BaseContract._formatABIDataItemList(
            constructorAbi.inputs,
            [atomicizerAddress
],
            BaseContract._bigNumberToString,
        );
        const iface = new ethers.utils.Interface(abi);
        const deployInfo = iface.deployFunction;
        const txData = deployInfo.encode(bytecode, [atomicizerAddress
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
        logUtils.log(`WyvernStatic successfully deployed at ${txReceipt.contractAddress}`);
        const contractInstance = new WyvernStaticContract(txReceipt.contractAddress as string, provider, txDefaults, logDecodeDependencies);
        contractInstance.constructorArgs = [atomicizerAddress
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
                        name: 'atomicizerAddress',
                        type: 'address',
                    },
                ],
                outputs: [
                ],
                stateMutability: 'nonpayable',
                type: 'constructor',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'and',
                outputs: [
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'bytes',
                    },
                    {
                        name: 'index_1',
                        type: 'address[7]',
                    },
                    {
                        name: 'index_2',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'index_4',
                        type: 'bytes',
                    },
                    {
                        name: 'index_5',
                        type: 'bytes',
                    },
                ],
                name: 'any',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'bytes',
                    },
                    {
                        name: 'index_1',
                        type: 'address[7]',
                    },
                    {
                        name: 'index_2',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'index_4',
                        type: 'bytes',
                    },
                    {
                        name: 'index_5',
                        type: 'bytes',
                    },
                ],
                name: 'anyAddOne',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'bytes',
                    },
                    {
                        name: 'index_1',
                        type: 'address[7]',
                    },
                    {
                        name: 'index_2',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'index_4',
                        type: 'bytes',
                    },
                    {
                        name: 'index_5',
                        type: 'bytes',
                    },
                ],
                name: 'anyNoFill',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'index_0',
                        type: 'bytes',
                    },
                    {
                        name: 'index_1',
                        type: 'address[7]',
                    },
                    {
                        name: 'index_2',
                        type: 'uint8',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'index_4',
                        type: 'bytes',
                    },
                ],
                name: 'anySingle',
                outputs: [
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                ],
                name: 'atomicizer',
                outputs: [
                    {
                        name: '',
                        type: 'address',
                    },
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'cdata',
                        type: 'bytes',
                    },
                    {
                        name: 'index_5',
                        type: 'bytes',
                    },
                ],
                name: 'dumbSequenceExact',
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
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'or',
                outputs: [
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCall',
                        type: 'uint8',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'cdata',
                        type: 'bytes',
                    },
                ],
                name: 'sequenceAnyAfter',
                outputs: [
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCall',
                        type: 'uint8',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'cdata',
                        type: 'bytes',
                    },
                ],
                name: 'sequenceExact',
                outputs: [
                ],
                stateMutability: 'view',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'split',
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
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'splitAddOne',
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
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapExact',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapForever',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapOneForOneERC1155',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapOneForOneERC1155Decoding',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapOneForOneERC721',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCalls',
                        type: 'uint8[2]',
                    },
                    {
                        name: 'uints',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                    {
                        name: 'counterdata',
                        type: 'bytes',
                    },
                ],
                name: 'swapOneForOneERC721Decoding',
                outputs: [
                    {
                        name: '',
                        type: 'uint256',
                    },
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCall',
                        type: 'uint8',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                ],
                name: 'transferERC1155Exact',
                outputs: [
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCall',
                        type: 'uint8',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                ],
                name: 'transferERC20Exact',
                outputs: [
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                    {
                        name: 'extra',
                        type: 'bytes',
                    },
                    {
                        name: 'addresses',
                        type: 'address[7]',
                    },
                    {
                        name: 'howToCall',
                        type: 'uint8',
                    },
                    {
                        name: 'index_3',
                        type: 'uint256[6]',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                ],
                name: 'transferERC721Exact',
                outputs: [
                ],
                stateMutability: 'pure',
                type: 'function',
            },
            { 
                inputs: [
                ],
                name: 'test',
                outputs: [
                ],
                stateMutability: 'pure',
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
                    await WyvernStaticContract._deployLibrariesAsync(
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
        const methodAbi = WyvernStaticContract.ABI()[index] as MethodAbi; // tslint:disable-line:no-unnecessary-type-assertion
        const functionSignature = methodAbiToFunctionSignature(methodAbi);
        return functionSignature;
    }

    public getABIDecodedTransactionData<T>(methodName: string, callData: string): T {
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernStaticContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        const abiDecodedCallData = abiEncoder.strictDecode<T>(callData);
        return abiDecodedCallData;
    }

    public getABIDecodedReturnData<T>(methodName: string, callData: string): T {
        if (this._encoderOverrides.decodeOutput) {
            return this._encoderOverrides.decodeOutput(methodName, callData);
        }
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernStaticContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        const abiDecodedCallData = abiEncoder.strictDecodeReturnValue<T>(callData);
        return abiDecodedCallData;
    }

    public getSelector(methodName: string): string {
        const functionSignature = this.getFunctionSignature(methodName);
        const self = (this as any) as WyvernStaticContract;
        const abiEncoder = self._lookupAbiEncoder(functionSignature);
        return abiEncoder.getSelector();
    }

    public and(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'and(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public any(
            index_0: string,
            index_1: string[],
            index_2: Array<number|BigNumber>,
            index_3: BigNumber[],
            index_4: string,
            index_5: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('index_0', index_0);
            assert.isArray('index_1', index_1);
            assert.isArray('index_2', index_2);
            assert.isArray('index_3', index_3);
            assert.isString('index_4', index_4);
            assert.isString('index_5', index_5);
        const functionSignature = 'any(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0,
            index_1,
            index_2,
            index_3,
            index_4,
            index_5
            ]);
            },
        };
    }
    public anyAddOne(
            index_0: string,
            index_1: string[],
            index_2: Array<number|BigNumber>,
            uints: BigNumber[],
            index_4: string,
            index_5: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('index_0', index_0);
            assert.isArray('index_1', index_1);
            assert.isArray('index_2', index_2);
            assert.isArray('uints', uints);
            assert.isString('index_4', index_4);
            assert.isString('index_5', index_5);
        const functionSignature = 'anyAddOne(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0,
            index_1,
            index_2,
            uints,
            index_4,
            index_5
            ]);
            },
        };
    }
    public anyNoFill(
            index_0: string,
            index_1: string[],
            index_2: Array<number|BigNumber>,
            index_3: BigNumber[],
            index_4: string,
            index_5: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('index_0', index_0);
            assert.isArray('index_1', index_1);
            assert.isArray('index_2', index_2);
            assert.isArray('index_3', index_3);
            assert.isString('index_4', index_4);
            assert.isString('index_5', index_5);
        const functionSignature = 'anyNoFill(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0,
            index_1,
            index_2,
            index_3,
            index_4,
            index_5
            ]);
            },
        };
    }
    public anySingle(
            index_0: string,
            index_1: string[],
            index_2: number|BigNumber,
            index_3: BigNumber[],
            index_4: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('index_0', index_0);
            assert.isArray('index_1', index_1);
            assert.isNumberOrBigNumber('index_2', index_2);
            assert.isArray('index_3', index_3);
            assert.isString('index_4', index_4);
        const functionSignature = 'anySingle(bytes,address[7],uint8,uint256[6],bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [index_0,
            index_1,
            index_2,
            index_3,
            index_4
            ]);
            },
        };
    }
    public atomicizer(
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernStaticContract;
        const functionSignature = 'atomicizer()';
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
    public dumbSequenceExact(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            cdata: string,
            index_5: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('cdata', cdata);
            assert.isString('index_5', index_5);
        const functionSignature = 'dumbSequenceExact(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            cdata,
            index_5
            ]);
            },
        };
    }
    public name(
    ): ContractTxFunctionObj<string
> {
        const self = this as any as WyvernStaticContract;
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
    public or(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'or(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public sequenceAnyAfter(
            extra: string,
            addresses: string[],
            howToCall: number|BigNumber,
            uints: BigNumber[],
            cdata: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isNumberOrBigNumber('howToCall', howToCall);
            assert.isArray('uints', uints);
            assert.isString('cdata', cdata);
        const functionSignature = 'sequenceAnyAfter(bytes,address[7],uint8,uint256[6],bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCall,
            uints,
            cdata
            ]);
            },
        };
    }
    public sequenceExact(
            extra: string,
            addresses: string[],
            howToCall: number|BigNumber,
            uints: BigNumber[],
            cdata: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isNumberOrBigNumber('howToCall', howToCall);
            assert.isArray('uints', uints);
            assert.isString('cdata', cdata);
        const functionSignature = 'sequenceExact(bytes,address[7],uint8,uint256[6],bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCall,
            uints,
            cdata
            ]);
            },
        };
    }
    public split(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'split(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public splitAddOne(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'splitAddOne(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapExact(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapExact(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapForever(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapForever(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapOneForOneERC1155(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapOneForOneERC1155(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapOneForOneERC1155Decoding(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapOneForOneERC1155Decoding(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapOneForOneERC721(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapOneForOneERC721(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public swapOneForOneERC721Decoding(
            extra: string,
            addresses: string[],
            howToCalls: Array<number|BigNumber>,
            uints: BigNumber[],
            data: string,
            counterdata: string,
    ): ContractTxFunctionObj<BigNumber
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isArray('howToCalls', howToCalls);
            assert.isArray('uints', uints);
            assert.isString('data', data);
            assert.isString('counterdata', counterdata);
        const functionSignature = 'swapOneForOneERC721Decoding(bytes,address[7],uint8[2],uint256[6],bytes,bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<BigNumber
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCalls,
            uints,
            data,
            counterdata
            ]);
            },
        };
    }
    public transferERC1155Exact(
            extra: string,
            addresses: string[],
            howToCall: number|BigNumber,
            index_3: BigNumber[],
            data: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isNumberOrBigNumber('howToCall', howToCall);
            assert.isArray('index_3', index_3);
            assert.isString('data', data);
        const functionSignature = 'transferERC1155Exact(bytes,address[7],uint8,uint256[6],bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCall,
            index_3,
            data
            ]);
            },
        };
    }
    public transferERC20Exact(
            extra: string,
            addresses: string[],
            howToCall: number|BigNumber,
            index_3: BigNumber[],
            data: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isNumberOrBigNumber('howToCall', howToCall);
            assert.isArray('index_3', index_3);
            assert.isString('data', data);
        const functionSignature = 'transferERC20Exact(bytes,address[7],uint8,uint256[6],bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCall,
            index_3,
            data
            ]);
            },
        };
    }
    public transferERC721Exact(
            extra: string,
            addresses: string[],
            howToCall: number|BigNumber,
            index_3: BigNumber[],
            data: string,
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
            assert.isString('extra', extra);
            assert.isArray('addresses', addresses);
            assert.isNumberOrBigNumber('howToCall', howToCall);
            assert.isArray('index_3', index_3);
            assert.isString('data', data);
        const functionSignature = 'transferERC721Exact(bytes,address[7],uint8,uint256[6],bytes)';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, [extra,
            addresses,
            howToCall,
            index_3,
            data
            ]);
            },
        };
    }
    public test(
    ): ContractTxFunctionObj<void
> {
        const self = this as any as WyvernStaticContract;
        const functionSignature = 'test()';
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
                let rawCallResult;
                if (self._deployedBytecodeIfExists) {
                    rawCallResult = await self._evmExecAsync(this.getABIEncodedTransactionData());
                } else {
                    rawCallResult = await self._performCallAsync({ data: this.getABIEncodedTransactionData(), ...callData }, defaultBlock);
                }
                const abiEncoder = self._lookupAbiEncoder(functionSignature);
                BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult, abiEncoder);
                return abiEncoder.strictDecodeReturnValue<void
            >(rawCallResult);
            },
            getABIEncodedTransactionData(): string {
                return self._strictEncodeArguments(functionSignature, []);
            },
        };
    }



    constructor(
        address: string,
        supportedProvider: SupportedProvider,
        txDefaults?: Partial<TxData>,
        logDecodeDependencies?: { [contractName: string]: ContractAbi },
        deployedBytecode: string | undefined = WyvernStaticContract.deployedBytecode,
        encoderOverrides?: Partial<EncoderOverrides>,
    ) {
        super('WyvernStatic', WyvernStaticContract.ABI(), address, supportedProvider, txDefaults, logDecodeDependencies, deployedBytecode, encoderOverrides);
        classUtils.bindAll(this, ['_abiEncoderByFunctionSignature', 'address', '_web3Wrapper']);
WyvernStaticContract.ABI().forEach((item, index) => {
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
