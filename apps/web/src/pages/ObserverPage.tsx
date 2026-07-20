import { useEffect, useState } from 'react';
import type { Payroll } from '@eclipse/sdk';
import { getSdk, getContractAddress, explorerContractUrl } from '../sdk';
import { useSession } from '../state/session';

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
      <h2 className="display mb-2 text-3xl">Observer</h2>
      <p className="mb-6 text-[var(--muted)]">
        Individual amounts are not available on-chain or in this view. You only see public ledger
        fields: status, deposit total, recipients, and opaque receipt commitments.
      </p>

      <p className="mb-4 font-mono text-xs text-[var(--muted)] break-all">
        Contract: {getContractAddress()}
      </p>

      {!payroll ? (
        <p className="text-sm text-[var(--muted)]">Loading public state…</p>
      ) : (
        <div className="space-y-3 rounded border border-[var(--line)] bg-[var(--bg1)] p-4 text-sm">
          <p data-testid="observer-status">
            <span className="text-[var(--muted)]">Status:</span> {payroll.status}
          </p>
          <p>
            <span className="text-[var(--muted)]">Deposit total:</span>{' '}
            {payroll.depositTotal.toString()}
          </p>
          <p>
            <span className="text-[var(--muted)]">Employer:</span>{' '}
            <span className="font-mono text-xs break-all">{payroll.employer || '—'}</span>
          </p>
          <div>
            <p className="text-[var(--muted)]">Recipients (public addresses)</p>
            <ul className="mt-1 space-y-1 font-mono text-xs break-all">
              {payroll.recipients.map((r) => (
                <li key={r.address}>{r.address}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[var(--muted)]">Receipt commitments</p>
            <ul className="mt-1 space-y-1 font-mono text-xs break-all">
              {payroll.receiptCommitments.length === 0 ? (
                <li>—</li>
              ) : (
                payroll.receiptCommitments.map((c) => <li key={c}>{c || '—'}</li>)
              )}
            </ul>
          </div>
        </div>
      )}

      <a
        className="mt-6 inline-block text-sm text-[var(--accent)] underline"
        href={explorerContractUrl()}
        target="_blank"
        rel="noreferrer"
      >
        Verify on Preprod explorer
      </a>

      <button
        type="button"
        className="mt-4 block text-sm text-[var(--muted)]"
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
