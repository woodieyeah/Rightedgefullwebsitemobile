export type VerifiedProofResult = "Hit" | "Miss" | "Needs Check";

export type Round25VerifiedMatchResult = {
  match: string;
  homeTeam: string;
  awayTeam: string;
  day: string;
  dateISO: string;
  dateLabel: string;
  aedt: string;
  stadium: string;
  finalHome: number;
  finalAway: number;
  championDataMatchId: number;
  espnEventId: number;
  sourcesAgree: boolean;
  tryScorers: Record<string, number>;
};

export type Round25CorePlay = {
  match: string;
  selection: string;
  market: "Head 2 Head" | "Line" | "Total";
  modelScore: string;
  modelPct: number;
  odds: number;
  bookmaker: string;
};

export type Round25SameGameMultiLeg = {
  kind: "result" | "try-scorer";
  label: string;
  suffix?: string;
  team: string;
  market: "Head 2 Head" | "Line" | "Anytime Try Scorer";
  marketPct: number;
  modelPct: number;
  odds: number;
};

export type Round25SameGameMulti = {
  match: string;
  bookmaker: string;
  legs: Round25SameGameMultiLeg[];
};

export type SettledRound25SameGameMulti = Round25SameGameMulti & {
  result: VerifiedProofResult;
  legs: Array<Round25SameGameMultiLeg & { result: VerifiedProofResult }>;
};

// Final scores were cross-checked on 24 Aug 2026. Champion Data is the primary
// fixture/player-stat source; ESPN event IDs provide the independent score check.
export const ROUND_25_VERIFIED_RESULTS: Round25VerifiedMatchResult[] = [
  {
    match: "Storm v Panthers",
    homeTeam: "Storm",
    awayTeam: "Panthers",
    day: "Thursday",
    dateISO: "2026-08-20",
    dateLabel: "Aug 20",
    aedt: "7:50 PM",
    stadium: "AAMI Park",
    finalHome: 14,
    finalAway: 22,
    championDataMatchId: 129992501,
    espnEventId: 603434,
    sourcesAgree: true,
    tryScorers: {
      "Dylan Edwards": 0,
      "Moses Leo": 0,
    },
  },
  {
    match: "Raiders v Broncos",
    homeTeam: "Raiders",
    awayTeam: "Broncos",
    day: "Friday",
    dateISO: "2026-08-21",
    dateLabel: "Aug 21",
    aedt: "6:00 PM",
    stadium: "GIO Stadium",
    finalHome: 30,
    finalAway: 34,
    championDataMatchId: 129992502,
    espnEventId: 603435,
    sourcesAgree: true,
    tryScorers: {},
  },
  {
    match: "Dolphins v Eels",
    homeTeam: "Dolphins",
    awayTeam: "Eels",
    day: "Friday",
    dateISO: "2026-08-21",
    dateLabel: "Aug 21",
    aedt: "8:00 PM",
    stadium: "Suncorp Stadium",
    finalHome: 34,
    finalAway: 16,
    championDataMatchId: 129992503,
    espnEventId: 603436,
    sourcesAgree: true,
    tryScorers: {
      "Selwyn Cobbo": 1,
      "Jamayne Isaako": 2,
    },
  },
  {
    match: "Knights v Sea Eagles",
    homeTeam: "Knights",
    awayTeam: "Sea Eagles",
    day: "Saturday",
    dateISO: "2026-08-22",
    dateLabel: "Aug 22",
    aedt: "3:00 PM",
    stadium: "McDonald Jones Stadium",
    finalHome: 24,
    finalAway: 44,
    championDataMatchId: 129992504,
    espnEventId: 603437,
    sourcesAgree: true,
    tryScorers: {
      "Fletcher Sharpe": 0,
      "Tolutau Koula": 0,
    },
  },
  {
    match: "Rabbitohs v Warriors",
    homeTeam: "Rabbitohs",
    awayTeam: "Warriors",
    day: "Saturday",
    dateISO: "2026-08-22",
    dateLabel: "Aug 22",
    aedt: "5:30 PM",
    stadium: "Accor Stadium",
    finalHome: 26,
    finalAway: 45,
    championDataMatchId: 129992505,
    espnEventId: 603438,
    sourcesAgree: true,
    tryScorers: {
      "Leka Halasima": 1,
      "Alofiana Khan-Pereira": 1,
    },
  },
  {
    match: "Dragons v Bulldogs",
    homeTeam: "Dragons",
    awayTeam: "Bulldogs",
    day: "Saturday",
    dateISO: "2026-08-22",
    dateLabel: "Aug 22",
    aedt: "7:30 PM",
    stadium: "Allianz Stadium",
    finalHome: 14,
    finalAway: 44,
    championDataMatchId: 129992506,
    espnEventId: 603439,
    sourcesAgree: true,
    tryScorers: {
      "Bronson Xerri": 1,
      "Jacob Preston": 1,
    },
  },
  {
    match: "Titans v Sharks",
    homeTeam: "Titans",
    awayTeam: "Sharks",
    day: "Sunday",
    dateISO: "2026-08-23",
    dateLabel: "Aug 23",
    aedt: "2:00 PM",
    stadium: "Cbus Super Stadium",
    finalHome: 22,
    finalAway: 30,
    championDataMatchId: 129992507,
    espnEventId: 603440,
    sourcesAgree: true,
    tryScorers: {
      "William Kennedy": 0,
      "Arama Hau": 0,
    },
  },
  {
    match: "Roosters v Tigers",
    homeTeam: "Roosters",
    awayTeam: "Tigers",
    day: "Sunday",
    dateISO: "2026-08-23",
    dateLabel: "Aug 23",
    aedt: "4:05 PM",
    stadium: "Allianz Stadium",
    finalHome: 24,
    finalAway: 25,
    championDataMatchId: 129992508,
    espnEventId: 603441,
    sourcesAgree: true,
    tryScorers: {
      "Billy Smith": 2,
      "Robert Toia": 1,
    },
  },
];

