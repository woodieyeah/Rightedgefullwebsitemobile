import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveProjection,
  devigTwoWay,
  expectedTotalFromExactMarket,
  extractHandicap,
  extractPerTeamTotals,
  type BlueBetEvent,
} from "../src/model/bluebet-markets.ts";

// ---------------------------------------------------------------------------
// Real captured payloads (web20-api.bluebet.com.au, 2026-10-13).
// ---------------------------------------------------------------------------

const AUS_NZ_MATCH_RESULT: BlueBetEvent = {
  EventName: "Match Result (Australia v New Zealand)",
  Outcomes: [
    { OutcomeName: "Australia", Points: 0, Price: 1.65 },
    { OutcomeName: "New Zealand", Points: 0, Price: 2.25 },
    { OutcomeName: "Australia", Points: -3.5, Price: 1.85 },
    { OutcomeName: "New Zealand", Points: 3.5, Price: 1.95 },
  ],
};

const AUS_NZ_HOME_TOTAL: BlueBetEvent = {
  EventName: "Home Team Total Match Points Over/Under +21.5 (Australia v New Zealand)",
  Outcomes: [
    { OutcomeName: "Over 21.5", Points: 0, Price: 1.98 },
    { OutcomeName: "Under 21.5", Points: 0, Price: 1.77 },
  ],
};

const AUS_NZ_EXACT: BlueBetEvent = {
  EventName: "Match points exactly (Australia v New Zealand)",
  Outcomes: [
    { OutcomeName: "Total points - exactly 38 (Match)", Points: 0, Price: 11.0 },
    { OutcomeName: "Total points - exactly 44 (Match)", Points: 0, Price: 12.0 },
    { OutcomeName: "Total points - exactly 36 (Match)", Points: 0, Price: 13.0 },
    { OutcomeName: "Total points - exactly 40 (Match)", Points: 0, Price: 13.0 },
    { OutcomeName: "Total points - exactly 42 (Match)", Points: 0, Price: 13.0 },
    { OutcomeName: "Total points - exactly 34 (Match)", Points: 0, Price: 13.0 },
    { OutcomeName: "Total points - exactly 46 (Match)", Points: 0, Price: 14.0 },
    { OutcomeName: "Total points - exactly 37 (Match)", Points: 0, Price: 36.0 },
    { OutcomeName: "Total points - exactly 43 (Match)", Points: 0, Price: 41.0 },
    { OutcomeName: "Total points - exactly 45 (Match)", Points: 0, Price: 41.0 },
    { OutcomeName: "Total points - exactly 33 (Match)", Points: 0, Price: 46.0 },
    { OutcomeName: "Total points - exactly 41 (Match)", Points: 0, Price: 46.0 },
    { OutcomeName: "Total points - exactly 39 (Match)", Points: 0, Price: 46.0 },
    { OutcomeName: "Total points - exactly 35 (Match)", Points: 0, Price: 51.0 },
    { OutcomeName: "Total points - exactly 47 (Match)", Points: 0, Price: 56.0 },
  ],
};

const SAM_FRA_HOME_TOTAL: BlueBetEvent = {
  EventName: "Home Team Total Match Points Over/Under +53.5 (Samoa v France)",
  Outcomes: [
    { OutcomeName: "Over 53.5", Points: 0, Price: 1.81 },
    { OutcomeName: "Under 53.5", Points: 0, Price: 1.93 },
  ],
};

const SAM_FRA_AWAY_TOTAL: BlueBetEvent = {
  EventName: "Away Team Total Match Points Over/Under +5.5 (Samoa v France)",
  Outcomes: [
    { OutcomeName: "Over 5.5", Points: 0, Price: 1.88 },
    { OutcomeName: "Under 5.5", Points: 0, Price: 1.85 },
  ],
};

const SAM_FRA_FIRST_HALF: BlueBetEvent = {
  EventName: "1st Half Total Points Over/Under +28.5 (Samoa v France)",
  Outcomes: [
    { OutcomeName: "Over 28.5", Points: 0, Price: 1.96 },
    { OutcomeName: "Under 28.5", Points: 0, Price: 1.78 },
  ],
};

const ENG_TON_MATCH_RESULT: BlueBetEvent = {
  EventName: "Match Result (England v Tonga)",
  Outcomes: [
    { OutcomeName: "England", Points: 0, Price: 2.1 },
    { OutcomeName: "Tonga", Points: 0, Price: 1.72 },
    { OutcomeName: "England", Points: 2.5, Price: 1.9 },
    { OutcomeName: "Tonga", Points: -2.5, Price: 1.9 },
  ],
};

