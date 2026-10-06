/**
 * Adapts Supabase RLWC fixtures into the row shapes the existing match card
 * already renders.
 *
 * The deliberate choice here is NOT to build a second card. RightEdge's match
 * card is well tested and carries team colours, crests, projected score and the
 * play strip; RLWC gets the same component by converting fixtures into
 * PredictionRow/FixtureRow instead of duplicating the UI.
 *
 * HONEST EMPTY STATE
 * No model has run for RLWC and no bookmaker is currently pricing the matches,
 * so every numeric field is zero and `bestBet` is empty. That renders a card
 * showing the matchup, kickoff and venue with "—" where the projection goes,
 * which is accurate. A fabricated projection would be worse than a blank one.
 *
 * Numbers appear here only when the model and odds pipelines fill them in.
 */

import type { PublicFixture } from "./fixtures.ts";
import { formatKickoff } from "./fixtures.ts";

/** Mirrors the FixtureRow type in App.tsx. */
export interface AdaptedFixture {
  roundNumber: number;
  roundLabel: string;
  day: string;
  dateISO: string;
  dateLabel: string;
  tz: string;
  homeTeam: string;
  awayTeam: string;
  stadium: string;
  network: string;
  aedt: string;
  local: string;
}

/** Mirrors the PredictionRow type in App.tsx. */
export interface AdaptedPrediction {
  match: string;
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  modelHomeOdds: number;
  modelAwayOdds: number;
  marketHomeOdds: number;
  marketAwayOdds: number;
  homeOverlay: number;
  awayOverlay: number;
  bestBet: string;
  side: "Home" | "Away" | "";
  stake: number;
  confidence: "Lean" | "Value" | "Strong";
  fixture?: AdaptedFixture | null;
  bestEdge: number;
}

/**
 * RLWC rounds are offset so they cannot collide with NRL rounds in archives,
 * freeze keys or round snapshots. NRL 2026 ended at round 31; starting RLWC at
 * 101 leaves unambiguous space.
 */
export const RLWC_ROUND_OFFSET = 100;

export function toRoundNumber(fixture: PublicFixture): number {
  return RLWC_ROUND_OFFSET + fixture.round_number;
}

export function adaptFixture(fixture: PublicFixture): AdaptedFixture {
  const kickoff = formatKickoff(fixture);
  return {
    roundNumber: toRoundNumber(fixture),
    roundLabel: `RLWC ${fixture.round_label}`,
    day: kickoff.day,
    dateISO: fixture.kickoff_at.slice(0, 10),
    dateLabel: kickoff.dateLabel,
    // Venue timezone label, e.g. AEDT / AWST / NZDT. Display only.
    tz: kickoff.tzLabel,
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    stadium: fixture.stadium ?? "Venue TBC",
    network: "",
    // The card labels this field "AEST"; it carries the venue-local time, which
    // is what a viewer wants for a tournament spanning five timezones.
    aedt: kickoff.time,
    local: kickoff.time,
  };
}

/**
 * Convert a fixture into a prediction row.
 *
 * Every model field is zero and bestBet is empty until a model actually runs.
 * The card renders "—" for absent projections, which is the truthful display.
 */
export function adaptPrediction(fixture: PublicFixture): AdaptedPrediction {
  return {
    match: `${fixture.home_team} v ${fixture.away_team}`,
    roundNumber: toRoundNumber(fixture),
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    predictedWinner: "",
    predictedHomeScore: 0,
    predictedAwayScore: 0,
    modelHomeOdds: 0,
    modelAwayOdds: 0,
    marketHomeOdds: 0,
    marketAwayOdds: 0,
    homeOverlay: 0,
    awayOverlay: 0,
    bestBet: "",
    side: "",
    stake: 0,
    confidence: "Lean",
    fixture: adaptFixture(fixture),
    bestEdge: 0,
  };
}

export function adaptFixtures(fixtures: PublicFixture[]): {
  predictions: AdaptedPrediction[];
  fixtures: AdaptedFixture[];
} {
  return {
    predictions: fixtures.map(adaptPrediction),
    fixtures: fixtures.map(adaptFixture),
  };
}

/** True when a round number belongs to RLWC rather than the NRL. */
export function isRlwcRound(roundNumber: number): boolean {
  return roundNumber > RLWC_ROUND_OFFSET;
}
