import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTracker,
  settleMultiPick,
  settleSinglePick,
  type SettledPick,
  type TrackerPick,
} from "../src/model/pick-tracker.ts";

/**
 * Core Plays and same-game multis are tracked in SEPARATE ledgers.
 *
 * Pooling them would be dishonest: a multi is a structurally different bet
 * with a far longer price and a much lower strike rate, so a combined strike
 * rate describes neither. Each section shows its own record.
 *
 * Settlement derives from the final score and the official try list every
 * time — never from a stored verdict.
 */

const AUS_TRIES = ["Jack Bostock", "Tom Trbojevic", "Reece Walsh"];

// ---------------------------------------------------------------------------
// Multiple-try markets and non-participants
//
// Samoa v France exposed two real gaps. "Brian To'o 2+ tries" is a distinct
// market from anytime, so counting a name once is not enough; and Clayton
// Faulalo was named #19 but never took the field, which books settle as a
// void refund, not a loss. Both are decided from the official try list and
// an explicit participation list.
// ---------------------------------------------------------------------------

const SAMOA_TRIES = [
  "Deine Mariner", "Benaiah Ioelu", "Jermaine McEwen", "Sualauvi Fa'alogo",
  "Hamiso Tabuai-Fidow", "Sualauvi Fa'alogo", "Stephen Crichton", "Shawn Blore",
  "Sualauvi Fa'alogo", "Sualauvi Fa'alogo", "Chanel Harris-Tavita",
  "Izack Tago", "Francis Molo", "Benaiah Ioelu",
];
const SAMOA_RESULT = {
  homeTeam: "Samoa", awayTeam: "France", homeScore: 78, awayScore: 4,
  tryScorers: SAMOA_TRIES, final: true,
};

test("a 2+ tries pick wins when the player scored twice", () => {
  const s = settleSinglePick(
    { market: "player_2_tries", selection: "Benaiah Ioelu", point: null, odds: 4.5, stake: 1 },
    SAMOA_RESULT,
  );
  assert.equal(s.status, "win");
});

test("a 2+ tries pick loses on a single try, which an anytime pick would win", () => {
  const two = settleSinglePick(
    { market: "player_2_tries", selection: "Stephen Crichton", point: null, odds: 4.5, stake: 1 },
    SAMOA_RESULT,
  );
  const any = settleSinglePick(
    { market: "anytime_try", selection: "Stephen Crichton", point: null, odds: 1.65, stake: 1 },
    SAMOA_RESULT,
  );
  assert.equal(two.status, "loss");
  assert.equal(any.status, "win");
});

test("a 2+ tries pick loses when the player did not score at all", () => {
  const s = settleSinglePick(
    { market: "player_2_tries", selection: "Brian To'o", point: null, odds: 2, stake: 1 },
    SAMOA_RESULT,
  );
  assert.equal(s.status, "loss");
});

test("a 2+ tries pick needs the try list, not just a final score", () => {
  const s = settleSinglePick(
    { market: "player_2_tries", selection: "Brian To'o", point: null, odds: 2, stake: 1 },
    { ...SAMOA_RESULT, tryScorers: null },
  );
  assert.equal(s.status, "pending");
});

test("a named player who never took the field voids and refunds the stake", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Clayton Faulalo", point: null, odds: 1.75, stake: 1 },
    { ...SAMOA_RESULT, playersUsed: ["Stephen Crichton", "Brian To'o"] },
  );
  assert.equal(s.status, "void");
  assert.equal(s.unitsReturned, 1);
  assert.equal(s.profitUnits, 0);
});

test("a player who did take the field and failed to score still loses", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Brian To'o", point: null, odds: 1.9, stake: 1 },
    { ...SAMOA_RESULT, playersUsed: ["Brian To'o", "Stephen Crichton"] },
  );
  assert.equal(s.status, "loss");
});

test("without a participation list a non-scorer loses rather than voiding", () => {
  // Absent data must not silently refund every losing try-scorer pick.
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Clayton Faulalo", point: null, odds: 1.75, stake: 1 },
    SAMOA_RESULT,
  );
  assert.equal(s.status, "loss");
});

test("a scorer is never voided even if the participation list omits them", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Francis Molo", point: null, odds: 4, stake: 1 },
    { ...SAMOA_RESULT, playersUsed: ["Brian To'o"] },
  );
  assert.equal(s.status, "win");
});

test("a curly apostrophe in the feed still matches a straight one in the pick", () => {
  // The feed writes "Brian To’o"; picks are stored "Brian To'o". Treating
  // these as different players silently converted a loss into a refund.
  const curly = { ...SAMOA_RESULT, playersUsed: ["Brian To\u2019o"] };
  const s = settleSinglePick(
    { market: "player_2_tries", selection: "Brian To'o 2+ tries", point: null, odds: 2, stake: 1 },
    curly,
  );
  assert.equal(s.status, "loss");
});

