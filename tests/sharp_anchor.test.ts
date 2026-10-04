import assert from "node:assert/strict";
import test from "node:test";
import {
  spreadPct,
  midpointPrices,
  resolveSharpAnchor,
} from "../src/model/sharp-anchor.ts";

// ---------------------------------------------------------------------------
// Spread width — the gate that protects us on thin RLWC markets.
// ---------------------------------------------------------------------------

test("spread is measured as a percentage of the back price", () => {
  // Tight NRL-style market: $1.48 back / $1.52 lay.
  assert.equal(Number(spreadPct(1.48, 1.52).toFixed(4)), 2.7027);
  // Wide thin-market example: $5.00 back / $6.00 lay = 20%.
  assert.equal(Number(spreadPct(5, 6).toFixed(4)), 20);
  // A crossed or zero-width book is 0, not negative.
  assert.equal(spreadPct(2, 2), 0);
});

// ---------------------------------------------------------------------------
// Midpoint — back is posted by layers (shorter), lay by backers (longer).
// The true price sits between them.
// ---------------------------------------------------------------------------

test("midpoint sits between the back and lay price for every outcome", () => {
  const mid = midpointPrices(
    [{ name: "Australia", price: 1.48 }, { name: "New Zealand", price: 2.94 }],
    [{ name: "Australia", price: 1.52 }, { name: "New Zealand", price: 3.06 }],
  );
  assert.deepEqual(mid, [
    { name: "Australia", price: 1.5 },
    { name: "New Zealand", price: 3 },
  ]);
});

test("midpoint fails closed when an outcome is missing from either side", () => {
  assert.equal(
    midpointPrices(
      [{ name: "Australia", price: 1.48 }, { name: "New Zealand", price: 2.94 }],
      [{ name: "Australia", price: 1.52 }],
    ),
    null,
  );
  assert.equal(midpointPrices([], []), null);
});

// ---------------------------------------------------------------------------
// resolveSharpAnchor — the whole contract. Returns null rather than a biased
// or meaningless fair price. NEVER invent an anchor.
// ---------------------------------------------------------------------------

test("a two-way market resolves to de-vigged probabilities summing to 100%", () => {
  const anchor = resolveSharpAnchor({
    back: [{ name: "Australia", price: 1.48 }, { name: "New Zealand", price: 2.94 }],
    lay: [{ name: "Australia", price: 1.52 }, { name: "New Zealand", price: 3.06 }],
    maxSpreadPct: 10,
  });
  assert.ok(anchor);
  const total = anchor.probabilities.reduce((t, p) => t + p.probability, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `probabilities summed to ${total}`);
  // Australia is the favourite and keeps the larger share.
  assert.ok(anchor.probabilities[0].probability > anchor.probabilities[1].probability);
  assert.equal(Number(anchor.probabilities[0].probability.toFixed(2)), 66.67);
});

test("an anchor is refused when either side of the book is absent", () => {
  // Only back prices (the shape a non-exchange bookmaker returns).
  assert.equal(
    resolveSharpAnchor({
      back: [{ name: "Australia", price: 1.48 }, { name: "New Zealand", price: 2.94 }],
      lay: [],
      maxSpreadPct: 10,
    }),
    null,
  );
  // Only lay prices.
  assert.equal(
    resolveSharpAnchor({
      back: [],
      lay: [{ name: "Australia", price: 1.52 }, { name: "New Zealand", price: 3.06 }],
      maxSpreadPct: 10,
    }),
    null,
  );
});

test("an anchor is refused when the spread is wider than the gate", () => {
  // 20% spread — the thin-market case the gate exists for.
  const anchor = resolveSharpAnchor({
    back: [{ name: "Fiji", price: 5 }, { name: "Cook Islands", price: 1.2 }],
    lay: [{ name: "Fiji", price: 6 }, { name: "Cook Islands", price: 1.26 }],
    maxSpreadPct: 10,
  });
  assert.equal(anchor, null);
});

test("the widest outcome spread decides the gate, not the average", () => {
  // Cook Islands is tight (5%) but Fiji is 20%: the market as a whole is unreliable.
  const anchor = resolveSharpAnchor({
    back: [{ name: "Fiji", price: 5 }, { name: "Cook Islands", price: 1.2 }],
    lay: [{ name: "Fiji", price: 6 }, { name: "Cook Islands", price: 1.26 }],
    maxSpreadPct: 15,
  });
  assert.equal(anchor, null);
});

test("a resolved anchor reports its widest spread for measurement", () => {
  const anchor = resolveSharpAnchor({
    back: [{ name: "Australia", price: 1.48 }, { name: "New Zealand", price: 2.94 }],
    lay: [{ name: "Australia", price: 1.52 }, { name: "New Zealand", price: 3.06 }],
    maxSpreadPct: 10,
  });
  assert.ok(anchor);
  // max(2.70%, 4.08%) = 4.08%
  assert.equal(Number(anchor.maxSpreadPct.toFixed(2)), 4.08);
});

test("invalid or non-finite prices are refused rather than coerced", () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1]) {
    assert.equal(
      resolveSharpAnchor({
        back: [{ name: "Australia", price: bad }, { name: "New Zealand", price: 2.94 }],
        lay: [{ name: "Australia", price: 1.52 }, { name: "New Zealand", price: 3.06 }],
        maxSpreadPct: 10,
      }),
      null,
      `price ${bad} must be refused`,
    );
  }
});
