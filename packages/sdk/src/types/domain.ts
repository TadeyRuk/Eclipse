export type Address = string;

export interface Recipient {
  address: Address;
}

export type PayrollStatus = 'Created' | 'Funded' | 'Distributed';

export interface Payroll {
  employer: Address;
  depositTotal: bigint;
  recipients: Recipient[];
  status: PayrollStatus;
  balancedProofPosted: boolean;
}

export interface Receipt {
  recipient: Address;
  commitment: string;
}
