import { describe, it, expect } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  dummyUserAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/eclipse/contract/index.js';

const ZERO_PK = new Uint8Array(32);
const STATUS_FUNDED = 1;
const STATUS_DISTRIBUTED = 2;

function recipientsWithOneActive(): Uint8Array[] {
  const pk = new Uint8Array(32);
  pk[0] = 0xaa;
  return [pk, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK];
}

function eightSalts(): Uint8Array[] {
  return Array.from({ length: 8 }, (_, i) => {
    const s = new Uint8Array(32);
    s[0] = i + 1;
    return s;
  });
}

function fundedContext(depositTotal: bigint) {
  const contract = new Contract({});
  const ctorCtx = createConstructorContext(null, dummyUserAddress());
  const init = contract.initialState(ctorCtx, depositTotal, recipientsWithOneActive());
  const circuitCtx = createCircuitContext(
    dummyContractAddress(),
    init.currentZswapLocalState,
    init.currentContractState.data,
    init.currentPrivateState,
  );
  return { contract, circuitCtx, init };
}

describe('distribute sum-proof (Gate 0)', () => {
  it('distribute_accepts_when_sum_equals_total', () => {
    const depositTotal = 100n;
    const { contract, circuitCtx, init } = fundedContext(depositTotal);

    expect(ledger(init.currentContractState.data).status).toBe(STATUS_FUNDED);
    expect(ledger(init.currentContractState.data).depositTotal).toBe(depositTotal);

    const amounts = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const { context } = contract.impureCircuits.distribute(circuitCtx, amounts, eightSalts());
    const after = ledger(context.currentQueryContext.state);

    expect(after.status).toBe(STATUS_DISTRIBUTED);
    expect(after.receiptCommitments[0].some((b) => b !== 0)).toBe(true);
  });

  it('distribute_rejects_when_sum_exceeds_total', () => {
    const depositTotal = 100n;
    const { contract, circuitCtx } = fundedContext(depositTotal);
    const amounts = [101n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    expect(() => contract.impureCircuits.distribute(circuitCtx, amounts, eightSalts())).toThrow(
      /sum\(amounts\) must equal depositTotal/,
    );
  });
});
