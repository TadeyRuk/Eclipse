import { ProofClient, type ProofClientConfig } from './proof/ProofClient';
import { LaceAdapter, type LaceAdapterConfig } from './wallet/LaceAdapter';
import {
  MidnightAdapter,
  InMemoryEclipseTransport,
  type EclipseCircuitTransport,
  type MidnightAdapterConfig,
} from './contract/MidnightAdapter';
import {
  MidnightJsEclipseTransport,
  IndexerPayrollReader,
  type MidnightJsTransportConfig,
} from './contract/MidnightJsTransport';
import type { EclipsePort } from './contract/EclipsePort';
import type { EclipseSdk } from './types/EclipseSdk';
import type { BrowserEclipseSdkConfig } from './types/BrowserEclipseSdkConfig';

/**
 * Hides browser adapter composition behind one factory: the caller picks a mode
 * and receives only `{ wallet, eclipse }` — never the concrete adapters/transports.
 *
 * Demo mode simulates the ledger locally. Chain mode reads through the indexer and
 * writes through Midnight.js; a failed chain read is never masked by demo state.
 */
export function createBrowserEclipseSdk(config: BrowserEclipseSdkConfig): EclipseSdk {
  if (!config.contractAddress?.trim()) {
    throw new Error('createBrowserEclipseSdk requires contractAddress');
  }

  const proofConfig: ProofClientConfig = {
    proofServerUrl: config.proofServerUrl,
    timeoutMs: config.proofTimeoutMs,
    allowRemoteProofServer: config.allowRemoteProofServer,
  };
  const proof = new ProofClient(proofConfig);

  const laceConfig: LaceAdapterConfig = { network: config.network };
  const lace = new LaceAdapter(laceConfig);

  const transport: EclipseCircuitTransport =
    config.mode === 'demo'
      ? new InMemoryEclipseTransport()
      : buildChainTransport(config, lace);

  const midnightConfig: MidnightAdapterConfig = {
    contractAddress: config.contractAddress,
    network: config.network,
    transport,
  };

  const eclipse: EclipsePort = new MidnightAdapter(proof, lace, midnightConfig, lace);

  return { wallet: lace, eclipse };
}

function buildChainTransport(
  config: BrowserEclipseSdkConfig,
  lace: LaceAdapter,
): EclipseCircuitTransport {
  const indexer = new IndexerPayrollReader(config.contractAddress, config.loadContractModule);

  const chainConfig: MidnightJsTransportConfig = {
    contractAddress: config.contractAddress,
    network: config.network,
    zkAssetBaseUrl: config.zkAssetBaseUrl,
    loadContractModule: config.loadContractModule,
    proofServerUrl: config.proofServerUrl,
    getConnectedApi: () => lace.getConnectedApi(),
  };
  const chain = new MidnightJsEclipseTransport(chainConfig);

  return {
    queryPublicPayroll: () => indexer.queryPublicPayroll(),
    createPayroll: (employerPk, recipients) => chain.createPayroll(employerPk, recipients),
    fund: (amount) => chain.fund(amount),
    distribute: (amounts, salts) => chain.distribute(amounts, salts),
    claim: (slot, amount, recipientPk, salt) =>
      chain.claim(slot, amount, recipientPk, salt),
  };
}
