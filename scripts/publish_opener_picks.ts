/**
 * Publish the RLWC opener's selections to Supabase.
 *
 * Writes one `picks` row per selection, with the entry price captured at
 * publication. Rows are append-only and the entry price is never rewritten, so
 * CLV can be computed against a genuine closing price later.
 *
 * Every price is re-read live immediately before writing: a published entry
 * price must be one that was actually available, not one captured hours ago.
 *
 * Usage:
 *   npx tsx scripts/publish_opener_picks.ts [--dry-run]
 */

import { buildPickRows, type PublishedPick } from "../src/model/published-picks.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const HEADERS = { Accept: "application/json", "User-Agent": UA };
const BETR = { ...HEADERS, Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/" };

const MASTER_EVENT_ID = 2292811;
const MATCH_RESULT_EVENT = 92785304;
const ANYTIME_TRY_EVENT = 92904442;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function getJson(url: string, headers = HEADERS): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

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
  // return=minimal responses carry no body.
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function main() {
  console.log(`Publishing opener picks${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // ---- Re-read every price live -------------------------------------------
  const g18 = await getJson(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G18`, BETR);
  const matchResult = (g18.Events ?? []).find((e: any) =>
    String(e.EventName ?? "").startsWith("Match Result"));
  const ausH2h = (matchResult?.Outcomes ?? []).find((o: any) =>
    o.OutcomeName === "Australia" && Number(o.Points) === 0);
  if (!ausH2h?.Price) throw new Error("Australia head-to-head price unavailable");

  const g20 = await getJson(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G20`, BETR);
  const anytimeMarket = (g20.Events ?? []).find((e: any) =>
    String(e.EventName ?? "").startsWith("Anytime Tryscorer"));
  const betrScorerPrice = (name: string) => {
    const o = (anytimeMarket?.Outcomes ?? []).find((x: any) => x.OutcomeName === name);
    if (!o?.Price) throw new Error(`Betr anytime price unavailable for ${name}`);
    return Number(o.Price);
  };
  const trbojevicPrice = betrScorerPrice("Tom Trbojevic");
  const bostockPrice = betrScorerPrice("Jack Bostock");

  const tab = await getJson(
    "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/Australia%20v%20New%20Zealand?jurisdiction=QLD");
  const toScore = (tab.markets ?? []).find((m: any) => m.betOption === "To Score a Try");
  const tabPrice = (name: string) => {
    const p = (toScore?.propositions ?? []).find((x: any) => String(x.name).startsWith(name));
    if (!p?.returnWin) throw new Error(`TAB price unavailable for ${name}`);
    return Number(p.returnWin);
  };

  // ---- SGM price from Betr's correlation model ----------------------------
  // Three legs: the match result plus two try scorers in COMPLEMENTARY
  // positions. Trbojevic is a fullback, so a second fullback (Walsh) is
  // treated by Betr as a substitute and earns only a -27% correlation
  // discount; Bostock, a centre, earns -42% and produces a materially
  // likelier combination despite being the longer standalone price.
  const sgmRes = await fetch("https://web20-api.bluebet.com.au/SameGameMultiPrice", {
    method: "POST",
    headers: { ...BETR, "Content-Type": "application/json" },
    body: JSON.stringify({
      MasterEventID: MASTER_EVENT_ID,
      Markets: [
        { EventId: MATCH_RESULT_EVENT, OutcomeId: 1, MarketType: "WIN", FixedWin: ausH2h.Price,
          FixedMarketId: 0, MarketTypeDesc: "Match Result (Australia v New Zealand)",
          GroupByHeader: "Match Result", Points: 0, BetDetailTypeCode: "W", OutcomeName: "Australia" },
        { EventId: ANYTIME_TRY_EVENT, OutcomeId: 6, MarketType: "TSCORER", FixedWin: trbojevicPrice,
          FixedMarketId: 0, MarketTypeDesc: "Anytime Tryscorer (Australia v New Zealand)",
          GroupByHeader: "Anytime Tryscorer", Points: 0, BetDetailTypeCode: "TS", OutcomeName: "Tom Trbojevic" },
        { EventId: ANYTIME_TRY_EVENT, OutcomeId: 35, MarketType: "TSCORER", FixedWin: bostockPrice,
          FixedMarketId: 0, MarketTypeDesc: "Anytime Tryscorer (Australia v New Zealand)",
          GroupByHeader: "Anytime Tryscorer", Points: 0, BetDetailTypeCode: "TS", OutcomeName: "Jack Bostock" },
      ],
    }),
  });
  const sgm = await sgmRes.json();
  if (sgm?.ErrorNo !== 0 || !sgm?.Price) {
    throw new Error(`SGM price unavailable: ${JSON.stringify(sgm)}`);
  }

  // ---- Assemble -----------------------------------------------------------
  const picks: PublishedPick[] = [
    {
      kind: "core", market: "h2h", selection: "Australia", point: null,
      entryOdds: Number(ausH2h.Price), entryBookmaker: "Betr",
      // Betfair draw-void Head To Head, spreads 2.90% / 4.18%, book 99.81%.
      modelProbability: 0.5808,
    },
    {
      kind: "sgm", market: "sgm",
      selection: "Australia + Tom Trbojevic & Jack Bostock anytime tries", point: null,
      entryOdds: Number(sgm.Price), entryBookmaker: "Betr",
      modelProbability: 1 / Number(sgm.Price),
      legs: [
        { label: "Australia", market: "h2h", odds: Number(ausH2h.Price) },
        { label: "Tom Trbojevic", market: "anytime_try", odds: trbojevicPrice },
        { label: "Jack Bostock", market: "anytime_try", odds: bostockPrice },
      ],
    },
    {
      kind: "try_scorer", market: "anytime_try", selection: "Cameron Munster", point: null,
      entryOdds: tabPrice("Cameron Munster"), entryBookmaker: "TAB",
      modelProbability: 0.221,
    },
    {
      kind: "try_scorer", market: "anytime_try", selection: "Tom Dearden", point: null,
      entryOdds: tabPrice("Tom Dearden"), entryBookmaker: "TAB",
      modelProbability: 0.192,
    },
    {
      kind: "try_scorer", market: "anytime_try", selection: "Dane Gagai", point: null,
      entryOdds: tabPrice("Dane Gagai"), entryBookmaker: "TAB",
      modelProbability: 0.218,
    },
  ];

  const [fixture] = await supabase(
    "fixtures?select=id,home_team,away_team,kickoff_at&match_key=eq.australia__newzealand");
  if (!fixture) throw new Error("opener fixture not found");

  const rows = buildPickRows(fixture.id, picks);

  console.log(`${fixture.home_team} v ${fixture.away_team}  (${fixture.kickoff_at})\n`);
  for (const pick of picks) {
    const prob = pick.modelProbability !== null
      ? `${(pick.modelProbability * 100).toFixed(1)}%` : "-";
    console.log(`  [${pick.kind.padEnd(11)}] ${pick.selection.padEnd(40)} $${pick.entryOdds.toFixed(2)}  ${pick.entryBookmaker.padEnd(8)} model ${prob}`);
    if (pick.legs) {
      const product = pick.legs.reduce((p, l) => p * l.odds, 1);
      console.log(`                 legs: ${pick.legs.map((l) => `${l.label} $${l.odds.toFixed(2)}`).join(" + ")}`);
      console.log(`                 naive product $${product.toFixed(2)} -> Betr $${pick.entryOdds.toFixed(2)} (${(((pick.entryOdds / product) - 1) * 100).toFixed(1)}%)`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nWould write ${rows.length} pick row(s)`);
    return;
  }

  // Replace any existing published picks for this fixture so a re-run does not
  // duplicate the card. Settled picks are never touched.
  await supabase(
    `picks?fixture_id=eq.${fixture.id}&result_status=eq.pending`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  const written = await supabase("picks", { method: "POST", body: JSON.stringify(rows) });
  console.log(`\nWrote ${rows.length} pick row(s)`);

  // Record the SGM's component legs. The parent row holds the real combined
  // price; these are stored for display and per-leg settlement.
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    if (!pick.legs?.length) continue;
    const parent = (written ?? []).find((r: any) => r.market === "sgm");
    if (!parent) continue;
    await supabase("pick_legs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        pick.legs.map((leg, index) => ({
          pick_id: parent.id,
          leg_index: index,
          market: leg.market,
          selection: leg.label,
          point: null,
          leg_odds: leg.odds,
        })),
      ),
    });
    console.log(`Wrote ${pick.legs.length} SGM leg(s)`);
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
