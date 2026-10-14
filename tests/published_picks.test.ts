import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPickRows,
  describeSgmLegs,
  type PublishedPick,
} from "../src/model/published-picks.ts";

/**
 * The opener's published selections, as captured 2026-10-15.
 *
 * Core Play anchors on Betfair's draw-void Head To Head (spreads 2.90% / 4.18%,
 * book 99.81%), the only RLWC exchange market to clear the 5% gate.
 *
 * The SGM price comes from Betr's own POST /SameGameMultiPrice, never from
 * multiplying legs: correlated legs multiply to an overstated payout. Verified
 * live — Australia win + Trbojevic anytime multiplies to $3.46 and prices at
 * $2.80, a 19% haircut.
 */

const FIXTURE_ID = "eda89772-662c-41d0-af09-cf1ff42912ca";

const picks: PublishedPick[] = [
  {
    kind: "core",
    market: "h2h",
    selection: "Australia",
    point: null,
    entryOdds: 1.65,
    entryBookmaker: "Betr",
    modelProbability: 0.5808,
  },
  {
    kind: "sgm",
    market: "sgm",
    selection: "Australia + Tom Trbojevic anytime try",
    point: null,
    entryOdds: 2.80,
    entryBookmaker: "Betr",
    modelProbability: 0.357,
    legs: [
      { label: "Australia", market: "h2h", odds: 1.65 },
      { label: "Tom Trbojevic", market: "anytime_try", odds: 2.10 },
    ],
  },
  {
    kind: "try_scorer",
    market: "anytime_try",
    selection: "Cameron Munster",
    point: null,
    entryOdds: 5.00,
    entryBookmaker: "TAB",
    modelProbability: 0.221,
  },
  {
    kind: "try_scorer",
    market: "anytime_try",
    selection: "Tom Dearden",
    point: null,
    entryOdds: 6.00,
    entryBookmaker: "TAB",
    modelProbability: 0.192,
  },
  {
    kind: "try_scorer",
    market: "anytime_try",
    selection: "Dane Gagai",
    point: null,
    entryOdds: 4.00,
    entryBookmaker: "TAB",
    modelProbability: 0.218,
  },
];

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

test("every pick becomes one row", () => {
  assert.equal(buildPickRows(FIXTURE_ID, picks).length, 5);
});

test("entry odds and bookmaker are preserved exactly", () => {
  const rows = buildPickRows(FIXTURE_ID, picks);
  const core = rows.find((r) => r.market === "h2h")!;
  assert.equal(core.entry_odds, 1.65);
  assert.equal(core.entry_bookmaker, "Betr");
});

test("the SGM carries Betr's own price, not the product of its legs", () => {
  // 1.65 * 2.10 = 3.465. Publishing that would overstate the payout by 24%.
  const rows = buildPickRows(FIXTURE_ID, picks);
  const sgm = rows.find((r) => r.market === "sgm")!;
  assert.equal(sgm.entry_odds, 2.80);
  assert.notEqual(sgm.entry_odds, 1.65 * 2.10);
});

test("every row starts pending with no settlement", () => {
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.equal(row.result_status, "pending");
    assert.equal(row.profit_units, null);
    assert.equal(row.units_returned, null);
    assert.equal(row.settled_at, null);
  }
});

test("closing price is absent at entry, not zero", () => {
  // CLV needs the distinction between "no closing price yet" and "zero".
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.equal(row.closing_odds, null);
    assert.equal(row.closing_bookmaker, null);
  }
});

test("rows are published, with a publish timestamp", () => {
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.equal(row.published, true);
    assert.ok(row.published_at, "published_at must be set");
  }
});

test("model probability is carried through", () => {
  const rows = buildPickRows(FIXTURE_ID, picks);
  const munster = rows.find((r) => r.selection === "Cameron Munster")!;
  assert.ok(Math.abs(Number(munster.model_probability) - 0.221) < 1e-9);
});

test("no edge is published on any pick", () => {
  // Edge requires two independent books that agree. Every book sits on the
  // right side of the exchange anchor tonight, so no edge is claimed.
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.equal(row.model_edge_pct, null);
  }
});

test("stake is one unit per pick", () => {
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.equal(row.stake_units, 1);
  }
});

test("a pick with non-positive odds is rejected", () => {
  assert.throws(
    () => buildPickRows(FIXTURE_ID, [{ ...picks[0], entryOdds: 0 }]),
    /entry odds/i,
  );
});

test("a pick with no selection is rejected", () => {
  assert.throws(
    () => buildPickRows(FIXTURE_ID, [{ ...picks[0], selection: "  " }]),
    /selection/i,
  );
});

test("an SGM with fewer than two legs is rejected", () => {
  assert.throws(
    () => buildPickRows(FIXTURE_ID, [{ ...picks[1], legs: [picks[1].legs![0]] }]),
    /two legs/i,
  );
});

test("an SGM priced above the product of its legs is rejected", () => {
  // Positively correlated legs must price BELOW independent multiplication.
  // A higher price means the legs were mismatched or the price is stale.
  assert.throws(
    () => buildPickRows(FIXTURE_ID, [{ ...picks[1], entryOdds: 4.0 }]),
    /below/i,
  );
});

// ---------------------------------------------------------------------------
// Leg description
// ---------------------------------------------------------------------------

test("SGM legs render in order with their prices", () => {
  const text = describeSgmLegs(picks[1].legs!);
  assert.match(text, /Australia/);
  assert.match(text, /Tom Trbojevic/);
  assert.ok(text.indexOf("Australia") < text.indexOf("Trbojevic"), "order preserved");
});

test("an empty leg list describes as empty", () => {
  assert.equal(describeSgmLegs([]), "");
});
