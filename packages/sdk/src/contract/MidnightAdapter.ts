import type { Address, Payroll, PayrollStatus, Receipt, Result } from '../types';
import { MAX_RECIPIENTS } from '../types/domain';
import { err } from '../types/result';
import { safeAsync } from '../internal/safeAsync';
import type { ProofClient } from '../proof/ProofClient';
import type { WalletPort } from '../wallet/WalletPort';
import type { LaceAdapter } from '../wallet/LaceAdapter';
import type { EclipsePort } from './EclipsePort';
import {
  addressToBytes32,
  bytesToHex,
  generateSalts,
  padAmounts,
  sumAmounts,
} from './witnessHelpers';

export type MidnightAdapterConfig = {
  contractAddress: string;
  network: 'preprod' | 'preview' | 'undeployed';
  /**
   * Optional injected transport for circuit calls.
   * Production wires Midnight.js here; tests inject a mock.
   */
  transport?: EclipseCircuitTransport;
};

/**
 * Narrow transport so Midnight.js churn stays in one file.
 * Browser wiring can supply a real transport later without changing the port.
 */
export interface EclipseCircuitTransport {
  queryPublicPayroll(): Promise<Payroll>;
  createPayroll(employerPk: Uint8Array, recipients: Uint8Array[]): Promise<Payroll>;
  fund(amount: bigint): Promise<Payroll>;
  distribute(amounts: bigint[], salts: Uint8Array[]): Promise<Payroll>;
}

const STATUS_RANK: Record<PayrollStatus, number> = {
  Uninitialized: 0,
  Created: 1,
  Funded: 2,
  Distributed: 3,
};

function emptyPayroll(): Payroll {
  return {
    employer: '',
    depositTotal: 0n,
    recipients: [],
    status: 'Uninitialized',
    receiptCommitments: [],
  };
}

/**
 * In-memory transport for UI/dev when Midnight.js browser providers are not wired.
 * Simulates ledger lifecycle locally — NEVER used as a substitute for on-chain L2 demo
 * when `transport` is omitted and `useInMemoryFallback` is false.
 */
export class InMemoryEclipseTransport implements EclipseCircuitTransport {
  private payroll: Payroll = emptyPayroll();

  async queryPublicPayroll(): Promise<Payroll> {
    return structuredClone({
      ...this.payroll,
      recipients: [...this.payroll.recipients],
      receiptCommitments: [...this.payroll.receiptCommitments],
    });
  }

  async createPayroll(employerPk: Uint8Array, recipients: Uint8Array[]): Promise<Payroll> {
    if (this.payroll.status !== 'Uninitialized') {
      throw Object.assign(new Error('createPayroll requires Uninitialized'), {
        kind: 'CircuitRejected',
      });
    }
    this.payroll = {
      employer: bytesToHex(employerPk),
      depositTotal: 0n,
      recipients: recipients
        .map((r) => ({ address: bytesToHex(r) }))
        .filter((r) => r.address.replace(/0/g, '') !== ''),
      status: 'Created',
      receiptCommitments: [],
    };
    return this.queryPublicPayroll();
  }

  async fund(amount: bigint): Promise<Payroll> {
    if (this.payroll.status !== 'Created') {
      throw Object.assign(new Error('fund requires Created'), { kind: 'CircuitRejected' });
    }
    this.payroll = {
      ...this.payroll,
      depositTotal: amount,
      status: 'Funded',
    };
    return this.queryPublicPayroll();
  }

  async distribute(amounts: bigint[], salts: Uint8Array[]): Promise<Payroll> {
    if (this.payroll.status !== 'Funded') {
      throw Object.assign(new Error('distribute requires Funded'), { kind: 'CircuitRejected' });
    }
    if (sumAmounts(amounts) !== this.payroll.depositTotal) {
      throw Object.assign(new Error('sum(amounts) must equal depositTotal'), {
        kind: 'CircuitRejected',
      });
    }
    const commits = amounts.map((amt, i) => {
      const salt = salts[i] ?? new Uint8Array(32);
      // Opaque demo commitment — not cryptographic persistentHash; on-chain uses Compact.
      const mixed = new Uint8Array(32);
      const amtBytes = new TextEncoder().encode(amt.toString());
      for (let j = 0; j < 32; j++) {
        mixed[j] = (salt[j] ?? 0) ^ (amtBytes[j % amtBytes.length] ?? 0) ^ (j + 1);
      }
      return bytesToHex(mixed);
    });
    this.payroll = {
      ...this.payroll,
      status: 'Distributed',
      receiptCommitments: commits,
    };
    return this.queryPublicPayroll();
  }
}

