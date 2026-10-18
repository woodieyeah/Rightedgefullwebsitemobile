import assert from "node:assert/strict";
import test from "node:test";
import {
  coverProbabilityFromBands,
  parseMarginBands,
  teamNameFromSelection,
  type MarginBand,
} from "../src/model/line-cover.ts";

/**
 * A line play needs a model probability that is INDEPENDENT of the line.
 *
 * The projected scoreline is solved from the handicap and the total, so using
 * it to rate the handicap is circular — it reproduces the line exactly and
 * would always report a coin flip.
 *
 * The margin-band market is a genuinely separate market: the book prices each
 * band directly, so de-vigging those bands and summing the ones that cover the
 * handicap gives an independent read.
 *
 * Measured on Samoa v France (Betr "Samoa - Winning Margin"), where the
 * handicap is -47.5.
 */

const SAMOA_BANDS: MarginBand[] = [
  { label: "Samoa 40+", threshold: 40, odds: 1.45 },
  { label: "Samoa 43+", threshold: 43, odds: 1.61 },
  { label: "Samoa 46+", threshold: 46, odds: 1.71 },
  { label: "Samoa 49+", threshold: 49, odds: 1.95 },
  { label: "Samoa 52+", threshold: 52, odds: 2.15 },
  { label: "Samoa 55+", threshold: 55, odds: 2.55 },
  { label: "Samoa 58+", threshold: 58, odds: 2.80 },
];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("a '40+' band parses its threshold and price", () => {
  const bands = parseMarginBands([{ name: "Samoa 40+", price: 1.45 }]);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].threshold, 40);
  assert.equal(bands[0].odds, 1.45);
});

test("bands are returned in ascending threshold order", () => {
  const bands = parseMarginBands([
    { name: "Samoa 52+", price: 2.15 },
    { name: "Samoa 40+", price: 1.45 },
    { name: "Samoa 46+", price: 1.71 },
  ]);
  assert.deepEqual(bands.map((b) => b.threshold), [40, 46, 52]);
});

test("a malformed band is skipped rather than parsed as zero", () => {
  const bands = parseMarginBands([
    { name: "Samoa to win", price: 1.01 },
    { name: "Samoa 40+", price: 1.45 },
  ]);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].threshold, 40);
});

test("a band with an unusable price is skipped", () => {
  const bands = parseMarginBands([
    { name: "Samoa 40+", price: 0 },
    { name: "Samoa 43+", price: 1.61 },
  ]);
  assert.equal(bands.length, 1);
});

// ---------------------------------------------------------------------------
// Cover probability
// ---------------------------------------------------------------------------

test("a handicap between two bands interpolates between them", () => {
  // -47.5 sits between the 46+ band and the 49+ band.
  const p = coverProbabilityFromBands(SAMOA_BANDS, 47.5)!;
  const p46 = 1 / 1.71;
  const p49 = 1 / 1.95;
  assert.ok(p < p46 && p > p49, `${p} should sit between ${p49} and ${p46}`);
});

test("a handicap exactly on a band uses that band", () => {
  const p = coverProbabilityFromBands(SAMOA_BANDS, 49)!;
  // De-vigged, so below the raw 1/1.95 implied figure.
  assert.ok(p > 0 && p < 1 / 1.95 + 1e-9);
});

test("the probability is de-vigged, not raw implied", () => {
  // "40+" at $1.45 implies 69.0% raw; the ladder carries margin, so the
  // de-vigged figure must be lower.
  const p = coverProbabilityFromBands(SAMOA_BANDS, 40)!;
  assert.ok(p < 1 / 1.45, `${p} must be below the raw ${1 / 1.45}`);
});

test("a bigger handicap is always harder to cover", () => {
  const easy = coverProbabilityFromBands(SAMOA_BANDS, 40)!;
  const hard = coverProbabilityFromBands(SAMOA_BANDS, 58)!;
  assert.ok(hard < easy, "covering 58 must be less likely than covering 40");
});

