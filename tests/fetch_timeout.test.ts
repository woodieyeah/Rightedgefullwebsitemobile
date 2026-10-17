import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
  fetchWithTimeout,
  settleAllWithFallback,
} from "../src/model/fetch-timeout.ts";

/**
 * Production hung on match day because the published Google Sheet CSVs had no
 * deadline: Google's CSV host stopped responding, the fetches never settled,
 * and the dashboard sat on "Loading live sheet data" forever — taking the
 * RLWC content, which never touches the sheet, down with it.
 *
 * These tests pin the two behaviours that prevent a repeat: a hung host must
 * fail fast, and one dead source must not destroy the healthy ones.
 */

/** A fetch that never settles, like the real stalled CSV host. */
const hangingFetch: typeof fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = (init as RequestInit | undefined)?.signal;
    signal?.addEventListener("abort", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
    });
  });

const okFetch = (body: string): typeof fetch =>
  (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;

test("a hung request rejects once the deadline passes", async () => {
  await assert.rejects(
    () => fetchWithTimeout("https://example.test/csv", { timeoutMs: 40, fetchImpl: hangingFetch }),
    (e: Error) => e instanceof FetchTimeoutError,
  );
});

test("the timeout error names the url and the deadline", async () => {
  try {
    await fetchWithTimeout("https://example.test/csv", { timeoutMs: 25, fetchImpl: hangingFetch });
    assert.fail("should have timed out");
  } catch (e) {
    assert.ok(e instanceof FetchTimeoutError);
    assert.equal((e as FetchTimeoutError).timeoutMs, 25);
    assert.match((e as Error).message, /example\.test/);
  }
});

test("a fast response is returned untouched", async () => {
  const res = await fetchWithTimeout("https://example.test/csv", {
    timeoutMs: 1000,
    fetchImpl: okFetch("a,b\n1,2"),
  });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "a,b\n1,2");
});

test("a real network error is preserved, not relabelled as a timeout", async () => {
  const boom: typeof fetch = async () => { throw new Error("DNS failure"); };
  await assert.rejects(
    () => fetchWithTimeout("https://example.test/csv", { timeoutMs: 500, fetchImpl: boom }),
    (e: Error) => !(e instanceof FetchTimeoutError) && /DNS failure/.test(e.message),
  );
});

test("a non-positive timeout means no deadline rather than instant abort", async () => {
  const res = await fetchWithTimeout("https://example.test/csv", {
    timeoutMs: 0,
    fetchImpl: okFetch("ok"),
  });
  assert.equal(await res.text(), "ok");
});

test("the default deadline is well under a user's patience", () => {
  assert.ok(DEFAULT_FETCH_TIMEOUT_MS > 0);
  assert.ok(DEFAULT_FETCH_TIMEOUT_MS <= 15_000);
});

// ---------------------------------------------------------------------------
// Partial failure
// ---------------------------------------------------------------------------

test("one rejected source does not discard the others", async () => {
  const { results, failures } = await settleAllWithFallback(
    [
      Promise.resolve(["a"]),
      Promise.reject(new Error("csv host down")),
      Promise.resolve(["c"]),
    ],
    [] as string[],
  );
  assert.deepEqual(results, [["a"], [], ["c"]]);
  assert.equal(failures.length, 1);
});

test("every source failing still resolves, with fallbacks throughout", async () => {
  const { results, failures } = await settleAllWithFallback(
    [Promise.reject(new Error("x")), Promise.reject(new Error("y"))],
    [] as string[],
  );
  assert.deepEqual(results, [[], []]);
  assert.equal(failures.length, 2);
});

test("all sources succeeding reports no failures", async () => {
  const { results, failures } = await settleAllWithFallback(
    [Promise.resolve(1), Promise.resolve(2)],
    0,
  );
  assert.deepEqual(results, [1, 2]);
  assert.equal(failures.length, 0);
});
