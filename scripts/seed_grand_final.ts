/**
 * Seed the grand final.
 *
 * The final is Australia v New Zealand — the SAME pairing as the Round 1
 * opener, so the alphabetised `match_key` used everywhere else
 * ("australia__newzealand") already belongs to that fixture. Reusing it would
 * make the seeder report "already seeded" and make the publisher resolve the
 * final to the opener and refuse because picks exist there.
 *
 * The final therefore gets a round-qualified key, "australia__newzealand__f".
 * Nothing reads match_key for logic — the app only carries it through, and
 * the settler now maps results via resultKey(home, away, round) — so a
 * distinct key is safe.
 *
 * Usage: npx tsx scripts/seed_grand_final.ts [--dry-run]
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const NRL_DRAW = "https://www.nrl.com/draw/data?competition=131&round=5&season=2026";

/** Distinct from the Round 1 opener, which owns "australia__newzealand". */
const FINAL_MATCH_KEY = "australia__newzealand__f";

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

async function main() {
  const res = await fetch(NRL_DRAW, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`NRL draw HTTP ${res.status}`);
  const draw = await res.json();

  const fixtures = draw.fixtures ?? [];
  if (fixtures.length !== 1) {
    throw new Error(`expected exactly one final in the round 5 feed, found ${fixtures.length}`);
  }
  const f = fixtures[0];
  const home = f.homeTeam?.nickName;
  const away = f.awayTeam?.nickName;
  const kickoff = f.clock?.kickOffTimeLong ?? f.kickOffTimeLong;
  if (!home || !away || !kickoff) throw new Error("the final's feed row is incomplete");

  const existing = await supabase(`fixtures?match_key=eq.${FINAL_MATCH_KEY}&select=id`);
  if (existing?.length) { console.log("  the final is already seeded."); return; }

  const competition = (await supabase("competitions?code=eq.rlwc&select=id"))?.[0];
  if (!competition) throw new Error("rlwc competition row not found");

  const row = {
    competition_id: competition.id,
    round_number: 5,
    round_label: f.roundTitle ?? "Final",
    home_team: home,
    away_team: away,
    match_key: FINAL_MATCH_KEY,
    kickoff_at: new Date(kickoff).toISOString(),
    venue_timezone: "Australia/Brisbane",
    stadium: f.venue ?? null,
    status: "scheduled",
  };

  console.log(`  ${home} v ${away}  ${row.kickoff_at}  ${row.stadium}  round ${row.round_number} (${row.round_label})`);
  console.log(`  match_key ${FINAL_MATCH_KEY}  (the opener owns australia__newzealand)`);

  if (DRY_RUN) { console.log("\n  DRY RUN — nothing written."); return; }

  const written = await supabase("fixtures", { method: "POST", body: JSON.stringify([row]) });
  console.log(`\n  seeded ${written.length} fixture(s).`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
