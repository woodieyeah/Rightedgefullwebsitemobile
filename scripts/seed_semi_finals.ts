/**
 * Seed the two semi-finals.
 *
 * Only the 15 pool fixtures were seeded; the knockout matchups depended on
 * pool results and are now known. Both NRL.com and BlueBet agree on the
 * pairings, so the fixtures are written from the NRL draw feed (the same
 * source the settler reads) rather than typed in by hand.
 *
 * `match_key` is alphabetised, matching every existing row — the settler and
 * the publisher both look fixtures up by that key.
 *
 * Usage: npx tsx scripts/seed_semi_finals.ts [--dry-run]
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const NRL_DRAW = "https://www.nrl.com/draw/data?competition=131&round=4&season=2026";

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

const slug = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

async function main() {
  const res = await fetch(NRL_DRAW, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`NRL draw HTTP ${res.status}`);
  const draw = await res.json();

  const competition = (await supabase("competitions?code=eq.rlwc&select=id"))?.[0];
  if (!competition) throw new Error("rlwc competition row not found");

  const rows: any[] = [];
  for (const f of draw.fixtures ?? []) {
    const home = f.homeTeam?.nickName;
    const away = f.awayTeam?.nickName;
    const kickoff = f.clock?.kickOffTimeLong ?? f.kickOffTimeLong;
    if (!home || !away || !kickoff) {
      console.log(`  skipped an incomplete fixture row: ${home ?? "?"} v ${away ?? "?"}`);
      continue;
    }
    const match_key = [slug(home), slug(away)].sort().join("__");

    const existing = await supabase(`fixtures?match_key=eq.${match_key}&select=id`);
    if (existing?.length) {
      console.log(`  ${home} v ${away}: already seeded`);
      continue;
    }

    rows.push({
      competition_id: competition.id,
      round_number: 4,
      round_label: draw.selectedRoundTitle ?? f.roundTitle ?? "Semi Final",
      home_team: home,
      away_team: away,
      match_key,
      kickoff_at: new Date(kickoff).toISOString(),
      venue_timezone: "Australia/Sydney",
      stadium: f.venue ?? null,
      status: "scheduled",
    });
    console.log(`  ${home} v ${away}  ${new Date(kickoff).toISOString()}  ${f.venue ?? "?"}  key ${match_key}`);
  }

  if (!rows.length) { console.log("\n  nothing to seed."); return; }
  if (DRY_RUN) { console.log(`\n  DRY RUN: ${rows.length} fixture(s) would be written.`); return; }

  const written = await supabase("fixtures", { method: "POST", body: JSON.stringify(rows) });
  console.log(`\n  seeded ${written.length} fixture(s).`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