// These are the Core Play selections frozen in RightEdge production before the
// relevant matches. High-variance plays are intentionally not relabelled as Core Plays.
export const ROUND_25_CORE_PLAYS: Round25CorePlay[] = [
  {
    match: "Dolphins v Eels",
    selection: "Dolphins -13.5",
    market: "Line",
    modelScore: "33-17",
    modelPct: 58.257020646231474,
    odds: 1.9,
    bookmaker: "PointsBet",
  },
  {
    match: "Knights v Sea Eagles",
    selection: "Sea Eagles +8.5",
    market: "Line",
    modelScore: "27-21",
    modelPct: 58.257020646231474,
    odds: 1.9,
    bookmaker: "BetRight",
  },
  {
    match: "Rabbitohs v Warriors",
    selection: "Rabbitohs +4.5",
    market: "Line",
    modelScore: "23-25",
    modelPct: 58.257020646231474,
    odds: 1.9,
    bookmaker: "Sportsbet",
  },
  {
    match: "Roosters v Tigers",
    selection: "Tigers +23.5",
    market: "Line",
    modelScore: "33-12",
    modelPct: 58.257020646231474,
    odds: 1.9,
    bookmaker: "Betr",
  },
];

// These are the Round 25 SGM combinations preserved from the RightEdge Multi page.
export const ROUND_25_SAME_GAME_MULTIS: Round25SameGameMulti[] = [
  {
    match: "Storm v Panthers",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Panthers", team: "Panthers", market: "Head 2 Head", marketPct: 72.46, modelPct: 64.5, odds: 1.38 },
      { kind: "try-scorer", label: "Dylan Edwards", suffix: "ANYTIME", team: "Panthers", market: "Anytime Try Scorer", marketPct: 35.09, modelPct: 35.19, odds: 2.85 },
      { kind: "try-scorer", label: "Moses Leo", suffix: "ANYTIME", team: "Storm", market: "Anytime Try Scorer", marketPct: 35.09, modelPct: 37.09, odds: 2.85 },
    ],
  },
  {
    match: "Dolphins v Eels",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Dolphins", team: "Dolphins", market: "Head 2 Head", marketPct: 81.97, modelPct: 78.1, odds: 1.22 },
      { kind: "try-scorer", label: "Selwyn Cobbo", suffix: "ANYTIME", team: "Dolphins", market: "Anytime Try Scorer", marketPct: 63.29, modelPct: 65.21, odds: 1.58 },
      { kind: "try-scorer", label: "Jamayne Isaako", suffix: "ANYTIME", team: "Dolphins", market: "Anytime Try Scorer", marketPct: 59.88, modelPct: 61, odds: 1.67 },
    ],
  },
  {
    match: "Knights v Sea Eagles",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Knights", team: "Knights", market: "Head 2 Head", marketPct: 71.43, modelPct: 60.6, odds: 1.4 },
      { kind: "try-scorer", label: "Fletcher Sharpe", suffix: "ANYTIME", team: "Knights", market: "Anytime Try Scorer", marketPct: 43.48, modelPct: 42, odds: 2.3 },
      { kind: "try-scorer", label: "Tolutau Koula", suffix: "ANYTIME", team: "Sea Eagles", market: "Anytime Try Scorer", marketPct: 33.9, modelPct: 37.15, odds: 2.95 },
    ],
  },
  {
    match: "Rabbitohs v Warriors",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Warriors", team: "Warriors", market: "Head 2 Head", marketPct: 62.5, modelPct: 54.9, odds: 1.6 },
      { kind: "try-scorer", label: "Leka Halasima", suffix: "ANYTIME", team: "Warriors", market: "Anytime Try Scorer", marketPct: 37.04, modelPct: 38.12, odds: 2.7 },
      { kind: "try-scorer", label: "Alofiana Khan-Pereira", suffix: "ANYTIME", team: "Warriors", market: "Anytime Try Scorer", marketPct: 54.64, modelPct: 54.93, odds: 1.83 },
    ],
  },
  {
    match: "Dragons v Bulldogs",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Bulldogs", team: "Bulldogs", market: "Head 2 Head", marketPct: 67.57, modelPct: 62.1, odds: 1.48 },
      { kind: "try-scorer", label: "Bronson Xerri", suffix: "ANYTIME", team: "Bulldogs", market: "Anytime Try Scorer", marketPct: 34.48, modelPct: 35.6, odds: 2.9 },
      { kind: "try-scorer", label: "Jacob Preston", suffix: "ANYTIME", team: "Bulldogs", market: "Anytime Try Scorer", marketPct: 28.57, modelPct: 29.25, odds: 3.5 },
    ],
  },
  {
    match: "Titans v Sharks",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Sharks -6.5", team: "Sharks", market: "Line", marketPct: 52.91, modelPct: 58.3, odds: 1.89 },
      { kind: "try-scorer", label: "William Kennedy", suffix: "ANYTIME", team: "Sharks", market: "Anytime Try Scorer", marketPct: 38.46, modelPct: 38.6, odds: 2.6 },
      { kind: "try-scorer", label: "Arama Hau", suffix: "ANYTIME", team: "Titans", market: "Anytime Try Scorer", marketPct: 23.81, modelPct: 25.6, odds: 4.2 },
    ],
  },
  {
    match: "Roosters v Tigers",
    bookmaker: "Betr",
    legs: [
      { kind: "result", label: "Roosters", team: "Roosters", market: "Head 2 Head", marketPct: 95.24, modelPct: 84, odds: 1.05 },
      { kind: "try-scorer", label: "Billy Smith", suffix: "ANYTIME", team: "Roosters", market: "Anytime Try Scorer", marketPct: 62.5, modelPct: 63.8, odds: 1.6 },
      { kind: "try-scorer", label: "Robert Toia", suffix: "ANYTIME", team: "Roosters", market: "Anytime Try Scorer", marketPct: 48.78, modelPct: 45.37, odds: 2.05 },
    ],
  },
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getVerifiedMatch(match: string) {
  const key = normalize(match);
  const result = ROUND_25_VERIFIED_RESULTS.find((candidate) => normalize(candidate.match) === key);
  if (!result) throw new Error(`No verified Round 25 result for ${match}`);
  if (!result.sourcesAgree) throw new Error(`Round 25 sources disagree for ${match}`);
  return result;
}

