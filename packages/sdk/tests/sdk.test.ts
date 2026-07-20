import { describe, it, expect, vi, afterEach } from 'vitest';
import { ok, err } from '../src/types/result';
import { MAX_RECIPIENTS } from '../src/types/domain';
import { ProofClient } from '../src/proof/ProofClient';
import {
  generateSalts,
  padAmounts,
  sumAmounts,
  addressToBytes32,
} from '../src/contract/witnessHelpers';
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

    const claim = await adapter.claim();
    expect(claim.ok).toBe(false);
    if (!claim.ok) expect(claim.error.kind).toBe('CircuitRejected');
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