test("an accented name matches its unaccented spelling", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Cesar Rouge", point: null, odds: 6, stake: 1 },
    { ...SAMOA_RESULT, tryScorers: ["C\u00e9sar Roug\u00e9"] },
  );
  assert.equal(s.status, "win");
});

test("a void leg voids the whole multi and refunds it", () => {
  const s = settleMultiPick(
    {
      odds: 5.35,
      stake: 1,
      legs: [
        { market: "player_2_tries", selection: "Brian To'o", point: null },
        { market: "anytime_try", selection: "Clayton Faulalo", point: null },
      ],
    },
    { ...SAMOA_RESULT, playersUsed: ["Brian To'o"] },
  );
  assert.equal(s.status, "void");
  assert.equal(s.profitUnits, 0);
});


// ---------------------------------------------------------------------------
// Single-pick settlement
// ---------------------------------------------------------------------------

test("a head-to-head on the winning team wins", () => {
  const s = settleSinglePick(
    { market: "h2h", selection: "Australia", point: null, odds: 1.65, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "win");
  assert.ok(Math.abs(s.unitsReturned! - 1.65) < 1e-9);
  assert.ok(Math.abs(s.profitUnits! - 0.65) < 1e-9);
});

test("a head-to-head on the losing team loses the stake", () => {
  const s = settleSinglePick(
    { market: "h2h", selection: "New Zealand", point: null, odds: 2.25, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "loss");
  assert.equal(s.unitsReturned, 0);
  assert.equal(s.profitUnits, -1);
});

test("a drawn match loses a head-to-head, it does not push", () => {
  // International pool play has real draws. Inheriting push semantics from a
  // golden-point league would silently refund losing bets.
  const s = settleSinglePick(
    { market: "h2h", selection: "Australia", point: null, odds: 1.65, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 20, awayScore: 20, tryScorers: [], final: true },
  );
  assert.equal(s.status, "loss");
});

test("an anytime try scorer who scored wins", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Tom Trbojevic", point: null, odds: 2.10, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "win");
});

test("an anytime try scorer who did not score loses", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Cameron Munster", point: null, odds: 5.00, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "loss");
  assert.equal(s.profitUnits, -1);
});

