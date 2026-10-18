import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrackerFromPicks,
  formatCurrency,
  formatStake,
  UNIT_SIZE_AUD,
  type SettledPublicPick,
} from "../src/app/rlwc/result-trackers.ts";

/**
 * Core Plays and same-game multis get their own tracker, displayed at the top
 * of their own section. Pooling them would describe neither: the opener
 * returned +0.65u at $1.65 and +4.00u at $5.00, which are different products
 * with different strike rates.
 */

const pick = (
  market: SettledPublicPick["market"],
  selection: string,
  entry_odds: number,
  result_status: SettledPublicPick["result_status"],
  units_returned: number | null,
): SettledPublicPick => ({
  market,
  selection,
  entry_odds,
  stake_units: 1,
  result_status,
  units_returned,
  profit_units: units_returned === null ? null : units_returned - 1,
  settled_at: result_status === "pending" ? null : "2026-10-15T11:00:00Z",
});

/** The opener as settled from NRL.com: Australia 24-22, tries Bostock x3, Trbojevic, Walsh. */
const opener: SettledPublicPick[] = [
  pick("h2h", "Australia", 1.65, "win", 1.65),
  pick("sgm", "Australia + Trbojevic & Bostock", 5.0, "win", 5.0),
  pick("anytime_try", "Cameron Munster", 5.0, "loss", 0),
  pick("anytime_try", "Tom Dearden", 6.0, "loss", 0),
  pick("anytime_try", "Dane Gagai", 4.0, "loss", 0),
];

// ---------------------------------------------------------------------------
// Separation
// ---------------------------------------------------------------------------

test("the core tracker counts only core plays", () => {
  const t = buildTrackerFromPicks(opener, "core");
  assert.equal(t.settled, 1);
  assert.equal(t.wins, 1);
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
});

test("the multi tracker counts only multis", () => {
  const t = buildTrackerFromPicks(opener, "sgm");
  assert.equal(t.settled, 1);
  assert.ok(Math.abs(t.profitUnits - 4.0) < 1e-9);
});

test("try scorers appear in neither the core nor the multi tracker", () => {
  const core = buildTrackerFromPicks(opener, "core");
  const sgm = buildTrackerFromPicks(opener, "sgm");
  assert.equal(core.settled + sgm.settled, 2, "the three try scorers are excluded");
});

test("the two trackers never pool their results", () => {
  const core = buildTrackerFromPicks(opener, "core");
  const sgm = buildTrackerFromPicks(opener, "sgm");
  assert.notEqual(core.profitUnits, sgm.profitUnits);
  assert.ok(Math.abs(core.roiPct! - 65) < 1e-9);
  assert.ok(Math.abs(sgm.roiPct! - 400) < 1e-9);
});

test("a line or total play counts as a core play", () => {
  const rows = [pick("line", "Australia -3.5", 1.85, "win", 1.85)];
  assert.equal(buildTrackerFromPicks(rows, "core").settled, 1);
});

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

test("a 1-unit win at $1.65 returns 1.65 and profits 0.65", () => {
  const t = buildTrackerFromPicks([pick("h2h", "Australia", 1.65, "win", 1.65)], "core");
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
  assert.equal(t.strikeRatePct, 100);
});

test("a 1-unit win at $5.00 returns 5.00 and profits 4.00", () => {
  const t = buildTrackerFromPicks([pick("sgm", "x", 5.0, "win", 5.0)], "sgm");
  assert.ok(Math.abs(t.profitUnits - 4.0) < 1e-9);
  assert.ok(Math.abs(t.roiPct! - 400) < 1e-9);
});

test("pending picks do not count toward staked or ROI", () => {
  const rows = [
    pick("h2h", "Australia", 1.65, "win", 1.65),
    pick("h2h", "Samoa", 1.2, "pending", null),
  ];
  const t = buildTrackerFromPicks(rows, "core");
  assert.equal(t.pending, 1);
  assert.equal(t.staked, 1);
  assert.ok(Math.abs(t.roiPct! - 65) < 1e-9);
});

test("a losing run reports negative profit honestly", () => {
  const rows = [
    pick("h2h", "a", 1.8, "loss", 0),
    pick("h2h", "b", 2.0, "loss", 0),
  ];
  const t = buildTrackerFromPicks(rows, "core");
  assert.equal(t.profitUnits, -2);
  assert.equal(t.strikeRatePct, 0);
  assert.ok(Math.abs(t.roiPct! - -100) < 1e-9);
});

test("an empty tracker reports null rates rather than zero", () => {
  // 0% reads as "we went 0 from N"; null reads as "no record yet".
  const t = buildTrackerFromPicks([], "core");
  assert.equal(t.settled, 0);
  assert.equal(t.roiPct, null);
  assert.equal(t.strikeRatePct, null);
});

test("a tracker with only pending picks has no rates yet", () => {
  const t = buildTrackerFromPicks([pick("h2h", "a", 1.8, "pending", null)], "core");
  assert.equal(t.pending, 1);
  assert.equal(t.settled, 0);
  assert.equal(t.roiPct, null);
});

test("profit is read from the row, not recomputed from odds", () => {
  // The stored value is derived in the database from units_returned, which is
  // the single source of truth; recomputing here would be a second one.
  const row = { ...pick("h2h", "a", 1.65, "win", 1.65), profit_units: 0.65 };
  const t = buildTrackerFromPicks([row], "core");
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
});

test("a push refunds and leaves the strike-rate denominator", () => {
  const rows = [
    pick("h2h", "a", 1.65, "win", 1.65),
    pick("line", "b", 1.9, "push", 1),
  ];
  const t = buildTrackerFromPicks(rows, "core");
  assert.equal(t.strikeRatePct, 100);
  assert.ok(Math.abs(t.profitUnits - 0.65) < 1e-9);
});

// ---------------------------------------------------------------------------
// Dollar values
//
// A unit is $100, so the tracker shows the cash figure alongside the unit
// figure. Units stay primary — they are the stake-independent record — while
// dollars make the result concrete for a subscriber betting the same size.
// ---------------------------------------------------------------------------

test("a unit is worth one hundred dollars", () => {
  assert.equal(UNIT_SIZE_AUD, 100);
});

test("a positive profit shows a signed dollar amount", () => {
  assert.equal(formatCurrency(3.56), "+$356");
});

test("a negative profit keeps its sign", () => {
  assert.equal(formatCurrency(-8.75), "-$875");
});

test("break-even reads as zero, not an em dash", () => {
  assert.equal(formatCurrency(0), "+$0");
});

test("a fractional cent rounds to whole dollars", () => {
  // 0.445u is $44.50; a tracker showing cents would be noise.
  assert.equal(formatCurrency(0.445), "+$45");
  assert.equal(formatCurrency(0.444), "+$44");
});

test("thousands are grouped for readability", () => {
  assert.equal(formatCurrency(12.5), "+$1,250");
  assert.equal(formatCurrency(-20), "-$2,000");
});

test("the dollar figure tracks the unit figure exactly", () => {
  for (const units of [0.44, 2.2, -1, 3.56, -8.75]) {
    const expected = Math.round(units * UNIT_SIZE_AUD);
    const rendered = Number(formatCurrency(units).replace(/[+$,]/g, "").replace(/^-/, "-"));
    assert.equal(rendered, expected, `${units}u should be $${expected}`);
  }
});

test("turnover is formatted without a sign", () => {
  // Staked is never negative, so a leading + would read oddly.
  assert.equal(formatStake(5), "$500");
  assert.equal(formatStake(14), "$1,400");
});
