import assert from "node:assert/strict";
import test from "node:test";
import {
  bookAgreementPct,
  buildModelPrediction,
  consensusProbabilities,
  matchesFixture,
  parseTabMatch,
  type TabMatch,
} from "../src/model/tab-markets.ts";

// ---------------------------------------------------------------------------
// Real captured TAB payloads (webapi.tab.com.au, 2026-10-13).
// ---------------------------------------------------------------------------

const AUS_NZ: TabMatch = {
  name: "Australia v New Zealand",
  startTime: "2026-10-15T09:05:00.000Z",
  markets: [
    {
      betOption: "Head To Head",
      propositions: [
        { name: "Australia", returnWin: 1.62 },
        { name: "New Zealand", returnWin: 2.3 },
      ],
    },
    {
      betOption: "Line",
      propositions: [
        { name: "Australia -3.5", returnWin: 1.9 },
        { name: "New Zealand +3.5", returnWin: 1.9 },
      ],
    },
    {
      betOption: "Total Points Over/Under",
      propositions: [
        { name: "Over 38.5", returnWin: 1.9 },
        { name: "Under 38.5", returnWin: 1.9 },
      ],
    },
    {
      // Must never be mistaken for the full-match total.
      betOption: "1st Half Total Points O/U",
      propositions: [
        { name: "Over 18.5", returnWin: 1.87 },
        { name: "Under 18.5", returnWin: 1.87 },
      ],
    },
  ],
};

const ENG_TON: TabMatch = {
  name: "England v Tonga",
  startTime: "2026-10-17T09:05:00.000Z",
  markets: [
    {
      betOption: "Head To Head",
      propositions: [
        { name: "England", returnWin: 2.2 },
        { name: "Tonga", returnWin: 1.65 },
      ],
    },
    {
      // The home team is the UNDERDOG here: England +2.5.
      betOption: "Line",
      propositions: [
        { name: "England +2.5", returnWin: 1.9 },
        { name: "Tonga -2.5", returnWin: 1.9 },
      ],
    },
    {
      betOption: "Total Points Over/Under",
      propositions: [
        { name: "Over 38.5", returnWin: 1.95 },
        { name: "Under 38.5", returnWin: 1.8 },
      ],
    },
  ],
};

