/**
 * Separate result trackers for Core Plays and same-game multis.
 *
 * Each product gets its own ledger, shown at the top of its own section. A
 * multi is structurally different from a match play — far longer price, much
 * lower strike rate — so a pooled strike rate or ROI would describe neither.
 * The opener settled +0.65u on the Core Play and +4.00u on the multi; one
 * combined "+4.65u from 2 bets at 100%" hides that they are different bets.
 *
 * Profit is read from the row, never recomputed here. The database derives
 * profit_units from units_returned, which is the single source of truth;
 * recomputing in the display layer would create a second one that can drift.
 */

import { buildTracker, type Tracker, type TrackerPick } from "../../model/pick-tracker.ts";

export type TrackerSection = "core" | "sgm";

export interface SettledPublicPick {
  market: "h2h" | "line" | "total" | "anytime_try" | "first_try" | "sgm";
  selection: string;
  entry_odds: number;
  stake_units: number;
  result_status: "pending" | "win" | "loss" | "push" | "void";
  units_returned: number | null;
  profit_units: number | null;
  settled_at: string | null;
}

const CORE_MARKETS = new Set(["h2h", "line", "total"]);

/** Does this pick belong in the given section's tracker? */
export function belongsToSection(
  pick: SettledPublicPick,
  section: TrackerSection,
): boolean {
  return section === "sgm" ? pick.market === "sgm" : CORE_MARKETS.has(pick.market);
}

export function buildTrackerFromPicks(
  picks: SettledPublicPick[],
  section: TrackerSection,
): Tracker {
  const rows: TrackerPick[] = picks
    .filter((pick) => belongsToSection(pick, section))
    .map((pick) => ({
      label: pick.selection,
      odds: Number(pick.entry_odds),
      stake: Number(pick.stake_units) || 1,
      settlement: {
        status: pick.result_status,
        unitsReturned: pick.units_returned === null ? null : Number(pick.units_returned),
        profitUnits: pick.profit_units === null ? null : Number(pick.profit_units),
        legStatuses: [],
      },
    }));

  return buildTracker(rows);
}

/** Format a unit figure with an explicit sign, e.g. "+4.00u". */
export function formatUnits(units: number): string {
  return `${units >= 0 ? "+" : ""}${units.toFixed(2)}u`;
}

/**
 * One unit in dollars.
 *
 * Units are the honest record — they are stake-independent, so they compare
 * across subscribers betting different sizes. The dollar figure is shown
 * beside them to make the result concrete for anyone staking this amount.
 */
export const UNIT_SIZE_AUD = 100;

/**
 * Format a unit figure as signed whole dollars.
 *
 * Rounded to the dollar: cents on a $100 unit are noise, and a tracker that
 * reads "+$356.00" invites false precision about a flat-stake record.
 * Break-even prints "+$0" rather than an em dash, because zero profit on a
 * settled record is a real result, not missing data.
 */
export function formatCurrency(units: number): string {
  const dollars = Math.round(units * UNIT_SIZE_AUD);
  const sign = dollars < 0 ? "-" : "+";
  return `${sign}$${Math.abs(dollars).toLocaleString("en-AU")}`;
}

/** Format turnover in dollars. Never signed: a stake is never negative. */
export function formatStake(units: number): string {
  return `$${Math.round(units * UNIT_SIZE_AUD).toLocaleString("en-AU")}`;
}

/** Format a rate, or an em dash when there is no record yet. */
export function formatRate(rate: number | null, decimals = 1): string {
  return rate === null ? "—" : `${rate.toFixed(decimals)}%`;
}
