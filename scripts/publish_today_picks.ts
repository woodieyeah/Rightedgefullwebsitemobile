/**
 * Publish today's RLWC picks: PNG v Lebanon and England v Tonga.
 *
 * Every price is re-read live immediately before writing — a card published
 * against a stale price misprices the risk it is advertising. The SGM price
 * comes from the book's own pricing endpoint, never from multiplying legs.
 *
 * Usage:
 *   npx tsx scripts/publish_today_picks.ts [--dry-run]
 */

import { devigAnytimeTryMarket } from "../src/model/devig-try-market.ts";
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const TAB = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BB = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";
const MODEL_VERSION = "rlwc-consensus-v1";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** Fixtures to publish, with the try scorers chosen from the model's top rated. */
const PLAN = [
  {
    matchKey: "lebanon__papuanewguinea",
    tabKey: "PNG v Lebanon",
    label: "Papua New Guinea v Lebanon",
    event: 2299390,
    fav: "Papua New Guinea",
    favTab: "PNG",
    dog: "Lebanon",
    corePlay: true,
    scorers: ["Robert Derby", "Dudley Dotoi", "Zac Laybutt"],
    sgmLegs: ["Dudley Dotoi", "Robert Derby"],
  },
  {
    matchKey: "england__tonga",
    tabKey: "England v Tonga",
    label: "England v Tonga",
    event: 2292886,
    fav: "Tonga",
    favTab: "Ton",
    dog: "England",
    // Tonga -2.5 rates 51.3% against a price implying 52.6%: a coin flip the
    // wrong way, so no core play is published for this fixture.
    corePlay: false,
    scorers: ["Dallin Watene-Zelezniak", "Dominic Young", "Jojo Fifita"],
    sgmLegs: ["Dallin Watene-Zelezniak", "Jojo Fifita"],
  },
];

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

async function tabMatch(key: string) {
  const res = await fetch(`${TAB}/${encodeURIComponent(key)}?jurisdiction=NSW`, {
    headers: { "User-Agent": UA_TAB, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TAB ${key} HTTP ${res.status}`);
  return res.json();
}

async function bbGroup(event: number, code: string): Promise<any[]> {
  const res = await fetch(`${BB}/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, {
    headers: { "User-Agent": UA_BB, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`BlueBet ${code} HTTP ${res.status}`);
  const data = await res.json();
  const out: any[] = [];
  const walk = (n: any, ev = "", id = 0) => {
    if (!n || typeof n !== "object") return;
    const name = n.EventName ?? ev;
    const eid = n.EventId ?? id;
    if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name, EventId: eid });
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, eid);
  };
  walk(data);
  return out;
}

const market = (d: any, name: string) =>
  (d.markets ?? []).find((m: any) => new RegExp(`^${name}$`, "i").test(m.betOption ?? m.name ?? ""));

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
  const data = await res.json().catch(() => null);
  if (!data || data.ErrorNo !== 0 || !data.Price) return null;
  return Number(data.Price);
}

