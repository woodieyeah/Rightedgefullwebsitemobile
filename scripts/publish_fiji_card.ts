/**
 * Publish the Fiji v Cook Islands card.
 *
 * Core play:   Fiji -8.5, rated from the winning-margin ladder.
 * SGM:         Fiji -8.5 + Taane Milne (2nd Row), priced at the book.
 * Try scorers: the three highest-rated, de-vigged against expected scorers.
 *
 * WHY THIS MULTI IS SHAPED DIFFERENTLY
 * Five of our six previous SGM try legs were wingers, and they are 1 from 6.
 * Round 1's tries went Interchange 32%, Forward 23%, Centre 13%, Winger 10%.
 * That tally overstates the case — "Interchange" is where a player started,
 * not where he played, and Fa'alogo scored four of those as an outside back —
 * but the structural point holds: stacking two legs from the same scoring
 * route means both die together when that edge is shut down, which is exactly
 * how all three losing multis went. This pairs the core play with a forward.
 *
 * Usage:
 *   npx tsx scripts/publish_fiji_card.ts [--dry-run]
 */
import { devigAnytimeTryMarket } from "../src/model/devig-try-market.ts";
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const TAB = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/Fiji%20v%20Cook%20Islands?jurisdiction=NSW";
const BB = "https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=2299391&GroupTypeCode=";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";

const EVENT = 2299391;
const MATCH_KEY = "cookislands__fiji";
const LABEL = "Fiji v Cook Islands";
const MODEL_VERSION = "rlwc-consensus-v1";
const LINE = -8.5;
const SGM_SCORER = "Taane Milne";
const TRY_SCORERS = ["Sunia Turuva", "Semi Valemei", "Bayleigh Bentley-Hape"];
const AGREEMENT_GATE_PCT = 5;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const norm = (x: string) =>
  x.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

const walk = (n: any, ev = "", id = 0, out: any[] = []): any[] => {
  if (!n || typeof n !== "object") return out;
  const name = n.EventName ?? ev;
  const eid = n.EventId ?? id;
  if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name, EventId: eid });
  for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, eid, out);
  return out;
};

async function bbGroup(code: string) {
  const res = await fetch(`${BB}${code}&format=json`, {
    headers: { "User-Agent": UA_BB, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`BlueBet ${code} HTTP ${res.status}`);
  return walk(await res.json());
}

async function priceSgm(legs: any[]): Promise<number | null> {
  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      "User-Agent": UA_BB, Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: EVENT, Markets: legs }),
  });
  const d = await res.json().catch(() => null);
  if (!d || d.ErrorNo !== 0 || !d.Price) return null;
  return Number(d.Price);
}

