/**
 * Sharp anchor — derives a true-probability reference from exchange back and
 * lay prices.
 *
 * WHY MIDPOINT, NOT ONE SIDE
 *
 * On an exchange, unmatched orders display on the opposite side from the intent
 * that created them:
 *
 *   available BACK price  <- posted by someone offering to LAY   (shorter)
 *   available LAY  price  <- posted by someone offering to BACK   (longer)
 *
 * So the lay price genuinely is backer demand. But it is an *unmatched* order —
 * an aspiration, not a transaction — and it is systematically long. The
 * decisive evidence is what each side sums to across a market:
 *
 *   back side  > 100%  (overround)   -> every outcome looks MORE likely than it is
 *   lay  side  < 100%  (underround)  -> every outcome looks LESS likely than it is
 *
 * A set of probabilities that does not sum to 1 is not a probability
 * distribution. The truth sits between the two sides, so we take the midpoint
 * and then normalise.
 *
 * UNWEIGHTED, FOR NOW
 *
 * The ideal is a midpoint volume-weighted toward the deeper side. The-odds-api
 * v4 returns only {name, price} with no size field, so depth is unavailable
 * without a direct exchange integration. An unweighted midpoint treats a $50
 * unmatched order the same as a $20,000 one — which is tolerable on a liquid
 * market and misleading on a thin one.
 *
 * THE SPREAD GATE
 *
 * That is what `maxSpreadPct` protects against. A wide back/lay spread means
 * the two sides disagree so much that their midpoint carries little
 * information. Rather than publish a fair price we cannot justify, we refuse to
 * produce an anchor at all and return null. Callers must fail closed: no
 * anchor means no value calculation and no play, never an invented price.
 *
 * The gate uses the WIDEST outcome in the market, not the average: one
 * untrustworthy leg makes the whole book's midpoint unreliable, and averaging
 * would let a tight favourite mask a meaningless longshot quote.
 */

export interface PriceOutcome {
  name: string;
  price: number;
}

export interface OutcomeProbability {
  name: string;
  probability: number;
}

export interface SharpAnchor {
  /** De-vigged probabilities, in percent, summing to 100. */
  probabilities: OutcomeProbability[];
  /** Normalised midpoint prices, before conversion to probability. */
  midpoint: PriceOutcome[];
  /** Widest back/lay spread in the market, in percent. For measurement. */
  maxSpreadPct: number;
}

export interface ResolveSharpAnchorInput {
  /** `h2h` market outcomes from the exchange. */
  back: PriceOutcome[];
  /** `h2h_lay` market outcomes from the exchange. */
  lay: PriceOutcome[];
  /** Reject the anchor when the widest spread exceeds this percentage. */
  maxSpreadPct: number;
}

/** A decimal price must be finite and strictly greater than 1 to be real. */
function isValidPrice(price: unknown): price is number {
  return Number.isFinite(price) && Number(price) > 1;
}

/**
 * Back/lay spread as a percentage of the back price.
 * Never negative: a crossed book is reported as 0 width.
 */
export function spreadPct(backPrice: number, layPrice: number): number {
  if (!isValidPrice(backPrice) || !isValidPrice(layPrice)) return Number.NaN;
  return Math.max(0, ((layPrice - backPrice) / backPrice) * 100);
}

/**
 * Per-outcome arithmetic midpoint of back and lay.
 * Returns null unless both sides are present, non-empty and cover exactly the
 * same outcomes with valid prices.
 */
export function midpointPrices(
  back: PriceOutcome[],
  lay: PriceOutcome[],
): PriceOutcome[] | null {
  if (!Array.isArray(back) || !Array.isArray(lay)) return null;
  if (back.length === 0 || lay.length === 0) return null;
  if (back.length !== lay.length) return null;

  const midpoint: PriceOutcome[] = [];
  for (const backOutcome of back) {
    const layOutcome = lay.find((o) => o?.name === backOutcome?.name);
    if (!layOutcome) return null;
    if (!isValidPrice(backOutcome.price) || !isValidPrice(layOutcome.price)) return null;
    midpoint.push({
      name: backOutcome.name,
      price: (Number(backOutcome.price) + Number(layOutcome.price)) / 2,
    });
  }
  return midpoint;
}

/**
 * Resolve a sharp probability anchor, or null when it cannot be trusted.
 *
 * Fails closed when: either side is missing, outcomes do not match, any price
 * is invalid, or the widest spread exceeds `maxSpreadPct`.
 */
export function resolveSharpAnchor(
  input: ResolveSharpAnchorInput,
): SharpAnchor | null {
  const { back, lay, maxSpreadPct } = input ?? ({} as ResolveSharpAnchorInput);
  if (!Number.isFinite(maxSpreadPct) || Number(maxSpreadPct) <= 0) return null;

  const midpoint = midpointPrices(back, lay);
  if (!midpoint) return null;

  // Gate on the widest outcome: one unreliable leg spoils the whole book.
  let widest = 0;
  for (const backOutcome of back) {
    const layOutcome = lay.find((o) => o?.name === backOutcome?.name);
    if (!layOutcome) return null;
    const width = spreadPct(Number(backOutcome.price), Number(layOutcome.price));
    if (!Number.isFinite(width)) return null;
    if (width > widest) widest = width;
  }
  if (widest > maxSpreadPct) return null;

  // Midpoint still carries a small residual margin; normalise to a true
  // distribution. Multiplicative is appropriate here because an exchange
  // midpoint's residual is tiny and close to symmetric, unlike a bookmaker's
  // favourite-longshot-biased overround.
  const rawProbabilities = midpoint.map((outcome) => ({
    name: outcome.name,
    probability: 100 / outcome.price,
  }));
  const total = rawProbabilities.reduce((t, p) => t + p.probability, 0);
  if (!Number.isFinite(total) || total <= 0) return null;

  return {
    probabilities: rawProbabilities.map((p) => ({
      name: p.name,
      probability: (p.probability / total) * 100,
    })),
    midpoint,
    maxSpreadPct: widest,
  };
}
