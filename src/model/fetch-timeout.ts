/**
 * Bounded fetch for third-party data sources.
 *
 * WHY THIS EXISTS
 * The dashboard blocks on five published Google Sheet CSVs before it renders
 * anything. Those fetches had no timeout, so when Google's CSV host
 * (doc-*-sheets.googleusercontent.com) stopped responding mid-tournament, the
 * promises never settled: no rejection, no error boundary, no fallback. The
 * page sat on "Loading live sheet data" indefinitely and took the RLWC
 * content — which does not come from the sheet at all — down with it.
 *
 * A hung dependency must degrade, not hang. Every outbound fetch to a source
 * we do not control gets a deadline, so a stalled host fails fast enough for
 * the caller to carry on with whatever else it has.
 */

/** Default deadline for a third-party fetch. */
export const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export interface TimeoutFetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch with a hard deadline.
 *
 * Aborts the request when the deadline passes and rejects with a
 * FetchTimeoutError, so a caller can tell a timeout apart from an HTTP error
 * and decide whether to degrade or surface it. The timer is always cleared,
 * including on rejection, so a slow-but-successful response does not leave a
 * dangling abort behind it.
 */
export async function fetchWithTimeout(
  url: string,
  options: TimeoutFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, fetchImpl, ...init } = options;
  const doFetch = fetchImpl ?? fetch;

  // A non-positive deadline means "no deadline": never turn a configuration
  // mistake into an instantly-aborted request.
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return doFetch(url, init);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await doFetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve every promise, substituting a fallback for any that reject.
 *
 * `Promise.all` rejects as soon as one input rejects, which is how a single
 * dead CSV took out four healthy ones. This keeps whatever succeeded and
 * reports what failed, so a partial outage costs only the missing section.
 */
export async function settleAllWithFallback<T>(
  tasks: Array<Promise<T>>,
  fallback: T,
): Promise<{ results: T[]; failures: unknown[] }> {
  const settled = await Promise.allSettled(tasks);
  const failures: unknown[] = [];
  const results = settled.map((entry) => {
    if (entry.status === "fulfilled") return entry.value;
    failures.push(entry.reason);
    return fallback;
  });
  return { results, failures };
}