test("the result is a valid probability", () => {
  for (const h of [40, 43, 47.5, 52, 58]) {
    const p = coverProbabilityFromBands(SAMOA_BANDS, h)!;
    assert.ok(p > 0 && p < 1, `${h}: ${p}`);
  }
});

test("Samoa -47.5 reads as a realistic cover probability", () => {
  // Sanity: the market prices this near a coin flip, so anything wildly away
  // from 50% means the de-vig or the interpolation is wrong.
  const p = coverProbabilityFromBands(SAMOA_BANDS, 47.5)!;
  assert.ok(p > 0.35 && p < 0.65, `got ${(p * 100).toFixed(1)}%`);
});

// --- fail closed -----------------------------------------------------------

test("no bands yields no probability rather than a guess", () => {
  assert.equal(coverProbabilityFromBands([], 47.5), null);
});

test("a single band cannot be interpolated and yields null", () => {
  assert.equal(coverProbabilityFromBands([SAMOA_BANDS[0]], 47.5), null);
});

test("a handicap beyond the ladder yields null rather than extrapolating", () => {
  // Extrapolating past the longest band invents a number the book never
  // priced.
  assert.equal(coverProbabilityFromBands(SAMOA_BANDS, 95), null);
  assert.equal(coverProbabilityFromBands(SAMOA_BANDS, 5), null);
});

test("a non-finite handicap yields null", () => {
  assert.equal(coverProbabilityFromBands(SAMOA_BANDS, Number.NaN), null);
});

// ---------------------------------------------------------------------------
// Team name extraction
// ---------------------------------------------------------------------------

test("a handicap is stripped to leave the team name", () => {
  // The crest lookup needs the bare nation: "Samoa -47.5" resolves to nothing
  // and the logo silently disappears.
  assert.equal(teamNameFromSelection("Samoa -47.5"), "Samoa");
  assert.equal(teamNameFromSelection("Australia -3.5"), "Australia");
  assert.equal(teamNameFromSelection("New Zealand +3.5"), "New Zealand");
});

test("a plain team name is unchanged", () => {
  assert.equal(teamNameFromSelection("Samoa"), "Samoa");
  assert.equal(teamNameFromSelection("Papua New Guinea"), "Papua New Guinea");
});

test("a pick-em line is stripped too", () => {
  assert.equal(teamNameFromSelection("Australia 0"), "Australia");
});

test("an over/under selection has no team and returns empty", () => {
  assert.equal(teamNameFromSelection("Over 58.5"), "");
  assert.equal(teamNameFromSelection("Under 58.5"), "");
});

test("empty input is handled", () => {
  assert.equal(teamNameFromSelection(""), "");
  assert.equal(teamNameFromSelection("   "), "");
});

// ---------------------------------------------------------------------------
// Market suffixes must not defeat the crest lookup
//
// The sheet-derived generator labels a play "<Team> head-to-head". That string
// matched no nation, so TeamLogo silently rendered the fallback shield instead
// of the Fiji emblem. The crest resolves on the nation alone.
// ---------------------------------------------------------------------------

test("a head-to-head suffix is stripped for the crest", () => {
  assert.equal(teamNameFromSelection("Fiji head-to-head"), "Fiji");
});

test("other market suffixes are stripped too", () => {
  assert.equal(teamNameFromSelection("Papua New Guinea head to head"), "Papua New Guinea");
  assert.equal(teamNameFromSelection("Tonga h2h"), "Tonga");
  assert.equal(teamNameFromSelection("Samoa anytime try"), "Samoa");
});

test("a handicap is still stripped", () => {
  assert.equal(teamNameFromSelection("Fiji -8.5"), "Fiji");
  assert.equal(teamNameFromSelection("England +2.5"), "England");
});

test("a bare nation is unchanged", () => {
  assert.equal(teamNameFromSelection("Cook Islands"), "Cook Islands");
  assert.equal(teamNameFromSelection("Fiji"), "Fiji");
});

test("a nation containing a market word is not truncated", () => {
  // Defensive: no RLWC nation contains these, but the stripper must only
  // remove a TRAILING market suffix, never an interior word.
  assert.equal(teamNameFromSelection("Cook Islands -14.5"), "Cook Islands");
});
