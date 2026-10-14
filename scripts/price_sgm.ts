/**
 * Price a Same Game Multi through Betr's own correlation model.
 *
 * POST /SameGameMultiPrice returns the combined price for a set of legs.
 * Multiplying leg prices is wrong for correlated selections: Australia winning
 * makes Australian try scorers more likely, so independent multiplication
 * overstates the payout. Betr's endpoint applies their correlation model, which
 * is the only defensible price to publish.
 *
 * Read-only: prices a combination, places nothing.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";

const ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const MASTER_EVENT_ID = 2292811;

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

async function priceSgm(legs: Leg[], label: string) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
      Origin: "https://www.betr.com.au",
      Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: MASTER_EVENT_ID, Markets: legs }),
  });

  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON body */ }

  const naive = legs.reduce((p, l) => p * l.FixedWin, 1);

  console.log(`\n=== ${label} ===`);
  for (const l of legs) {
    console.log(`   ${l.OutcomeName} ${l.Points ? `${l.Points > 0 ? "+" : ""}${l.Points}` : ""} @ $${l.FixedWin}  [${l.GroupByHeader}]`);
  }
  console.log(`   HTTP ${res.status}`);

  if (!parsed) {
    console.log(`   raw: ${text.slice(0, 220)}`);
    return null;
  }

  const price = parsed.Price ?? parsed.price ?? parsed.SameGameMultiPrice ?? null;
  console.log(`   naive multiply : $${naive.toFixed(2)}`);
  if (price !== null) {
    const delta = ((price / naive) - 1) * 100;
    console.log(`   BETR SGM price : $${Number(price).toFixed(2)}   (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs naive)`);
  } else {
    console.log(`   response keys: ${Object.keys(parsed).join(", ")}`);
    console.log(`   body: ${JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed;
}

async function main() {
  // Captured from the live site: Match Result market, EventId 92785304.
  const ausHandicap: Leg = {
    EventId: 92785304, OutcomeId: 1, MarketType: "HCWEST", FixedWin: 1.85,
    FixedMarketId: 164916677, MarketTypeDesc: "Match Result (Australia v New Zealand)",
    GroupByHeader: "Handicap", Points: -3.5, BetDetailTypeCode: "HC", OutcomeName: "Australia",
  };
  const nzHandicap: Leg = {
    EventId: 92785304, OutcomeId: 2, MarketType: "HCWEST", FixedWin: 1.95,
    FixedMarketId: 164916678, MarketTypeDesc: "Match Result (Australia v New Zealand)",
    GroupByHeader: "Handicap", Points: 3.5, BetDetailTypeCode: "HC", OutcomeName: "New Zealand",
  };

  // Sanity check: two mutually exclusive legs must be rejected or priced absurdly.
  await priceSgm([ausHandicap, nzHandicap], "CONTRADICTION CHECK (Aus -3.5 + NZ +3.5)");

  // The real request shape, single leg, to confirm the endpoint works.
  await priceSgm([ausHandicap], "Single leg: Australia -3.5");
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
