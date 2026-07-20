import type { Address, Payroll, Receipt, Result } from '../types';

export interface EclipsePort {
  /** Read public ledger snapshot (observer-safe). */
  getPublicPayroll(): Promise<Result<Payroll>>;
  createPayroll(recipients: Address[]): Promise<Result<Payroll>>;
  fund(amount: bigint): Promise<Result<Payroll>>;
  distribute(amounts: bigint[]): Promise<Result<Payroll>>;
  /** Post-L2 — not implemented. */
  claim(): Promise<Result<Receipt>>;
}
