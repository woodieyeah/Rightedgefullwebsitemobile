/**
 * BlueBet market extraction: win probability, margin, and projected scoreline.
 *
 * THE DISCOVERY THIS MODULE DEPENDS ON
 * The affiliate feed (affiliate-api.bluebet.com.au) returns only 3 markets per
 * event, none of them a total — which is why RLWC looked unprojectable. The
 * site's own API (web20-api.bluebet.com.au) accepts a `GroupTypeCode` parameter
 * that the affiliate feed never advertises, and each MasterEvent payload lists
 * its available groups under `GroupLinks`:
 *
 *   G18  Popular Markets    — Match Result (h2h + handicap)
 *   G19  Margin Markets     — margin bands, winning-margin ladders
 *   G80  Totals Markets     — per-team over/under, exact-points ladder
 *   G554 Both Team Points   — symmetric each-team ladder
 *
 * Request MasterEvent?MasterEventId=X&GroupTypeCode=G80 and the totals appear.
 * That turns 3 markets into 45 and makes a projected scoreline possible.
 *
 * THREE ROUTES TO A SCORELINE, in order of directness:
 *
 *   1. per-team-totals          home and away lines are the scoreline
 *   2. home-total-plus-handicap away = home - margin
 *   3. exact-total-plus-handicap total from the de-vigged ladder, then split
 *
 * Routes 1 and 3 were validated against each other on the real opener: the
 * home line (21.5) plus handicap (3.5) implies a total of 39.5, while the
 * independent exact-points ladder implies 39.93. Two unrelated markets, under
 * half a point apart.
 *
 * Returns null rather than guessing whenever the markets are absent or
 * incoherent. An empty score box is honest; an invented one is not.
 */

export interface BlueBetOutcome {
  OutcomeName?: string;
  Points?: number | null;
  Price?: number | null;
}

export interface BlueBetEvent {
  EventName?: string;
  Outcomes?: BlueBetOutcome[];
}

export interface TwoWayProbabilities {
  first: number;
  second: number;
  /** Bookmaker margin, e.g. 0.06 for a 106% book. */
  overround: number;
}

export interface Handicap {
  /** Expected winning margin, signed from the home team's perspective. */
  margin: number;
  price: number;
}

export interface PerTeamTotals {
  homeLine: number | null;
  awayLine: number | null;
}

export interface ExactTotal {
  expectedTotal: number;
  buckets: number;
  minPoints: number;
  maxPoints: number;
}

export type ProjectionSource =
  | "per-team-totals"
  | "home-total-plus-handicap"
  | "exact-total-plus-handicap";

