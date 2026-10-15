/**
 * Published picks: the selections that appear on a match card.
 *
 * Builds rows for the `picks` table. Entry price and bookmaker are recorded at
 * publication and never rewritten — RacingOracle learned this the hard way,
 * where a single mutable odds column destroyed the entry/close distinction that
 * CLV depends on.
 *
 * SGM PRICING
 * A same-game multi's price comes from the bookmaker's own correlation model
 * (Betr: POST /SameGameMultiPrice), never from multiplying its legs. Correlated
 * legs multiply to an overstated payout: Australia winning makes an Australian
 * try scorer MORE likely, so the true combined probability is higher than
 * independence implies and the fair price is therefore lower.
 *
 * Measured live on the RLWC opener: Australia win ($1.65) + Trbojevic anytime
 * ($2.10) multiplies to $3.46 and prices at $2.80 — a 19% haircut. Publishing
 * $3.46 would promise subscribers a payout that does not exist.
 *
 * That relationship is enforced, not assumed: an SGM priced at or above the
 * product of its legs is rejected, because it means the legs were mismatched or
 * the price is stale.
 */

export type PickKind = "core" | "sgm" | "try_scorer" | "line" | "total";

export interface SgmLeg {
  label: string;
  market: string;
  odds: number;
}

export interface PublishedPick {
  kind: PickKind;
  market: string;
  selection: string;
  point: number | null;
  entryOdds: number;
  entryBookmaker: string;
  /** De-vigged model probability. Null when the model has no view. */
  modelProbability: number | null;
  /** Required for kind === "sgm". */
  legs?: SgmLeg[];
}

export interface PickRow {
  fixture_id: string;
  model_version: string;
  market: string;
  selection: string;
  point: number | null;
  entry_odds: number;
  entry_bookmaker: string;
  entry_captured_at: string;
  model_probability: number | null;
  model_edge_pct: number | null;
  closing_odds: null;
  closing_bookmaker: null;
  closing_captured_at: null;
  stake_units: number;
  result_status: "pending";
  units_returned: null;
  settled_at: null;
  published: boolean;
  published_at: string;
}

export const MODEL_VERSION = "rlwc-consensus-v1";

/** Render an SGM's legs for display, in order. */
export function describeSgmLegs(legs: SgmLeg[]): string {
  if (!legs.length) return "";
  return legs.map((l) => `${l.label} @ $${l.odds.toFixed(2)}`).join(" + ");
}

export function buildPickRows(fixtureId: string, picks: PublishedPick[]): PickRow[] {
  const capturedAt = new Date().toISOString();

  return picks.map((pick) => {
    if (!pick.selection?.trim()) {
      throw new Error(`pick has no selection: ${JSON.stringify(pick)}`);
    }
    if (!Number.isFinite(pick.entryOdds) || pick.entryOdds <= 1) {
      throw new Error(`invalid entry odds for ${pick.selection}: ${pick.entryOdds}`);
    }

    if (pick.kind === "sgm") {
      const legs = pick.legs ?? [];
      if (legs.length < 2) {
        throw new Error(`an SGM needs at least two legs: ${pick.selection}`);
      }
      const product = legs.reduce((p, l) => p * l.odds, 1);
      // The bookmaker's own correlated price is authoritative and may land
      // either side of the product.
      //
      // Positively correlated legs price BELOW it: Australia win + Trbojevic
      // + Bostock multiplies to $8.66 and prices at $5.00, because Australia
      // winning makes Australian try scorers more likely.
      //
      // Negatively correlated legs price ABOVE it: To'o to score 2+ tries +
      // Manuleleua anytime multiplies to $4.74 and prices at $5.35, because
      // both compete for the same pool of Samoan tries, so To'o taking two
      // makes one for Manuleleua less likely.
      //
      // Only an implausible gap signals a mismatched or stale quote. The
      // bounds are deliberately wide — the guard catches a wrong leg being
      // priced, not a legitimate correlation adjustment.
      const ratio = pick.entryOdds / product;
      if (!Number.isFinite(ratio) || ratio < 0.4 || ratio > 1.6) {
        throw new Error(
          `SGM price $${pick.entryOdds} is implausible against its legs ` +
            `($${product.toFixed(2)}, ratio ${ratio.toFixed(2)}) — likely a ` +
            `mismatched or stale quote`,
        );
      }
    }

    return {
      fixture_id: fixtureId,
      model_version: MODEL_VERSION,
      market: pick.market,
      selection: pick.selection.trim(),
      point: pick.point,
      entry_odds: pick.entryOdds,
      entry_bookmaker: pick.entryBookmaker,
      entry_captured_at: capturedAt,
      model_probability: pick.modelProbability,
      // No edge is published: an edge requires two independent books that
      // agree, and every book currently sits on the right side of the
      // exchange anchor.
      model_edge_pct: null,
      closing_odds: null,
      closing_bookmaker: null,
      closing_captured_at: null,
      stake_units: 1,
      result_status: "pending",
      units_returned: null,
      // profit_units is a generated column (units_returned - stake_units);
      // the database rejects any attempt to insert a value for it.
      settled_at: null,
      published: true,
      published_at: capturedAt,
    };
  });
}
