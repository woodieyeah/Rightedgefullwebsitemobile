/**
 * Publish the Round 4 card: the two semi-finals, each with a core play and a
 * same-game multi.
 *
 * The SELECTIONS are fixed by decision (Tonga +8.5 and Australia -5.5); the
 * PRICES are read live at write time and the model probability is recomputed
 * from the book's cumulative ladder at that moment. Nothing is carried over
 * from the survey, because prices move.
 *
 * Fails closed: if a chosen line is no longer quoted, or the ladder can no
 * longer rate it, or the books have drifted outside the agreement gate, the
 * fixture is skipped rather than published on stale or unverifiable numbers.
 *
 * LESSONS APPLIED
 * - Rate a handicap only off BlueBet's CUMULATIVE ladder ("Tonga 13+"). TAB's
 *   banded ladder has an open top band and cannot rate a deep line.
 * - The multi's line leg must sit on the SAME side as the core play; Round 2
 *   shipped a multi contradicting its own core, which is incoherent.
 * - The SGM endpoint needs a full leg descriptor. ErrorNo 4503 = malformed
 *   request, 4527 = legs share an EventId, $101 with ErrorNo 0 = refusal
 *   sentinel. None of those is a price.
 * - A try-scorer market is identified by the ancestor's EventName; every
 *   outcome reports MarketDesc "Win".
 * - Store the bare team in `selection` and the handicap in `point`; the card
 *   appends it exactly once at render time.
 *
 * Usage:
 *   npx tsx scripts/publish_round4.ts [--dry-run] [--only "Australia v Samoa"]
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";
import { buildSgmLeg } from "../src/model/sgm-legs.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

const TAB_BASE = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BB_BASE = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";

const MODEL_VERSION = "rlwc-consensus-v1";
const AGREEMENT_GATE_PCT = 6;
const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;
/** A published core play must still be at least a coin flip when written. */
const MIN_WIN_PROBABILITY = 0.5;

interface Plan {
  tabKey: string;
  matchKey: string;
  label: string;
  event: number;
  /** The team whose cumulative ladder rates this fixture. */
  fav: string;
  /** The core play: team and handicap, as decided. */
  coreTeam: string;
  corePoint: number;
  /** The multi: the anchor sits on the same side as the core play. */
  anchorTeam: string;
  scorer: string;
}

const PLAN: Plan[] = [
  {
    tabKey: "New Zealand v Tonga", matchKey: "newzealand__tonga", label: "New Zealand v Tonga",
    event: 2325881, fav: "New Zealand",
    coreTeam: "Tonga", corePoint: 8.5,
    anchorTeam: "Tonga", scorer: "Dallin Watene-Zelezniak",
  },
  {
    tabKey: "Australia v Samoa", matchKey: "australia__samoa", label: "Australia v Samoa",
    event: 2325886, fav: "Australia",
    coreTeam: "Australia", corePoint: -5.5,
    anchorTeam: "Australia", scorer: "Tom Trbojevic",
  },
];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const norm = (x: string) =>
  String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'").toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+/g, " ").trim();

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

interface BbOutcome {
  name: string; price: number; points: number;
  betType: string; eventName: string;
  fixedMarketId: number; eventId: number; outcomeId: number;
  team: string;
}

