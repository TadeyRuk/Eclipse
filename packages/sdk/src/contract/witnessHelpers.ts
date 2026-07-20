import { MAX_RECIPIENTS } from '../types/domain';

/** Generate MAX_RECIPIENTS random 32-byte salts. Never log these. */
export function generateSalts(count = MAX_RECIPIENTS): Uint8Array[] {
  if (count < 1 || count > MAX_RECIPIENTS) {
    throw new Error(`salt count must be 1..${MAX_RECIPIENTS}`);
  }
  const out: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const s = new Uint8Array(32);
    crypto.getRandomValues(s);
    out.push(s);
  }
  return out;
}

/** Pad/truncate amount list to MAX_RECIPIENTS with 0n. */
export function padAmounts(amounts: bigint[]): bigint[] {
  const next = amounts.slice(0, MAX_RECIPIENTS);
  while (next.length < MAX_RECIPIENTS) next.push(0n);
  return next;
}

export function sumAmounts(amounts: bigint[]): bigint {
  return amounts.reduce((a, b) => a + b, 0n);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('expected 32-byte hex string');
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Encode a bech32/hex address into Bytes<32> for circuit args when possible. */
export function addressToBytes32(address: string): Uint8Array {
  const clean = address.startsWith('0x') ? address.slice(2) : address;
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return hexToBytes32(clean);
  }
  // Bech32 / other: hash into 32 bytes for ledger slot (demo binding).
  const enc = new TextEncoder().encode(address);
  const out = new Uint8Array(32);
  for (let i = 0; i < enc.length; i++) {
    out[i % 32] ^= enc[i]!;
  }
  out[0] ^= enc.length & 0xff;
  return out;
}
