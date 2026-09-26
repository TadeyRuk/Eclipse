import type { ContractModuleLoader } from '../contract/ContractModuleLoader';
import type { BrowserEclipseSdkMode } from './BrowserEclipseSdkMode';
import type { EclipseSdkNetwork } from './EclipseSdkNetwork';

export interface BrowserEclipseSdkConfig {
  mode: BrowserEclipseSdkMode;
  contractAddress: string;
  network: EclipseSdkNetwork;
  proofServerUrl: string;
  zkAssetBaseUrl: string;
  loadContractModule: ContractModuleLoader;
  allowRemoteProofServer?: boolean;
  proofTimeoutMs?: number;
}
