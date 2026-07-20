/**
 * Midnight.js browser circuit transport — the only place Midnight.js is imported
 * for on-chain callTx (alongside deploy tooling under contracts/).
 *
 * Lace ConnectedAPI balances + submits; local proof-server proves via httpClientProofProvider.
 * ZK artifacts are fetched from zkAssetBaseUrl (e.g. /zk/eclipse).
 */
import { findDeployedContract, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import type { Payroll, PayrollStatus } from '../types';
import { bytesToHex } from './witnessHelpers';
import {
  mapLedgerLikeToPayroll,
  type EclipseCircuitTransport,
} from './MidnightAdapter';

const PRIVATE_STATE_ID = 'EclipseBrowserPrivateState';
const STATUS_NAMES: PayrollStatus[] = [
  'Uninitialized',
  'Created',
  'Funded',
  'Distributed',
];

const PREPROD = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
};

export type MidnightJsTransportConfig = {
  contractAddress: string;
  network: 'preprod' | 'preview' | 'undeployed';
  /** Absolute or origin-relative base for keys/ + zkir/ (e.g. https://host/zk/eclipse). */
  zkAssetBaseUrl: string;
  /** URL path to dynamically import managed contract module (e.g. /zk/eclipse/contract/index.js). */
  contractModuleUrl: string;
  proofServerUrl: string;
  getConnectedApi: () => ConnectedAPI | null;
  /** Fallback when Lace getConfiguration is unavailable. */
  indexerHttp?: string;
  indexerWs?: string;
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHexLower(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Best-effort: Bech32 coin key or hex → 32 bytes for Compact Bytes<32> slots. */
function pkToBytes32(value: string): Uint8Array {
  const hexMatch = value.match(/[0-9a-fA-F]{64}/);
  if (hexMatch) return hexToBytes(hexMatch[0]!);
  // Fold bech32 text into 32 bytes (stable demo binding when raw key bytes unavailable).
  const enc = new TextEncoder().encode(value);
  const out = new Uint8Array(32);
  for (let i = 0; i < enc.length; i++) out[i % 32]! ^= enc[i]!;
  return out;
}

export class MidnightJsEclipseTransport implements EclipseCircuitTransport {
  private readonly config: MidnightJsTransportConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FoundContract generics are contract-specific
  private found: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ledgerFn: ((state: any) => any) | null = null;

  constructor(config: MidnightJsTransportConfig) {
    this.config = config;
  }

  private async ensureContract(): Promise<void> {
    if (this.found && this.ledgerFn) return;

    const api = this.config.getConnectedApi();
    if (!api) {
      throw Object.assign(new Error('Connect Lace before circuit calls'), {
        kind: 'WalletNotConnected',
      });
    }

    setNetworkId(this.config.network);

    let indexerHttp = this.config.indexerHttp ?? PREPROD.indexer;
    let indexerWs = this.config.indexerWs ?? PREPROD.indexerWS;
    let proofUrl = this.config.proofServerUrl;
    try {
      const cfg = await api.getConfiguration();
      if (cfg.indexerUri) indexerHttp = cfg.indexerUri;
      if (cfg.indexerWsUri) indexerWs = cfg.indexerWsUri;
      if (cfg.proverServerUri) proofUrl = cfg.proverServerUri.replace(/\/$/, '');
    } catch {
      // Use defaults when wallet config is incomplete.
    }

    const shielded = await api.getShieldedAddresses();
    const coinPublicKey = shielded.shieldedCoinPublicKey;
    const encPublicKey = shielded.shieldedEncryptionPublicKey;

    const zkBase = this.config.zkAssetBaseUrl.replace(/\/$/, '');
    const zkConfigProvider = new FetchZkConfigProvider(
      zkBase.startsWith('http') ? zkBase : `${window.location.origin}${zkBase}`,
      fetch.bind(window),
    );

    const proofProvider = httpClientProofProvider(proofUrl, zkConfigProvider);
    const publicDataProvider = indexerPublicDataProvider(indexerHttp, indexerWs);
    const privateStateProvider = levelPrivateStateProvider({
      midnightDbName: 'eclipse-midnight-db',
      privateStateStoreName: 'eclipse-browser',
      accountId: coinPublicKey,
      privateStoragePasswordProvider: async () => 'eclipse-l2-local-only',
    });

    const providers = {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider: {
        getCoinPublicKey: () => coinPublicKey as never,
        getEncryptionPublicKey: () => encPublicKey as never,
        balanceTx: async (tx: { serialize: () => Uint8Array }) => {
          const serialized = bytesToHexLower(tx.serialize());
          const result = await api.balanceUnsealedTransaction(serialized, { payFees: true });
          const bytes = hexToBytes(result.tx);
          return Transaction.deserialize('signature', 'proof', 'binding', bytes);
        },
      },
      midnightProvider: {
        submitTx: async (tx: { serialize: () => Uint8Array; identifiers?: () => string[] }) => {
          const serialized = bytesToHexLower(tx.serialize());
          await api.submitTransaction(serialized);
          return tx.identifiers?.()[0] ?? serialized.slice(0, 64);
        },
      },
    };

    const contractModule = await import(
      /* @vite-ignore */ this.config.contractModuleUrl
    );
    const Contract = contractModule.Contract;
    this.ledgerFn = contractModule.ledger;

    const compiledContract = CompiledContract.make('EclipseContract', Contract).pipe(
      CompiledContract.withVacantWitnesses,
    );

    this.found = await findDeployedContract(providers as never, {
      contractAddress: this.config.contractAddress,
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
    } as never);
  }

  private async readPayroll(): Promise<Payroll> {
    const api = this.config.getConnectedApi();
    let indexerHttp = this.config.indexerHttp ?? PREPROD.indexer;
    let indexerWs = this.config.indexerWs ?? PREPROD.indexerWS;
    if (api) {
      try {
        const cfg = await api.getConfiguration();
        if (cfg.indexerUri) indexerHttp = cfg.indexerUri;
        if (cfg.indexerWsUri) indexerWs = cfg.indexerWsUri;
      } catch {
        /* defaults */
      }
    }

    if (!this.ledgerFn) {
      const contractModule = await import(
        /* @vite-ignore */ this.config.contractModuleUrl
      );
      this.ledgerFn = contractModule.ledger;
    }

    const publicDataProvider = indexerPublicDataProvider(indexerHttp, indexerWs);
    const { contractState } = await getPublicStates(
      publicDataProvider,
      this.config.contractAddress as never,
    );
    const led = this.ledgerFn!(contractState.data);
    const status = STATUS_NAMES[led.status as number] ?? 'Uninitialized';
    return mapLedgerLikeToPayroll({
      employer: bytesToHex(led.employer as Uint8Array),
      depositTotal: led.depositTotal as bigint,
      recipients: (led.recipients as Uint8Array[]).map((r) => bytesToHex(r)),
      status,
      receiptCommitments: (led.receiptCommitments as Uint8Array[]).map((c) =>
        bytesToHex(c),
      ),
    });
  }

  async queryPublicPayroll(): Promise<Payroll> {
    return this.readPayroll();
  }

  async createPayroll(employerPk: Uint8Array, recipients: Uint8Array[]): Promise<Payroll> {
    await this.ensureContract();
    // Prefer Lace coin key when available; fall back to adapter-provided employerPk.
    const api = this.config.getConnectedApi();
    let employer = employerPk;
    if (api) {
      try {
        const s = await api.getShieldedAddresses();
        employer = pkToBytes32(s.shieldedCoinPublicKey);
      } catch {
        /* keep employerPk */
      }
    }
    await this.found.callTx.createPayroll(employer, recipients);
    return this.readPayroll();
  }

  async fund(amount: bigint): Promise<Payroll> {
    await this.ensureContract();
    await this.found.callTx.fund(amount);
    return this.readPayroll();
  }

  async distribute(amounts: bigint[], salts: Uint8Array[]): Promise<Payroll> {
    await this.ensureContract();
    await this.found.callTx.distribute(amounts, salts);
    return this.readPayroll();
  }
}

/** Indexer-only reader — no Lace required (observer view). */
export class IndexerPayrollReader {
  private readonly contractAddress: string;
  private readonly contractModuleUrl: string;
  private readonly indexerHttp: string;
  private readonly indexerWs: string;

  constructor(
    contractAddress: string,
    contractModuleUrl: string,
    indexerHttp = PREPROD.indexer,
    indexerWs = PREPROD.indexerWS,
  ) {
    this.contractAddress = contractAddress;
    this.contractModuleUrl = contractModuleUrl;
    this.indexerHttp = indexerHttp;
    this.indexerWs = indexerWs;
  }

  async queryPublicPayroll(): Promise<Payroll> {
    const contractModule = await import(/* @vite-ignore */ this.contractModuleUrl);
    const publicDataProvider = indexerPublicDataProvider(this.indexerHttp, this.indexerWs);
    const { contractState } = await getPublicStates(
      publicDataProvider,
      this.contractAddress as never,
    );
    const led = contractModule.ledger(contractState.data);
    const status = STATUS_NAMES[led.status as number] ?? 'Uninitialized';
    return mapLedgerLikeToPayroll({
      employer: bytesToHex(led.employer as Uint8Array),
      depositTotal: led.depositTotal as bigint,
      recipients: (led.recipients as Uint8Array[]).map((r: Uint8Array) => bytesToHex(r)),
      status,
      receiptCommitments: (led.receiptCommitments as Uint8Array[]).map((c: Uint8Array) =>
        bytesToHex(c),
      ),
    });
  }
}
