/**
 * Betfair sharp-anchor probe — READ-ONLY, writes nothing.
 *
 * Answers three questions the RightEdge server currently hides, because it
 * strips Betfair from every path (index.tsx:2938 cached, :2974 fresh):
 *
 *   1. Which Betfair variant does our key return (betfair_ex_au vs betfair / eu)?
 *   2. Do we get BOTH h2h (back) and h2h_lay (lay)?
 *   3. What do each side's implied probabilities sum to?
 *        back  > 100%  (overround)   lay < 100%  (underround)
 *        midpoint should land ~100%
 *
 * Usage:
 *   ODDS_API_KEY=... npx tsx scripts/probe_betfair_anchor.ts
 *
 * Cost: 2 credits per region probed (markets=h2h x 1 region).
 */

const KEY = process.env.ODDS_API_KEY;
if (!KEY) {
  console.error("Set ODDS_API_KEY. Never paste it into chat or commit it.");
  process.exit(1);
}

const SPORT = process.env.SPORT_KEY || "rugbyleague_nrl";

async function fetchRegion(region: string) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/` +
    `?apiKey=${KEY}&regions=${region}&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  ${region}: HTTP ${res.status} ${await res.text()}`);
    return [];
  }
  console.log(
    `  ${region}: ok | credits used ${res.headers.get("x-requests-last")}, ` +
    `remaining ${res.headers.get("x-requests-remaining")}`,
  );
  return (await res.json()) as any[];
}

const impliedSum = (outcomes: any[]) =>
  outcomes.reduce((t, o) => t + 100 / Number(o.price), 0);

(async () => {
  for (const region of ["au", "eu", "uk"]) {
    console.log(`\n=== region=${region} ===`);
    const events = await fetchRegion(region);

    // Which exchanges appear at all?
    const exchanges = new Set<string>();
    for (const ev of events) {
      for (const b of ev.bookmakers || []) {
        const label = `${b.key} ${b.title}`.toLowerCase();
        if (/betfair|matchbook|smarkets|betdaq/.test(label)) {
          exchanges.add(`${b.key} (${b.title})`);
        }
      }
    }
    console.log(`  exchanges present: ${[...exchanges].join(", ") || "(none)"}`);

    for (const ev of events.slice(0, 3)) {
      for (const b of ev.bookmakers || []) {
        if (!/betfair|matchbook|smarkets|betdaq/.test(`${b.key} ${b.title}`.toLowerCase())) continue;

        const back = b.markets?.find((m: any) => m.key === "h2h");
        const lay = b.markets?.find((m: any) => m.key === "h2h_lay");

        console.log(`\n  ${ev.home_team} v ${ev.away_team} — ${b.title}`);
        console.log(`    markets returned: ${(b.markets || []).map((m: any) => m.key).join(", ")}`);

        if (back) {
          const s = impliedSum(back.outcomes);
          console.log(`    BACK  ${back.outcomes.map((o: any) => `${o.name} $${o.price}`).join("  ")}`);
          console.log(`          sums to ${s.toFixed(2)}%  (${s > 100 ? "OVER" : "UNDER"}round ${Math.abs(s - 100).toFixed(2)}%)`);
        }
        if (lay) {
          const s = impliedSum(lay.outcomes);
          console.log(`    LAY   ${lay.outcomes.map((o: any) => `${o.name} $${o.price}`).join("  ")}`);
          console.log(`          sums to ${s.toFixed(2)}%  (${s > 100 ? "OVER" : "UNDER"}round ${Math.abs(s - 100).toFixed(2)}%)`);
        }

        // The decisive test: does the midpoint actually land on 100%?
        if (back && lay) {
          const mid = back.outcomes.map((o: any) => {
            const l = lay.outcomes.find((x: any) => x.name === o.name);
            return { name: o.name, price: (Number(o.price) + Number(l.price)) / 2 };
          });
          const s = impliedSum(mid);
          console.log(`    MID   ${mid.map((o: any) => `${o.name} $${o.price.toFixed(3)}`).join("  ")}`);
          console.log(`          sums to ${s.toFixed(2)}%  <-- should be ~100%`);
          const spread = back.outcomes.map((o: any) => {
            const l = lay.outcomes.find((x: any) => x.name === o.name);
            return Math.abs(Number(l.price) - Number(o.price)) / Number(o.price) * 100;
          });
          console.log(`    spread per outcome: ${spread.map((x: number) => x.toFixed(2) + "%").join(", ")}`);
        } else {
          console.log(`    !! only one side present — midpoint impossible, anchor would be BIASED`);
        }

        // Volume is what we actually want for weighting. Report whether ANY exists.
        const volFields = JSON.stringify(b).match(/"(size|volume|matched|liquidity)[^"]*"/gi);
        console.log(`    volume/size fields: ${volFields ? volFields.join(", ") : "NONE (midpoint can only be unweighted)"}`);
      }
    }
  }
})();
