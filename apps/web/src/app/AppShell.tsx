import { describeError } from '../shared/lib/describeError';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { EclipseErrorKind } from '@eclipse/sdk';
import { useEclipseRuntime } from '../shared/runtime/EclipseRuntime';
import { useWalletSession } from '../shared/runtime/useWalletSession';
import { Button, Pill, GradientField, Tag } from '../shared/ui';

const ROUTES = [
  { to: '/employer', label: 'Employer' },
  { to: '/observer', label: 'Observer' },
  { to: '/employee', label: 'Employee' },
] as const;

/** Owns only wallet connect/disconnect error state; every other error is page-local. */
export function AppShell({ children }: { children: ReactNode }) {
  const { sdk, mode, contractAddress, debug } = useEclipseRuntime();
  const wallet = useWalletSession((s) => s.wallet);
  const setWallet = useWalletSession((s) => s.setWallet);
  const [errorKind, setErrorKind] = useState<EclipseErrorKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The wallet port may already be connected (a persisted Lace session, or a
  // test fixture wired connected). Seed the shared store from it once per
  // runtime instead of assuming every mount starts disconnected.
  useEffect(() => {
    setWallet(sdk.wallet.state());
  }, [sdk, setWallet]);

  async function onConnect() {
    const res = await sdk.wallet.connect();
    if (!res.ok) {
      setErrorKind(res.error.kind);
      setErrorMessage(describeError(res.error));
      return;
    }
    setErrorKind(null);
    setErrorMessage(null);
    setWallet(res.value);
  }

  async function onDisconnect() {
    await sdk.wallet.disconnect();
    setWallet({ connected: false, address: null });
  }

  return (
    <GradientField>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--eclipse-ink-muted)]">
            Eclipse
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="display text-4xl text-[var(--eclipse-ink-on-field)]">
              Private payroll
            </h1>
            {/* Always visible — never gated by `debug` — so demo state is never mistaken
                for a real chain transaction. */}
            <span data-testid="mode-indicator">
              <Tag tone={mode === 'demo' ? 'accent' : 'default'}>
                {mode === 'demo' ? 'Demo mode' : 'Chain mode'}
              </Tag>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {wallet.connected ? (
            <>
              <p className="max-w-[14rem] truncate font-mono text-xs text-[var(--eclipse-ink-muted)]">
                {wallet.address}
              </p>
              <Button variant="secondary" onClick={() => void onDisconnect()}>
                Disconnect Lace
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void onConnect()}>
              Connect Lace
            </Button>
          )}
        </div>
      </header>

      <nav className="mb-8 flex gap-1 rounded-full bg-[var(--eclipse-surface)]/10 p-1">
        {ROUTES.map(({ to, label }) => (
          <NavLink key={to} to={to} className="flex-1">
            {({ isActive }) => (
              <Pill active={isActive} className="w-full justify-center">
                {label}
              </Pill>
            )}
          </NavLink>
        ))}
      </nav>

      {errorKind ? (
        <p className="mb-4 text-sm text-[var(--eclipse-danger)]" role="alert">
          {errorKind}
          {errorMessage ? `: ${errorMessage}` : ''}
        </p>
      ) : null}

      {children}

      {debug ? (
        <footer className="mt-12 border-t border-[var(--eclipse-ink-muted)]/20 pt-4 font-mono text-xs text-[var(--eclipse-ink-muted)]">
          <div>contract: {contractAddress}</div>
          <div>chainMode: {String(mode === 'chain')}</div>
          <div>error.kind: {errorKind ?? '—'}</div>
        </footer>
      ) : null}
    </GradientField>
  );
}
