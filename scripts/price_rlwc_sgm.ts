/**
 * Price same-game-multi candidates for an RLWC fixture.
 *
 * The book's own SGM endpoint is authoritative: correlated legs do not
 * multiply. Australia + Trbojevic multiplied to $3.46 but priced $2.80
 * (positive correlation), while Samoa v France's combination priced ABOVE
 * its product. Never publish a multiplied price.
 *
 * Usage:
 *   npx tsx scripts/price_rlwc_sgm.ts --event 2292886 --match "England v Tonga"
 */

const ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const BASE = "https://affiliate-api.bluebet.com.au";
const UA = "rightedge.com.au";

const arg = (flag: string, fallback = "") => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const MASTER_EVENT_ID = Number(arg("--event"));
const MATCH_LABEL = arg("--match");

if (!Number.isFinite(MASTER_EVENT_ID) || !MATCH_LABEL) {
  console.error('Usage: --event <MasterEventId> --match "Home v Away"');
  process.exit(1);
}

interface Outcome {
  EventId: number;
  EventName: string;
  OutcomeId: number;
  OutcomeName: string;
  Price: number;
  Points: number;
  PlayerTeamName?: string;
}

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

async function group(code: string): Promise<Outcome[]> {
  const res = await fetch(
    `${BASE}/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=${code}&format=json`,
    { headers: { Accept: "application/json", "User-Agent": UA } },
  );
  if (!res.ok) throw new Error(`${code} HTTP ${res.status}`);
  const data = await res.json();

  const out: Outcome[] = [];
  const walk = (node: any, eventId = 0, eventName = "") => {
    if (!node || typeof node !== "object") return;
    const id = node.EventId ?? eventId;
    const name = node.EventName ?? eventName;
    if (node.OutcomeName && node.Price != null) {
      out.push({
        EventId: id,
        EventName: name,
        OutcomeId: node.OutcomeId,
        OutcomeName: node.OutcomeName,
        Price: Number(node.Price),
        Points: Number(node.Points ?? 0),
        PlayerTeamName: node.PlayerTeamName,
      });
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") walk(v, id, name);
    }
  };
  walk(data);
  return out;
}

const winLeg = (o: Outcome): Leg => ({
  EventId: o.EventId, OutcomeId: o.OutcomeId, MarketType: "WIN", FixedWin: o.Price,
  FixedMarketId: 0, MarketTypeDesc: `Match Result (${MATCH_LABEL})`,
  GroupByHeader: "Match Result", Points: 0, BetDetailTypeCode: "W",
  OutcomeName: o.OutcomeName,
});

const tryLeg = (o: Outcome): Leg => ({
  EventId: o.EventId, OutcomeId: o.OutcomeId, MarketType: "TSCORER", FixedWin: o.Price,
  FixedMarketId: 0, MarketTypeDesc: `Anytime Tryscorer (${MATCH_LABEL})`,
  GroupByHeader: "Anytime Tryscorer", Points: 0, BetDetailTypeCode: "TS",
  OutcomeName: o.OutcomeName,
});

async function price(legs: Leg[]): Promise<number | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      "User-Agent": UA, Origin: "https://www.betr.com.au",
      Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: MASTER_EVENT_ID, Markets: legs }),
  });
  const data = await res.json().catch(() => null);
  if (!data || data.ErrorNo !== 0 || !data.Price) {
    if (data?.Message) console.log(`      (${data.Message})`);
    return null;
  }
  return Number(data.Price);
}

async function main() {
  console.log(`\n=== ${MATCH_LABEL} (event ${MASTER_EVENT_ID}) ===\n`);

  const popular = await group("G18");
  const tries = await group("G20");

  const matchResult = popular.filter(
    (o) => /^Match Result/i.test(o.EventName) && o.Points === 0,
  );
  const anytime = tries.filter((o) => /^Anytime Tryscorer/i.test(o.EventName));

  console.log("Head to head:");
  for (const o of matchResult) console.log(`   ${o.OutcomeName.padEnd(26)} $${o.Price}`);

  console.log(`\nAnytime tryscorer: ${anytime.length} runners`);
  for (const o of [...anytime].sort((a, b) => a.Price - b.Price).slice(0, 8)) {
    console.log(`   ${o.OutcomeName.padEnd(26)} $${String(o.Price).padEnd(6)} ${o.PlayerTeamName ?? ""}`);
  }

  // Candidate multis: the favourite to win plus its two shortest scorers,
  // which is the highest-probability shape the book offers.
  const fav = [...matchResult].sort((a, b) => a.Price - b.Price)[0];
  if (!fav) throw new Error("no match-result outcome");

  const favTeam = fav.OutcomeName;
  const favScorers = anytime
    .filter((o) => (o.PlayerTeamName ?? "").toLowerCase() === favTeam.toLowerCase())
    .sort((a, b) => a.Price - b.Price);

  if (favScorers.length < 2) {
    console.log(`\nNot enough ${favTeam} scorers quoted to build a multi.`);
    return;
  }

  console.log(`\nPricing ${favTeam} + scorers through the book's own endpoint:`);
  for (const [i, second] of favScorers.slice(0, 4).entries()) {
    for (const third of favScorers.slice(i + 1, 5)) {
      const legs = [winLeg(fav), tryLeg(second), tryLeg(third)];
      const product = fav.Price * second.Price * third.Price;
      const real = await price(legs);
      const label = `${favTeam} + ${second.OutcomeName} + ${third.OutcomeName}`;
      if (real === null) {
        console.log(`   ${label.slice(0, 62).padEnd(63)} unavailable`);
        continue;
      }
      console.log(
        `   ${label.slice(0, 62).padEnd(63)} $${real.toFixed(2)}  ` +
          `(product $${product.toFixed(2)}, implied ${(100 / real).toFixed(1)}%)`,
      );
    }
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
