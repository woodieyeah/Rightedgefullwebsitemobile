/**
 * A finished match must never be presented as a betting opportunity.
 *
 * THE BUG, seen on the iPhone simulator
 * The featured card showed ROOSTERS 28 - KNIGHTS 20, a match played on
 * 4 October 2026, complete with live market odds and a model edge -- as though
 * it were still backable. The data was genuinely live (it matches the
 * published Google Sheet row "Sydney,Newcastle,Sydney,28,20,...,-0.69%"), so
 * this is not a stale-cache problem.
 *
 * ROOT CAUSE, getFeaturedPrediction in src/app/App.tsx:
 *
 *     const upcomingPredictions = predictions.filter(r => !hasPredictionKickedOff(r));
 *     const candidateRows = upcomingPredictions.length ? upcomingPredictions : predictions;
 *
 * The fallback is the defect: when NOTHING is upcoming -- which is the normal
 * state between seasons -- it reverts to the full list and features a match
 * that has already been played and settled.
 *
 * The fix must be a genuine absence: no upcoming fixture means no featured
 * betting card, not a historical one dressed up as live.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

function body(fn: string): string {
  const start = app.indexOf(`function ${fn}(`);
  assert.ok(start !== -1, `${fn} not found`);
  // Next top-level declaration ends it.
  const after = app.slice(start + 1);
  const next = after.search(/\nfunction /);
  return next === -1 ? after : after.slice(0, next);
}

test("getFeaturedPrediction never falls back to kicked-off matches", () => {
  const fn = body("getFeaturedPrediction");
  assert.doesNotMatch(
    fn,
    /upcomingPredictions\.length\s*\?\s*upcomingPredictions\s*:\s*predictions/,
    "a completed match can still be featured as an upcoming betting opportunity",
  );
});

test("getFeaturedPrediction returns null when nothing is upcoming", () => {
  const fn = body("getFeaturedPrediction");
  // The absence must be explicit, so the UI can render nothing rather than
  // something misleading.
  assert.match(
    fn,
    /if\s*\(\s*!upcomingPredictions\.length\s*\)\s*return null/,
    "no explicit empty case for 'nothing upcoming'",
  );
});

test("candidate rows are the upcoming ones only", () => {
  const fn = body("getFeaturedPrediction");
  assert.match(fn, /candidateRows\s*=\s*upcomingPredictions/);
});

test("the kicked-off filter itself is unchanged", () => {
  // The fix must not weaken the definition of 'kicked off'.
  const fn = body("getFeaturedPrediction");
  assert.match(fn, /predictions\.filter\(\s*\(?row\)?\s*=>\s*!hasPredictionKickedOff\(row\)/);
});

test("FeaturedMatchPreview already renders nothing for a null row", () => {
  // Confirms returning null is safe and needs no call-site change.
  const fn = app.slice(app.indexOf("function FeaturedMatchPreview("));
  assert.match(fn.slice(0, 400), /if\s*\(!row\)\s*return null/);
});
