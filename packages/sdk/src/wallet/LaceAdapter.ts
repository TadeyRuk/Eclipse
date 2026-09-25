import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { Address, Result } from '../types';
import { err, ok } from '../types/result';
import { safeAsync } from '../internal/safeAsync';
import type { WalletPort, WalletState } from './WalletPort';

export type LaceAdapterConfig = {
  network: 'preprod' | 'preview' | 'undeployed';
  /** Prefer this wallet id if present (Lace injects `mnLace`). */
  preferredWalletId?: string;
};

function listWallets(): { id: string; api: InitialAPI }[] {
  const root = typeof window !== 'undefined' ? window.midnight : undefined;
  if (!root) return [];
  return Object.entries(root)
    .filter((entry): entry is [string, InitialAPI] => {
      const api = entry[1];
      return !!api && typeof api.connect === 'function';
    })
    .map(([id, api]) => ({ id, api }));
}

/**
 * Wallets install under a UUID key (CAIP-372 draft), so the key says nothing about which wallet
 * it is; `rdns` and `name` do. The key is still checked for older `mnLace`-style injections.
 */
function matchesWallet(w: { id: string; api: InitialAPI }, needle: string): boolean {
  const n = needle.toLowerCase();
  return [w.id, w.api.rdns, w.api.name].some((v) => typeof v === 'string' && v.toLowerCase().includes(n));
}

/** Extensions inject after page load; a click right after navigation can precede injection. */
async function waitForWallets(timeoutMs: number): Promise<{ id: string; api: InitialAPI }[]> {
  const started = Date.now();
  let wallets = listWallets();
  while (wallets.length === 0 && Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200));
    wallets = listWallets();
  }
  return wallets;
}

export class LaceAdapter implements WalletPort {
  private connectedApi: ConnectedAPI | null = null;
  private address: Address | null = null;
  private readonly network: string;
  private readonly preferredWalletId: string;

  constructor(config: LaceAdapterConfig) {
    this.network = config.network;
    this.preferredWalletId = config.preferredWalletId ?? 'mnLace';
  }

  state(): WalletState {
    return {
      connected: this.connectedApi !== null,
      address: this.address,
    };
  }

  /** Expose ConnectedAPI for MidnightJsEclipseTransport (not a fourth adapter). */
  getConnectedApi(): ConnectedAPI | null {
    return this.connectedApi;
  }

  async connect(): Promise<Result<WalletState>> {
    return safeAsync('WalletNotConnected', 'Lace connect failed', async () => {
      const wallets = await waitForWallets(3_000);
      if (wallets.length === 0) {
        throw new Error('No Midnight wallet found. Install Lace and unlock it on Preprod.');
      }
      const preferred =
        wallets.find((w) => matchesWallet(w, this.preferredWalletId)) ??
        wallets.find((w) => matchesWallet(w, 'lace')) ??
        wallets[0];
      if (!preferred) {
        throw new Error('No usable Midnight wallet API');
      }
      const api = await preferred.api.connect(this.network);
      this.connectedApi = api;

      let address: Address | null = null;
      try {
        const shielded = await api.getShieldedAddresses();
        address = (shielded.shieldedCoinPublicKey ?? shielded.shieldedAddress) as Address;
      } catch {
        try {
          const u = await api.getUnshieldedAddress();
          address = u.unshieldedAddress as Address;
        } catch {
          address = null;
        }
      }
      this.address = address;
      return this.state();
    });
  }

  async disconnect(): Promise<Result<void>> {
    return safeAsync('WalletNotConnected', 'Lace disconnect failed', async () => {
      this.connectedApi = null;
      this.address = null;
    });
  }

  async sign(payload: Uint8Array): Promise<Result<Uint8Array>> {
    if (!this.connectedApi) {
      return err('WalletNotConnected', 'Connect Lace before signing');
    }
    return ok(payload);
  }
}

export function isLaceAvailable(): boolean {
  return listWallets().length > 0;
}
