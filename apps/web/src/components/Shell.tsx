import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { chainModeEnabled, debugEnabled, getContractAddress, getSdk } from '../sdk';
import { useSession } from '../state/session';

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
    <div className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Eclipse</p>
          <h1 className="display mt-1 text-4xl text-[var(--ink)]">Private payroll</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          {wallet.connected ? (
            <>
              <p className="max-w-[14rem] truncate font-mono text-xs text-[var(--muted)]">
                {wallet.address}
              </p>
              <button
                type="button"
                onClick={() => void onDisconnect()}
                className="rounded border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--accent)]"
              >
                Disconnect Lace
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onConnect()}
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg0)]"
            >
              Connect Lace
            </button>
          )}
        </div>
      </header>

      <nav className="mb-8 flex gap-4 text-sm">
        <NavLink
          to="/employer"
          className={({ isActive }) =>
            isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }
        >
          Employer
        </NavLink>
        <NavLink
          to="/observer"
          className={({ isActive }) =>
            isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }
        >
          Observer
        </NavLink>
        <NavLink
          to="/employee"
          className={({ isActive }) =>
            isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }
        >
          Employee
        </NavLink>
      </nav>

      {busy ? (
        <p className="mb-4 text-sm text-[var(--accent)]" role="status">
          {busy}
        </p>
      ) : null}
      {lastErrorKind ? (
        <p className="mb-4 text-sm text-[var(--danger)]" role="alert">
          {lastErrorKind}
          {lastErrorMessage ? `: ${lastErrorMessage}` : ''}
        </p>
      ) : null}

      {children}

      {debugEnabled ? (
        <footer className="mt-12 border-t border-[var(--line)] pt-4 font-mono text-xs text-[var(--muted)]">
          <div>contract: {getContractAddress()}</div>
          <div>chainMode: {String(chainModeEnabled)}</div>
          <div>proofHealthy: {String(proofHealthy)}</div>
          <div>error.kind: {lastErrorKind ?? '—'}</div>
        </footer>
      ) : null}
    </div>
  );
}
