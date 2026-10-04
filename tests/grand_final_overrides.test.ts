import assert from "node:assert/strict";
import test from "node:test";
import {
  getGrandFinalSameGameMultiPlan,
  isGrandFinalMatch,
  resolveGrandFinalSameGameMulti,
  selectForcedScorerRows,
  shouldBuildRoundMulti,
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

test("the Grand Final Same Game Multi is Sydney H2H + Tupou + Young", () => {
  assert.deepEqual(getGrandFinalSameGameMultiPlan(31, "Roosters", "Knights"), {
    resultLeg: "h2h",
    resultTeam: "sydney",
    scorers: ["Daniel Tupou", "Dominic Young"],
  });
  assert.deepEqual(getGrandFinalSameGameMultiPlan(31, "Knights", "Roosters"), {
    resultLeg: "h2h",
    resultTeam: "sydney",
    scorers: ["Daniel Tupou", "Dominic Young"],
  });
  assert.equal(getGrandFinalSameGameMultiPlan(30, "Roosters", "Knights"), null);
  assert.equal(getGrandFinalSameGameMultiPlan(31, "Storm", "Panthers"), null);
});

test("the exact Grand Final SGM resolves only when every approved live input exists", () => {
  const rows = [
    { player: "Dominic Young", team: "Knights", bestOdds: 2.5 },
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
    { player: "Greg Marzhew", team: "Knights", statsInsiderPct: 41.52, bestOdds: 2.55, marketImpliedPct: 39.22 },
    { player: "Dominic Young", team: "Knights", statsInsiderPct: 43.57, bestOdds: 2.5, marketImpliedPct: 40 },
    // Tupou carries a negative market edge (-0.75) and would never pass the
    // generic qualifying filter; the Grand Final plan names him explicitly.
    { player: "Daniel  Tupou", team: "Roosters", statsInsiderPct: 50.27, bestOdds: 1.96, marketImpliedPct: 51.02 },
  ];
  const selected = selectForcedScorerRows(rows, ["Daniel Tupou", "Dominic Young"]);
  assert.ok(selected);
  assert.deepEqual(selected.map((row) => row.player), ["Daniel  Tupou", "Dominic Young"]);
  // Any missing named scorer fails closed so the caller can fall back.
  assert.equal(selectForcedScorerRows(rows, ["Daniel Tupou", "James Tedesco"]), null);
  assert.equal(selectForcedScorerRows([], ["Daniel Tupou"]), null);
});
