import assert from "node:assert/strict";
import test from "node:test";
import {
  RLWC_ROUND_OFFSET,
  adaptFixture,
  adaptFixtures,
  adaptPrediction,
  isRlwcRound,
  toRoundNumber,
} from "../src/app/rlwc/adapt.ts";
import type { PublicFixture } from "../src/app/rlwc/fixtures.ts";

const opener: PublicFixture = {
  id: "1",
  competition: "rlwc",
  competition_name: "Rugby League World Cup",
  round_number: 1,
  round_label: "Round 1",
  home_team: "Australia",
  away_team: "New Zealand",
  match_key: "australia__newzealand",
  kickoff_at: "2026-10-15T09:05:00+00:00",
  venue_timezone: "Australia/Sydney",
  stadium: "Allianz Stadium",
  status: "scheduled",
  home_score: null,
  away_score: null,
};

const perth: PublicFixture = {
  ...opener,
  id: "4",
  home_team: "England",
  away_team: "Tonga",
  match_key: "england__tonga",
  kickoff_at: "2026-10-17T09:05:00+00:00",
  venue_timezone: "Australia/Perth",
  stadium: "HBF Park",
};

// ---------------------------------------------------------------------------
// Round numbering must not collide with the NRL.
// ---------------------------------------------------------------------------

test("RLWC rounds are offset clear of NRL round numbers", () => {
  assert.equal(toRoundNumber(opener), 101);
  assert.equal(toRoundNumber({ ...opener, round_number: 3 }), 103);
  // NRL 2026 ran to round 31; the offset leaves unambiguous space.
  assert.ok(toRoundNumber(opener) > 31);
});

test("RLWC rounds are identifiable, NRL rounds are not mistaken for them", () => {
  assert.equal(isRlwcRound(101), true);
  assert.equal(isRlwcRound(31), false);
  assert.equal(isRlwcRound(1), false);
  assert.equal(isRlwcRound(RLWC_ROUND_OFFSET), false);
});

// ---------------------------------------------------------------------------
// Fixture adaptation
// ---------------------------------------------------------------------------

test("the opener adapts with venue-local kickoff details", () => {
  const f = adaptFixture(opener);
  assert.equal(f.homeTeam, "Australia");
  assert.equal(f.awayTeam, "New Zealand");
  assert.equal(f.day, "Thursday");
  assert.equal(f.aedt, "8:05 PM");
  assert.equal(f.tz, "AEDT");
  assert.equal(f.stadium, "Allianz Stadium");
  assert.equal(f.dateISO, "2026-10-15");
  assert.equal(f.roundLabel, "RLWC Round 1");
});

test("a Perth fixture carries Perth time, not Sydney time", () => {
  const f = adaptFixture(perth);
  assert.equal(f.aedt, "5:05 PM", "must be venue-local");
  assert.equal(f.tz, "AWST");
});

test("a missing stadium degrades to a label rather than an empty string", () => {
  assert.equal(adaptFixture({ ...opener, stadium: null }).stadium, "Venue TBC");
});

// ---------------------------------------------------------------------------
// Prediction adaptation — honest empties, never invented numbers.
// ---------------------------------------------------------------------------

test("an unmodelled fixture produces zeroed projections, not guesses", () => {
  const p = adaptPrediction(opener);
  assert.equal(p.predictedHomeScore, 0);
  assert.equal(p.predictedAwayScore, 0);
  assert.equal(p.predictedWinner, "");
  assert.equal(p.modelHomeOdds, 0);
  assert.equal(p.marketHomeOdds, 0);
  assert.equal(p.bestEdge, 0);
});

test("an unmodelled fixture advertises no play", () => {
  const p = adaptPrediction(opener);
  assert.equal(p.bestBet, "");
  assert.equal(p.side, "");
  assert.equal(p.stake, 0);
});

test("the match label matches the card's expected format", () => {
  assert.equal(adaptPrediction(opener).match, "Australia v New Zealand");
});

test("the prediction carries its fixture so the card can render kickoff", () => {
  const p = adaptPrediction(perth);
  assert.ok(p.fixture);
  assert.equal(p.fixture.stadium, "HBF Park");
  assert.equal(p.fixture.aedt, "5:05 PM");
});

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

test("a batch adapts to matching predictions and fixtures", () => {
  const out = adaptFixtures([opener, perth]);
  assert.equal(out.predictions.length, 2);
  assert.equal(out.fixtures.length, 2);
  assert.equal(out.predictions[0].homeTeam, "Australia");
  assert.equal(out.fixtures[1].stadium, "HBF Park");
});

test("an empty batch adapts to empty lists", () => {
  const out = adaptFixtures([]);
  assert.deepEqual(out.predictions, []);
  assert.deepEqual(out.fixtures, []);
});
