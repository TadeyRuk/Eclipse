import {
  createEclipseSdk,
  InMemoryEclipseTransport,
  MidnightJsEclipseTransport,
  IndexerPayrollReader,
  LaceAdapter,
  type EclipseSdk,
  type EclipseSdkNetwork,
  type WalletPort,
  type EclipseCircuitTransport,
  type Payroll,
} from '@eclipse/sdk';

const contractAddress =
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  '3aec836e6c723531cb13803e63795d531117c73231fa7793372c504a8bfa3d47';

const network = (import.meta.env.VITE_NETWORK ?? 'preprod') as EclipseSdkNetwork;

const proofServerUrl =
  import.meta.env.VITE_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';

/** When "1", employer circuits use Midnight.js + Lace against Preprod. */
const useChain = import.meta.env.VITE_USE_CHAIN === '1';

const zkAssetBaseUrl = '/zk/eclipse';
const contractModuleUrl = '/zk/eclipse/contract/index.js';

const sharedMemory = new InMemoryEclipseTransport();

let sdkSingleton: EclipseSdk | null = null;
let chainTransport: MidnightJsEclipseTransport | null = null;

class HybridTransport implements EclipseCircuitTransport {
  private readonly memory: InMemoryEclipseTransport;
  private readonly getChain: () => MidnightJsEclipseTransport | null;
  private readonly indexer: IndexerPayrollReader;

  constructor(
    memory: InMemoryEclipseTransport,
    getChain: () => MidnightJsEclipseTransport | null,
    indexer: IndexerPayrollReader,
  ) {
    this.memory = memory;
    this.getChain = getChain;
    this.indexer = indexer;
  }

  async queryPublicPayroll(): Promise<Payroll> {
    if (useChain) {
      return this.indexer.queryPublicPayroll();
    }
    return this.memory.queryPublicPayroll();
  }

  async createPayroll(employerPk: Uint8Array, recipients: Uint8Array[]): Promise<Payroll> {
    const chain = this.getChain();
    if (useChain && chain) return chain.createPayroll(employerPk, recipients);
    return this.memory.createPayroll(employerPk, recipients);
  }

  async fund(amount: bigint): Promise<Payroll> {
    const chain = this.getChain();
    if (useChain && chain) return chain.fund(amount);
    return this.memory.fund(amount);
  }

  async distribute(amounts: bigint[], salts: Uint8Array[]): Promise<Payroll> {
    const chain = this.getChain();
    if (useChain && chain) return chain.distribute(amounts, salts);
    return this.memory.distribute(amounts, salts);
  }
}

export function getSdk(): EclipseSdk {
  if (!sdkSingleton) {
    const indexer = new IndexerPayrollReader(contractAddress, contractModuleUrl);
    const transport = new HybridTransport(sharedMemory, () => chainTransport, indexer);

    sdkSingleton = createEclipseSdk({
      contractAddress,
      network,
      proofServerUrl,
      allowRemoteProofServer: false,
      transport,
    });

    if (useChain && sdkSingleton.wallet instanceof LaceAdapter) {
      const lace = sdkSingleton.wallet;
      chainTransport = new MidnightJsEclipseTransport({
        contractAddress,
        network,
        zkAssetBaseUrl,
        contractModuleUrl,
        proofServerUrl,
        getConnectedApi: () => lace.getConnectedApi(),
      });
    }
  }
  return sdkSingleton;
}

/** Test-only: replace SDK with injected wallet/transport. */
export function __resetSdkForTests(wallet?: WalletPort): EclipseSdk {
  chainTransport = null;
  sdkSingleton = createEclipseSdk({
    contractAddress,
    network,
    proofServerUrl,
    allowRemoteProofServer: false,
    transport: new InMemoryEclipseTransport(),
    wallet,
  });
  return sdkSingleton;
}

export function getContractAddress(): string {
  return contractAddress;
}

export function explorerContractUrl(): string {
  return `https://explorer.1am.xyz/contract/${contractAddress}?network=preprod`;
}

export const debugEnabled = import.meta.env.VITE_DEBUG === '1';
export const chainModeEnabled = useChain;
