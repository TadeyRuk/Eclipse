import { create } from 'zustand';
import type { EclipseErrorKind, Payroll, WalletState } from '@eclipse/sdk';

export type WizardStep = 'recipients' | 'deposit' | 'amounts' | 'prove';

type SessionState = {
  wallet: WalletState;
  payroll: Payroll | null;
  lastErrorKind: EclipseErrorKind | null;
  lastErrorMessage: string | null;
  proofHealthy: boolean | null;
  step: WizardStep;
  busy: string | null;
  setWallet: (w: WalletState) => void;
  setPayroll: (p: Payroll | null) => void;
  setError: (kind: EclipseErrorKind | null, message?: string | null) => void;
  setProofHealthy: (v: boolean | null) => void;
  setStep: (s: WizardStep) => void;
  setBusy: (b: string | null) => void;
  resetFlow: () => void;
};

export const useSession = create<SessionState>((set) => ({
  wallet: { connected: false, address: null },
  payroll: null,
  lastErrorKind: null,
  lastErrorMessage: null,
  proofHealthy: null,
  step: 'recipients',
  busy: null,
  setWallet: (wallet) => set({ wallet }),
  setPayroll: (payroll) => set({ payroll }),
  setError: (kind, message = null) =>
    set({ lastErrorKind: kind, lastErrorMessage: message }),
  setProofHealthy: (proofHealthy) => set({ proofHealthy }),
  setStep: (step) => set({ step }),
  setBusy: (busy) => set({ busy }),
  resetFlow: () =>
    set({
      step: 'recipients',
      busy: null,
      lastErrorKind: null,
      lastErrorMessage: null,
    }),
}));
