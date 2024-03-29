import {
  Abi,
  ContractFunctionArgs,
  ContractFunctionName,
  PublicClientConfig,
  ReadContractParameters,
  ReadContractReturnType,
  SimulateContractParameters,
  SimulateContractReturnType,
  WaitForTransactionReceiptReturnType,
  WalletClient,
  WriteContractParameters,
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as chains from 'viem/chains';
import { CHAIN_MAP } from '../constants/chains';
import { CONTRACT_ADDRESSES, ContractChainType, ContractType } from '../constants/contracts';
import { chainRPCFallbacks } from '../constants/rpcs';
import { SupportedAbiType } from './GenericContract';

declare global {
  interface Window {
    ethereum: any;
  }
}

export type GenericWriteParams<
  A extends Abi = Abi,
  T extends ContractFunctionName<A, 'payable' | 'nonpayable'> = ContractFunctionName<A, 'payable' | 'nonpayable'>,
  R extends ContractFunctionArgs<A, 'payable' | 'nonpayable', T> = ContractFunctionArgs<A, 'payable' | 'nonpayable', T>,
> = {
  functionName: T;
  args: R;
  value?: bigint;
  onRequestSignature?: () => void;
  onSigned?: (tx: `0x${string}`) => void;
  onSuccess?: (receipt: WaitForTransactionReceiptReturnType) => void;
  onError?: (error: unknown) => void;
};

export type GenericLogicConstructorParams<A extends SupportedAbiType = SupportedAbiType> = {
  chainId: ContractChainType;
  type: ContractType;
  abi: A;
  options?: PublicClientConfig;
};

export class GenericContractLogic<A extends SupportedAbiType> {
  public static instances: Partial<Record<ContractChainType, GenericContractLogic<SupportedAbiType>>> = {};
  private abi: A;
  private contractType: ContractType;
  private chain: chains.Chain;
  private chainId: ContractChainType;
  private publicClient;
  private walletClient?: WalletClient;

  constructor(params: GenericLogicConstructorParams<A>) {
    const { chainId, type, abi, options } = params;
    const supported = CHAIN_MAP[chainId];

    if (!supported) throw new Error(`Chain ${chainId} not supported`);

    const chain = Object.values(chains).find((chain) => chain.id === chainId);
    if (!chain) throw new Error('Chain  not found');

    this.chain = chain;
    this.contractType = type;
    this.abi = abi;
    this.chainId = chainId;

    this.publicClient = createPublicClient({
      chain,
      transport: fallback(chainRPCFallbacks(chain.id), { rank: true }),
      ...options,
    });
  }

  public withConfig(options?: PublicClientConfig) {
    const chain = Object.values(chains).find((chain) => chain.id === this.chainId);
    if (!chain) throw new Error('Chain  not found');

    this.publicClient = createPublicClient({
      chain,
      transport: fallback(chainRPCFallbacks(this.chain.id), { rank: true }),
      ...options,
    });
  }

  public withPrivateKey(privateKey: `0x${string}`) {
    const account = privateKeyToAccount(privateKey);

    this.walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(),
    });

    return this;
  }

  public withAccount(account: `0x${string}`) {
    this.walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: custom(window.ethereum),
    });

    return this;
  }

  public async withProvider(provider: any) {
    this.walletClient = createWalletClient({
      chain: this.chain,
      transport: custom(provider),
    });

    const [address] = await this.walletClient?.requestAddresses();

    this.walletClient = createWalletClient({
      account: address,
      chain: this.chain,
      transport: custom(provider),
    });

    return this;
  }

  private async initializeWallet() {
    // there could be an existing wallet client
    if (this.walletClient) {
      const [address] = await this.walletClient?.requestAddresses();

      this.walletClient = createWalletClient({
        account: address,
        chain: this.chain,
        transport: custom(this.walletClient.transport),
      });
      return;
    } else if (!window.ethereum) {
      throw new Error('No Ethereum provider found');
    } else {
      this.walletClient = createWalletClient({
        chain: this.chain,
        transport: custom(window.ethereum),
      });

      const [address] = await this.walletClient?.requestAddresses();

      this.walletClient = createWalletClient({
        account: address,
        chain: this.chain,
        transport: custom(window.ethereum),
      });
    }
  }

  public static getInstance<T extends SupportedAbiType>(chainId: ContractChainType, type: ContractType, abi: T) {
    if (!this.instances[chainId]) {
      // new "this" to allow for subclassing
      this.instances[chainId] = new this({
        chainId,
        type,
        abi,
      }) as unknown as GenericContractLogic<SupportedAbiType>;
    }

    return this.instances[chainId] as unknown as GenericContractLogic<T>;
  }

  public read<
    T extends ContractFunctionName<A, 'view' | 'pure'>,
    R extends ContractFunctionArgs<A, 'view' | 'pure', T>,
  >(params: { functionName: T; args: R }) {
    const { functionName, args } = params;
    return this.publicClient.readContract({
      abi: this.abi,
      address: CONTRACT_ADDRESSES[this.contractType][this.chainId],
      functionName,
      ...(args && { args }),
    } as unknown as ReadContractParameters<A, T, R>) as Promise<ReadContractReturnType<A, T, R>>;
  }

  public async write<
    T extends ContractFunctionName<A, 'payable' | 'nonpayable'>,
    R extends ContractFunctionArgs<A, 'payable' | 'nonpayable', T>,
  >(params: GenericWriteParams<A, T, R>): Promise<WaitForTransactionReceiptReturnType> {
    await this.initializeWallet();

    if (!this.walletClient?.account) throw new Error('No wallet client found');
    else if (this.walletClient.chain?.id !== this.chain.id) {
      await this.walletClient.switchChain({ id: this.chain.id }).catch(async () => {
        await this.walletClient?.addChain({ chain: this.chain });
      });
    }

    const { functionName, args, value, onError, onRequestSignature, onSigned, onSuccess } = params;

    const [account] = await this.walletClient.getAddresses();
    const simulationArgs = {
      account,
      chain: this.chain,
      abi: this.abi,
      address: CONTRACT_ADDRESSES[this.contractType][this.chainId],
      functionName,
      args,
      ...(value && { value }),
    } as unknown as SimulateContractParameters<A, T, R>;

    try {
      const { request } = (await this.publicClient.simulateContract(simulationArgs)) as SimulateContractReturnType<
        A,
        T,
        R
      >;

      onRequestSignature?.();
      const tx = await this.walletClient.writeContract(request as WriteContractParameters<A, T, R>);

      onSigned?.(tx);

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      onSuccess?.(receipt);

      return receipt;
    } catch (e) {
      if (e) {
        Object.assign(e, { functionName, args, simulationArgs, value, account, walletClient: this.walletClient });
      }
      onError?.(e);
    }
  }
}
