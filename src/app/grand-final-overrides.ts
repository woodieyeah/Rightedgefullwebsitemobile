// Grand Final week (Round 31, Sydney v Newcastle) UI overrides.
//
// The generic chooser cannot promise a Core Play and a Same Game Multi for a
// one-match round: a single fixture may not clear the conservative gates, and
// the Round Multi has nothing to combine. These helpers force the approved
// Grand Final selections and stop the Round Multi from rendering for any
// round with fewer than two matches. They do not touch data sources, model
// calculations, odds feeds or historical archive behaviour.

const GRAND_FINAL_ROUND = 31;
const GRAND_FINAL_KNIGHTS_LINE = 7.5;

function normalizeTeam(value: string) {
  const team = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (team === "sydney roosters" || team === "roosters" || team === "sydney") return "sydney";
  if (team === "newcastle knights" || team === "knights" || team === "newcastle") return "newcastle";
  return team;
}

function normalizePlayer(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export function isGrandFinalMatch(
  roundNumber: number,
  homeTeam: string,
  awayTeam: string,
) {
  if (roundNumber !== GRAND_FINAL_ROUND) return false;
  const home = normalizeTeam(homeTeam);
  const away = normalizeTeam(awayTeam);
  return (home === "sydney" && away === "newcastle") ||
    (home === "newcastle" && away === "sydney");
}

// A Round Multi combines legs from independent matches, so it needs at least
// two. One-game rounds (including the Grand Final) show only the SGM.
export function shouldBuildRoundMulti(matchCount: number) {
  return matchCount >= 2;
}

// Approved Core Play: Newcastle with the positive Grand Final line. This is a
// narrowly scoped manual selection, so it can bypass the generic model-edge
// gates while still requiring a real live line market and valid odds.
export function shouldForceGrandFinalCorePlay({
  roundNumber,
  homeTeam,
  awayTeam,
  marketType,
  selection,
  marketPoint,
}: {
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  marketType: string;
  selection: string;
  marketPoint?: number;
}) {
  const selectionTeam = normalizeTeam(selection.replace(/[+-].*$/, "").trim());
  return isGrandFinalMatch(roundNumber, homeTeam, awayTeam) &&
    marketType === "Line" &&
    selectionTeam === "newcastle" &&
    Number.isFinite(marketPoint) &&
    Math.abs(Number(marketPoint) - GRAND_FINAL_KNIGHTS_LINE) <= 0.01;
}

// Given chooser candidates already sorted best-first, return the manually
// approved one if any. Undefined means "no override — let the generic
// thresholds decide", which keeps every other round's behaviour unchanged.
export function pickForcedCorePlay<T extends { isManualApproved?: boolean }>(
  candidates: readonly T[],
): T | undefined {
  return candidates.find((candidate) => candidate.isManualApproved === true);
}

// A live Grand Final override must beat an older pending official selection so
// the Premium page and the write-once freeze snapshot cannot preserve the
// superseded play. Ordinary matches retain official-pending precedence.
export function preferForcedGrandFinalCorePlay<T extends { isManualApproved?: boolean }>(
  livePlay: T | null,
  officialPendingPlay: T | null,
): T | null {
  if (livePlay?.isManualApproved === true) return livePlay;
  return officialPendingPlay || livePlay;
}

export type GrandFinalSameGameMultiPlan = {
  resultLeg: "h2h";
  resultTeam: "sydney";
  scorers: string[];
};

// Approved SGM: Sydney head-to-head + Daniel Tupou anytime + Dominic Young
// anytime. The H2H leg (not a line) is used for the result, and the scorer
// legs are named explicitly rather than derived from the generic value gate.
export function getGrandFinalSameGameMultiPlan(
  roundNumber: number,
  homeTeam: string,
  awayTeam: string,
): GrandFinalSameGameMultiPlan | null {
  if (!isGrandFinalMatch(roundNumber, homeTeam, awayTeam)) return null;
  return {
    resultLeg: "h2h",
    resultTeam: "sydney",
    scorers: ["Daniel Tupou", "Dominic Young"],
  };
}

// Undefined means this is not the Grand Final and generic SGM logic should run.
// Null means it is the Grand Final but an approved live input is missing, so the
// exact multi fails closed instead of being replaced by a different combination.
export function resolveGrandFinalSameGameMulti<
  T extends { player: string; bestOdds: number },
>(
  roundNumber: number,
  homeTeam: string,
  awayTeam: string,
  resultH2hOdds: number,
  rows: readonly T[],
): { resultH2hOdds: number; scorers: T[] } | null | undefined {
  const plan = getGrandFinalSameGameMultiPlan(roundNumber, homeTeam, awayTeam);
  if (!plan) return undefined;
  if (!Number.isFinite(resultH2hOdds) || resultH2hOdds <= 1) return null;
  const scorers = selectForcedScorerRows(rows, plan.scorers);
  if (!scorers || scorers.some((row) => !Number.isFinite(row.bestOdds) || row.bestOdds <= 1)) {
    return null;
  }
  return { resultH2hOdds, scorers };
}

// Resolve named scorers against the live try-scorer rows in plan order.
// Fails closed (null) when any named player is missing so the exact Grand Final
// multi cannot silently degrade into a partial or different combination.
export function selectForcedScorerRows<T extends { player: string }>(
  rows: readonly T[],
  scorers: readonly string[],
): T[] | null {
  const selected: T[] = [];
  for (const scorer of scorers) {
    const wanted = normalizePlayer(scorer);
    const row = rows.find((candidate) => normalizePlayer(candidate.player) === wanted);
    if (!row) return null;
    selected.push(row);
  }
  return selected.length === scorers.length ? selected : null;
}
