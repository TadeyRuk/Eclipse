import { useState } from 'react';
import { MAX_RECIPIENTS } from '@eclipse/sdk';
import { getSdk, explorerContractUrl } from '../sdk';
import { useSession } from '../state/session';
import { validateAmounts, validateRecipients } from '../lib/validate';

export function EmployerPage() {
  const step = useSession((s) => s.step);
  const setStep = useSession((s) => s.setStep);
  const wallet = useSession((s) => s.wallet);
  const payroll = useSession((s) => s.payroll);
  const setPayroll = useSession((s) => s.setPayroll);
  const setError = useSession((s) => s.setError);
  const setBusy = useSession((s) => s.setBusy);
  const setProofHealthy = useSession((s) => s.setProofHealthy);
  const resetFlow = useSession((s) => s.resetFlow);

  const [recipients, setRecipients] = useState<string[]>(['']);
  const [deposit, setDeposit] = useState('100');
  /** Private amounts — cleared after successful distribute. Never persisted. */
  const [amounts, setAmounts] = useState<string[]>(['']);

  function updateRecipient(i: number, v: string) {
    setRecipients((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function updateAmount(i: number, v: string) {
    setAmounts((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  async function runCreate() {
    const errMsg = validateRecipients(recipients);
    if (errMsg) {
      setError('CircuitRejected', errMsg);
      return;
    }
    if (!wallet.connected) {
      setError('WalletNotConnected', 'Connect Lace first');
      return;
    }
    setBusy('Creating payroll…');
    setError(null);
    const sdk = getSdk();
    const res = await sdk.eclipse.createPayroll(recipients.map((r) => r.trim()).filter(Boolean));
    setBusy(null);
    if (!res.ok) {
      setError(res.error.kind, res.error.message);
      return;
    }
    setPayroll(res.value);
    setStep('deposit');
  }

  async function runFund() {
    if (!wallet.connected) {
      setError('WalletNotConnected', 'Connect Lace first');
      return;
    }
    let amount: bigint;
    try {
      amount = BigInt(deposit.trim());
    } catch {
      setError('CircuitRejected', 'Invalid deposit');
      return;
    }
    setBusy('Funding (stub depositTotal)…');
    setError(null);
    const res = await getSdk().eclipse.fund(amount);
    setBusy(null);
    if (!res.ok) {
      setError(res.error.kind, res.error.message);
      return;
    }
    setPayroll(res.value);
    // Align amount slots with recipient count
    const n = recipients.filter((r) => r.trim()).length;
    setAmounts(Array.from({ length: n }, () => ''));
    setStep('amounts');
  }

  async function runDistribute() {
    if (!wallet.connected) {
      setError('WalletNotConnected', 'Connect Lace first');
      return;
    }
    const { error, parsed } = validateAmounts(amounts, deposit);
    if (error) {
      setError('CircuitRejected', error);
      return;
    }

    setBusy('Checking proof server…');
    const health = await getSdk().proof.healthCheck();
    setProofHealthy(health.ok);
    if (!health.ok) {
      setBusy(null);
      setError(health.error.kind, health.error.message);
      return;
    }

    setBusy('Proving & distributing…');
    setError(null);
    const res = await getSdk().eclipse.distribute(parsed);
    setBusy(null);
    if (!res.ok) {
      setError(res.error.kind, res.error.message);
      return;
    }
    setPayroll(res.value);
    // Privacy wipe — amounts must not remain in the DOM after success
    setAmounts([]);
    setStep('prove');
  }

  const activeRecipients = recipients.filter((r) => r.trim());

  return (
    <section>
      <h2 className="display mb-2 text-3xl">Employer</h2>
      <p className="mb-8 text-[var(--muted)]">
        Create → fund → distribute. Individual amounts stay private; only status and commitments
        become public.
      </p>

      <ol className="mb-8 flex flex-wrap gap-3 text-xs uppercase tracking-wider text-[var(--muted)]">
        {(['recipients', 'deposit', 'amounts', 'prove'] as const).map((s) => (
          <li key={s} className={step === s ? 'text-[var(--accent)]' : ''}>
            {s}
          </li>
        ))}
      </ol>

      {step === 'recipients' ? (
        <div className="space-y-4">
          {recipients.map((r, i) => (
            <input
              key={i}
              data-testid={`recipient-${i}`}
              value={r}
              onChange={(e) => updateRecipient(i, e.target.value)}
              placeholder={`Recipient ${i + 1} address`}
              className="w-full rounded border border-[var(--line)] bg-[var(--bg1)] px-3 py-2 font-mono text-sm"
            />
          ))}
          <div className="flex gap-2">
            {recipients.length < MAX_RECIPIENTS ? (
              <button
                type="button"
                className="text-sm text-[var(--accent)]"
                onClick={() => setRecipients((p) => [...p, ''])}
              >
                Add recipient
              </button>
            ) : null}
            <button
              type="button"
              data-testid="create-payroll"
              disabled={!wallet.connected}
              onClick={() => void runCreate()}
              className="ml-auto rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg0)] disabled:opacity-40"
            >
              Create payroll
            </button>
          </div>
        </div>
      ) : null}

      {step === 'deposit' ? (
        <div className="space-y-4">
          <label className="block text-sm text-[var(--muted)]">
            Deposit total (public)
            <input
              data-testid="deposit-input"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--bg1)] px-3 py-2 font-mono"
            />
          </label>
          <button
            type="button"
            data-testid="fund-payroll"
            onClick={() => void runFund()}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg0)]"
          >
            Stub fund
          </button>
        </div>
      ) : null}

      {step === 'amounts' ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Private amounts for {activeRecipients.length} recipient(s). Sum must equal {deposit}.
          </p>
          {activeRecipients.map((_, i) => (
            <label key={i} className="block text-sm text-[var(--muted)]">
              Private amount {i + 1}
              <input
                data-testid={`amount-${i}`}
                value={amounts[i] ?? ''}
                onChange={(e) => updateAmount(i, e.target.value)}
                className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--bg1)] px-3 py-2 font-mono"
              />
            </label>
          ))}
          <button
            type="button"
            data-testid="distribute"
            onClick={() => void runDistribute()}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg0)]"
          >
            Prove &amp; distribute
          </button>
        </div>
      ) : null}

      {step === 'prove' && payroll ? (
        <div className="space-y-4" data-testid="distribute-success">
          <p className="text-[var(--ok)]">Distributed. Private amounts cleared from this view.</p>
          <PublicPayrollCard payroll={payroll} />
          <a
            className="inline-block text-sm text-[var(--accent)] underline"
            href={explorerContractUrl()}
            target="_blank"
            rel="noreferrer"
          >
            Open Preprod explorer
          </a>
          <button
            type="button"
            className="block text-sm text-[var(--muted)]"
            onClick={() => {
              resetFlow();
              setRecipients(['']);
              setAmounts(['']);
              setPayroll(null);
            }}
          >
            Start over
          </button>
        </div>
      ) : null}
    </section>
  );
}

function PublicPayrollCard({
  payroll,
}: {
  payroll: NonNullable<ReturnType<typeof useSession.getState>['payroll']>;
}) {
  return (
    <div
      data-testid="public-payroll"
      className="rounded border border-[var(--line)] bg-[var(--bg1)] p-4 text-sm"
    >
      <p>
        <span className="text-[var(--muted)]">Status:</span> {payroll.status}
      </p>
      <p>
        <span className="text-[var(--muted)]">Deposit total:</span> {payroll.depositTotal.toString()}
      </p>
      <p className="mt-2 text-[var(--muted)]">Commitments (public, opaque)</p>
      <ul className="mt-1 space-y-1 font-mono text-xs break-all">
        {payroll.receiptCommitments
          .filter((c) => c.replace(/0/g, '') !== '')
          .map((c) => (
            <li key={c}>{c}</li>
          ))}
      </ul>
    </div>
  );
}
