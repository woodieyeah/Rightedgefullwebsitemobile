/**
 * Swap the four negative-edge core plays for their best-rated alternative.
 *
 * Approved: "Swap all 4 to the best-rated option (2 underdog lines)".
 *
 * The replacements come from the interpolation-verified scan. Two are
 * underdog handicaps, which is the variety the card was missing — every
 * Round 1 and Round 2 core play so far has been a favourite covering.
 *
 * Prices are re-read live here rather than trusted from the scan, because a
 * price that moved between rating and writing would publish a number we never
 * verified. If a price has moved against us the swap is abandoned for that
 * fixture rather than written at the new number.
 *
 * Each swap is one UPDATE of the existing pending pick: the selection, point,
 * price, bookmaker, model probability and market probability all move
 * together, so the row can never hold a price from one line and a rating from
 * another.
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";
/** Abandon a swap if the price moved more than this against the rating. */
const MAX_DRIFT_PCT = 3;

interface Swap {
  matchKey: string;
  label: string;
  event: number;
  fav: string;
  /** The team being backed — may be the underdog. */
  team: string;
  isFav: boolean;
  point: number;
  expectPrice: number;
  expectBook: string;
}

const SWAPS: Swap[] = [
  { matchKey: "lebanon__tonga", label: "Tonga v Lebanon", event: 2311016, fav: "Tonga",
    team: "Lebanon", isFav: false, point: 44.5, expectPrice: 1.90, expectBook: "TAB" },
  { matchKey: "cookislands__newzealand", label: "NZ v Cook Islands", event: 2311425, fav: "New Zealand",
    team: "Cook Islands", isFav: false, point: 54.5, expectPrice: 1.90, expectBook: "TAB" },
  { matchKey: "australia__fiji", label: "Australia v Fiji", event: 2311433, fav: "Australia",
    team: "Australia", isFav: true, point: -44.5, expectPrice: 1.90, expectBook: "BlueBet" },
  { matchKey: "england__france", label: "England v France", event: 2311019, fav: "England",
    team: "France", isFav: false, point: 57.5, expectPrice: 1.38, expectBook: "TAB" },
];

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase credentials."); process.exit(1); }

const norm = (x: string) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();

async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = await res.text();
  return t.trim() ? JSON.parse(t) : null;
}

const walk = (n: any, ev = "", out: any[] = []): any[] => {
  if (!n || typeof n !== "object") return out;
  const name = n.EventName ?? ev;
  if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name });
  for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, out);
  return out;
};

async function getJson(url: string, ua: string, attempts = 4): Promise<any> {
  let last: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(String((last as Error)?.message));
}

console.log(`Swapping ${SWAPS.length} core play(s)${DRY_RUN ? " (DRY RUN)" : ""}\n`);

