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
    assert.equal(row.units_returned, null);
    assert.equal(row.settled_at, null);
  }
});

test("profit_units is never written: the database generates it", () => {
  // It is a generated column (units_returned - stake_units). Sending any
  // value, including null, is rejected outright by Postgres.
  for (const row of buildPickRows(FIXTURE_ID, picks)) {
    assert.ok(!("profit_units" in row), "profit_units must not be in the payload");
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

test("an SGM priced far from the product of its legs is rejected", () => {
  // The book's own price is authoritative and may land either side of the
  // product: positively correlated legs price BELOW it (Australia +
  // Trbojevic + Bostock: $8.66 -> $5.00), negatively correlated legs price
  // ABOVE it (To'o 2+ tries + Manuleleua anytime: $4.74 -> $5.35, because
  // To'o taking two of Samoa's tries makes one for Manuleleua less likely).
  //
  // Only an implausible gap indicates a mismatched or stale quote.
  assert.throws(
    () => buildPickRows(FIXTURE_ID, [{ ...picks[1], entryOdds: 12.0 }]),
    /implausible/i,
  );
});

test("a correlated multi priced below its legs is accepted", () => {
  const rows = buildPickRows(FIXTURE_ID, [{ ...picks[1], entryOdds: 2.80 }]);
  assert.equal(rows[0].entry_odds, 2.80);
});

test("a negatively correlated multi priced above its legs is accepted", () => {
  // Tonight's real quote: two Samoan try markets competing for the same pool
  // of tries. $2.00 x $2.37 = $4.74, and Betr quotes $5.35.
  const negative = {
    ...picks[1],
    entryOdds: 5.35,
    legs: [
      { label: "Brian To'o 2+ tries", market: "player_2_tries", odds: 2.00 },
      { label: "Francis Manuleleua", market: "anytime_try", odds: 2.37 },
    ],
  };
  const rows = buildPickRows(FIXTURE_ID, [negative]);
  assert.equal(rows[0].entry_odds, 5.35);
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
