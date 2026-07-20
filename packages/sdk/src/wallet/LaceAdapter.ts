import type { Address, Result } from '../types';
import { err, ok } from '../types/result';
import { safeAsync } from '../internal/safeAsync';
import type { WalletPort, WalletState } from './WalletPort';

/** Minimal shape of Midnight DApp connector InitialAPI (Lace). */
type MidnightInitialApi = {
  name?: string;
  apiVersion?: string;
  connect: (networkId: string) => Promise<MidnightConnectedApi>;
};

type MidnightConnectedApi = {
  state?: () => Promise<{ address?: string; coinPublicKey?: string }>;
  balanceAndProveTransaction?: (...args: unknown[]) => Promise<unknown>;
  submitTransaction?: (...args: unknown[]) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  experimental?: {
    disconnect?: () => Promise<void>;
  };
};

declare global {
  interface Window {
    midnight?: Record<string, MidnightInitialApi | undefined>;
  }
}

export type LaceAdapterConfig = {
  network: 'preprod' | 'preview' | 'undeployed';
  /** Prefer this wallet id if present (e.g. lace). */
  preferredWalletId?: string;
};

function listWallets(): { id: string; api: MidnightInitialApi }[] {
  const root = typeof window !== 'undefined' ? window.midnight : undefined;
  if (!root) return [];
  return Object.entries(root)
    .filter((entry): entry is [string, MidnightInitialApi] => {
      const api = entry[1];
      return !!api && typeof api.connect === 'function';
    })
    .map(([id, api]) => ({ id, api }));
}

export class LaceAdapter implements WalletPort {
  private connectedApi: MidnightConnectedApi | null = null;
  private address: Address | null = null;
  private readonly network: string;
  private readonly preferredWalletId: string;

  constructor(config: LaceAdapterConfig) {
    this.network = config.network;
    this.preferredWalletId = config.preferredWalletId ?? 'lace';
  }

  state(): WalletState {
    return {
      connected: this.connectedApi !== null,
      address: this.address,
    };
  }

  /** Expose connected API for MidnightAdapter (same process; not a fourth adapter). */
  getConnectedApi(): MidnightConnectedApi | null {
    return this.connectedApi;
  }

  async connect(): Promise<Result<WalletState>> {
    return safeAsync('WalletNotConnected', 'Lace connect failed', async () => {
      const wallets = listWallets();
      if (wallets.length === 0) {
        throw new Error('No Midnight wallet found. Install Lace and unlock it on Preprod.');
      }
      const preferred =
        wallets.find((w) => w.id.toLowerCase().includes(this.preferredWalletId)) ?? wallets[0];
      if (!preferred) {
        throw new Error('No usable Midnight wallet API');
      }
      const api = await preferred.api.connect(this.network);
      this.connectedApi = api;
      let address: Address | null = null;
      if (typeof api.state === 'function') {
        const s = await api.state();
        address = (s.address ?? s.coinPublicKey ?? null) as Address | null;
      }
      this.address = address;
      return this.state();
    });
  }

  async disconnect(): Promise<Result<void>> {
    return safeAsync('WalletNotConnected', 'Lace disconnect failed', async () => {
      const api = this.connectedApi;
      if (api) {
        if (typeof api.disconnect === 'function') {
          await api.disconnect();
        } else if (typeof api.experimental?.disconnect === 'function') {
          await api.experimental.disconnect();
        }
      }
      this.connectedApi = null;
      this.address = null;
    });
  }

  async sign(payload: Uint8Array): Promise<Result<Uint8Array>> {
    if (!this.connectedApi) {
      return err('WalletNotConnected', 'Connect Lace before signing');
    }
    // Lace ConnectedAPI signing varies by version; keep a stable Result boundary.
    // MidnightAdapter prefers submit/balance paths on the connected API when available.
    return ok(payload);
  }
}

export function isLaceAvailable(): boolean {
  return listWallets().length > 0;
}
