/**
 * RLWC fixture loading from Supabase.
 *
 * This is the first piece of RightEdge that reads from the database instead of
 * the Google Sheet. NRL continues to load from the sheet unchanged; RLWC
 * fixtures are fetched here and merged in, so the migration happens one
 * competition at a time rather than as a single risky switch.
 *
 * Reads `public_fixtures`, a view that exposes only fixture data. The
 * underlying tables revoke anon entirely, and picks, model predictions and odds
 * snapshots are not in the view at all — a browser cannot reach them.
 *
 * Fails soft: if Supabase is unreachable the function returns an empty list and
 * the site renders exactly as it does today. An RLWC outage must never take
 * down the NRL pages.
 */

const SUPABASE_URL = "https://spahmuawycgohcznathc.supabase.co";

export interface PublicFixture {
  id: string;
  competition: string;
  competition_name: string;
  round_number: number;
  round_label: string;
  home_team: string;
  away_team: string;
  match_key: string;
  kickoff_at: string;
  venue_timezone: string;
  stadium: string | null;
  status: "scheduled" | "live" | "final" | "abandoned" | "postponed";
  home_score: number | null;
  away_score: number | null;
}

/**
 * Format a kickoff instant in the VENUE's timezone.
 *
 * The sheet-era code inferred an offset from a timezone abbreviation
 * (`tz.includes("AEDT") ? 11 : 10`), which cannot represent a tournament
 * spanning Sydney (+11), Brisbane (+10, no DST), Perth (+8), Port Moresby (+10)
 * and Christchurch (+13). Here the instant is absolute and Intl does the
 * conversion from a real IANA zone, so every venue is correct by construction.
 */
export function formatKickoff(fixture: PublicFixture): {
  day: string;
  dateLabel: string;
  time: string;
  tzLabel: string;
} {
  const date = new Date(fixture.kickoff_at);
  const zone = fixture.venue_timezone;

  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-AU", { timeZone: zone, ...options }).format(date);

  return {
    day: part({ weekday: "long" }),
    dateLabel: part({ day: "numeric", month: "short", year: "numeric" }),
    time: part({ hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(),
    // Short zone name, e.g. AEDT / AWST / NZDT — for display only, never parsed.
    tzLabel:
      new Intl.DateTimeFormat("en-AU", { timeZone: zone, timeZoneName: "short" })
        .formatToParts(date)
        .find((p) => p.type === "timeZoneName")?.value ?? "",
  };
}

/**
 * Fetch fixtures for a competition. Returns [] on any failure.
 *
 * `anonKey` is the browser-safe publishable/anon key already shipped in the
 * bundle. It grants nothing beyond this view.
 */
export async function fetchCompetitionFixtures(
  competition: string,
  anonKey: string,
): Promise<PublicFixture[]> {
  if (!anonKey) return [];

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/public_fixtures` +
      `?competition=eq.${encodeURIComponent(competition)}` +
      `&order=kickoff_at.asc`;

    const response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) return [];

    const rows = await response.json();
    return Array.isArray(rows) ? (rows as PublicFixture[]) : [];
  } catch {
    // An RLWC fetch failure must never break the NRL pages.
    return [];
  }
}

/**
 * The fixtures to show right now: everything not yet final, plus matches that
 * finished within `recentHours` so a result stays visible briefly after
 * full time.
 */
export function selectCurrentFixtures(
  fixtures: PublicFixture[],
  now: Date = new Date(),
  recentHours = 48,
): PublicFixture[] {
  const cutoff = now.getTime() - recentHours * 60 * 60 * 1000;
  return fixtures.filter((fixture) => {
    const kickoff = new Date(fixture.kickoff_at).getTime();
    if (!Number.isFinite(kickoff)) return false;
    if (fixture.status === "final") return kickoff >= cutoff;
    return true;
  });
}

/** Group fixtures by round, preserving kickoff order within each round. */
export function groupByRound(
  fixtures: PublicFixture[],
): { roundNumber: number; roundLabel: string; fixtures: PublicFixture[] }[] {
  const rounds = new Map<number, { roundNumber: number; roundLabel: string; fixtures: PublicFixture[] }>();

  for (const fixture of fixtures) {
    const existing = rounds.get(fixture.round_number);
    if (existing) {
      existing.fixtures.push(fixture);
    } else {
      rounds.set(fixture.round_number, {
        roundNumber: fixture.round_number,
        roundLabel: fixture.round_label,
        fixtures: [fixture],
      });
    }
  }

  return [...rounds.values()].sort((a, b) => a.roundNumber - b.roundNumber);
}
