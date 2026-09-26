import { useCallback, useEffect, useState } from 'react';
import type { EclipseErrorKind, Payroll } from '@eclipse/sdk';
import { useEclipseRuntime } from '../../shared/runtime/EclipseRuntime';
import { describeError } from '../../shared/lib/describeError';

export type ObserverNotice = { kind: EclipseErrorKind; message: string } | null;

export function usePublicPayroll() {
  const { sdk, contractAddress, explorerUrl } = useEclipseRuntime();
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<ObserverNotice>(null);

  const fetchPayroll = useCallback(async (isCancelled?: () => boolean) => {
    setLoading(true);
    const res = await sdk.eclipse.getPublicPayroll();
    if (isCancelled && isCancelled()) return;
    setLoading(false);
    if (!res.ok) {
      setNotice({ kind: res.error.kind, message: describeError(res.error) });
      return;
    }
    setNotice(null);
    setPayroll(res.value);
  }, [sdk]);

  useEffect(() => {
    let cancelled = false;
    void fetchPayroll(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchPayroll]);

  const refresh = useCallback(async () => {
    await fetchPayroll();
  }, [fetchPayroll]);

  return {
    payroll,
    loading,
    notice,
    refresh,
    contractAddress,
    explorerUrl,
  };
}
