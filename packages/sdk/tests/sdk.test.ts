import { describe, it, expect, vi, afterEach } from 'vitest';
import { ok, err } from '../src/types/result';
import { MAX_RECIPIENTS } from '../src/types/domain';
import { ProofClient } from '../src/proof/ProofClient';
import {
  generateSalts,
  padAmounts,
  sumAmounts,
  addressToBytes32,
  bytesToHex,
} from '../src/contract/witnessHelpers';
import { MemoryReceiptStore } from '../src/private/MemoryReceiptStore';
import {
  InMemoryEclipseTransport,
  MidnightAdapter,
} from '../src/contract/MidnightAdapter';
import { createEclipseSdk } from '../src/createEclipseSdk';
import type { WalletPort, WalletState } from '../src/wallet/WalletPort';

function mockWallet(connected = true): WalletPort {
  const state: WalletState = {
    connected,
    address: connected ? 'aa'.repeat(32) : null,
  };
  return {
    connect: async () => ok(state),
    disconnect: async () => ok(undefined),
    state: () => state,
    sign: async (p) => ok(p),
  };
}

describe('Result helpers', () => {
  it('ok and err shapes', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    const e = err('TxFailed', 'boom');
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.error.kind).toBe('TxFailed');
  });
});

describe('witnessHelpers', () => {
  it('pads amounts to MAX_RECIPIENTS', () => {
    expect(padAmounts([1n, 2n])).toHaveLength(MAX_RECIPIENTS);
    expect(sumAmounts(padAmounts([10n, 20n]))).toBe(30n);
  });

  it('generateSalts length and randomness', () => {
    const a = generateSalts();
    const b = generateSalts();
    expect(a).toHaveLength(MAX_RECIPIENTS);
    expect(a[0]).toHaveLength(32);
    expect(Buffer.from(a[0]!).equals(Buffer.from(b[0]!))).toBe(false);
  });

  it('addressToBytes32 accepts 64-hex', () => {
    const b = addressToBytes32('ab'.repeat(32));
    expect(b).toHaveLength(32);
  });
});

describe('ProofClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-loopback URLs by default', () => {
    expect(
      () => new ProofClient({ proofServerUrl: 'https://evil.example/proof' }),
    ).toThrow(/loopback/);
  });

  it('healthCheck maps network failure to ProofServerDown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const client = new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' });
    const res = await client.healthCheck();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('ProofServerDown');
  });

  it('healthCheck succeeds on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const client = new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' });
    const res = await client.healthCheck();
    expect(res.ok).toBe(true);
  });
});

describe('MidnightAdapter lifecycle (in-memory transport)', () => {
  it('create → fund → distribute and claim is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const transport = new InMemoryEclipseTransport();
    const wallet = mockWallet(true);
    const proof = new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' });
    const adapter = new MidnightAdapter(proof, wallet, {
      contractAddress: 'deadbeef',
      network: 'preprod',
      transport,
    });

    const recipients = ['11'.repeat(32), '22'.repeat(32)];
    const created = await adapter.createPayroll(recipients);
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.status).toBe('Created');

    const funded = await adapter.fund(100n);
    expect(funded.ok).toBe(true);
    if (funded.ok) expect(funded.value.status).toBe('Funded');

    const dist = await adapter.distribute([60n, 40n]);
    expect(dist.ok).toBe(true);
    if (dist.ok) {
      expect(dist.value.status).toBe('Distributed');
      expect(dist.value.receiptCommitments.length).toBe(MAX_RECIPIENTS);
      // Public snapshot must not expose private amounts as fields
      expect(dist.value).not.toHaveProperty('amounts');
    }

    // distribute() stored an opening for slot 0, so claiming it succeeds and
    // flips only the public flag.
    const claim = await adapter.claim(0);
    expect(claim.ok).toBe(true);

    const after = await adapter.getPublicPayroll();
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value.claimed[0]).toBe(true);
      expect(after.value.claimed[1]).toBe(false);
    }

    // Slot 1 was funded too, but re-claiming slot 0 must be rejected.
    const again = await adapter.claim(0);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.kind).toBe('CircuitRejected');
  });

  it('distribute rejects when wallet disconnected', async () => {
    const adapter = new MidnightAdapter(
      new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' }),
      mockWallet(false),
      {
        contractAddress: 'x',
        network: 'preprod',
        transport: new InMemoryEclipseTransport(),
      },
    );
    const res = await adapter.distribute([1n]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('WalletNotConnected');
  });

  it('distribute rejects bad sum', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const transport = new InMemoryEclipseTransport();
    const adapter = new MidnightAdapter(
      new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' }),
      mockWallet(true),
      { contractAddress: 'x', network: 'preprod', transport },
    );
    await adapter.createPayroll(['11'.repeat(32)]);
    await adapter.fund(10n);
    const res = await adapter.distribute([11n]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('CircuitRejected');
  });
});

