import assert from "node:assert/strict";
import test from "node:test";
import {
  devigAnytimeTryMarket,
  expectedDistinctScorers,
  expectedTries,
} from "../src/model/devig-try-market.ts";

/**
 * Anytime try scorer is NOT a mutually exclusive market: several players score
 * in a match, so the raw prices sum far above 100% for reasons that are mostly
 * structural rather than margin. Normalising to 1.0 — the usual two-way de-vig —
 * is therefore badly wrong.
 *
 * Measured on the RLWC opener: TAB's 40-player market sums to 933%. Forcing it
 * to 100% would rate Cameron Munster at 2.1%, which is absurd for a $5.00 shot.
 * The correct target is the expected number of DISTINCT try scorers.
 */

// ---------------------------------------------------------------------------
// Expected tries and scorers
// ---------------------------------------------------------------------------

test("expected tries scale with the total points line", () => {
  const low = expectedTries(30);
  const high = expectedTries(50);
  assert.ok(high > low, "a bigger total implies more tries");
});

test("a 38.5 total implies a realistic try count", () => {
  const tries = expectedTries(38.5);
  assert.ok(tries > 5.5 && tries < 8.5, `got ${tries}, outside a plausible range`);
});

test("distinct scorers are fewer than tries, because players score doubles", () => {
  const tries = expectedTries(38.5);
  const scorers = expectedDistinctScorers(tries);
  assert.ok(scorers < tries, "doubles mean fewer distinct scorers than tries");
  assert.ok(scorers > tries * 0.7, "but not dramatically fewer");
});

test("a zero total yields no tries rather than a negative count", () => {
  assert.equal(expectedTries(0), 0);
  assert.equal(expectedDistinctScorers(0), 0);
});

// ---------------------------------------------------------------------------
// De-vigging
// ---------------------------------------------------------------------------

const market = [
  { name: "Dane Gagai", odds: 4.0 },
  { name: "Cameron Munster", odds: 5.0 },
  { name: "Tom Dearden", odds: 6.0 },
];

test("de-vigged probabilities never exceed the expected scorer count", () => {
  // The sum targets the expected number of distinct scorers, but the scale is
  // capped at 1: de-vigging removes margin, it never adds value. When a book's
  // raw prices already sum below the target, they are left alone.
  const full = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}`, odds: 9.333 }));
  const out = devigAnytimeTryMarket(full, 38.5);
  const total = out.reduce((s, p) => s + p.probability, 0);
  const target = expectedDistinctScorers(expectedTries(38.5));
  assert.ok(total <= target + 1e-9, `sum ${total} must not exceed target ${target}`);
});

test("an inflated book is scaled down to the expected scorer count", () => {
  // TAB's real market sums to 933%, far above the ~6.2 expected scorers, so
  // the scale genuinely binds and the sum lands on the target.
  const full = Array.from({ length: 40 }, () => ({ name: "", odds: 4.3 }))
    .map((p, i) => ({ ...p, name: `P${i}` }));
  const rawSum = full.reduce((s, p) => s + 1 / p.odds, 0);
  const target = expectedDistinctScorers(expectedTries(38.5));
  assert.ok(rawSum > target, "precondition: this book is inflated");

  const total = devigAnytimeTryMarket(full, 38.5).reduce((s, p) => s + p.probability, 0);
  assert.ok(Math.abs(total - target) < 1e-6, `sum ${total} should equal target ${target}`);
});

test("a shorter price stays more likely than a longer one", () => {
  const out = devigAnytimeTryMarket(market, 38.5);
  const gagai = out.find((p) => p.name === "Dane Gagai")!;
  const dearden = out.find((p) => p.name === "Tom Dearden")!;
  assert.ok(gagai.probability > dearden.probability);
});

test("de-vigging never inflates a price above its raw implied value", () => {
  // Removing margin can only reduce, never increase, an individual price.
  const full = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}`, odds: 5 + i * 0.4 }));
  for (const p of devigAnytimeTryMarket(full, 38.5)) {
    const raw = 1 / full.find((f) => f.name === p.name)!.odds;
    assert.ok(p.probability <= raw + 1e-9, `${p.name}: ${p.probability} exceeds raw ${raw}`);
  }
});

test("a $5.00 shot de-vigs to a believable figure, not 2%", () => {
  const full = Array.from({ length: 40 }, (_, i) =>
    i === 0 ? { name: "Munster", odds: 5.0 } : { name: `P${i}`, odds: 9.5 });
  const munster = devigAnytimeTryMarket(full, 38.5).find((p) => p.name === "Munster")!;
  assert.ok(munster.probability > 0.08, `got ${munster.probability}, implausibly low`);
  assert.ok(munster.probability < 0.35, `got ${munster.probability}, implausibly high`);
});

test("an empty market yields nothing rather than dividing by zero", () => {
  assert.deepEqual(devigAnytimeTryMarket([], 38.5), []);
});

test("non-positive odds are excluded rather than producing infinities", () => {
  const out = devigAnytimeTryMarket(
    [{ name: "ok", odds: 4 }, { name: "bad", odds: 0 }, { name: "worse", odds: -2 }],
    38.5,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "ok");
  assert.ok(Number.isFinite(out[0].probability));
});

test("a missing total line fails closed rather than guessing", () => {
  assert.throws(() => devigAnytimeTryMarket(market, 0), /total/i);
  assert.throws(() => devigAnytimeTryMarket(market, Number.NaN), /total/i);
});

test("every output probability is a valid probability", () => {
  const full = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}`, odds: 2 + i * 0.5 }));
  for (const p of devigAnytimeTryMarket(full, 55)) {
    assert.ok(p.probability > 0 && p.probability < 1, `${p.name}: ${p.probability}`);
  }
});
