import { MAX_RECIPIENTS } from '@eclipse/sdk';

export function validateRecipients(recipients: string[]): string | null {
  const cleaned = recipients.map((r) => r.trim()).filter(Boolean);
  if (cleaned.length === 0) return 'Add at least one recipient';
  if (cleaned.length > MAX_RECIPIENTS) return `At most ${MAX_RECIPIENTS} recipients`;
  return null;
}

export function validateAmounts(
  amounts: string[],
  deposit: string,
): { error: string | null; parsed: bigint[] } {
  let depositBn: bigint;
  try {
    depositBn = BigInt(deposit.trim() || '0');
  } catch {
    return { error: 'Deposit must be an integer', parsed: [] };
  }
  if (depositBn <= 0n) return { error: 'Deposit must be positive', parsed: [] };

  const parsed: bigint[] = [];
  for (const a of amounts) {
    const t = a.trim();
    if (!t) {
      parsed.push(0n);
      continue;
    }
    try {
      parsed.push(BigInt(t));
    } catch {
      return { error: 'Amounts must be integers', parsed: [] };
    }
  }
  while (parsed.length < MAX_RECIPIENTS) parsed.push(0n);
  const sum = parsed.reduce((x, y) => x + y, 0n);
  if (sum !== depositBn) {
    return { error: `Sum of amounts (${sum}) must equal deposit (${depositBn})`, parsed };
  }
  return { error: null, parsed };
}
