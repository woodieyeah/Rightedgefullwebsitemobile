/**
 * TAB market extraction and the consensus model.
 *
 * TAB (webapi.tab.com.au) prices head-to-head, line AND total for every RLWC
 * fixture, which BlueBet's feed does not. It is also an independent book, which
 * an edge calculation requires: de-vigging one book and then scanning that same
 * book returns a negative edge on both sides by construction.
 *
 * THE AGREEMENT GATE
 * Two retail books are not a sharp price. Averaging them is only defensible
 * when they broadly agree — disagreement means at least one price is stale, and
 * the apparent "edge" is an artefact of the stale one.
 *
 * Measured live: TAB quoted France at $26.00 while BlueBet quoted $14.25 on the
 * same outcome. The naive scan reported +34.65% value. It was not value; books
 * shade longshots SHORT, so a generous longshot quote indicates a stale line.
 * The gate suppresses the edge whenever the widest leg disagrees by more than
 * MAX_BOOK_DISAGREEMENT_PCT.
 *
 * Crucially, suppression applies to the EDGE only. The line and total still
 * represent the market's view of the scoreline, so projections publish either
 * way — an honest projection with no play attached.
 */

export interface TabProposition {
  name?: string;
  returnWin?: number | null;
}

export interface TabMarket {
  betOption?: string;
  propositions?: TabProposition[];
}

export interface TabMatch {
  name?: string;
  startTime?: string;
  markets?: TabMarket[];
}

export interface BookPrices {
  home: number;
  away: number;
}

export interface ParsedTabMatch {
  homePrice: number;
  awayPrice: number;
  /** Handicap on the home team, as quoted (negative when favoured). */
  homeLine: number | null;
  total: number | null;
}

export interface ModelPrediction {
  projectedHome: number | null;
  projectedAway: number | null;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedWinner: string;
  homeEdgePct: number | null;
  awayEdgePct: number | null;
  edgeSuppressedReason: "single-book" | "books-disagree" | null;
  bookAgreementPct: number | null;
}

/**
 * Maximum tolerated disagreement between two books on the same outcome, as a
 * percentage of the shorter price. Beyond this, the edge is not trustworthy.
 *
 * 15% is wide enough to permit normal retail variation (the opener's books sat
 * about 2% apart) and tight enough to reject the France case at 82%.
 */
export const MAX_BOOK_DISAGREEMENT_PCT = 15;

const norm = (s: string) => s.trim().toLowerCase();

/** Nations TAB abbreviates. */
const TAB_ALIASES: Record<string, string> = {
  png: "papua new guinea",
  "n zealand": "new zealand",
  nz: "new zealand",
};

function canonical(team: string): string {
  const n = norm(team);
  return TAB_ALIASES[n] ?? n;
}

/** Does a TAB match name refer to this fixture, in this order? */
export function matchesFixture(tabName: string, homeTeam: string, awayTeam: string): boolean {
  if (!tabName) return false;
  const parts = tabName.split(/\s+v\s+/i);
  if (parts.length !== 2) return false;
  // Order matters: a reversed fixture would invert the line.
  return canonical(parts[0]) === canonical(homeTeam) && canonical(parts[1]) === canonical(awayTeam);
}

function findMarket(match: TabMatch, betOption: string): TabMarket | null {
  return (match.markets ?? []).find((m) => m.betOption === betOption) ?? null;
}