let done = 0;
for (const s of SWAPS) {
  console.log(`=== ${s.label} ===`);

  const fixture = (await supabase(`fixtures?match_key=eq.${s.matchKey}&select=id`))?.[0];
  if (!fixture) { console.log("  fixture not found — skipped\n"); continue; }

  const existing = (await supabase(
    `picks?fixture_id=eq.${fixture.id}&market=eq.line&result_status=eq.pending&select=id,selection,point,entry_odds,model_probability,market_probability`,
  ))?.[0];
  if (!existing) { console.log("  no pending line pick to replace — skipped\n"); continue; }

  const oldEdge = (Number(existing.model_probability) - Number(existing.market_probability)) * 100;
  console.log(`  currently: ${existing.selection} ${existing.point} @ $${existing.entry_odds}  edge ${oldEdge >= 0 ? "+" : ""}${oldEdge.toFixed(1)}%`);

  // ---- re-read the price live ------------------------------------------
  let livePrice: number | null = null;
  if (s.expectBook === "TAB") {
    const tab = await getJson(
      `https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/${encodeURIComponent(
        s.label === "NZ v Cook Islands" ? "New Zealand v Cook Islands" : s.label,
      )}?jurisdiction=NSW`, UA_TAB,
    );
    for (const m of tab.markets ?? []) {
      if (!/Pick Your Own Line|^Line$/i.test(m.betOption ?? m.name ?? "")) continue;
      for (const p of m.propositions ?? []) {
        const pts = Number(String(p.name).match(/-?[\d.]+/)?.[0]);
        const team = String(p.name).replace(/\s*[-+]?[\d.]+\s*$/, "").trim();
        if (norm(team) === norm(s.team) && pts === s.point) livePrice = Number(p.returnWin);
      }
    }
  } else {
    const g18 = walk(await getJson(`https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=${s.event}&GroupTypeCode=G18&format=json`, UA_BB));
    const hit = g18.find((o) => /^Match Result/i.test(o.EventName) && norm(o.OutcomeName) === norm(s.team) && Number(o.Points) === s.point);
    if (hit) livePrice = Number(hit.Price);
  }

  if (livePrice === null) {
    console.log(`  the ${s.team} ${s.point} line is no longer quoted at ${s.expectBook} — swap abandoned, existing pick left untouched\n`);
    continue;
  }

  const drift = (livePrice - s.expectPrice) / s.expectPrice * 100;
  console.log(`  live price $${livePrice.toFixed(2)} (rated at $${s.expectPrice.toFixed(2)}, drift ${drift >= 0 ? "+" : ""}${drift.toFixed(1)}%)`);
  if (drift < -MAX_DRIFT_PCT) {
    console.log(`  price moved against us beyond ${MAX_DRIFT_PCT}% — swap abandoned\n`);
    continue;
  }

  // ---- re-rate off the live ladder ------------------------------------
  const g19 = walk(await getJson(`https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=${s.event}&GroupTypeCode=G19&format=json`, UA_BB));
  const seen = new Map<number, number>();
  for (const o of g19) {
    const m = String(o.OutcomeName).match(new RegExp(`^${s.fav}\\s+(\\d+)\\+$`));
    if (m && !seen.has(Number(m[1]))) seen.set(Number(m[1]), Number(o.Price));
  }
  const bands = parseMarginBands([...seen.entries()].map(([t, p]) => ({ name: `${s.fav} ${t}+`, price: p })));
  const favCovers = coverProbabilityFromBands(bands, Math.ceil(Math.abs(s.point)));
  if (favCovers === null) {
    console.log("  the ladder no longer reaches this line — swap abandoned\n");
    continue;
  }
  const model = s.isFav ? favCovers : 1 - favCovers;
  const implied = 1 / livePrice;
  const edge = (model - implied) * 100;

  console.log(
    `  REPLACE -> ${s.team} ${s.point > 0 ? "+" : ""}${s.point} @ $${livePrice.toFixed(2)} (${s.expectBook})  ` +
    `model ${(model * 100).toFixed(1)}%  edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%   ` +
    `[improvement ${(edge - oldEdge) >= 0 ? "+" : ""}${(edge - oldEdge).toFixed(1)}pp]`,
  );

  if (edge < oldEdge) {
    console.log("  replacement is not actually better than what is live — swap abandoned\n");
    continue;
  }

  if (DRY_RUN) { console.log("  (dry run: not written)\n"); continue; }

  await supabase(`picks?id=eq.${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      // Bare team name only: the handicap lives in `point` and the card
      // appends it at render time. Baking it into the string breaks both the
      // crest lookup and the match-card attachment.
      selection: s.team,
      point: s.point,
      entry_odds: livePrice,
      entry_bookmaker: s.expectBook,
      entry_captured_at: new Date().toISOString(),
      model_probability: Number(model.toFixed(4)),
      market_probability: Number(implied.toFixed(4)),
    }),
  });
  done++;
  console.log("  written\n");
}

console.log(DRY_RUN ? "DRY RUN complete." : `Done — ${done} core play(s) swapped.`);
