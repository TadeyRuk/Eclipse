import { describe, it, expect } from 'vitest';
import { validateAmounts, validateRecipients } from './validate';

describe('validate', () => {
  it('rejects too many recipients', () => {
    expect(validateRecipients(Array.from({ length: 9 }, () => 'x'))).toMatch(/At most/);
  });

  it('requires sum == deposit', () => {
    const r = validateAmounts(['60', '40'], '100');
    expect(r.error).toBeNull();
    const bad = validateAmounts(['60', '41'], '100');
    expect(bad.error).toMatch(/must equal deposit/);
  });
});
