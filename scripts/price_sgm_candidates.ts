/**
 * Price candidate Same Game Multis through Betr's correlation model.
 *
 * POST /SameGameMultiPrice returns {"Price": n, "ErrorNo": 0}. Betr applies
 * their own correlation model, so the returned price differs from multiplying
 * legs — for positively correlated legs it is LOWER, because the combination is
 * more likely than independence implies.
 *
 * Confirmed live: Australia -3.5 ($1.85) + Trbojevic anytime try ($2.10)
 * multiplies to $3.89 but prices at $3.10, a 20% haircut.
 *
 * Brief: higher chance of winning than a three-leg longshot. Each combination
 * below is therefore built from high-probability, positively correlated legs.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const MASTER_EVENT_ID = 2292811;

const MATCH_RESULT_EVENT = 92785304;
const ANYTIME_TRY_EVENT = 92904442;
const TOP3_TRY_EVENT = 92934877;

interface Leg {
  EventId: number;
  OutcomeId: number;
  MarketType: string;
  FixedWin: number;
  FixedMarketId: number;
  MarketTypeDesc: string;
  GroupByHeader: string;
  Points: number;
  BetDetailTypeCode: string;
  OutcomeName: string;
  /** Model probability, for reporting only; not sent. */
  _prob?: number;
}

const leg = {
  ausHandicap: (): Leg => ({
    EventId: MATCH_RESULT_EVENT, OutcomeId: 1, MarketType: "HCWEST", FixedWin: 1.85,
    FixedMarketId: 164916677, MarketTypeDesc: "Match Result (Australia v New Zealand)",
    GroupByHeader: "Handicap", Points: -3.5, BetDetailTypeCode: "HC", OutcomeName: "Australia",
    _prob: 0.50,
  }),
  ausWin: (): Leg => ({
    EventId: MATCH_RESULT_EVENT, OutcomeId: 1, MarketType: "WIN", FixedWin: 1.65,
    FixedMarketId: 0, MarketTypeDesc: "Match Result (Australia v New Zealand)",
    GroupByHeader: "Match Result", Points: 0, BetDetailTypeCode: "W", OutcomeName: "Australia",
    _prob: 0.5808,
  }),
  anytime: (outcomeId: number, name: string, price: number, prob: number): Leg => ({
    EventId: ANYTIME_TRY_EVENT, OutcomeId: outcomeId, MarketType: "TSCORER", FixedWin: price,
    FixedMarketId: 0, MarketTypeDesc: "Anytime Tryscorer (Australia v New Zealand)",
    GroupByHeader: "Anytime Tryscorer", Points: 0, BetDetailTypeCode: "TS", OutcomeName: name,
    _prob: prob,
  }),
  top3: (outcomeId: number, name: string, price: number, prob: number): Leg => ({
    EventId: TOP3_TRY_EVENT, OutcomeId: outcomeId, MarketType: "TSCORER", FixedWin: price,
    FixedMarketId: 0, MarketTypeDesc: "1st, 2nd, or 3rd Tryscorer (Australia v New Zealand)",
    GroupByHeader: "1st, 2nd, or 3rd Tryscorer", Points: 0, BetDetailTypeCode: "TS", OutcomeName: name,
    _prob: prob,
  }),
};

async function price(label: string, legs: Leg[]) {
  const body = {
    MasterEventID: MASTER_EVENT_ID,
    Markets: legs.map(({ _prob, ...rest }) => rest),
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA,
      Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);

  const naive = legs.reduce((p, l) => p * l.FixedWin, 1);
  const indep = legs.reduce((p, l) => p * (l._prob ?? 1), 1);

  console.log(`\n=== ${label} ===`);
  for (const l of legs) {
    const pct = l._prob !== undefined ? `${(l._prob * 100).toFixed(1)}%` : "-";
    console.log(`   ${l.OutcomeName.padEnd(22)} ${String(l.Points || "").padStart(5)} @ $${l.FixedWin.toFixed(2)}   model ${pct}   [${l.GroupByHeader}]`);
  }

  const p = data?.Price;
  if (!p || data?.ErrorNo !== 0) {
    console.log(`   REJECTED (${JSON.stringify(data)})`);
    return null;
  }

  // Implied probability at Betr's own price, vs independence.
  const impliedAtBetr = 1 / p;
  console.log(`   naive multiply : $${naive.toFixed(2)}`);
  console.log(`   BETR SGM PRICE : $${p.toFixed(2)}   (${(((p / naive) - 1) * 100).toFixed(1)}% vs naive)`);
  console.log(`   independent model prob : ${(indep * 100).toFixed(1)}%`);
  console.log(`   implied at Betr's price: ${(impliedAtBetr * 100).toFixed(1)}%  <- correlation lifts this above independence`);
  return p;
}

async function main() {
  // Trbojevic: Betr anytime $2.10, model 33.2% (Fullback).
  // Bostock:   Betr anytime $2.50, model 24.9% (Centre).
  // Top-3 market is a far higher-probability way to back a try scorer.

  await price("A. Australia win + Trbojevic anytime try", [
    leg.ausWin(),
    leg.anytime(6, "Tom Trbojevic", 2.10, 0.332),
  ]);

  await price("B. Australia -3.5 + Trbojevic anytime try", [
    leg.ausHandicap(),
    leg.anytime(6, "Tom Trbojevic", 2.10, 0.332),
  ]);

  await price("C. Australia win + Trbojevic top-3 try scorer", [
    leg.ausWin(),
    leg.top3(36, "Tom Trbojevic", 3.75, 0.47),
  ]);

  await price("D. Australia win + Trbojevic anytime + Bostock anytime", [
    leg.ausWin(),
    leg.anytime(6, "Tom Trbojevic", 2.10, 0.332),
    leg.anytime(35, "Jack Bostock", 2.50, 0.249),
  ]);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
