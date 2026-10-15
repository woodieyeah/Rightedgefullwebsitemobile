import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublishedMultiCard,
  buildPublishedPremiumPlay,
  type PredictionRowLike,
} from "../src/app/rlwc/published-cards.ts";
import type { PublicPick } from "../src/app/rlwc/picks.ts";

/**
 * Published picks are editorially approved selections. They must appear on the
 * Premium Plays and Multi pages regardless of the generic gates those pages
 * apply to sheet-derived rows:
 *
 *   - Premium Plays requires a positive value edge. The RLWC brief is
 *     explicitly "there doesn't need to be edge", and no book currently beats
 *     the exchange anchor, so a published play would never surface.
 *   - The Multi page requires two try scorers at model >= 25%. The opener's
 *     de-vigged try-scorer reads top out near 22%, so no multi would build —
 *     and the one that did would be a longshot, which was rejected.
 */

const base = {
  fixture_id: "f1",
  match_key: "australia__newzealand",
  competition: "rlwc",
  point: null,
  result_status: "pending" as const,
  profit_units: null,
  published_at: "2026-10-15T00:00:00Z",
  legs: [] as never[],
};

const corePick: PublicPick = {
  ...base, id: "1", market: "h2h", selection: "Australia",
  entry_odds: 1.65, entry_bookmaker: "Betr",
  model_probability: 0.5808, market_probability: 0.5808,
};

const sgmPick: PublicPick = {
  ...base, id: "2", market: "sgm",
  selection: "Australia + Tom Trbojevic anytime try",
  entry_odds: 2.80, entry_bookmaker: "Betr",
  model_probability: 0.357, market_probability: 0.357,
  legs: [
    { selection: "Australia", market: "h2h", odds: 1.65, result: "pending" },
    { selection: "Tom Trbojevic", market: "anytime_try", odds: 2.10, result: "pending" },
  ] as any,
};

function row(): PredictionRowLike {
  return {
    match: "Australia v New Zealand",
    roundNumber: 101,
    homeTeam: "Australia",
    awayTeam: "New Zealand",
    predictedWinner: "Australia",
    predictedHomeScore: 21,
    predictedAwayScore: 17.5,
    fixture: null,
  };
}

// ---------------------------------------------------------------------------
// Premium Plays
// ---------------------------------------------------------------------------

test("a published core play becomes a premium play", () => {
  const play = buildPublishedPremiumPlay(row(), corePick)!;
  assert.equal(play.selection, "Australia");
  assert.equal(play.odds, 1.65);
  assert.equal(play.bookmaker, "Betr");
  assert.equal(play.type, "Head 2 Head");
});

test("a published play surfaces without a model probability", () => {
  // The Samoa line is published on book agreement alone: the projected
  // scoreline is derived FROM that line, so quoting it as a model read would
  // be circular. A null probability must not drop the play from the page.
  const noModel: PublicPick = {
    ...corePick, market: "line", selection: "Samoa", point: -47.5,
    entry_odds: 1.90, entry_bookmaker: "TAB",
    model_probability: null, market_probability: null,
  };
  const play = buildPublishedPremiumPlay(row(), noModel)!;
  assert.ok(play, "a play with no model read must still render");
  assert.equal(play.selection, "Samoa -47.5");
  assert.equal(play.type, "Line");
  assert.equal(play.odds, 1.90);
});

test("a play with no model probability reports no model percentage", () => {
  const noModel: PublicPick = {
    ...corePick, market: "line", selection: "Samoa", point: -47.5,
    entry_odds: 1.90, model_probability: null, market_probability: null,
  };
  const play = buildPublishedPremiumPlay(row(), noModel)!;
  assert.equal(play.modelPct, null);
  assert.equal(play.modelEdge, null);
});

test("a play with no model probability still hides edge", () => {
  const noModel: PublicPick = {
    ...corePick, market: "line", selection: "Samoa", point: -47.5,
    entry_odds: 1.90, model_probability: null, market_probability: null,
  };
  const play = buildPublishedPremiumPlay(row(), noModel)!;
  assert.equal(play.isManualApproved, true);
});

test("a published play surfaces even without a positive edge", () => {
  // The whole reason this path exists. Against the Betfair anchor the play is
  // flat-to-negative — $1.65 is 60.6% raw against a 58.1% fair read — so the
  // generic value gate rejects it. A published pick must appear anyway.
  const play = buildPublishedPremiumPlay(row(), corePick)!;
  assert.ok(play, "the play must still be produced");
  assert.ok(play.modelEdge <= 0, `expected no positive edge, got ${play.modelEdge}`);
  assert.equal(play.isManualApproved, true, "must be flagged to bypass the value gate");
});

test("a play priced worse than the model reads as a negative edge", () => {
  // Raw implied at $1.65 is 60.6% against a 58.08% model read.
  const noDevig = { ...corePick, market_probability: null };
  const play = buildPublishedPremiumPlay(row(), noDevig)!;
  assert.ok(play.modelEdge < 0, `expected a negative edge, got ${play.modelEdge}`);
});

test("the model percentage comes from the pick, not the sheet", () => {
  const play = buildPublishedPremiumPlay(row(), corePick)!;
  assert.ok(Math.abs(play.modelPct - 58.08) < 0.01);
});

test("edge is model minus the de-vigged market probability", () => {
  const play = buildPublishedPremiumPlay(row(), corePick)!;
  // 58.08 model vs 58.08 de-vigged market -> flat.
  assert.ok(Math.abs(play.modelEdge) < 0.01);
});

