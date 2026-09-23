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

describe('distribute edge cases', () => {
  it('distribute_rejects_when_sum_below_total', () => {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, 100n);
    const amounts = [99n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    expect(() => contract.impureCircuits.distribute(fundedCtx, amounts, eightSalts())).toThrow(
      /sum\(amounts\) must equal depositTotal/,
    );
  });

  it('distribute_rejects_amount_on_unused_slot', () => {
    // Slot 1 has no recipient. Even though 60 + 40 equals the deposit, parking
    // value on an empty slot would strand funds, so padding must be zero.
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, 100n);
    const amounts = [60n, 40n, 0n, 0n, 0n, 0n, 0n, 0n];
    expect(() => contract.impureCircuits.distribute(fundedCtx, amounts, eightSalts())).toThrow(
      /nonzero amount on unused recipient slot/,
    );
  });
});

describe('public ledger never holds an amount', () => {
  function distributeWith(salts: Uint8Array[]) {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, 100n);
    const { context } = contract.impureCircuits.distribute(
      fundedCtx,
      [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
      salts,
    );
    return ledger(context.currentQueryContext.state);
  }

  it('ledger_exposes_only_documented_public_fields', () => {
    // docs/privacy-model.md lists exactly these public fields. A new field would
    // be a new public fact, so it must fail here until it is documented.
    const after = distributeWith(eightSalts());
    expect(Object.keys(after).sort()).toEqual(
      ['claimed', 'depositTotal', 'employer', 'receiptCommitments', 'recipients', 'status'].sort(),
    );
  });

  it('commitments_are_salted_so_equal_amounts_do_not_match', () => {
    // Same payroll, different salts: commitments differ, so an observer cannot
    // link or guess amounts by hashing candidate values.
    const other = eightSalts().map((s) => {
      const t = new Uint8Array(s);
      t[31] = 0xff;
      return t;
    });
    const a = distributeWith(eightSalts()).receiptCommitments[0]!;
    const b = distributeWith(other).receiptCommitments[0]!;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe('fund', () => {
  // The native token (tNIGHT on Preprod) is the all-zero unshielded token type.
  const NATIVE_TOKEN_RAW = '0'.repeat(64);

  function unshieldedInputs(ctx: CircuitContext<null>): Array<[string, string, bigint]> {
    return [...ctx.currentQueryContext.effects.unshieldedInputs.entries()].map(
      ([token, amount]) => [token.tag, 'raw' in token ? token.raw : '', amount],
    );
  }

  it('fund_requires_unshielded_native_deposit_of_amount', () => {
    const { contract, circuitCtx } = freshContract();
    let ctx = circuitCtx;
    ({ context: ctx } = contract.impureCircuits.createPayroll(
      ctx,
      employerPk(),
      recipientsWithOneActive(),
    ));
    expect(unshieldedInputs(ctx)).toEqual([]);

    ({ context: ctx } = contract.impureCircuits.fund(ctx, 250n));
    expect(unshieldedInputs(ctx)).toEqual([['unshielded', NATIVE_TOKEN_RAW, 250n]]);
    expect(ledger(ctx.currentQueryContext.state).depositTotal).toBe(250n);
  });

  it('fund_rejects_before_create', () => {
    const { contract, circuitCtx } = freshContract();
    expect(() => contract.impureCircuits.fund(circuitCtx, 10n)).toThrow(
      /fund requires Created status/,
    );
  });

  it('fund_rejects_when_already_funded', () => {
    const { contract, circuitCtx } = freshContract();
    const fundedCtx = createThenFund(contract, circuitCtx, 10n);
    expect(() => contract.impureCircuits.fund(fundedCtx, 10n)).toThrow(
      /fund requires Created status/,
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

  it('claim_rejects_wrong_salt', () => {
    const { contract, context } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;
    const wrongSalt = new Uint8Array(32).fill(9);
    expect(() => contract.impureCircuits.claim(context, 0n, AMOUNT, recipient, wrongSalt)).toThrow(
      /commitment mismatch for slot/,
    );
  });

  it('claim_rejects_impostor_key', () => {
    // Someone who learns the amount and salt still cannot claim with their own key:
    // the key is bound into the commitment.
    const { contract, context, salts } = distributedContract();
    const impostor = new Uint8Array(32).fill(0x55);
    expect(() => contract.impureCircuits.claim(context, 0n, AMOUNT, impostor, salts[0]!)).toThrow(
      /commitment mismatch for slot/,
    );
  });

  it('claim_rejects_slot_out_of_range', () => {
    const { contract, context, salts } = distributedContract();
    const recipient = recipientsWithOneActive()[0]!;
    expect(() => contract.impureCircuits.claim(context, 8n, AMOUNT, recipient, salts[0]!)).toThrow(
      /slot out of range/,
    );
  });
});
