import assert from "node:assert/strict";
import test from "node:test";
import {
  formatKickoff,
  groupByRound,
  selectCurrentFixtures,
  type PublicFixture,
} from "../src/app/rlwc/fixtures.ts";

const base: PublicFixture = {
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

// ---------------------------------------------------------------------------
// Timezone correctness — the bug the sheet-era code could not express.
// ---------------------------------------------------------------------------

test("the opener renders in Sydney time", () => {
  const out = formatKickoff(base);
  assert.equal(out.day, "Thursday");
  assert.equal(out.time, "8:05 PM");
  assert.equal(out.tzLabel, "AEDT");
});

test("a Perth venue renders in AWST, three hours behind Sydney", () => {
  // England v Tonga, HBF Park.
  const out = formatKickoff({
    ...base,
    kickoff_at: "2026-10-17T09:05:00+00:00",
    venue_timezone: "Australia/Perth",
  });
  assert.equal(out.time, "5:05 PM");
  assert.equal(out.tzLabel, "AWST");
});

test("a Christchurch venue renders in NZDT, two hours ahead of Sydney", () => {
  const out = formatKickoff({
    ...base,
    kickoff_at: "2026-10-25T05:05:00+00:00",
    venue_timezone: "Pacific/Auckland",
  });
  assert.equal(out.time, "6:05 PM");
  assert.equal(out.tzLabel, "NZDT");
});

test("Brisbane does not observe daylight saving", () => {
  // Same instant, one hour behind Sydney during DST.
  const sydney = formatKickoff({ ...base, kickoff_at: "2026-10-25T09:05:00+00:00" });
  const brisbane = formatKickoff({
    ...base,
    kickoff_at: "2026-10-25T09:05:00+00:00",
    venue_timezone: "Australia/Brisbane",
  });
  assert.equal(sydney.time, "8:05 PM");
  assert.equal(brisbane.time, "7:05 PM");
});

test("Port Moresby renders correctly", () => {
  const out = formatKickoff({
    ...base,
    kickoff_at: "2026-10-17T04:25:00+00:00",
    venue_timezone: "Pacific/Port_Moresby",
  });
  assert.equal(out.time, "2:25 PM");
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

test("upcoming fixtures are always shown", () => {
  const now = new Date("2026-10-06T00:00:00Z");
  assert.equal(selectCurrentFixtures([base], now).length, 1);
});

test("a recently finished match stays visible, an old one does not", () => {
  const now = new Date("2026-10-16T09:05:00Z"); // 24h after kickoff
  const recent: PublicFixture = {
    ...base, status: "final", home_score: 24, away_score: 18,
  };
  assert.equal(selectCurrentFixtures([recent], now, 48).length, 1, "24h old stays");
  assert.equal(selectCurrentFixtures([recent], now, 12).length, 0, "beyond window drops");
});

test("a live match is never dropped regardless of age", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const live: PublicFixture = { ...base, status: "live" };
  assert.equal(selectCurrentFixtures([live], now, 1).length, 1);
});

test("an unparseable kickoff is dropped rather than rendered", () => {
  assert.equal(selectCurrentFixtures([{ ...base, kickoff_at: "not a date" }]).length, 0);
});

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

test("fixtures group by round in round order", () => {
  const groups = groupByRound([
    { ...base, id: "3", round_number: 3, round_label: "Round 3" },
    { ...base, id: "1", round_number: 1, round_label: "Round 1" },
    { ...base, id: "2", round_number: 1, round_label: "Round 1" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].roundNumber, 1);
  assert.equal(groups[0].fixtures.length, 2);
  assert.equal(groups[1].roundNumber, 3);
});

test("an empty list groups to nothing", () => {
  assert.deepEqual(groupByRound([]), []);
});
