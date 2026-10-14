import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCorePlay,
  toTryScorerRows,
  type AdaptedPredictionLike,
} from "../src/app/rlwc/apply-picks.ts";
import type { PublicPick } from "../src/app/rlwc/picks.ts";

const FIXTURE = "eda89772-662c-41d0-af09-cf1ff42912ca";

const base = {
  fixture_id: FIXTURE,
  match_key: "australia__newzealand",
  competition: "rlwc",
  point: null,
  result_status: "pending" as const,
  profit_units: null,
  published_at: "2026-10-15T00:00:00Z",
  legs: [] as never[],
};

const corePick: PublicPick = {
  ...base, id: "1", market: "h2h", selection: "Australia",
  entry_odds: 1.65, entry_bookmaker: "Betr", model_probability: 0.5808,
  market_probability: 0.5808,
};

const tryPicks: PublicPick[] = [
  { ...base, id: "3", market: "anytime_try", selection: "Dane Gagai", entry_odds: 4.00, entry_bookmaker: "TAB", model_probability: 0.218, market_probability: 0.166 },
  { ...base, id: "4", market: "anytime_try", selection: "Cameron Munster", entry_odds: 5.00, entry_bookmaker: "TAB", model_probability: 0.221, market_probability: 0.133 },
  { ...base, id: "5", market: "anytime_try", selection: "Tom Dearden", entry_odds: 6.00, entry_bookmaker: "TAB", model_probability: 0.192, market_probability: 0.111 },
];

function prediction(): AdaptedPredictionLike {
  return {
    match: "Australia v New Zealand",
    roundNumber: 101,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    predictedWinner: "Australia",
    bestBet: "",
    side: "",
    stake: 0,
    marketHomeOdds: 0,
    marketAwayOdds: 0,
    confidence: "Lean",
  };
}

// ---------------------------------------------------------------------------
// Core play
// ---------------------------------------------------------------------------

test("the core play becomes the card's best bet", () => {
  const row = applyCorePlay(prediction(), corePick);
  assert.equal(row.bestBet, "Australia");
  assert.equal(row.side, "Home");
});

test("the entry price lands on the side that was backed", () => {
  const row = applyCorePlay(prediction(), corePick);
  assert.equal(row.marketHomeOdds, 1.65);
});

test("backing the away team sets the away side and price", () => {
  const away = { ...corePick, selection: "New Zealand", entry_odds: 2.25 };
  const row = applyCorePlay(prediction(), away);
  assert.equal(row.side, "Away");
  assert.equal(row.marketAwayOdds, 2.25);
  assert.equal(row.marketHomeOdds, 0, "home price untouched");
});

test("a play is staked one unit", () => {
  assert.equal(applyCorePlay(prediction(), corePick).stake, 1);
});

test("no pick leaves the row completely untouched", () => {
  const original = prediction();
  const row = applyCorePlay(original, null);
  assert.equal(row.bestBet, "");
  assert.equal(row.side, "");
  assert.equal(row.stake, 0);
});

test("a selection matching neither team is ignored rather than guessed", () => {
  // Fail closed: a name mismatch must not silently back the wrong team.
  const wrong = { ...corePick, selection: "Samoa" };
  const row = applyCorePlay(prediction(), wrong);
  assert.equal(row.bestBet, "");
  assert.equal(row.side, "");
});

test("team matching ignores case and spacing", () => {
  const messy = { ...corePick, selection: "  australia  " };
  assert.equal(applyCorePlay(prediction(), messy).side, "Home");
});

test("confidence reflects the model probability", () => {
  const strong = applyCorePlay(prediction(), { ...corePick, model_probability: 0.72 });
  assert.equal(strong.confidence, "Strong");
  const value = applyCorePlay(prediction(), { ...corePick, model_probability: 0.58 });
  assert.equal(value.confidence, "Value");
  const lean = applyCorePlay(prediction(), { ...corePick, model_probability: 0.51 });
  assert.equal(lean.confidence, "Lean");
});

test("an absent model probability does not crash the card", () => {
  const row = applyCorePlay(prediction(), { ...corePick, model_probability: null });
  assert.equal(row.bestBet, "Australia");
  assert.equal(row.confidence, "Lean");
});

// ---------------------------------------------------------------------------
// Try scorers
// ---------------------------------------------------------------------------

test("each try-scorer pick becomes one row", () => {
  assert.equal(toTryScorerRows(tryPicks, "Australia v New Zealand", 101).length, 3);
});

test("try-scorer rows carry the player, price and bookmaker", () => {
  const rows = toTryScorerRows(tryPicks, "Australia v New Zealand", 101);
  const munster = rows.find((r) => r.player === "Cameron Munster")!;
  assert.equal(munster.bestOdds, 5.00);
  assert.equal(munster.bookmaker, "TAB");
  assert.equal(munster.round, 101);
  assert.equal(munster.match, "Australia v New Zealand");
});

test("the model percentage is carried, not recomputed from the price", () => {
  // The positional model is the whole point: it must not be overwritten by
  // the market's implied figure.
  const rows = toTryScorerRows(tryPicks, "Australia v New Zealand", 101);
  const munster = rows.find((r) => r.player === "Cameron Munster")!;
  assert.ok(Math.abs(munster.statsInsiderPct - 22.1) < 0.05);
  assert.ok(Math.abs(munster.marketImpliedPct - 13.3) < 0.05, "de-vigged, not raw 20%");
});

test("the market percentage is the stored de-vigged value, never 1/odds", () => {
  // A 40-player try-scorer book sums to 933%. Using the raw figure would show
  // Dane Gagai at 25.0% against a 21.8% model read — a negative that is really
  // a positive once the overround is removed.
  const rows = toTryScorerRows(tryPicks, "Australia v New Zealand", 101);
  const gagai = rows.find((r) => r.player === "Dane Gagai")!;
  assert.ok(Math.abs(gagai.marketImpliedPct - 16.6) < 0.05, `got ${gagai.marketImpliedPct}`);
  assert.ok(gagai.edgePct > 0, "Gagai reads positive once de-vigged");
});

test("edge is the difference between model and de-vigged market", () => {
  const rows = toTryScorerRows(tryPicks, "Australia v New Zealand", 101);
  const dearden = rows.find((r) => r.player === "Tom Dearden")!;
  // model 19.2% vs de-vigged 11.1%
  assert.ok(Math.abs(dearden.edgePct - (19.2 - 11.1)) < 0.05);
});

test("a pick with no de-vigged market figure is dropped, not shown with raw odds", () => {
  // Falling back to 1/odds would silently publish an overstated market read.
  const rows = toTryScorerRows(
    [{ ...tryPicks[0], market_probability: null }],
    "Australia v New Zealand", 101,
  );
  assert.equal(rows.length, 0);
});

test("a try-scorer pick with no model probability is dropped, not shown as zero", () => {
  const rows = toTryScorerRows(
    [{ ...tryPicks[0], model_probability: null }],
    "Australia v New Zealand", 101,
  );
  assert.equal(rows.length, 0);
});

test("try-scorer rows are empty when there are no picks", () => {
  assert.deepEqual(toTryScorerRows([], "Australia v New Zealand", 101), []);
});
