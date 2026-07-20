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
      const wallets = listWallets();
      if (wallets.length === 0) {
        throw new Error('No Midnight wallet found. Install Lace and unlock it on Preprod.');
      }
      const preferred =
        wallets.find((w) => w.id.toLowerCase().includes(this.preferredWalletId.toLowerCase())) ??
        wallets.find((w) => w.id.toLowerCase().includes('lace')) ??
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
