import assert from "node:assert/strict";
import test from "node:test";
import {
  projectScoreline,
  resolveHomeMargin,
  type SpreadOutcome,
  type TotalOutcome,
} from "../src/model/projected-score.ts";

const HOME = "Sydney Roosters";
const AWAY = "Newcastle Knights";

// ---------------------------------------------------------------------------
// resolveHomeMargin — handicap convention -> margin convention.
//
// A handicap is what a team must overcome; a margin is what they are expected
// to win by. They are negatives of each other, and the sign is meaningless
// unless it is anchored to a named team.
// ---------------------------------------------------------------------------

test("a home favourite's negative handicap becomes a positive margin", () => {
  const spreads: SpreadOutcome[] = [
    { name: HOME, point: -6.5 },
    { name: AWAY, point: 6.5 },
  ];
  assert.equal(resolveHomeMargin(spreads, HOME), 6.5);
});

test("an away favourite's handicap becomes a negative home margin", () => {
  const spreads: SpreadOutcome[] = [
    { name: HOME, point: 6.5 },
    { name: AWAY, point: -6.5 },
  ];
  assert.equal(resolveHomeMargin(spreads, HOME), -6.5);
});

test("the home team is matched by name, not by array position", () => {
  // The away team is listed FIRST. A positional read would invert the margin
  // and hand the projection to the wrong side.
  const spreads: SpreadOutcome[] = [
    { name: AWAY, point: 6.5 },
    { name: HOME, point: -6.5 },
  ];
  assert.equal(resolveHomeMargin(spreads, HOME), 6.5);
});

test("a pick-em line yields a zero margin", () => {
  const spreads: SpreadOutcome[] = [
    { name: HOME, point: 0 },
    { name: AWAY, point: 0 },
  ];
  assert.equal(resolveHomeMargin(spreads, HOME), 0);
});

test("name matching tolerates case and surrounding whitespace", () => {
  const spreads: SpreadOutcome[] = [{ name: "  sydney roosters ", point: -4 }];
  assert.equal(resolveHomeMargin(spreads, HOME), 4);
});

test("an absent home team yields null rather than a guess", () => {
  const spreads: SpreadOutcome[] = [{ name: "Brisbane Broncos", point: -6.5 }];
  assert.equal(resolveHomeMargin(spreads, HOME), null);
});

test("a non-finite point yields null rather than NaN", () => {
  assert.equal(resolveHomeMargin([{ name: HOME, point: Number.NaN }], HOME), null);
  assert.equal(resolveHomeMargin([{ name: HOME, point: undefined }], HOME), null);
});

test("an empty spread list yields null", () => {
  assert.equal(resolveHomeMargin([], HOME), null);
});

// ---------------------------------------------------------------------------
// projectScoreline — solving the two-equation system.
//
//   home + away = total
//   home - away = margin
// ---------------------------------------------------------------------------

test("the Grand Final line and total reproduce the known projection", () => {
  // Pinnacle: Roosters -6.5, total 43.5.
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: -6.5 }, { name: AWAY, point: 6.5 }],
    totals: [{ name: "Over", point: 43.5 }, { name: "Under", point: 43.5 }],
  });
  assert.ok(out);
  assert.equal(out.home, 25.0);
  assert.equal(out.away, 18.5);
  assert.equal(out.margin, 6.5);
  assert.equal(out.total, 43.5);
});

test("the projection always satisfies both source equations", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: -6.5 }],
    totals: [{ name: "Over", point: 43.5 }],
  })!;
  assert.equal(out.home + out.away, 43.5, "scores must sum to the total");
  assert.equal(out.home - out.away, 6.5, "difference must equal the margin");
});

test("an away favourite projects the away team ahead", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: 6.5 }, { name: AWAY, point: -6.5 }],
    totals: [{ name: "Over", point: 43.5 }],
  })!;
  assert.equal(out.home, 18.5);
  assert.equal(out.away, 25.0);
  assert.ok(out.away > out.home, "the favourite must be projected ahead");
});

test("a pick-em projects a level scoreline", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: 0 }],
    totals: [{ name: "Over", point: 40 }],
  })!;
  assert.equal(out.home, 20);
  assert.equal(out.away, 20);
});

test("an away team listed first still projects the home team correctly", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: AWAY, point: 6.5 }, { name: HOME, point: -6.5 }],
    totals: [{ name: "Over", point: 43.5 }],
  })!;
  assert.equal(out.home, 25.0);
  assert.equal(out.away, 18.5);
});

// ---------------------------------------------------------------------------
// Fail closed: a missing or nonsensical input must produce no projection,
// never a fabricated scoreline.
// ---------------------------------------------------------------------------

test("a missing total yields no projection", () => {
  assert.equal(
    projectScoreline({
      homeTeam: HOME,
      spreads: [{ name: HOME, point: -6.5 }],
      totals: [],
    }),
    null,
  );
});

test("a missing spread yields no projection", () => {
  assert.equal(
    projectScoreline({
      homeTeam: HOME,
      spreads: [],
      totals: [{ name: "Over", point: 43.5 }],
    }),
    null,
  );
});

test("a spread for a different match yields no projection", () => {
  assert.equal(
    projectScoreline({
      homeTeam: HOME,
      spreads: [{ name: "Penrith Panthers", point: -3.5 }],
      totals: [{ name: "Over", point: 43.5 }],
    }),
    null,
  );
});

test("a non-positive total yields no projection", () => {
  for (const point of [0, -10]) {
    assert.equal(
      projectScoreline({
        homeTeam: HOME,
        spreads: [{ name: HOME, point: -6.5 }],
        totals: [{ name: "Over", point }],
      }),
      null,
      `total ${point} must be rejected`,
    );
  }
});

test("a margin wider than the total yields no projection", () => {
  // Would imply a negative score for the underdog.
  assert.equal(
    projectScoreline({
      homeTeam: HOME,
      spreads: [{ name: HOME, point: -50 }],
      totals: [{ name: "Over", point: 40 }],
    }),
    null,
  );
});

test("a margin exactly equal to the total projects a nil score, not a negative", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: -40 }],
    totals: [{ name: "Over", point: 40 }],
  })!;
  assert.equal(out.home, 40);
  assert.equal(out.away, 0);
});

test("a non-finite total yields no projection", () => {
  assert.equal(
    projectScoreline({
      homeTeam: HOME,
      spreads: [{ name: HOME, point: -6.5 }],
      totals: [{ name: "Over", point: Number.NaN }],
    }),
    null,
  );
});

test("an empty home team name yields no projection", () => {
  assert.equal(
    projectScoreline({
      homeTeam: "",
      spreads: [{ name: HOME, point: -6.5 }],
      totals: [{ name: "Over", point: 43.5 }],
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// Rounding for display.
// ---------------------------------------------------------------------------

test("half-point lines produce half-point projections, left unrounded", () => {
  const out = projectScoreline({
    homeTeam: HOME,
    spreads: [{ name: HOME, point: -7 }],
    totals: [{ name: "Over", point: 44.5 }],
  })!;
  // 44.5 +/- 7 over 2 => 25.75 / 18.75. Rounding is the caller's decision, so
  // the raw values survive for anyone doing arithmetic on them.
  assert.equal(out.home, 25.75);
  assert.equal(out.away, 18.75);
});
