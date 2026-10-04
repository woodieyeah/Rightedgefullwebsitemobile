import assert from "node:assert/strict";
import test from "node:test";
import {
  settlePick,
  summarisePicks,
  type Pick,
  type MatchResult,
} from "../src/model/pick-ledger.ts";

const GF: MatchResult = {
  matchKey: "newcastleknights__sydneyroosters",
  homeTeam: "Sydney Roosters",
  awayTeam: "Newcastle Knights",
  homeScore: 26,
  awayScore: 18,
};

const basePick = {
  id: "p1",
  matchKey: GF.matchKey,
  competition: "NRL" as const,
  placedAt: "2026-10-04T03:00:00.000Z",
  stakeUnits: 1,
  bookmaker: "BetRight",
};

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

test("h2h on the winning team returns stake x price", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    GF,
  );
  assert.equal(s.outcome, "win");
  assert.equal(s.unitsReturned, 1.45);
  assert.equal(Number(s.profitUnits.toFixed(4)), 0.45);
});

test("h2h on the losing team returns nothing", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Newcastle Knights", entryPrice: 3.25 },
    GF,
  );
  assert.equal(s.outcome, "loss");
  assert.equal(s.unitsReturned, 0);
  assert.equal(s.profitUnits, -1);
});

test("a drawn match voids an h2h pick and refunds the stake", () => {
  const draw = { ...GF, homeScore: 20, awayScore: 20 };
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    draw,
  );
  assert.equal(s.outcome, "push");
  assert.equal(s.unitsReturned, 1);
  assert.equal(s.profitUnits, 0);
});

// ---------------------------------------------------------------------------
// Line / handicap — margin is 8 (26-18)
// ---------------------------------------------------------------------------

test("a favourite covers when the margin beats the handicap", () => {
  const s = settlePick(
    { ...basePick, market: "line", selection: "Sydney Roosters", point: -6.5, entryPrice: 1.85 },
    GF,
  );
  assert.equal(s.outcome, "win");
  assert.equal(Number(s.profitUnits.toFixed(4)), 0.85);
});

test("a favourite fails to cover when the margin falls short", () => {
  const s = settlePick(
    { ...basePick, market: "line", selection: "Sydney Roosters", point: -8.5, entryPrice: 1.98 },
    GF,
  );
  assert.equal(s.outcome, "loss");
  assert.equal(s.profitUnits, -1);
});

test("the underdog covers when the favourite's margin is short of the line", () => {
  const s = settlePick(
    { ...basePick, market: "line", selection: "Newcastle Knights", point: 8.5, entryPrice: 1.85 },
    GF,
  );
  assert.equal(s.outcome, "win");
});

test("a whole-number line landing exactly on the margin is a push", () => {
  const s = settlePick(
    { ...basePick, market: "line", selection: "Sydney Roosters", point: -8, entryPrice: 1.9 },
    GF,
  );
  assert.equal(s.outcome, "push");
  assert.equal(s.unitsReturned, 1);
  assert.equal(s.profitUnits, 0);
});

// ---------------------------------------------------------------------------
// Totals — total is 44 (26+18)
// ---------------------------------------------------------------------------

test("an over wins when the combined score clears the line", () => {
  const s = settlePick(
    { ...basePick, market: "total", selection: "Over", point: 42.5, entryPrice: 1.91 },
    GF,
  );
  assert.equal(s.outcome, "win");
});

test("an under loses when the combined score clears the line", () => {
  const s = settlePick(
    { ...basePick, market: "total", selection: "Under", point: 42.5, entryPrice: 1.89 },
    GF,
  );
  assert.equal(s.outcome, "loss");
});

test("a total landing exactly on the line is a push", () => {
  const s = settlePick(
    { ...basePick, market: "total", selection: "Over", point: 44, entryPrice: 1.9 },
    GF,
  );
  assert.equal(s.outcome, "push");
  assert.equal(s.profitUnits, 0);
});

// ---------------------------------------------------------------------------
// Fail-closed behaviour — never invent a settlement
// ---------------------------------------------------------------------------

test("a pick is left pending when the match has no result yet", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    null,
  );
  assert.equal(s.outcome, "pending");
  assert.equal(s.unitsReturned, null);
  assert.equal(s.profitUnits, null);
});

