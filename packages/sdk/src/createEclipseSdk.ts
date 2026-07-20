import { ProofClient, type ProofClientConfig } from './proof/ProofClient';
import { LaceAdapter, type LaceAdapterConfig } from './wallet/LaceAdapter';
import {
  MidnightAdapter,
  type EclipseCircuitTransport,
  type MidnightAdapterConfig,
} from './contract/MidnightAdapter';
import type { WalletPort } from './wallet/WalletPort';
import type { EclipsePort } from './contract/EclipsePort';

export type EclipseSdkNetwork = 'preprod' | 'preview' | 'undeployed';

export interface EclipseSdkConfig {
  proofServerUrl?: string;
  contractAddress: string;
  network: EclipseSdkNetwork;
  allowRemoteProofServer?: boolean;
  proofTimeoutMs?: number;
  /** Inject transport (tests / future Midnight.js browser bridge). */
  transport?: EclipseCircuitTransport;
  /** Inject wallet (tests). Default LaceAdapter. */
  wallet?: WalletPort;
}

export interface EclipseSdk {
  wallet: WalletPort;
  eclipse: EclipsePort;
  proof: ProofClient;
}

export function createEclipseSdk(config: EclipseSdkConfig): EclipseSdk {
  if (!config.contractAddress?.trim()) {
    throw new Error('createEclipseSdk requires contractAddress');
  }

  const proofConfig: ProofClientConfig = {
    proofServerUrl: config.proofServerUrl,
    timeoutMs: config.proofTimeoutMs,
    allowRemoteProofServer: config.allowRemoteProofServer,
  };
  const proof = new ProofClient(proofConfig);

  const laceConfig: LaceAdapterConfig = { network: config.network };
  const lace = config.wallet ? null : new LaceAdapter(laceConfig);
  const wallet: WalletPort = config.wallet ?? lace!;

  const midnightConfig: MidnightAdapterConfig = {
    contractAddress: config.contractAddress,
    network: config.network,
    transport: config.transport,
  };

  const eclipse = new MidnightAdapter(
    proof,
    wallet,
    midnightConfig,
    lace ?? undefined,
  );

  return { wallet, eclipse, proof };
}
