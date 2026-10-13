/**
 * RLWC prediction worker: TAB + BlueBet -> Supabase model_predictions.
 *
 * TAB supplies head-to-head, line and total for every fixture; BlueBet supplies
 * an independent second price so an edge can be computed at all. Both are
 * public endpoints with no authentication.
 *
 * Writes one model_predictions row per fixture per run. Rows are append-only,
 * so the progression of the model's view is preserved.
 *
 * Usage:
 *   npx tsx scripts/rlwc_prediction_worker.ts [--dry-run]
 */

import {
  buildModelPrediction,
  matchesFixture,
  type BookPrices,
  type TabMatch,
} from "../src/model/tab-markets.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const TAB_BASE =
  "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BLUEBET_BASE = "https://web20-api.bluebet.com.au";

const MODEL_VERSION = "rlwc-consensus-v1";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA, ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

/** All TAB World Cup matches, each with its full market list. */
async function loadTabMatches(): Promise<TabMatch[]> {
  const index = await getJson(`${TAB_BASE}?jurisdiction=QLD`);
  const out: TabMatch[] = [];

  for (const match of index.matches ?? []) {
    const name = match.name;
    if (!name) continue;
    try {
      out.push(await getJson(`${TAB_BASE}/${encodeURIComponent(name)}?jurisdiction=QLD`));
    } catch {
      // A match that fails to load simply contributes nothing.
    }
  }
  return out;
}

/** BlueBet head-to-head prices, keyed by "home v away". */
async function loadBlueBetPrices(): Promise<Map<string, BookPrices>> {
  const prices = new Map<string, BookPrices>();

  try {
    const category = await getJson(
      `${BLUEBET_BASE}/MasterCategory?EventTypeId=102&WithLevelledMarkets=true`,
      { Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/" },
    );

    const events: any[] = [];
    for (const mc of category.MasterCategories ?? []) {
      for (const c of mc.Categories ?? []) {
        if (!/world cup/i.test(c.CategoryName ?? "")) continue;
        events.push(...(c.MasterEvents ?? []));
      }
    }

    for (const event of events) {
      const name: string = event.MasterEventName ?? "";
      const parts = name.split(/\s+v\s+/i);
      if (parts.length !== 2) continue;

      try {
        const detail = await getJson(
          `${BLUEBET_BASE}/MasterEvent?MasterEventId=${event.MasterEventId}&GroupTypeCode=G18`,
          { Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/" },
        );
        const matchResult = (detail.Events ?? []).find((e: any) =>
          (e.EventName ?? "").startsWith("Match Result"),
        );
        if (!matchResult) continue;

        // The zero-point legs are the head-to-head prices.
        const priceFor = (team: string) => {
          for (const o of matchResult.Outcomes ?? []) {
            if ((o.OutcomeName ?? "").trim().toLowerCase() !== team.trim().toLowerCase()) continue;
            if (Number(o.Points) !== 0) continue;
            const price = Number(o.Price);
            if (Number.isFinite(price) && price > 0) return price;
          }
          return null;
        };

        const home = priceFor(parts[0]);
        const away = priceFor(parts[1]);
        if (home !== null && away !== null) prices.set(name, { home, away });
      } catch {
        // Skip events that fail to load.
      }
    }
  } catch {
    // BlueBet being unavailable means no edge, not a failed run.
  }
  return prices;
}

async function main() {
  console.log(`RLWC prediction worker · ${new Date().toISOString()}${DRY_RUN ? " · DRY RUN" : ""}`);

  const fixtures = await supabase(
    "fixtures?select=id,home_team,away_team,kickoff_at,status&status=eq.scheduled&order=kickoff_at.asc",
  );
  console.log(`${fixtures.length} scheduled fixture(s)`);

  const [tabMatches, bluebet] = await Promise.all([loadTabMatches(), loadBlueBetPrices()]);
  console.log(`${tabMatches.length} TAB match(es), ${bluebet.size} BlueBet price(s)\n`);

  const rows: any[] = [];

  for (const fixture of fixtures) {
    const tab = tabMatches.find((m) => matchesFixture(m.name ?? "", fixture.home_team, fixture.away_team));
    if (!tab) {
      console.log(`  ${fixture.home_team} v ${fixture.away_team}: no TAB market`);
      continue;
    }

    // BlueBet may name the fixture slightly differently (e.g. abbreviations).
    let second: BookPrices | null = null;
    for (const [name, prices] of bluebet) {
      if (matchesFixture(name, fixture.home_team, fixture.away_team)) { second = prices; break; }
    }

    const prediction = buildModelPrediction({
      tab,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      secondBook: second,
    });
    if (!prediction) {
      console.log(`  ${fixture.home_team} v ${fixture.away_team}: markets unusable`);
      continue;
    }

    const score =
      prediction.projectedHome !== null
        ? `${prediction.projectedHome.toFixed(1)}-${prediction.projectedAway!.toFixed(1)}`
        : "no projection";
    const edge =
      prediction.homeEdgePct !== null
        ? `edge ${prediction.homeEdgePct >= 0 ? "+" : ""}${prediction.homeEdgePct.toFixed(2)}% / ` +
          `${prediction.awayEdgePct! >= 0 ? "+" : ""}${prediction.awayEdgePct!.toFixed(2)}%`
        : `no edge (${prediction.edgeSuppressedReason})`;

    console.log(
      `  ${fixture.home_team} v ${fixture.away_team}: ${score}  ` +
        `${(prediction.homeWinProbability * 100).toFixed(1)}%  ${edge}`,
    );

    rows.push({
      fixture_id: fixture.id,
      model_version: MODEL_VERSION,
      projected_home_score: prediction.projectedHome,
      projected_away_score: prediction.projectedAway,
      home_win_probability: prediction.homeWinProbability,
      away_win_probability: prediction.awayWinProbability,
      // RLWC is published without a draw market, so no draw probability.
      draw_probability: null,
      anchor_source: second ? "tab+bluebet consensus" : "tab",
      anchor_max_spread_pct: prediction.bookAgreementPct,
    });
  }

  if (DRY_RUN) {
    console.log(`\nWould write ${rows.length} prediction row(s)`);
    return;
  }

  if (rows.length) {
    await supabase("model_predictions", { method: "POST", body: JSON.stringify(rows) });
    console.log(`\nWrote ${rows.length} prediction row(s)`);
  } else {
    console.log("\nNothing to write");
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