describe('claim (private receipt openings)', () => {
  /** Transport that records what the claim circuit was actually given. */
  function claimingTransport() {
    const base = new InMemoryEclipseTransport();
    const calls: { slot: number; amount: bigint; salt: string }[] = [];
    const transport = {
      queryPublicPayroll: () => base.queryPublicPayroll(),
      createPayroll: (pk: Uint8Array, r: Uint8Array[]) => base.createPayroll(pk, r),
      fund: (a: bigint) => base.fund(a),
      distribute: (a: bigint[], s: Uint8Array[]) => base.distribute(a, s),
      claim: async (slot: number, amount: bigint, _pk: Uint8Array, salt: Uint8Array) => {
        calls.push({ slot, amount, salt: bytesToHex(salt) });
        return base.queryPublicPayroll();
      },
    };
    return { transport, calls };
  }

  async function distributedAdapter() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const { transport, calls } = claimingTransport();
    const store = new MemoryReceiptStore();
    const adapter = new MidnightAdapter(
      new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' }),
      mockWallet(true),
      { contractAddress: 'deadbeef', network: 'preprod', transport, receiptStore: store },
    );
    await adapter.createPayroll(['11'.repeat(32), '22'.repeat(32)]);
    await adapter.fund(100n);
    await adapter.distribute([60n, 40n]);
    return { adapter, calls, store };
  }

  it('distribute persists an opening per funded slot only', async () => {
    const { store } = await distributedAdapter();
    const receipts = await store.list('deadbeef');

    // Two funded slots out of eight — zero-amount padding must not be stored.
    expect(receipts.map((r) => r.slot)).toEqual([0, 1]);
    expect(receipts.map((r) => r.amount)).toEqual([60n, 40n]);
    for (const r of receipts) expect(r.saltHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('claim passes the stored amount and salt to the circuit', async () => {
    const { adapter, calls, store } = await distributedAdapter();
    const stored = await store.get('deadbeef', 1);

    const res = await adapter.claim(1);
    expect(res.ok).toBe(true);

    // The salt reaching the circuit must be the one distribute() committed —
    // a regenerated salt would produce a different hash and fail on-chain.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.slot).toBe(1);
    expect(calls[0]!.amount).toBe(40n);
    expect(calls[0]!.salt).toBe(stored!.saltHex);
  });

  it('claim rejects a slot with no local receipt', async () => {
    const { adapter } = await distributedAdapter();
    const res = await adapter.claim(5);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/no local receipt for slot 5/);
  });

  it('claim rejects an out-of-range slot', async () => {
    const { adapter } = await distributedAdapter();
    const res = await adapter.claim(MAX_RECIPIENTS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/slot must be 0\.\./);
  });

  it('claim rejects when the wallet is disconnected', async () => {
    const { transport } = claimingTransport();
    const adapter = new MidnightAdapter(
      new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' }),
      mockWallet(false),
      { contractAddress: 'deadbeef', network: 'preprod', transport },
    );
    const res = await adapter.claim(0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('WalletNotConnected');
  });

  it('local receipts never expose amounts on the public payroll', async () => {
    const { adapter } = await distributedAdapter();
    const payroll = await adapter.getPublicPayroll();
    expect(payroll.ok).toBe(true);
    if (payroll.ok) {
      // Assert on shape, not on serialized bytes: commitments are random hex, so
      // any short decimal string ("60") appears inside them by chance. The real
      // claim is that no amount-bearing field exists on the public snapshot.
      expect(payroll.value).not.toHaveProperty('amounts');
      expect(payroll.value).not.toHaveProperty('salts');
      expect(Object.keys(payroll.value).sort()).toEqual([
        'claimed',
        'depositTotal',
        'employer',
        'receiptCommitments',
        'recipients',
        'status',
      ]);
      // depositTotal is the public pool total, never a per-recipient amount.
      expect(payroll.value.depositTotal).toBe(100n);
      // Recipients carry addresses only — no amount rides along.
      for (const r of payroll.value.recipients) {
        expect(Object.keys(r)).toEqual(['address']);
      }
    }
  });

  it('lists claimable slots without exposing receipt openings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const store = new MemoryReceiptStore();
    const adapter = new MidnightAdapter(
      new ProofClient({ proofServerUrl: 'http://127.0.0.1:6300' }),
      mockWallet(true),
      {
        contractAddress: 'abc',
        network: 'preprod',
        transport: new InMemoryEclipseTransport(),
        receiptStore: store,
      },
    );

    await adapter.createPayroll(['bb'.repeat(32)]);
    await adapter.fund(100n);
    await adapter.distribute([100n]);

    const result = await adapter.listClaimableReceipts();
    expect(result).toEqual(ok([{ slot: 0, recipient: 'bb'.repeat(32) }]));
    if (result.ok) {
      expect(result.value[0]).not.toHaveProperty('amount');
      expect(result.value[0]).not.toHaveProperty('saltHex');
    }
  });
});

describe('createEclipseSdk', () => {
  it('wires wallet + eclipse + proof', () => {
    const sdk = createEclipseSdk({
      contractAddress: 'abc',
      network: 'preprod',
      wallet: mockWallet(true),
      transport: new InMemoryEclipseTransport(),
    });
    expect(sdk.wallet).toBeDefined();
    expect(sdk.eclipse).toBeDefined();
    expect(sdk.proof).toBeInstanceOf(ProofClient);
  });
});
