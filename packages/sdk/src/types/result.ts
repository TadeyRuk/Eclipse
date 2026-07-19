export type EclipseErrorKind =
  | 'WalletNotConnected'
  | 'ProofServerDown'
  | 'CircuitRejected'
  | 'TxFailed'
  | 'Timeout';

export interface EclipseError {
  kind: EclipseErrorKind;
  message: string;
  cause?: unknown;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EclipseError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(kind: EclipseErrorKind, message: string, cause?: unknown): Result<T> {
  return { ok: false, error: { kind, message, cause } };
}
