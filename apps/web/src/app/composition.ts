import {
  createBrowserEclipseSdk,
  type ContractModuleLoader,
  type EclipseSdkNetwork,
} from '@eclipse/sdk';
import type { EclipseRuntime } from '../shared/runtime/EclipseRuntime';

const DEFAULT_PREPROD_ADDRESS =
  'c5f76edd6ac17076b4fca57218c01fb5e88f9b66248c0bb665b5fc0ab2bb6774';

/**
 * Only place environment variables, the generated contract module, and the
 * browser SDK factory meet. `main.tsx` calls this exactly once and injects the
 * result everywhere else via `EclipseRuntimeProvider`.
 */
export function createWebRuntime(): EclipseRuntime {
  const mode = import.meta.env.VITE_USE_CHAIN === '1' ? 'chain' : 'demo';
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS ?? DEFAULT_PREPROD_ADDRESS;
  const network = (import.meta.env.VITE_NETWORK ?? 'preprod') as EclipseSdkNetwork;
  const sdk = createBrowserEclipseSdk({
    mode,
    contractAddress,
    network,
    proofServerUrl: import.meta.env.VITE_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    zkAssetBaseUrl: '/zk/eclipse',
    // Bundled rather than fetched from /zk: the generated module imports compact-runtime
    // by bare specifier, which only the bundler can resolve.
    loadContractModule: () =>
      import('../../../../contracts/managed/eclipse/contract/index.js') as ReturnType<ContractModuleLoader>,
  });
  return {
    sdk,
    mode,
    contractAddress,
    explorerUrl: `https://explorer.1am.xyz/contract/${contractAddress}?network=preprod`,
    debug: import.meta.env.VITE_DEBUG === '1',
  };
}
