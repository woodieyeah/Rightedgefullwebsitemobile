/**
 * Kickoff-day value scan for the RLWC opener.
 *
 * Betfair's "Head To Head" market is draw-void two-way, which is the same
 * proposition TAB and Betr price. The separate "Regular Time Match Odds" market
 * is three-way and includes the draw, so the two must never be compared
 * directly.
 *
 * Only exchange markets that clear the spread gate may anchor a play.
 */

const GATE_PCT = 5;
const EDGE_THRESHOLD_PCT = 2;

interface Leg { name: string; back: number | null; lay: number | null; matched?: number }

function spreadPct(back: number, lay: number): number {
  const mid = (back + lay) / 2;
  return ((lay - back) / mid) * 100;
}

function analyseExchange(label: string, legs: Leg[], matched: number) {
  console.log(`\n=== ${label}  (matched $${matched.toLocaleString()}) ===`);

  const mids: { name: string; mid: number; spread: number }[] = [];
  let widest = 0;
  let usable = true;

  for (const leg of legs) {
    if (leg.back === null || leg.lay === null) {
      console.log(`  ${leg.name.padEnd(14)} INCOMPLETE (back ${leg.back}, lay ${leg.lay})`);
      usable = false;
      continue;
    }
    const mid = (leg.back + leg.lay) / 2;
    const sp = spreadPct(leg.back, leg.lay);
    widest = Math.max(widest, sp);
    mids.push({ name: leg.name, mid, spread: sp });
    console.log(`  ${leg.name.padEnd(14)} back ${leg.back.toFixed(2)}  lay ${leg.lay.toFixed(2)}  mid ${mid.toFixed(3)}  spread ${sp.toFixed(2)}%`);
  }

  if (!usable) {
    console.log(`  -> UNUSABLE: a leg has no two-sided price`);
    return null;
  }

  const book = mids.reduce((s, m) => s + 1 / m.mid, 0);
  console.log(`  midpoint book: ${(book * 100).toFixed(2)}%   widest leg: ${widest.toFixed(2)}%`);

  if (widest > GATE_PCT) {
    console.log(`  -> FAILS the ${GATE_PCT}% gate`);
    return null;
  }
  console.log(`  -> PASSES the ${GATE_PCT}% gate`);

  const fair = mids.map((m) => ({ name: m.name, prob: (1 / m.mid) / book }));
  for (const f of fair) {
    console.log(`     fair ${f.name.padEnd(14)} ${(f.prob * 100).toFixed(2)}%  ($${(1 / f.prob).toFixed(3)})`);
  }
  return fair;
}

// ---------------------------------------------------------------------------
// Live captured prices, 2026-10-15 07:44 AEST (11.3h before kickoff).
// ---------------------------------------------------------------------------

// Draw-void two-way: the proposition TAB and Betr price.
const h2hFair = analyseExchange(
  "Betfair Head To Head (draw-void, 2-way)",
  [
    { name: "Australia", back: 1.70, lay: 1.75 },
    { name: "New Zealand", back: 2.34, lay: 2.44 },
  ],
  737,
);

// Three-way including the draw: NOT comparable to a draw-void book price.
analyseExchange(
  "Betfair Regular Time Match Odds (3-way)",
  [
    { name: "Australia", back: 1.71, lay: 1.79 },
    { name: "New Zealand", back: 2.48, lay: 2.70 },
    { name: "Draw", back: 21.0, lay: 26.0 },
  ],
  4247,
);

analyseExchange(
  "Betfair Total Points 39.5",
  [
    { name: "Over 39.5", back: 1.82, lay: 2.22 },
    { name: "Under 39.5", back: 1.82, lay: 2.22 },
  ],
  20,
);

analyseExchange(
  "Betfair Handicap -2.5",
  [
    { name: "Australia -2.5", back: 1.71, lay: 1.85 },
    { name: "New Zealand +2.5", back: 2.18, lay: 21.0 },
  ],
  623,
);

// ---------------------------------------------------------------------------
// Value scan against the one anchor that cleared the gate.
// ---------------------------------------------------------------------------

if (!h2hFair) {
  console.log("\nNo exchange anchor cleared the gate -> no play can be priced.");
} else {
  console.log("\n=== VALUE SCAN vs the draw-void exchange anchor ===\n");

  const offers: Record<string, Record<string, number>> = {
    Australia: { TAB: 1.62, Betr: 1.65, "Betfair back": 1.70 },
    "New Zealand": { TAB: 2.30, Betr: 2.25, "Betfair back": 2.34 },
  };

  const plays: string[] = [];
  for (const leg of h2hFair) {
    const fairPrice = 1 / leg.prob;
    const books = offers[leg.name] ?? {};
    const best = Object.entries(books).sort((a, b) => b[1] - a[1])[0];
    console.log(`${leg.name}`);
    console.log(`   fair $${fairPrice.toFixed(3)} (${(leg.prob * 100).toFixed(2)}%)`);
    for (const [book, price] of Object.entries(books)) {
      const edge = (price * leg.prob - 1) * 100;
      const mark = edge >= EDGE_THRESHOLD_PCT ? "  <<< PLAY" : "";
      console.log(`   ${book.padEnd(14)} $${price.toFixed(2)}   edge ${edge >= 0 ? "+" : ""}${edge.toFixed(2)}%${mark}`);
      if (edge >= EDGE_THRESHOLD_PCT) plays.push(`${leg.name} @ $${price} (${book}) ${edge.toFixed(2)}%`);
    }
    console.log(`   price needed for +${EDGE_THRESHOLD_PCT}%: $${(fairPrice * (1 + EDGE_THRESHOLD_PCT / 100)).toFixed(2)}  (best available $${best[1].toFixed(2)})`);
    console.log();
  }

  console.log("=".repeat(60));
  if (plays.length) {
    console.log(`${plays.length} PLAY(S):`);
    for (const p of plays) console.log("   " + p);
  } else {
    console.log("NO PLAY clears +2% on the head-to-head.");
  }
}
