/**
 * Maps a BlueBet MasterEvent payload into odds_snapshots rows.
 *
 * Pure and synchronous: no network, no database. The worker fetches and
 * inserts; this module decides what a payload MEANS. That split is what makes
 * the mapping testable against a real captured payload rather than a live feed.
 *
 * BLUEBET'S SHAPE
 * A MasterEvent contains Events (markets), each with Outcomes (selections).
 * Market type is inferred from the Event name, because BlueBet has no market
 * type field:
 *     "Match Winner (Australia v New Zealand)"        -> h2h
 *     "Line (Australia v New Zealand)"                -> line
 *     "Total Points Over/Under 40.5 (...)"            -> total
 *
 * Only full-match markets are captured. Half markets ("1st Half Handicap",
 * "Half-Time/Full-Time") are deliberately excluded: settling a full-match pick
 * against a half-match price would be silently wrong.
 *
 * THE DRAW
 * RLWC head-to-head markets carry a real Draw outcome. It is captured like any
 * other selection. Downstream settlement must treat a backed team in a drawn
 * match as a LOSS, not a push — that is what competitions.allows_draw records.
 */

export interface BlueBetOutcome {
  OutcomeName?: string;
  Price?: number;
  Points?: number | null;
}

export interface BlueBetEvent {
  EventName?: string;
  Outcomes?: BlueBetOutcome[];
}

export interface BlueBetMasterEvent {
  Events?: BlueBetEvent[];
}

export type SnapshotMarket = "h2h" | "line" | "total";

export interface OddsSnapshotRow {
  market: SnapshotMarket;
  selection: string;
  point: number | null;
  odds: number;
}

/** Strip the trailing "(Home v Away)" qualifier BlueBet appends. */
function stripFixtureSuffix(eventName: string): string {
  return String(eventName || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * Classify a market from its event name, or null to skip it.
 * Unknown markets are skipped rather than guessed.
 */
export function classifyMarket(eventName: string): SnapshotMarket | null {
  const name = stripFixtureSuffix(eventName).toLowerCase();
  if (!name) return null;

  // Exclude anything scoped to part of a match before matching anything else.
  if (/\b(1st|2nd|first|second)\s+half\b/.test(name)) return null;
  if (/half[-\s]?time/.test(name)) return null;
  if (/\bhalf\b/.test(name)) return null;

  if (/^match winner$/.test(name)) return "h2h";
  if (/^(match )?head to head$/.test(name)) return "h2h";
  if (/^line\b/.test(name)) return "line";
  if (/^(match )?handicap\b/.test(name)) return "line";
  if (/^total (points|score)\b/.test(name)) return "total";
  if (/^(over\/under|over under)\b/.test(name)) return "total";

  return null;
}

/**
 * Normalise an outcome name into a stable selection.
 * Totals become "Over"/"Under"; team and Draw names are passed through trimmed.
 */
export function normaliseSelection(
  market: SnapshotMarket,
  outcomeName: string,
): string | null {
  const raw = String(outcomeName || "").trim();
  if (!raw) return null;

  if (market === "total") {
    if (/^over\b/i.test(raw)) return "Over";
    if (/^under\b/i.test(raw)) return "Under";
    return null;
  }

  // Line outcomes arrive as "Australia -6.5"; the handicap lives in Points.
  if (market === "line") {
    const stripped = raw.replace(/\s*[+-]?\d+(\.\d+)?\s*$/, "").trim();
    return stripped || null;
  }

  return raw;
}

/**
 * Extract the handicap or total line.
 * BlueBet uses Points, but falls back to a number in the outcome name.
 * Returns null for h2h, which has no line.
 */
export function extractPoint(
  market: SnapshotMarket,
  outcome: BlueBetOutcome,
  eventName: string,
): number | null {
  if (market === "h2h") return null;

  const points = Number(outcome.Points);
  if (Number.isFinite(points) && points !== 0) return points;

  // Totals often carry the line in the event name: "Total Points Over/Under 40.5".
  if (market === "total") {
    const fromEvent = String(eventName || "").match(/(\d+(?:\.\d+)?)/);
    if (fromEvent) {
      const value = Number(fromEvent[1]);
      if (Number.isFinite(value)) return value;
    }
  }

  // Lines often carry it in the outcome name: "Australia -6.5".
  const fromOutcome = String(outcome.OutcomeName || "").match(/([+-]?\d+(?:\.\d+)?)\s*$/);
  if (fromOutcome) {
    const value = Number(fromOutcome[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

/**
 * Map a MasterEvent payload to snapshot rows.
 *
 * Skips, never guesses: unknown markets, part-match markets, invalid prices
 * (<= 1 or non-finite), unparseable selections, and line/total outcomes with no
 * resolvable point are all dropped.
 */
export function mapMasterEventToSnapshots(
  payload: BlueBetMasterEvent | null | undefined,
): OddsSnapshotRow[] {
  const events = payload?.Events;
  if (!Array.isArray(events)) return [];

  const rows: OddsSnapshotRow[] = [];

  for (const event of events) {
    const market = classifyMarket(String(event?.EventName || ""));
    if (!market) continue;

    const outcomes = Array.isArray(event?.Outcomes) ? event.Outcomes : [];
    for (const outcome of outcomes) {
      const odds = Number(outcome?.Price);
      if (!Number.isFinite(odds) || odds <= 1) continue;

      const selection = normaliseSelection(market, String(outcome?.OutcomeName || ""));
      if (!selection) continue;

      const point = extractPoint(market, outcome, String(event?.EventName || ""));
      // A line or total without a point is unsettleable — drop it.
      if (market !== "h2h" && point === null) continue;

      rows.push({ market, selection, point, odds });
    }
  }

  return rows;
}

/** Minutes until kickoff. Negative once a match has started. */
export function minutesBeforeKickoff(
  kickoffAt: string | Date,
  now: Date = new Date(),
): number {
  const kickoff = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  return Math.round((kickoff.getTime() - now.getTime()) / 60000);
}