test("a line pick is typed as a line, not a head to head", () => {
  const linePick = { ...corePick, market: "line" as const, point: -3.5, entry_odds: 1.85 };
  const play = buildPublishedPremiumPlay(row(), linePick)!;
  assert.equal(play.type, "Line");
  assert.equal(play.selection, "Australia -3.5");
});

test("a total pick is typed as a total", () => {
  const totalPick = { ...corePick, market: "total" as const, selection: "Over", point: 38.5, entry_odds: 1.90 };
  const play = buildPublishedPremiumPlay(row(), totalPick)!;
  assert.equal(play.type, "Total");
});

test("a try-scorer pick is not a premium match play", () => {
  const tryPick = { ...corePick, market: "anytime_try" as const, selection: "Cameron Munster" };
  assert.equal(buildPublishedPremiumPlay(row(), tryPick), null);
});

test("no pick yields no play", () => {
  assert.equal(buildPublishedPremiumPlay(row(), null), null);
});

test("a pick with unusable odds is rejected rather than rendered", () => {
  assert.equal(buildPublishedPremiumPlay(row(), { ...corePick, entry_odds: 0 }), null);
});

test("the play carries a stable id derived from the pick", () => {
  const a = buildPublishedPremiumPlay(row(), corePick)!;
  const b = buildPublishedPremiumPlay(row(), corePick)!;
  assert.equal(a.id, b.id, "id must be stable across renders");
});

// ---------------------------------------------------------------------------
// Multi
// ---------------------------------------------------------------------------

test("a published multi becomes a multi card", () => {
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  assert.equal(card.legs.length, 2);
  assert.equal(card.match, "Australia V New Zealand");
});

test("a three-leg multi keeps all three legs", () => {
  // Betr prices Australia + Trbojevic + Bostock at $5.00 against a $8.66
  // product — a 42% correlation discount, because Bostock (centre) is
  // complementary to Trbojevic (fullback) rather than a substitute.
  const threeLeg: PublicPick = {
    ...sgmPick,
    selection: "Australia + Tom Trbojevic & Jack Bostock anytime tries",
    entry_odds: 5.00,
    model_probability: 0.20,
    legs: [
      { selection: "Australia", market: "h2h", odds: 1.65, result: "pending" },
      { selection: "Tom Trbojevic", market: "anytime_try", odds: 2.10, result: "pending" },
      { selection: "Jack Bostock", market: "anytime_try", odds: 2.50, result: "pending" },
    ] as any,
  };
  const card = buildPublishedMultiCard(row(), threeLeg)!;
  assert.equal(card.legs.length, 3);
  assert.equal(card.price, 5.00);
  assert.equal(card.legs[0].kind, "result");
  assert.equal(card.legs[1].kind, "try-scorer");
  assert.equal(card.legs[2].kind, "try-scorer");
  // Must stay below the product of its legs.
  const product = card.legs.reduce((p, l) => p * l.odds, 1);
  assert.ok(card.price < product, `${card.price} must be below ${product.toFixed(2)}`);
});

test("the card carries the bookmaker's real price, not the estimate", () => {
  // The page's generic estimate multiplies legs and applies a 0.83 factor:
  // 1.65 * 2.10 * 0.83 = 2.88. Betr's actual correlated price is 2.80.
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  assert.equal(card.price, 2.80);
  const estimate = 1.65 * 2.10 * 0.83;
  assert.notEqual(card.price, estimate);
});

test("a positively correlated multi prices below the product of its legs", () => {
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  const product = card.legs.reduce((p, l) => p * l.odds, 1);
  assert.ok(card.price! < product, `${card.price} must be below ${product}`);
});

test("a negatively correlated multi priced above its legs still renders", () => {
  // Two Samoan try markets compete for the same pool of tries, so the
  // combination is rarer than independence implies and Betr prices it ABOVE
  // the product: $2.00 x $2.37 = $4.74, quoted $5.35.
  const negative: PublicPick = {
    ...sgmPick,
    selection: "Brian To'o 2+ tries + Francis Manuleleua anytime",
    entry_odds: 5.35,
    legs: [
      { selection: "Brian To'o 2+ tries", market: "player_2_tries", odds: 2.00, result: "pending" },
      { selection: "Francis Manuleleua", market: "anytime_try", odds: 2.37, result: "pending" },
    ] as any,
  };
  const card = buildPublishedMultiCard(row(), negative)!;
  assert.ok(card, "a real quote above the product must not be discarded");
  assert.equal(card.price, 5.35);
});

test("a wildly mispriced multi is still rejected", () => {
  const broken: PublicPick = { ...sgmPick, entry_odds: 40 };
  assert.equal(buildPublishedMultiCard(row(), broken), null);
});

test("legs keep their order and prices", () => {
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  assert.equal(card.legs[0].label, "Australia");
  assert.equal(card.legs[0].odds, 1.65);
  assert.equal(card.legs[1].label, "Tom Trbojevic");
  assert.equal(card.legs[1].odds, 2.10);
});

test("a result leg and a try-scorer leg are typed differently", () => {
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  assert.equal(card.legs[0].kind, "result");
  assert.equal(card.legs[1].kind, "try-scorer");
});

test("a multi with fewer than two legs is rejected", () => {
  const broken = { ...sgmPick, legs: [sgmPick.legs[0]] as any };
  assert.equal(buildPublishedMultiCard(row(), broken), null);
});

test("a non-multi pick does not become a multi card", () => {
  assert.equal(buildPublishedMultiCard(row(), corePick), null);
});

test("no pick yields no card", () => {
  assert.equal(buildPublishedMultiCard(row(), null), null);
});

test("an upcoming fixture is marked upcoming", () => {
  const card = buildPublishedMultiCard(row(), sgmPick)!;
  assert.equal(card.status, "upcoming");
});
