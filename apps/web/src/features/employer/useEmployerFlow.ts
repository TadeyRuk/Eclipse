import { useState } from 'react';
import {
  MAX_RECIPIENTS,
  type EclipseErrorKind,
  type Payroll,
} from '@eclipse/sdk';
import { useEclipseRuntime } from '../../shared/runtime/EclipseRuntime';
import { useWalletSession } from '../../shared/runtime/useWalletSession';
import { describeError } from '../../shared/lib/describeError';
import { validateAmounts, validateRecipients } from '../../shared/lib/validate';

export type EmployerOperation = 'create' | 'fund' | 'distribute' | null;
export type EmployerStage = 'draft' | 'Created' | 'Funded' | 'Distributed';
export type FeatureNotice = { kind: EclipseErrorKind; message: string } | null;

export function useEmployerFlow() {
  const { sdk, explorerUrl } = useEclipseRuntime();
  const wallet = useWalletSession((s) => s.wallet);

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [operation, setOperation] = useState<EmployerOperation>(null);
  const [notice, setNotice] = useState<FeatureNotice>(null);

  const [recipients, setRecipients] = useState<string[]>(['']);
  const [deposit, setDeposit] = useState('100');
  /** Private amounts — cleared after successful distribute. Never persisted. */
  const [amounts, setAmounts] = useState<string[]>(['']);

  const stage: EmployerStage =
    payroll && payroll.status !== 'Uninitialized' ? payroll.status : 'draft';

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

  function addRecipient() {
    if (recipients.length < MAX_RECIPIENTS) {
      setRecipients((p) => [...p, '']);
    }
  }

  async function createPayroll() {
    const errMsg = validateRecipients(recipients);
    if (errMsg) {
      setNotice({ kind: 'CircuitRejected', message: errMsg });
      return;
    }
    if (!wallet.connected) {
      setNotice({ kind: 'WalletNotConnected', message: 'Connect Lace first' });
      return;
    }

    setOperation('create');
    setNotice(null);
    const cleaned = recipients.map((r) => r.trim()).filter(Boolean);
    const res = await sdk.eclipse.createPayroll(cleaned);
    setOperation(null);

    if (!res.ok) {
      setNotice({ kind: res.error.kind, message: describeError(res.error) });
      return;
    }

    setPayroll(res.value);
  }

  async function fundPayroll() {
    if (!wallet.connected) {
      setNotice({ kind: 'WalletNotConnected', message: 'Connect Lace first' });
      return;
    }
    let amount: bigint;
    try {
      amount = BigInt(deposit.trim());
    } catch {
      setNotice({ kind: 'CircuitRejected', message: 'Invalid deposit' });
      return;
    }

    setOperation('fund');
    setNotice(null);
    const res = await sdk.eclipse.fund(amount);
    setOperation(null);

    if (!res.ok) {
      setNotice({ kind: res.error.kind, message: describeError(res.error) });
      return;
    }

    setPayroll(res.value);
    const activeCount = recipients.filter((r) => r.trim()).length;
    setAmounts(Array.from({ length: activeCount }, () => ''));
  }

  async function distribute() {
    if (!wallet.connected) {
      setNotice({ kind: 'WalletNotConnected', message: 'Connect Lace first' });
      return;
    }
    const { error, parsed } = validateAmounts(amounts, deposit);
    if (error) {
      setNotice({ kind: 'CircuitRejected', message: error });
      return;
    }

    setOperation('distribute');
    setNotice(null);
    const res = await sdk.eclipse.distribute(parsed);
    setOperation(null);

    if (!res.ok) {
      setNotice({ kind: res.error.kind, message: describeError(res.error) });
      return;
    }

    setPayroll(res.value);
    setAmounts([]);
  }

  const activeRecipients = recipients.filter((r) => r.trim());

  return {
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
  };
}
