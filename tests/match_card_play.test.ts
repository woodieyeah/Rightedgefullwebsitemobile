import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMatchCardPlayLabel,
  shouldShowEdge,
  type MatchCardPlaySource,
} from "../src/app/rlwc/match-card-play.ts";

/**
 * The matches card's PLAY box must name the actual selection and price, the
 * same way the try-scorer box names players. "Premium match play" is a
 * placeholder, not a play.
 *
 * The Edge figure is removed from published cards: an editorially published
 * pick is selected for win probability, not for measurable edge, and printing
 * a negative number against a play we are recommending reads as a warning.
 */

const play: MatchCardPlaySource = {
  selection: "Australia",
  odds: 1.65,
  type: "Head 2 Head",
};

// ---------------------------------------------------------------------------
// Match card PLAY label
// ---------------------------------------------------------------------------

test("the play box names the selection and its price", () => {
  assert.equal(buildMatchCardPlayLabel(play), "Australia @ $1.65");
});

test("a line play keeps its handicap in the label", () => {
  assert.equal(
    buildMatchCardPlayLabel({ selection: "Australia -3.5", odds: 1.85, type: "Line" }),
    "Australia -3.5 @ $1.85",
  );
});

test("head-to-head is abbreviated the way the card already does it", () => {
  assert.equal(
    buildMatchCardPlayLabel({ selection: "Australia head-to-head", odds: 1.65, type: "Head 2 Head" }),
    "Australia H2H @ $1.65",
  );
});

test("a play with no price still names the selection", () => {
  assert.equal(buildMatchCardPlayLabel({ selection: "Australia", odds: 0, type: "Head 2 Head" }), "Australia");
});

test("no play falls back to the placeholder rather than rendering blank", () => {
  assert.equal(buildMatchCardPlayLabel(null), "Premium match play");
});

test("a play with an empty selection falls back rather than showing a bare price", () => {
  assert.equal(buildMatchCardPlayLabel({ selection: "   ", odds: 1.65, type: "Head 2 Head" }), "Premium match play");
});

test("the price is always rendered to two decimals", () => {
  assert.equal(buildMatchCardPlayLabel({ selection: "Australia", odds: 2, type: "Head 2 Head" }), "Australia @ $2.00");
});

// ---------------------------------------------------------------------------
// Edge visibility
// ---------------------------------------------------------------------------

test("edge is hidden on an editorially published play", () => {
  // Published picks need no edge by design; a negative number beside a
  // recommended play reads as a contradiction.
  assert.equal(shouldShowEdge({ isManualApproved: true }), false);
});

test("edge is hidden whenever it is not positive", () => {
  assert.equal(shouldShowEdge({ modelEdge: -2.5 }), false);
  assert.equal(shouldShowEdge({ modelEdge: 0 }), false);
});

test("edge still shows on a genuine positive-edge play", () => {
  // The NRL product's whole point. This must not regress.
  assert.equal(shouldShowEdge({ modelEdge: 3.4 }), true);
});

test("an unknown edge is hidden rather than rendered as zero", () => {
  assert.equal(shouldShowEdge({}), false);
  assert.equal(shouldShowEdge({ modelEdge: Number.NaN }), false);
});

test("a published play hides edge even when the number is positive", () => {
  // Consistency: published cards never advertise an edge figure.
  assert.equal(shouldShowEdge({ isManualApproved: true, modelEdge: 5 }), false);
});
