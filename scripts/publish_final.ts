/**
 * Publish the grand final card: one core play and one same-game multi.
 *
 * SELECTION REASONING
 * Nothing on this market rates positive — it is the tightest card of the
 * tournament. New Zealand +8.5 and Australia -2.5 both rate -1.1%, so the
 * choice is a side, not a number: +8.5 wins 64.7% of the time against -2.5's
 * 54.4%. An underdog receiving start is also the shape that has paid (France
 * +31.5 won in Round 3) while deep favourite margins lost twice by half a
 * point (Australia -66.5 when they won by 60, Tonga -2.5 when they won by 2).
 *
 * The multi anchors on the SAME side as the core play. Round 2 shipped a
 * multi contradicting its own core and it had to be rebuilt.
 *
 * The prices here are re-read live at write time and the rating recomputed
 * from the book's cumulative ladder; the script fails closed if the line is
 * no longer quoted, the ladder cannot rate it, or the books have drifted
 * outside the 6pp agreement gate.
 *
 * RATE LIMITING
 * Betr's SGM endpoint returns HTTP 429 after sustained use, and a 429 is NOT
 * a refusal — surveying it hard made every Australia combination look
 * declined when it was simply throttled. priceSgm retries on 429 with a long
 * backoff and reports the HTTP status so the two can never be confused.
 *
 * Usage: npx tsx scripts/publish_final.ts [--dry-run]
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";
import { buildSgmLeg, type SgmOutcome } from "../src/model/sgm-legs.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const TAB_BASE = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BB_BASE = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";

const MODEL_VERSION = "rlwc-consensus-v1";
const AGREEMENT_GATE_PCT = 6;
const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;
const MIN_WIN_PROBABILITY = 0.5;

const MATCH_KEY = "australia__newzealand__f";
const TAB_KEY = "Australia v New Zealand";
const LABEL = "Australia v New Zealand";
const EVENT = 2332757;
/** The team whose cumulative ladder rates this fixture. */
const FAV = "Australia";

/** The core play, as decided. */
const CORE_TEAM = "New Zealand";
const CORE_POINT = 8.5;
/** The multi: same side as the core play. */
const ANCHOR_TEAM = "New Zealand";
const ANCHOR_POINT = 8.5;
const SCORER = "Kalyn Ponga";

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

interface Out extends SgmOutcome {
  betType: string;
  eventName: string;
  team: string;
}

function collect(node: any, out: Out[] = [], ev = ""): Out[] {
  if (!node || typeof node !== "object") return out;
  const e = node.EventName ?? ev;
  const price = Number(node.Price);
  const name = node.OutcomeName;
  if (name && Number.isFinite(price) && price > 1) {
    out.push({
      name: String(name), price,
      points: Number(node.Points ?? 0),
      eventId: Number(node.EventId ?? 0),
      outcomeId: Number(node.OutcomeId ?? 0),
      // Handicap starts share an EventId and OutcomeId and differ ONLY by
      // FixedMarketId; dropping it collapses every start to one price.
      fixedMarketId: Number(node.FixedMarketId ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      eventName: String(e ?? ""),
      team: String(node.PlayerTeamName ?? ""),
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, out, String(e ?? ""));
  return out;
}

/**
 * Price a combination, treating HTTP 429 as "retry", never as a refusal.
 */
async function priceSgm(markets: any[]): Promise<number | null> {
  const backoffMs = [0, 20_000, 60_000, 120_000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt]) {
      console.log(`      rate limited; waiting ${backoffMs[attempt] / 1000}s before retry`);
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
    const res = await fetch(SGM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", Accept: "application/json",
        "User-Agent": UA_BB, Origin: "https://www.betr.com.au",
        Referer: "https://www.betr.com.au/",
      },
      body: JSON.stringify({ MasterEventID: EVENT, Markets: markets }),
    });
    if (res.status === 429) continue;
    const d = await res.json().catch(() => null);
    if (!d) throw new Error(`SGM endpoint returned HTTP ${res.status} with no body`);
    if (d.ErrorNo !== 0) {
      throw new Error(`SGM endpoint declined: ErrorNo ${d.ErrorNo} ${String(d.Message ?? "").slice(0, 80)}`);
    }
    const price = Number(d.Price);
    if (!Number.isFinite(price) || !price) throw new Error("SGM endpoint returned no price");
    if (price === SGM_SENTINEL) throw new Error("SGM returned the $101 refusal sentinel");
    if (price < MIN_SGM_PRICE) throw new Error(`SGM price $${price} is too short to publish`);
    return price;
  }
  throw new Error("SGM endpoint stayed rate limited (HTTP 429) through every retry");
}

