import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  createPayroll(context: __compactRuntime.CircuitContext<PS>,
                employerPk_0: Uint8Array,
                recipientsIn_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  fund(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  distribute(context: __compactRuntime.CircuitContext<PS>,
             amounts_0: bigint[],
             salts_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createPayroll(context: __compactRuntime.CircuitContext<PS>,
                employerPk_0: Uint8Array,
                recipientsIn_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  fund(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  distribute(context: __compactRuntime.CircuitContext<PS>,
             amounts_0: bigint[],
             salts_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createPayroll(context: __compactRuntime.CircuitContext<PS>,
                employerPk_0: Uint8Array,
                recipientsIn_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  fund(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  distribute(context: __compactRuntime.CircuitContext<PS>,
             amounts_0: bigint[],
             salts_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly employer: Uint8Array;
  readonly depositTotal: bigint;
  readonly recipients: Uint8Array[];
  readonly receiptCommitments: Uint8Array[];
  readonly status: number;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
