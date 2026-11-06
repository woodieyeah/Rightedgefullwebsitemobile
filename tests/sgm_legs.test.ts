/**
 * The SGM leg descriptor must carry a handicap, not silently drop it.
 *
 * A handicap leg sent as BetDetailTypeCode "W" with FixedMarketId 0 makes
 * Betr's endpoint ignore the start: every Tonga line from +2.5 to +26.5 —
 * and Tonga OUTRIGHT — all returned an identical $5.80. The card advertised
 * "Tonga +7.5 + Toia" while the price obtained was for "Tonga to win + Toia".
 *
 * A handicap leg must use BetDetailTypeCode "HC", MarketType "HCWEST" and the
 * start's OWN FixedMarketId. Only then does the price respond to the line.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSgmLeg } from "../src/model/sgm-legs.ts";

const anchor = {
  name: "Tonga",
  price: 1.23,
  points: 18.5,
  eventId: 93475871,
  outcomeId: 2,
  fixedMarketId: 167594212,
};

const scorer = {
  name: "Robert Toia",
  price: 3.2,
  points: 0,
  eventId: 93540001,
  outcomeId: 5,
  fixedMarketId: 167800470,
};

test("a handicap leg carries HC, HCWEST and its own FixedMarketId", () => {
  const leg = buildSgmLeg(anchor, "handicap", "New Zealand v Tonga");
  assert.equal(leg.BetDetailTypeCode, "HC");
  assert.equal(leg.MarketType, "HCWEST");
  assert.equal(leg.Points, 18.5);
  // FixedMarketId 0 is what made the endpoint ignore the handicap.
  assert.equal(leg.FixedMarketId, 167594212);
  assert.notEqual(leg.FixedMarketId, 0);
});

test("a handicap leg never uses the outright W shape", () => {
  const leg = buildSgmLeg(anchor, "handicap", "New Zealand v Tonga");
  assert.notEqual(leg.BetDetailTypeCode, "W");
  assert.notEqual(leg.MarketType, "WIN");
});

test("an outright leg stays W/WIN with no points", () => {
  const leg = buildSgmLeg({ ...anchor, points: 0 }, "outright", "New Zealand v Tonga");
  assert.equal(leg.BetDetailTypeCode, "W");
  assert.equal(leg.MarketType, "WIN");
  assert.equal(leg.Points, 0);
});

test("a try-scorer leg uses TS/TSCORER", () => {
  const leg = buildSgmLeg(scorer, "try-scorer", "New Zealand v Tonga");
  assert.equal(leg.BetDetailTypeCode, "TS");
  assert.equal(leg.MarketType, "TSCORER");
  assert.equal(leg.Points, 0);
  assert.equal(leg.OutcomeName, "Robert Toia");
});

test("a handicap leg with a zero point is rejected rather than sent as an outright", () => {
  assert.throws(
    () => buildSgmLeg({ ...anchor, points: 0 }, "handicap", "New Zealand v Tonga"),
    /handicap leg needs a non-zero point/i,
  );
});

test("a handicap leg with no FixedMarketId is rejected", () => {
  assert.throws(
    () => buildSgmLeg({ ...anchor, fixedMarketId: 0 }, "handicap", "New Zealand v Tonga"),
    /FixedMarketId/i,
  );
});