test("a result for a different match never settles this pick", () => {
  const other: MatchResult = { ...GF, matchKey: "broncos__storm" };
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    other,
  );
  assert.equal(s.outcome, "pending");
});

test("an unparseable score leaves the pick pending rather than guessing", () => {
  const bad = { ...GF, homeScore: Number.NaN };
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    bad,
  );
  assert.equal(s.outcome, "pending");
});

test("a line pick with no point is refused, not treated as zero", () => {
  const s = settlePick(
    { ...basePick, market: "line", selection: "Sydney Roosters", entryPrice: 1.85 },
    GF,
  );
  assert.equal(s.outcome, "void");
  assert.equal(s.unitsReturned, 1);
});

test("a selection naming neither team is refused", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Brisbane Broncos", entryPrice: 2 },
    GF,
  );
  assert.equal(s.outcome, "void");
});

// ---------------------------------------------------------------------------
// Ledger summary — profitability, the whole point of the exercise
// ---------------------------------------------------------------------------

test("the summary reports staked, returned, profit, ROI and a strike rate", () => {
  const picks: Pick[] = [
    { ...basePick, id: "a", market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    { ...basePick, id: "b", market: "line", selection: "Sydney Roosters", point: -6.5, entryPrice: 1.85 },
    { ...basePick, id: "c", market: "total", selection: "Under", point: 42.5, entryPrice: 1.89 },
  ];
  const sum = summarisePicks(picks, [GF]);

  assert.equal(sum.settled, 3);
  assert.equal(sum.pending, 0);
  assert.equal(sum.wins, 2);
  assert.equal(sum.losses, 1);
  assert.equal(Number(sum.stakedUnits.toFixed(2)), 3);
  assert.equal(Number(sum.returnedUnits.toFixed(2)), 3.3);
  assert.equal(Number(sum.profitUnits.toFixed(2)), 0.3);
  assert.equal(Number(sum.roiPct.toFixed(2)), 10);
  assert.equal(Number(sum.strikeRatePct.toFixed(2)), 66.67);
});

test("pending picks are excluded from staked and ROI, not counted as losses", () => {
  const picks: Pick[] = [
    { ...basePick, id: "a", market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    { ...basePick, id: "b", matchKey: "not__played", market: "h2h", selection: "Someone", entryPrice: 2 },
  ];
  const sum = summarisePicks(picks, [GF]);
  assert.equal(sum.settled, 1);
  assert.equal(sum.pending, 1);
  assert.equal(sum.losses, 0);
  assert.equal(Number(sum.stakedUnits.toFixed(2)), 1);
  assert.equal(Number(sum.roiPct.toFixed(2)), 45);
});

test("pushes count as settled but do not affect the strike rate denominator", () => {
  const picks: Pick[] = [
    { ...basePick, id: "a", market: "line", selection: "Sydney Roosters", point: -8, entryPrice: 1.9 },
    { ...basePick, id: "b", market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
  ];
  const sum = summarisePicks(picks, [GF]);
  assert.equal(sum.pushes, 1);
  assert.equal(sum.wins, 1);
  assert.equal(Number(sum.strikeRatePct.toFixed(2)), 100);
  assert.equal(Number(sum.profitUnits.toFixed(2)), 0.45);
});

test("an empty ledger reports zeroes rather than dividing by zero", () => {
  const sum = summarisePicks([], []);
  assert.equal(sum.settled, 0);
  assert.equal(sum.roiPct, 0);
  assert.equal(sum.strikeRatePct, 0);
  assert.equal(sum.profitUnits, 0);
});

// ---------------------------------------------------------------------------
// Closing line value — did we beat the price the market closed at?
// ---------------------------------------------------------------------------

test("CLV is positive when the entry price beat the closing price", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45, closingPrice: 1.4 },
    GF,
  );
  // 1/1.40 = 71.43% closing, 1/1.45 = 68.97% entry -> we took a longer price,
  // so we captured 2.46 percentage points of probability over the close.
  assert.ok(s.clvPct !== null && s.clvPct > 0, `expected positive CLV, got ${s.clvPct}`);
  assert.equal(Number(s.clvPct!.toFixed(2)), 2.46);
});

test("CLV is null when no closing price was captured", () => {
  const s = settlePick(
    { ...basePick, market: "h2h", selection: "Sydney Roosters", entryPrice: 1.45 },
    GF,
  );
  assert.equal(s.clvPct, null);
});