export interface Projection {
  home: number;
  away: number;
  margin: number;
  total: number;
  source: ProjectionSource;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Remove the bookmaker's margin from a two-way market.
 *
 * Multiplicative de-vig: fair = (1/price) / sum(1/price). Appropriate for two
 * balanced outcomes; it would misprice a long tail, which is why the exact-
 * points ladder is handled separately.
 */
export function devigTwoWay(priceA: number, priceB: number): TwoWayProbabilities | null {
  const a = Number(priceA);
  const b = Number(priceB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;

  const impliedA = 1 / a;
  const impliedB = 1 / b;
  const book = impliedA + impliedB;
  if (book <= 0) return null;

  return { first: impliedA / book, second: impliedB / book, overround: book - 1 };
}

/**
 * Read the handicap for the home team from a Match Result market.
 *
 * BlueBet packs head-to-head and handicap into one market: the h2h entries
 * carry Points = 0 and the handicap entries carry the line. Accepting a
 * zero-point entry as the handicap would project every match as a dead heat,
 * so zero is explicitly excluded. Matched by team NAME, never position.
 */
export function extractHandicap(event: BlueBetEvent, homeTeam: string): Handicap | null {
  if (!event?.Outcomes?.length || !homeTeam?.trim()) return null;

  const target = norm(homeTeam);
  for (const outcome of event.Outcomes) {
    if (!outcome?.OutcomeName || norm(outcome.OutcomeName) !== target) continue;

    const point = Number(outcome.Points);
    // Points === 0 is the head-to-head leg, not a handicap.
    if (!Number.isFinite(point) || point === 0) continue;

    const price = Number(outcome.Price);
    if (!Number.isFinite(price) || price <= 0) continue;

    // A -3.5 handicap means the home team is expected to win by 3.5.
    return { margin: -point || 0, price };
  }
  return null;
}

/** Read the head-to-head prices (the zero-point legs) for both teams. */
export function extractHeadToHead(
  event: BlueBetEvent,
  homeTeam: string,
  awayTeam: string,
): { homePrice: number; awayPrice: number } | null {
  if (!event?.Outcomes?.length) return null;

  const find = (team: string) => {
    const target = norm(team);
    for (const o of event.Outcomes!) {
      if (!o?.OutcomeName || norm(o.OutcomeName) !== target) continue;
      if (Number(o.Points) !== 0) continue;
      const price = Number(o.Price);
      if (Number.isFinite(price) && price > 0) return price;
    }
    return null;
  };

  const homePrice = find(homeTeam);
  const awayPrice = find(awayTeam);
  if (homePrice === null || awayPrice === null) return null;
  return { homePrice, awayPrice };
}

/**
 * Read per-team total lines from their market names.
 *
 * First-half markets live in the same group and must never be read as a
 * full-match total — projecting a full match from a half line would understate
 * every score by roughly half.
 */
export function extractPerTeamTotals(events: BlueBetEvent[]): PerTeamTotals | null {
  if (!Array.isArray(events) || !events.length) return null;

  let homeLine: number | null = null;
  let awayLine: number | null = null;

  for (const event of events) {
    const name = event?.EventName ?? "";
    if (/1st half|first half|half time/i.test(name)) continue;

    const match = name.match(/(home|away)\s+team\s+total\s+match\s+points.*?\+?(\d+(?:\.\d+)?)/i);
    if (!match) continue;

    const line = Number(match[2]);
    if (!Number.isFinite(line) || line <= 0) continue;

    if (/home/i.test(match[1])) homeLine = line;
    else awayLine = line;
  }

  if (homeLine === null && awayLine === null) return null;
  return { homeLine, awayLine };
}

/**
 * Expected total points from the exact-points ladder.
 *
 * The ladder is a discrete distribution over total match points. De-vigging
 * across all buckets and taking the probability-weighted mean gives a market
 * expectation that no single over/under line provides.
 *
 * The ladder covers a bounded range (33-47 on the opener), so this is a
 * CONDITIONAL expectation given the total lands in that range. The range is
 * reported so callers can judge it.
 */
export function expectedTotalFromExactMarket(event: BlueBetEvent): ExactTotal | null {
  if (!event?.Outcomes?.length) return null;

  const points: { points: number; implied: number }[] = [];
  for (const outcome of event.Outcomes) {
    const match = outcome?.OutcomeName?.match(/exactly\s+(\d+)/i);
    if (!match) continue;

    const pts = Number(match[1]);
    const price = Number(outcome.Price);
    if (!Number.isFinite(pts) || !Number.isFinite(price) || price <= 0) continue;

    points.push({ points: pts, implied: 1 / price });
  }
  if (points.length < 2) return null;

  const book = points.reduce((sum, p) => sum + p.implied, 0);
  if (book <= 0) return null;

  const expectedTotal = points.reduce((sum, p) => sum + p.points * (p.implied / book), 0);
  const all = points.map((p) => p.points);

  return {
    expectedTotal,
    buckets: points.length,
    minPoints: Math.min(...all),
    maxPoints: Math.max(...all),
  };
}

/**
 * Derive a projected scoreline, preferring the most direct market available.
 *
 * Rejects any result implying a negative score: that means the total and the
 * handicap disagree badly enough that one of them was misread.
 */
export function deriveProjection(input: {
  homeTeam: string;
  awayTeam: string;
  markets: BlueBetEvent[];
}): Projection | null {
  const { homeTeam, awayTeam, markets } = input;
  if (!Array.isArray(markets) || !markets.length) return null;

  const finish = (home: number, away: number, source: ProjectionSource): Projection | null => {
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
    if (home < 0 || away < 0) return null;
    return { home, away, margin: home - away, total: home + away, source };
  };

  // 1. Both per-team lines: the scoreline is quoted outright.
  const perTeam = extractPerTeamTotals(markets);
  if (perTeam?.homeLine != null && perTeam?.awayLine != null) {
    return finish(perTeam.homeLine, perTeam.awayLine, "per-team-totals");
  }

  // The remaining routes need a handicap.
  let handicap: Handicap | null = null;
  for (const market of markets) {
    handicap = extractHandicap(market, homeTeam);
    if (handicap) break;
  }
  if (!handicap) return null;

  // 2. Home line plus handicap.
  if (perTeam?.homeLine != null) {
    return finish(perTeam.homeLine, perTeam.homeLine - handicap.margin, "home-total-plus-handicap");
  }

  // 3. Exact-points ladder plus handicap.
  for (const market of markets) {
    if (!/exact/i.test(market?.EventName ?? "")) continue;
    const exact = expectedTotalFromExactMarket(market);
    if (!exact) continue;

    const home = (exact.expectedTotal + handicap.margin) / 2;
    const away = (exact.expectedTotal - handicap.margin) / 2;
    return finish(home, away, "exact-total-plus-handicap");
  }

  return null;
}
