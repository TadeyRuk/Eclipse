import { motion } from 'framer-motion';
import { Users, Wallet } from 'lucide-react';
import { Card, Tag, StatChip } from '../../shared/ui';
import { usePublicPayroll } from './usePublicPayroll';

export function ObserverPage() {
  const {
    payroll,
    loading,
    notice,
    refresh,
    contractAddress,
    explorerUrl,
  } = usePublicPayroll();

  return (
    <section data-testid="observer-page">
      <h2 className="display mb-2 text-3xl text-[var(--eclipse-ink-on-field)]">Observer</h2>
      <p className="mb-6 text-[var(--eclipse-ink-muted)]">
        Individual amounts are not available on-chain or in this view. You only see public ledger
        fields: status, deposit total, recipients, and opaque receipt commitments.
      </p>

      <p className="mb-4 font-mono text-xs text-[var(--eclipse-ink-muted)] break-all">
        Contract: {contractAddress}
      </p>

      {notice ? (
        <p className="mb-4 text-sm text-[var(--eclipse-danger)]" role="alert">
          {notice.kind}: {notice.message}
        </p>
      ) : null}

      {!payroll ? (
        <p className="text-sm text-[var(--eclipse-ink-muted)]">
          {loading ? 'Loading public state…' : 'No payroll data available.'}
        </p>
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
              <span className="text-[var(--eclipse-ink-muted-on-surface)]">Status:</span>{' '}
              <Tag tone="accent">{payroll.status}</Tag>
            </p>
            <p>
              <span className="text-[var(--eclipse-ink-muted-on-surface)]">Employer:</span>{' '}
              <span className="font-mono text-xs break-all">{payroll.employer || '—'}</span>
            </p>
            <div>
              <p className="text-[var(--eclipse-ink-muted-on-surface)]">Recipients (public addresses)</p>
              <ul className="mt-1 space-y-1 font-mono text-xs break-all">
                {payroll.recipients.map((r) => (
                  <li key={r.address}>{r.address}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[var(--eclipse-ink-muted-on-surface)]">Receipt commitments</p>
              <ul className="mt-1 space-y-1 font-mono text-xs break-all">
                {payroll.receiptCommitments.length === 0 ? (
                  <li>—</li>
                ) : (
                  payroll.receiptCommitments.map((c) => <li key={c}>{c || '—'}</li>)
                )}
              </ul>
            </div>
            <div>
              <p className="text-[var(--eclipse-ink-muted-on-surface)]">
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
        href={explorerUrl}
        target="_blank"
        rel="noreferrer"
      >
        Verify on Preprod explorer
      </a>

      <button
        type="button"
        className="mt-4 block text-sm text-[var(--eclipse-ink-muted)] underline"
        onClick={() => void refresh()}
      >
        Refresh
      </button>
    </section>
  );
}
