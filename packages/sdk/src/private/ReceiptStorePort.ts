import type { ReceiptRecord } from '../types/receiptRecord.js';

/**
 * Local, private persistence for receipt openings.
 *
 * A port rather than a concrete class: the browser adapter is backed by Midnight's
 * private-state provider, while tests supply an in-memory double. Nothing here
 * touches the network — receipts must never leave the recipient's machine.
 */
export interface ReceiptStorePort {
  /** Persist one opening. Replaces any existing record for the same slot. */
  put(contractAddress: string, record: ReceiptRecord): Promise<void>;
  /** Read the opening for a slot, or null when this wallet holds none. */
  get(contractAddress: string, slot: number): Promise<ReceiptRecord | null>;
  /** All openings this wallet holds for a contract, ascending by slot. */
  list(contractAddress: string): Promise<ReceiptRecord[]>;
  /** Drop every opening for a contract — used when switching wallets. */
  clear(contractAddress: string): Promise<void>;
}
