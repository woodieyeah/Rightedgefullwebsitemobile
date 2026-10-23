/**
 * Publish the Round 2 card: five fixtures, each with a core play, three try
 * scorers and a same-game multi.
 *
 * Every price is read live at write time. Nothing is carried over from an
 * earlier survey, because prices move — Tonga shortened 1.67 to 1.62 inside a
 * few hours last round, and the Tonga multi moved 5.00 to 4.90 between
 * planning and publishing.
 *
 * LESSONS APPLIED FROM ROUND 1
 * - The market's headline line is not automatically the play. Fiji -17.5
 *   rated 47.3% while -8.5 rated 66.6%, so every quoted line is rated off the
 *   winning-margin ladder and the best is chosen.
 * - The handicap cannot be rated from the projected scoreline, which is
 *   derived from the handicap. The ladder is an independent market.
 * - A multi's price comes from the book's own endpoint, never from
 *   multiplying legs, and $101 is BlueBet's maximum-payout sentinel rather
 *   than a real quote.
 * - A player listed "Reserve" has not been named in the matchday 17, so his
 *   try-scorer bet would be refunded rather than lost. Those are skipped.
 * - The selection stores the bare team name; `point` carries the handicap and
 *   the card appends it at render time.
 *
 * Usage:
 *   npx tsx scripts/publish_round2.ts [--dry-run] [--only "Tonga v Lebanon"]
 */
import { devigAnytimeTryMarket } from "../src/model/devig-try-market.ts";
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
const NRL_BASE = "https://www.nrl.com/draw/rugby-league-world-cup/2026/round-2";

const MODEL_VERSION = "rlwc-consensus-v1";
const AGREEMENT_GATE_PCT = 5;
/** BlueBet returns its maximum payout instead of refusing to price a multi. */
const SGM_SENTINEL = 101;
/** A multi shorter than this is not worth publishing as a product. */
const MIN_SGM_PRICE = 1.45;

interface Plan {
  tabKey: string;
  matchKey: string;
  label: string;
  event: number;
  fav: string;
  dog: string;
  nrlSlug: string;
}

const PLAN: Plan[] = [
  { tabKey: "Tonga v Lebanon", matchKey: "lebanon__tonga", label: "Tonga v Lebanon",
    event: 2311016, fav: "Tonga", dog: "Lebanon", nrlSlug: "tonga-v-lebanon" },
  { tabKey: "PNG v Samoa", matchKey: "papuanewguinea__samoa", label: "Papua New Guinea v Samoa",
    event: 2310502, fav: "Samoa", dog: "Papua New Guinea", nrlSlug: "papua-new-guinea-v-samoa" },
  { tabKey: "England v France", matchKey: "england__france", label: "England v France",
    event: 2311019, fav: "England", dog: "France", nrlSlug: "england-v-france" },
  { tabKey: "New Zealand v Cook Islands", matchKey: "cookislands__newzealand", label: "New Zealand v Cook Islands",
    event: 2311425, fav: "New Zealand", dog: "Cook Islands", nrlSlug: "new-zealand-v-cook-islands" },
  { tabKey: "Australia v Fiji", matchKey: "australia__fiji", label: "Australia v Fiji",
    event: 2311433, fav: "Australia", dog: "Fiji", nrlSlug: "australia-v-fiji" },
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

/** Fetch with retries: TAB's HTTP/2 endpoint resets intermittently. */
async function getJson(url: string, ua: string, attempts = 3): Promise<any> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(`${url.slice(0, 70)} failed: ${(lastError as Error)?.message ?? lastError}`);
}

async function getText(url: string, ua: string, attempts = 3): Promise<string> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(`${url.slice(0, 70)} failed: ${(lastError as Error)?.message ?? lastError}`);
}

const walk = (n: any, ev = "", id = 0, out: any[] = []): any[] => {
  if (!n || typeof n !== "object") return out;
  const name = n.EventName ?? ev;
  const eid = n.EventId ?? id;
  if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name, EventId: eid });
  for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, eid, out);
  return out;
};

const bbGroup = async (event: number, code: string) =>
  walk(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, UA_BB));

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
  if (!d || d.ErrorNo !== 0 || !d.Price) return null;
  const price = Number(d.Price);
  // BlueBet answers an unpriceable combination with its maximum payout and
  // ErrorNo 0, so a sentinel must be rejected explicitly or it would publish
  // as a $101 multi.
  if (price === SGM_SENTINEL) return null;
  if (price < MIN_SGM_PRICE) return null;
  return price;
}

