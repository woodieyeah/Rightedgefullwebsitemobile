/**
 * RLWC odds worker — BlueBet -> Supabase odds_snapshots.
 *
 * Captures bookmaker prices for scheduled RLWC fixtures. Every row is an
 * immutable observation: the table's unique constraint means a repeat capture
 * at the same timestamp is ignored rather than overwriting history. That
 * history is what later produces a genuine closing price and real CLV.
 *
 * Uses the PostgREST HTTP API directly rather than @supabase/supabase-js, so
 * the worker has zero dependencies and can run from cron, a CI job or a laptop
 * without an install step.
 *
 * RUN
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service key> \
 *     npx tsx scripts/rlwc_odds_worker.ts [--dry-run]
 *
 * The service role key is required because odds_snapshots revokes anon and
 * authenticated. It must never appear in client code or in a browser bundle.
 *
 * MATCHING
 * BlueBet names its RLWC category inconsistently ("World Cup 2022 Matches"
 * currently holds 2026 fixtures), so events are matched on the MasterEvent name
 * "<Home> v <Away>" against the fixture's match_key, never on the category
 * label. A fixture with no matching BlueBet event is reported and skipped,
 * never guessed at.
 */

import {
  mapMasterEventToSnapshots,
  minutesBeforeKickoff,
  type BlueBetMasterEvent,
} from "../src/model/bluebet-mapper.ts";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Dashboard -> Project Settings -> API -> service_role key.",
  );
  process.exit(1);
}

const BLUEBET = "https://affiliate-api.bluebet.com.au";
const RUGBY_LEAGUE_EVENT_TYPE = 102;

/** PostgREST request with the service role. */
async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function blueBet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(BLUEBET + path, {
      headers: { Accept: "application/json", "User-Agent": "rightedge.com.au" },
    });
    if (!res.ok) {
      console.warn(`  BlueBet ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`  BlueBet fetch failed: ${(error as Error).message}`);
    return null;
  }
}

/** Normalise a team name. Mirrors the fixtures match_key rule. */
const norm = (value: string) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Index every rugby league MasterEvent by its normalised team pair. */
async function indexBlueBetEvents(): Promise<Map<string, number>> {
  const index = new Map<string, number>();
  const catalogue = await blueBet<any>(
    `/MasterCategory?EventTypeId=${RUGBY_LEAGUE_EVENT_TYPE}&WithLevelledMarkets=true&Format=json`,
  );
  if (!catalogue) return index;

  for (const master of catalogue.MasterCategories ?? []) {
    for (const category of master.Categories ?? []) {
      for (const event of category.MasterEvents ?? []) {
        const name = String(event?.MasterEventName ?? "");
        const id = Number(event?.MasterEventId);
        if (!Number.isFinite(id)) continue;
        const parts = name.split(/\s+v\s+/i);
        if (parts.length !== 2) continue;
        const key = [norm(parts[0]), norm(parts[1])].sort().join("__");
        if (key.length > 2) index.set(key, id);
      }
    }
  }
  return index;
}

async function main() {
  const now = new Date();
  console.log(`RLWC odds worker · ${now.toISOString()}${DRY_RUN ? " · DRY RUN" : ""}`);

  // Only fixtures that have not kicked off. A started match's prices are
  // in-play and must never be recorded as a pre-match observation.
  const query =
    "fixtures?select=id,home_team,away_team,match_key,kickoff_at,competitions!inner(code)" +
    "&competitions.code=eq.rlwc" +
    "&status=eq.scheduled" +
    `&kickoff_at=gt.${encodeURIComponent(now.toISOString())}` +
    "&order=kickoff_at.asc";

  const res = await db(query);
  if (!res.ok) {
    console.error(`Failed to read fixtures: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const fixtures = (await res.json()) as any[];

  if (!fixtures.length) {
    console.log("No upcoming RLWC fixtures.");
    return;
  }
  console.log(`${fixtures.length} upcoming fixture(s)`);

  const index = await indexBlueBetEvents();
  console.log(`${index.size} BlueBet rugby league event(s) indexed\n`);

  let inserted = 0;
  let unmatched = 0;

  for (const fixture of fixtures) {
    const label = `${fixture.home_team} v ${fixture.away_team}`;
    const eventId = index.get(fixture.match_key);

    if (!eventId) {
      // Expected for later rounds — markets open closer to kickoff.
      console.log(`  ${label}: no BlueBet market yet`);
      unmatched += 1;
      continue;
    }

    const payload = await blueBet<BlueBetMasterEvent>(
      `/MasterEvent?MasterEventId=${eventId}&format=json`,
    );
    const rows = mapMasterEventToSnapshots(payload);
    if (!rows.length) {
      console.log(`  ${label}: event ${eventId} returned no usable markets`);
      continue;
    }

    const capturedAt = new Date().toISOString();
    const minutes = minutesBeforeKickoff(fixture.kickoff_at, new Date());

    const records = rows.map((row) => ({
      fixture_id: fixture.id,
      bookmaker: "bluebet",
      market: row.market,
      selection: row.selection,
      point: row.point,
      odds: row.odds,
      captured_at: capturedAt,
      minutes_before_kickoff: minutes,
    }));

    const summary = rows
      .map((r) => `${r.selection}${r.point != null ? ` ${r.point > 0 ? "+" : ""}${r.point}` : ""} $${r.odds}`)
      .join(" · ");
    console.log(`  ${label}: ${rows.length} price(s) — ${summary}`);

    if (DRY_RUN) continue;

    // merge-duplicates + ignore: a repeat capture never rewrites history.
    const insert = await db("odds_snapshots", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(records),
    });

    if (!insert.ok) {
      console.error(`  ${label}: insert failed — ${insert.status} ${await insert.text()}`);
      continue;
    }
    inserted += records.length;
  }

  console.log(
    `\n${DRY_RUN ? "Would insert" : `Inserted ${inserted}`} row(s)` +
    `${unmatched ? ` · ${unmatched} fixture(s) without a market yet` : ""}`,
  );
}

main().catch((error) => {
  console.error("Worker failed:", error);
  process.exit(1);
});
