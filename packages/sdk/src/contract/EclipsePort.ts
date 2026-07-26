import type { Address, Payroll, Receipt, Result } from '../types';

export interface EclipsePort {
  /** Read public ledger snapshot (observer-safe). */
  getPublicPayroll(): Promise<Result<Payroll>>;
  createPayroll(recipients: Address[]): Promise<Result<Payroll>>;
  fund(amount: bigint): Promise<Result<Payroll>>;
  distribute(amounts: bigint[]): Promise<Result<Payroll>>;
  /**
   * Prove entitlement to a payroll slot without revealing its amount. The opening
   * (amount + salt) is read from local private storage, never from public state.
   */
  claim(slot?: number): Promise<Result<Receipt>>;
}
