import { useCallback, useEffect, useState } from 'react';
import type { Payroll, ReceiptRecord } from '@eclipse/sdk';
import { getSdk, getContractAddress } from '../sdk';
import { useSession } from '../state/session';

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
      <h2 className="display mb-2 text-3xl">Employee</h2>
      <p className="mb-6 text-[var(--muted)]">
        Claiming proves you are owed the amount committed to your slot — without stating the
        amount. The proof re-derives your receipt commitment from private inputs; only{' '}
        <code>claimed</code> becomes public.
      </p>

      <p className="mb-4 font-mono text-xs text-[var(--muted)] break-all">
        Contract: {getContractAddress()}
      </p>

      {!distributed ? (
        <p className="rounded border border-[var(--line)] bg-[var(--bg1)] p-4 text-sm text-[var(--muted)]">
          Nothing to claim yet — the payroll must be distributed first. Current status:{' '}
          {payroll?.status ?? 'loading…'}
        </p>
      ) : receipts.length === 0 ? (
        <p
          data-testid="employee-no-receipts"
          className="rounded border border-[var(--line)] bg-[var(--bg1)] p-4 text-sm text-[var(--muted)]"
        >
          No local receipt found. Receipt openings are stored privately on the device that ran
          distribute — without the salt, a slot cannot be claimed. This is the intended failure
          mode, not a bug.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="employee-receipts">
          {receipts.map((r) => {
            const alreadyClaimed = payroll?.claimed[r.slot] === true;
            return (
              <li
                key={r.slot}
                className="flex items-center justify-between gap-4 rounded border border-[var(--line)] bg-[var(--bg1)] p-4 text-sm"
              >
                <div>
                  <p>
                    <span className="text-[var(--muted)]">Slot:</span> {r.slot}
                  </p>
                  <p className="font-mono text-xs break-all text-[var(--muted)]">
                    {r.recipient || '—'}
                  </p>
                  {/* The amount is intentionally not displayed. */}
                </div>
                {alreadyClaimed ? (
                  <span data-testid={`claimed-${r.slot}`} className="text-[var(--muted)]">
                    Claimed
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`claim-${r.slot}`}
                    disabled={busy !== null}
                    onClick={() => void runClaim(r.slot)}
                    className="rounded border border-[var(--line)] px-3 py-1 disabled:opacity-50"
                  >
                    Claim
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
