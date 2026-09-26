import type { EclipseError } from '@eclipse/sdk';

/**
 * The SDK message says which step failed; the cause (a wallet, indexer or proof-server
 * error) says why. Showing both lets a user fix it without opening the console.
 */
export function describeError(error: EclipseError): string {
  const cause = error.cause;
  const reason =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : cause && typeof cause === 'object' && 'message' in cause
          ? String((cause as { message: unknown }).message)
          : '';
  return reason && reason !== error.message ? `${error.message}: ${reason}` : error.message;
}
