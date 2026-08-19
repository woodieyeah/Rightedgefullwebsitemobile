/**
 * Betr same-game-multi pricing boundary.
 *
 * Betr/BlueBet exposes event and individual-market data publicly, but no
 * supported combination-pricing API contract is currently available. Keep
 * the unsupported result behind this adapter so callers never attempt to
 * derive an SGM price from the individual leg prices.
 */

export type BetrSgmLeg = {
  eventId: string | number;
  marketId: string | number;
  selectionId: string | number;
};

export type BetrSgmPrice = {
  price: number;
  fetchedAt: string;
};

export type BetrSgmUnavailable = {
  unavailable: true;
  reason: string;
};

export type BetrSgmPriceResult = BetrSgmPrice | BetrSgmUnavailable;

// Retained here as the hard upper bound for a future supported integration.
export const BETR_SGM_CACHE_TTL_MS = 3 * 60 * 1000;

export async function getSgmPrice(
  _matchId: string | number,
  _legs: BetrSgmLeg[],
): Promise<BetrSgmPriceResult> {
  try {
    return { unavailable: true, reason: "not_supported" };
  } catch {
    // This boundary must remain safe even if a supported transport is added.
    return { unavailable: true, reason: "unavailable" };
  }
}
