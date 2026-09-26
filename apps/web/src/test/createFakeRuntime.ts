import {
  MAX_RECIPIENTS,
  err,
  ok,
  type ClaimableReceipt,
  type EclipsePort,
  type Payroll,
  type WalletPort,
  type WalletState,
} from '@eclipse/sdk';
import type { EclipseRuntime } from '../shared/runtime/EclipseRuntime';

/** A payroll already distributed to one recipient — for tests that start post-distribute. */
export const distributedPayrollFixture: Payroll = {
  employer: 'aa'.repeat(32),
  depositTotal: 100n,
  recipients: [{ address: 'bb'.repeat(32) }],
  status: 'Distributed',
  receiptCommitments: ['cc'.repeat(32)],
  claimed: Array.from({ length: MAX_RECIPIENTS }, () => false),
};

function createEmptyPayroll(): Payroll {
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
 * Fake runtime for tests: implements `WalletPort`/`EclipsePort` directly, no
 * adapters. Public payroll state and safe claim metadata are tracked separately,
 * mirroring the privacy boundary `MidnightAdapter` enforces in production.
 */
export function createFakeRuntime({
  connected = true,
  initialPayroll,
}: { connected?: boolean; initialPayroll?: Payroll } = {}): EclipseRuntime {
  // structuredClone: callers may reuse a shared fixture (e.g. distributedPayrollFixture)
  // across tests; mutating the runtime's own copy must never leak back into it.
  let payroll = initialPayroll ? structuredClone(initialPayroll) : createEmptyPayroll();
  const claims: ClaimableReceipt[] = [];
  let walletState: WalletState = {
    connected,
    address: connected ? 'aa'.repeat(32) : null,
  };

  const wallet: WalletPort = {
    connect: async () => {
      walletState = { connected: true, address: 'aa'.repeat(32) };
      return ok(walletState);
    },
    disconnect: async () => {
      walletState = { connected: false, address: null };
      return ok(undefined);
    },
    state: () => walletState,
    sign: async (payload) => ok(payload),
  };

  const eclipse: EclipsePort = {
    getPublicPayroll: async () => ok(structuredClone(payroll)),
    createPayroll: async (recipients) => {
      payroll = {
        ...createEmptyPayroll(),
        employer: walletState.address ?? '',
        recipients: recipients.map((address) => ({ address })),
        status: 'Created',
      };
      return ok(payroll);
    },
    fund: async (amount) => {
      payroll = { ...payroll, depositTotal: amount, status: 'Funded' };
      return ok(payroll);
    },
    distribute: async () => {
      payroll = {
        ...payroll,
        status: 'Distributed',
        receiptCommitments: payroll.recipients.map(() => 'cc'.repeat(32)),
      };
      claims.splice(
        0,
        claims.length,
        ...payroll.recipients.map(({ address }, slot) => ({ slot, recipient: address })),
      );
      return ok(payroll);
    },
    listClaimableReceipts: async () => ok([...claims]),
    claim: async (slot = 0) => {
      const receipt = claims.find((candidate) => candidate.slot === slot);
      if (!receipt) return err('CircuitRejected', `no local receipt for slot ${slot}`);
      const claimed = [...payroll.claimed];
      claimed[slot] = true;
      payroll = { ...payroll, claimed };
      return ok({ recipient: receipt.recipient, commitment: '' });
    },
  };

  return {
    sdk: { wallet, eclipse },
    mode: 'demo',
    contractAddress: 'test-contract',
    explorerUrl: 'https://example.test/contract/test-contract',
    debug: false,
  };
}
