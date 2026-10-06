/**
 * End-to-end value-model test on a single real match.
 *
 * Pipeline under test (the 2027 architecture):
 *   1. Exchange back + lay   -> unweighted midpoint -> spread gate -> true probability
 *   2. Compare every soft bookmaker price against that anchor -> value edge
 *   3. Sharp total + handicap -> projected scoreline
 *
 * READ-ONLY. Publishes nothing, writes nothing to production.
 *
 * Usage:
 *   ODDS_API_KEY=... npx tsx scripts/test_value_model.ts [sportKey] [maxSpreadPct]
 *
 * Cost: 3 credits (h2h,spreads,totals x 1 region).
 */

import { resolveSharpAnchor } from "../src/model/sharp-anchor.ts";
import { projectScoreline } from "../src/model/projected-score.ts";

const KEY = process.env.ODDS_API_KEY;
if (!KEY) { console.error("ODDS_API_KEY not set"); process.exit(1); }

const SPORT = process.argv[2] || "rugbyleague_nrl";
const GATE = Number(process.argv[3] || 5);
const EXCHANGE_RE = /betfair|matchbook|smarkets|betdaq/;

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

(async () => {
  const url =
    `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/` +
    `?apiKey=${KEY}&regions=au&markets=h2h,spreads,totals&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1); }
  console.log(`credits: last ${res.headers.get("x-requests-last")}, remaining ${res.headers.get("x-requests-remaining")}\n`);

  for (const ev of (await res.json()) as any[]) {
    const mins = Math.round((new Date(ev.commence_time).getTime() - Date.now()) / 60000);
    console.log("=".repeat(78));
    console.log(`${ev.home_team} v ${ev.away_team}`);
    console.log(`kickoff ${new Date(ev.commence_time).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST  (${mins} min away)`);
    console.log("=".repeat(78));

    // ---- 1. Sharp anchor from the exchange ----------------------------------
    const exch = (ev.bookmakers || []).filter((b: any) => EXCHANGE_RE.test(`${b.key} ${b.title}`.toLowerCase()));
    if (!exch.length) { console.log("\nNo exchange present -> NO ANCHOR -> no play. (fail closed)\n"); continue; }

    let anchor: ReturnType<typeof resolveSharpAnchor> = null;
    let anchorSource = "";
    for (const b of exch) {
      const back = b.markets?.find((m: any) => m.key === "h2h")?.outcomes;
      const lay = b.markets?.find((m: any) => m.key === "h2h_lay")?.outcomes;
      if (!back || !lay) { console.log(`  ${b.key}: one side only -> unusable`); continue; }
      const a = resolveSharpAnchor({ back, lay, maxSpreadPct: GATE });
      console.log(`  ${b.key}: ${back.map((o: any) => `${o.name} $${o.price}`).join("  ")}`);
      console.log(`  ${" ".repeat(b.key.length)}  lay: ${lay.map((o: any) => `${o.name} $${o.price}`).join("  ")}`);
      if (a && !anchor) { anchor = a; anchorSource = b.key; }
      console.log(`  ${" ".repeat(b.key.length)}  widest spread ${a ? a.maxSpreadPct.toFixed(2) : "?"}% -> gate@${GATE}% ${a ? "PASS" : "REFUSED"}`);
    }

    if (!anchor) { console.log(`\nNo exchange cleared the ${GATE}% gate -> NO ANCHOR -> no play. (fail closed)\n`); continue; }

    console.log(`\n--- TRUE PROBABILITY (midpoint of ${anchorSource}, de-vigged) ---`);
    for (const p of anchor.probabilities) console.log(`  ${p.name.padEnd(22)} ${p.probability.toFixed(2)}%   fair $${(100 / p.probability).toFixed(2)}`);

    // ---- 2. Value against every soft bookmaker ------------------------------
    console.log(`\n--- VALUE vs SOFT BOOKMAKERS ---`);
    const found: { book: string; team: string; price: number; edge: number }[] = [];
    for (const b of ev.bookmakers || []) {
      if (EXCHANGE_RE.test(`${b.key} ${b.title}`.toLowerCase())) continue;
      const h2h = b.markets?.find((m: any) => m.key === "h2h");
      if (!h2h) continue;
      for (const o of h2h.outcomes) {
        const fair = anchor.probabilities.find((p) => p.name === o.name);
        if (!fair) continue;
        const edge = fair.probability - 100 / Number(o.price);
        found.push({ book: b.title, team: o.name, price: Number(o.price), edge });
      }
    }
    found.sort((a, b) => b.edge - a.edge);
    for (const f of found.slice(0, 8)) {
      const flag = f.edge > 2 ? "  <== VALUE" : "";
      console.log(`  ${f.team.padEnd(22)} $${String(f.price).padEnd(6)} ${f.book.padEnd(16)} edge ${pct(f.edge).padStart(8)}${flag}`);
    }
    const best = found[0];
    console.log(`\n  best available: ${best.team} $${best.price} (${best.book}) edge ${pct(best.edge)}`);
    console.log(`  ${best.edge > 2 ? "QUALIFIES as a value play (>2%)" : "NO value play — market agrees with the exchange"}`);

    // ---- 3. Projected scoreline from sharp total + handicap ------------------
    console.log(`\n--- PROJECTED SCORELINE (from market lines) ---`);
    const spreadsBook = (ev.bookmakers || []).find((b: any) => b.markets?.some((m: any) => m.key === "spreads"));
    const totalsBook = (ev.bookmakers || []).find((b: any) => b.markets?.some((m: any) => m.key === "totals"));
    const spreadOutcomes = spreadsBook?.markets.find((m: any) => m.key === "spreads")?.outcomes;
    const totalOutcomes = totalsBook?.markets.find((m: any) => m.key === "totals")?.outcomes;

    if (spreadOutcomes && totalOutcomes) {
      // Shared derivation: src/model/projected-score.ts (22 tests). Keeping the
      // arithmetic here would be a second implementation to drift out of sync.
      const projection = projectScoreline({
        homeTeam: ev.home_team,
        spreads: spreadOutcomes,
        totals: totalOutcomes,
      });
      if (projection) {
        const sign = projection.margin > 0 ? "+" : "";
        console.log(`  line ${ev.home_team} ${-projection.margin} (${spreadsBook.title}), total ${projection.total} (${totalsBook.title})`);
        console.log(`  => ${ev.home_team} ${projection.home.toFixed(1)} - ${projection.away.toFixed(1)} ${ev.away_team}  (margin ${sign}${projection.margin.toFixed(1)})`);
      } else console.log(`  line/total points missing or incoherent -> no projection`);
    } else console.log(`  no spreads/totals available -> no projection`);
    console.log();
  }
})();
