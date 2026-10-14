/**
 * Price three-leg same-game multis for the RLWC opener.
 *
 * The brief: the multi must have a HIGH chance of winning, which is why the
 * original three-leg try-scorer combination (9.8%) was rejected. Adding a
 * third leg necessarily lowers the win probability, so the third leg is
 * chosen to cost as little probability as possible — a short-priced scorer on
 * the side we are already backing, where the correlation works for us.
 *
 * Betr's own price is authoritative: POST /SameGameMultiPrice applies their
 * correlation model. Multiplying legs overstates the payout.
 *
 * A New Zealand scorer is deliberately excluded: it is negatively correlated
 * with Australia winning, so it would cut the win probability twice.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const MASTER_EVENT_ID = 2292811;
const MATCH_RESULT_EVENT = 92785304;
const ANYTIME_TRY_EVENT = 92904442;

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
}

const ausWin = (price: number): Leg => ({
  EventId: MATCH_RESULT_EVENT, OutcomeId: 1, MarketType: "WIN", FixedWin: price,
  FixedMarketId: 0, MarketTypeDesc: "Match Result (Australia v New Zealand)",
  GroupByHeader: "Match Result", Points: 0, BetDetailTypeCode: "W", OutcomeName: "Australia",
});

const scorer = (outcomeId: number, name: string, price: number): Leg => ({
  EventId: ANYTIME_TRY_EVENT, OutcomeId: outcomeId, MarketType: "TSCORER", FixedWin: price,
  FixedMarketId: 0, MarketTypeDesc: "Anytime Tryscorer (Australia v New Zealand)",
  GroupByHeader: "Anytime Tryscorer", Points: 0, BetDetailTypeCode: "TS", OutcomeName: name,
});

async function price(legs: Leg[]): Promise<number | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA,
      Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: MASTER_EVENT_ID, Markets: legs }),
  });
  const data = await res.json().catch(() => null);
  if (!data || data.ErrorNo !== 0 || !data.Price) return null;
  return Number(data.Price);
}

async function main() {
  // Live Betr prices, re-read before use.
  const g18 = await (await fetch(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G18`,
    { headers: { Accept: "application/json", "User-Agent": UA, Origin: "https://www.betr.com.au" } },
  )).json();
  const mr = (g18.Events ?? []).find((e: any) => String(e.EventName ?? "").startsWith("Match Result"));
  const aus = (mr?.Outcomes ?? []).find((o: any) => o.OutcomeName === "Australia" && Number(o.Points) === 0);
  if (!aus?.Price) throw new Error("Australia head-to-head price unavailable");

  const g20 = await (await fetch(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G20`,
    { headers: { Accept: "application/json", "User-Agent": UA, Origin: "https://www.betr.com.au" } },
  )).json();
  const anytime = (g20.Events ?? []).find((e: any) =>
    String(e.EventName ?? "").startsWith("Anytime Tryscorer"));
  const priceOf = (name: string) => {
    const o = (anytime?.Outcomes ?? []).find((x: any) => x.OutcomeName === name);
    if (!o?.Price) throw new Error(`price unavailable for ${name}`);
    return Number(o.Price);
  };

  const trbojevic = priceOf("Tom Trbojevic");
  const base = [ausWin(Number(aus.Price)), scorer(6, "Tom Trbojevic", trbojevic)];

  const twoLeg = await price(base);
  console.log(`CURRENT 2-LEG  Australia + Trbojevic  ->  $${twoLeg?.toFixed(2)}  (${(100 / (twoLeg ?? 1)).toFixed(1)}% implied)\n`);

  // Third-leg candidates: Australian scorers only, with their model reads
  // from the positional model.
  const candidates: Array<[number, string, number]> = [
    [31, "Reece Walsh", 26.6],
    [35, "Jack Bostock", 24.9],
    [7, "Latrell Mitchell", 24.9],
    [24, "Kotoni Staggs", 24.9],
    [1, "Cameron Munster", 22.1],
  ];

  console.log("third leg            price   model   SGM price   implied   vs 2-leg");
  const results: Array<[string, number, number, number]> = [];
  for (const [id, name, modelPct] of candidates) {
    let legPrice: number;
    try { legPrice = priceOf(name); } catch { console.log(`${name.padEnd(20)} unavailable`); continue; }
    const p = await price([...base, scorer(id, name, legPrice)]);
    if (p === null) { console.log(`${name.padEnd(20)} rejected by Betr`); continue; }
    const implied = 100 / p;
    const drop = implied - 100 / (twoLeg ?? 1);
    console.log(
      `${name.padEnd(20)} $${legPrice.toFixed(2).padEnd(6)} ${modelPct.toFixed(1)}%   $${p.toFixed(2).padEnd(8)} ${implied.toFixed(1)}%     ${drop.toFixed(1)}pp`,
    );
    results.push([name, legPrice, p, implied]);
  }

  results.sort((a, b) => b[3] - a[3]);
  if (results.length) {
    const [name, legPrice, p, implied] = results[0];
    console.log(`\nHIGHEST WIN PROBABILITY: ${name} @ $${legPrice.toFixed(2)}`);
    console.log(`  three-leg SGM $${p.toFixed(2)}  (${implied.toFixed(1)}% implied, includes Betr's margin)`);
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