function collectBb(node: any, out: BbOutcome[] = [], eventName = ""): BbOutcome[] {
  if (!node || typeof node !== "object") return out;
  const ev = node.EventName ?? eventName;
  const price = Number(node.Price);
  const name = node.OutcomeName;
  if (name && Number.isFinite(price) && price > 1) {
    out.push({
      name: String(name), price,
      points: Number(node.Points ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      eventName: String(ev ?? ""),
      fixedMarketId: Number(node.FixedMarketId ?? 0),
      eventId: Number(node.EventId ?? 0),
      outcomeId: Number(node.OutcomeId ?? 0),
      team: String(node.PlayerTeamName ?? ""),
    });
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") collectBb(v, out, String(ev ?? ""));
  }
  return out;
}

async function blueBetOutcomes(event: number, codes: string[]): Promise<BbOutcome[]> {
  const all: BbOutcome[] = [];
  for (const code of codes) {
    try {
      all.push(...collectBb(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, UA_BB)));
    } catch { /* a missing group is not fatal */ }
  }
  const seen = new Set<string>();
  return all.filter((o) => {
    const k = `${o.name}|${o.price}|${o.points}|${o.betType}|${o.eventName}|${o.fixedMarketId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function priceSgm(event: number, legs: any[]): Promise<number | null> {
  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      "User-Agent": UA_BB, Origin: "https://www.betr.com.au",
      Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: event, Markets: legs }),
  });
  const d = await res.json().catch(() => null);
  if (!d) return null;
  if (d.ErrorNo !== 0) {
    console.log(`      SGM endpoint refused: ErrorNo ${d.ErrorNo} ${String(d.Message ?? "").slice(0, 70)}`);
    return null;
  }
  if (!d.Price) return null;
  const price = Number(d.Price);
  if (price === SGM_SENTINEL) { console.log("      SGM returned the $101 refusal sentinel"); return null; }
  if (price < MIN_SGM_PRICE) return null;
  return price;
}

/**
 * Leg descriptors come from the shared builder.
 *
 * The previous local version sent a handicap as BetDetailTypeCode "W" with
 * FixedMarketId 0, which made the endpoint price it as an OUTRIGHT: every
 * Tonga start and Tonga-to-win all returned $5.80, so the card advertised a
 * price belonging to a different bet. buildSgmLeg enforces HC/HCWEST with the
 * start's own FixedMarketId and throws rather than degrading.
 */
const sgmLeg = (o: BbOutcome, kind: "handicap" | "try-scorer", label: string) =>
  buildSgmLeg(o, kind, label);

async function run(plan: Plan) {
  console.log(`\n${"=".repeat(74)}\n${plan.label}\n${"=".repeat(74)}`);

  const fixture = (await supabase(
    `fixtures?match_key=eq.${plan.matchKey}&select=id,home_team,away_team,kickoff_at`,
  ))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${plan.matchKey}`);

  const existing = await supabase(`picks?fixture_id=eq.${fixture.id}&select=id`);
  if (existing?.length) {
    console.log(`  ${existing.length} pick(s) already published — skipping.`);
    return [];
  }

  // ---- live markets, read now -------------------------------------------
  const tab = await getJson(`${TAB_BASE}/${encodeURIComponent(plan.tabKey)}?jurisdiction=NSW`, UA_TAB);
  const tabMarket = (re: RegExp) => (tab.markets ?? []).find((m: any) => re.test(m.betOption ?? m.name ?? ""));
  const bb = await blueBetOutcomes(plan.event, ["G18", "G19", "G20"]);
  if (!bb.length) throw new Error("no BlueBet outcomes");

  // ---- the chosen line, priced at TAB -----------------------------------
  const pyol = tabMarket(/^Pick Your Own Line$/i) ?? tabMarket(/^Line$/i);
  const wanted = (pyol?.propositions ?? []).find((p: any) => {
    const pts = Number(String(p.name).match(/-?[\d.]+/)?.[0]);
    const team = String(p.name).replace(/\s*[-+]?[\d.]+\s*$/, "").trim();
    return norm(team) === norm(plan.coreTeam) && Math.abs(pts - plan.corePoint) < 0.01;
  });
  if (!wanted) {
    throw new Error(`TAB no longer quotes ${plan.coreTeam} ${plan.corePoint > 0 ? "+" : ""}${plan.corePoint}`);
  }
  const corePrice = Number(wanted.returnWin);
  if (!Number.isFinite(corePrice) || corePrice <= 1.3) throw new Error(`bad core price ${corePrice}`);

  // ---- recompute the rating from the ladder, now -------------------------
  const rx = new RegExp(`^${plan.fav.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)\\+$`, "i");
  const favBands = parseMarginBands(
    bb.filter((o) => rx.test(o.name.trim())).map((o) => ({ name: o.name.trim(), price: o.price })),
  );
  if (favBands.length < 5) throw new Error(`${plan.fav} ladder has only ${favBands.length} band(s)`);

  const need = Math.ceil(Math.abs(plan.corePoint));
  const favCovers = coverProbabilityFromBands(favBands, need);
  if (favCovers === null) throw new Error(`ladder cannot rate a ${need}-point margin`);
  // The favourite giving start must win by more than the line; the underdog
  // receiving start wins whenever the favourite fails to cover.
  const model = norm(plan.coreTeam) === norm(plan.fav) ? favCovers : 1 - favCovers;
  if (model < MIN_WIN_PROBABILITY) {
    throw new Error(`rating fell to ${(model * 100).toFixed(1)}% — below a coin flip, not publishing`);
  }

  // ---- agreement gate against BlueBet's own line ------------------------
  const bbHandicaps = bb
    .filter((o) => o.betType === "HC" && norm(o.name) === norm(plan.coreTeam) && o.points !== 0)
    .sort((a, b) => a.points - b.points);
  let gateNote = "ungated (BlueBet quotes no comparable line)";
  if (bbHandicaps.length) {
    const exact = bbHandicaps.find((o) => Math.abs(o.points - plan.corePoint) < 0.01);
    let bbPrice: number | null = exact?.price ?? null;
    if (bbPrice === null) {
      const below = [...bbHandicaps].filter((o) => o.points < plan.corePoint).pop();
      const above = bbHandicaps.find((o) => o.points > plan.corePoint);
      if (below && above) {
        const t = (plan.corePoint - below.points) / (above.points - below.points);
        bbPrice = below.price + t * (above.price - below.price);
      } else {
        const nearest = bbHandicaps.reduce((a, b) =>
          Math.abs(b.points - plan.corePoint) < Math.abs(a.points - plan.corePoint) ? b : a);
        if (Math.abs(nearest.points - plan.corePoint) <= 6) bbPrice = nearest.price;
      }
    }
    if (bbPrice !== null) {
      const gap = Math.abs(1 / corePrice - 1 / bbPrice) * 100;
      if (gap > AGREEMENT_GATE_PCT) {
        throw new Error(`books now disagree ${gap.toFixed(1)}pp on ${plan.coreTeam} ${plan.corePoint} — not publishing`);
      }
      gateNote = `books agree within ${gap.toFixed(1)}pp`;
    }
  }

  const edge = (model - 1 / corePrice) * 100;
  const coreLabel = `${plan.coreTeam} ${plan.corePoint > 0 ? "+" : ""}${plan.corePoint}`;
  console.log(`  CORE  ${coreLabel.padEnd(26)} $${corePrice.toFixed(2)}  model ${(model * 100).toFixed(1)}%  ` +
    `edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%  [${gateNote}]`);

  const now = new Date().toISOString();
  const rows: any[] = [{
    fixture_id: fixture.id,
    model_version: MODEL_VERSION,
    market: "line",
    selection: plan.coreTeam,
    point: plan.corePoint,
    entry_odds: corePrice,
    entry_bookmaker: "tab",
    entry_captured_at: now,
    model_probability: Number(model.toFixed(4)),
    market_probability: Number((1 / corePrice).toFixed(4)),
    stake_units: 1,
    result_status: "pending",
    published: true,
    published_at: now,
  }];

  // ---- the multi, priced at the book -----------------------------------
  const anchor = bb.find((o) => o.betType === "HC" && norm(o.name) === norm(plan.anchorTeam));
  const scorer = bb.find((o) =>
    /^anytime tryscorer$/i.test(o.eventName) && norm(o.name) === norm(plan.scorer));

  if (!anchor) console.log(`  SGM   no handicap anchor for ${plan.anchorTeam}`);
  else if (!scorer) console.log(`  SGM   ${plan.scorer} is not quoted in the anytime market`);
  else {
    const price = await priceSgm(plan.event, [
      sgmLeg(anchor, "handicap", plan.label),
      sgmLeg(scorer, "try-scorer", plan.label),
    ]);
    if (price === null) console.log("  SGM   not priceable — skipped");
    else {
      const product = anchor.price * scorer.price;
      const ratio = price / product;
      if (ratio < 0.4 || ratio > 1.6) {
        console.log(`  SGM   price $${price.toFixed(2)} is ${ratio.toFixed(2)}x the leg product — rejected`);
      } else {
        const selection = `${plan.anchorTeam} ${anchor.points > 0 ? "+" : ""}${anchor.points} + ${scorer.name} anytime try`;
        console.log(`  SGM   ${selection.slice(0, 48).padEnd(49)} $${price.toFixed(2)}  (ratio ${ratio.toFixed(2)})`);
        rows.push({
          fixture_id: fixture.id,
          model_version: MODEL_VERSION,
          market: "sgm",
          selection,
          point: null,
          entry_odds: price,
          entry_bookmaker: "betr",
          entry_captured_at: now,
          model_probability: null,
          market_probability: Number((1 / price).toFixed(4)),
          stake_units: 1,
          result_status: "pending",
          published: true,
          published_at: now,
          __legs: [
            { leg_index: 0, market: "line", selection: plan.anchorTeam, point: anchor.points, leg_odds: anchor.price },
            { leg_index: 1, market: "anytime_try", selection: scorer.name, point: null, leg_odds: scorer.price },
          ],
        });
      }
    }
  }

  return rows;
}

async function main() {
  console.log(`Publishing RLWC Round 4 — semi-finals${DRY_RUN ? " (DRY RUN)" : ""}`);

  let written = 0;
  for (const plan of PLAN) {
    if (ONLY && plan.tabKey !== ONLY && plan.label !== ONLY) continue;
    let rows: any[];
    try {
      rows = await run(plan);
    } catch (e: any) {
      console.log(`  FAILED: ${e?.message ?? e}  — fixture skipped, nothing written`);
      continue;
    }
    if (!rows.length) continue;

    if (DRY_RUN) {
      console.log(`  (dry run: ${rows.length} pick(s) would be written)`);
      continue;
    }

    const legsBySelection = new Map<string, any[]>();
    const payload = rows.map((r) => {
      const { __legs, ...rest } = r;
      if (__legs) legsBySelection.set(r.selection, __legs);
      return rest;
    });

    const inserted = await supabase("picks", { method: "POST", body: JSON.stringify(payload) });
    written += inserted.length;
    console.log(`  wrote ${inserted.length} pick(s)`);

    for (const [selection, legs] of legsBySelection) {
      const pick = inserted.find((p: any) => p.selection === selection);
      if (!pick) throw new Error(`could not locate written pick for ${selection}`);
      await supabase("pick_legs", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(legs.map((l: any) => ({ ...l, pick_id: pick.id }))),
      });
      console.log("  legs written for the multi");
    }
  }

  console.log(`\n${DRY_RUN ? "DRY RUN complete." : `Done — ${written} pick(s) published.`}`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
