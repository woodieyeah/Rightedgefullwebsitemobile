/**
 * Import player headshots from NRL.com match centre pages.
 *
 * Each page embeds its squad list with a `headImage` per player — a
 * transparent-background portrait that crops cleanly to a circular avatar.
 * URLs are stored rather than the images themselves: ~300KB each, already on
 * HTTPS, so re-hosting buys nothing.
 *
 * rlwc2026.com was checked and carries no squad headshots, only editorial
 * photography and competition logos.
 *
 * Usage:
 *   npx tsx scripts/import_headshots.ts [--round N] [--dry-run]
 */

import {
  headshotIndex,
  normalisePlayerName,
  parseHeadshots,
} from "../src/model/player-headshots.ts";

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
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Importing headshots for round ${ROUND}${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const draw = await (await fetch(
    `https://www.nrl.com/draw/data?competition=${NRL_COMPETITION}&round=${ROUND}&season=${SEASON}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } },
  )).json();

  const rows: any[] = [];
  const seen = new Set<string>();

  for (const fixture of draw.fixtures ?? []) {
    const url = fixture.matchCentreUrl;
    if (!url) continue;

    const res = await fetch(`https://www.nrl.com${url}`, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.log(`  ${url} -> HTTP ${res.status}, skipped`);
      continue;
    }

    const players = parseHeadshots(await res.text());
    const label = `${fixture.homeTeam?.nickName} v ${fixture.awayTeam?.nickName}`;
    console.log(`  ${label.padEnd(34)} ${players.length} headshot(s)`);

    for (const player of players) {
      const key = normalisePlayerName(player.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        name_key: key,
        display_name: player.name,
        position: player.position || null,
        image_url: player.url,
        competition: "rlwc",
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(`\n${rows.length} distinct player(s)`);

  if (DRY_RUN) {
    for (const r of rows.slice(0, 8)) {
      console.log(`  ${r.display_name.padEnd(26)} ${(r.position ?? "").padEnd(13)} ${r.image_url.slice(0, 70)}`);
    }
    console.log(`\nWould upsert ${rows.length} row(s)`);
    return;
  }

  // Upsert so a re-run refreshes URLs without duplicating players.
  await supabase("player_headshots?on_conflict=name_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  console.log(`Upserted ${rows.length} row(s)`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