async function run(plan: Plan) {
  console.log(`\n${"=".repeat(72)}\n${plan.label}\n${"=".repeat(72)}`);

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
  const market = (re: RegExp) => (tab.markets ?? []).find((m: any) => re.test(m.betOption ?? m.name ?? ""));

  const h2h = market(/^Head To Head$/i);
  const favH2h = h2h?.propositions?.find((p: any) => norm(p.name) === norm(plan.fav) || p.name.startsWith(plan.fav));
  const dogH2h = h2h?.propositions?.find((p: any) => p !== favH2h);
  const overProp = market(/^Total Points Over\/Under$/i)?.propositions?.find((p: any) => /^Over/i.test(p.name));
  const totalPts = Number(String(overProp?.name ?? "").match(/[\d.]+/)?.[0]);
  if (!Number.isFinite(totalPts)) throw new Error("no total points line");

  const g18 = await bbGroup(plan.event, "G18");
  const g19 = await bbGroup(plan.event, "G19");
  const g20 = await bbGroup(plan.event, "G20");

  const bbFav = g18.find((o) => /^Match Result/i.test(o.EventName) && Number(o.Points) === 0 && norm(o.OutcomeName) === norm(plan.fav));
  const bbDog = g18.find((o) => /^Match Result/i.test(o.EventName) && Number(o.Points) === 0 && norm(o.OutcomeName) !== norm(plan.fav));

  // ---- book agreement gate --------------------------------------------
  if (favH2h?.returnWin && bbFav?.Price) {
    const gap = Math.abs(Number(favH2h.returnWin) - Number(bbFav.Price)) / Number(favH2h.returnWin) * 100;
    console.log(`  h2h  TAB $${favH2h.returnWin} / BlueBet $${bbFav.Price}   gap ${gap.toFixed(2)}%`);
    if (gap > AGREEMENT_GATE_PCT) throw new Error(`books disagree ${gap.toFixed(1)}% on the head to head`);
  }

  // ---- rate every quoted line off the favourite's margin ladder --------
  const seen = new Map<number, number>();
  for (const o of g19) {
    const m = String(o.OutcomeName).match(new RegExp(`^${plan.fav}\\s+(\\d+)\\+$`));
    if (m && !seen.has(Number(m[1]))) seen.set(Number(m[1]), Number(o.Price));
  }
  const bands = parseMarginBands([...seen.entries()].map(([t, p]) => ({ name: `${plan.fav} ${t}+`, price: p })));
  if (bands.length < 2) throw new Error(`${plan.fav} margin ladder too thin (${bands.length} bands)`);

  const pyol = market(/^Pick Your Own Line$/i);
  const tabLines = (pyol?.propositions ?? [])
    .filter((p: any) => p.name.startsWith(plan.fav))
    .map((p: any) => ({ points: Number(String(p.name).match(/-?[\d.]+/)?.[0]), price: Number(p.returnWin), book: "TAB" }))
    .filter((x: any) => Number.isFinite(x.points) && x.points < 0);
  const bbLines = g18
    .filter((o) => /^Match Result/i.test(o.EventName) && norm(o.OutcomeName) === norm(plan.fav) && Number(o.Points) < 0)
    .map((o) => ({ points: Number(o.Points), price: Number(o.Price), book: "BlueBet" }));

  const best = new Map<number, { price: number; book: string }>();
  for (const l of [...tabLines, ...bbLines]) {
    const cur = best.get(l.points);
    if (!cur || l.price > cur.price) best.set(l.points, { price: l.price, book: l.book });
  }

  const rated: Array<{ points: number; price: number; book: string; model: number }> = [];
  for (const [points, { price, book }] of best) {
    const model = coverProbabilityFromBands(bands, Math.ceil(Math.abs(points)));
    if (model === null) continue;
    // A line priced shorter than this is not a product, whatever it rates.
    if (price < 1.30) continue;
    rated.push({ points, price, book, model });
  }
  if (!rated.length) throw new Error("no line falls inside the quoted ladder");

  rated.sort((a, b) => b.model - a.model);
  const core = rated[0];
  const coreImplied = 1 / core.price;
  console.log(
    `  CORE  ${plan.fav} ${core.points} @ $${core.price} (${core.book})   ` +
    `model ${(core.model * 100).toFixed(1)}%  market ${(coreImplied * 100).toFixed(1)}%  ` +
    `edge ${((core.model - coreImplied) * 100).toFixed(1)}%`,
  );

  const now = new Date().toISOString();
  const rows: any[] = [{
    fixture_id: fixture.id, model_version: MODEL_VERSION, market: "line",
    selection: plan.fav, point: core.points,
    entry_odds: core.price, entry_bookmaker: core.book, entry_captured_at: now,
    model_probability: Number(core.model.toFixed(4)),
    market_probability: Number(coreImplied.toFixed(4)),
    stake_units: 1, result_status: "pending", published: true, published_at: now,
  }];

  // ---- squad positions, to skip unused reserves ------------------------
  const positions = new Map<string, string>();
  try {
    const html = await getText(`${NRL_BASE}/${plan.nrlSlug}/`, UA_TAB);
    const decoded = html.replace(/&quot;/g, String.fromCharCode(34)).replace(/&#39;/g, "\u2019");
    for (const p of decoded.matchAll(/"firstName":"([^"]*)","lastName":"([^"]*)","position":"([^"]*)"/g)) {
      if (!positions.has(norm(`${p[1]} ${p[2]}`))) positions.set(norm(`${p[1]} ${p[2]}`), p[3]);
    }
  } catch (e: any) {
    console.log(`  (team list unavailable: ${e?.message ?? e} — reserves cannot be filtered)`);
  }

  // ---- try scorers -----------------------------------------------------
  const anytime = market(/^To Score a Try$/i);
  const runners = (anytime?.propositions ?? []).map((p: any) => ({
    name: String(p.name), odds: Number(p.returnWin),
  }));
  const ratedTries = devigAnytimeTryMarket(runners, totalPts)
    .filter((r) => {
      const pos = positions.get(norm(r.name));
      // A named reserve never takes the field, so the bet voids rather than
      // losing. Publishing one would be a pick that cannot win.
      return !pos || pos.trim().toLowerCase() !== "reserve";
    })
    .sort((a, b) => b.probability - a.probability);

  for (const r of ratedTries.slice(0, 3)) {
    const bare = r.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    console.log(`  TRY   ${bare.padEnd(26)} $${r.odds}   model ${(r.probability * 100).toFixed(1)}%   ${positions.get(norm(r.name)) ?? "?"}`);
    rows.push({
      fixture_id: fixture.id, model_version: MODEL_VERSION, market: "anytime_try",
      selection: bare, point: null,
      entry_odds: r.odds, entry_bookmaker: "TAB", entry_captured_at: now,
      model_probability: Number(r.probability.toFixed(4)),
      market_probability: Number((1 / r.odds).toFixed(4)),
      stake_units: 1, result_status: "pending", published: true, published_at: now,
    });
  }

  // ---- same game multi -------------------------------------------------
  // Shape: the core line plus one try scorer, preferring a forward. Round 1's
  // multis stacked two outside backs and went 1 from 6; the one that won
  // paired the handicap with a forward.
  const bbLine = g18.find(
    (o) => /^Match Result/i.test(o.EventName) && norm(o.OutcomeName) === norm(plan.fav) && Number(o.Points) === core.points,
  );

  const favScorers = g20
    .filter((o) => /^Anytime Tryscorer/i.test(o.EventName) && norm(o.PlayerTeamName ?? "") === norm(plan.fav))
    .map((o) => ({ ...o, position: positions.get(norm(o.OutcomeName)) ?? "" }))
    .filter((o) => o.position.trim().toLowerCase() !== "reserve")
    .sort((a, b) => Number(a.Price) - Number(b.Price));

  const forwards = favScorers.filter((s) => /prop|2nd row|row|lock|hooker/i.test(s.position));
  const others = favScorers.filter((s) => !forwards.includes(s));
  const candidates = [...forwards.slice(0, 3), ...others.slice(0, 3)];

  let sgm: { price: number; scorer: any } | null = null;
  if (bbLine) {
    for (const s of candidates) {
      const legs = [
        {
          EventId: bbLine.EventId, OutcomeId: bbLine.OutcomeId, MarketType: "WIN",
          FixedWin: Number(bbLine.Price), FixedMarketId: 0,
          MarketTypeDesc: `Match Result (${plan.label})`, GroupByHeader: "Match Result",
          Points: core.points, BetDetailTypeCode: "W", OutcomeName: `${plan.fav} ${core.points}`,
        },
        {
          EventId: s.EventId, OutcomeId: s.OutcomeId, MarketType: "TSCORER",
          FixedWin: Number(s.Price), FixedMarketId: 0,
          MarketTypeDesc: `Anytime Tryscorer (${plan.label})`, GroupByHeader: "Anytime Tryscorer",
          Points: 0, BetDetailTypeCode: "TS", OutcomeName: s.OutcomeName,
        },
      ];
      const price = await priceSgm(plan.event, legs);
      if (price === null) continue;
      sgm = { price, scorer: s };
      break;
    }
  }

  if (!sgm) {
    console.log(`  SGM   unavailable — the book will not price a multi for this fixture`);
  } else {
    const selection = `${plan.fav} ${core.points} + ${sgm.scorer.OutcomeName} anytime try`;
    const product = Number(bbLine!.Price) * Number(sgm.scorer.Price);
    console.log(
      `  SGM   ${selection.slice(0, 44).padEnd(45)} $${sgm.price.toFixed(2)}  ` +
      `(product $${product.toFixed(2)}, ${(100 / sgm.price).toFixed(1)}%)  ${sgm.scorer.position || "?"}`,
    );
    rows.push({
      fixture_id: fixture.id, model_version: MODEL_VERSION, market: "sgm",
      selection, point: null,
      entry_odds: sgm.price, entry_bookmaker: "betr", entry_captured_at: now,
      model_probability: null,
      market_probability: Number((1 / sgm.price).toFixed(4)),
      stake_units: 1, result_status: "pending", published: true, published_at: now,
      __legs: [
        { leg_index: 0, market: "line", selection: plan.fav, point: core.points, leg_odds: Number(bbLine!.Price) },
        { leg_index: 1, market: "anytime_try", selection: sgm.scorer.OutcomeName, point: null, leg_odds: Number(sgm.scorer.Price) },
      ],
    });
  }

  return rows;
}

async function main() {
  console.log(`Publishing RLWC Round 2${DRY_RUN ? " (DRY RUN)" : ""}`);

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
