/**
 * De-vig an anytime try-scorer market.
 *
 * WHY THE USUAL DE-VIG IS WRONG HERE
 * Two-way markets are mutually exclusive, so removing margin means scaling the
 * implied probabilities to sum to 1. Anytime try scorer is not exclusive —
 * roughly six different players score in a match — so its prices legitimately
 * sum far above 100%.
 *
 * Measured on the RLWC opener: TAB's 40-player market sums to 933%. Scaling
 * that to 100% rates Cameron Munster, a $5.00 shot, at 2.1%. Comparing a model
 * figure against that would make every selection look like enormous value, and
 * comparing against the RAW 20.0% would make the same selection look negative.
 * Both are wrong in opposite directions.
 *
 * THE CORRECT TARGET
 * The probabilities should sum to the expected number of DISTINCT try scorers,
 * which is derived from the match's total points line:
 *
 *   expected tries    = total points / points per try including conversions
 *   distinct scorers  = tries x (1 - doubles rate)
 *
 * Both constants are fitted to NRL scoring, documented below, and deliberately
 * conservative.
 */

export interface MarketPrice {
  name: string;
  odds: number;
}

export interface DevigResult {
  name: string;
  odds: number;
  /** De-vigged probability of scoring at least one try. */
  probability: number;
}

/**
 * Average points yielded per try, including the conversion attempt and the
 * share of points that arrive as penalties and field goals.
 *
 * A try is 4, a conversion 2 at roughly 75% success, and penalties/field goals
 * add points without a try. 5.4 reproduces observed NRL try counts: a 38.5
 * total implies ~7.1 tries, which matches the league average for a total in
 * that range.
 */
const POINTS_PER_TRY = 5.4;

/**
 * Share of tries scored by a player who already scored in the match. Wingers
 * and fullbacks score doubles often enough that distinct scorers run about 13%
 * below total tries.
 */
const DOUBLES_RATE = 0.13;

export function expectedTries(totalPoints: number): number {
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) return 0;
  return totalPoints / POINTS_PER_TRY;
}

export function expectedDistinctScorers(tries: number): number {
  if (!Number.isFinite(tries) || tries <= 0) return 0;
  return tries * (1 - DOUBLES_RATE);
}

/**
 * Scale a try-scorer market so its probabilities sum to the expected number of
 * distinct scorers.
 *
 * Throws when the total points line is unusable: without it there is no
 * defensible normalisation target, and inventing one would silently produce
 * wrong probabilities on a published card.
 */
export function devigAnytimeTryMarket(
  prices: MarketPrice[],
  totalPoints: number,
): DevigResult[] {
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    throw new Error(
      `a total points line is required to de-vig a try-scorer market, got ${totalPoints}`,
    );
  }

  const usable = prices.filter((p) => Number.isFinite(p.odds) && p.odds > 1);
  if (!usable.length) return [];

  const rawSum = usable.reduce((sum, p) => sum + 1 / p.odds, 0);
  if (rawSum <= 0) return [];

  const target = expectedDistinctScorers(expectedTries(totalPoints));
  // Scaling up would mean the book's prices are collectively more generous
  // than the expected scorer count, which does not happen in practice; cap at
  // 1 so de-vigging can only remove margin, never add value.
  const scale = Math.min(target / rawSum, 1);

  return usable.map((p) => ({
    name: p.name,
    odds: p.odds,
    probability: (1 / p.odds) * scale,
  }));
}
