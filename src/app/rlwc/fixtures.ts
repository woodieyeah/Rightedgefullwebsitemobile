import { fetchWithTimeout } from "../../model/fetch-timeout.ts";
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

/**
 * RLWC reads get a longer budget than the generic sheet default.
 *
 * The sheets are optional decoration now, so 12s is right for them. RLWC is
 * the product: if these reads fail the page has nothing to show, so they are
 * given room to succeed on a slow connection rather than failing fast.
 */
export const RLWC_FETCH_TIMEOUT_MS = 30_000;
export const RLWC_FETCH_ATTEMPTS = 3;

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
  // Latest model output, null until the prediction worker has run for this
  // fixture. The projected score is the MODEL's view, entirely separate from
  // home_score/away_score, which are the actual result.
  projected_home_score: number | null;
  projected_away_score: number | null;
  home_win_probability: number | null;
  away_win_probability: number | null;
  model_version: string | null;
  prediction_at: string | null;
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

  const url =
    `${SUPABASE_URL}/rest/v1/public_fixtures` +
    `?competition=eq.${encodeURIComponent(competition)}` +
    `&order=kickoff_at.asc`;

  // RLWC is the live product, and the entire card — plays, multis and result
  // trackers — is skipped when this returns empty. A single slow response on a
  // degraded connection therefore blanked the whole page, so this retries on a
  // longer budget instead of giving up after one 12s attempt.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < RLWC_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        timeoutMs: RLWC_FETCH_TIMEOUT_MS,
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const rows = await response.json();
      return Array.isArray(rows) ? (rows as PublicFixture[]) : [];
    } catch (error) {
      lastError = error;
    }
  }

  // Returning [] hides the whole product, so it must never pass unremarked.
  console.error(
    `RLWC fixtures unavailable after ${RLWC_FETCH_ATTEMPTS} attempts; ` +
      `plays, multis and trackers will not render.`,
    lastError,
  );
  return [];
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