async function main() {
  console.log(`Publishing today's RLWC picks${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const rows: any[] = [];
  const legRows: Array<{ selection: string; legs: any[] }> = [];

  for (const f of PLAN) {
    console.log(`${"=".repeat(64)}\n${f.label}\n${"=".repeat(64)}`);

    const fixture = (await supabase(
      `fixtures?match_key=eq.${f.matchKey}&select=id,home_team,away_team,kickoff_at`,
    ))?.[0];
    if (!fixture) throw new Error(`fixture not found: ${f.matchKey}`);

    const tab = await tabMatch(f.tabKey);
    const lineMkt = market(tab, "Line");
    const totalMkt = market(tab, "Total Points Over/Under");
    const anytimeMkt = market(tab, "To Score a Try");
    const over = totalMkt.propositions.find((p: any) => /^Over/i.test(p.name));
    const totalPts = Number(String(over.name).match(/[\d.]+/)![0]);

    // --- core play -------------------------------------------------------
    if (f.corePlay) {
      const favLine = lineMkt.propositions.find(
        (p: any) => p.name.startsWith(f.fav) || p.name.startsWith(f.favTab),
      );
      const lineVal = Number(String(favLine.name).match(/-?[\d.]+/)![0]);
      const price = Number(favLine.returnWin);

      const g19 = await bbGroup(f.event, "G19");
      const ladder = g19
        .filter((o) => new RegExp(`^${f.fav}\\s+\\d+\\+$`).test(o.OutcomeName))
        .map((o) => ({ name: o.OutcomeName, price: Number(o.Price) }));
      const bands = parseMarginBands(ladder);
      const cover = coverProbabilityFromBands(bands, Math.ceil(Math.abs(lineVal)));
      if (cover === null) throw new Error(`no line rating for ${f.fav} ${lineVal}`);

      console.log(`  CORE  ${f.fav} ${lineVal} @ $${price}  model ${(cover * 100).toFixed(1)}%  market ${(100 / price).toFixed(1)}%`);
      rows.push({
        fixture_id: fixture.id, model_version: MODEL_VERSION, market: "line",
        // The bare team name only. `point` carries the handicap, and the card
        // appends it at render time — baking it into the selection as well
        // renders it twice and stops the team matching a side.
        selection: f.fav, point: lineVal,
        entry_odds: price, entry_bookmaker: "TAB",
        entry_captured_at: new Date().toISOString(),
        model_probability: Number(cover.toFixed(4)),
        market_probability: Number((1 / price).toFixed(4)),
        stake_units: 1, result_status: "pending", published: true,
        published_at: new Date().toISOString(),
      });
    }

    // --- try scorers -----------------------------------------------------
    const runners = anytimeMkt.propositions.map((p: any) => ({
      name: String(p.name), odds: Number(p.returnWin),
    }));
    const rated = devigAnytimeTryMarket(runners, totalPts);
    // TAB strips the team suffix onto the name ("Robert Derby (PNG)") and
    // abbreviates long first names ("Dallin W-Zelezniak"). Index on both the
    // bare name and a loose key so a plan entry written in full still finds
    // the book's shortened label.
    const looseKey = (s: string) =>
      s
        .replace(/\s*\([^)]*\)\s*$/, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
    const byName = new Map<string, (typeof rated)[number]>();
    for (const r of rated) {
      const bare = r.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
      byName.set(bare, r);
      byName.set(looseKey(bare), r);
      // "Dallin W-Zelezniak" -> match a plan entry of "Dallin Watene-Zelezniak"
      // on the distinctive tail of the surname.
      const surname = bare.split(/[\s-]+/).slice(-1)[0].toLowerCase();
      if (surname.length >= 4) byName.set(`~${surname}`, r);
    }

    const findRunner = (name: string) =>
      byName.get(name) ??
      byName.get(looseKey(name)) ??
      byName.get(`~${name.split(/[\s-]+/).slice(-1)[0].toLowerCase()}`);

    for (const scorer of f.scorers) {
      const hit = findRunner(scorer);
      if (!hit) throw new Error(`no live price for ${scorer} — refusing to publish`);
      console.log(`  TRY   ${scorer.padEnd(26)} $${hit.odds}  model ${(hit.probability * 100).toFixed(1)}%`);
      rows.push({
        fixture_id: fixture.id, model_version: MODEL_VERSION, market: "anytime_try",
        selection: scorer, point: null,
        entry_odds: hit.odds, entry_bookmaker: "TAB",
        entry_captured_at: new Date().toISOString(),
        model_probability: Number(hit.probability.toFixed(4)),
        market_probability: Number((1 / hit.odds).toFixed(4)),
        stake_units: 1, result_status: "pending", published: true,
        published_at: new Date().toISOString(),
      });
    }

    // --- same game multi --------------------------------------------------
    const popular = await bbGroup(f.event, "G18");
    const tries = await bbGroup(f.event, "G20");
    const favOutcome = popular.find(
      (o) => /^Match Result/i.test(o.EventName) && Number(o.Points) === 0 && o.OutcomeName === f.fav,
    );
    if (!favOutcome) throw new Error(`no head-to-head outcome for ${f.fav}`);

    const legOutcomes = f.sgmLegs.map((name) => {
      const o = tries.find(
        (t) => /^Anytime Tryscorer/i.test(t.EventName) && t.OutcomeName === name,
      );
      if (!o) throw new Error(`no SGM leg outcome for ${name}`);
      return o;
    });

    const legs = [
      {
        EventId: favOutcome.EventId, OutcomeId: favOutcome.OutcomeId, MarketType: "WIN",
        FixedWin: Number(favOutcome.Price), FixedMarketId: 0,
        MarketTypeDesc: `Match Result (${f.label})`, GroupByHeader: "Match Result",
        Points: 0, BetDetailTypeCode: "W", OutcomeName: favOutcome.OutcomeName,
      },
      ...legOutcomes.map((o) => ({
        EventId: o.EventId, OutcomeId: o.OutcomeId, MarketType: "TSCORER",
        FixedWin: Number(o.Price), FixedMarketId: 0,
        MarketTypeDesc: `Anytime Tryscorer (${f.label})`, GroupByHeader: "Anytime Tryscorer",
        Points: 0, BetDetailTypeCode: "TS", OutcomeName: o.OutcomeName,
      })),
    ];

    const sgmPrice = await priceSgm(f.event, legs);
    if (!sgmPrice) throw new Error(`SGM price unavailable for ${f.label} — refusing to publish`);

    const product = legs.reduce((acc, l) => acc * l.FixedWin, 1);
    const selection = `${f.fav} + ${f.sgmLegs.join(" & ")} anytime try`;
    console.log(`  SGM   ${selection.slice(0, 52).padEnd(53)} $${sgmPrice.toFixed(2)} (product $${product.toFixed(2)}, ${(100 / sgmPrice).toFixed(1)}%)`);

    rows.push({
      fixture_id: fixture.id, model_version: MODEL_VERSION, market: "sgm",
      selection, point: null,
      entry_odds: sgmPrice, entry_bookmaker: "betr",
      entry_captured_at: new Date().toISOString(),
      model_probability: null,
      market_probability: Number((1 / sgmPrice).toFixed(4)),
      stake_units: 1, result_status: "pending", published: true,
      published_at: new Date().toISOString(),
    });
    legRows.push({
      selection,
      legs: [
        { leg_index: 0, market: "h2h", selection: f.fav, point: null, leg_odds: Number(favOutcome.Price) },
        ...legOutcomes.map((o, i) => ({
          leg_index: i + 1, market: "anytime_try", selection: o.OutcomeName,
          point: null, leg_odds: Number(o.Price),
        })),
      ],
    });
    console.log();
  }

  if (DRY_RUN) {
    console.log(`DRY RUN — ${rows.length} pick(s) would be written, no changes made.`);
    return;
  }

  const written = await supabase("picks", { method: "POST", body: JSON.stringify(rows) });
  console.log(`Wrote ${written.length} pick(s).`);

  for (const { selection, legs } of legRows) {
    const pick = written.find((w: any) => w.selection === selection);
    if (!pick) throw new Error(`could not locate written pick for ${selection}`);
    await supabase("pick_legs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(legs.map((l) => ({ ...l, pick_id: pick.id }))),
    });
    console.log(`  legs written for ${selection.slice(0, 50)}`);
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
