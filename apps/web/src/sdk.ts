import {
  createEclipseSdk,
  InMemoryEclipseTransport,
  type EclipseSdk,
  type EclipseSdkNetwork,
  type WalletPort,
} from '@eclipse/sdk';

const contractAddress =
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  '3aec836e6c723531cb13803e63795d531117c73231fa7793372c504a8bfa3d47';

const network = (import.meta.env.VITE_NETWORK ?? 'preprod') as EclipseSdkNetwork;

const proofServerUrl =
  import.meta.env.VITE_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';

/**
 * Shared in-memory transport so Employer + Observer see the same public ledger
 * in the L2 privacy demo. Lace handles connect/disconnect.
 */
const sharedTransport = new InMemoryEclipseTransport();

let sdkSingleton: EclipseSdk | null = null;

export function getSdk(): EclipseSdk {
  if (!sdkSingleton) {
    sdkSingleton = createEclipseSdk({
      contractAddress,
      network,
      proofServerUrl,
      allowRemoteProofServer: false,
      transport: sharedTransport,
    });
  }
  return sdkSingleton;
}

/** Test-only: replace SDK with injected wallet/transport. */
export function __resetSdkForTests(wallet?: WalletPort): EclipseSdk {
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
