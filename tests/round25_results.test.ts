import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ROUND_25_CORE_PLAYS,
  ROUND_25_SAME_GAME_MULTIS,
  ROUND_25_VERIFIED_RESULTS,
  settleRound25CorePlay,
  settleRound25SameGameMulti,
} from "../src/app/round25-results.ts";

const appSource = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("Round 25 contains eight independently cross-checked final scores", () => {
  assert.equal(ROUND_25_VERIFIED_RESULTS.length, 8);
  assert.deepEqual(
    ROUND_25_VERIFIED_RESULTS.map(({ match, finalHome, finalAway }) => [
      match,
      finalHome,
      finalAway,
    ]),
    [
      ["Storm v Panthers", 14, 22],
      ["Raiders v Broncos", 30, 34],
      ["Dolphins v Eels", 34, 16],
      ["Knights v Sea Eagles", 24, 44],
      ["Rabbitohs v Warriors", 26, 45],
      ["Dragons v Bulldogs", 14, 44],
      ["Titans v Sharks", 22, 30],
      ["Roosters v Tigers", 24, 25],
    ],
  );
  assert.deepEqual(
    ROUND_25_VERIFIED_RESULTS.map((match) => match.espnEventId),
    [603434, 603435, 603436, 603437, 603438, 603439, 603440, 603441],
  );
  for (const match of ROUND_25_VERIFIED_RESULTS) {
    assert.ok(match.championDataMatchId > 0);
    assert.ok(match.espnEventId > 0);
    assert.equal(match.sourcesAgree, true);
  }
});

test("Round 25 core plays are settled from frozen selections and verified scores", () => {
  assert.equal(ROUND_25_CORE_PLAYS.length, 4);
  assert.deepEqual(
    ROUND_25_CORE_PLAYS.map((play) => [play.selection, settleRound25CorePlay(play)]),
    [
      ["Dolphins -13.5", "Hit"],
      ["Sea Eagles +8.5", "Hit"],
      ["Rabbitohs +4.5", "Miss"],
      ["Tigers +23.5", "Hit"],
    ],
  );
});

test("Round 25 SGMs settle every leg from verified scores and scorer stats", () => {
  assert.equal(ROUND_25_SAME_GAME_MULTIS.length, 7);
  assert.deepEqual(
    ROUND_25_SAME_GAME_MULTIS.map((multi) => [
      multi.match,
      settleRound25SameGameMulti(multi).result,
    ]),
    [
      ["Storm v Panthers", "Miss"],
      ["Dolphins v Eels", "Hit"],
      ["Knights v Sea Eagles", "Miss"],
      ["Rabbitohs v Warriors", "Hit"],
      ["Dragons v Bulldogs", "Hit"],
      ["Titans v Sharks", "Miss"],
      ["Roosters v Tigers", "Miss"],
    ],
  );

  const dolphins = settleRound25SameGameMulti(
    ROUND_25_SAME_GAME_MULTIS.find((multi) => multi.match === "Dolphins v Eels")!,
  );
  assert.deepEqual(dolphins.legs.map((leg) => [leg.label, leg.result]), [
    ["Dolphins", "Hit"],
    ["Selwyn Cobbo", "Hit"],
    ["Jamayne Isaako", "Hit"],
  ]);

  const storm = settleRound25SameGameMulti(
    ROUND_25_SAME_GAME_MULTIS.find((multi) => multi.match === "Storm v Panthers")!,
  );
  assert.deepEqual(storm.legs.map((leg) => [leg.label, leg.result]), [
    ["Panthers", "Hit"],
    ["Dylan Edwards", "Miss"],
    ["Moses Leo", "Miss"],
  ]);
});

test("Round 25 is registered in results and match cards reveal SGMs at kickoff", () => {
  assert.match(appSource, /const ROUND_25_PROOF: RoundArchive/);
  assert.match(
    appSource,
    /const HARDCODED_ROUND_ARCHIVES: RoundArchive\[\] = \[[\s\S]*ROUND_25_PROOF/,
  );
  assert.match(appSource, /function MatchSameGameMultiCard/);
  assert.match(appSource, /sameGameMultiCard=\{matchSameGameMultiCard\}/);
  assert.match(
    appSource,
    /const locked = !isPremium && card\.status === "upcoming" && index > 0/,
  );
});

test("completed live cards use verified archive scores and settled SGM outcomes", () => {
  assert.match(
    appSource,
    /function getExactRoundProofArchiveForPrediction[\s\S]*?candidate\.round === row\.roundNumber/,
  );
  assert.match(
    appSource,
    /if \(Number\.isFinite\(row\.roundNumber\) && row\.roundNumber > 0\) return null;/,
  );
  assert.match(appSource, /const proofFixtureFinalScore =/);
  assert.match(
    appSource,
    /const proofFinalScore = proofMatchPlays\.find\([\s\S]*?\|\| proofFixtureFinalScore \|\| ""/,
  );
  assert.match(appSource, /const resolvedProofArchive = getExactRoundProofArchiveForPrediction/);
  assert.match(appSource, /const proofSameGameMulti = resolvedProofArchive\?\.sameGameMultis\?\.find/);
  assert.match(
    appSource,
    /const matchSameGameMultiCard = proofSameGameMulti \|\| liveSameGameMulti/,
  );
});
