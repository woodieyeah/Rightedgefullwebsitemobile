/**
 * A settled pick stays on its match card, badged with the result.
 *
 * Previously `selectPendingPicks` dropped everything except pending picks, so
 * the moment a match was settled its card went blank — the play a subscriber
 * had been watching all day simply vanished, and the only record was the
 * tracker further down the page. Keeping the pick visible with WON/LOST is
 * both more useful and more honest: a loss stays on display rather than
 * quietly disappearing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  selectCardPicks,
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
  ...base, id: "p1", market: "line", selection: "Lebanon", point: 44.5,
  entry_odds: 1.9, entry_bookmaker: "TAB",
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

test("a pending pick is shown", () => {
  assert.deepEqual(selectCardPicks([pending]).map((p) => p.id), ["p1"]);
});

test("a settled pick is still shown so the card does not go blank", () => {
  const kept = selectCardPicks([won, lost]).map((p) => p.id);
  assert.deepEqual(kept, ["p2", "p3"], "settled picks must remain on the card");
});

test("a losing pick stays visible rather than quietly disappearing", () => {
  assert.equal(selectCardPicks([lost]).length, 1);
});

test("a voided pick is shown too, since a refund is a real outcome", () => {
  assert.equal(selectCardPicks([voided]).length, 1);
});

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
