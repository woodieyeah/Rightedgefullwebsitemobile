import assert from "node:assert/strict";
import test from "node:test";
import {
  getGrandFinalSameGameMultiPlan,
  isGrandFinalMatch,
  pickForcedCorePlay,
  preferForcedGrandFinalCorePlay,
  resolveGrandFinalSameGameMulti,
  selectForcedScorerRows,
  shouldBuildRoundMulti,
  shouldForceGrandFinalCorePlay,
} from "../src/app/grand-final-overrides.ts";

test("a one-game round never produces a Round Multi", () => {
  assert.equal(shouldBuildRoundMulti(1), false);
  assert.equal(shouldBuildRoundMulti(0), false);
  assert.equal(shouldBuildRoundMulti(2), true);
  assert.equal(shouldBuildRoundMulti(8), true);
});

test("the Grand Final is matched on round 31 Sydney v Newcastle under any team alias", () => {
  assert.equal(isGrandFinalMatch(31, "Sydney", "Newcastle"), true);
  assert.equal(isGrandFinalMatch(31, "Roosters", "Knights"), true);
  assert.equal(isGrandFinalMatch(31, "Sydney Roosters", "Newcastle Knights"), true);
  assert.equal(isGrandFinalMatch(31, "Newcastle Knights", "Sydney Roosters"), true);
  // Wrong round or a different pairing are not overridden.
  assert.equal(isGrandFinalMatch(30, "Sydney", "Newcastle"), false);
  assert.equal(isGrandFinalMatch(31, "Storm", "Panthers"), false);
});

test("the Grand Final Roosters -6.5 line is the approved forced Core Play", () => {
  const approved = {
    roundNumber: 31,
    homeTeam: "Sydney",
    awayTeam: "Newcastle",
    marketType: "Line",
    selection: "sydney -6.5",
    marketPoint: -6.5,
  };
  assert.equal(shouldForceGrandFinalCorePlay(approved), true);
  // Only the exact approved point qualifies: -7.5 is a different market.
  assert.equal(shouldForceGrandFinalCorePlay({
    ...approved,
    selection: "sydney -7.5",
    marketPoint: -7.5,
  }), false);
  // The other side of the same line is not the approved play.
  assert.equal(shouldForceGrandFinalCorePlay({
    ...approved,
    selection: "newcastle +6.5",
    marketPoint: 6.5,
  }), false);
  // Totals and H2H on the Grand Final are never the forced play.
  assert.equal(shouldForceGrandFinalCorePlay({
    ...approved,
    marketType: "Total",
    selection: "Over 42.5",
    marketPoint: 42.5,
  }), false);
  // Every other round keeps the generic thresholds.
  assert.equal(shouldForceGrandFinalCorePlay({ ...approved, roundNumber: 30 }), false);
});

test("a manually approved candidate wins the Core Play slot over a higher-scoring generic one", () => {
  const generic = { id: "generic", isManualApproved: false };
  const approved = { id: "roosters-line", isManualApproved: true };
  // Candidates arrive sorted by adjusted confidence (best first).
  assert.equal(pickForcedCorePlay([generic, approved]), approved);
  // Rounds without a forced play are untouched, so the generic chooser decides.
  assert.equal(pickForcedCorePlay([generic]), undefined);
  assert.equal(pickForcedCorePlay([]), undefined);
});

test("a forced live Grand Final Core Play takes precedence over a stale official pending play", () => {
  const forcedLive = { id: "roosters-line", isManualApproved: true };
  const staleOfficial = { id: "stale", isManualApproved: true };
  const normalLive = { id: "generic-live", isManualApproved: false };

  assert.equal(preferForcedGrandFinalCorePlay(forcedLive, staleOfficial), forcedLive);
  // Ordinary matches keep official-pending precedence.
  assert.equal(preferForcedGrandFinalCorePlay(normalLive, staleOfficial), staleOfficial);
  assert.equal(preferForcedGrandFinalCorePlay(normalLive, null), normalLive);
  assert.equal(preferForcedGrandFinalCorePlay(null, staleOfficial), staleOfficial);
});

test("the Grand Final Same Game Multi is Sydney H2H + Tupou + Sharpe", () => {
  assert.deepEqual(getGrandFinalSameGameMultiPlan(31, "Roosters", "Knights"), {
    resultLeg: "h2h",
    resultTeam: "sydney",
    scorers: ["Daniel Tupou", "Fletcher Sharpe"],
  });
  assert.deepEqual(getGrandFinalSameGameMultiPlan(31, "Knights", "Roosters"), {
    resultLeg: "h2h",
    resultTeam: "sydney",
    scorers: ["Daniel Tupou", "Fletcher Sharpe"],
  });
  assert.equal(getGrandFinalSameGameMultiPlan(30, "Roosters", "Knights"), null);
  assert.equal(getGrandFinalSameGameMultiPlan(31, "Storm", "Panthers"), null);
});

test("the exact Grand Final SGM resolves only when every approved live input exists", () => {
  const rows = [
    { player: "Fletcher Sharpe", team: "Knights", bestOdds: 3.25 },
    { player: "Daniel Tupou", team: "Roosters", bestOdds: 1.96 },
  ];
  assert.deepEqual(
    resolveGrandFinalSameGameMulti(31, "Roosters", "Knights", 1.45, rows),
    { resultH2hOdds: 1.45, scorers: [rows[1], rows[0]] },
  );
  assert.deepEqual(
    resolveGrandFinalSameGameMulti(31, "Knights", "Roosters", 1.45, rows),
    { resultH2hOdds: 1.45, scorers: [rows[1], rows[0]] },
  );
  assert.equal(
    resolveGrandFinalSameGameMulti(31, "Roosters", "Knights", 0, rows),
    null,
  );
  assert.equal(
    resolveGrandFinalSameGameMulti(31, "Roosters", "Knights", 1.45, rows.slice(0, 1)),
    null,
  );
  assert.equal(
    resolveGrandFinalSameGameMulti(
      31,
      "Roosters",
      "Knights",
      1.45,
      [{ ...rows[0], bestOdds: 0 }, rows[1]],
    ),
    null,
  );
  assert.equal(
    resolveGrandFinalSameGameMulti(30, "Roosters", "Knights", 1.45, rows),
    undefined,
  );
});

test("forced scorer rows are picked by name in plan order, ignoring the generic value gate", () => {
  const rows = [
    { player: "Dominic Young", team: "Knights", statsInsiderPct: 43.57, bestOdds: 2.5, marketImpliedPct: 40 },
    // Sharpe carries a negative market edge (-1.70) and would never pass the
    // generic qualifying filter; the Grand Final plan names him explicitly.
    { player: "Fletcher Sharpe", team: "Knights", statsInsiderPct: 29.07, bestOdds: 3.25, marketImpliedPct: 30.77 },
    // Tupou carries a negative market edge (-0.75) and would never pass the
    // generic qualifying filter; the Grand Final plan names him explicitly.
    { player: "Daniel  Tupou", team: "Roosters", statsInsiderPct: 50.27, bestOdds: 1.96, marketImpliedPct: 51.02 },
  ];
  const selected = selectForcedScorerRows(rows, ["Daniel Tupou", "Fletcher Sharpe"]);
  assert.ok(selected);
  assert.deepEqual(selected.map((row) => row.player), ["Daniel  Tupou", "Fletcher Sharpe"]);
  // Any missing named scorer fails closed so the caller can fall back.
  assert.equal(selectForcedScorerRows(rows, ["Daniel Tupou", "James Tedesco"]), null);
  assert.equal(selectForcedScorerRows([], ["Daniel Tupou"]), null);
});
