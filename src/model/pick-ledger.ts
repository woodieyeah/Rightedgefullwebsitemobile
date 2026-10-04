/**
 * Pick ledger — settlement and profitability.
 *
 * This is the piece RightEdge has never had: a record of what was selected, at
 * what price, and what it actually returned. Everything here is pure and
 * synchronous so it can be tested without a database or a live feed.
 *
 * DESIGN RULES
 *
 * 1. Settlement is derived from the final score, never from a stored
 *    "hit/miss" flag a human typed. The score is the only input that cannot
 *    drift out of sync with reality.
 *
 * 2. Profit is expressed in UNITS RETURNED, not in a status word. A push
 *    returns the stake (0 profit); a void returns the stake; a loss returns
 *    nothing. Reporting "win/loss" alone cannot represent a push and silently
 *    corrupts ROI.
 *
 * 3. Anything we cannot settle with certainty stays PENDING or VOID. We never
 *    guess a result, never infer a score, and never treat a missing field as
 *    zero. A wrong settlement is far worse than an unsettled pick.
 *
 * 4. The entry price is immutable once recorded. CLV compares it against the
 *    separately captured closing price; if no closing price was captured, CLV
 *    is null rather than 0 — absence is not neutrality.
 */

export type Market = "h2h" | "line" | "total";
export type Outcome = "win" | "loss" | "push" | "void" | "pending";
export type Competition = "NRL" | "RLWC";

export interface Pick {
  id: string;
  matchKey: string;
  competition: Competition;
  market: Market;
  /** Team name for h2h/line; "Over" or "Under" for a total. */
  selection: string;
  /** Handicap or total line. Required for line/total; absent for h2h. */
  point?: number;
  /** Decimal price taken at placement. Immutable. */
  entryPrice: number;
  /** Decimal price the market closed at, captured separately. */
  closingPrice?: number;
  stakeUnits: number;
  bookmaker: string;
  placedAt: string;
  /** Model's fair probability at placement, for later calibration work. */
  modelProbability?: number;
}

