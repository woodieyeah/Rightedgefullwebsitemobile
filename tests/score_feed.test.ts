import assert from "node:assert/strict";
import test from "node:test";
import {
  parseScoresFeed,
  toMatchResults,
} from "../src/model/score-feed.ts";

// Shape returned by the-odds-api /v4/sports/{sport}/scores/
const IN_PROGRESS = {
  id: "fecb5963b88c11d6da32cd493254dc14",
  sport_key: "rugbyleague_nrl",
  commence_time: "2026-10-04T08:30:00Z",
  completed: false,
  home_team: "Sydney Roosters",
  away_team: "Newcastle Knights",
  scores: null,
  last_update: null,
};

const LIVE = {
  ...IN_PROGRESS,
  scores: [
    { name: "Sydney Roosters", score: "12" },
    { name: "Newcastle Knights", score: "6" },
  ],
  last_update: "2026-10-04T09:10:00Z",
};

const FINAL = {
  ...IN_PROGRESS,
  completed: true,
  scores: [
    { name: "Sydney Roosters", score: "26" },
    { name: "Newcastle Knights", score: "18" },
  ],
  last_update: "2026-10-04T10:20:00Z",
};

test("a completed match parses into a final result", () => {
  const [m] = parseScoresFeed([FINAL]);
  assert.equal(m.status, "final");
  assert.equal(m.homeScore, 26);
  assert.equal(m.awayScore, 18);
  assert.equal(m.matchKey, "newcastleknights__sydneyroosters");
});

test("a live match is reported as live and is NOT settleable", () => {
  const [m] = parseScoresFeed([LIVE]);
  assert.equal(m.status, "live");
  assert.equal(m.homeScore, 12);
  assert.equal(m.awayScore, 6);
  // toMatchResults must exclude anything not final — settling a live score
  // would lock in a wrong result.
  assert.deepEqual(toMatchResults([m]), []);
});

test("a scheduled match with no scores is reported as scheduled", () => {
  const [m] = parseScoresFeed([IN_PROGRESS]);
  assert.equal(m.status, "scheduled");
  assert.equal(m.homeScore, null);
  assert.equal(m.awayScore, null);
  assert.deepEqual(toMatchResults([m]), []);
});

test("only final matches become settleable results", () => {
  const parsed = parseScoresFeed([FINAL, LIVE, IN_PROGRESS]);
  const results = toMatchResults(parsed);
  assert.equal(results.length, 1);
  assert.equal(results[0].homeScore, 26);
});

test("scores are matched by team name, never by array position", () => {
  // Feed lists away team first — a positional read would invert the result.
  const flipped = {
    ...FINAL,
    scores: [
      { name: "Newcastle Knights", score: "18" },
      { name: "Sydney Roosters", score: "26" },
    ],
  };
  const [m] = parseScoresFeed([flipped]);
  assert.equal(m.homeScore, 26, "home must be the Roosters regardless of order");
  assert.equal(m.awayScore, 18);
});

test("a completed match with a missing score stays unsettleable", () => {
  const broken = { ...FINAL, scores: [{ name: "Sydney Roosters", score: "26" }] };
  const [m] = parseScoresFeed([broken]);
  assert.equal(m.status, "error");
  assert.deepEqual(toMatchResults([m]), []);
});

test("a non-numeric score is refused rather than coerced to zero", () => {
  const broken = {
    ...FINAL,
    scores: [
      { name: "Sydney Roosters", score: "TBC" },
      { name: "Newcastle Knights", score: "18" },
    ],
  };
  const [m] = parseScoresFeed([broken]);
  assert.equal(m.status, "error");
  assert.equal(m.homeScore, null);
});

test("a completed match flagged complete but with null scores is an error", () => {
  const broken = { ...FINAL, scores: null };
  const [m] = parseScoresFeed([broken]);
  assert.equal(m.status, "error");
  assert.deepEqual(toMatchResults([m]), []);
});

test("team names are normalised into the same match key the ledger uses", () => {
  const [m] = parseScoresFeed([FINAL]);
  // Alphabetically sorted, lowercased, non-alphanumerics stripped.
  assert.equal(m.matchKey, "newcastleknights__sydneyroosters");
});

test("a malformed or empty feed yields no rows rather than throwing", () => {
  assert.deepEqual(parseScoresFeed([]), []);
  assert.deepEqual(parseScoresFeed(null as any), []);
  assert.deepEqual(parseScoresFeed([{} as any])[0].status, "error");
});

test("the feed's last_update is preserved for staleness display", () => {
  const [m] = parseScoresFeed([FINAL]);
  assert.equal(m.lastUpdate, "2026-10-04T10:20:00Z");
});
