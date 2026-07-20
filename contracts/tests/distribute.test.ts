import { describe, it, expect } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  dummyUserAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/eclipse/contract/index.js';

const ZERO_PK = new Uint8Array(32);
const STATUS_UNINITIALIZED = 0;
const STATUS_CREATED = 1;
const STATUS_FUNDED = 2;
const STATUS_DISTRIBUTED = 3;

function recipientsWithOneActive(): Uint8Array[] {
  const pk = new Uint8Array(32);
  pk[0] = 0xaa;
  return [pk, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK, ZERO_PK];
}

function employerPk(): Uint8Array {
  const pk = new Uint8Array(32);
  pk[0] = 0xee;
  return pk;
}

function eightSalts(): Uint8Array[] {
  return Array.from({ length: 8 }, (_, i) => {
    const s = new Uint8Array(32);
    s[0] = i + 1;
    return s;
  });
}

function freshContract() {
  const contract = new Contract({});
  const ctorCtx = createConstructorContext(null, dummyUserAddress());
  const init = contract.initialState(ctorCtx);
  let circuitCtx = createCircuitContext(
    dummyContractAddress(),
    init.currentZswapLocalState,
    init.currentContractState.data,
    init.currentPrivateState,
  );
  return { contract, circuitCtx, init };
}

function createThenFund(
  contract: InstanceType<typeof Contract>,
  circuitCtx: CircuitContext<null>,
  depositTotal: bigint,
) {
  let ctx = circuitCtx;
  ({ context: ctx } = contract.impureCircuits.createPayroll(
    ctx,
    employerPk(),
    recipientsWithOneActive(),
  ));
  ({ context: ctx } = contract.impureCircuits.fund(ctx, depositTotal));
  return ctx;
}

describe('distribute sum-proof', () => {
  it('distribute_accepts_when_sum_equals_total', () => {
    const depositTotal = 100n;
    const { contract, circuitCtx, init } = freshContract();
    expect(ledger(init.currentContractState.data).status).toBe(STATUS_UNINITIALIZED);

    const fundedCtx = createThenFund(contract, circuitCtx, depositTotal);
    expect(ledger(fundedCtx.currentQueryContext.state).status).toBe(STATUS_FUNDED);
    expect(ledger(fundedCtx.currentQueryContext.state).depositTotal).toBe(depositTotal);

    const amounts = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const { context } = contract.impureCircuits.distribute(fundedCtx, amounts, eightSalts());
    const after = ledger(context.currentQueryContext.state);

    expect(after.status).toBe(STATUS_DISTRIBUTED);
    expect(after.receiptCommitments[0].some((b) => b !== 0)).toBe(true);
  });

  it('distribute_rejects_when_sum_exceeds_total', () => {
    const depositTotal = 100n;
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, depositTotal);
    const amounts = [101n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    expect(() => contract.impureCircuits.distribute(fundedCtx, amounts, eightSalts())).toThrow(
      /sum\(amounts\) must equal depositTotal/,
    );
  });
});

describe('lifecycle', () => {
  it('create_then_fund_then_distribute_succeeds', () => {
    const { contract, circuitCtx } = freshContract();
    let ctx = circuitCtx;

    ({ context: ctx } = contract.impureCircuits.createPayroll(
      ctx,
      employerPk(),
      recipientsWithOneActive(),
    ));
    expect(ledger(ctx.currentQueryContext.state).status).toBe(STATUS_CREATED);

    ({ context: ctx } = contract.impureCircuits.fund(ctx, 50n));
    expect(ledger(ctx.currentQueryContext.state).status).toBe(STATUS_FUNDED);

    ({ context: ctx } = contract.impureCircuits.distribute(
      ctx,
      [50n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
      eightSalts(),
    ));
    expect(ledger(ctx.currentQueryContext.state).status).toBe(STATUS_DISTRIBUTED);
  });

  it('distribute_rejects_before_fund', () => {
    const { contract, circuitCtx } = freshContract();
    let ctx = circuitCtx;
    ({ context: ctx } = contract.impureCircuits.createPayroll(
      ctx,
      employerPk(),
      recipientsWithOneActive(),
    ));

    expect(() =>
      contract.impureCircuits.distribute(ctx, [1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n], eightSalts()),
    ).toThrow(/distribute requires Funded status/);
  });

  it('distribute_rejects_when_already_distributed', () => {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, 10n);
    const amounts = [10n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const salts = eightSalts();
    const { context } = contract.impureCircuits.distribute(fundedCtx, amounts, salts);

    expect(() => contract.impureCircuits.distribute(context, amounts, salts)).toThrow(
      /distribute requires Funded status/,
    );
  });
});
