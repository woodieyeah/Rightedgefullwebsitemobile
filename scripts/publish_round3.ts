/**
 * Publish the Round 3 card: five fixtures, each with a core play and a
 * same-game multi. No try-scorer singles — that product was scrapped after
 * being proven to rank purely on price.
 *
 * Every price is read live at write time; nothing is carried from the survey.
 *
 * LESSONS APPLIED FROM ROUNDS 1-2
 * - A handicap is rated off the book's own cumulative margin ladder
 *   ("England 13+"), never from the projected scoreline, which is solved from
 *   the handicap and therefore circular.
 * - TAB's margin markets are BANDED ranges whose top band is open ("by 19+").
 *   They cannot rate a line deeper than that floor. Attempting it with a
 *   guessed tail produced +45% phantom edges on deep underdog lines. Only
 *   BlueBet's cumulative ladder is used for rating.
 * - A ladder must be checked for usability before it is trusted: England v
 *   PNG quotes only 67+/73+/91+, so every line from -46.5 to -60.5 fell below
 *   its floor and returned one flat probability. That fixture gets a total
 *   instead of a line.
 * - Australia v Cook Islands' TAB Super Margin prices the entire underdog
 *   ladder at a flat $501 — a placeholder, 149% book. Rejected, not modelled.
 * - Every rating passes a two-book agreement gate. BlueBet carries the
 *   handicap in `Points` with `BetDetailTypeCode: "HC"`, not in the outcome
 *   name; reading the name found nothing and silently skipped the gate.
 * - A multi's price comes only from the book's endpoint, never from
 *   multiplying legs, and $101 with ErrorNo 0 is a refusal sentinel.
 * - The selection stores the bare team name; `point` carries the handicap and
 *   the card appends it once at render time.
 *
 * Usage:
 *   npx tsx scripts/publish_round3.ts [--dry-run] [--only "Tonga v Samoa"]
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

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
/**
 * Two-book agreement tolerance, in percentage points of implied probability.
 *
 * 5pp rejected Tonga -2.5 @ $2.05 (51.1%, +2.3% edge) by 0.3pp: BlueBet
 * quotes only Tonga -1.5 at $1.85, a 5.3pp gap, because the two books hang
 * their single handicap on different points rather than disagreeing about the
 * match. 6pp keeps the gate's purpose — it still rejects the kind of
 * cross-market mismatch that produced the fake +34% Under 44.5 last round —
 * while allowing a one-point line offset between books.
 */
const AGREEMENT_GATE_PCT = 6;
const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;
/** A play must be at least a coin flip to be worth a subscriber's stake. */
const MIN_WIN_PROBABILITY = 0.5;
/** A usable cumulative ladder needs real depth, not three sparse bands. */
const MIN_LADDER_BANDS = 5;

interface Plan {
  tabKey: string;
  matchKey: string;
  label: string;
  event: number;
  fav: string;
  dog: string;
}

const PLAN: Plan[] = [
  { tabKey: "England v PNG", matchKey: "england__papuanewguinea", label: "England v Papua New Guinea",
    event: 2317855, fav: "England", dog: "Papua New Guinea" },
  { tabKey: "New Zealand v Fiji", matchKey: "fiji__newzealand", label: "New Zealand v Fiji",
    event: 2318638, fav: "New Zealand", dog: "Fiji" },
  { tabKey: "Australia v Cook Islands", matchKey: "australia__cookislands", label: "Australia v Cook Islands",
    event: 2318631, fav: "Australia", dog: "Cook Islands" },
  { tabKey: "Lebanon v France", matchKey: "france__lebanon", label: "Lebanon v France",
    event: 2317899, fav: "Lebanon", dog: "France" },
  { tabKey: "Tonga v Samoa", matchKey: "samoa__tonga", label: "Tonga v Samoa",
    event: 2317839, fav: "Tonga", dog: "Samoa" },
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
  name: string;
  price: number;
  points: number;
  betType: string;
  marketDesc: string;
  eventName: string;
  fixedMarketId: number;
  eventId: number;
  outcomeId: number;
  team: string;
}

/**
 * Flatten a BlueBet MasterEvent response into priced outcomes.
 *
 * The market a player outcome belongs to is carried by the nearest ancestor's
 * `EventName` ("Anytime Tryscorer", "First Tryscorer", "Player To Score 2
 * Tries"), NOT by `MarketDesc` — every try-scorer outcome reports MarketDesc
 * "Win", so filtering on it found nothing and silently dropped every multi.
 * `PlayerTeamName` carries the player's country.
 */
