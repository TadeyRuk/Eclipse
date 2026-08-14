import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { chainModeEnabled, debugEnabled, getContractAddress, getSdk } from '../sdk';
import { useSession } from '../state/session';
import { Button } from './ui/Button';
import { Pill } from './ui/Pill';
import { GradientField } from './ui/GradientField';

const ROUTES = [
  { to: '/employer', label: 'Employer' },
  { to: '/observer', label: 'Observer' },
  { to: '/employee', label: 'Employee' },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const wallet = useSession((s) => s.wallet);
  const setWallet = useSession((s) => s.setWallet);
  const setError = useSession((s) => s.setError);
  const busy = useSession((s) => s.busy);
  const lastErrorKind = useSession((s) => s.lastErrorKind);
  const lastErrorMessage = useSession((s) => s.lastErrorMessage);
  const proofHealthy = useSession((s) => s.proofHealthy);

  async function onConnect() {
    const sdk = getSdk();
    const res = await sdk.wallet.connect();
    if (!res.ok) {
      setError(res.error.kind, res.error.message);
      return;
    }
    setError(null);
    setWallet(res.value);
  }

  async function onDisconnect() {
    const sdk = getSdk();
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
          <h1 className="display mt-1 text-4xl text-[var(--eclipse-ink-on-field)]">
            Private payroll
          </h1>
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
            {({ isActive }) => <Pill active={isActive} className="w-full justify-center">{label}</Pill>}
          </NavLink>
        ))}
      </nav>

      {busy ? (
        <p className="mb-4 text-sm text-[var(--eclipse-accent)]" role="status">
          {busy}
        </p>
      ) : null}
      {lastErrorKind ? (
        <p className="mb-4 text-sm text-[var(--eclipse-danger)]" role="alert">
          {lastErrorKind}
          {lastErrorMessage ? `: ${lastErrorMessage}` : ''}
        </p>
      ) : null}

      {children}

      {debugEnabled ? (
        <footer className="mt-12 border-t border-[var(--eclipse-ink-muted)]/20 pt-4 font-mono text-xs text-[var(--eclipse-ink-muted)]">
          <div>contract: {getContractAddress()}</div>
          <div>chainMode: {String(chainModeEnabled)}</div>
          <div>proofHealthy: {String(proofHealthy)}</div>
          <div>error.kind: {lastErrorKind ?? '—'}</div>
        </footer>
      ) : null}
    </GradientField>
  );
}
