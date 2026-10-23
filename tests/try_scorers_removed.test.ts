/**
 * The Try Scorers page is removed.
 *
 * The selection rule was provably the market price: devigAnytimeTryMarket
 * multiplies every runner by one shared factor, so ranking by model
 * probability was identical to ranking by shortest odds and no runner could
 * ever rate above the book. The published record was 3-11, -8.75u.
 *
 * These tests guard the removal so it cannot be partially reverted:
 *   - no navigation entry offers the page;
 *   - no routing list accepts its hash, so an old bookmark falls back to
 *     Matches rather than rendering an empty premium shell;
 *   - the premium-gate lists no longer reference it, so a subscriber is never
 *     redirected to a page that does not exist after logging in.
 *
 * The source is scanned directly because the page lives inside a very large
 * component module that cannot be imported in isolation under the test
 * runner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("no navigation entry points at the try scorers page", () => {
  assert.equal(
    /id:\s*"try-scorers"/.test(APP), false,
    'a nav item with id "try-scorers" still exists',
  );
  assert.equal(
    /label:\s*"Try Scorers"/.test(APP), false,
    'a nav label "Try Scorers" still exists',
  );
});

test("no routing list accepts the try-scorers hash", () => {
  // Every routing/premium list is an array literal containing "matches".
  // None of them may still carry the removed hash, or a stale bookmark would
  // resolve to a page that no longer renders.
  const occurrences = APP.match(/"try-scorers"/g) ?? [];
  assert.equal(
    occurrences.length, 0,
    `"try-scorers" still referenced ${occurrences.length} time(s) in App.tsx`,
  );
});

test("the try scorers page component is gone", () => {
  assert.equal(
    /function TryScorersPage\b/.test(APP), false,
    "TryScorersPage is still defined",
  );
  assert.equal(
    /<TryScorersPage\b/.test(APP), false,
    "TryScorersPage is still rendered",
  );
});

test("matches remains a valid route so the fallback has a target", () => {
  // The removal relies on an unknown hash falling back to "matches". If that
  // route ever disappeared, old try-scorer links would land nowhere.
  assert.ok(/"matches"/.test(APP), "the matches route must still exist");
  assert.ok(
    /return "matches";/.test(APP),
    "the unknown-hash fallback to matches must still exist",
  );
});
