/**
 * Merge published picks into the shapes the match card already renders.
 *
 * The card reads plays off a PredictionRow (bestBet / side / stake) and
 * try scorers off TryScorerRow. Rather than build parallel UI, published picks
 * are mapped into those existing fields, so RLWC cards render through exactly
 * the same path as NRL ones.
 *
 * Fails closed throughout: a selection that cannot be matched to a team is
 * dropped rather than guessed onto a side, and a try scorer with no model
 * probability is omitted rather than displayed as zero.
 */

import type { PublicPick } from "./picks.ts";

export interface AdaptedPredictionLike {
  match: string;
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  bestBet: string;
  side: "Home" | "Away" | "";
  stake: number;
  marketHomeOdds: number;
  marketAwayOdds: number;
  confidence: "Lean" | "Value" | "Strong";
}

export interface TryScorerRowLike {
  round: number;
  match: string;
  player: string;
  team: string;
  position: string;
  statsInsiderPct: number;
  bestOdds: number;
  bookmaker: string;
  marketImpliedPct: number;
  edgePct: number;
  value: string;
}

const normalise = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Confidence from the model's probability.
 *
 * These bands label how strongly the model rates the selection; they are not
 * an edge claim, which would require two independent books that agree.
 */
function confidenceFor(probability: number | null): "Lean" | "Value" | "Strong" {
  if (probability === null || !Number.isFinite(probability)) return "Lean";
  if (probability >= 0.65) return "Strong";
  if (probability >= 0.55) return "Value";
  return "Lean";
}

/** Place a head-to-head, line or total pick onto the row the card renders. */
export function applyCorePlay<T extends AdaptedPredictionLike>(
  row: T,
  pick: PublicPick | null,
): T {
  if (!pick) return row;

  const selection = normalise(pick.selection);
  const isHome = selection === normalise(row.homeTeam);
  const isAway = selection === normalise(row.awayTeam);

  // Fail closed: an unmatched name must never be assigned to a side.
  if (!isHome && !isAway) return row;

  // The handicap is part of the selection, not decoration. "Samoa @ $1.90"
  // reads as a head-to-head when the real head-to-head is $1.01; the $1.90 is
  // a 47.5-point line. A zero point is a genuine pick-em and is rendered.
  const label = pick.selection.trim();
  const bestBet =
    pick.point === null || pick.point === undefined
      ? label
      : `${label} ${pick.point > 0 ? "+" : ""}${pick.point}`;

  return {
    ...row,
    bestBet,
    side: isHome ? "Home" : "Away",
    stake: 1,
    marketHomeOdds: isHome ? pick.entry_odds : row.marketHomeOdds,
    marketAwayOdds: isAway ? pick.entry_odds : row.marketAwayOdds,
    confidence: confidenceFor(pick.model_probability),
  };
}

/** Convert try-scorer picks into the rows the try-scorer strip renders. */
export function toTryScorerRows(
  picks: PublicPick[],
  matchLabel: string,
  roundNumber: number,
): TryScorerRowLike[] {
  const rows: TryScorerRowLike[] = [];

  for (const pick of picks) {
    // A pick with no model view is omitted entirely: rendering 0% would read
    // as "the model rates this at zero", which is a different claim.
    if (pick.model_probability === null || !Number.isFinite(pick.model_probability)) {
      continue;
    }
    if (!Number.isFinite(pick.entry_odds) || pick.entry_odds <= 1) continue;

    // The market figure must be the stored de-vigged probability. Falling back
    // to 1 / entry_odds would reintroduce the overround — a 40-player
    // try-scorer book sums to 933%, so the raw figure overstates every runner
    // and can flip the sign of the model-versus-market comparison.
    if (pick.market_probability === null || !Number.isFinite(pick.market_probability)) {
      continue;
    }

    const modelPct = pick.model_probability * 100;
    const marketPct = pick.market_probability * 100;

    rows.push({
      round: roundNumber,
      match: matchLabel,
      player: pick.selection,
      team: "",
      position: "",
      statsInsiderPct: modelPct,
      bestOdds: pick.entry_odds,
      bookmaker: pick.entry_bookmaker,
      marketImpliedPct: marketPct,
      edgePct: modelPct - marketPct,
      value: modelPct > marketPct ? "Value" : "",
    });
  }

  return rows;
}
