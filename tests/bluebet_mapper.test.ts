import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMarket,
  extractPoint,
  mapMasterEventToSnapshots,
  minutesBeforeKickoff,
  normaliseSelection,
} from "../src/model/bluebet-mapper.ts";

// Captured live from BlueBet MasterEventId 2292811 (Australia v New Zealand,
// RLWC opener) on 2026-10-04. Real shape, real prices — not invented.
const REAL_PAYLOAD = {
  Events: [
    {
      EventName: "Match Winner (Australia v New Zealand)",
      Outcomes: [
        { OutcomeName: "Australia", Price: 1.66, Points: 0.0 },
        { OutcomeName: "Draw", Price: 19.0, Points: 0.0 },
        { OutcomeName: "New Zealand", Price: 2.2, Points: 0.0 },
      ],
    },
    {
      EventName: "Half-Time/Full-Time (Australia v New Zealand)",
      Outcomes: [
        { OutcomeName: "Australia/Australia", Price: 2.2, Points: 0.0 },
        { OutcomeName: "New Zealand/New Zealand", Price: 3.0, Points: 0.0 },
      ],
    },
    {
      EventName: "1st Half Handicap +1.5 (Australia v New Zealand)",
      Outcomes: [
        { OutcomeName: "Australia -1.5", Price: 1.87, Points: -1.5 },
        { OutcomeName: "New Zealand +1.5", Price: 1.87, Points: 1.5 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Market classification
// ---------------------------------------------------------------------------

test("full-match markets are classified", () => {
  assert.equal(classifyMarket("Match Winner (Australia v New Zealand)"), "h2h");
  assert.equal(classifyMarket("Line (Australia v New Zealand)"), "line");
  assert.equal(classifyMarket("Handicap (Australia v New Zealand)"), "line");
  assert.equal(classifyMarket("Total Points Over/Under 40.5 (Aus v NZ)"), "total");
});

test("part-match markets are excluded, not misfiled", () => {
  // Settling a full-match pick against a half-match price would be wrong.
  for (const name of [
    "1st Half Handicap +1.5 (Australia v New Zealand)",
    "Half-Time/Full-Time (Australia v New Zealand)",
    "2nd Half Winner (Australia v New Zealand)",
    "1st Half Total Points (Australia v New Zealand)",
  ]) {
    assert.equal(classifyMarket(name), null, `${name} must be skipped`);
  }
});

test("unknown markets are skipped rather than guessed", () => {
  for (const name of [
    "First Try Scorer (Australia v New Zealand)",
    "Winning Margin (Australia v New Zealand)",
    "",
    "Anytime Try Scorer",
  ]) {
    assert.equal(classifyMarket(name), null, `${name} must be skipped`);
  }
});

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

test("totals normalise to Over and Under", () => {
  assert.equal(normaliseSelection("total", "Over 40.5"), "Over");
  assert.equal(normaliseSelection("total", "Under 40.5"), "Under");
  assert.equal(normaliseSelection("total", "Something else"), null);
});

test("line selections drop the handicap from the team name", () => {
  assert.equal(normaliseSelection("line", "Australia -6.5"), "Australia");
  assert.equal(normaliseSelection("line", "New Zealand +6.5"), "New Zealand");
  assert.equal(normaliseSelection("line", "Papua New Guinea -12.5"), "Papua New Guinea");
});

test("the Draw is a real selection, not discarded", () => {
  assert.equal(normaliseSelection("h2h", "Draw"), "Draw");
});

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

test("h2h has no point", () => {
  assert.equal(extractPoint("h2h", { OutcomeName: "Australia", Price: 1.66, Points: 0 }, "Match Winner"), null);
});

test("line points come from the Points field", () => {
  assert.equal(extractPoint("line", { OutcomeName: "Australia -6.5", Price: 1.9, Points: -6.5 }, "Line"), -6.5);
  assert.equal(extractPoint("line", { OutcomeName: "New Zealand +6.5", Price: 1.9, Points: 6.5 }, "Line"), 6.5);
});

test("a line point falls back to the outcome name when Points is empty", () => {
  assert.equal(
    extractPoint("line", { OutcomeName: "Australia -6.5", Price: 1.9, Points: 0 }, "Line"),
    -6.5,
  );
});

test("a total line falls back to the event name", () => {
  assert.equal(
    extractPoint("total", { OutcomeName: "Over", Price: 1.9, Points: 0 }, "Total Points Over/Under 40.5"),
    40.5,
  );
});

// ---------------------------------------------------------------------------
// Mapping the real payload
// ---------------------------------------------------------------------------

test("the real opener payload maps to exactly the three h2h outcomes", () => {
  const rows = mapMasterEventToSnapshots(REAL_PAYLOAD);
  assert.equal(rows.length, 3, "only Match Winner should survive");
  assert.deepEqual(
    rows.map((r) => [r.market, r.selection, r.odds]),
    [
      ["h2h", "Australia", 1.66],
      ["h2h", "Draw", 19.0],
      ["h2h", "New Zealand", 2.2],
    ],
  );
  for (const row of rows) assert.equal(row.point, null);
});

test("half markets in the real payload are excluded", () => {
  const rows = mapMasterEventToSnapshots(REAL_PAYLOAD);
  assert.ok(
    !rows.some((r) => r.selection.includes("/")),
    "Half-Time/Full-Time outcomes must not appear",
  );
  assert.ok(
    !rows.some((r) => r.point === -1.5 || r.point === 1.5),
    "1st Half Handicap must not appear",
  );
});

test("the implied probabilities of the real h2h sum above 100", () => {
  // Sanity: a bookmaker three-way book must be overround.
  const rows = mapMasterEventToSnapshots(REAL_PAYLOAD);
  const total = rows.reduce((t, r) => t + 100 / r.odds, 0);
  assert.ok(total > 100, `expected overround, got ${total.toFixed(2)}%`);
  assert.ok(total < 120, `overround implausibly high: ${total.toFixed(2)}%`);
});

// ---------------------------------------------------------------------------
// Fail-safe behaviour
// ---------------------------------------------------------------------------

test("invalid prices are dropped", () => {
  const rows = mapMasterEventToSnapshots({
    Events: [{
      EventName: "Match Winner (A v B)",
      Outcomes: [
        { OutcomeName: "A", Price: 0, Points: 0 },
        { OutcomeName: "B", Price: 1, Points: 0 },
        { OutcomeName: "C", Price: Number.NaN, Points: 0 },
        { OutcomeName: "D", Price: 2.5, Points: 0 },
      ],
    }],
  });
  assert.deepEqual(rows.map((r) => r.selection), ["D"]);
});

test("a line with no resolvable point is dropped rather than stored as zero", () => {
  const rows = mapMasterEventToSnapshots({
    Events: [{
      EventName: "Line (A v B)",
      Outcomes: [{ OutcomeName: "Team A", Price: 1.9, Points: 0 }],
    }],
  });
  assert.deepEqual(rows, []);
});

test("malformed payloads yield no rows rather than throwing", () => {
  assert.deepEqual(mapMasterEventToSnapshots(null), []);
  assert.deepEqual(mapMasterEventToSnapshots(undefined), []);
  assert.deepEqual(mapMasterEventToSnapshots({}), []);
  assert.deepEqual(mapMasterEventToSnapshots({ Events: [] }), []);
  assert.deepEqual(mapMasterEventToSnapshots({ Events: [{}] }), []);
});

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

test("minutes before kickoff is positive before and negative after", () => {
  const kickoff = "2026-10-15T09:05:00Z";
  assert.equal(minutesBeforeKickoff(kickoff, new Date("2026-10-15T08:05:00Z")), 60);
  assert.equal(minutesBeforeKickoff(kickoff, new Date("2026-10-15T09:05:00Z")), 0);
  assert.equal(minutesBeforeKickoff(kickoff, new Date("2026-10-15T10:05:00Z")), -60);
});
