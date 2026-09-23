import type { Address, Payroll, PayrollStatus, Receipt, Result } from '../types';
import { MAX_RECIPIENTS } from '../types/domain';
import { err } from '../types/result';
import { safeAsync } from '../internal/safeAsync';
import type { ProofClient } from '../proof/ProofClient';
import type { WalletPort } from '../wallet/WalletPort';
import type { LaceAdapter } from '../wallet/LaceAdapter';
import type { EclipsePort } from './EclipsePort';
import type { ReceiptStorePort } from '../private/ReceiptStorePort';
import type { ReceiptRecord } from '../types/receiptRecord';
import { MemoryReceiptStore } from '../private/MemoryReceiptStore';
import {
  addressToBytes32,
  bytesToHex,
  generateSalts,
  hexToBytes32,
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
  /**
   * Private store for receipt openings. Defaults to in-memory, which means
   * receipts are lost on reload — the safe failure mode, since the alternative
   * is persisting private openings unencrypted.
   */
  receiptStore?: ReceiptStorePort;
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
  /** Opens one receipt commitment. `amount` and `salt` stay private witnesses. */
  claim?(
    slot: number,
    amount: bigint,
    recipientPk: Uint8Array,
    salt: Uint8Array,
  ): Promise<Payroll>;
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
    claimed: Array.from({ length: MAX_RECIPIENTS }, () => false),
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
      claimed: [...this.payroll.claimed],
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
      claimed: Array.from({ length: MAX_RECIPIENTS }, () => false),
      receiptCommitments: [],
    };
    return this.queryPublicPayroll();
  }

  /** Mock deposit: records depositTotal only — no tokens move off-chain. */
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

  /**
   * Demo claim. Mirrors the contract's public effect — flip `claimed[slot]` — so
   * the dual-view demo runs without a proof server. The real entitlement check
   * lives in the Compact circuit; this only enforces order and double-claiming.
   */
  async claim(slot: number): Promise<Payroll> {
    if (this.payroll.status !== 'Distributed') {
      throw Object.assign(new Error('claim requires Distributed'), {
        kind: 'CircuitRejected',
      });
    }
    if (this.payroll.claimed[slot]) {
      throw Object.assign(new Error('slot already claimed'), { kind: 'CircuitRejected' });
    }
    const claimed = [...this.payroll.claimed];
    claimed[slot] = true;
    this.payroll = { ...this.payroll, claimed };
    return this.queryPublicPayroll();
  }
}

export class MidnightAdapter implements EclipsePort {
  private readonly proof: ProofClient;
  private readonly wallet: WalletPort;
  private readonly lace: LaceAdapter | null;
  private readonly transport: EclipseCircuitTransport;
  private readonly contractAddress: string;
  private readonly receipts: ReceiptStorePort;

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
    this.receipts = config.receiptStore ?? new MemoryReceiptStore();
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
        const payroll = await this.transport.distribute(padded, salts);

        // Persist openings BEFORE the wipe below — claim() re-derives
        // H(amount, pk, salt), so a lost salt makes a slot permanently
        // unclaimable. Only non-zero slots are real recipients.
        for (let slot = 0; slot < padded.length; slot++) {
          const amount = padded[slot]!;
          if (amount === 0n) continue;
          await this.receipts.put(this.contractAddress, {
            slot,
            recipient: payroll.recipients[slot]?.address ?? '',
            amount,
            saltHex: bytesToHex(salts[slot]!),
          });
        }

        return payroll;
      } finally {
        // Best-effort wipe
        for (const s of salts) s.fill(0);
      }
    });
  }

  /**
   * Prove entitlement to `slot` without revealing the amount.
   *
   * The opening comes from local private storage; the amount and salt are passed
   * to the circuit as witnesses and never written to the ledger. The only public
   * effect is `claimed[slot] = true`.
   */
  async claim(slot = 0): Promise<Result<Receipt>> {
    if (!this.wallet.state().connected) {
      return err('WalletNotConnected', 'Connect Lace before claim');
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_RECIPIENTS) {
      return err('CircuitRejected', `slot must be 0..${MAX_RECIPIENTS - 1}`);
    }
    if (!this.transport.claim) {
      return err('CircuitRejected', 'transport does not support claim');
    }

    const record = await this.receipts.get(this.contractAddress, slot);
    if (!record) {
      return err('CircuitRejected', `no local receipt for slot ${slot}`);
    }

    const health = await this.proof.healthCheck();
    if (!health.ok) return health;

    const salt = hexToBytes32(record.saltHex);
    return safeAsync('CircuitRejected', 'claim rejected', async () => {
      try {
        await this.transport.claim!(
          slot,
          record.amount,
          addressToBytes32(record.recipient),
          salt,
        );
        return { recipient: record.recipient, commitment: '' } satisfies Receipt;
      } finally {
        salt.fill(0);
      }
    });
  }

  /** Openings this wallet holds locally. Never leaves the device. */
  async listLocalReceipts(): Promise<ReceiptRecord[]> {
    return this.receipts.list(this.contractAddress);
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
  claimed?: boolean[];
}): Payroll {
  return {
    employer: input.employer,
    depositTotal: input.depositTotal,
    recipients: input.recipients.map((address) => ({ address })),
    status: input.status,
    receiptCommitments: input.receiptCommitments,
    // Older ledger reads predate the claimed vector; treat absent as all-false.
    claimed:
      input.claimed ?? Array.from({ length: MAX_RECIPIENTS }, () => false),
  };
}
