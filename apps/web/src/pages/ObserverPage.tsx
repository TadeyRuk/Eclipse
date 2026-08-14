import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Wallet } from 'lucide-react';
import type { Payroll } from '@eclipse/sdk';
import { getSdk, getContractAddress, explorerContractUrl } from '../sdk';
import { useSession } from '../state/session';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { StatChip } from '../components/ui/StatChip';

/**
 * Observer view — public ledger fields only.
 * No amount inputs; proves L2 observable privacy.
 */
export function ObserverPage() {
  const setError = useSession((s) => s.setError);
  const [payroll, setPayroll] = useState<Payroll | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getSdk().eclipse.getPublicPayroll();
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error.kind, res.error.message);
        return;
      }
      setPayroll(res.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [setError]);

  return (
    <section data-testid="observer-page">
      <h2 className="display mb-2 text-3xl text-[var(--eclipse-ink-on-field)]">Observer</h2>
      <p className="mb-6 text-[var(--eclipse-ink-muted)]">
        Individual amounts are not available on-chain or in this view. You only see public ledger
        fields: status, deposit total, recipients, and opaque receipt commitments.
      </p>

      <p className="mb-4 font-mono text-xs text-[var(--eclipse-ink-muted)] break-all">
        Contract: {getContractAddress()}
      </p>

      {!payroll ? (
        <p className="text-sm text-[var(--eclipse-ink-muted)]">Loading public state…</p>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-wrap gap-2">
            <StatChip icon={Users} label="Recipients" value={payroll.recipients.length} />
            <StatChip icon={Wallet} label="Deposit total" value={payroll.depositTotal.toString()} />
          </div>

          <Card className="space-y-3 text-sm">
            <p data-testid="observer-status">
              <span className="text-[var(--eclipse-ink-muted)]">Status:</span>{' '}
              <Tag tone="accent">{payroll.status}</Tag>
            </p>
            <p>
              <span className="text-[var(--eclipse-ink-muted)]">Employer:</span>{' '}
              <span className="font-mono text-xs break-all">{payroll.employer || '—'}</span>
            </p>
            <div>
              <p className="text-[var(--eclipse-ink-muted)]">Recipients (public addresses)</p>
              <ul className="mt-1 space-y-1 font-mono text-xs break-all">
                {payroll.recipients.map((r) => (
                  <li key={r.address}>{r.address}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[var(--eclipse-ink-muted)]">Receipt commitments</p>
              <ul className="mt-1 space-y-1 font-mono text-xs break-all">
                {payroll.receiptCommitments.length === 0 ? (
                  <li>—</li>
                ) : (
                  payroll.receiptCommitments.map((c) => <li key={c}>{c || '—'}</li>)
                )}
              </ul>
            </div>
            <div>
              <p className="text-[var(--eclipse-ink-muted)]">
                Claimed slots — observers learn <em>which</em> slot claimed, never how much
              </p>
              <ul data-testid="observer-claimed" className="mt-1 flex flex-wrap gap-2">
                {payroll.claimed.map((flag, i) => (
                  <li key={i}>
                    <Tag tone={flag ? 'accent' : 'default'}>
                      {i}:{flag ? 'claimed' : '—'}
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>
      )}

      <a
        className="mt-6 inline-block text-sm text-[var(--eclipse-ink-on-field)] underline"
        href={explorerContractUrl()}
        target="_blank"
        rel="noreferrer"
      >
        Verify on Preprod explorer
      </a>

      <button
        type="button"
        className="mt-4 block text-sm text-[var(--eclipse-ink-muted)] underline"
        onClick={() => {
          void getSdk()
            .eclipse.getPublicPayroll()
            .then((res) => {
              if (res.ok) setPayroll(res.value);
            });
        }}
      >
        Refresh
      </button>
    </section>
  );
}
