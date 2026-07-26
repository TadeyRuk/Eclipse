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
  const contract = new Contract<null>({});
  const ctorCtx = createConstructorContext<null>(null, dummyUserAddress());
  const init = contract.initialState(ctorCtx);
  // Eclipse declares no witnesses, so private state is `null` throughout;
  // createCircuitContext infers `unknown` without this annotation.
  const circuitCtx: CircuitContext<null> = createCircuitContext<null>(
    dummyContractAddress(),
    init.currentZswapLocalState,
    init.currentContractState.data,
    init.currentPrivateState,
  );
  return { contract, circuitCtx, init };
}

function createThenFund(
  contract: Contract<null>,
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
    const firstCommitment = after.receiptCommitments[0];
    expect(firstCommitment).toBeDefined();
    expect(firstCommitment!.some((b) => b !== 0)).toBe(true);
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

describe('claim', () => {
  const AMOUNT = 40n;

  /** Distribute AMOUNT to slot 0, returning the post-distribute context and its salts. */
  function distributedContract() {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, AMOUNT);
    const salts = eightSalts();
    const { context } = contract.impureCircuits.distribute(
      fundedCtx,
      [AMOUNT, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
      salts,
    );
    return { contract, context, salts };
  }

  it('claim_accepts_valid_commitment_opening', () => {
    const { contract, context, salts } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;

    const { context: after } = contract.impureCircuits.claim(
      context,
      0n,
      AMOUNT,
      recipient,
      salts[0]!,
    );

    expect(ledger(after.currentQueryContext.state).claimed[0]).toBe(true);
  });

  it('claim_leaves_other_slots_unclaimed', () => {
    const { contract, context, salts } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;

    const { context: after } = contract.impureCircuits.claim(
      context,
      0n,
      AMOUNT,
      recipient,
      salts[0]!,
    );

    const flags = ledger(after.currentQueryContext.state).claimed;
    for (const i of [1, 2, 3, 4, 5, 6, 7]) {
      expect(flags[i]).toBe(false);
    }
  });

  it('claim_rejects_wrong_amount', () => {
    const { contract, context, salts } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;

    // A different amount hashes to a different commitment — this is the core
    // guarantee: a recipient cannot claim more than they were committed.
    expect(() =>
      contract.impureCircuits.claim(context, 0n, AMOUNT + 1n, recipient, salts[0]!),
    ).toThrow(/commitment mismatch for slot/);
  });

  it('claim_rejects_double_claim', () => {
    const { contract, context, salts } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;

    const { context: after } = contract.impureCircuits.claim(
      context,
      0n,
      AMOUNT,
      recipient,
      salts[0]!,
    );

    expect(() => contract.impureCircuits.claim(after, 0n, AMOUNT, recipient, salts[0]!)).toThrow(
      /slot already claimed/,
    );
  });

  it('claim_rejects_before_distribute', () => {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, AMOUNT);
    const recipient = recipientsWithOneActive()[0]!;

    expect(() =>
      contract.impureCircuits.claim(fundedCtx, 0n, AMOUNT, recipient, eightSalts()[0]!),
    ).toThrow(/claim requires Distributed status/);
  });
});
