/**
 * International (nation) team registry for the Rugby League World Cup.
 *
 * RLWC teams are COUNTRIES. They are matched by country name and displayed by
 * country name — no nicknames anywhere. An earlier version also matched
 * nicknames ("Dragons", "Titans", "Lions", "Warriors"), which collided with NRL
 * club names; that is gone. Matching is exact on the country name plus a short
 * list of unambiguous codes a feed may send (PNG, NZL).
 *
 * This registry is consulted before the NRL club registry in App.tsx and returns
 * null for anything it is not certain about, so club cards are untouched. Exact
 * matching is what makes that safe:
 *
 *     "New Zealand"           -> the nation
 *     "New Zealand Warriors"  -> no match here, falls through to the NRL club
 *
 * Colours are the national playing strip; no two nations share a pair. `icon` is
 * a key mapped to a lucide component in App.tsx, keeping this module React-free
 * and trivially testable.
 */

export interface InternationalTeam {
  /** Country name. This is both the match key and the display name. */
  name: string;
  primary: string;
  secondary: string;
  /** Icon key, resolved to a lucide component by the caller. */
  icon: string;
  /** Unambiguous codes a feed may send. Never nicknames. */
  codes: string[];
}

export const INTERNATIONAL_TEAMS: Record<string, InternationalTeam> = {
  australia: {
    name: "Australia",
    primary: "#006A3D",
    secondary: "#FFCD00",
    icon: "star",
    codes: ["aus"],
  },
  "new zealand": {
    name: "New Zealand",
    primary: "#000000",
    secondary: "#FFFFFF",
    icon: "bird",
    codes: ["nzl"],
  },
  samoa: {
    name: "Samoa",
    primary: "#003DA5",
    secondary: "#FFFFFF",
    icon: "shield",
    codes: ["sam", "wsm"],
  },
  tonga: {
    name: "Tonga",
    primary: "#C10000",
    secondary: "#FFFFFF",
    icon: "crown",
    codes: ["tga"],
  },
  england: {
    name: "England",
    primary: "#FFFFFF",
    secondary: "#CE1124",
    icon: "cat",
    codes: ["eng"],
  },
  fiji: {
    name: "Fiji",
    primary: "#68BFE5",
    secondary: "#002B7F",
    icon: "waves",
    codes: ["fij"],
  },
  "papua new guinea": {
    name: "Papua New Guinea",
    primary: "#CE1126",
    secondary: "#FCD116",
    icon: "feather",
    codes: ["png"],
  },
  "cook islands": {
    name: "Cook Islands",
    primary: "#012A87",
    secondary: "#FFFFFF",
    icon: "anchor",
    codes: ["cok"],
  },
  lebanon: {
    name: "Lebanon",
    primary: "#ED1C24",
    secondary: "#00843D",
    icon: "treePine",
    codes: ["lbn"],
  },
  france: {
    name: "France",
    primary: "#002395",
    secondary: "#ED2939",
    icon: "sunrise",
    codes: ["fra"],
  },
  wales: {
    name: "Wales",
    primary: "#C8102E",
    secondary: "#00B259",
    icon: "flame",
    codes: ["wal", "cymru"],
  },
  ireland: {
    name: "Ireland",
    primary: "#169B62",
    secondary: "#FF883E",
    icon: "dog",
    codes: ["irl"],
  },
  scotland: {
    name: "Scotland",
    primary: "#0065BF",
    secondary: "#F5E6C8",
    icon: "heart",
    codes: ["sco"],
  },
  italy: {
    name: "Italy",
    primary: "#008C45",
    secondary: "#CD212A",
    icon: "mountain",
    codes: ["ita"],
  },
  jamaica: {
    name: "Jamaica",
    primary: "#009B3A",
    secondary: "#FED100",
    icon: "music",
    codes: ["jam"],
  },
  greece: {
    name: "Greece",
    primary: "#0D5EAF",
    secondary: "#F0F0F0",
    icon: "sparkles",
    codes: ["gre", "hel"],
  },
};

/** Lowercase, strip punctuation, collapse whitespace. */
function normalise(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a label to a nation, or null when it is not exactly one.
 *
 * Exact matching only. Returning null is the signal for callers to fall back to
 * the NRL club registry — never guess, and never match inside a longer label
 * (substring matching is what made "New Zealand Warriors" resolve to the Kiwis).
 */
export function resolveInternationalTeam(
  rawName: string | null | undefined,
): InternationalTeam | null {
  const name = normalise(rawName ?? "");
  if (!name) return null;

  for (const team of Object.values(INTERNATIONAL_TEAMS)) {
    if (normalise(team.name) === name) return team;
    for (const code of team.codes) {
      if (normalise(code) === name) return team;
    }
  }

  return null;
}
