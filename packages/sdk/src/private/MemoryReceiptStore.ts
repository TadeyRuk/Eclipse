import type { ReceiptStorePort } from './ReceiptStorePort.js';
import type { ReceiptRecord } from '../types/receiptRecord.js';

/**
 * In-memory {@link ReceiptStorePort} — the test double, and the fallback the
 * browser adapter degrades to when private storage is unavailable.
 *
 * Deliberately not persistent: losing receipts on reload is the safe failure mode,
 * since the alternative is writing private openings somewhere unencrypted.
 */
export class MemoryReceiptStore implements ReceiptStorePort {
  private readonly byContract = new Map<string, Map<number, ReceiptRecord>>();

  async put(contractAddress: string, record: ReceiptRecord): Promise<void> {
    const slots = this.byContract.get(contractAddress) ?? new Map<number, ReceiptRecord>();
    slots.set(record.slot, record);
    this.byContract.set(contractAddress, slots);
  }

  async get(contractAddress: string, slot: number): Promise<ReceiptRecord | null> {
    return this.byContract.get(contractAddress)?.get(slot) ?? null;
  }

  async list(contractAddress: string): Promise<ReceiptRecord[]> {
    const slots = this.byContract.get(contractAddress);
    if (!slots) return [];
    return [...slots.values()].sort((a, b) => a.slot - b.slot);
  }

  async clear(contractAddress: string): Promise<void> {
    this.byContract.delete(contractAddress);
  }
}
