/**
 * Replace the grand final's core play with the STANDARD line.
 *
 * The published core was New Zealand +8.5 — an alternate line. The standard
 * line is the book's main handicap pair, ±3.5, which both books quote at
 * roughly even money (TAB: Australia -3.5 $1.85 / New Zealand +3.5 $1.95).
 *
 * WHY THIS REPLACES rather than adds:
 * selectCorePlay returns the FIRST line pick it finds for a fixture, so a
 * second line pick would never render on the card while still counting in
 * the result tracker — a pick subscribers are charged for but cannot see.
 * One core play per fixture.
 *
 * TAB carries the standard line in its own two-outcome "Line" market, NOT in
 * "Pick Your Own Line" — the alternate ladder skips the standard point, so
 * reading only the ladder reports the standard line as unquoted.
 *
 * Both sides are rated off BlueBet's cumulative margin ladder, which is
 * independent of the handicap's own price, and the better side is published.
 * Fails closed if the line is no longer quoted, the ladder cannot rate it, or
 * the books have drifted outside the 6pp agreement gate.
 *
 * Usage: npx tsx scripts/set_final_core_standard_line.ts [--dry-run]
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const TAB_BASE = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BB_BASE = "https://affiliate-api.bluebet.com.au";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";

const MATCH_KEY = "australia__newzealand__f";
const TAB_KEY = "Australia v New Zealand";
const EVENT = 2332757;
const FAV = "Australia";
const DOG = "New Zealand";

const MODEL_VERSION = "rlwc-consensus-v1";
const AGREEMENT_GATE_PCT = 6;
const MIN_WIN_PROBABILITY = 0.5;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const norm = (x: string) =>
  String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

async function getJson(url: string, ua: string, attempts = 4): Promise<any> {
  let last: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": ua },
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(String((last as Error)?.message ?? last));
}

interface Out { name: string; price: number; points: number; bet: string }

function collect(node: any, out: Out[] = []): Out[] {
  if (!node || typeof node !== "object") return out;
  const price = Number(node.Price);
  const name = node.OutcomeName;
  if (name && Number.isFinite(price) && price > 1) {
    out.push({
      name: String(name), price,
      points: Number(node.Points ?? 0),
      bet: String(node.BetDetailTypeCode ?? ""),
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, out);
  return out;
}

async function main() {
  console.log(`Setting the grand final core play to the standard line${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(`fixtures?match_key=eq.${MATCH_KEY}&select=id,round_number`))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY}`);
  if (fixture.round_number !== 5) throw new Error(`${MATCH_KEY} is round ${fixture.round_number}, not the final`);

  const picks = await supabase(
    `picks?fixture_id=eq.${fixture.id}&select=id,market,selection,point,entry_odds,result_status`,
  );
  const core = (picks ?? []).find((p: any) => ["line", "h2h", "total"].includes(p.market));
  if (!core) throw new Error("no core play published for the final");
  if (core.result_status !== "pending") {
    throw new Error(`the core play is ${core.result_status} — refusing to rewrite a settled pick`);
  }
  const lineCount = (picks ?? []).filter((p: any) => p.market === "line").length;
  if (lineCount > 1) {
    throw new Error(`${lineCount} line picks already exist; only the first would render — resolve by hand`);
  }
  console.log(`  was: ${core.selection} ${core.point > 0 ? "+" : ""}${core.point}  $${core.entry_odds}`);

  // ---- live markets ----------------------------------------------------
  const tab = await getJson(`${TAB_BASE}/${encodeURIComponent(TAB_KEY)}?jurisdiction=NSW`, UA_TAB);
  const lineMkt = (tab.markets ?? []).find((m: any) => /^Line$/i.test(m.betOption ?? m.name ?? ""));
  if (!lineMkt) throw new Error("TAB is not quoting its standard Line market");
  const props = lineMkt.propositions ?? [];
  if (props.length !== 2) throw new Error(`TAB's Line market has ${props.length} outcomes, expected a pair`);

  const bb: Out[] = [];
  for (const code of ["G18", "G19"]) {
    try { bb.push(...collect(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${EVENT}&GroupTypeCode=${code}&format=json`, UA_BB))); } catch { /* group may be absent */ }
  }
  if (!bb.length) throw new Error("no BlueBet outcomes");

  const rx = new RegExp(`^${FAV}\\s+(\\d+)\\+$`, "i");
  const favBands = parseMarginBands(
    bb.filter((o) => rx.test(o.name.trim())).map((o) => ({ name: o.name.trim(), price: o.price })),
  );
  if (favBands.length < 5) throw new Error(`${FAV} ladder has only ${favBands.length} band(s)`);

  const bbHc = bb.filter((o) => o.bet === "HC" && o.points !== 0);

  // ---- rate both sides of the standard line ----------------------------
  interface Side { team: string; point: number; price: number; model: number; edge: number; gate: string }
  const sides: Side[] = [];

  for (const p of props) {
    const pts = Number(String(p.name).match(/-?[\d.]+/)?.[0]);
    const price = Number(p.returnWin);
    const team = String(p.name).replace(/\s*[-+]?[\d.]+\s*$/, "").trim();
    if (!Number.isFinite(pts) || !Number.isFinite(price)) continue;
    if (norm(team) !== norm(FAV) && norm(team) !== norm(DOG)) continue;

    const covers = coverProbabilityFromBands(favBands, Math.ceil(Math.abs(pts)));
    if (covers === null) throw new Error(`the ladder cannot rate a ${Math.abs(pts)}-point line`);
    const model = norm(team) === norm(FAV) ? covers : 1 - covers;

    // Agreement gate against BlueBet's own standard handicap.
    let gate = "ungated (BlueBet quotes no comparable line)";
    const bbSide = bbHc.find((o) => norm(o.name) === norm(team) && Math.abs(o.points - pts) < 0.01)
      ?? (() => {
        const mine = bbHc.filter((o) => norm(o.name) === norm(team)).sort((a, b) => a.points - b.points);
        if (mine.length < 2) return undefined;
        const below = [...mine].filter((o) => o.points < pts).pop();
        const above = mine.find((o) => o.points > pts);
        if (!below || !above) return undefined;
        const t = (pts - below.points) / (above.points - below.points);
        return { name: team, price: below.price + t * (above.price - below.price), points: pts, bet: "HC" } as Out;
      })();
    if (bbSide) {
      const gap = Math.abs(1 / price - 1 / bbSide.price) * 100;
      if (gap > AGREEMENT_GATE_PCT) {
        throw new Error(`books disagree ${gap.toFixed(1)}pp on ${team} ${pts} — not publishing`);
      }
      gate = `books agree within ${gap.toFixed(1)}pp`;
    }

    sides.push({ team, point: pts, price, model, edge: (model - 1 / price) * 100, gate });
  }

  if (sides.length !== 2) throw new Error(`rated ${sides.length} side(s) of the standard line, expected 2`);

  for (const s of sides) {
    console.log(`    ${`${s.team} ${s.point > 0 ? "+" : ""}${s.point}`.padEnd(20)} $${s.price.toFixed(2)}  ` +
      `model ${(s.model * 100).toFixed(1)}%  edge ${s.edge >= 0 ? "+" : ""}${s.edge.toFixed(1)}%  [${s.gate}]`);
  }

  // Prefer the side that is at least a coin flip; between two, the better edge.
  const eligible = sides.filter((s) => s.model >= MIN_WIN_PROBABILITY);
  if (!eligible.length) {
    throw new Error("neither side of the standard line reaches a coin flip — not publishing");
  }
  const chosen = eligible.sort((a, b) => b.edge - a.edge)[0];
  console.log(`\n  chosen: ${chosen.team} ${chosen.point > 0 ? "+" : ""}${chosen.point} $${chosen.price.toFixed(2)} ` +
    `(${(chosen.model * 100).toFixed(1)}%, the only side above a coin flip)`);

  if (DRY_RUN) { console.log("\n  DRY RUN — nothing written."); return; }

  const now = new Date().toISOString();
  await supabase(`picks?id=eq.${core.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      market: "line",
      selection: chosen.team,
      point: chosen.point,
      entry_odds: chosen.price,
      entry_bookmaker: "tab",
      entry_captured_at: now,
      model_probability: Number(chosen.model.toFixed(4)),
      market_probability: Number((1 / chosen.price).toFixed(4)),
      model_version: MODEL_VERSION,
      published_at: now,
    }),
  });
  console.log("  core play updated.");
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
