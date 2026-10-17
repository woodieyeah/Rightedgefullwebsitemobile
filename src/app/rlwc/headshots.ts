/**
 * Player headshots for match cards.
 *
 * Read from `public_player_headshots`, which stores a portrait URL per player
 * keyed by a normalised name. Headshots are not premium content — they are
 * decoration on selections a subscriber can already see.
 *
 * Fails soft everywhere: an unreachable endpoint, an unknown player or an
 * image that fails to load all fall back to the existing avatar. A missing
 * face must never block a published selection from rendering.
 */

import { findHeadshot, normalisePlayerName } from "../../model/player-headshots.ts";
import { fetchWithTimeout } from "../../model/fetch-timeout.ts";

const SUPABASE_URL = "https://spahmuawycgohcznathc.supabase.co";

export type HeadshotIndex = Record<string, string>;

/** Fetch every headshot for a competition. Returns {} on any failure. */
export async function fetchHeadshots(
  competition: string,
  anonKey: string,
): Promise<HeadshotIndex> {
  if (!anonKey) return {};

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/public_player_headshots` +
      `?competition=eq.${encodeURIComponent(competition)}` +
      `&select=name_key,image_url`;

    const response = await fetchWithTimeout(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) return {};

    const rows = await response.json();
    if (!Array.isArray(rows)) return {};

    const index: HeadshotIndex = {};
    for (const row of rows) {
      if (row?.name_key && row?.image_url) index[row.name_key] = row.image_url;
    }
    return index;
  } catch {
    return {};
  }
}

/** Look up one player's portrait, or null when there is no confident match. */
export function headshotFor(
  index: HeadshotIndex | undefined,
  playerName: string,
): string | null {
  if (!index) return null;
  return findHeadshot(index, playerName);
}

export { normalisePlayerName };
