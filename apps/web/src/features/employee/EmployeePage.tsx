import { motion } from 'framer-motion';
import { CircleCheck } from 'lucide-react';
import { Card, Button, Tag } from '../../shared/ui';
import { useClaims } from './useClaims';

/**
 * Employee view — claim a slot without revealing its amount.
 *
 * The opening (amount + salt) is read from local private storage and passed to the
 * circuit as witnesses. Amounts are deliberately NOT rendered: this page proves
 * entitlement, and showing the figure here would undercut the claim the demo makes.
 */
export function EmployeePage() {
  const {
    payroll,
    claims,
    operation,
    notice,
    claim,
    contractAddress,
  } = useClaims();

  const distributed = payroll?.status === 'Distributed';

  return (
    <section data-testid="employee-page">
      <h2 className="display mb-2 text-3xl text-[var(--eclipse-ink-on-field)]">Employee</h2>
      <p className="mb-6 text-[var(--eclipse-ink-muted)]">
        Claiming proves you are owed the amount committed to your slot — without stating the
        amount. The proof re-derives your receipt commitment from private inputs; only{' '}
        <code>claimed</code> becomes public.
      </p>

      <p className="mb-4 font-mono text-xs text-[var(--eclipse-ink-muted)] break-all">
        Contract: {contractAddress}
      </p>

      {operation ? (
        <p className="mb-4 text-sm text-[var(--eclipse-accent)]" role="status">
          {operation}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 text-sm text-[var(--eclipse-danger)]" role="alert">
          {notice.kind}: {notice.message}
        </p>
      ) : null}

      {!distributed ? (
        <Card className="text-sm text-[var(--eclipse-ink-muted-on-surface)]">
          Nothing to claim yet — the payroll must be distributed first. Current status:{' '}
          {payroll?.status ?? 'loading…'}
        </Card>
      ) : claims.length === 0 ? (
        <Card testId="employee-no-receipts" className="text-sm text-[var(--eclipse-ink-muted-on-surface)]">
          No local receipt found. Receipt openings are stored privately on the device that ran
          distribute — without the salt, a slot cannot be claimed. This is the intended failure
          mode, not a bug.
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="employee-receipts">
          {claims.map((r, i) => {
            const alreadyClaimed = payroll?.claimed[r.slot] === true;
            return (
              <motion.li
                key={r.slot}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p>
                      <span className="text-[var(--eclipse-ink-muted-on-surface)]">Slot:</span> {r.slot}
                    </p>
                    <p className="font-mono text-xs break-all text-[var(--eclipse-ink-muted-on-surface)]">
                      {r.recipient || '—'}
                    </p>
                    {/* The amount is intentionally not displayed. */}
                  </div>
                  {alreadyClaimed ? (
                    <span data-testid={`claimed-${r.slot}`}>
                      <Tag tone="accent">
                        <CircleCheck size={12} className="mr-1 inline" />
                        Claimed
                      </Tag>
                    </span>
                  ) : (
                    <Button
                      testId={`claim-${r.slot}`}
                      variant="secondary"
                      disabled={operation !== null}
                      onClick={() => void claim(r.slot)}
                    >
                      Claim
                    </Button>
                  )}
                </Card>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