async function main() {
  console.log(`Publishing the RLWC grand final${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(
    `fixtures?match_key=eq.${MATCH_KEY}&select=id,home_team,away_team,kickoff_at,round_number`,
  ))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY} — run scripts/seed_grand_final.ts first`);
  if (fixture.round_number !== 5) throw new Error(`${MATCH_KEY} is round ${fixture.round_number}, not the final`);

  const existing = await supabase(`picks?fixture_id=eq.${fixture.id}&select=id`);
  if (existing?.length) { console.log(`  ${existing.length} pick(s) already published — nothing to do.`); return; }

  // ---- live markets ----------------------------------------------------
  const tab = await getJson(`${TAB_BASE}/${encodeURIComponent(TAB_KEY)}?jurisdiction=NSW`, UA_TAB);
  const tabMarket = (re: RegExp) => (tab.markets ?? []).find((m: any) => re.test(m.betOption ?? m.name ?? ""));

  const bb: Out[] = [];
  for (const code of ["G18", "G19", "G20"]) {
    try { bb.push(...collect(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${EVENT}&GroupTypeCode=${code}&format=json`, UA_BB))); } catch { /* group may be absent */ }
  }
  if (!bb.length) throw new Error("no BlueBet outcomes");

  // ---- the chosen line, priced at TAB ----------------------------------
  const pyol = tabMarket(/^Pick Your Own Line$/i) ?? tabMarket(/^Line$/i);
  const wanted = (pyol?.propositions ?? []).find((p: any) => {
    const pts = Number(String(p.name).match(/-?[\d.]+/)?.[0]);
    const team = String(p.name).replace(/\s*[-+]?[\d.]+\s*$/, "").trim();
    return norm(team) === norm(CORE_TEAM) && Math.abs(pts - CORE_POINT) < 0.01;
  });
  if (!wanted) throw new Error(`TAB no longer quotes ${CORE_TEAM} +${CORE_POINT}`);
  const corePrice = Number(wanted.returnWin);
  if (!Number.isFinite(corePrice) || corePrice <= 1.3) throw new Error(`bad core price ${corePrice}`);

  // ---- recompute the rating from the ladder, now ------------------------
  const rx = new RegExp(`^${FAV.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)\\+$`, "i");
  const favBands = parseMarginBands(
    bb.filter((o) => rx.test(o.name.trim())).map((o) => ({ name: o.name.trim(), price: o.price })),
  );
  if (favBands.length < 5) throw new Error(`${FAV} ladder has only ${favBands.length} band(s)`);

  const favCovers = coverProbabilityFromBands(favBands, Math.ceil(Math.abs(CORE_POINT)));
  if (favCovers === null) throw new Error("the ladder cannot rate this line");
  // The underdog receiving start wins whenever the favourite fails to cover.
  const model = norm(CORE_TEAM) === norm(FAV) ? favCovers : 1 - favCovers;
  if (model < MIN_WIN_PROBABILITY) {
    throw new Error(`rating fell to ${(model * 100).toFixed(1)}% — below a coin flip, not publishing`);
  }

  // ---- agreement gate --------------------------------------------------
  const bbHandicaps = bb
    .filter((o) => o.betType === "HC" && norm(o.name) === norm(CORE_TEAM) && o.points !== 0)
    .sort((a, b) => a.points - b.points);
  let gateNote = "ungated (BlueBet quotes no comparable line)";
  if (bbHandicaps.length) {
    const exact = bbHandicaps.find((o) => Math.abs(o.points - CORE_POINT) < 0.01);
    let bbPrice: number | null = exact?.price ?? null;
    if (bbPrice === null) {
      const below = [...bbHandicaps].filter((o) => o.points < CORE_POINT).pop();
      const above = bbHandicaps.find((o) => o.points > CORE_POINT);
      if (below && above) {
        const t = (CORE_POINT - below.points) / (above.points - below.points);
        bbPrice = below.price + t * (above.price - below.price);
      } else {
        const nearest = bbHandicaps.reduce((a, b) =>
          Math.abs(b.points - CORE_POINT) < Math.abs(a.points - CORE_POINT) ? b : a);
        if (Math.abs(nearest.points - CORE_POINT) <= 6) bbPrice = nearest.price;
      }
    }
    if (bbPrice !== null) {
      const gap = Math.abs(1 / corePrice - 1 / bbPrice) * 100;
      if (gap > AGREEMENT_GATE_PCT) {
        throw new Error(`books now disagree ${gap.toFixed(1)}pp on ${CORE_TEAM} +${CORE_POINT} — not publishing`);
      }
      gateNote = `books agree within ${gap.toFixed(1)}pp`;
    }
  }

  const edge = (model - 1 / corePrice) * 100;
  console.log(`  CORE  ${`${CORE_TEAM} +${CORE_POINT}`.padEnd(26)} $${corePrice.toFixed(2)}  ` +
    `model ${(model * 100).toFixed(1)}%  edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%  [${gateNote}]`);

  const now = new Date().toISOString();
  const rows: any[] = [{
    fixture_id: fixture.id,
    model_version: MODEL_VERSION,
    market: "line",
    selection: CORE_TEAM,
    point: CORE_POINT,
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

  // ---- the multi -------------------------------------------------------
  const anchor = bb.find((o) =>
    o.betType === "HC" && norm(o.name) === norm(ANCHOR_TEAM) &&
    Math.abs(o.points - ANCHOR_POINT) < 0.01);
  if (!anchor) throw new Error(`${ANCHOR_TEAM} +${ANCHOR_POINT} is no longer quoted at BlueBet`);
  if (norm(ANCHOR_TEAM) !== norm(CORE_TEAM)) {
    throw new Error(`the multi anchor ${ANCHOR_TEAM} contradicts the core play ${CORE_TEAM}`);
  }

  const scorer = bb.find((o) =>
    /^anytime tryscorer$/i.test(o.eventName) && norm(o.name) === norm(SCORER));
  if (!scorer) throw new Error(`${SCORER} is not quoted in the anytime market`);
  if (norm(scorer.team) !== norm(ANCHOR_TEAM)) {
    throw new Error(`${SCORER} is listed under ${scorer.team || "no team"}, not ${ANCHOR_TEAM}`);
  }

  const price = await priceSgm([
    buildSgmLeg(anchor, "handicap", LABEL),
    buildSgmLeg(scorer, "try-scorer", LABEL),
  ]);
  if (price === null) throw new Error("no SGM price");

  const product = anchor.price * scorer.price;
  const ratio = price / product;
  if (ratio < 0.4 || ratio > 1.6) {
    throw new Error(`SGM price $${price.toFixed(2)} is ${ratio.toFixed(2)}x the leg product — rejected`);
  }

  const selection = `${ANCHOR_TEAM} +${anchor.points} + ${scorer.name} anytime try`;
  console.log(`  SGM   ${selection.slice(0, 44).padEnd(45)} $${price.toFixed(2)}  (ratio ${ratio.toFixed(2)})`);

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
      { leg_index: 0, market: "line", selection: ANCHOR_TEAM, point: anchor.points, leg_odds: anchor.price },
      { leg_index: 1, market: "anytime_try", selection: scorer.name, point: null, leg_odds: scorer.price },
    ],
  });

  if (DRY_RUN) { console.log(`\n  DRY RUN: ${rows.length} pick(s) would be written.`); return; }

  const legsBySelection = new Map<string, any[]>();
  const payload = rows.map((r) => {
    const { __legs, ...rest } = r;
    if (__legs) legsBySelection.set(r.selection, __legs);
    return rest;
  });

  const inserted = await supabase("picks", { method: "POST", body: JSON.stringify(payload) });
  console.log(`\n  wrote ${inserted.length} pick(s)`);

  for (const [selection, legs] of legsBySelection) {
    const pick = inserted.find((p: any) => p.selection === selection);
    if (!pick) throw new Error(`could not locate the written pick for ${selection}`);
    await supabase("pick_legs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(legs.map((l: any) => ({ ...l, pick_id: pick.id }))),
    });
    console.log("  legs written for the multi");
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