test("a try scorer is matched by name, tolerating case and spacing", () => {
  const s = settleSinglePick(
    { market: "anytime_try", selection: "  tom   trbojevic ", point: null, odds: 2.10, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "win");
});

test("an exact line pushes and refunds the stake", () => {
  const s = settleSinglePick(
    { market: "line", selection: "Australia", point: -2, odds: 1.90, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "push");
  assert.equal(s.unitsReturned, 1);
  assert.equal(s.profitUnits, 0);
});

test("an exact total pushes", () => {
  const s = settleSinglePick(
    { market: "total", selection: "Over", point: 46, odds: 1.90, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "push");
});

// --- fail-closed cases -----------------------------------------------------

test("a match that is not final stays pending", () => {
  // Settling at half time locks in a wrong result permanently.
  const s = settleSinglePick(
    { market: "h2h", selection: "Australia", point: null, odds: 1.65, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 10, awayScore: 6, tryScorers: [], final: false },
  );
  assert.equal(s.status, "pending");
  assert.equal(s.unitsReturned, null);
  assert.equal(s.profitUnits, null);
});

test("a missing result stays pending", () => {
  const s = settleSinglePick(
    { market: "h2h", selection: "Australia", point: null, odds: 1.65, stake: 1 },
    null,
  );
  assert.equal(s.status, "pending");
});

test("a non-finite score stays pending rather than settling as a loss", () => {
  const s = settleSinglePick(
    { market: "h2h", selection: "Australia", point: null, odds: 1.65, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: Number.NaN, awayScore: 22, tryScorers: [], final: true },
  );
  assert.equal(s.status, "pending");
});

test("a selection naming neither team voids rather than losing", () => {
  const s = settleSinglePick(
    { market: "h2h", selection: "Samoa", point: null, odds: 1.65, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "void");
  assert.equal(s.unitsReturned, 1);
});

test("a line pick with no point voids", () => {
  const s = settleSinglePick(
    { market: "line", selection: "Australia", point: null, odds: 1.90, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: AUS_TRIES, final: true },
  );
  assert.equal(s.status, "void");
});

test("a try-scorer market with no try list stays pending, it does not lose", () => {
  // An empty list is indistinguishable from "tries not yet reported".
  const s = settleSinglePick(
    { market: "anytime_try", selection: "Cameron Munster", point: null, odds: 5.00, stake: 1 },
    { homeTeam: "Australia", awayTeam: "New Zealand", homeScore: 24, awayScore: 22, tryScorers: null, final: true },
  );
  assert.equal(s.status, "pending");
});

// ---------------------------------------------------------------------------
// Multi settlement
// ---------------------------------------------------------------------------

const openerResult = {
  homeTeam: "Australia", awayTeam: "New Zealand",
  homeScore: 24, awayScore: 22,
  tryScorers: AUS_TRIES, final: true,
};

const openerSgm = {
  odds: 5.00,
  stake: 1,
  legs: [
    { market: "h2h" as const, selection: "Australia", point: null },
    { market: "anytime_try" as const, selection: "Tom Trbojevic", point: null },
    { market: "anytime_try" as const, selection: "Jack Bostock", point: null },
  ],
};

test("a multi wins only when every leg wins", () => {
  const s = settleMultiPick(openerSgm, openerResult);
  assert.equal(s.status, "win");
  assert.equal(s.unitsReturned, 5);
  assert.equal(s.profitUnits, 4);
});

test("one losing leg loses the whole multi", () => {
  const s = settleMultiPick(
    { ...openerSgm, legs: [...openerSgm.legs, { market: "anytime_try", selection: "Cameron Munster", point: null }] },
    openerResult,
  );
  assert.equal(s.status, "loss");
  assert.equal(s.profitUnits, -1);
});

test("a multi reports each leg's own outcome", () => {
  const s = settleMultiPick(openerSgm, openerResult);
  assert.deepEqual(s.legStatuses, ["win", "win", "win"]);
});

test("a multi with any leg unsettled stays pending", () => {
  const s = settleMultiPick(openerSgm, { ...openerResult, final: false });
  assert.equal(s.status, "pending");
  assert.equal(s.profitUnits, null);
});

test("a pushed leg does not win the multi on its own", () => {
  // A push inside a multi reduces the price in reality; we fail closed and
  // mark it void rather than inventing a recomputed price.
  const s = settleMultiPick(
    { ...openerSgm, legs: [{ market: "line", selection: "Australia", point: -2 }, ...openerSgm.legs] },
    openerResult,
  );
  assert.equal(s.status, "void");
});

// ---------------------------------------------------------------------------
// Tracker aggregation
// ---------------------------------------------------------------------------

const settled = (status: SettledPick["status"], odds: number, stake = 1): TrackerPick => ({
  label: "x", odds, stake,
  settlement: {
    status,
    unitsReturned: status === "win" ? odds * stake : status === "loss" ? 0 : status === "pending" ? null : stake,
    profitUnits: status === "win" ? odds * stake - stake : status === "loss" ? -stake : status === "pending" ? null : 0,
    legStatuses: [],
  },
});

test("an empty tracker reports zeroes, not NaN", () => {
  const t = buildTracker([]);
  assert.equal(t.settled, 0);
  assert.equal(t.staked, 0);
  assert.equal(t.profitUnits, 0);
  assert.equal(t.roiPct, null);
  assert.equal(t.strikeRatePct, null);
});

test("a single winning core play reports its profit", () => {
  const t = buildTracker([settled("win", 1.65)]);
  assert.equal(t.wins, 1);
  assert.equal(t.settled, 1);
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
  assert.ok(Math.abs(t.roiPct! - 65) < 1e-9);
  assert.equal(t.strikeRatePct, 100);
});

test("pending picks are excluded from staked and ROI", () => {
  // Counting them shows a fake drawdown mid-round.
  const t = buildTracker([settled("win", 1.65), settled("pending", 2.0)]);
  assert.equal(t.staked, 1);
  assert.equal(t.pending, 1);
  assert.ok(Math.abs(t.roiPct! - 65) < 1e-9);
});

test("pushes settle but leave the strike-rate denominator", () => {
  const t = buildTracker([settled("win", 1.65), settled("push", 1.9)]);
  assert.equal(t.strikeRatePct, 100, "1 win from 1 decided pick");
  assert.equal(t.settled, 2);
});

test("voids refund and leave turnover entirely", () => {
  const t = buildTracker([settled("win", 1.65), settled("void", 2.0)]);
  assert.equal(t.staked, 1, "a void is not a bet");
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
});

test("losses drag profit and strike rate honestly", () => {
  const t = buildTracker([settled("win", 1.65), settled("loss", 5), settled("loss", 6)]);
  assert.equal(t.wins, 1);
  assert.equal(t.losses, 2);
  assert.ok(Math.abs(t.profitUnits - -1.35) < 1e-9);
  assert.ok(Math.abs(t.strikeRatePct! - 33.333) < 0.01);
  assert.ok(t.roiPct! < 0);
});

test("core plays and multis aggregate independently", () => {
  // The real opener: both won, but they are different products.
  const core = buildTracker([settled("win", 1.65)]);
  const sgm = buildTracker([settled("win", 5.0)]);
  assert.ok(Math.abs(core.profitUnits - 0.65) < 1e-9);
  assert.ok(Math.abs(sgm.profitUnits - 4.0) < 1e-9);
  assert.notEqual(core.roiPct, sgm.roiPct);
});

test("ROI uses settled turnover, not pick count", () => {
  const t = buildTracker([settled("win", 2.0, 1), settled("loss", 3.0, 1)]);
  assert.equal(t.staked, 2);
  assert.ok(Math.abs(t.profitUnits - 0) < 1e-9);
  assert.ok(Math.abs(t.roiPct! - 0) < 1e-9);
});
