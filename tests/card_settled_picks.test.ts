/**
 * Match cards show only picks that can still be backed.
 *
 * A settled pick must NOT be fed into the card pipeline. selectCorePlay takes
 * the first h2h/line/total it finds and ignores result_status, so including
 * settled picks made every finished fixture resurface its old pick. Those
 * fixtures are then removed by the >3h completion filter, which took the
 * Matches and Premium Plays sections down with them — a live outage for
 * paying subscribers, with four playable fixtures still on the card.
 *
 * Settled results belong in the result trackers, which read the full ledger
 * separately and already show the complete record including losses.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  selectPendingPicks,
  pickResultBadge,
  type PublicPick,
} from "../src/app/rlwc/picks.ts";

const FIXTURE = "fx-1";

const base = {
  fixture_id: FIXTURE,
  match_key: "tonga__lebanon",
  competition: "rlwc",
  point: null,
  model_probability: 0.5,
  result_status: "pending" as const,
  profit_units: null,
  published_at: "2026-10-23T00:00:00Z",
  legs: [] as never[],
};

const pending: PublicPick = {
  ...base, id: "p1", market: "line", selection: "Samoa", point: -22.5,
  entry_odds: 1.58, entry_bookmaker: "TAB",
};
const won: PublicPick = {
  ...base, id: "p2", market: "line", selection: "Lebanon", point: 44.5,
  entry_odds: 1.9, entry_bookmaker: "TAB",
  result_status: "win", profit_units: 0.9,
};
const lost: PublicPick = {
  ...base, id: "p3", market: "sgm", selection: "A + B anytime try",
  entry_odds: 5.0, entry_bookmaker: "betr",
  result_status: "loss", profit_units: -1,
};
const voided: PublicPick = {
  ...base, id: "p4", market: "anytime_try", selection: "Someone",
  entry_odds: 2.0, entry_bookmaker: "TAB",
  result_status: "void", profit_units: 0,
};

test("only pending picks reach a match card", () => {
  assert.deepEqual(
    selectPendingPicks([pending, won, lost, voided]).map((p) => p.id),
    ["p1"],
  );
});

test("a settled winner is not placed back on a card", () => {
  assert.equal(selectPendingPicks([won]).length, 0);
});

test("a settled loss is not placed back on a card", () => {
  assert.equal(selectPendingPicks([lost]).length, 0);
});

test("a voided pick is not placed back on a card", () => {
  assert.equal(selectPendingPicks([voided]).length, 0);
});

test("the dashboard feeds ONLY pending picks into the card pipeline", () => {
  // Guards the exact regression that blanked production: passing settled
  // picks through resurfaced finished fixtures, which the completion filter
  // then dropped along with the whole section.
  const APP = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
  assert.match(
    APP,
    /picksByFixture\(selectPendingPicks\(allPicks\)\)/,
    "match cards must be built from selectPendingPicks",
  );
  assert.doesNotMatch(
    APP,
    /picksByFixture\(selectCardPicks\(/,
    "selectCardPicks must never feed the card pipeline",
  );
});

// The badge helper stays: the result trackers use it to label settled rows.
test("the badge names the outcome", () => {
  assert.equal(pickResultBadge(pending), null, "a pending pick carries no badge");
  assert.equal(pickResultBadge(won), "WON");
  assert.equal(pickResultBadge(lost), "LOST");
  assert.equal(pickResultBadge(voided), "VOID");
});

test("a pushed pick reads as a refund, not a win", () => {
  const push: PublicPick = { ...won, id: "p5", result_status: "push", profit_units: 0 };
  assert.equal(pickResultBadge(push), "PUSH");
});

test("an unknown status never invents a result", () => {
  const odd = { ...won, id: "p6", result_status: "weird" } as unknown as PublicPick;
  assert.equal(pickResultBadge(odd), null);
});