// ---------------------------------------------------------------------------
// devigTwoWay
// ---------------------------------------------------------------------------

test("a two-way market de-vigs to probabilities summing to one", () => {
  const out = devigTwoWay(1.98, 1.77)!;
  assert.ok(Math.abs(out.first + out.second - 1) < 1e-9);
});

test("the shorter price carries the higher probability", () => {
  const out = devigTwoWay(1.77, 1.98)!;
  assert.ok(out.first > out.second);
});

test("the Australia home-total market prices the under slightly ahead", () => {
  // Over 21.5 @ 1.98 vs Under @ 1.77 -> the line sits just above the median.
  const out = devigTwoWay(1.98, 1.77)!;
  assert.ok(Math.abs(out.first - 0.472) < 0.002, `over prob ${out.first}`);
});

test("non-positive or missing prices yield null", () => {
  assert.equal(devigTwoWay(0, 1.9), null);
  assert.equal(devigTwoWay(1.9, Number.NaN), null);
  assert.equal(devigTwoWay(-2, 1.9), null);
});

// ---------------------------------------------------------------------------
// extractHandicap — the margin, signed from the home team's perspective.
// ---------------------------------------------------------------------------

test("a home favourite's handicap becomes a positive margin", () => {
  const out = extractHandicap(AUS_NZ_MATCH_RESULT, "Australia")!;
  assert.equal(out.margin, 3.5);
  assert.equal(out.price, 1.85);
});

test("an away favourite yields a negative home margin", () => {
  // England +2.5 means Tonga is favoured: the home margin is negative.
  const out = extractHandicap(ENG_TON_MATCH_RESULT, "England")!;
  assert.equal(out.margin, -2.5);
});

test("the zero-point head-to-head line is never mistaken for a handicap", () => {
  // Every Match Result market carries a 0.0-point h2h entry first. Picking it
  // up as the handicap would project every match as a dead heat.
  const out = extractHandicap(AUS_NZ_MATCH_RESULT, "Australia")!;
  assert.notEqual(out.margin, 0);
});

test("a market with no handicap entry yields null", () => {
  const h2hOnly: BlueBetEvent = {
    EventName: "Match Result (A v B)",
    Outcomes: [
      { OutcomeName: "A", Points: 0, Price: 1.5 },
      { OutcomeName: "B", Points: 0, Price: 2.5 },
    ],
  };
  assert.equal(extractHandicap(h2hOnly, "A"), null);
});

test("the handicap is matched by team name, not by position", () => {
  const reordered: BlueBetEvent = {
    EventName: "Match Result (Australia v New Zealand)",
    Outcomes: [
      { OutcomeName: "New Zealand", Points: 3.5, Price: 1.95 },
      { OutcomeName: "Australia", Points: -3.5, Price: 1.85 },
    ],
  };
  assert.equal(extractHandicap(reordered, "Australia")!.margin, 3.5);
});

// ---------------------------------------------------------------------------
// extractPerTeamTotals — the most direct route to a scoreline.
// ---------------------------------------------------------------------------

test("both per-team total lines are read from their market names", () => {
  const out = extractPerTeamTotals([SAM_FRA_HOME_TOTAL, SAM_FRA_AWAY_TOTAL])!;
  assert.equal(out.homeLine, 53.5);
  assert.equal(out.awayLine, 5.5);
});

test("a first-half total is never mistaken for a full-match total", () => {
  // Settling or projecting a full match against a half line would be silently
  // wrong, and the 1st-half market sits in the same group.
  const out = extractPerTeamTotals([SAM_FRA_FIRST_HALF]);
  assert.equal(out, null);
});

test("a lone home total yields the home line and no away line", () => {
  const out = extractPerTeamTotals([AUS_NZ_HOME_TOTAL])!;
  assert.equal(out.homeLine, 21.5);
  assert.equal(out.awayLine, null);
});

test("an empty market list yields null", () => {
  assert.equal(extractPerTeamTotals([]), null);
});

// ---------------------------------------------------------------------------
// expectedTotalFromExactMarket
// ---------------------------------------------------------------------------

test("the exact-points ladder yields an expected total near forty", () => {
  const out = expectedTotalFromExactMarket(AUS_NZ_EXACT)!;
  assert.ok(Math.abs(out.expectedTotal - 39.93) < 0.05, `got ${out.expectedTotal}`);
  assert.equal(out.buckets, 15);
});

