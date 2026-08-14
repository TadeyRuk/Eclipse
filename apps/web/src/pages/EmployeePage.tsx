import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck } from 'lucide-react';
import type { Payroll, ReceiptRecord } from '@eclipse/sdk';
import { getSdk, getContractAddress } from '../sdk';
import { useSession } from '../state/session';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Tag';

/**
 * Employee view — claim a slot without revealing its amount.
 *
 * The opening (amount + salt) is read from local private storage and passed to the
 * circuit as witnesses. Amounts are deliberately NOT rendered: this page proves
 * entitlement, and showing the figure here would undercut the claim the demo makes.
 */
export function EmployeePage() {
  const wallet = useSession((s) => s.wallet);
  const setError = useSession((s) => s.setError);
  const setBusy = useSession((s) => s.setBusy);
  const busy = useSession((s) => s.busy);

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);

  const refresh = useCallback(async () => {
    const sdk = getSdk();
    const res = await sdk.eclipse.getPublicPayroll();
    if (res.ok) setPayroll(res.value);

    // listLocalReceipts is adapter-specific, not part of EclipsePort.
    const adapter = sdk.eclipse as { listLocalReceipts?: () => Promise<ReceiptRecord[]> };
    if (adapter.listLocalReceipts) {
      setReceipts(await adapter.listLocalReceipts());
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runClaim(slot: number) {
    if (!wallet.connected) {
      setError('WalletNotConnected', 'Connect Lace first');
      return;
    }
    setBusy(`Proving claim for slot ${slot}…`);
    setError(null);
    const res = await getSdk().eclipse.claim(slot);
    setBusy(null);
    if (!res.ok) {
      setError(res.error.kind, res.error.message);
      return;
    }
    await refresh();
  }

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
        Contract: {getContractAddress()}
      </p>

      {!distributed ? (
        <Card className="text-sm text-[var(--eclipse-ink-muted)]">
          Nothing to claim yet — the payroll must be distributed first. Current status:{' '}
          {payroll?.status ?? 'loading…'}
        </Card>
      ) : receipts.length === 0 ? (
        <Card testId="employee-no-receipts" className="text-sm text-[var(--eclipse-ink-muted)]">
          No local receipt found. Receipt openings are stored privately on the device that ran
          distribute — without the salt, a slot cannot be claimed. This is the intended failure
          mode, not a bug.
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="employee-receipts">
          {receipts.map((r, i) => {
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
                      <span className="text-[var(--eclipse-ink-muted)]">Slot:</span> {r.slot}
                    </p>
                    <p className="font-mono text-xs break-all text-[var(--eclipse-ink-muted)]">
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
                      disabled={busy !== null}
                      onClick={() => void runClaim(r.slot)}
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
