import type { EclipseError, EclipseErrorKind, Result } from '../types/result';
import { err, ok } from '../types/result';

/**
 * Adapter-boundary helper: catch any throw and map to Result.
 * Never re-throw across the SDK boundary.
 */
export async function safeAsync<T>(
  kind: EclipseErrorKind,
  message: string,
  fn: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(kind, message, cause);
  }
}

export function mapUnknownError(
  cause: unknown,
  fallback: EclipseErrorKind,
  message: string,
): EclipseError {
  if (
    cause &&
    typeof cause === 'object' &&
    'kind' in cause &&
    typeof (cause as EclipseError).kind === 'string'
  ) {
    return cause as EclipseError;
  }
  return { kind: fallback, message, cause };
}
