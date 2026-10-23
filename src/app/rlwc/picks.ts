import { fetchWithTimeout } from "../../model/fetch-timeout.ts";
import { RLWC_FETCH_ATTEMPTS, RLWC_FETCH_TIMEOUT_MS } from "./fixtures.ts";
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
  /** The handicap or total line. Null for a try scorer, which has no line. */
  point: number | null;
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

  const url =
    `${SUPABASE_URL}/rest/v1/public_picks` +
    `?competition=eq.${encodeURIComponent(competition)}` +
    `&order=published_at.asc`;

  // Same reasoning as the fixtures read: an empty result removes every play
  // and multi from the page, so a slow connection must not decide the
  // product is gone after a single attempt.
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
      return Array.isArray(rows) ? (rows as PublicPick[]) : [];
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    `RLWC picks unavailable after ${RLWC_FETCH_ATTEMPTS} attempts; ` +
      `no plays or multis will render.`,
    lastError,
  );
  return [];
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

/**
 * The picks a match card should show.
 *
 * Settled picks are kept, not filtered out. Dropping them blanked the card the
 * instant a match was settled, so the play a subscriber followed all day
 * disappeared with no visible outcome. A settled pick stays put and carries a
 * result badge — including a loss, which must not quietly vanish.
 */
export function selectCardPicks(picks: PublicPick[]): PublicPick[] {
  return picks;
}

/**
 * The result badge for a pick, or null while it is still running.
 *
 * Returns null for any status it does not recognise rather than guessing: a
 * card must never assert an outcome the data does not state.
 */
export function pickResultBadge(pick: PublicPick): string | null {
  switch (pick.result_status) {
    case "win":
      return "WON";
    case "loss":
      return "LOST";
    case "push":
      return "PUSH";
    case "void":
      return "VOID";
    default:
      return null;
  }
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
 * Match markets only, in preference order. A same-game multi is deliberately
 * excluded: it is a structurally different bet with a far longer price and a
 * much lower strike rate, and it has its own section and its own tracker.
 * Falling back to one here would headline a 20% three-leg multi as the main
 * play on a fixture that was published without a core play on purpose.
 *
 * Try-scorer picks are shown in their own strip, never as the headline.
 */
export function selectCorePlay(picks: PublicPick[]): PublicPick | null {
  const order: PublicPick["market"][] = ["h2h", "line", "total"];
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
 * Render a selection with its handicap or total line.
 *
 * The point is NOT optional decoration. "Samoa @ $1.90" reads as a
 * head-to-head, and Samoa's real head-to-head is $1.01 — the $1.90 is a
 * 47.5-point handicap. Dropping the point misrepresents the bet entirely.
 * A zero point is a real pick-em line and is rendered; only null is omitted.
 */
export function describeSelection(pick: PublicPick): string {
  if (pick.point === null || pick.point === undefined) return pick.selection;
  const sign = pick.point > 0 ? "+" : "";
  return `${pick.selection} ${sign}${pick.point}`;
}