function priceFor(market: TabMarket | null, team: string): number | null {
  if (!market?.propositions) return null;
  const target = canonical(team);
  for (const p of market.propositions) {
    if (!p?.name) continue;
    if (canonical(p.name) !== target) continue;
    const price = Number(p.returnWin);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

/** Extract head-to-head, line and total from a TAB match payload. */
export function parseTabMatch(
  match: TabMatch,
  homeTeam: string,
  awayTeam: string,
): ParsedTabMatch | null {
  const h2h = findMarket(match, "Head To Head");
  const homePrice = priceFor(h2h, homeTeam);
  const awayPrice = priceFor(h2h, awayTeam);
  if (homePrice === null || awayPrice === null) return null;

  // Line: proposition names carry the handicap, e.g. "Australia -3.5".
  let homeLine: number | null = null;
  const lineMarket = findMarket(match, "Line");
  for (const p of lineMarket?.propositions ?? []) {
    const name = p?.name ?? "";
    const m = name.match(/^(.*?)\s*([+-]\d+(?:\.\d+)?)$/);
    if (!m) continue;
    if (canonical(m[1]) !== canonical(homeTeam)) continue;
    const point = Number(m[2]);
    if (Number.isFinite(point)) homeLine = point;
  }

  // Total: the full-match market only. "1st Half Total Points O/U" is a
  // different betOption and is therefore never reached here.
  let total: number | null = null;
  const totalMarket = findMarket(match, "Total Points Over/Under");
  for (const p of totalMarket?.propositions ?? []) {
    const m = (p?.name ?? "").match(/^(?:over|under)\s+(\d+(?:\.\d+)?)$/i);
    if (!m) continue;
    const point = Number(m[1]);
    if (Number.isFinite(point) && point > 0) { total = point; break; }
  }

  return { homePrice, awayPrice, homeLine, total };
}

/**
 * Disagreement between two books, as a percentage of the shorter price on the
 * WIDEST leg. Using the widest leg means a tight favourite cannot mask a wild
 * longshot quote.
 */
export function bookAgreementPct(a: BookPrices, b: BookPrices): number | null {
  const valid = [a.home, a.away, b.home, b.away].every((p) => Number.isFinite(p) && p > 0);
  if (!valid) return null;

  const gap = (x: number, y: number) => (Math.abs(x - y) / Math.min(x, y)) * 100;
  return Math.max(gap(a.home, b.home), gap(a.away, b.away));
}

/** De-vig one book, or average two de-vigged books. */
export function consensusProbabilities(
  primary: BookPrices,
  secondary: BookPrices | null,
): { home: number; away: number } | null {
  const devig = (p: BookPrices) => {
    if (!Number.isFinite(p.home) || !Number.isFinite(p.away) || p.home <= 0 || p.away <= 0) return null;
    const ih = 1 / p.home;
    const ia = 1 / p.away;
    const book = ih + ia;
    return { home: ih / book, away: ia / book };
  };

  const a = devig(primary);
  if (!a) return null;

  const b = secondary ? devig(secondary) : null;
  if (!b) return a;

  return { home: (a.home + b.home) / 2, away: (a.away + b.away) / 2 };
}

/**
 * Build the published prediction for one fixture.
 *
 * Projection comes from line + total: home = (total + margin)/2. Probabilities
 * come from the de-vigged consensus. An edge is reported ONLY when a second
 * book exists and the two agree.
 */
export function buildModelPrediction(input: {
  tab: TabMatch;
  homeTeam: string;
  awayTeam: string;
  secondBook: BookPrices | null;
}): ModelPrediction | null {
  const parsed = parseTabMatch(input.tab, input.homeTeam, input.awayTeam);
  if (!parsed) return null;

  const tabPrices: BookPrices = { home: parsed.homePrice, away: parsed.awayPrice };
  const probabilities = consensusProbabilities(tabPrices, input.secondBook);
  if (!probabilities) return null;

  // Projection: the line is a handicap, so the margin is its negation.
  let projectedHome: number | null = null;
  let projectedAway: number | null = null;
  if (parsed.homeLine !== null && parsed.total !== null) {
    const margin = -parsed.homeLine || 0;
    if (Math.abs(margin) <= parsed.total) {
      projectedHome = (parsed.total + margin) / 2;
      projectedAway = (parsed.total - margin) / 2;
    }
  }

  // Edge, gated on genuine book agreement.
  let homeEdgePct: number | null = null;
  let awayEdgePct: number | null = null;
  let edgeSuppressedReason: ModelPrediction["edgeSuppressedReason"] = null;
  let agreement: number | null = null;

  if (!input.secondBook) {
    edgeSuppressedReason = "single-book";
  } else {
    agreement = bookAgreementPct(tabPrices, input.secondBook);
    if (agreement === null || agreement > MAX_BOOK_DISAGREEMENT_PCT) {
      edgeSuppressedReason = "books-disagree";
    } else {
      const bestHome = Math.max(tabPrices.home, input.secondBook.home);
      const bestAway = Math.max(tabPrices.away, input.secondBook.away);
      homeEdgePct = (bestHome * probabilities.home - 1) * 100;
      awayEdgePct = (bestAway * probabilities.away - 1) * 100;
    }
  }

  return {
    projectedHome,
    projectedAway,
    homeWinProbability: probabilities.home,
    awayWinProbability: probabilities.away,
    predictedWinner: probabilities.home >= probabilities.away ? input.homeTeam : input.awayTeam,
    homeEdgePct,
    awayEdgePct,
    edgeSuppressedReason,
    bookAgreementPct: agreement,
  };
}
