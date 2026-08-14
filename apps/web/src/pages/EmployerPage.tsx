import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MAX_RECIPIENTS } from '@eclipse/sdk';
import { getSdk, explorerContractUrl } from '../sdk';
import { useSession } from '../state/session';
import { validateAmounts, validateRecipients } from '../lib/validate';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';

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
    setAmounts([]);
    setStep('prove');
  }

  const activeRecipients = recipients.filter((r) => r.trim());

  return (
    <section>
      <h2 className="display mb-2 text-3xl text-[var(--eclipse-ink-on-field)]">Employer</h2>
      <p className="mb-8 text-[var(--eclipse-ink-muted)]">
        Create → fund → distribute. Individual amounts stay private; only status and commitments
        become public.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {(['recipients', 'deposit', 'amounts', 'prove'] as const).map((s) => (
          <Pill key={s} active={step === s}>
            {s}
          </Pill>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'recipients' ? (
          <motion.div
            key="recipients"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="space-y-4">
              {recipients.map((r, i) => (
                <input
                  key={i}
                  data-testid={`recipient-${i}`}
                  value={r}
                  onChange={(e) => updateRecipient(i, e.target.value)}
                  placeholder={`Recipient ${i + 1} address`}
                  className="w-full rounded-full border border-black/10 bg-black/5 px-4 py-2 font-mono text-sm text-[var(--eclipse-ink)]"
                />
              ))}
              <div className="flex items-center gap-2">
                {recipients.length < MAX_RECIPIENTS ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--eclipse-ink-muted)] underline"
                    onClick={() => setRecipients((p) => [...p, ''])}
                  >
                    Add recipient
                  </button>
                ) : null}
                <div className="ml-auto">
                  <Button
                    testId="create-payroll"
                    disabled={!wallet.connected}
                    onClick={() => void runCreate()}
                  >
                    Create payroll
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {step === 'deposit' ? (
          <motion.div
            key="deposit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="space-y-4">
              <label className="block text-sm text-[var(--eclipse-ink-muted-on-surface)]">
                Deposit total (public)
                <input
                  data-testid="deposit-input"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="mt-1 w-full rounded-full border border-black/10 bg-black/5 px-4 py-2 font-mono text-[var(--eclipse-ink)]"
                />
              </label>
              <Button testId="fund-payroll" onClick={() => void runFund()}>
                Stub fund
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {step === 'amounts' ? (
          <motion.div
            key="amounts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="space-y-4">
              <p className="text-sm text-[var(--eclipse-ink-muted-on-surface)]">
                Private amounts for {activeRecipients.length} recipient(s). Sum must equal {deposit}
                .
              </p>
              {activeRecipients.map((_, i) => (
                <label key={i} className="block text-sm text-[var(--eclipse-ink-muted-on-surface)]">
                  Private amount {i + 1}
                  <input
                    data-testid={`amount-${i}`}
                    value={amounts[i] ?? ''}
                    onChange={(e) => updateAmount(i, e.target.value)}
                    className="mt-1 w-full rounded-full border border-black/10 bg-black/5 px-4 py-2 font-mono text-[var(--eclipse-ink)]"
                  />
                </label>
              ))}
              <Button testId="distribute" onClick={() => void runDistribute()}>
                Prove &amp; distribute
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {step === 'prove' && payroll ? (
          <motion.div
            key="prove"
            data-testid="distribute-success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <Card className="bg-[var(--eclipse-accent)] text-[var(--eclipse-ink)]">
              <p className="font-medium">Distributed. Private amounts cleared from this view.</p>
            </Card>
            <PublicPayrollCard payroll={payroll} />
            <a
              className="inline-block text-sm text-[var(--eclipse-ink-on-field)] underline"
              href={explorerContractUrl()}
              target="_blank"
              rel="noreferrer"
            >
              Open Preprod explorer
            </a>
            <button
              type="button"
              className="block text-sm text-[var(--eclipse-ink-muted)] underline"
              onClick={() => {
                resetFlow();
                setRecipients(['']);
                setAmounts(['']);
                setPayroll(null);
              }}
            >
              Start over
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function PublicPayrollCard({
  payroll,
}: {
  payroll: NonNullable<ReturnType<typeof useSession.getState>['payroll']>;
}) {
  return (
    <Card testId="public-payroll" className="text-sm">
      <p>
        <span className="text-[var(--eclipse-ink-muted-on-surface)]">Status:</span> {payroll.status}
      </p>
      <p>
        <span className="text-[var(--eclipse-ink-muted-on-surface)]">Deposit total:</span>{' '}
        {payroll.depositTotal.toString()}
      </p>
      <p className="mt-2 text-[var(--eclipse-ink-muted-on-surface)]">
        Commitments (public, opaque)
      </p>
      <ul className="mt-1 space-y-1 font-mono text-xs break-all">
        {payroll.receiptCommitments
          .filter((c) => c.replace(/0/g, '') !== '')
          .map((c) => (
            <li key={c}>{c}</li>
          ))}
      </ul>
    </Card>
  );
}
