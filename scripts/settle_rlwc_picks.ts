/**
 * Settle published RLWC picks from NRL.com's own draw feed.
 *
 * The user does not enter results, so settlement must be automatic. TAB drops
 * a fixture the moment it finishes, and the-odds-api has no World Cup key, so
 * NRL.com's draw endpoint is the source:
 *
 *   https://www.nrl.com/draw/data?competition=131&round=N&season=2026
 *
 * It returns `matchState` ("FullTime"/"Upcoming"), both scores, and the match
 * centre URL. Try scorers come from the match centre page, which embeds a
 * `tries.summaries` list of "Player 19'" entries.
 *
 * Gating is on the feed's own FullTime flag, never on the presence of scores:
 * settling at half time locks in a wrong outcome permanently.
 *
 * Usage:
 *   npx tsx scripts/settle_rlwc_picks.ts [--round N] [--dry-run]
 */

import {
  buildTracker,
  settleMultiPick,
  settleSinglePick,
  type MatchResult,
  type TrackerPick,
} from "../src/model/pick-tracker.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const roundArg = process.argv.indexOf("--round");
const ROUND = roundArg >= 0 ? Number(process.argv[roundArg + 1]) : 1;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const NRL_COMPETITION = 131;
const SEASON = 2026;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
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
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

/** Pull try scorers from a match centre page's embedded summaries. */
async function fetchTryScorers(matchCentreUrl: string): Promise<string[] | null> {
  try {
    const res = await fetch(`https://www.nrl.com${matchCentreUrl}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // The page HTML-escapes its JSON, so decode the entities we need first.
    const decoded = html.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    // Each team block carries: "tries":{"summaries":["Jack Bostock 19'", ...]
    const scorers: string[] = [];
    const blocks = decoded.matchAll(/"tries":\{"summaries":\[(.*?)\]/g);
    for (const block of blocks) {
      for (const entry of block[1].matchAll(/"([^"]+?)\s+\d+'"/g)) {
        scorers.push(entry[1].trim());
      }
    }
    // An empty list is ambiguous (no tries vs not reported); treat as absent.
    return scorers.length ? scorers : null;
  } catch {
    return null;
  }
}

async function fetchResults(round: number): Promise<Map<string, MatchResult>> {
  const res = await fetch(
    `https://www.nrl.com/draw/data?competition=${NRL_COMPETITION}&round=${round}&season=${SEASON}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`NRL draw feed HTTP ${res.status}`);
  const data = await res.json();

  const byKey = new Map<string, MatchResult>();
  for (const fixture of data.fixtures ?? []) {
    const home = fixture.homeTeam?.nickName;
    const away = fixture.awayTeam?.nickName;
    if (!home || !away) continue;

    const final = fixture.matchState === "FullTime";
    const tryScorers = final ? await fetchTryScorers(fixture.matchCentreUrl ?? "") : null;

    byKey.set(matchKey(home, away), {
      homeTeam: home,
      awayTeam: away,
      homeScore: Number(fixture.homeTeam?.score),
      awayScore: Number(fixture.awayTeam?.score),
      tryScorers,
      final,
    });
  }
  return byKey;
}

const matchKey = (home: string, away: string) =>
  `${home}__${away}`.toLowerCase().replace(/[^a-z_]/g, "");

async function main() {
  console.log(`Settling RLWC round ${ROUND}${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const results = await fetchResults(ROUND);
  const finals = [...results.values()].filter((r) => r.final);
  console.log(`NRL feed: ${results.size} fixture(s), ${finals.length} final\n`);

  const picks = await supabase(
    "picks?select=id,market,selection,point,entry_odds,stake_units,result_status," +
      "fixture:fixtures(home_team,away_team)&order=market",
  );

  const legsByPick = new Map<string, any[]>();
  for (const leg of (await supabase("pick_legs?select=pick_id,leg_index,market,selection,point&order=leg_index")) ?? []) {
    const existing = legsByPick.get(leg.pick_id);
    if (existing) existing.push(leg);
    else legsByPick.set(leg.pick_id, [leg]);
  }

  const coreTracker: TrackerPick[] = [];
  const sgmTracker: TrackerPick[] = [];
  const tryTracker: TrackerPick[] = [];

  for (const pick of picks ?? []) {
    const fixture = pick.fixture;
    if (!fixture) continue;
    const result = results.get(matchKey(fixture.home_team, fixture.away_team)) ?? null;

    const stake = Number(pick.stake_units) || 1;
    const odds = Number(pick.entry_odds);
    const legs = legsByPick.get(pick.id) ?? [];

    const settlement =
      pick.market === "sgm"
        ? settleMultiPick(
            { odds, stake, legs: legs.map((l) => ({ market: l.market, selection: l.selection, point: l.point })) },
            result,
          )
        : settleSinglePick(
            { market: pick.market, selection: pick.selection, point: pick.point, odds, stake },
            result,
          );

    const entry: TrackerPick = { label: pick.selection, odds, stake, settlement };
    if (pick.market === "sgm") sgmTracker.push(entry);
    else if (pick.market === "anytime_try" || pick.market === "first_try") tryTracker.push(entry);
    else coreTracker.push(entry);

    const legNote = settlement.legStatuses.length > 1
      ? `  [${settlement.legStatuses.join(", ")}]` : "";
    console.log(
      `  ${pick.market.padEnd(12)} ${String(pick.selection).slice(0, 44).padEnd(45)} ` +
        `$${odds.toFixed(2)}  ${settlement.status.toUpperCase().padEnd(8)}` +
        `${settlement.profitUnits === null ? "" : ` ${settlement.profitUnits >= 0 ? "+" : ""}${settlement.profitUnits.toFixed(2)}u`}${legNote}`,
    );

    if (DRY_RUN || settlement.status === "pending") continue;
    if (pick.result_status !== "pending") continue;

    await supabase(`picks?id=eq.${pick.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        result_status: settlement.status,
        units_returned: settlement.unitsReturned,
        settled_at: new Date().toISOString(),
      }),
    });

    for (let i = 0; i < legs.length; i++) {
      const status = settlement.legStatuses[i];
      if (!status || status === "pending") continue;
      await supabase(`pick_legs?pick_id=eq.${pick.id}&leg_index=eq.${legs[i].leg_index}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ result_status: status }),
      });
    }
  }

  const report = (name: string, rows: TrackerPick[]) => {
    const t = buildTracker(rows);
    console.log(`\n${name}`);
    console.log(`  settled ${t.settled}  pending ${t.pending}  W-L ${t.wins}-${t.losses}` +
      (t.pushes ? `  push ${t.pushes}` : "") + (t.voids ? `  void ${t.voids}` : ""));
    console.log(`  staked ${t.staked.toFixed(2)}u   profit ${t.profitUnits >= 0 ? "+" : ""}${t.profitUnits.toFixed(2)}u` +
      `   ROI ${t.roiPct === null ? "—" : `${t.roiPct.toFixed(1)}%`}` +
      `   strike ${t.strikeRatePct === null ? "—" : `${t.strikeRatePct.toFixed(0)}%`}`);
  };

  report("CORE PLAYS", coreTracker);
  report("SAME GAME MULTIS", sgmTracker);
  report("TRY SCORERS", tryTracker);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