function settleMarketSelection(
  selection: string,
  market: "Head 2 Head" | "Line" | "Total",
  match: Round25VerifiedMatchResult,
): VerifiedProofResult {
  if (market === "Total") {
    const parsed = selection.match(/\b(over|under)\s+(-?\d+(?:\.\d+)?)\b/i);
    if (!parsed) return "Needs Check";
    const total = match.finalHome + match.finalAway;
    const point = Number(parsed[2]);
    if (total === point) return "Needs Check";
    return parsed[1].toLowerCase() === "over"
      ? total > point ? "Hit" : "Miss"
      : total < point ? "Hit" : "Miss";
  }

  const lineMatch = selection.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)$/);
  if (market === "Line" && !lineMatch) return "Needs Check";
  const selectedTeam = lineMatch
    ? lineMatch[1]
    : selection.replace(/\s+head[- ]to[- ]head$/i, "").trim();
  const selectedIsHome = normalize(selectedTeam) === normalize(match.homeTeam);
  const selectedIsAway = normalize(selectedTeam) === normalize(match.awayTeam);
  if (!selectedIsHome && !selectedIsAway) return "Needs Check";

  const selectedScore = selectedIsHome ? match.finalHome : match.finalAway;
  const opponentScore = selectedIsHome ? match.finalAway : match.finalHome;
  const line = market === "Line" && lineMatch ? Number(lineMatch[2]) : 0;
  const settledMargin = selectedScore + line - opponentScore;
  if (settledMargin === 0) return "Needs Check";
  return settledMargin > 0 ? "Hit" : "Miss";
}

export function settleRound25CorePlay(play: Round25CorePlay): VerifiedProofResult {
  return settleMarketSelection(play.selection, play.market, getVerifiedMatch(play.match));
}

export function settleVerifiedTryScorer(
  tryScorers: Record<string, number>,
  player: string,
): VerifiedProofResult {
  if (!Object.prototype.hasOwnProperty.call(tryScorers, player)) return "Needs Check";
  return tryScorers[player] > 0 ? "Hit" : "Miss";
}

export function settleVerifiedMultiResult(
  results: VerifiedProofResult[],
): VerifiedProofResult {
  if (results.length === 0) return "Needs Check";
  if (results.some((result) => result === "Miss")) return "Miss";
  if (results.some((result) => result === "Needs Check")) return "Needs Check";
  return "Hit";
}

export function settleRound25SameGameMulti(
  multi: Round25SameGameMulti,
): SettledRound25SameGameMulti {
  const match = getVerifiedMatch(multi.match);
  const legs = multi.legs.map((leg) => {
    const result = leg.kind === "try-scorer"
      ? settleVerifiedTryScorer(match.tryScorers, leg.label)
      : settleMarketSelection(leg.label, leg.market, match);
    return { ...leg, result };
  });
  const result = settleVerifiedMultiResult(legs.map((leg) => leg.result));
  return { ...multi, legs, result };
}
