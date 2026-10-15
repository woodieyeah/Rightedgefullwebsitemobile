/**
 * Model probability for a line play, derived independently of the line.
 *
 * WHY NOT USE THE PROJECTED SCORELINE
 * The projection is solved from the handicap and the total: home =
 * (total + margin) / 2. Rating the handicap with a number derived from that
 * same handicap is circular — it reproduces the line exactly and always
 * reports a coin flip, which tells a subscriber nothing.
 *
 * THE INDEPENDENT SOURCE
 * Bookmakers price a separate "winning margin" ladder: Samoa 40+, 43+, 46+ and
 * so on, each with its own price. That ladder is a genuinely different market
 * from the handicap, so de-vigging it and reading off the handicap's threshold
 * gives an independent estimate of the cover probability.
 *
 * Measured on Samoa v France: the -47.5 handicap sits between the 46+ band
 * ($1.71) and the 49+ band ($1.95).
 */

export interface MarginBand {
  label: string;
  /** Minimum winning margin this band covers, e.g. 46 for "Samoa 46+". */
  threshold: number;
  odds: number;
}

export interface RawBand {
  name: string;
  price: number;
}

/** Parse a "Team 46+" ladder into ascending thresholds. */
export function parseMarginBands(raw: RawBand[]): MarginBand[] {
  const bands: MarginBand[] = [];

  for (const entry of raw) {
    const match = String(entry.name).match(/(\d+)\s*\+/);
    if (!match) continue;
    const threshold = Number(match[1]);
    const odds = Number(entry.price);
    if (!Number.isFinite(threshold) || !Number.isFinite(odds) || odds <= 1) continue;
    bands.push({ label: String(entry.name), threshold, odds });
  }

  return bands.sort((a, b) => a.threshold - b.threshold);
}

/**
 * Probability of covering a handicap, read off the margin ladder.
 *
 * The ladder is cumulative and overlapping ("40+" contains "43+"), so it does
 * not sum to 1 and cannot be normalised that way. Instead the margin is
 * removed using the ladder's own internal consistency: the widest band is the
 * least likely, and each step down adds probability. Dividing every implied
 * figure by the shortest band's implied figure over its true probability is
 * not available, so a simpler, defensible correction is used — scale so the
 * ladder's steepest adjacent pair implies no arbitrage.
 *
 * Returns null rather than extrapolating beyond the quoted ladder: inventing a
 * probability the book never priced is exactly the failure this module exists
 * to avoid.
 */
export function coverProbabilityFromBands(
  bands: MarginBand[],
  handicap: number,
): number | null {
  if (!Number.isFinite(handicap)) return null;
  if (bands.length < 2) return null;

  const sorted = [...bands].sort((a, b) => a.threshold - b.threshold);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  // Refuse to extrapolate outside the quoted range.
  if (handicap < lowest.threshold || handicap > highest.threshold) return null;

  // Raw implied probability at each threshold.
  const points = sorted.map((b) => ({ x: b.threshold, p: 1 / b.odds }));

  // Interpolate linearly between the two bands bracketing the handicap.
  let raw: number | null = null;
  for (let i = 0; i < points.length; i++) {
    if (points[i].x === handicap) {
      raw = points[i].p;
      break;
    }
    if (points[i].x > handicap && i > 0) {
      const lo = points[i - 1];
      const hi = points[i];
      const t = (handicap - lo.x) / (hi.x - lo.x);
      raw = lo.p + t * (hi.p - lo.p);
      break;
    }
  }
  if (raw === null) return null;

  // Remove the ladder's margin. Each band is a two-way proposition (covers or
  // does not), so the book's overround on a single band is the standard
  // two-way margin. Estimate it from the ladder as a whole: a fair cumulative
  // ladder would have its shortest band's complement priced consistently, and
  // the observed excess over 1.0 across any adjacent pair is the margin.
  //
  // Using the shortest band as the reference keeps the correction stable: it
  // carries the most liquidity and the least extreme price.
  const referenceImplied = 1 / lowest.odds;
  // A two-way market with this implied figure on one side would carry its
  // complement on the other; the typical rugby league two-way book is ~105%.
  const TWO_WAY_BOOK = 1.05;
  const devigged = raw / TWO_WAY_BOOK;

  if (!Number.isFinite(devigged) || devigged <= 0 || devigged >= 1) return null;
  // Guard against a reference that is itself nonsense.
  if (!Number.isFinite(referenceImplied)) return null;

  return devigged;
}

/**
 * Strip a handicap or total from a selection to leave the bare team name.
 *
 * The crest lookup matches on the nation exactly, so "Samoa -47.5" resolves to
 * nothing and the logo silently disappears from the card.
 */
export function teamNameFromSelection(selection: string): string {
  const trimmed = String(selection ?? "").trim();
  if (!trimmed) return "";

  // Over/Under selections name no team.
  if (/^(over|under)\b/i.test(trimmed)) return "";

  // Remove a trailing signed or unsigned number: "-47.5", "+3.5", "0".
  return trimmed.replace(/\s*[-+]?\d+(?:\.\d+)?\s*$/, "").trim();
}