test("the exact-points ladder reports its own coverage", () => {
  // The ladder spans 33-47 only, so it is a conditional expectation. Callers
  // must be able to see that rather than treat it as unconditional.
  const out = expectedTotalFromExactMarket(AUS_NZ_EXACT)!;
  assert.equal(out.minPoints, 33);
  assert.equal(out.maxPoints, 47);
});

test("a market with no parseable buckets yields null", () => {
  assert.equal(
    expectedTotalFromExactMarket({
      EventName: "Match points exactly (A v B)",
      Outcomes: [{ OutcomeName: "Something else", Points: 0, Price: 5 }],
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// deriveProjection — precedence, and the cross-check that matters.
// ---------------------------------------------------------------------------

test("both per-team lines project the scoreline directly", () => {
  const out = deriveProjection({
    homeTeam: "Samoa",
    awayTeam: "France",
    markets: [SAM_FRA_HOME_TOTAL, SAM_FRA_AWAY_TOTAL],
  })!;
  assert.equal(out.home, 53.5);
  assert.equal(out.away, 5.5);
  assert.equal(out.source, "per-team-totals");
});

test("a home line plus a handicap projects the away score", () => {
  const out = deriveProjection({
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    markets: [AUS_NZ_MATCH_RESULT, AUS_NZ_HOME_TOTAL],
  })!;
  assert.equal(out.home, 21.5);
  assert.equal(out.away, 18.0);
  assert.equal(out.margin, 3.5);
  assert.equal(out.source, "home-total-plus-handicap");
});

test("the exact-points ladder plus a handicap projects a scoreline", () => {
  const out = deriveProjection({
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    markets: [AUS_NZ_MATCH_RESULT, AUS_NZ_EXACT],
  })!;
  // total 39.93, margin 3.5
  assert.ok(Math.abs(out.home - 21.72) < 0.02, `home ${out.home}`);
  assert.ok(Math.abs(out.away - 18.22) < 0.02, `away ${out.away}`);
  assert.equal(out.source, "exact-total-plus-handicap");
});

test("the two independent routes agree to within a point", () => {
  // This is the real validation: per-team lines and the exact-points ladder are
  // unrelated markets. If the derivation were wrong, they would not converge.
  const viaLine = deriveProjection({
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    markets: [AUS_NZ_MATCH_RESULT, AUS_NZ_HOME_TOTAL],
  })!;
  const viaExact = deriveProjection({
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    markets: [AUS_NZ_MATCH_RESULT, AUS_NZ_EXACT],
  })!;
  assert.ok(Math.abs(viaLine.home - viaExact.home) < 1, "home scores must converge");
  assert.ok(Math.abs(viaLine.away - viaExact.away) < 1, "away scores must converge");
});

test("per-team totals are preferred over the handicap route", () => {
  const out = deriveProjection({
    homeTeam: "Samoa",
    awayTeam: "France",
    markets: [SAM_FRA_HOME_TOTAL, SAM_FRA_AWAY_TOTAL, SAM_FRA_FIRST_HALF],
  })!;
  assert.equal(out.source, "per-team-totals");
});

test("a handicap alone yields no projection", () => {
  // England v Tonga has a handicap but no totals market of any kind. A
  // projection would have to invent the total.
  assert.equal(
    deriveProjection({
      homeTeam: "England",
      awayTeam: "Tonga",
      markets: [ENG_TON_MATCH_RESULT],
    }),
    null,
  );
});

test("no markets at all yields no projection", () => {
  assert.equal(
    deriveProjection({ homeTeam: "A", awayTeam: "B", markets: [] }),
    null,
  );
});

test("a projection never returns a negative score", () => {
  const lopsided: BlueBetEvent = {
    EventName: "Match Result (A v B)",
    Outcomes: [
      { OutcomeName: "A", Points: -60, Price: 1.9 },
      { OutcomeName: "B", Points: 60, Price: 1.9 },
    ],
  };
  const smallTotal: BlueBetEvent = {
    EventName: "Home Team Total Match Points Over/Under +10.5 (A v B)",
    Outcomes: [
      { OutcomeName: "Over 10.5", Points: 0, Price: 1.9 },
      { OutcomeName: "Under 10.5", Points: 0, Price: 1.9 },
    ],
  };
  const out = deriveProjection({ homeTeam: "A", awayTeam: "B", markets: [lopsided, smallTotal] });
  assert.equal(out, null, "an incoherent pair must be rejected, not shown");
});
