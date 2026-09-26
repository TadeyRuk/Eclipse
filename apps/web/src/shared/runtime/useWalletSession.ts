import { create } from 'zustand';
import type { WalletState } from '@eclipse/sdk';

/**
 * Wallet connection state only — shared across the shell and every page because
 * the wallet is a single Lace connection, not per-page. Payroll data, wizard
 * steps, busy/error text are feature-local `useState` inside each page; putting
 * them here again would resurrect the global flow-state store this replaces.
 */
type WalletSessionState = {
  wallet: WalletState;
  setWallet: (wallet: WalletState) => void;
};

export const useWalletSession = create<WalletSessionState>((set) => ({
  wallet: { connected: false, address: null },
  setWallet: (wallet) => set({ wallet }),
}));