function collectBb(node: any, out: BbOutcome[] = [], eventName = ""): BbOutcome[] {
  if (!node || typeof node !== "object") return out;
  const ev = node.EventName ?? eventName;
  const price = Number(node.Price);
  const name = node.OutcomeName;
  if (name && Number.isFinite(price) && price > 1) {
    out.push({
      name: String(name),
      price,
      points: Number(node.Points ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      marketDesc: String(node.MarketDesc ?? ""),
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
      const d = await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, UA_BB);
      all.push(...collectBb(d));
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

/**
 * Price a same-game multi at the book's own endpoint.
 *
 * The endpoint needs a FULL leg descriptor — EventId, OutcomeId, MarketType
 * and FixedMarketId: 0 — exactly as Round 2 sent. Posting a bare
 * `{FixedMarketId: n}` returns ErrorNo 4503 ("Object reference not set"),
 * which is a malformed-request error, NOT the book refusing the combination.
 * Mistaking one for the other would silently drop every multi.
 */
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
    // Surface a malformed request rather than treating it as a refusal.
    if (d.ErrorNo !== 4502) console.log(`      SGM endpoint error ${d.ErrorNo}: ${String(d.Message ?? "").slice(0, 90)}`);
    return null;
  }
  if (!d.Price) return null;
  const price = Number(d.Price);
  if (price === SGM_SENTINEL) return null;
  if (price < MIN_SGM_PRICE) return null;
  return price;
}

/** Build the leg descriptor the SGM endpoint expects. */
function sgmLeg(o: BbOutcome, kind: "line" | "try", label: string, point: number) {
  return kind === "line"
    ? {
        EventId: o.eventId, OutcomeId: o.outcomeId, MarketType: "WIN",
        FixedWin: o.price, FixedMarketId: 0,
        MarketTypeDesc: `Match Result (${label})`, GroupByHeader: "Match Result",
        Points: point, BetDetailTypeCode: "W", OutcomeName: `${o.name} ${point}`,
      }
    : {
        EventId: o.eventId, OutcomeId: o.outcomeId, MarketType: "TSCORER",
        FixedWin: o.price, FixedMarketId: 0,
        MarketTypeDesc: `Anytime Tryscorer (${label})`, GroupByHeader: "Anytime Tryscorer",
        Points: 0, BetDetailTypeCode: "TS", OutcomeName: o.name,
      };
}

interface CoreCandidate {
  market: "line" | "total";
  selection: string;
  point: number | null;
  price: number;
  model: number;
  bookmaker: string;
  gateNote: string;
}

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

  // ---- live markets ----------------------------------------------------
  const tab = await getJson(`${TAB_BASE}/${encodeURIComponent(plan.tabKey)}?jurisdiction=NSW`, UA_TAB);
  const tabMarket = (re: RegExp) => (tab.markets ?? []).find((m: any) => re.test(m.betOption ?? m.name ?? ""));

  const bb = await blueBetOutcomes(plan.event, ["G18", "G19", "G20", "G80", "G554"]);
  if (!bb.length) throw new Error("no BlueBet outcomes");

  // ---- the rating ladder ------------------------------------------------
  const ladderFor = (team: string) => {
    const rx = new RegExp(`^${team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)\\+$`, "i");
    return parseMarginBands(
      bb.filter((o) => rx.test(o.name.trim())).map((o) => ({ name: o.name.trim(), price: o.price })),
    );
  };
  const favBands = ladderFor(plan.fav);
  console.log(`  ${plan.fav} cumulative ladder: ${favBands.length} band(s)` +
    (favBands.length ? ` (${Math.min(...favBands.map((b) => b.threshold))}+ to ${Math.max(...favBands.map((b) => b.threshold))}+)` : ""));

  const candidates: CoreCandidate[] = [];

  // ---- line candidates, rated off the ladder, gated against BlueBet ----
  if (favBands.length >= MIN_LADDER_BANDS) {
    const bbHandicaps = bb.filter((o) => o.betType === "HC" && o.points !== 0);
    const pyol = tabMarket(/^Pick Your Own Line$/i) ?? tabMarket(/^Line$/i);

    for (const p of pyol?.propositions ?? []) {
      const pts = Number(String(p.name).match(/-?[\d.]+/)?.[0]);
      const price = Number(p.returnWin);
      if (!Number.isFinite(pts) || !Number.isFinite(price) || price < 1.3) continue;
      const team = String(p.name).replace(/\s*[-+]?[\d.]+\s*$/, "").trim();
      const isFav = norm(team) === norm(plan.fav) || norm(plan.fav).startsWith(norm(team));
      const isDog = norm(team) === norm(plan.dog) || norm(plan.dog).startsWith(norm(team));
      if (!isFav && !isDog) continue;

      const need = Math.ceil(Math.abs(pts));
      let model: number | null = null;
      if (isFav && pts < 0) model = coverProbabilityFromBands(favBands, need);
      else if (isDog && pts > 0) {
        const favCovers = coverProbabilityFromBands(favBands, need);
        model = favCovers === null ? null : 1 - favCovers;
      } else continue;
      if (model === null || model < MIN_WIN_PROBABILITY) continue;

      // Agreement gate: BlueBet's own handicap for this team, interpolated
      // onto TAB's point. BlueBet carries the line in `Points`.
      const sameTeam = bbHandicaps
        .filter((o) => norm(o.name) === norm(team))
        .sort((a, b) => a.points - b.points);
      let gateNote = "ungated (BlueBet quotes no comparable line)";
      if (sameTeam.length) {
        const exact = sameTeam.find((o) => Math.abs(o.points - pts) < 0.01);
        let bbPrice: number | null = exact?.price ?? null;
        if (bbPrice === null) {
          const below = [...sameTeam].filter((o) => o.points < pts).pop();
          const above = sameTeam.find((o) => o.points > pts);
          if (below && above) {
            const t = (pts - below.points) / (above.points - below.points);
            bbPrice = below.price + t * (above.price - below.price);
          } else {
            // Only one side available: compare to the nearest quoted line and
            // require it to be close, otherwise it is not a fair comparison.
            const nearest = sameTeam.reduce((a, b) =>
              Math.abs(b.points - pts) < Math.abs(a.points - pts) ? b : a);
            if (Math.abs(nearest.points - pts) <= 6) bbPrice = nearest.price;
          }
        }
        if (bbPrice !== null) {
          const gap = Math.abs(1 / price - 1 / bbPrice) * 100;
          if (gap > AGREEMENT_GATE_PCT) continue;   // books disagree: reject
          gateNote = `books agree within ${gap.toFixed(1)}pp`;
        }
      }

      candidates.push({
        market: "line",
        selection: team,
        point: pts,
        price,
        model,
        bookmaker: "tab",
        gateNote,
      });
    }
  } else {
    console.log(`  ladder too sparse to rate a handicap — falling back to the total`);
  }

  // ---- total candidates: a complete two-outcome market, de-vigged -------
  const totalMkt = tabMarket(/^Total Points Over\/Under$/i);
  const over = (totalMkt?.propositions ?? []).find((p: any) => /^Over/i.test(p.name));
  const under = (totalMkt?.propositions ?? []).find((p: any) => /^Under/i.test(p.name));
  if (over && under) {
    const line = Number(String(over.name).match(/[\d.]+/)?.[0] ?? NaN);
    const io = 1 / Number(over.returnWin);
    const iu = 1 / Number(under.returnWin);
    const book = io + iu;
    if (Number.isFinite(line) && book > 0) {
      // BlueBet's matching total, if it quotes the same line, supplies the gate.
      const bbTotals = bb.filter((o) => /over|under/i.test(o.name) && Math.abs(o.points - line) < 0.01);
      const bbOver = bbTotals.find((o) => /over/i.test(o.name));
      const bbUnder = bbTotals.find((o) => /under/i.test(o.name));

      for (const [side, prop, fair] of [
        ["Over", over, io / book],
        ["Under", under, iu / book],
      ] as const) {
        if (fair < MIN_WIN_PROBABILITY) continue;
        let gateNote = "ungated (BlueBet quotes no matching total line)";
        if (bbOver && bbUnder) {
          const bbBook = 1 / bbOver.price + 1 / bbUnder.price;
          const bbFair = (side === "Over" ? 1 / bbOver.price : 1 / bbUnder.price) / bbBook;
          const gap = Math.abs(fair - bbFair) * 100;
          if (gap > AGREEMENT_GATE_PCT) continue;
          gateNote = `books agree within ${gap.toFixed(1)}pp`;
        }
        candidates.push({
          market: "total",
          selection: `${side} ${line}`,
          point: line,
          price: Number(prop.returnWin),
          model: fair,
          bookmaker: "tab",
          gateNote,
        });
      }
    }
  }

  if (!candidates.length) throw new Error("no candidate passed the gate — nothing to publish");

  // The core play is the highest-edge option that is at least a coin flip.
  candidates.sort((a, b) => (b.model - 1 / b.price) - (a.model - 1 / a.price));
  const core = candidates[0];
  const coreEdge = (core.model - 1 / core.price) * 100;
  const coreLabel = core.market === "line"
    ? `${core.selection} ${core.point! > 0 ? "+" : ""}${core.point}`
    : core.selection;
  console.log(`  ${candidates.length} candidate(s) passed the gate`);
  console.log(`  CORE  ${coreLabel.padEnd(28)} $${core.price.toFixed(2)}  ` +
    `model ${(core.model * 100).toFixed(1)}%  edge ${coreEdge >= 0 ? "+" : ""}${coreEdge.toFixed(1)}%  [${core.gateNote}]`);

  const now = new Date().toISOString();
  const rows: any[] = [{
    fixture_id: fixture.id,
    model_version: MODEL_VERSION,
    market: core.market,
    selection: core.selection,
    point: core.point,
    entry_odds: core.price,
    entry_bookmaker: core.bookmaker,
    entry_captured_at: now,
    model_probability: Number(core.model.toFixed(4)),
    market_probability: Number((1 / core.price).toFixed(4)),
    stake_units: 1,
    result_status: "pending",
    published: true,
    published_at: now,
  }];

  // ---- the same-game multi ---------------------------------------------
  // Two legs beat three, and a forward or middle leg beats a second winger.
  // The anchor is the favourite's own BlueBet handicap so both legs come from
  // one book and the combination is priceable. BlueBet quotes a single
  // handicap per team (`Points`, BetDetailTypeCode "HC"), so there is exactly
  // one anchor rather than a ladder to choose from.
  const anchor = bb
    .filter((o) => o.betType === "HC" && norm(o.name) === norm(plan.fav) && o.points < 0)
    .sort((a, b) => b.points - a.points)[0];

  // Only the ANYTIME market is a real scoring leg; "First Tryscorer" and
  // "Player To Score 2 Tries" are different, much harder bets.
  const scorers = bb
    .filter((o) => /^anytime tryscorer$/i.test(o.eventName))
    .filter((o) => o.price >= 1.6 && o.price <= 4.5 && o.fixedMarketId > 0)
    .sort((a, b) => a.price - b.price);

  console.log(`  multi inputs: anchor ${anchor ? `${anchor.name} ${anchor.points} $${anchor.price}` : "none"}, ` +
    `${scorers.length} anytime scorer(s) in range`);

  if (anchor && scorers.length) {
    let chosen: { price: number; scorer: BbOutcome } | null = null;
    for (const scorer of scorers.slice(0, 8)) {
      const price = await priceSgm(plan.event, [
        sgmLeg(anchor, "line", plan.label, anchor.points),
        sgmLeg(scorer, "try", plan.label, 0),
      ]);
      if (price === null) continue;
      // Reject a price far from the leg product: a large gap means the book
      // is not pricing the combination we think it is.
      const product = anchor.price * scorer.price;
      const ratio = price / product;
      if (ratio < 0.4 || ratio > 1.6) continue;
      chosen = { price, scorer };
      break;
    }

    if (chosen) {
      const selection = `${plan.fav} ${anchor.points} + ${chosen.scorer.name} anytime try`;
      console.log(`  SGM   ${selection.slice(0, 46).padEnd(47)} $${chosen.price.toFixed(2)}`);
      rows.push({
        fixture_id: fixture.id,
        model_version: MODEL_VERSION,
        market: "sgm",
        selection,
        point: null,
        entry_odds: chosen.price,
        entry_bookmaker: "betr",
        entry_captured_at: now,
        model_probability: null,
        market_probability: Number((1 / chosen.price).toFixed(4)),
        stake_units: 1,
        result_status: "pending",
        published: true,
        published_at: now,
        __legs: [
          { leg_index: 0, market: "line", selection: plan.fav, point: anchor.points, leg_odds: anchor.price },
          { leg_index: 1, market: "anytime_try", selection: chosen.scorer.name, point: null, leg_odds: chosen.scorer.price },
        ],
      });
    } else {
      console.log(`  SGM   no priceable two-leg combination (all refused or out of range)`);
    }
  } else {
    console.log(`  SGM   no anchor handicap or try-scorer market at BlueBet`);
  }

  return rows;
}

async function main() {
  console.log(`Publishing RLWC Round 3${DRY_RUN ? " (DRY RUN)" : ""}`);

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
      console.log(`  legs written for the multi`);
    }
  }

  console.log(`\n${DRY_RUN ? "DRY RUN complete." : `Done — ${written} pick(s) published.`}`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
