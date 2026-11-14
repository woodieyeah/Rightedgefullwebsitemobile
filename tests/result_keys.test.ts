/**
 * A result key must be round-aware.
 *
 * The grand final is Australia v New Zealand — the same pairing as the Round
 * 1 opener. The settler maps a pick to a feed result using the fixture's team
 * names alone, so both fixtures produce the identical key
 * "australia__newzealand".
 *
 * Settling round 5 happens to be safe only because the Round 1 picks are
 * already settled and get skipped. But settling round 1 again would grade the
 * FINAL's pending picks against the OPENER's scoreline and write the result.
 * Including the round in the key makes that impossible.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resultKey } from "../src/model/result-keys.ts";

test("the same pairing in different rounds yields different keys", () => {
  const opener = resultKey("Australia", "New Zealand", 1);
  const final = resultKey("Australia", "New Zealand", 5);
  assert.notEqual(opener, final);
});

test("the same pairing in the same round yields the same key", () => {
  assert.equal(
    resultKey("Australia", "New Zealand", 5),
    resultKey("Australia", "New Zealand", 5),
  );
});

test("keys are case and punctuation insensitive", () => {
  assert.equal(
    resultKey("Cook Islands", "Papua New Guinea", 2),
    resultKey("cook islands", "papua new guinea", 2),
  );
});

test("home and away are not interchangeable", () => {
  assert.notEqual(
    resultKey("Australia", "New Zealand", 5),
    resultKey("New Zealand", "Australia", 5),
  );
});

test("a missing round is rejected rather than silently colliding", () => {
  assert.throws(() => resultKey("Australia", "New Zealand", Number.NaN), /round/i);
});

test("a missing team is rejected", () => {
  assert.throws(() => resultKey("", "New Zealand", 5), /team/i);
});
