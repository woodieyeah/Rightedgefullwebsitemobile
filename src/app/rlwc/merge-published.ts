/**
 * Merge published picks with the sheet-derived generator's plays.
 *
 * WHY THIS EXISTS
 * The generator builds its own candidates from whatever row it is given,
 * including our adapted RLWC rows. For Fiji v Cook Islands it invented a
 * "Fiji head-to-head" play from the projected scoreline and keyed it to the
 * same fixture as our published Fiji -8.5. The previous merge skipped any
 * published pick whose fixture already had a play, so the invention won and
 * the real selection never rendered — wrong market, wrong line, and an edge
 * computed against a price we never chose.
 *
 * A published pick is an editorial decision backed by live prices and a
 * ladder rating. It replaces anything generated for the same fixture, no
 * matter how strong the generated numbers look: those numbers describe a
 * different market.
 */

/** A play carrying the fixture row it belongs to. */
export interface PlayLike {
  row: unknown;
  [key: string]: unknown;
}

/**
 * Replace generated plays with published picks fixture by fixture.
 *
 * `fixtureKey` maps a play to the fixture it belongs to; callers pass the
 * app's own pair-key helper so this stays consistent with the rest of the
 * page. Generated plays for fixtures with no published pick are preserved
 * untouched.
 */
export function mergePublishedPlays<T extends PlayLike>(
  generated: T[],
  published: T[],
  fixtureKey: (play: T) => string,
): T[] {
  if (!published.length) return generated;

  const publishedKeys = new Set(published.map(fixtureKey));
  const kept = generated.filter((play) => !publishedKeys.has(fixtureKey(play)));

  return [...kept, ...published];
}
