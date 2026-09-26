export * from './types';
export * from './wallet/WalletPort';
export * from './wallet/LaceAdapter';
export * from './contract/EclipsePort';
export * from './private/ReceiptStorePort';
export * from './private/MemoryReceiptStore';
export * from './contract/MidnightAdapter';
export * from './contract/MidnightJsTransport';
export * from './contract/witnessHelpers';
export * from './proof/ProofClient';
export * from './createEclipseSdk';

// New browser-facing surface (Task 2): coexists with the legacy factory above until
// Task 3 migrates every web caller and removes it. `EclipseSdk` (types/EclipseSdk.ts)
// is deliberately NOT re-exported here yet: it would shadow the legacy, richer
// `EclipseSdk` (with `proof`) that `apps/web` still depends on via `export *` above.
export type { ContractModuleLoader } from './contract/ContractModuleLoader';
export type { BrowserEclipseSdkConfig } from './types/BrowserEclipseSdkConfig';
export type { BrowserEclipseSdkMode } from './types/BrowserEclipseSdkMode';
export type { EclipseSdkNetwork } from './types/EclipseSdkNetwork';
export { createBrowserEclipseSdk } from './createBrowserEclipseSdk';
