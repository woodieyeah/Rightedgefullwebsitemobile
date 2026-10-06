/**
 * Projected scoreline from a sharp line and total.
 *
 * The market prices two things we can solve for a scoreline:
 *
 *     home + away = total      (the totals market)
 *     home - away = margin     (the handicap market)
 *
 * Adding gives home = (total + margin) / 2; subtracting gives
 * away = (total - margin) / 2. The plus and minus are not a statement about
 * home advantage — they fall out of the algebra. The sign lives entirely in
 * `margin`, which is expressed from the HOME team's perspective.
 *
 * HANDICAP vs MARGIN
 * A handicap is what a team must overcome; a margin is what it is expected to
 * win by. They are negatives of each other: a home favourite is quoted at -6.5
 * and has an expected margin of +6.5. resolveHomeMargin does that conversion.
 *
 * WHY NAME MATCHING MATTERS
 * The handicap is looked up by home-team NAME, never by array position. Feeds
 * do not guarantee ordering, and a positional read silently inverts every
 * projection whenever the away team is listed first — producing a confident,
 * well-formatted, exactly-wrong scoreline. The same hazard is guarded in
 * score-feed.ts for results.
 *
 * This module is pure: no network, no clock, no I/O.
 */

export interface SpreadOutcome {
  name: string;
  point?: number | null;
}

export interface TotalOutcome {
  name: string;
  point?: number | null;
}

export interface ProjectedScore {
  home: number;
  away: number;
  /** Expected winning margin, signed from the home team's perspective. */
  margin: number;
  /** Expected combined score. */
  total: number;
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Convert a handicap market into an expected margin for the home team.
 *
 * Returns null when the home team is absent or the point is unusable — never a
 * guess, and never zero as a stand-in for "unknown". Zero is a real pick-em
 * line and must stay distinguishable from missing data.
 */
export function resolveHomeMargin(
  spreads: SpreadOutcome[],
  homeTeam: string,
): number | null {
  if (!homeTeam || !homeTeam.trim()) return null;
  if (!Array.isArray(spreads) || !spreads.length) return null;

  const target = normalise(homeTeam);
  const match = spreads.find(
    (outcome) => outcome && typeof outcome.name === "string" && normalise(outcome.name) === target,
  );
  if (!match) return null;

  const point = Number(match.point);
  if (!Number.isFinite(point)) return null;

  // A -6.5 handicap means the home team is expected to win by 6.5.
  // `|| 0` collapses negative zero: negating a pick-em 0 yields -0, which is
  // arithmetically equal to 0 but fails Object.is comparisons and can render
  // as "-0" in a scoreline.
  return -point || 0;
}

/** Read the combined-score line from a totals market. Over and Under share it. */
export function resolveTotal(totals: TotalOutcome[]): number | null {
  if (!Array.isArray(totals) || !totals.length) return null;

  for (const outcome of totals) {
    const point = Number(outcome?.point);
    if (Number.isFinite(point) && point > 0) return point;
  }
  return null;
}

/**
 * Solve for the projected scoreline.
 *
 * Returns null unless both market inputs are present and coherent. A missing
 * projection renders as an em dash; a fabricated one would be indistinguishable
 * from a real model output.
 */
export function projectScoreline(input: {
  homeTeam: string;
  spreads: SpreadOutcome[];
  totals: TotalOutcome[];
}): ProjectedScore | null {
  const margin = resolveHomeMargin(input.spreads, input.homeTeam);
  if (margin === null) return null;

  const total = resolveTotal(input.totals);
  if (total === null) return null;

  // A margin wider than the total would imply a negative score for the
  // underdog, which means the two markets disagree or one was misread.
  if (Math.abs(margin) > total) return null;

  return {
    home: (total + margin) / 2,
    away: (total - margin) / 2,
    margin,
    total,
  };
}
