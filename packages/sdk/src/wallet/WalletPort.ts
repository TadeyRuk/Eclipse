import type { Address, Result } from '../types';

export interface WalletState {
  connected: boolean;
  address: Address | null;
}

export interface WalletPort {
  connect(): Promise<Result<WalletState>>;
  disconnect(): Promise<Result<void>>;
  state(): WalletState;
  sign(payload: Uint8Array): Promise<Result<Uint8Array>>;
}
