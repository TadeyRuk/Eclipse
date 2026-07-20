import { err, ok, type Result } from '../types/result';

export type ProofClientConfig = {
  /** Must be loopback in non-dev. Default http://127.0.0.1:6300 */
  proofServerUrl?: string;
  timeoutMs?: number;
  /** When true, allow non-loopback URLs (local debugging only). */
  allowRemoteProofServer?: boolean;
};

export type ProveInput = {
  /** Opaque payload for the proof server; MidnightAdapter fills this. */
  body: BodyInit | null;
  headers?: HeadersInit;
};

export type ProveResult = {
  durationMs: number;
  response: Response;
};

const DEFAULT_URL = 'http://127.0.0.1:6300';
const DEFAULT_TIMEOUT_MS = 120_000;

function isLoopback(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
  } catch {
    return false;
  }
}

export class ProofClient {
  readonly proofServerUrl: string;
  readonly timeoutMs: number;

  constructor(config: ProofClientConfig = {}) {
    const url = (config.proofServerUrl ?? DEFAULT_URL).replace(/\/$/, '');
    if (!config.allowRemoteProofServer && !isLoopback(url)) {
      throw new Error(
        `ProofClient refuses non-loopback proof server URL (${url}). Pass allowRemoteProofServer only for explicit local debugging.`,
      );
    }
    this.proofServerUrl = url;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async healthCheck(): Promise<Result<{ ok: true; latencyMs: number }>> {
    const started = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5_000);
      const res = await fetch(`${this.proofServerUrl}/`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok && res.status >= 500) {
        return err('ProofServerDown', `Proof server health HTTP ${res.status}`);
      }
      return ok({ ok: true, latencyMs: Date.now() - started });
    } catch (cause) {
      return err('ProofServerDown', 'Proof server unreachable', cause);
    }
  }

  /**
   * POST to proof server with timeout. Retries once on Timeout.
   */
  async prove(path: string, input: ProveInput, attempt = 0): Promise<Result<ProveResult>> {
    const started = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      const response = await fetch(`${this.proofServerUrl}${path}`, {
        method: 'POST',
        body: input.body,
        headers: input.headers,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (response.status >= 500) {
        return err('ProofServerDown', `Proof server HTTP ${response.status}`);
      }
      return ok({ durationMs: Date.now() - started, response });
    } catch (cause) {
      const aborted =
        cause instanceof DOMException
          ? cause.name === 'AbortError'
          : cause instanceof Error && cause.name === 'AbortError';
      if (aborted) {
        if (attempt === 0) {
          return this.prove(path, input, 1);
        }
        return err('Timeout', `Proof timed out after ${this.timeoutMs}ms (retried once)`, cause);
      }
      return err('ProofServerDown', 'Proof request failed', cause);
    }
  }
}