export interface MatchResult {
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface SettledPick {
  pick: Pick;
  outcome: Outcome;
  /** Units returned including stake. null while pending. */
  unitsReturned: number | null;
  /** unitsReturned - stake. null while pending. */
  profitUnits: number | null;
  /** Percentage points of probability gained against the close. null if unknown. */
  clvPct: number | null;
}

export interface LedgerSummary {
  total: number;
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  stakedUnits: number;
  returnedUnits: number;
  profitUnits: number;
  roiPct: number;
  /** Wins as a share of decided picks (pushes and voids excluded). */
  strikeRatePct: number;
  /** Mean CLV across picks that have a closing price. null if none do. */
  averageClvPct: number | null;
}

const normaliseTeam = (team: string) =>
  String(team || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function isValidResult(result: MatchResult | null | undefined): result is MatchResult {
  return Boolean(
    result &&
      Number.isFinite(result.homeScore) &&
      Number.isFinite(result.awayScore),
  );
}

function clv(entryPrice: number, closingPrice?: number): number | null {
  if (!Number.isFinite(closingPrice) || Number(closingPrice) <= 1) return null;
  if (!Number.isFinite(entryPrice) || entryPrice <= 1) return null;
  // Positive when we took a LONGER price than the market closed at, i.e. our
  // entry carried less implied probability than the close and we beat it.
  return (100 / Number(closingPrice)) - (100 / entryPrice);
}

function build(
  pick: Pick,
  outcome: Outcome,
  unitsReturned: number | null,
): SettledPick {
  return {
    pick,
    outcome,
    unitsReturned,
    profitUnits: unitsReturned === null ? null : unitsReturned - pick.stakeUnits,
    clvPct: clv(pick.entryPrice, pick.closingPrice),
  };
}

/**
 * Settle one pick against a match result.
 * Returns `pending` when the result is absent, mismatched or unparseable, and
 * `void` when the pick itself is not settleable (missing line, unknown team).
 */
export function settlePick(
  pick: Pick,
  result: MatchResult | null | undefined,
): SettledPick {
  const stake = Number(pick.stakeUnits);
  const price = Number(pick.entryPrice);
  if (!Number.isFinite(stake) || stake <= 0) return build(pick, "void", 0);
  if (!Number.isFinite(price) || price <= 1) return build(pick, "void", stake);

  if (!isValidResult(result)) return build(pick, "pending", null);
  if (result.matchKey !== pick.matchKey) return build(pick, "pending", null);

  const win = () => build(pick, "win", stake * price);
  const loss = () => build(pick, "loss", 0);
  const push = () => build(pick, "push", stake);

  const margin = result.homeScore - result.awayScore; // positive = home won
  const total = result.homeScore + result.awayScore;

  if (pick.market === "h2h") {
    const sel = normaliseTeam(pick.selection);
    const home = normaliseTeam(result.homeTeam);
    const away = normaliseTeam(result.awayTeam);
    if (sel !== home && sel !== away) return build(pick, "void", stake);
    if (margin === 0) return push();
    const selectedWon = sel === home ? margin > 0 : margin < 0;
    return selectedWon ? win() : loss();
  }

  if (pick.market === "line") {
    if (!Number.isFinite(pick.point)) return build(pick, "void", stake);
    const sel = normaliseTeam(pick.selection);
    const home = normaliseTeam(result.homeTeam);
    const away = normaliseTeam(result.awayTeam);
    if (sel !== home && sel !== away) return build(pick, "void", stake);
    // Margin from the selected team's perspective, plus its handicap.
    const ownMargin = sel === home ? margin : -margin;
    const adjusted = ownMargin + Number(pick.point);
    if (adjusted === 0) return push();
    return adjusted > 0 ? win() : loss();
  }

  if (pick.market === "total") {
    if (!Number.isFinite(pick.point)) return build(pick, "void", stake);
    const side = String(pick.selection || "").trim().toLowerCase();
    if (side !== "over" && side !== "under") return build(pick, "void", stake);
    if (total === Number(pick.point)) return push();
    const isOver = total > Number(pick.point);
    return (side === "over") === isOver ? win() : loss();
  }

  return build(pick, "void", stake);
}

/** Settle a set of picks and aggregate profitability. */
export function summarisePicks(
  picks: Pick[],
  results: MatchResult[],
): LedgerSummary {
  const byKey = new Map(results.map((r) => [r.matchKey, r]));
  const settled = picks.map((p) => settlePick(p, byKey.get(p.matchKey) ?? null));

  const empty: LedgerSummary = {
    total: picks.length,
    settled: 0, pending: 0, wins: 0, losses: 0, pushes: 0, voids: 0,
    stakedUnits: 0, returnedUnits: 0, profitUnits: 0,
    roiPct: 0, strikeRatePct: 0, averageClvPct: null,
  };

  const summary = settled.reduce((acc, s) => {
    if (s.outcome === "pending") { acc.pending += 1; return acc; }
    acc.settled += 1;
    if (s.outcome === "win") acc.wins += 1;
    else if (s.outcome === "loss") acc.losses += 1;
    else if (s.outcome === "push") acc.pushes += 1;
    else if (s.outcome === "void") acc.voids += 1;
    // Voids refund the stake and are excluded from turnover entirely.
    if (s.outcome !== "void") {
      acc.stakedUnits += s.pick.stakeUnits;
      acc.returnedUnits += s.unitsReturned ?? 0;
    }
    return acc;
  }, { ...empty });

  summary.profitUnits = summary.returnedUnits - summary.stakedUnits;
  summary.roiPct = summary.stakedUnits > 0
    ? (summary.profitUnits / summary.stakedUnits) * 100
    : 0;

  const decided = summary.wins + summary.losses;
  summary.strikeRatePct = decided > 0 ? (summary.wins / decided) * 100 : 0;

  const withClv = settled.map((s) => s.clvPct).filter((c): c is number => c !== null);
  summary.averageClvPct = withClv.length
    ? withClv.reduce((t, c) => t + c, 0) / withClv.length
    : null;

  return summary;
}

/** Settle every pick and return the individual rows, for display. */
export function settleAll(picks: Pick[], results: MatchResult[]): SettledPick[] {
  const byKey = new Map(results.map((r) => [r.matchKey, r]));
  return picks.map((p) => settlePick(p, byKey.get(p.matchKey) ?? null));
}