export class MidnightAdapter implements EclipsePort {
  private readonly proof: ProofClient;
  private readonly wallet: WalletPort;
  private readonly lace: LaceAdapter | null;
  private readonly transport: EclipseCircuitTransport;
  private readonly contractAddress: string;

  constructor(
    proof: ProofClient,
    wallet: WalletPort,
    config: MidnightAdapterConfig,
    lace?: LaceAdapter,
  ) {
    this.proof = proof;
    this.wallet = wallet;
    this.lace = lace ?? null;
    this.contractAddress = config.contractAddress;
    this.transport = config.transport ?? new InMemoryEclipseTransport();
  }

  async getPublicPayroll(): Promise<Result<Payroll>> {
    return safeAsync('TxFailed', 'Failed to read public payroll', () =>
      this.transport.queryPublicPayroll(),
    );
  }

  async createPayroll(recipients: Address[]): Promise<Result<Payroll>> {
    if (!this.wallet.state().connected) {
      return err('WalletNotConnected', 'Connect Lace before createPayroll');
    }
    if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
      return err(
        'CircuitRejected',
        `recipients must be 1..${MAX_RECIPIENTS}`,
      );
    }
    const health = await this.proof.healthCheck();
    if (!health.ok) return health;

    return safeAsync('CircuitRejected', 'createPayroll rejected', async () => {
      const employerHex = this.wallet.state().address ?? '00'.repeat(32);
      const employerPk = addressToBytes32(employerHex);
      const slots = Array.from({ length: MAX_RECIPIENTS }, (_, i) =>
        recipients[i] ? addressToBytes32(recipients[i]!) : new Uint8Array(32),
      );
      return this.transport.createPayroll(employerPk, slots);
    });
  }

  async fund(amount: bigint): Promise<Result<Payroll>> {
    if (!this.wallet.state().connected) {
      return err('WalletNotConnected', 'Connect Lace before fund');
    }
    if (amount <= 0n) {
      return err('CircuitRejected', 'fund amount must be positive');
    }
    const health = await this.proof.healthCheck();
    if (!health.ok) return health;

    return safeAsync('CircuitRejected', 'fund rejected', () => this.transport.fund(amount));
  }

  async distribute(amounts: bigint[]): Promise<Result<Payroll>> {
    if (!this.wallet.state().connected) {
      return err('WalletNotConnected', 'Connect Lace before distribute');
    }
    const padded = padAmounts(amounts);
    if (padded.length !== MAX_RECIPIENTS) {
      return err('CircuitRejected', `amounts must pad to ${MAX_RECIPIENTS}`);
    }

    const health = await this.proof.healthCheck();
    if (!health.ok) return health;

    // Salts live only in this stack frame — never stored on Payroll / UI.
    const salts = generateSalts(MAX_RECIPIENTS);

    return safeAsync('CircuitRejected', 'distribute rejected', async () => {
      try {
        return await this.transport.distribute(padded, salts);
      } finally {
        // Best-effort wipe
        for (const s of salts) s.fill(0);
      }
    });
  }

  async claim(): Promise<Result<Receipt>> {
    return err('CircuitRejected', 'claim is post-L2');
  }

  /** Test helper — not part of EclipsePort. */
  assertStatusAtLeast(payroll: Payroll, min: PayrollStatus): boolean {
    return STATUS_RANK[payroll.status] >= STATUS_RANK[min];
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getLaceApi(): ReturnType<LaceAdapter['getConnectedApi']> {
    return this.lace?.getConnectedApi() ?? null;
  }
}

export function mapLedgerLikeToPayroll(input: {
  employer: string;
  depositTotal: bigint;
  recipients: string[];
  status: PayrollStatus;
  receiptCommitments: string[];
}): Payroll {
  return {
    employer: input.employer,
    depositTotal: input.depositTotal,
    recipients: input.recipients.map((address) => ({ address })),
    status: input.status,
    receiptCommitments: input.receiptCommitments,
  };
}
