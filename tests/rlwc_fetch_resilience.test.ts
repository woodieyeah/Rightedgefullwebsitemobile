/**
 * RLWC content must not vanish because one fetch was slow.
 *
 * RLWC is the live product — the NRL season is over and the sheets are nearly
 * empty, so Supabase is the only real data source. Yet the whole block was
 * gated on a single `fetchCompetitionFixtures` call with the generic 12s
 * timeout: one slow response returned [], `upcoming.length` was 0, and every
 * play, multi and result tracker disappeared at once. A paying subscriber then
 * saw "No play clears the conservative Core Play threshold" while ten healthy
 * picks sat in Supabase.
 *
 * Two independent guarantees are required:
 *   1. the fixtures fetch gets a timeout suited to a degraded connection, and
 *      retries rather than giving up on the first failure;
 *   2. a failure is visible in the console, because silently rendering an
 *      empty product is worse than a slow one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FIXTURES = readFileSync(new URL("../src/app/rlwc/fixtures.ts", import.meta.url), "utf8");
const PICKS = readFileSync(new URL("../src/app/rlwc/picks.ts", import.meta.url), "utf8");
const TIMEOUT = readFileSync(new URL("../src/model/fetch-timeout.ts", import.meta.url), "utf8");

test("the generic fetch timeout is unchanged for sheet fetches", () => {
  // Raising the global default would slow the NRL degrade path; the RLWC
  // calls must opt in to a longer budget instead.
  assert.match(TIMEOUT, /DEFAULT_FETCH_TIMEOUT_MS = 12_000/);
});

test("the RLWC fixtures fetch uses a longer budget than the sheet default", () => {
  assert.match(
    FIXTURES,
    /RLWC_FETCH_TIMEOUT_MS\s*=\s*(2[5-9]|[3-9]\d)_?\d*/,
    "fixtures.ts must define an RLWC-specific timeout of at least 25s",
  );
  assert.match(
    FIXTURES,
    /timeoutMs:\s*RLWC_FETCH_TIMEOUT_MS/,
    "the fixtures fetch must pass that timeout",
  );
});

test("the RLWC picks fetch uses the same longer budget", () => {
  assert.match(PICKS, /timeoutMs:\s*RLWC_FETCH_TIMEOUT_MS/);
});

test("a failed fixtures fetch is retried before giving up", () => {
  assert.match(
    FIXTURES,
    /for\s*\(\s*let\s+attempt[\s\S]{0,400}fetchWithTimeout/,
    "fetchCompetitionFixtures must retry rather than return [] on first failure",
  );
});

test("a total RLWC failure is reported, not swallowed in silence", () => {
  assert.match(
    FIXTURES,
    /console\.(warn|error)/,
    "an empty RLWC result must be visible in the console",
  );
});
