/**
 * Published picks for RLWC match cards.
 *
 * Reads `public_picks`, a view exposing only what a subscriber sees: selection,
 * price, model probability and settled result. Edge, closing odds and staking
 * are not in the view at all.
 *
 * Fails soft: an unreachable endpoint returns no picks and the card renders its
 * projection without a play, exactly as it did before picks existed.
 */

const SUPABASE_URL = "https://spahmuawycgohcznathc.supabase.co";

export interface PickLeg {
  selection: string;
  market: string;
  odds: number;
  result: "pending" | "win" | "loss" | "push" | "void";
}

export interface PublicPick {
  id: string;
  fixture_id: string;
  match_key: string;
  competition: string;
  market: "h2h" | "line" | "total" | "anytime_try" | "first_try" | "sgm";
  selection: string;
  point: number | null;
  entry_odds: number;
  entry_bookmaker: string;
  model_probability: number | null;
  /**
   * De-vigged market probability. Never derive this from 1 / entry_odds: on a
   * multi-runner market the overround is enormous (a 40-player try-scorer book
   * sums to 933%) and the raw figure overstates every runner.
   */
  market_probability: number | null;
  result_status: "pending" | "win" | "loss" | "push" | "void";
  profit_units: number | null;
  published_at: string;
  legs: PickLeg[];
}

/** Fetch published picks for a competition. Returns [] on any failure. */
export async function fetchCompetitionPicks(
  competition: string,
  anonKey: string,
): Promise<PublicPick[]> {
  if (!anonKey) return [];

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/public_picks` +
      `?competition=eq.${encodeURIComponent(competition)}` +
      `&order=published_at.asc`;

    const response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) return [];

    const rows = await response.json();
    return Array.isArray(rows) ? (rows as PublicPick[]) : [];
  } catch {
    return [];
  }
}

/**
 * Only picks still awaiting a result belong on a match card.
 *
 * A settled pick stays in the ledger and the result trackers, but showing it
 * as a live selection would advertise a bet that can no longer be placed.
 */
export function selectPendingPicks(picks: PublicPick[]): PublicPick[] {
  return picks.filter((pick) => pick.result_status === "pending");
}

/** Group picks by fixture so a card can look up its own. */
export function picksByFixture(picks: PublicPick[]): Map<string, PublicPick[]> {
  const byFixture = new Map<string, PublicPick[]>();
  for (const pick of picks) {
    const existing = byFixture.get(pick.fixture_id);
    if (existing) existing.push(pick);
    else byFixture.set(pick.fixture_id, [pick]);
  }
  return byFixture;
}

/**
 * The single play a card headlines.
 *
 * Preference order: the head-to-head Core Play, then a line or total, then a
 * multi. Try-scorer picks are shown in their own strip, never as the headline.
 */
export function selectCorePlay(picks: PublicPick[]): PublicPick | null {
  const order: PublicPick["market"][] = ["h2h", "line", "total", "sgm"];
  for (const market of order) {
    const found = picks.find((p) => p.market === market);
    if (found) return found;
  }
  return null;
}

export function selectSgm(picks: PublicPick[]): PublicPick | null {
  return picks.find((p) => p.market === "sgm" && p.legs.length >= 2) ?? null;
}

export function selectTryScorers(picks: PublicPick[]): PublicPick[] {
  return picks
    .filter((p) => p.market === "anytime_try" || p.market === "first_try")
    .sort((a, b) => a.entry_odds - b.entry_odds);
}

/**
 * Format a pick's selection with its line, e.g. "Australia -3.5".
 * A zero point is a real pick-em line and is rendered; null is omitted.
 */
export function describeSelection(pick: PublicPick): string {
  if (pick.point === null || pick.point === undefined) return pick.selection;
  const sign = pick.point > 0 ? "+" : "";
  return `${pick.selection} ${sign}${pick.point}`;
}