async function main() {
  console.log(`${LABEL} — publishing card${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(
    `fixtures?match_key=eq.${MATCH_KEY}&select=id,home_team,away_team,kickoff_at`,
  ))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY}`);

  const existing = await supabase(`picks?fixture_id=eq.${fixture.id}&select=id,market,selection`);
  if (existing?.length) {
    throw new Error(`${existing.length} pick(s) already published for this fixture; refusing to duplicate`);
  }

  // --- live prices -------------------------------------------------------
  const tab = await (await fetch(TAB, { headers: { "User-Agent": UA_TAB, Accept: "application/json" } })).json();
  const market = (name: string) =>
    (tab.markets ?? []).find((m: any) => new RegExp(`^${name}$`, "i").test(m.betOption ?? m.name ?? ""));

  const pyol = market("Pick Your Own Line");
  const tabLine = pyol?.propositions?.find((p: any) => norm(p.name) === norm(`Fiji ${LINE}`));
  if (!tabLine?.returnWin) throw new Error(`TAB does not quote Fiji ${LINE}`);

  const popular = await bbGroup("G18");
  const bbLineOutcome = popular.find(
    (o) => /^Match Result/i.test(o.EventName) && o.OutcomeName === "Fiji" && Number(o.Points) === LINE,
  );
  if (!bbLineOutcome) throw new Error(`BlueBet does not quote Fiji ${LINE}`);

  const tabPrice = Number(tabLine.returnWin);
  const bbPrice = Number(bbLineOutcome.Price);
  const gap = (Math.abs(tabPrice - bbPrice) / tabPrice) * 100;
  console.log(`  Fiji ${LINE}:  TAB $${tabPrice}   BlueBet $${bbPrice}   gap ${gap.toFixed(2)}%  -> ${gap <= AGREEMENT_GATE_PCT ? "AGREE" : "DISAGREE"}`);
  if (gap > AGREEMENT_GATE_PCT) throw new Error("books disagree beyond the gate; refusing to publish");

  const linePrice = Math.max(tabPrice, bbPrice);
  const lineBook = tabPrice >= bbPrice ? "TAB" : "BlueBet";

  // --- rate the line from the margin ladder ------------------------------
  const g19 = await bbGroup("G19");
  const seen = new Map<number, number>();
  for (const o of g19) {
    const m = String(o.OutcomeName).match(/^Fiji\s+(\d+)\+$/);
    if (m && !seen.has(Number(m[1]))) seen.set(Number(m[1]), Number(o.Price));
  }
  const bands = parseMarginBands([...seen.entries()].map(([t, p]) => ({ name: `Fiji ${t}+`, price: p })));
  const need = Math.ceil(Math.abs(LINE));
  const model = bands.length >= 2 ? coverProbabilityFromBands(bands, need) : null;
  if (model === null) throw new Error(`no ladder rating for Fiji ${need}+; refusing to publish`);

  console.log(`  CORE  Fiji ${LINE} @ $${linePrice} (${lineBook})   needs ${need}+   model ${(model * 100).toFixed(1)}%   market ${(100 / linePrice).toFixed(1)}%`);

  const now = new Date().toISOString();
  const rows: any[] = [{
    fixture_id: fixture.id, model_version: MODEL_VERSION, market: "line",
    // Bare team name; `point` carries the handicap and the card appends it.
    selection: "Fiji", point: LINE,
    entry_odds: linePrice, entry_bookmaker: lineBook, entry_captured_at: now,
    model_probability: Number(model.toFixed(4)),
    market_probability: Number((1 / linePrice).toFixed(4)),
    stake_units: 1, result_status: "pending", published: true, published_at: now,
  }];

  // --- try scorers -------------------------------------------------------
  const anytimeTab = market("To Score a Try");
  const runners = (anytimeTab?.propositions ?? []).map((p: any) => ({
    name: String(p.name), odds: Number(p.returnWin),
  }));
  const totalMkt = market("Total Points Over/Under");
  const overProp = totalMkt?.propositions?.find((p: any) => /^Over/i.test(p.name));
  const totalPts = Number(String(overProp?.name).match(/[\d.]+/)?.[0]);
  if (!Number.isFinite(totalPts)) throw new Error("no total points line; refusing to publish");

  const rated = devigAnytimeTryMarket(runners, totalPts);
  const byName = new Map(rated.map((r) => [norm(r.name), r]));

  for (const scorer of TRY_SCORERS) {
    const hit = byName.get(norm(scorer));
    if (!hit) throw new Error(`no live price for ${scorer} — refusing to publish`);
    console.log(`  TRY   ${scorer.padEnd(24)} $${hit.odds}   model ${(hit.probability * 100).toFixed(1)}%`);
    rows.push({
      fixture_id: fixture.id, model_version: MODEL_VERSION, market: "anytime_try",
      selection: scorer, point: null,
      entry_odds: hit.odds, entry_bookmaker: "TAB", entry_captured_at: now,
      model_probability: Number(hit.probability.toFixed(4)),
      market_probability: Number((1 / hit.odds).toFixed(4)),
      stake_units: 1, result_status: "pending", published: true, published_at: now,
    });
  }

  // --- same game multi ---------------------------------------------------
  const tries = await bbGroup("G20");
  const milne = tries.find(
    (o) => /^Anytime Tryscorer/i.test(o.EventName) && norm(o.OutcomeName) === norm(SGM_SCORER),
  );
  if (!milne) throw new Error(`no SGM leg outcome for ${SGM_SCORER}`);

  const legs = [
    {
      EventId: bbLineOutcome.EventId, OutcomeId: bbLineOutcome.OutcomeId, MarketType: "WIN",
      FixedWin: bbPrice, FixedMarketId: 0, MarketTypeDesc: `Match Result (${LABEL})`,
      GroupByHeader: "Match Result", Points: LINE, BetDetailTypeCode: "W",
      OutcomeName: `Fiji ${LINE}`,
    },
    {
      EventId: milne.EventId, OutcomeId: milne.OutcomeId, MarketType: "TSCORER",
      FixedWin: Number(milne.Price), FixedMarketId: 0,
      MarketTypeDesc: `Anytime Tryscorer (${LABEL})`, GroupByHeader: "Anytime Tryscorer",
      Points: 0, BetDetailTypeCode: "TS", OutcomeName: milne.OutcomeName,
    },
  ];

  const sgmPrice = await priceSgm(legs);
  if (!sgmPrice) throw new Error("SGM price unavailable — refusing to publish");

  const product = legs.reduce((a, l) => a * l.FixedWin, 1);
  const selection = `Fiji ${LINE} + ${SGM_SCORER} anytime try`;
  console.log(`  SGM   ${selection.padEnd(38)} $${sgmPrice.toFixed(2)}  (product $${product.toFixed(2)}, ${(100 / sgmPrice).toFixed(1)}%)`);

  rows.push({
    fixture_id: fixture.id, model_version: MODEL_VERSION, market: "sgm",
    selection, point: null,
    entry_odds: sgmPrice, entry_bookmaker: "betr", entry_captured_at: now,
    model_probability: null,
    market_probability: Number((1 / sgmPrice).toFixed(4)),
    stake_units: 1, result_status: "pending", published: true, published_at: now,
  });

  if (DRY_RUN) {
    console.log(`\nDRY RUN — ${rows.length} pick(s) would be written, nothing changed.`);
    return;
  }

  const written = await supabase("picks", { method: "POST", body: JSON.stringify(rows) });
  console.log(`\nWrote ${written.length} pick(s).`);

  const sgmPick = written.find((w: any) => w.market === "sgm");
  if (!sgmPick) throw new Error("could not locate the written SGM pick");
  await supabase("pick_legs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { pick_id: sgmPick.id, leg_index: 0, market: "line", selection: "Fiji", point: LINE, leg_odds: bbPrice },
      { pick_id: sgmPick.id, leg_index: 1, market: "anytime_try", selection: SGM_SCORER, point: null, leg_odds: Number(milne.Price) },
    ]),
  });
  console.log(`  legs written for the multi`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
