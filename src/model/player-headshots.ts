/**
 * Player headshots from NRL.com match centre pages.
 *
 * The match centre embeds a squad list with a `headImage` per player, served
 * from Stats Perform on a transparent background with the face centred — which
 * crops cleanly to a small circular avatar.
 *
 * Images are referenced by URL rather than copied: they are ~280KB each at
 * 640x420, so inlining or re-hosting 39 of them would cost far more than the
 * feature is worth. HTTPS is available directly on the Stats Perform host, so
 * there is no mixed-content problem on an HTTPS page.
 *
 * rlwc2026.com was checked first and carries no squad headshots — only
 * editorial photography and competition logos.
 */

export interface PlayerHeadshot {
  /** Full name exactly as the feed reports it. */
  name: string;
  position: string;
  url: string;
}

const NRL_BASE = "https://www.nrl.com";

/**
 * Normalise a player name for matching.
 *
 * Bookmakers and the NRL feed disagree on punctuation and diacritics: TAB
 * writes "Brian Too", Betr writes "Brian To'o", the feed writes "Brian To'o".
 * Stripping everything but letters and spaces makes all three agree.
 */
export function normalisePlayerName(name: string): string {
  return String(name ?? "")
    .normalize("NFD")
    // Strip combining accents so "Fa'alogo" and "Faalogo" match.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Za-z\s]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Pull the squad's headshots out of a match centre page.
 *
 * The page HTML-escapes its embedded JSON, so entities are decoded before
 * matching. Returns an empty array rather than throwing: a missing headshot
 * must degrade to the existing initials avatar, never break the card.
 */
export function parseHeadshots(html: string): PlayerHeadshot[] {
  if (!html) return [];

  const decoded = html.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const pattern =
    /"firstName":"([^"]+)","lastName":"([^"]+)","position":"([^"]*)","headImage":"([^"]+)"/g;

  const seen = new Set<string>();
  const players: PlayerHeadshot[] = [];

  for (const match of decoded.matchAll(pattern)) {
    const [, firstName, lastName, position, rawImage] = match;
    const name = `${firstName} ${lastName}`.trim();
    const key = normalisePlayerName(name);
    if (!key || seen.has(key)) continue;

    const url = resolveHeadshotUrl(rawImage);
    if (!url) continue;

    seen.add(key);
    players.push({ name, position, url });
  }

  return players;
}

/**
 * Turn the feed's image reference into a usable HTTPS URL.
 *
 * The feed wraps the real URL in its own proxy ("/remote.axd?<url>"), and that
 * proxy 404s when called directly, so the wrapped URL is unwrapped and used.
 * Plain http is upgraded to https: the site is served over HTTPS and a browser
 * blocks mixed content outright.
 */
export function resolveHeadshotUrl(rawImage: string): string | null {
  const raw = String(rawImage ?? "").trim();
  if (!raw) return null;

  let url = raw.includes("/remote.axd?") ? raw.split("/remote.axd?")[1] : raw;
  url = url.split("&amp;")[0];

  if (url.startsWith("//")) url = `https:${url}`;
  else if (url.startsWith("http://")) url = url.replace(/^http:/, "https:");
  else if (url.startsWith("/")) url = `${NRL_BASE}${url}`;

  if (!url.startsWith("https://")) return null;
  return url;
}

/** Index headshots by normalised name for lookup from a pick's selection. */
export function headshotIndex(players: PlayerHeadshot[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const player of players) {
    index[normalisePlayerName(player.name)] = player.url;
  }
  return index;
}

/**
 * Strip a market suffix from a selection label.
 *
 * SGM legs are labelled with their market, not just the player: "Brian To'o
 * 2+ tries", "Francis Manuleleua anytime try". The player name is the part
 * before that suffix.
 */
function stripMarketSuffix(label: string): string {
  return String(label ?? "")
    .replace(/\s+\d+\s*\+?\s*(tries|try)\b.*$/i, "")
    .replace(/\s+(anytime|first|last|1st|2nd|3rd)\s*(try\s*scorer|tryscorer|try)?\b.*$/i, "")
    .replace(/\s+to\s+score.*$/i, "")
    .trim();
}

/**
 * Find a player's headshot.
 *
 * Falls back to a surname match only when it is unambiguous: two players
 * sharing a surname must not silently show the wrong face.
 */
export function findHeadshot(
  index: Record<string, string>,
  playerName: string,
): string | null {
  const direct = normalisePlayerName(playerName);
  if (!direct) return null;
  if (index[direct]) return index[direct];

  // Leg labels carry their market, e.g. "Brian To'o 2+ tries".
  const stripped = normalisePlayerName(stripMarketSuffix(playerName));
  if (stripped && index[stripped]) return index[stripped];

  const key = stripped || direct;
  const surname = key.split(" ").slice(-1)[0];
  if (surname.length < 4) return null;

  const matches = Object.keys(index).filter((k) => k.endsWith(` ${surname}`));
  if (matches.length === 1) return index[matches[0]];

  // TAB abbreviates a long first name into the surname to fit its market:
  // "Dallin Watene-Zelezniak" is listed as "Dallin W-Zelezniak", which
  // normalises to "dallin wzelezniak" and matches no stored key. The tail
  // after the abbreviated initial is still distinctive, so match on that —
  // but only when exactly one player ends that way, so an abbreviation can
  // never resolve to the wrong face.
  const abbreviated = surname.match(/^[a-z](.{3,})$/);
  if (abbreviated) {
    const tail = abbreviated[1];
    const tailMatches = Object.keys(index).filter((k) =>
      k.split(" ").slice(-1)[0].endsWith(tail),
    );
    if (tailMatches.length === 1) return index[tailMatches[0]];
  }

  return null;
}
