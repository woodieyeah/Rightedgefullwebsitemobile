/**
 * Leg descriptors for Betr's SameGameMultiPrice endpoint.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * A handicap leg sent with `BetDetailTypeCode: "W"` and `FixedMarketId: 0`
 * is silently priced as an OUTRIGHT. Every Tonga start from +2.5 to +26.5,
 * and Tonga to win, all returned an identical $5.80 — so the card advertised
 * "Tonga +7.5 + Toia $5.80" while the price actually obtained belonged to
 * "Tonga to win + Toia". The true handicap price was $4.20.
 *
 * The endpoint only honours a handicap when the leg carries
 * `BetDetailTypeCode: "HC"`, `MarketType: "HCWEST"` and the start's own
 * `FixedMarketId` — the starts share one EventId/OutcomeId and differ ONLY by
 * FixedMarketId, which is why passing 0 collapsed them all together.
 *
 * Each builder throws rather than degrading to a different market: a leg that
 * quietly becomes another bet is worse than a failed publish.
 */

export interface SgmOutcome {
  name: string;
  price: number;
  points: number;
  eventId: number;
  outcomeId: number;
  fixedMarketId: number;
}

export type SgmLegKind = "handicap" | "outright" | "total" | "try-scorer";

export interface SgmLegDescriptor {
  EventId: number;
  OutcomeId: number;
  MarketType: string;
  FixedWin: number;
  FixedMarketId: number;
  MarketTypeDesc: string;
  GroupByHeader: string;
  Points: number;
  BetDetailTypeCode: string;
  OutcomeName: string;
}

export function buildSgmLeg(
  outcome: SgmOutcome,
  kind: SgmLegKind,
  matchLabel: string,
): SgmLegDescriptor {
  if (!Number.isFinite(outcome.eventId) || outcome.eventId <= 0) {
    throw new Error(`SGM leg for ${outcome.name} has no EventId`);
  }

  const base = {
    EventId: outcome.eventId,
    OutcomeId: outcome.outcomeId,
    FixedWin: outcome.price,
    OutcomeName: outcome.name,
  };

  if (kind === "handicap") {
    if (!outcome.points) {
      throw new Error(
        `a handicap leg needs a non-zero point (${outcome.name}); ` +
        `sending 0 would price it as an outright`,
      );
    }
    if (!Number.isFinite(outcome.fixedMarketId) || outcome.fixedMarketId <= 0) {
      throw new Error(
        `a handicap leg needs its own FixedMarketId (${outcome.name} ${outcome.points}); ` +
        `starts share an EventId and OutcomeId, so 0 collapses them to one price`,
      );
    }
    return {
      ...base,
      MarketType: "HCWEST",
      FixedMarketId: outcome.fixedMarketId,
      MarketTypeDesc: "[Handicap]",
      GroupByHeader: "Handicap",
      Points: outcome.points,
      BetDetailTypeCode: "HC",
    };
  }

  if (kind === "outright") {
    return {
      ...base,
      MarketType: "WIN",
      FixedMarketId: outcome.fixedMarketId ?? 0,
      MarketTypeDesc: `Match Result (${matchLabel})`,
      GroupByHeader: "Match Result",
      Points: 0,
      BetDetailTypeCode: "W",
    };
  }

  if (kind === "total") {
    if (!outcome.points) {
      throw new Error(`a total leg needs its line (${outcome.name})`);
    }
    return {
      ...base,
      MarketType: "TOTAL",
      FixedMarketId: outcome.fixedMarketId ?? 0,
      MarketTypeDesc: `Total Points (${matchLabel})`,
      GroupByHeader: "Total Points",
      Points: outcome.points,
      BetDetailTypeCode: "TP",
    };
  }

  return {
    ...base,
    MarketType: "TSCORER",
    FixedMarketId: 0,
    MarketTypeDesc: `Anytime Tryscorer (${matchLabel})`,
    GroupByHeader: "Anytime Tryscorer",
    Points: 0,
    BetDetailTypeCode: "TS",
  };
}
