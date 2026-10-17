/**
 * Render published picks on the Premium Plays and Multi pages.
 *
 * Those pages apply gates designed for sheet-derived NRL rows, and both reject
 * the RLWC card for reasons that do not apply to an editorially published pick:
 *
 *   Premium Plays requires a positive value edge against the market. The RLWC
 *   brief is explicitly that plays need no edge — they need a high chance of
 *   winning — and no book currently beats the exchange anchor, so a published
 *   play would never clear the gate.
 *
 *   The Multi page builds its own combination from try scorers rated at 25%+
 *   by the model. The opener's de-vigged try-scorer reads top out near 22%, so
 *   no multi builds at all; and a three-leg try-scorer multi is exactly the
 *   9.8% longshot that was rejected in favour of a 35.7% two-legger.
 *
 * A published pick bypasses both gates because the selection decision has
 * already been made. Crucially the multi also carries the bookmaker's REAL
 * correlated price: the page's generic estimate multiplies legs and applies a
 * flat 0.83 factor, giving $2.88 where Betr actually prices $2.80.
 */

import type { PublicPick } from "./picks.ts";

export interface PredictionRowLike {
  match: string;
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  fixture?: unknown;
}

export interface PublishedPremiumPlay {
  id: string;
  row: PredictionRowLike;
  type: "Line" | "Total" | "Head 2 Head";
  selection: string;
  bookmaker: string;
  odds: number;
  /** Null when the pick was published on book agreement rather than a model read. */
  modelPct: number | null;
  modelEdge: number | null;
  marketImpliedPct: number | null;
  isManualApproved: true;
  marketPoint?: number;
}

export interface PublishedMultiLeg {
  kind: "result" | "total" | "try-scorer";
  label: string;
  suffix?: string;
  marketPct: number;
  modelPct: number;
  odds: number;
  team?: string;
}

export interface PublishedMultiCard {
  key: string;
  match: string;
  fixture?: unknown;
  status: "upcoming" | "live" | "completed";
  legs: PublishedMultiLeg[];
  /** The bookmaker's own correlated price. Overrides the page's estimate. */
  price: number;
}

const MATCH_MARKETS = new Set(["h2h", "line", "total"]);

function typeFor(market: string): "Line" | "Total" | "Head 2 Head" {
  if (market === "line") return "Line";
  if (market === "total") return "Total";
  return "Head 2 Head";
}

/**
 * Label a selection with its handicap, exactly once.
 *
 * Picks are stored inconsistently — the Samoa line as "Samoa" with point
 * -47.5, the PNG line as "Papua New Guinea -8.5" with the same point — so
 * appending the point unconditionally produced "Papua New Guinea -8.5 -8.5"
 * on the card. Any trailing handicap already in the label is stripped before
 * the stored point is applied, which also keeps the two in step: `point` is
 * what settlement reads, so it is the authoritative number to display.
 */
function selectionLabel(pick: PublicPick): string {
  if (pick.point === null || pick.point === undefined) return pick.selection;

  // Drop a trailing SIGNED number only. An unsigned trailing number could be
  // part of a team's name, and stripping it would corrupt the label.
  const bare = String(pick.selection).replace(/\s+[-+]\d+(?:\.\d+)?\s*$/, "").trim();
  const sign = pick.point > 0 ? "+" : "";
  return `${bare} ${sign}${pick.point}`;
}

/** Build a Premium Plays entry from a published match pick. */
export function buildPublishedPremiumPlay(
  row: PredictionRowLike,
  pick: PublicPick | null,
): PublishedPremiumPlay | null {
  if (!pick) return null;
  if (!MATCH_MARKETS.has(pick.market)) return null;
  if (!Number.isFinite(pick.entry_odds) || pick.entry_odds <= 1) return null;

  // A null model probability does NOT disqualify a published pick. Some are
  // published on book agreement alone — the Samoa line is corroborated by two
  // books, while the projected scoreline is derived FROM that line and so
  // cannot confirm it. Dropping those would silently hide a real selection.
  const hasModel =
    pick.model_probability !== null && Number.isFinite(pick.model_probability);
  const modelPct = hasModel ? pick.model_probability! * 100 : null;

  // Prefer the stored de-vigged figure; fall back to raw implied only for
  // two-way markets, where the overround is small and symmetric.
  const marketPct =
    pick.market_probability !== null && Number.isFinite(pick.market_probability)
      ? pick.market_probability * 100
      : hasModel
        ? (1 / pick.entry_odds) * 100
        : null;

  return {
    id: `published-${pick.id}`,
    row,
    type: typeFor(pick.market),
    selection: selectionLabel(pick),
    bookmaker: pick.entry_bookmaker,
    odds: pick.entry_odds,
    modelPct,
    modelEdge: modelPct !== null && marketPct !== null ? modelPct - marketPct : null,
    marketImpliedPct: marketPct,
    // Marks the play as editorially approved so the page's value gate is
    // bypassed, exactly as manually approved plays already are.
    isManualApproved: true,
    marketPoint: pick.point ?? undefined,
  };
}

/** Build a Multi page card from a published same-game multi. */
export function buildPublishedMultiCard(
  row: PredictionRowLike,
  pick: PublicPick | null,
): PublishedMultiCard | null {
  if (!pick || pick.market !== "sgm") return null;
  if (!Number.isFinite(pick.entry_odds) || pick.entry_odds <= 1) return null;

  const legs = pick.legs ?? [];
  if (legs.length < 2) return null;

  const product = legs.reduce((p, l) => p * l.odds, 1);
  // The book's correlated price may sit either side of the product:
  // positively correlated legs price below it, negatively correlated legs
  // (two players competing for the same pool of tries) price above it.
  // Reject only an implausible gap, which means a mismatched or stale quote.
  const ratio = pick.entry_odds / product;
  if (!Number.isFinite(ratio) || ratio < 0.4 || ratio > 1.6) return null;

  return {
    key: `published-${pick.id}`,
    match: `${row.homeTeam} V ${row.awayTeam}`,
    fixture: row.fixture ?? null,
    status: "upcoming",
    legs: legs.map((leg) => ({
      kind: leg.market === "h2h" ? "result" : leg.market === "total" ? "total" : "try-scorer",
      label: leg.selection,
      suffix: leg.market === "anytime_try" ? "ANYTIME" : undefined,
      marketPct: (1 / leg.odds) * 100,
      modelPct: (1 / leg.odds) * 100,
      odds: leg.odds,
      team: leg.market === "h2h" ? leg.selection : undefined,
    })),
    price: pick.entry_odds,
  };
}
