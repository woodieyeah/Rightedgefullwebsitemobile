/**
 * Score feed — automated result ingestion.
 *
 * RightEdge has never had this: results arrive from a feed, not from a human
 * typing a score into a form. That matters for two reasons.
 *
 *   1. Settlement that depends on manual entry does not happen. Picks sit
 *      unsettled, profitability is never computed, and the record rots.
 *   2. A typed score can be wrong, and a wrong score silently produces a wrong
 *      P&L that looks authoritative.
 *
 * Source: the-odds-api `/v4/sports/{sport}/scores/`, which returns
 * `{ completed, scores: [{ name, score }], last_update }` per event.
 *
 * SAFETY RULES
 *
 * - Only `completed === true` with two valid numeric scores becomes a
 *   settleable result. A live score is NEVER settleable: settling at half time
 *   would permanently lock in the wrong outcome.
 * - Scores are matched to teams BY NAME, never by array position. The feed does
 *   not guarantee ordering, and a positional read silently inverts results.
 * - Any missing, non-numeric or malformed value yields status `error` and is
 *   excluded. We would rather show "not settled" than a confident wrong number.
 */

import type { MatchResult } from "./pick-ledger";

export type ScoreStatus = "scheduled" | "live" | "final" | "error";

export interface ParsedScore {
  eventId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: ScoreStatus;
  commenceTime: string | null;
  lastUpdate: string | null;
}

/** Mirrors the server's normalizeServerMatchKey and the ledger's key format. */
export function buildMatchKey(homeTeam: string, awayTeam: string): string {
  const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return [norm(homeTeam), norm(awayTeam)].sort((a, b) => a.localeCompare(b)).join("__");
}

function readScore(
  scores: { name?: string; score?: string | number }[] | null | undefined,
  team: string,
): number | null {
  if (!Array.isArray(scores)) return null;
  const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const row = scores.find((s) => norm(String(s?.name ?? "")) === norm(team));
  if (!row) return null;
  const value = Number(row.score);
  return Number.isFinite(value) ? value : null;
}

/** Parse the raw scores feed into typed rows. Never throws. */
export function parseScoresFeed(events: any[] | null | undefined): ParsedScore[] {
  if (!Array.isArray(events)) return [];

  return events.map((ev) => {
    const homeTeam = String(ev?.home_team ?? "");
    const awayTeam = String(ev?.away_team ?? "");
    const base = {
      eventId: String(ev?.id ?? ""),
      matchKey: homeTeam && awayTeam ? buildMatchKey(homeTeam, awayTeam) : "",
      homeTeam,
      awayTeam,
      commenceTime: ev?.commence_time ?? null,
      lastUpdate: ev?.last_update ?? null,
    };

    if (!homeTeam || !awayTeam) {
      return { ...base, homeScore: null, awayScore: null, status: "error" as const };
    }

    const homeScore = readScore(ev?.scores, homeTeam);
    const awayScore = readScore(ev?.scores, awayTeam);
    const bothPresent = homeScore !== null && awayScore !== null;
    const completed = ev?.completed === true;

    // Flagged complete but unreadable -> error, never a guess.
    if (completed && !bothPresent) {
      return { ...base, homeScore: null, awayScore: null, status: "error" as const };
    }
    if (completed) {
      return { ...base, homeScore, awayScore, status: "final" as const };
    }
    // Partial scores mid-match: report them for display, but never settleable.
    if (bothPresent) {
      return { ...base, homeScore, awayScore, status: "live" as const };
    }
    if (ev?.scores != null && !bothPresent) {
      return { ...base, homeScore: null, awayScore: null, status: "error" as const };
    }
    return { ...base, homeScore: null, awayScore: null, status: "scheduled" as const };
  });
}

/**
 * Reduce parsed scores to settleable results.
 * ONLY final matches with two valid scores survive.
 */
export function toMatchResults(parsed: ParsedScore[]): MatchResult[] {
  return parsed
    .filter(
      (p) =>
        p.status === "final" &&
        Number.isFinite(p.homeScore) &&
        Number.isFinite(p.awayScore) &&
        p.matchKey !== "",
    )
    .map((p) => ({
      matchKey: p.matchKey,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      homeScore: p.homeScore as number,
      awayScore: p.awayScore as number,
    }));
}
