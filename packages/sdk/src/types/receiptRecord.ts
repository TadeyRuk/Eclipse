/**
 * A recipient's private opening for one payroll slot.
 *
 * `distribute()` commits `H(amount, recipientPk, salt)` on-chain; `claim()` proves
 * entitlement by re-deriving that hash. The amount and salt are the only inputs
 * that make a later claim possible, and neither may ever reach public state — so
 * this record is written to local private storage and never placed on `Payroll`.
 */
export interface ReceiptRecord {
  /** Ledger slot index, 0..7. */
  slot: number;
  /** Recipient address the slot was committed to. */
  recipient: string;
  /** Private amount committed to this slot. */
  amount: bigint;
  /** Private salt used in the commitment, hex-encoded (32 bytes). */
  saltHex: string;
}