const SAM_FRA: TabMatch = {
  name: "Samoa v France",
  startTime: "2026-10-16T06:45:00.000Z",
  markets: [
    {
      betOption: "Head To Head",
      propositions: [
        { name: "Samoa", returnWin: 1.01 },
        { name: "France", returnWin: 26 },
      ],
    },
    {
      betOption: "Line",
      propositions: [
        { name: "Samoa -48.5", returnWin: 1.9 },
        { name: "France +48.5", returnWin: 1.9 },
      ],
    },
    {
      betOption: "Total Points Over/Under",
      propositions: [
        { name: "Over 59.5", returnWin: 1.87 },
        { name: "Under 59.5", returnWin: 1.87 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// parseTabMatch
// ---------------------------------------------------------------------------

test("the opener's three core markets are parsed", () => {
  const out = parseTabMatch(AUS_NZ, "Australia", "New Zealand")!;
  assert.equal(out.homePrice, 1.62);
  assert.equal(out.awayPrice, 2.3);
  assert.equal(out.homeLine, -3.5);
  assert.equal(out.total, 38.5);
});

test("an underdog home team keeps its positive line", () => {
  const out = parseTabMatch(ENG_TON, "England", "Tonga")!;
  assert.equal(out.homeLine, 2.5, "England are +2.5, not -2.5");
});

test("the first-half total is never read as the full-match total", () => {
  // Both markets are present; picking the half line would roughly halve every
  // projected score.
  const out = parseTabMatch(AUS_NZ, "Australia", "New Zealand")!;
  assert.equal(out.total, 38.5);
  assert.notEqual(out.total, 18.5);
});

test("the line is matched to the home team by name, not by position", () => {
  const reordered: TabMatch = {
    ...AUS_NZ,
    markets: AUS_NZ.markets.map((m) =>
      m.betOption === "Line"
        ? { ...m, propositions: [...m.propositions].reverse() }
        : m,
    ),
  };
  assert.equal(parseTabMatch(reordered, "Australia", "New Zealand")!.homeLine, -3.5);
});

test("a match with no head-to-head yields null", () => {
  assert.equal(
    parseTabMatch({ name: "A v B", startTime: "", markets: [] }, "A", "B"),
    null,
  );
});

test("a missing total parses without one rather than failing", () => {
  const noTotal: TabMatch = {
    ...AUS_NZ,
    markets: AUS_NZ.markets.filter((m) => m.betOption !== "Total Points Over/Under"),
  };
  const out = parseTabMatch(noTotal, "Australia", "New Zealand")!;
  assert.equal(out.total, null);
  assert.equal(out.homePrice, 1.62);
});

// ---------------------------------------------------------------------------
// Fixture matching — TAB abbreviates some nations.
// ---------------------------------------------------------------------------

test("TAB's abbreviated PNG matches the full fixture name", () => {
  assert.equal(matchesFixture("PNG v Lebanon", "Papua New Guinea", "Lebanon"), true);
});

test("full names match directly", () => {
  assert.equal(matchesFixture("Australia v New Zealand", "Australia", "New Zealand"), true);
});

test("a different fixture does not match", () => {
  assert.equal(matchesFixture("Fiji v Cook Islands", "Australia", "New Zealand"), false);
});

test("a reversed fixture does not match", () => {
  // Home and away matter: a reversed match would invert the line.
  assert.equal(matchesFixture("New Zealand v Australia", "Australia", "New Zealand"), false);
});

// ---------------------------------------------------------------------------
// bookAgreementPct — the gate that rejects stale lines.
// ---------------------------------------------------------------------------

test("books quoting near-identical prices agree closely", () => {
  // TAB 1.62/2.30 vs BlueBet 1.65/2.25 on the opener.
  const gap = bookAgreementPct({ home: 1.62, away: 2.3 }, { home: 1.65, away: 2.25 });
  assert.ok(gap < 5, `gap ${gap}`);
});

test("the France longshot disagreement is caught", () => {
  // TAB $26 vs BlueBet $14.25 on the same outcome: a stale or placeholder line,
  // not an opportunity. This is the case that produced a fake +34% edge.
  const gap = bookAgreementPct({ home: 1.01, away: 26 }, { home: 1.01, away: 14.25 });
  assert.ok(gap > 50, `gap ${gap}`);
});

test("agreement is the WIDEST leg, so one tight side cannot mask a wild one", () => {
  const gap = bookAgreementPct({ home: 1.5, away: 20 }, { home: 1.5, away: 10 });
  assert.ok(gap >= 100, `gap ${gap}`);
});

test("missing prices yield null rather than a false pass", () => {
  assert.equal(bookAgreementPct({ home: 0, away: 2 }, { home: 1.5, away: 2 }), null);
});

// ---------------------------------------------------------------------------
// consensusProbabilities
// ---------------------------------------------------------------------------

test("two books average into probabilities summing to one", () => {
  const out = consensusProbabilities(
    { home: 1.62, away: 2.3 },
    { home: 1.65, away: 2.25 },
  )!;
  assert.ok(Math.abs(out.home + out.away - 1) < 1e-9);
});

test("the opener's consensus favours Australia around fifty-eight percent", () => {
  const out = consensusProbabilities(
    { home: 1.62, away: 2.3 },
    { home: 1.65, away: 2.25 },
  )!;
  assert.ok(Math.abs(out.home - 0.582) < 0.005, `home ${out.home}`);
});

test("a single book still produces probabilities", () => {
  const out = consensusProbabilities({ home: 1.62, away: 2.3 }, null)!;
  assert.ok(Math.abs(out.home + out.away - 1) < 1e-9);
  assert.ok(out.home > out.away);
});

// ---------------------------------------------------------------------------
// buildModelPrediction — the whole pipeline.
// ---------------------------------------------------------------------------

test("the opener produces a projection, probabilities and a winner", () => {
  const out = buildModelPrediction({
    tab: AUS_NZ,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    secondBook: { home: 1.65, away: 2.25 },
  })!;
  assert.equal(out.projectedHome, 21.0);
  assert.equal(out.projectedAway, 17.5);
  assert.equal(out.predictedWinner, "Australia");
  assert.ok(Math.abs(out.homeWinProbability - 0.582) < 0.005);
});

test("an underdog home team projects behind", () => {
  const out = buildModelPrediction({
    tab: ENG_TON,
    homeTeam: "England",
    awayTeam: "Tonga",
    secondBook: { home: 2.1, away: 1.72 },
  })!;
  assert.equal(out.projectedHome, 18.0);
  assert.equal(out.projectedAway, 20.5);
  assert.equal(out.predictedWinner, "Tonga");
});

test("a market where books agree reports an edge", () => {
  const out = buildModelPrediction({
    tab: AUS_NZ,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    secondBook: { home: 1.65, away: 2.25 },
  })!;
  assert.notEqual(out.homeEdgePct, null);
  assert.notEqual(out.awayEdgePct, null);
});

test("a market where books disagree reports NO edge", () => {
  // The France case. Suppressing the edge here is the whole point: a +34%
  // number from a stale line would otherwise be published as a play.
  const out = buildModelPrediction({
    tab: SAM_FRA,
    homeTeam: "Samoa",
    awayTeam: "France",
    secondBook: { home: 1.01, away: 14.25 },
  })!;
  assert.equal(out.homeEdgePct, null);
  assert.equal(out.awayEdgePct, null);
  assert.equal(out.edgeSuppressedReason, "books-disagree");
});

test("a disagreeing market still projects a scoreline", () => {
  // Only the EDGE is unreliable. The line and total are still the market's
  // view of the scoreline and remain publishable.
  const out = buildModelPrediction({
    tab: SAM_FRA,
    homeTeam: "Samoa",
    awayTeam: "France",
    secondBook: { home: 1.01, away: 14.25 },
  })!;
  assert.equal(out.projectedHome, 54.0);
  assert.equal(out.projectedAway, 5.5);
});

test("with one book only, no edge is reported", () => {
  // An edge needs an independent price. Scanning a book against itself returns
  // a negative edge on both sides by construction.
  const out = buildModelPrediction({
    tab: AUS_NZ,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    secondBook: null,
  })!;
  assert.equal(out.homeEdgePct, null);
  assert.equal(out.edgeSuppressedReason, "single-book");
});

test("no total means no projection, but probabilities still publish", () => {
  const noTotal: TabMatch = {
    ...AUS_NZ,
    markets: AUS_NZ.markets.filter((m) => m.betOption !== "Total Points Over/Under"),
  };
  const out = buildModelPrediction({
    tab: noTotal,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    secondBook: { home: 1.65, away: 2.25 },
  })!;
  assert.equal(out.projectedHome, null);
  assert.equal(out.projectedAway, null);
  assert.ok(out.homeWinProbability > 0.5);
});

test("a match with no usable markets yields null", () => {
  assert.equal(
    buildModelPrediction({
      tab: { name: "A v B", startTime: "", markets: [] },
      homeTeam: "A",
      awayTeam: "B",
      secondBook: null,
    }),
    null,
  );
});

test("the projection satisfies the line and total it came from", () => {
  const out = buildModelPrediction({
    tab: AUS_NZ,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    secondBook: null,
  })!;
  assert.equal(out.projectedHome! + out.projectedAway!, 38.5, "must sum to the total");
  assert.equal(out.projectedHome! - out.projectedAway!, 3.5, "must differ by the margin");
});
