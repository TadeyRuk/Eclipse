import { AnimatePresence, motion } from 'framer-motion';
import { MAX_RECIPIENTS, type Payroll } from '@eclipse/sdk';
import { Card, Button, Pill } from '../../shared/ui';
import { useEmployerFlow, type EmployerStage } from './useEmployerFlow';

const STAGE_TO_STEP: Record<EmployerStage, 'recipients' | 'deposit' | 'amounts' | 'prove'> = {
  draft: 'recipients',
  Created: 'deposit',
  Funded: 'amounts',
  Distributed: 'prove',
};

export function EmployerPage() {
  const {
    recipients,
    deposit,
    setDeposit,
    amounts,
    updateRecipient,
    updateAmount,
    addRecipient,
    createPayroll,
    fundPayroll,
    distribute,
    payroll,
    stage,
    operation,
    notice,
    activeRecipients,
    wallet,
    explorerUrl,
  } = useEmployerFlow();

  const currentStep = STAGE_TO_STEP[stage];

  return (
    <section>
      <h2 className="display mb-2 text-3xl text-[var(--eclipse-ink-on-field)]">Employer</h2>
      <p className="mb-8 text-[var(--eclipse-ink-muted)]">
        Create → fund → distribute. Individual amounts stay private; only status and commitments
        become public.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {(['recipients', 'deposit', 'amounts', 'prove'] as const).map((s) => (
          <Pill key={s} active={currentStep === s}>
            {s}
          </Pill>
        ))}
      </div>

      {operation ? (
        <p className="mb-4 text-sm text-[var(--eclipse-accent)]" role="status">
          {operation === 'create'
            ? 'Creating payroll…'
            : operation === 'fund'
              ? 'Depositing tNIGHT…'
              : 'Proving & distributing…'}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 text-sm text-[var(--eclipse-danger)]" role="alert">
          {notice.kind}: {notice.message}
        </p>
      ) : null}

      <AnimatePresence mode="wait">
        {currentStep === 'recipients' ? (
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
                    onClick={addRecipient}
                  >
                    Add recipient
                  </button>
                ) : null}
                <div className="ml-auto">
                  <Button
                    testId="create-payroll"
                    disabled={!wallet.connected || operation !== null}
                    onClick={() => void createPayroll()}
                  >
                    Create payroll
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 'deposit' ? (
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
              <p className="text-xs text-[var(--eclipse-ink-muted-on-surface)]">
                Lace moves this much tNIGHT into the contract. The deposit total is public by
                design; individual amounts stay private.
              </p>
              <Button
                testId="fund-payroll"
                disabled={operation !== null}
                onClick={() => void fundPayroll()}
              >
                Deposit tNIGHT
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 'amounts' ? (
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
              <Button
                testId="distribute"
                disabled={operation !== null}
                onClick={() => void distribute()}
              >
                Prove &amp; distribute
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 'prove' && payroll ? (
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
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Preprod explorer
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function PublicPayrollCard({ payroll }: { payroll: Payroll }) {
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
