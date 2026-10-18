import assert from "node:assert/strict";
import test from "node:test";
import { mergePublishedPlays } from "../src/app/rlwc/merge-published.ts";

/**
 * A published pick is an editorial decision and outranks anything the
 * sheet-derived generator invents for the same fixture.
 *
 * Fiji v Cook Islands exposed this. We published Fiji -8.5 at $1.44, rated
 * 66.6% off the margin ladder. The generator also produced a "Fiji
 * head-to-head" play from the same adapted row, keyed to the same fixture,
 * and the merge dropped ours because a play for that fixture already existed.
 * The card then advertised a selection nobody chose, at a price taken from a
 * different market, with an edge computed against the wrong line.
 */

const row = (home: string, away: string) => ({ homeTeam: home, awayTeam: away, match: `${home} v ${away}` });

const generated = {
  id: "fiji-generated",
  row: row("Fiji", "Cook Islands"),
  type: "Head 2 Head",
  selection: "Fiji head-to-head",
  odds: 1.44,
  modelPct: 78.1,
};

const published = {
  id: "published-abc",
  row: row("Fiji", "Cook Islands"),
  type: "Line",
  selection: "Fiji -8.5",
  odds: 1.44,
  modelPct: 66.6,
  isManualApproved: true,
};

const otherGenerated = {
  id: "other-generated",
  row: row("England", "Tonga"),
  type: "Head 2 Head",
  selection: "Tonga head-to-head",
  odds: 1.62,
  modelPct: 57.7,
};

const key = (p: any) => `${p.row.homeTeam}__${p.row.awayTeam}`.toLowerCase();

test("a published pick replaces the generated play for its fixture", () => {
  const out = mergePublishedPlays([generated], [published], key);
  assert.equal(out.length, 1);
  assert.equal(out[0].selection, "Fiji -8.5");
});

test("the generated play for an unrelated fixture survives", () => {
  const out = mergePublishedPlays([generated, otherGenerated], [published], key);
  assert.equal(out.length, 2);
  const selections = out.map((p: any) => p.selection).sort();
  assert.deepEqual(selections, ["Fiji -8.5", "Tonga head-to-head"]);
});

test("a published pick with no generated rival is still added", () => {
  const out = mergePublishedPlays([], [published], key);
  assert.equal(out.length, 1);
  assert.equal(out[0].selection, "Fiji -8.5");
});

test("generated plays are untouched when nothing is published", () => {
  const out = mergePublishedPlays([generated, otherGenerated], [], key);
  assert.equal(out.length, 2);
});

test("two published picks for one fixture both survive", () => {
  // A fixture can carry both a line and a head to head.
  const second = { ...published, id: "published-def", type: "Head 2 Head", selection: "Fiji" };
  const out = mergePublishedPlays([generated], [published, second], key);
  assert.equal(out.length, 2);
  assert.ok(out.every((p: any) => p.isManualApproved));
});

test("the generated play is dropped even when it looks stronger", () => {
  // The generator reported 78.1% against our 66.6%. It must not win on
  // numbers: it is rating a different market off a projection, and the
  // published pick is the one a human approved.
  const strong = { ...generated, modelPct: 95 };
  const out = mergePublishedPlays([strong], [published], key);
  assert.equal(out.length, 1);
  assert.equal(out[0].selection, "Fiji -8.5");
});

test("an empty input yields an empty result", () => {
  assert.deepEqual(mergePublishedPlays([], [], key), []);
});
