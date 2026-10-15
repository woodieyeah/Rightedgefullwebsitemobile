/**
 * Settlement and tracker arithmetic for published picks.
 *
 * Core Plays and same-game multis are tracked in SEPARATE ledgers. A multi is
 * a structurally different bet — far longer price, much lower strike rate — so
 * a pooled strike rate would describe neither product honestly.
 *
 * Settlement derives from the final score and the official try list every
 * time it is computed. A stored hit/miss verdict is a second source of truth
 * that drifts the moment a correction lands, with nothing detecting it.
 *
 * `unitsReturned` is the primitive and profit derives from it, because a
 * win/loss status word cannot express a push and silently mis-states ROI on
 * every exact-line result.
 */

export type SettlementStatus = "win" | "loss" | "push" | "void" | "pending";

export interface MatchResult {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  /** Official try scorers. `null` means not yet reported — not "nobody scored". */
  tryScorers: string[] | null;
  /** The feed's own completion flag. A live score must never settle a pick. */
  final: boolean;
}

export interface SinglePick {
  market: "h2h" | "line" | "total" | "anytime_try" | "first_try";
  selection: string;
  point: number | null;
  odds: number;
  stake: number;
}

export interface MultiLeg {
  market: SinglePick["market"];
  selection: string;
  point: number | null;
}

export interface MultiPick {
  odds: number;
  stake: number;
  legs: MultiLeg[];
}

export interface SettledPick {
  status: SettlementStatus;
  unitsReturned: number | null;
  profitUnits: number | null;
  legStatuses: SettlementStatus[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function outcome(status: SettlementStatus, odds: number, stake: number): SettledPick {
  if (status === "pending") {
    return { status, unitsReturned: null, profitUnits: null, legStatuses: [] };
  }
  const unitsReturned =
    status === "win" ? stake * odds : status === "loss" ? 0 : stake;
  return { status, unitsReturned, profitUnits: unitsReturned - stake, legStatuses: [] };
}

/**
 * Settle one leg or one single pick, returning only the status.
 * Fails closed: anything that cannot be settled with certainty is pending or
 * void, never a win or a loss.
 */
function legStatus(
  market: SinglePick["market"],
  selection: string,
  point: number | null,
  result: MatchResult | null,
): SettlementStatus {
  if (!result || !result.final) return "pending";
  if (!Number.isFinite(result.homeScore) || !Number.isFinite(result.awayScore)) {
    return "pending";
  }

  const pick = norm(selection);
  const home = norm(result.homeTeam);
  const away = norm(result.awayTeam);

  if (market === "anytime_try" || market === "first_try") {
    // An absent list is "not yet reported", which must not settle as a loss.
    if (!result.tryScorers) return "pending";
    const scored = result.tryScorers.some((name) => norm(name) === pick);
    return scored ? "win" : "loss";
  }

  if (market === "h2h") {
    if (pick !== home && pick !== away) return "void";
    if (result.homeScore === result.awayScore) {
      // A draw loses a two-way head-to-head; it is not a push.
      return "loss";
    }
    const homeWon = result.homeScore > result.awayScore;
    return (pick === home) === homeWon ? "win" : "loss";
  }

  if (market === "line") {
    if (point === null || !Number.isFinite(point)) return "void";
    if (pick !== home && pick !== away) return "void";
    const margin =
      pick === home
        ? result.homeScore - result.awayScore
        : result.awayScore - result.homeScore;
    const covered = margin + point;
    if (covered === 0) return "push";
    return covered > 0 ? "win" : "loss";
  }

  if (market === "total") {
    if (point === null || !Number.isFinite(point)) return "void";
    const total = result.homeScore + result.awayScore;
    if (total === point) return "push";
    const isOver = pick.startsWith("over");
    const isUnder = pick.startsWith("under");
    if (!isOver && !isUnder) return "void";
    return (total > point) === isOver ? "win" : "loss";
  }

  return "void";
}

export function settleSinglePick(
  pick: SinglePick,
  result: MatchResult | null,
): SettledPick {
  if (!Number.isFinite(pick.odds) || pick.odds <= 1) {
    return outcome("void", pick.odds, pick.stake);
  }
  const status = legStatus(pick.market, pick.selection, pick.point, result);
  const settled = outcome(status, pick.odds, pick.stake);
  return { ...settled, legStatuses: [status] };
}

/**
 * Settle a multi. Every leg must win.
 *
 * A pushed or voided leg is NOT treated as a win: in reality the book
 * recomputes the combined price without that leg, and inventing a recomputed
 * price here would publish a number no bookmaker quoted. The multi voids
 * instead, refunding the stake.
 */
export function settleMultiPick(
  pick: MultiPick,
  result: MatchResult | null,
): SettledPick {
  if (!Number.isFinite(pick.odds) || pick.odds <= 1 || pick.legs.length < 2) {
    return outcome("void", pick.odds, pick.stake);
  }

  const legStatuses = pick.legs.map((leg) =>
    legStatus(leg.market, leg.selection, leg.point, result),
  );

  let status: SettlementStatus;
  if (legStatuses.includes("pending")) status = "pending";
  else if (legStatuses.includes("void") || legStatuses.includes("push")) status = "void";
  else if (legStatuses.includes("loss")) status = "loss";
  else status = "win";

  return { ...outcome(status, pick.odds, pick.stake), legStatuses };
}

// ---------------------------------------------------------------------------
// Tracker
// ---------------------------------------------------------------------------

export interface TrackerPick {
  label: string;
  odds: number;
  stake: number;
  settlement: SettledPick;
}

export interface Tracker {
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  /** Turnover across settled, non-void picks only. */
  staked: number;
  profitUnits: number;
  /** Null when nothing has been staked — never 0, which reads as break-even. */
  roiPct: number | null;
  /** Wins over decided picks; pushes and voids leave the denominator. */
  strikeRatePct: number | null;
}

export function buildTracker(picks: TrackerPick[]): Tracker {
  let settled = 0, pending = 0, wins = 0, losses = 0, pushes = 0, voids = 0;
  let staked = 0, profitUnits = 0;

  for (const pick of picks) {
    const { status, profitUnits: profit } = pick.settlement;

    if (status === "pending") { pending++; continue; }
    settled++;

    if (status === "void") { voids++; continue; }

    // Voids leave turnover entirely; everything else counts.
    staked += pick.stake;
    profitUnits += profit ?? 0;

    if (status === "win") wins++;
    else if (status === "loss") losses++;
    else if (status === "push") pushes++;
  }

  const decided = wins + losses;

  return {
    settled, pending, wins, losses, pushes, voids,
    staked,
    profitUnits,
    roiPct: staked > 0 ? (profitUnits / staked) * 100 : null,
    strikeRatePct: decided > 0 ? (wins / decided) * 100 : null,
  };
}
