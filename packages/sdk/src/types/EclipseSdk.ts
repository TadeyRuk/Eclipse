import type { WalletPort } from '../wallet/WalletPort';
import type { EclipsePort } from '../contract/EclipsePort';

/** Composed ports handed to the web app; adapter wiring stays inside the SDK. */
export interface EclipseSdk {
  wallet: WalletPort;
  eclipse: EclipsePort;
}
