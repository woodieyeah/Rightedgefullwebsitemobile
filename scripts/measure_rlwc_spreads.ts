/**
 * RLWC spread measurement — READ-ONLY. Appends to a local JSONL file.
 *
 * Purpose: answer, with data rather than assumption, whether an UNWEIGHTED
 * back/lay midpoint is good enough for RLWC, or whether real order-book depth
 * is worth integrating.
 *
 * It records, per exchange market, per poll:
 *   - back and lay price for every outcome
 *   - each outcome's spread %, and the market's widest
 *   - what each side sums to (back > 100%, lay < 100% expected)
 *   - whether the midpoint normalises close to 100%
 *   - whether ANY volume/size field exists in the payload
 *   - minutes until kickoff, so spread-vs-time-to-start can be plotted
 *
 * Run it repeatedly as the tournament approaches (cron every 30m), then
 * summarise with --report.
 *
 * Usage:
 *   ODDS_API_KEY=... npx tsx scripts/measure_rlwc_spreads.ts
 *   npx tsx scripts/measure_rlwc_spreads.ts --report
 *
 * Cost: 1 credit per region per poll (markets=h2h).
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolveSharpAnchor, spreadPct } from "../src/model/sharp-anchor.ts";

const OUT = process.env.SPREAD_LOG || ".hermes/data/rlwc-spreads.jsonl";
const EXCHANGE_RE = /betfair|matchbook|smarkets|betdaq/;

// RLWC may be carried under any of these; we probe and report what exists
// rather than assuming a key. `upcoming` is a catch-all the API always accepts.
const SPORT_KEYS = (process.env.SPORT_KEYS ||
  "rugbyleague_nrl,rugbyleague_world_cup,rugbyleague_international,upcoming")
  .split(",").map((s) => s.trim()).filter(Boolean);

const REGIONS = (process.env.REGIONS || "au,eu,uk").split(",").map((s) => s.trim());

interface Row {
  observedAt: string;
  sportKey: string;
  region: string;
  exchange: string;
  event: string;
  commenceTime: string | null;
  minutesToStart: number | null;
  outcomes: { name: string; back: number; lay: number; spreadPct: number }[];
  maxSpreadPct: number;
  backSumPct: number;
  laySumPct: number;
  midpointSumPct: number | null;
  anchorResolvedAt10Pct: boolean;
  hasVolumeField: boolean;
}

function impliedSum(outcomes: { price: number }[]) {
  return outcomes.reduce((t, o) => t + 100 / Number(o.price), 0);
}

async function poll() {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.error("Set ODDS_API_KEY (from Supabase secrets). Never commit or paste it.");
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  let written = 0;

  for (const sportKey of SPORT_KEYS) {
    for (const region of REGIONS) {
      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
        `?apiKey=${key}&regions=${region}&markets=h2h&oddsFormat=decimal`;

      let res: Response;
      try {
        res = await fetch(url);
      } catch (err) {
        console.log(`${sportKey}/${region}: fetch failed — ${(err as Error).message}`);
        continue;
      }

      if (!res.ok) {
        // An unknown sport key returns 422/404; that is itself a finding.
        console.log(`${sportKey}/${region}: HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
        continue;
      }

      const events = (await res.json()) as any[];
      const exchangesSeen = new Set<string>();
      let rowsThisCall = 0;

      for (const ev of events) {
        for (const b of ev.bookmakers || []) {
          if (!EXCHANGE_RE.test(`${b.key} ${b.title}`.toLowerCase())) continue;
          exchangesSeen.add(b.key);

          const back = b.markets?.find((m: any) => m.key === "h2h")?.outcomes;
          const lay = b.markets?.find((m: any) => m.key === "h2h_lay")?.outcomes;
          if (!Array.isArray(back) || !Array.isArray(lay) || !back.length || !lay.length) {
            console.log(`  ${b.key} ${ev.home_team} v ${ev.away_team}: ONE SIDE ONLY ` +
              `(${(b.markets || []).map((m: any) => m.key).join(",") || "no markets"})`);
            continue;
          }

          const outcomes = back.map((o: any) => {
            const l = lay.find((x: any) => x.name === o.name);
            return {
              name: o.name,
              back: Number(o.price),
              lay: Number(l?.price),
              spreadPct: l ? spreadPct(Number(o.price), Number(l.price)) : Number.NaN,
            };
          });

          const anchor = resolveSharpAnchor({ back, lay, maxSpreadPct: 10 });
          const midAnchor = resolveSharpAnchor({ back, lay, maxSpreadPct: Number.MAX_SAFE_INTEGER });
          const commence = ev.commence_time ?? null;

          const row: Row = {
            observedAt: new Date().toISOString(),
            sportKey, region,
            exchange: b.key,
            event: `${ev.home_team} v ${ev.away_team}`,
            commenceTime: commence,
            minutesToStart: commence
              ? Math.round((new Date(commence).getTime() - Date.now()) / 60000)
              : null,
            outcomes,
            maxSpreadPct: Math.max(...outcomes.map((o) => o.spreadPct)),
            backSumPct: impliedSum(back),
            laySumPct: impliedSum(lay),
            midpointSumPct: midAnchor
              ? midAnchor.midpoint.reduce((t, o) => t + 100 / o.price, 0)
              : null,
            anchorResolvedAt10Pct: Boolean(anchor),
            hasVolumeField: /"(size|volume|matched|liquidity|available)[^"]*":/i.test(JSON.stringify(b)),
          };

          appendFileSync(OUT, JSON.stringify(row) + "\n");
          written++; rowsThisCall++;
          console.log(
            `  ${b.key} | ${row.event} | widest ${row.maxSpreadPct.toFixed(2)}% | ` +
            `back ${row.backSumPct.toFixed(1)}% lay ${row.laySumPct.toFixed(1)}% | ` +
            `gate@10% ${row.anchorResolvedAt10Pct ? "PASS" : "REFUSED"} | ` +
            `volume ${row.hasVolumeField ? "YES" : "none"}`,
          );
        }
      }

      console.log(
        `${sportKey}/${region}: ${events.length} events, ` +
        `exchanges [${[...exchangesSeen].join(", ") || "none"}], ${rowsThisCall} rows ` +
        `(credits left ${res.headers.get("x-requests-remaining")})`,
      );
    }
  }
  console.log(`\n${written} row(s) appended to ${OUT}`);
}

function report() {
  if (!existsSync(OUT)) {
    console.log(`No measurements yet at ${OUT}. Run the poller first.`);
    return;
  }
  const rows: Row[] = readFileSync(OUT, "utf8").trim().split("\n")
    .filter(Boolean).map((l) => JSON.parse(l));
  if (!rows.length) return console.log("No rows.");

  const widths = rows.map((r) => r.maxSpreadPct).filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p: number) => widths[Math.min(widths.length - 1, Math.floor(widths.length * p))];

  console.log(`\n=== RLWC back/lay spread measurement (${rows.length} observations) ===`);
  console.log(`  exchanges   : ${[...new Set(rows.map((r) => r.exchange))].join(", ")}`);
  console.log(`  sport keys  : ${[...new Set(rows.map((r) => r.sportKey))].join(", ")}`);
  console.log(`  volume field present anywhere: ${rows.some((r) => r.hasVolumeField) ? "YES" : "NO"}`);
  console.log(`\n  widest-spread distribution:`);
  console.log(`    min ${widths[0]?.toFixed(2)}%  p25 ${q(0.25)?.toFixed(2)}%  ` +
    `median ${q(0.5)?.toFixed(2)}%  p75 ${q(0.75)?.toFixed(2)}%  ` +
    `p90 ${q(0.9)?.toFixed(2)}%  max ${widths[widths.length - 1]?.toFixed(2)}%`);

  for (const gate of [2, 5, 10, 15, 20]) {
    const pass = widths.filter((w) => w <= gate).length;
    console.log(`    gate ${String(gate).padStart(2)}%: ${pass}/${widths.length} markets pass ` +
      `(${((pass / widths.length) * 100).toFixed(0)}%)`);
  }

  console.log(`\n  sanity — midpoint should normalise near 100%:`);
  const mids = rows.map((r) => r.midpointSumPct).filter((x): x is number => x != null);
  if (mids.length) {
    console.log(`    back side mean ${(rows.reduce((t, r) => t + r.backSumPct, 0) / rows.length).toFixed(2)}% (expect >100)`);
    console.log(`    lay  side mean ${(rows.reduce((t, r) => t + r.laySumPct, 0) / rows.length).toFixed(2)}% (expect <100)`);
    console.log(`    midpoint  mean ${(mids.reduce((t, x) => t + x, 0) / mids.length).toFixed(2)}% (expect ~100)`);
  }

  console.log(`\n  spread vs time to kickoff:`);
  for (const [label, lo, hi] of [
    ["> 7 days", 10080, Infinity], ["1-7 days", 1440, 10080],
    ["6-24 h", 360, 1440], ["1-6 h", 60, 360], ["< 1 h", -Infinity, 60],
  ] as [string, number, number][]) {
    const bucket = rows.filter((r) => r.minutesToStart != null &&
      r.minutesToStart >= lo && r.minutesToStart < hi).map((r) => r.maxSpreadPct);
    if (!bucket.length) continue;
    const mean = bucket.reduce((t, x) => t + x, 0) / bucket.length;
    console.log(`    ${label.padEnd(9)} n=${String(bucket.length).padStart(3)}  mean widest ${mean.toFixed(2)}%`);
  }

  console.log(`\n  DECISION GUIDE`);
  console.log(`    median < 3%   -> unweighted midpoint is fine; skip depth integration`);
  console.log(`    median 3-8%   -> unweighted + gate workable; depth would help marginally`);
  console.log(`    median > 8%   -> unweighted midpoint unreliable; integrate real depth`);
  console.log(`                     or publish no anchored play on thin RLWC markets`);
}

if (process.argv.includes("--report")) report();
else poll();
