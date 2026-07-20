export type Address = string;

export const MAX_RECIPIENTS = 8;

export interface Recipient {
  address: Address;
}

export type PayrollStatus = 'Created' | 'Funded' | 'Distributed' | 'Uninitialized';

/** Public payroll snapshot — never includes private amounts or salts. */
export interface Payroll {
  employer: Address;
  depositTotal: bigint;
  recipients: Recipient[];
  status: PayrollStatus;
  receiptCommitments: string[];
}

export interface Receipt {
  recipient: Address;
  commitment: string;
}
