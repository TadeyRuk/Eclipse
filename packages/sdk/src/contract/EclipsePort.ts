import type { Address, Payroll, Receipt, Result } from '../types';

export interface EclipsePort {
  createPayroll(recipients: Address[]): Promise<Result<Payroll>>;
  fund(amount: bigint): Promise<Result<Payroll>>;
  distribute(amounts: bigint[]): Promise<Result<Payroll>>;
  claim(): Promise<Result<Receipt>>;
}
