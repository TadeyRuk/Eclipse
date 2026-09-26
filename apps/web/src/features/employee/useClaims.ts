import { useCallback, useEffect, useState } from 'react';
import type { ClaimableReceipt, EclipseErrorKind, Payroll } from '@eclipse/sdk';
import { useEclipseRuntime } from '../../shared/runtime/EclipseRuntime';
import { useWalletSession } from '../../shared/runtime/useWalletSession';
import { describeError } from '../../shared/lib/describeError';

export type ClaimOperation = string | null;
export type ClaimNotice = { kind: EclipseErrorKind; message: string } | null;

export function useClaims() {
  const { sdk, contractAddress } = useEclipseRuntime();
  const wallet = useWalletSession((s) => s.wallet);

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [claims, setClaims] = useState<ClaimableReceipt[]>([]);
  const [operation, setOperation] = useState<ClaimOperation>(null);
  const [notice, setNotice] = useState<ClaimNotice>(null);

  const refresh = useCallback(async (isCancelled?: () => boolean) => {
    const res = await sdk.eclipse.getPublicPayroll();
    if (isCancelled && isCancelled()) return;
    if (res.ok) setPayroll(res.value);

    const claimable = await sdk.eclipse.listClaimableReceipts();
    if (isCancelled && isCancelled()) return;
    if (claimable.ok) setClaims(claimable.value);
  }, [sdk]);

  useEffect(() => {
    let cancelled = false;
    void refresh(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function claim(slot: number) {
    if (!wallet.connected) {
      setNotice({ kind: 'WalletNotConnected', message: 'Connect Lace first' });
      return;
    }

    setOperation(`Proving claim for slot ${slot}…`);
    setNotice(null);
    const res = await sdk.eclipse.claim(slot);
    setOperation(null);

    if (!res.ok) {
      setNotice({ kind: res.error.kind, message: describeError(res.error) });
      return;
    }

    await refresh();
  }

  return {
    payroll,
    claims,
    operation,
    notice,
    claim,
    refresh,
    contractAddress,
    wallet,
  };
}
