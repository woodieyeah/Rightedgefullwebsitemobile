/**
 * The prediction worker must not re-predict a match that has kicked off.
 *
 * Every fixture row is still status "scheduled" because settlement does not
 * change it, so the worker considers all of them on every run. That was
 * harmless only because TAB drops a finished match's market — until the grand
 * final repeated the Round 1 pairing (Australia v New Zealand). The settled
 * opener then matched the FINAL's live TAB market, the worker built a second
 * prediction row for it, and the insert failed on the
 * (fixture_id, model_version) unique constraint — taking the whole batch down
 * and leaving the final with no projection at all.
 *
 * Selecting by kickoff is the fix: a fixture whose kickoff has passed is
 * never a prediction candidate, whatever its status says.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectPredictionCandidates } from "../src/model/prediction-candidates.ts";

const NOW = new Date("2026-11-14T10:00:00+10:00");

const opener = {
  id: "opener",
  home_team: "Australia",
  away_team: "New Zealand",
  kickoff_at: "2026-10-15T09:05:00+00:00",
  status: "scheduled",
};
const final = {
  id: "final",
  home_team: "Australia",
  away_team: "New Zealand",
  kickoff_at: "2026-11-15T08:35:00+00:00",
  status: "scheduled",
};

test("a fixture that has kicked off is excluded even when marked scheduled", () => {
  const picked = selectPredictionCandidates([opener, final], NOW);
  assert.deepEqual(picked.map((f) => f.id), ["final"]);
});

test("the repeated pairing cannot produce two candidates", () => {
  const picked = selectPredictionCandidates([opener, final], NOW);
  const keys = picked.map((f) => `${f.home_team}__${f.away_team}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("a fixture already marked final is excluded", () => {
  const picked = selectPredictionCandidates(
    [{ ...final, status: "final" }],
    NOW,
  );
  assert.deepEqual(picked, []);
});

test("an unparseable kickoff is excluded rather than predicted blindly", () => {
  const picked = selectPredictionCandidates(
    [{ ...final, kickoff_at: "not a date" }],
    NOW,
  );
  assert.deepEqual(picked, []);
});

test("candidates come back in kickoff order", () => {
  const later = { ...final, id: "later", kickoff_at: "2026-11-16T08:35:00+00:00" };
  const picked = selectPredictionCandidates([later, final], NOW);
  assert.deepEqual(picked.map((f) => f.id), ["final", "later"]);
});
