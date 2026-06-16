import React, { useEffect, useMemo, useRef, useState } from "react";
import { HelmetProvider, Helmet } from "react-helmet-async";
import {
  projectId,
  publicAnonKey,
} from "../../utils/supabase/info";
import { AdminDashboard } from "./components/AdminDashboard";
import { trackLinkedInConversion } from "../lib/linkedin";
import { capturePostHogEvent, identifyPostHogUser } from "../lib/posthog";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Eye,
  Gauge,
  Home,
  Info,
  LineChart,
  Lock,
  Percent,
  Printer,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Wallet,
  BadgeCheck,
  Flame,
  TrendingUp,
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  CloudLightning,
  Swords,
  Shield,
  Star,
  Waves,
  Zap,
  Skull,
  Anchor,
  Sunrise,
  Tornado,
  Crown,
  ChevronLeft,
  ChevronDown,
  Mail,
  X,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PUBLISHED_SHEET_ID =
  "2PACX-1vTKzRm_dhMcH-2sf_Yf3O6hqQE0_t13TeanTOJF0wwHSTv8Lb8gmR9zlJ1TceW106fM3e6-LHBVCjF8";

const SHEET_GIDS = {
  matchPredictions: "1090622164",
  betLog: "555689434",
  performanceTracker: "1881892521",
  fixtures2026: "2096464205",
  tryScorers: "222068410",
};

const NRL_COLORS: Record<
  string,
  { primary: string; secondary: string }
> = {
  broncos: { primary: "#6A0D45", secondary: "#FFC000" },
  brisbane: { primary: "#6A0D45", secondary: "#FFC000" },
  raiders: { primary: "#00B259", secondary: "#001A4B" },
  canberra: { primary: "#00B259", secondary: "#001A4B" },
  bulldogs: { primary: "#0050A1", secondary: "#FFFFFF" },
  canterbury: { primary: "#0050A1", secondary: "#FFFFFF" },
  sharks: { primary: "#00A6D6", secondary: "#000000" },
  cronulla: { primary: "#00A6D6", secondary: "#000000" },
  dolphins: { primary: "#E02826", secondary: "#F1D495" },
  titans: { primary: "#004D8C", secondary: "#FFC107" },
  "gold coast": { primary: "#004D8C", secondary: "#FFC107" },
  "sea eagles": { primary: "#6C003D", secondary: "#FFFFFF" },
  manly: { primary: "#6C003D", secondary: "#FFFFFF" },
  storm: { primary: "#461C76", secondary: "#FFC000" },
  melbourne: { primary: "#461C76", secondary: "#FFC000" },
  knights: { primary: "#CC0F2F", secondary: "#002D72" },
  newcastle: { primary: "#CC0F2F", secondary: "#002D72" },
  warriors: { primary: "#002D72", secondary: "#005A3B" },
  "new zealand": { primary: "#002D72", secondary: "#005A3B" },
  cowboys: { primary: "#00235C", secondary: "#FFC000" },
  "north qld": { primary: "#00235C", secondary: "#FFC000" },
  eels: { primary: "#004D8C", secondary: "#FFC000" },
  parramatta: { primary: "#004D8C", secondary: "#FFC000" },
  panthers: { primary: "#000000", secondary: "#FFC000" },
  penrith: { primary: "#000000", secondary: "#FFC000" },
  rabbitohs: { primary: "#C60C30", secondary: "#004225" },
  souths: { primary: "#C60C30", secondary: "#004225" },
  dragons: { primary: "#D11029", secondary: "#FFFFFF" },
  "st geo illa": { primary: "#D11029", secondary: "#FFFFFF" },
  roosters: { primary: "#002D72", secondary: "#D11029" },
  sydney: { primary: "#002D72", secondary: "#D11029" },
  tigers: { primary: "#FF7900", secondary: "#000000" },
  "wests tigers": { primary: "#FF7900", secondary: "#000000" },
};

function getTeamColors(teamName: string) {
  if (!teamName)
    return { primary: "#16161D", secondary: "#9CA3AF" };
  const normalized = teamName.toLowerCase();
  for (const [key, value] of Object.entries(NRL_COLORS)) {
    if (normalized.includes(key)) return value;
  }
  return { primary: "#16161D", secondary: "#9CA3AF" };
}

const NRL_MASCOTS: Record<string, React.ElementType> = {
  broncos: Tornado,
  brisbane: Tornado,
  raiders: Skull,
  canberra: Skull,
  bulldogs: Dog,
  canterbury: Dog,
  sharks: Anchor,
  cronulla: Anchor,
  dolphins: Waves,
  titans: Swords,
  "gold coast": Swords,
  "sea eagles": Bird,
  manly: Bird,
  storm: CloudLightning,
  melbourne: CloudLightning,
  knights: Shield,
  newcastle: Shield,
  warriors: Swords,
  "new zealand": Swords,
  cowboys: Star,
  "north qld": Star,
  eels: Activity,
  parramatta: Activity,
  panthers: Cat,
  penrith: Cat,
  rabbitohs: Rabbit,
  souths: Rabbit,
  dragons: Flame,
  "st geo illa": Flame,
  roosters: Sunrise,
  sydney: Sunrise,
  tigers: Cat,
  "wests tigers": Cat,
};

const NRL_TEAMS_FULL: Record<string, string> = {
  brisbane: "Broncos",
  broncos: "Broncos",
  canberra: "Raiders",
  raiders: "Raiders",
  canterbury: "Bulldogs",
  bulldogs: "Bulldogs",
  cronulla: "Sharks",
  sharks: "Sharks",
  dolphins: "Dolphins",
  "gold coast": "Titans",
  titans: "Titans",
  manly: "Sea Eagles",
  "sea eagles": "Sea Eagles",
  melbourne: "Storm",
  storm: "Storm",
  newcastle: "Knights",
  knights: "Knights",
  "new zealand": "Warriors",
  warriors: "Warriors",
  "north qld": "Cowboys",
  cowboys: "Cowboys",
  parramatta: "Eels",
  eels: "Eels",
  penrith: "Panthers",
  panthers: "Panthers",
  souths: "Rabbitohs",
  "south sydney": "Rabbitohs",
  rabbitohs: "Rabbitohs",
  "st george": "Dragons",
  "st geo illa": "Dragons",
  dragons: "Dragons",
  sydney: "Roosters",
  roosters: "Roosters",
  "wests tigers": "Tigers",
  tigers: "Tigers",
};

function getFullTeamName(name: string): string {
  if (!name || name === "—" || name === "-") return name;
  const normalized = name.toLowerCase().trim();
  for (const [key, fullName] of Object.entries(
    NRL_TEAMS_FULL,
  )) {
    if (normalized.includes(key)) {
      return fullName;
    }
  }
  return name;
}

function getTeamIcon(teamName: string): React.ElementType {
  if (!teamName) return ShieldAlert;
  const normalized = teamName.toLowerCase();
  for (const [key, value] of Object.entries(NRL_MASCOTS)) {
    if (normalized.includes(key)) return value;
  }
  return ShieldAlert;
}

function TeamLogo({
  teamName,
  className = "",
}: {
  teamName: string;
  className?: string;
}) {
  if (!teamName || teamName === "—" || teamName === "-")
    return null;
  const colors = getTeamColors(teamName);
  const Icon = getTeamIcon(teamName);

  return (
    <div
      className={`flex items-center justify-center border shrink-0 ${className}`}
      style={{
        backgroundColor: colors.primary,
        color: colors.secondary,
        borderColor: colors.secondary,
      }}
      title={teamName}
    >
      <Icon className="w-3/5 h-3/5 stroke-[2.5px]" />
    </div>
  );
}

function getOriginBadgeConfig(teamName: string) {
  const normalized = teamName.toLowerCase();
  if (normalized.includes("new south wales") || normalized.includes("nsw")) {
    return {
      label: "NSW",
      title: "NSW Blues",
      primary: "#7CC6FF",
      secondary: "#183153",
    };
  }
  if (normalized.includes("queensland") || normalized.includes("qld")) {
    return {
      label: "QLD",
      title: "Queensland Maroons",
      primary: "#8A1748",
      secondary: "#F5E6EE",
    };
  }
  return null;
}

function OriginTeamBadge({
  teamName,
  className = "",
}: {
  teamName: string;
  className?: string;
}) {
  const badge = getOriginBadgeConfig(teamName);
  if (!badge) return null;

  return (
    <div
      className={`flex shrink-0 items-center justify-center border font-black uppercase tracking-wider ${className}`}
      style={{
        backgroundColor: badge.primary,
        borderColor: badge.secondary,
        color: badge.secondary,
      }}
      title={badge.title}
    >
      {badge.label}
    </div>
  );
}

const STARTING_BANKROLL = 5000;
// const MAX_STAKE_CAP_LABEL = '3% bankroll';

type RawRow = Record<string, string>;

type FixtureRow = {
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
};

type PredictionRow = {
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
  fixture?: FixtureRow | null;
  bestEdge: number;
};

type BetLogRow = {
  timestamp: string;
  round: number;
  match: string;
  selection: string;
  side: string;
  marketOdds: number;
  oddsTaken: number;
  modelOdds: number;
  overlay: number;
  modelWinPct: number;
  stake: number;
  result: "W" | "L" | "P";
  profit: number;
  closingOdds: number;
  clv: number;
};

type TryScorerRow = {
  round: number;
  match: string;
  player: string;
  team: string;
  position: string;
  statsInsiderPct: number;
  bestOdds: number;
  bookmaker: string;
  marketImpliedPct: number;
  edgePct: number;
  value: string;
};

type ProofResult = "Hit" | "Miss" | "Pending" | "Needs Check";

type RoundProofMatchPlay = {
  match: string;
  selection: string;
  market: "Head 2 Head" | "Line" | "Total";
  modelScore: string;
  finalScore: string;
  modelPct?: number;
  odds: number;
  bookmaker: string;
  result: ProofResult;
  note: string;
};

type RoundProofTryScorer = {
  match: string;
  player: string;
  team: string;
  odds: number;
  bookmaker: string;
  result: ProofResult;
  note: string;
};

type RoundArchiveFixture = {
  match: string;
  day: string;
  dateISO: string;
  dateLabel: string;
  aedt: string;
  stadium: string;
};

type RoundArchive = {
  round: number;
  label: string;
  status: "Live" | "Results";
  fixtures: RoundArchiveFixture[];
  matchPlays: RoundProofMatchPlay[];
  tryScorers: RoundProofTryScorer[];
};

const ROUND_14_PROOF: RoundArchive = {
  round: 14,
  label: "Round 14 Results",
  status: "Results",
  fixtures: [
    {
      match: "Sea Eagles v Rabbitohs",
      day: "Thursday",
      dateISO: "2026-06-04",
      dateLabel: "Jun 4",
      aedt: "7:50 PM",
      stadium: "4 Pines Park",
    },
    {
      match: "Storm v Knights",
      day: "Friday",
      dateISO: "2026-06-05",
      dateLabel: "Jun 5",
      aedt: "6:00 PM",
      stadium: "AAMI Park",
    },
    {
      match: "Raiders v Roosters",
      day: "Friday",
      dateISO: "2026-06-05",
      dateLabel: "Jun 5",
      aedt: "8:00 PM",
      stadium: "GIO Stadium",
    },
    {
      match: "Cowboys v Dolphins",
      day: "Saturday",
      dateISO: "2026-06-06",
      dateLabel: "Jun 6",
      aedt: "5:30 PM",
      stadium: "QLD Country Bank Stadium",
    },
    {
      match: "Broncos v Titans",
      day: "Saturday",
      dateISO: "2026-06-06",
      dateLabel: "Jun 6",
      aedt: "7:30 PM",
      stadium: "Suncorp Stadium",
    },
    {
      match: "Wests Tigers v Panthers",
      day: "Sunday",
      dateISO: "2026-06-07",
      dateLabel: "Jun 7",
      aedt: "2:00 PM",
      stadium: "CommBank Stadium",
    },
    {
      match: "Sharks v Dragons",
      day: "Sunday",
      dateISO: "2026-06-07",
      dateLabel: "Jun 7",
      aedt: "4:05 PM",
      stadium: "Cronulla Stadium",
    },
    {
      match: "Bulldogs v Eels",
      day: "Monday",
      dateISO: "2026-06-08",
      dateLabel: "Jun 8",
      aedt: "4:05 PM",
      stadium: "Accor Stadium",
    },
  ],
  matchPlays: [
    {
      match: "Sea Eagles v Rabbitohs",
      selection: "Sea Eagles head-to-head",
      market: "Head 2 Head",
      modelScore: "28-23",
      finalScore: "28-14",
      modelPct: 58.8,
      odds: 1.62,
      bookmaker: "BetOnline",
      result: "Hit",
      note: "Model side won outright.",
    },
    {
      match: "Storm v Knights",
      selection: "Knights +3.5",
      market: "Line",
      modelScore: "26-24",
      finalScore: "26-24",
      modelPct: 55.0,
      odds: 2,
      bookmaker: "TAB",
      result: "Hit",
      note: "Knights stayed inside the number.",
    },
    {
      match: "Raiders v Roosters",
      selection: "Under 60.5",
      market: "Total",
      modelScore: "22-26",
      finalScore: "0-26",
      modelPct: 67.7,
      odds: 1.82,
      bookmaker: "Sportsbet",
      result: "Hit",
      note: "Final total landed well under.",
    },
    {
      match: "Cowboys v Dolphins",
      selection: "Cowboys +5.5",
      market: "Line",
      modelScore: "25-24",
      finalScore: "14-40",
      modelPct: 70.4,
      odds: 1.9,
      bookmaker: "Betr",
      result: "Miss",
      note: "Dolphins cleared the line.",
    },
    {
      match: "Broncos v Titans",
      selection: "Under 51.5",
      market: "Total",
      modelScore: "25-20",
      finalScore: "23-28",
      modelPct: 69.3,
      odds: 1.9,
      bookmaker: "Sportsbet",
      result: "Hit",
      note: "Final total was 51.",
    },
    {
      match: "Wests Tigers v Panthers",
      selection: "Tigers +14.5",
      market: "Line",
      modelScore: "19-29",
      finalScore: "0-68",
      modelPct: 64.6,
      odds: 1.82,
      bookmaker: "Sportsbet",
      result: "Miss",
      note: "Panthers cleared the line.",
    },
    {
      match: "Sharks v Dragons",
      selection: "Sharks -10.5",
      market: "Line",
      modelScore: "32-18",
      finalScore: "34-12",
      modelPct: 61.5,
      odds: 1.91,
      bookmaker: "Sportsbet",
      result: "Hit",
      note: "Sharks covered comfortably.",
    },
    {
      match: "Bulldogs v Eels",
      selection: "Bulldogs head-to-head",
      market: "Head 2 Head",
      modelScore: "29-21",
      finalScore: "12-10",
      modelPct: 66.7,
      odds: 1.53,
      bookmaker: "TAB",
      result: "Hit",
      note: "Bulldogs won 12-10.",
    },
  ],
  tryScorers: [
    {
      match: "Storm v Knights",
      player: "Dominic Young",
      team: "Knights",
      odds: 2,
      bookmaker: "Pointsbet",
      result: "Miss",
      note: "Storm v Knights result: 3/5.",
    },
    {
      match: "Storm v Knights",
      player: "Moses Leo",
      team: "Storm",
      odds: 2,
      bookmaker: "BetRight",
      result: "Hit",
      note: "Storm v Knights result: 3/5.",
    },
    {
      match: "Storm v Knights",
      player: "Will Warbrick",
      team: "Storm",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Storm v Knights result: 3/5.",
    },
    {
      match: "Storm v Knights",
      player: "Harry Grant",
      team: "Storm",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Storm v Knights result: 3/5.",
    },
    {
      match: "Storm v Knights",
      player: "Manaia Waitere",
      team: "Storm",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Storm v Knights result: 3/5.",
    },
    {
      match: "Raiders v Roosters",
      player: "Hudson Young",
      team: "Raiders",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Raiders v Roosters result: 0/1.",
    },
    {
      match: "Cowboys v Dolphins",
      player: "Murray Taulagi",
      team: "Cowboys",
      odds: 1.9,
      bookmaker: "BetRight",
      result: "Hit",
      note: "Cowboys v Dolphins result: 2/4.",
    },
    {
      match: "Cowboys v Dolphins",
      player: "Jaxon Purdue",
      team: "Cowboys",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Cowboys v Dolphins result: 2/4.",
    },
    {
      match: "Cowboys v Dolphins",
      player: "Hamiso Tabuai-Fidow",
      team: "Dolphins",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Cowboys v Dolphins result: 2/4.",
    },
    {
      match: "Cowboys v Dolphins",
      player: "Herbie Farnworth",
      team: "Dolphins",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Cowboys v Dolphins result: 2/4.",
    },
    {
      match: "Broncos v Titans",
      player: "Kotoni Staggs",
      team: "Broncos",
      odds: 2.3,
      bookmaker: "TAB",
      result: "Hit",
      note: "Broncos v Titans result: 2/3.",
    },
    {
      match: "Broncos v Titans",
      player: "Phillip Sami",
      team: "Titans",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Broncos v Titans result: 2/3.",
    },
    {
      match: "Broncos v Titans",
      player: "AJ Brimson",
      team: "Titans",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Broncos v Titans result: 2/3.",
    },
    {
      match: "Wests Tigers v Panthers",
      player: "Thomas Jenkins",
      team: "Panthers",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Tigers v Panthers result: 1/1.",
    },
    {
      match: "Sharks v Dragons",
      player: "Ronaldo Mulitalo",
      team: "Sharks",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Sharks v Dragons result: 2/5.",
    },
    {
      match: "Sharks v Dragons",
      player: "Braydon Trindall",
      team: "Sharks",
      odds: 0,
      bookmaker: "Model",
      result: "Hit",
      note: "Sharks v Dragons result: 2/5.",
    },
    {
      match: "Sharks v Dragons",
      player: "Mawene Hiroti",
      team: "Sharks",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Sharks v Dragons result: 2/5.",
    },
    {
      match: "Sharks v Dragons",
      player: "Clinton Gutherson",
      team: "Dragons",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Sharks v Dragons result: 2/5.",
    },
    {
      match: "Sharks v Dragons",
      player: "Jacob Liddle",
      team: "Dragons",
      odds: 0,
      bookmaker: "Model",
      result: "Miss",
      note: "Sharks v Dragons result: 2/5.",
    },
    {
      match: "Bulldogs v Eels",
      player: "Sitili Tupouniua",
      team: "Bulldogs",
      odds: 3.35,
      bookmaker: "Sportsbet",
      result: "Hit",
      note: "Bulldogs v Eels result: 1 scorer hit.",
    },
  ],
};

const ROUND_15_LIVE_PROOF: RoundArchive = {
  round: 15,
  label: "Round 15 Live Results",
  status: "Results",
  fixtures: [
    {
      match: "Rabbitohs v Broncos",
      day: "Thursday",
      dateISO: "2026-06-11",
      dateLabel: "Jun 11",
      aedt: "7:50 PM",
      stadium: "Accor Stadium",
    },
  ],
  matchPlays: [
    {
      match: "Rabbitohs v Broncos",
      selection: "Rabbitohs -6.5",
      market: "Line",
      modelScore: "29-20",
      finalScore: "48-6",
      modelPct: 58.3,
      odds: 1.95,
      bookmaker: "PlayUp",
      result: "Hit",
      note: "Rabbitohs covered the line.",
    },
  ],
  tryScorers: [
    {
      match: "Rabbitohs v Broncos",
      player: "Alex Johnston",
      team: "Rabbitohs",
      odds: 1.57,
      bookmaker: "Ladbrokes",
      result: "Hit",
      note: "Alex Johnston scored.",
    },
  ],
};

// Hardcoded proof archives (kept working as-is). New rounds are derived from KV
// at runtime and merged in via registerKvDerivedArchives() below.
const HARDCODED_PROOF_ARCHIVES: RoundArchive[] = [ROUND_15_LIVE_PROOF, ROUND_14_PROOF];
const HARDCODED_ROUND_ARCHIVES: RoundArchive[] = [ROUND_14_PROOF];

// KV-derived archives (rolled-over rounds). Replaced wholesale when KV loads.
let KV_DERIVED_ARCHIVES: RoundArchive[] = [];

// Live, merged views consumed by helpers + JSX. Hardcoded archives win on round
// collision so ROUND_14_PROOF / ROUND_15_LIVE_PROOF always render as authored.
let ROUND_PROOF_ARCHIVES: RoundArchive[] = [...HARDCODED_PROOF_ARCHIVES];
let ROUND_ARCHIVES: RoundArchive[] = [...HARDCODED_ROUND_ARCHIVES];

function rebuildArchiveRegistries() {
  const hardcodedRounds = new Set(HARDCODED_PROOF_ARCHIVES.map((a) => a.round));
  const extraProof = KV_DERIVED_ARCHIVES.filter((a) => !hardcodedRounds.has(a.round));
  ROUND_PROOF_ARCHIVES = [...extraProof, ...HARDCODED_PROOF_ARCHIVES];

  const hardcodedArchiveRounds = new Set(HARDCODED_ROUND_ARCHIVES.map((a) => a.round));
  const extraArchive = KV_DERIVED_ARCHIVES.filter((a) => !hardcodedArchiveRounds.has(a.round));
  ROUND_ARCHIVES = [...extraArchive, ...HARDCODED_ROUND_ARCHIVES].sort((a, b) => b.round - a.round);
}

// Called by the App once KV-derived (rolled-over) archives are loaded.
function registerKvDerivedArchives(archives: RoundArchive[]) {
  KV_DERIVED_ARCHIVES = archives;
  rebuildArchiveRegistries();
}

function splitMatchTeams(match: string) {
  const [home = "", away = ""] = String(match || "").split(/\s+v\s+/i);
  return {
    homeTeam: normalizeTeamName(home),
    awayTeam: normalizeTeamName(away),
  };
}

function parseScorePair(score: string) {
  const match = String(score || "").match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return { homeScore: 0, awayScore: 0 };
  return {
    homeScore: Number(match[1]),
    awayScore: Number(match[2]),
  };
}

function getArchiveFixture(archive: RoundArchive, match: string): FixtureRow | null {
  const fixture = archive.fixtures.find(
    (candidate) => getMatchPairKeyFromLabel(candidate.match) === getMatchPairKeyFromLabel(match),
  );
  if (!fixture) return null;

  const { homeTeam, awayTeam } = splitMatchTeams(fixture.match);
  return {
    roundNumber: archive.round,
    roundLabel: `Round ${archive.round}`,
    day: fixture.day,
    dateISO: fixture.dateISO,
    dateLabel: fixture.dateLabel,
    tz: "AEST",
    homeTeam,
    awayTeam,
    stadium: fixture.stadium,
    network: "",
    aedt: fixture.aedt,
    local: fixture.aedt,
  };
}

function buildArchivedPredictionRows(archive: RoundArchive): PredictionRow[] {
  return archive.matchPlays.map((play) => {
    const { homeTeam, awayTeam } = splitMatchTeams(play.match);
    const { homeScore, awayScore } = parseScorePair(play.finalScore || play.modelScore);
    const predictedWinner =
      homeScore > awayScore
        ? homeTeam
        : awayScore > homeScore
          ? awayTeam
          : normalizeTeamName(play.selection);

    return {
      match: `${homeTeam} v ${awayTeam}`,
      roundNumber: archive.round,
      homeTeam,
      awayTeam,
      predictedWinner,
      predictedHomeScore: homeScore,
      predictedAwayScore: awayScore,
      modelHomeOdds: 0,
      modelAwayOdds: 0,
      marketHomeOdds: 0,
      marketAwayOdds: 0,
      homeOverlay: 0,
      awayOverlay: 0,
      bestBet: play.selection,
      side: "",
      stake: 0,
      confidence: "Value",
      fixture: getArchiveFixture(archive, play.match),
      bestEdge: 0,
    };
  });
}

type RoundSummary = {
  round: string;
  bets: number;
  roi: number;
  clv: number;
  pnl: number;
  status: "Settled" | "Placed";
  staked: number;
};

type DashboardData = {
  predictions: PredictionRow[];
  betLog: BetLogRow[];
  fixtures: FixtureRow[];
  bankrollData: { bet: string; bankroll: number }[];
  clvData: { match: string; clv: number }[];
  rounds: RoundSummary[];
  teamPerformance: { team: string; profit: number }[];
  outcomeMix: { name: string; value: number }[];
  currentBankroll: number;
  peakBankroll: number;
  peakDrawdown: number;
  peakDrawdownPct: number;
  totalProfit: number;
  totalStakedSettled: number;
  totalStakedAll: number;
  pot: number;
  settledBets: number;
  pendingBets: number;
  wins: number;
  losses: number;
  avgClv: number;
  beatClosingCount: number;
  currentRoundLabel: string;
  currentRoundOpenBets: number;
  currentRoundStake: number;
  trackerValues: Record<string, number>;
  averageEdge: number;
  strongestBet: string;
  tryScorers: TryScorerRow[];
};

const appPages = [
  {
    id: "matches",
    label: "Matches",
    mobileLabel: "Matches",
    icon: <Target className="w-5 h-5" />,
  },
  {
    id: "origin",
    label: "State of Origin",
    mobileLabel: "Origin",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: "best-bets",
    label: "Premium Plays",
    mobileLabel: "Plays",
    icon: <Flame className="w-5 h-5" />,
  },
  {
    id: "try-scorers",
    label: "Try Scorers",
    mobileLabel: "Scorers",
    icon: <Trophy className="w-5 h-5" />,
  },
];

function getAppPages(isAdmin: boolean, _canViewOrigin: boolean) {
  // Origin always appears in the nav. Free users see it locked (premium flag on
  // SidebarItem) and clicking it routes through the upgrade prompt, identical to
  // the other premium nav items (Premium Plays / Try Scorers).
  const visiblePages = appPages;

  if (isAdmin) {
    return [
      ...visiblePages,
      {
        id: "admin-results",
        label: "Results Entry",
        mobileLabel: "Results",
        icon: <CheckCircle2 className="w-5 h-5" />,
      },
      {
        id: "admin",
        label: "Admin",
        mobileLabel: "Admin",
        icon: <Mail className="w-5 h-5" />,
      },
    ];
  }
  return visiblePages;
}

function GlowOrb({
  className,
  gradient,
}: {
  className?: string;
  gradient: string;
}) {
  return (
    <div
      className={`absolute hidden pointer-events-none ${className || ""}`}
      style={{ background: "transparent" }}
    />
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#111116] border border-[#1E1E2E] ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon,
  accent = "neutral",
}: {
  label: string;
  value: string;
  subtext: React.ReactNode;
  icon: React.ReactNode;
  accent?: "neutral" | "green" | "gold" | "blue";
}) {
  const accentText = {
    neutral: "text-white/50",
    green: "text-[#00E676]",
    gold: "text-white",
    blue: "text-white",
  }[accent];

  return (
    <div
      className="bg-[#111116] p-6 md:p-7 flex flex-col justify-between min-h-[120px] md:min-h-[150px] relative overflow-hidden border border-[#1E1E2E]"
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2 md:mb-4">
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#9CA3AF] font-medium">
            {label}
          </div>
          <div
            className={`${accentText} scale-75 md:scale-100 origin-top-right`}
          >
            {icon}
          </div>
        </div>
        <div
          className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-1 md:mb-2 truncate"
          title={value}
        >
          {value}
        </div>
      </div>
      <div
        className="text-[10px] md:text-xs lg:text-sm font-medium text-[#9CA3AF] relative z-10 uppercase tracking-wider truncate"
        title={typeof subtext === "string" ? subtext : ""}
      >
        {subtext}
      </div>
    </div>
  );
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
  premium = false,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  premium?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 min-h-[64px] transition-all border ${
        active
          ? "bg-[#16161D] border-[#1E1E2E] text-white"
          : "bg-transparent border-transparent text-[#6B7280] hover:text-white hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-8 h-8 flex items-center justify-center shrink-0 ${active ? "text-white" : "text-[#6B7280]"}`}
        >
          {icon}
        </div>
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span
            className={`text-base tracking-wide uppercase whitespace-nowrap ${active ? "font-semibold" : "font-medium"}`}
          >
            {label}
          </span>
          {premium && (
            <span
              className={`inline-flex w-fit items-center gap-1 px-0 py-0.5 text-[8px] font-medium uppercase tracking-widest leading-none ${
                active
                  ? "text-[#9CA3AF]"
                  : "text-[#6B7280]"
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
              Premium
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={`w-5 h-5 shrink-0 ${active ? "opacity-100 text-white" : "opacity-0"}`}
      />
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 md:mb-8 border-b border-[#1E1E2E] pb-4 md:pb-5">
      <h2 className="text-xl md:text-2xl font-semibold text-white uppercase tracking-tight mb-1 md:mb-2">
        {title}
      </h2>
      <div className="text-[10px] md:text-sm font-medium text-[#9CA3AF] uppercase tracking-widest">
        {subtitle}
      </div>
    </div>
  );
}

const RESPONSIBLE_GAMBLING_TAGLINES = [
  "Chances are you're about to lose.",
  "Think. Is this a bet you really want to place?",
  "What's gambling really costing you?",
  "What are you prepared to lose today? Set a deposit limit.",
  "Imagine what you could be buying instead.",
  "What are you really gambling with?",
];

function getResponsibleGamblingTagline(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / 86400000,
  );
  return RESPONSIBLE_GAMBLING_TAGLINES[
    Math.abs(dayOfYear) % RESPONSIBLE_GAMBLING_TAGLINES.length
  ];
}

function ResponsibleGamblingNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  const tagline = getResponsibleGamblingTagline();

  return (
    <div
      className={`border border-black bg-white text-black ${
        compact ? "px-3 py-2" : "px-3 py-2 md:px-4"
      }`}
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 700,
      }}
    >
      <div className="grid items-center gap-2 text-center leading-snug md:grid-cols-2 md:gap-4">
        <div className="text-[10px] uppercase tracking-normal md:text-xs">
          {tagline}
        </div>
        <div className="text-[10px] normal-case tracking-normal md:text-xs">
          For free and confidential support call{" "}
        <a
          href="tel:1800858858"
            className="text-black underline underline-offset-2 transition hover:opacity-70"
        >
          1800 858 858
          </a>{" "}
          or visit{" "}
        <a
          href="https://www.gamblinghelponline.org.au/"
          target="_blank"
          rel="noopener noreferrer"
            className="text-black underline underline-offset-2 transition hover:opacity-70"
        >
          gamblinghelponline.org.au
        </a>
          . 18+ only.
        </div>
      </div>
    </div>
  );
}

function toPublishedCsvUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.replace(/\r/g, "").trim());
}

function parseCsv(text: string): RawRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map(
    (header, idx) => header || `col_${idx}`,
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: RawRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });
}

async function fetchSheetRows(gid: string): Promise<RawRow[]> {
  const url = `${toPublishedCsvUrl(gid)}&t=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch sheet ${gid}: ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`Sheet ${gid} returned empty content`);
  }

  if (
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<html")
  ) {
    throw new Error(
      `Sheet ${gid} returned HTML instead of CSV. Re-check the published tab URL and that the tab is published publicly.`,
    );
  }

  return parseCsv(text);
}

function getValue(row: RawRow, possibleKeys: string[]) {
  for (const key of possibleKeys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value)
    .replace(/[$,%]/g, "")
    .replace(/,/g, "")
    .trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function toRoundNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  const direct = toNumber(raw);
  if (direct > 0) return direct;

  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function toPercentNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (raw.includes("%")) return toNumber(raw);
  const num = toNumber(raw);
  return num <= 1 ? num * 100 : num;
}

function formatCurrency(value: number, decimals = 0) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatSignedCurrency(value: number, decimals = 2) {
  const abs = Math.abs(value);
  return `${value >= 0 ? "+" : "-"}${formatCurrency(abs, decimals)}`;
}

function formatPercent(value: number, decimals = 2) {
  return `${value.toFixed(decimals)}%`;
}

function formatOddsValue(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

function normalizeTeamName(value: string) {
  if (!value) return "";
  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();

  const aliases: Record<string, string> = {
    "new south wales blues": "NSW Blues",
    "new south wales": "NSW Blues",
    "nsw blues": "NSW Blues",
    nsw: "NSW Blues",
    "queensland maroons": "Queensland Maroons",
    queensland: "Queensland Maroons",
    qld: "Queensland Maroons",
    melbourne: "Storm",
    storm: "Storm",
    penrith: "Panthers",
    panthers: "Panthers",
    cronulla: "Sharks",
    sharks: "Sharks",
    "cronulla-sutherland": "Sharks",
    sydney: "Roosters",
    roosters: "Roosters",
    canterbury: "Bulldogs",
    "canterbury-bankstown": "Bulldogs",
    bulldogs: "Bulldogs",
    dolphins: "Dolphins",
    "north qld": "Cowboys",
    "north queensland": "Cowboys",
    cowboys: "Cowboys",
    "st geo illa": "Dragons",
    "st george": "Dragons",
    "st george illawarra": "Dragons",
    dragons: "Dragons",
    manly: "Sea Eagles",
    "manly-warringah": "Sea Eagles",
    "sea eagles": "Sea Eagles",
    brisbane: "Broncos",
    broncos: "Broncos",
    newcastle: "Knights",
    knights: "Knights",
    canberra: "Raiders",
    raiders: "Raiders",
    warriors: "Warriors",
    "new zealand": "Warriors",
    souths: "Rabbitohs",
    "south sydney": "Rabbitohs",
    rabbitohs: "Rabbitohs",
    "gold coast": "Titans",
    titans: "Titans",
    parramatta: "Eels",
    eels: "Eels",
    "wests tigers": "Tigers",
    tigers: "Tigers",
  };

  for (const [key, normalized] of Object.entries(aliases).sort(
    ([a], [b]) => b.length - a.length,
  )) {
    if (lower.includes(key)) return normalized;
  }

  return cleaned;
}

function buildMatchKey(homeTeam: string, awayTeam: string) {
  return `${normalizeTeamName(homeTeam)}__${normalizeTeamName(awayTeam)}`;
}

function buildTeamPairKey(teamA: string, teamB: string) {
  return [normalizeTeamName(teamA), normalizeTeamName(teamB)]
    .sort((a, b) => a.localeCompare(b))
    .join("__");
}

function buildMatchLabelKey(match: string) {
  const parts = String(match || "").split(/\s+v\s+/i);
  if (parts.length === 2) {
    return `${normalizeTeamName(parts[0])}__${normalizeTeamName(parts[1])}`;
  }
  return String(match || "").trim().toLowerCase();
}

function buildConfidence(
  edge: number,
  bestBet: string,
  predictedWinner: string,
  side: string,
  predictedHomeScore: number,
  predictedAwayScore: number,
): "Lean" | "Value" | "Strong" {
  const isWinnerPredicted = bestBet === predictedWinner;
  const scoreDiff = Math.abs(
    predictedHomeScore - predictedAwayScore,
  );
  const isCloseMatch = scoreDiff > 0 && scoreDiff <= 6; // Defining a close match as a margin of 6 points or less

  // Strong: Model predicts them to win AND there is sufficient edge
  if (isWinnerPredicted && edge >= 8) {
    return "Strong";
  }

  // Value: Model predicts a close match AND there is sufficient edge
  if (isCloseMatch && edge >= 8) {
    return "Value";
  }

  // Lean: Everything else
  return "Value";
}

function getImpliedWinPctFromOdds(odds: number) {
  if (!odds || odds <= 0) return 0;
  return (1 / odds) * 100;
}

function getRowSideWinPct(row: PredictionRow) {
  if (row.side === "Home")
    return getImpliedWinPctFromOdds(row.modelHomeOdds);
  if (row.side === "Away")
    return getImpliedWinPctFromOdds(row.modelAwayOdds);
  return 0;
}

function getPredictedWinnerWinPct(row: PredictionRow) {
  const winner = normalizeTeamName(row.predictedWinner);
  if (!winner) return 0;
  if (winner === normalizeTeamName(row.homeTeam)) {
    return getImpliedWinPctFromOdds(row.modelHomeOdds);
  }
  if (winner === normalizeTeamName(row.awayTeam)) {
    return getImpliedWinPctFromOdds(row.modelAwayOdds);
  }
  return Math.max(
    getImpliedWinPctFromOdds(row.modelHomeOdds),
    getImpliedWinPctFromOdds(row.modelAwayOdds),
  );
}

function isModelAlignedOfficialPlay(row: PredictionRow) {
  if (!row.bestBet || row.stake <= 0) return false;
  return normalizeTeamName(row.bestBet) === normalizeTeamName(row.predictedWinner);
}

function getPredictedWinnerMarketOdds(row: PredictionRow) {
  const winner = normalizeTeamName(row.predictedWinner);
  if (winner === normalizeTeamName(row.homeTeam)) return row.marketHomeOdds;
  if (winner === normalizeTeamName(row.awayTeam)) return row.marketAwayOdds;
  return 0;
}

function getPredictedWinnerModelOdds(row: PredictionRow) {
  const winner = normalizeTeamName(row.predictedWinner);
  if (winner === normalizeTeamName(row.homeTeam)) return row.modelHomeOdds;
  if (winner === normalizeTeamName(row.awayTeam)) return row.modelAwayOdds;
  return 0;
}

function getOfficialPlayEdge(row: PredictionRow) {
  if (row.side === "Home") return row.homeOverlay;
  if (row.side === "Away") return row.awayOverlay;
  return 0;
}

function getOfficialPlayMarketOdds(row: PredictionRow) {
  if (row.side === "Home") return row.marketHomeOdds;
  if (row.side === "Away") return row.marketAwayOdds;
  return 0;
}

function getPredictedWinnerEdge(row: PredictionRow) {
  const winner = normalizeTeamName(row.predictedWinner);
  if (winner === normalizeTeamName(row.homeTeam)) return row.homeOverlay;
  if (winner === normalizeTeamName(row.awayTeam)) return row.awayOverlay;
  return 0;
}

function getFixtureSortValue(row: PredictionRow) {
  if (!row.fixture) return Number.MAX_SAFE_INTEGER;

  const iso = row.fixture.dateISO || "";
  const time = row.fixture.aedt || row.fixture.local || "";
  const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  const dateOnly = Date.parse(iso);

  if (Number.isFinite(dateOnly) && timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3].toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return dateOnly + hours * 60 * 60 * 1000 + minutes * 60 * 1000;
  }

  const dateTime = Date.parse(`${iso} ${time}`);
  if (Number.isFinite(dateTime)) return dateTime;

  return Number.isFinite(dateOnly) ? dateOnly : Number.MAX_SAFE_INTEGER;
}

function getFixtureUtcKickoffMs(fixture?: FixtureRow | null) {
  if (!fixture) return Number.MAX_SAFE_INTEGER;

  const iso = fixture.dateISO || "";
  const time = fixture.aedt || fixture.local || "";
  const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  const dateOnly = Date.parse(iso);

  if (Number.isFinite(dateOnly) && timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3].toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const tz = (fixture.tz || "").toUpperCase();
    const offsetHours = tz.includes("AEDT") ? 11 : 10;
    return dateOnly + hours * 60 * 60 * 1000 + minutes * 60 * 1000 - offsetHours * 60 * 60 * 1000;
  }

  return Number.MAX_SAFE_INTEGER;
}

function hasPredictionKickedOff(row?: PredictionRow | null, now = Date.now()) {
  if (!row?.fixture) return false;
  return getFixtureUtcKickoffMs(row.fixture) <= now;
}

function getFixtureStatusBadge(fixture?: FixtureRow | null, now = Date.now()) {
  const kickoff = getFixtureUtcKickoffMs(fixture);
  if (!Number.isFinite(kickoff) || kickoff === Number.MAX_SAFE_INTEGER) {
    return {
      label: "Time TBC",
      className: "border-white/10 bg-white/[0.04] text-white/40",
    };
  }

  const diffMs = kickoff - now;
  if (diffMs > 0) {
    const totalMinutes = Math.ceil(diffMs / (60 * 1000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const label = days > 0
      ? `Starts in ${days}d ${hours}h`
      : hours > 0
        ? `Starts in ${hours}h ${minutes}m`
        : `Starts in ${minutes}m`;

    return {
      label,
      className: "border-[#093AD3]/70 bg-[#093AD3]/18 text-[#6FEBDD]",
    };
  }

  if (now - kickoff <= 3 * 60 * 60 * 1000) {
    return {
      label: "Live",
      className: "border-[#00E676]/60 bg-[#00E676]/14 text-[#00E676]",
    };
  }

  return {
    label: "Completed",
    className: "border-white/10 bg-white/[0.04] text-white/35",
  };
}

function isFixtureCompleted(fixture?: FixtureRow | null, now = Date.now()) {
  const kickoff = getFixtureUtcKickoffMs(fixture);
  return Number.isFinite(kickoff) &&
    kickoff !== Number.MAX_SAFE_INTEGER &&
    now - kickoff > 3 * 60 * 60 * 1000;
}

function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function sortPredictionsByFixture(a: PredictionRow, b: PredictionRow) {
  const timeDiff = getFixtureSortValue(a) - getFixtureSortValue(b);
  if (timeDiff !== 0) return timeDiff;
  return a.match.localeCompare(b.match);
}

function chooseBestFixtureCandidate(candidates: FixtureRow[], now = Date.now()) {
  if (!candidates.length) return null;

  const currentWindowStart = now - 6 * 60 * 60 * 1000;

  return [...candidates].sort((a, b) => {
    const aKickoff = getFixtureUtcKickoffMs(a);
    const bKickoff = getFixtureUtcKickoffMs(b);
    const aCurrentOrUpcoming = aKickoff >= currentWindowStart;
    const bCurrentOrUpcoming = bKickoff >= currentWindowStart;

    if (aCurrentOrUpcoming !== bCurrentOrUpcoming) return aCurrentOrUpcoming ? -1 : 1;
    if (aCurrentOrUpcoming && bCurrentOrUpcoming) return aKickoff - bKickoff;
    return bKickoff - aKickoff;
  })[0];
}

function getTryScorerKey(row: TryScorerRow) {
  return `${row.match}::${row.team}::${row.player}`.toLowerCase();
}

function isTryScorerBestBetCandidate(row: TryScorerRow) {
  const wholeNumberModelMarketGap = Math.abs(
    Math.round(row.statsInsiderPct) - Math.round(row.marketImpliedPct),
  );
  const highProbabilityWithEdge =
    row.statsInsiderPct >= 40 &&
    row.edgePct >= 2 &&
    row.bestOdds >= 1.5;
  const nearFairHighProbability =
    row.statsInsiderPct >= 40 &&
    row.bestOdds >= 1.9 &&
    row.edgePct >= -1.25 &&
    wholeNumberModelMarketGap <= 1;

  return highProbabilityWithEdge || nearFairHighProbability;
}

function getMatchBestBetKeys(players: TryScorerRow[]) {
  const usedTeams = new Set<string>();
  const selected = new Set<string>();

  [...players]
    .filter(isTryScorerBestBetCandidate)
    .sort((a, b) => {
      const aGap = Math.abs(Math.round(a.statsInsiderPct) - Math.round(a.marketImpliedPct));
      const bGap = Math.abs(Math.round(b.statsInsiderPct) - Math.round(b.marketImpliedPct));
      const aEdgeBest = a.statsInsiderPct >= 40 && a.edgePct >= 2 && a.bestOdds >= 1.5;
      const bEdgeBest = b.statsInsiderPct >= 40 && b.edgePct >= 2 && b.bestOdds >= 1.5;
      return (
        Number(bEdgeBest) - Number(aEdgeBest) ||
        b.edgePct - a.edgePct ||
        b.statsInsiderPct - a.statsInsiderPct ||
        aGap - bGap ||
        b.bestOdds - a.bestOdds
      );
    })
    .forEach((row) => {
      const teamKey = normalizeTeamName(row.team);
      if (selected.size >= 2 || usedTeams.has(teamKey)) return;
      usedTeams.add(teamKey);
      selected.add(getTryScorerKey(row));
    });

  return selected;
}

function getTryScorerSignal(row: TryScorerRow, bestBetKeys?: Set<string>) {
  const highProbabilityNearFair =
    row.statsInsiderPct >= 42 &&
    row.edgePct >= -3 &&
    row.bestOdds >= 1.5;
  const clearValue =
    row.edgePct >= 3 ||
    (row.edgePct >= 0 && row.bestOdds >= 2.5) ||
    (row.edgePct >= -0.5 && row.bestOdds >= 3);

  if (bestBetKeys?.has(getTryScorerKey(row))) {
    return {
      label: "Best Bet",
      className: "bg-[#16161D] border border-[#1E1E2E] text-white",
      sortRank: 3,
    };
  }

  if (highProbabilityNearFair) {
    return {
      label: "High Prob",
      className: "bg-[#16161D] border border-[#1E1E2E] text-white",
      sortRank: 2,
    };
  }

  if (clearValue) {
    return {
      label: "Value",
      className: "bg-[#16161D] border border-[#1E1E2E] text-white",
      sortRank: 1,
    };
  }

  return null;
}

function getTryScorerSignalClass(label?: string) {
  if (label === "Best Bet") return "bg-[#16161D] border border-[#1E1E2E] text-white";
  if (label === "High Prob") return "bg-[#16161D] border border-[#1E1E2E] text-white";
  if (label === "Value") return "bg-[#16161D] border border-[#1E1E2E] text-white";
  return "bg-[#16161D] border border-[#1E1E2E] text-[#9CA3AF]";
}

function getMatchPairKeyFromLabel(match: string) {
  const parts = String(match || "").split(/\s+v\s+/i);
  if (parts.length === 2) return buildTeamPairKey(parts[0], parts[1]);
  return String(match || "").trim().toLowerCase();
}

function getPredictionPairKey(row: PredictionRow) {
  return buildTeamPairKey(row.homeTeam, row.awayTeam);
}

function getSettledBetForPrediction(data: DashboardData, row: PredictionRow) {
  const pairKey = getPredictionPairKey(row);
  return data.betLog
    .filter((bet) => getMatchPairKeyFromLabel(bet.match) === pairKey)
    // Round guard: only surface a settled bet from the SAME round as this
    // fixture. Two teams meet multiple times a season, and matching on the
    // team-pair alone leaked a prior meeting's settled play onto an upcoming
    // match card (e.g. a stale "SHARKS @ $2.05" on the Jun 21 Roosters v Sharks).
    .filter((bet) => !row.roundNumber || !bet.round || bet.round === row.roundNumber)
    .filter((bet) => bet.result === "W" || bet.result === "L" || bet.result === "P")
    .sort((a, b) => Math.abs(b.profit || 0) - Math.abs(a.profit || 0))[0] || null;
}

function getTryScorerSignalsForPrediction(data: DashboardData, row: PredictionRow, limit = 2) {
  const pairKey = getPredictionPairKey(row);
  const players = data.tryScorers.filter((player) => {
    if (row.roundNumber && player.round && player.round !== row.roundNumber) return false;
    return getMatchPairKeyFromLabel(player.match) === pairKey;
  });
  const bestBetKeys = getMatchBestBetKeys(players);

  return players
    .map((player) => ({
      row: player,
      signal: getTryScorerSignal(player, bestBetKeys),
    }))
    .filter(({ row: player, signal }) => signal || bestBetKeys.has(getTryScorerKey(player)))
    .sort((a, b) =>
      (b.signal?.sortRank || 0) - (a.signal?.sortRank || 0) ||
      b.row.statsInsiderPct - a.row.statsInsiderPct ||
      b.row.edgePct - a.row.edgePct
    )
    .slice(0, limit);
}

function getRoundProofArchiveForPrediction(row: PredictionRow, archive: RoundArchive | null = null) {
  if (archive) return archive;
  const pairKey = getPredictionPairKey(row);

  const sameRoundMatch =
    ROUND_PROOF_ARCHIVES.find((candidate) =>
      candidate.round === row.roundNumber &&
      (
        candidate.fixtures.some((fixture) => getMatchPairKeyFromLabel(fixture.match) === pairKey) ||
        candidate.matchPlays.some((play) => getMatchPairKeyFromLabel(play.match) === pairKey) ||
        candidate.tryScorers.some((scorer) => getMatchPairKeyFromLabel(scorer.match) === pairKey)
      )
    ) || null;
  if (sameRoundMatch) return sameRoundMatch;

  // Cross-round, pair-only fallback is ONLY safe for matches that have already
  // been played. For an upcoming fixture it would wrongly inherit proof from a
  // prior meeting of the same two teams (the stale "SHARKS @ $2.05" bug), so we
  // never fall back for upcoming games.
  if (!isFixtureCompleted(row.fixture)) return null;

  return (
    ROUND_PROOF_ARCHIVES.find((candidate) =>
      candidate.matchPlays.some((play) => getMatchPairKeyFromLabel(play.match) === pairKey) ||
      candidate.tryScorers.some((scorer) => getMatchPairKeyFromLabel(scorer.match) === pairKey)
    ) ||
    null
  );
}

function getRoundProofMatchPlaysForPrediction(row: PredictionRow, archive: RoundArchive | null = null) {
  const resolvedArchive = getRoundProofArchiveForPrediction(row, archive);
  if (!resolvedArchive) return [];
  const pairKey = getPredictionPairKey(row);
  return resolvedArchive.matchPlays.filter(
    (play) => getMatchPairKeyFromLabel(play.match) === pairKey,
  );
}

function getRoundProofTryScorerHitsForPrediction(row: PredictionRow, archive: RoundArchive | null = null) {
  const resolvedArchive = getRoundProofArchiveForPrediction(row, archive);
  if (!resolvedArchive) return [];
  const pairKey = getPredictionPairKey(row);
  return resolvedArchive.tryScorers.filter(
    (scorer) => scorer.result === "Hit" && getMatchPairKeyFromLabel(scorer.match) === pairKey,
  );
}

function hasSettledRoundProofForPrediction(row: PredictionRow, archive: RoundArchive | null = null) {
  return getRoundProofMatchPlaysForPrediction(row, archive).some(
    (play) => play.result === "Hit" || play.result === "Miss",
  );
}

function getRoundProofForPremiumPlay(play: PremiumMarketPlay) {
  const pairKey = getPredictionPairKey(play.row);
  const proofArchive = getRoundProofArchiveForPrediction(play.row);
  if (!proofArchive) return null;
  const matchProofs = proofArchive.matchPlays.filter(
    (proof) => getMatchPairKeyFromLabel(proof.match) === pairKey,
  );
  return matchProofs.find((proof) => proof.market === play.type) || matchProofs[0] || null;
}

function getRoundProofForTryScorer(row: TryScorerRow) {
  const pairKey = getMatchPairKeyFromLabel(row.match);
  const playerKey = row.player.trim().toLowerCase();
  const proofArchive =
    ROUND_PROOF_ARCHIVES.find((archive) =>
      archive.round === row.round &&
      archive.tryScorers.some(
        (proof) =>
          getMatchPairKeyFromLabel(proof.match) === pairKey &&
          proof.player.trim().toLowerCase() === playerKey,
      )
    ) ||
    ROUND_PROOF_ARCHIVES.find((archive) =>
      archive.tryScorers.some(
        (proof) =>
          getMatchPairKeyFromLabel(proof.match) === pairKey &&
          proof.player.trim().toLowerCase() === playerKey,
      )
    );

  return proofArchive?.tryScorers.find(
    (proof) =>
      getMatchPairKeyFromLabel(proof.match) === pairKey &&
      proof.player.trim().toLowerCase() === playerKey,
  ) || null;
}

// ---------------------------------------------------------------------------
// Freeze-at-kickoff + results: shared types, helpers, and data hook.
// ---------------------------------------------------------------------------

type FrozenTryScorer = {
  player: string;
  team: string;
  position?: string;
  odds: number;
  bookmaker: string;
};

type FrozenPlayPayload = {
  selection: string;
  type: PremiumMarketPlay["type"];
  odds: number;
  bookmaker: string;
  modelPct: number;
  modelEdge: number;
  marketPoint?: number;
  projectedValue?: number;
  predictedScore?: string;
  homeTeam: string;
  awayTeam: string;
  round: number;
  fixture: {
    match: string;
    day: string;
    dateISO: string;
    dateLabel: string;
    aedt: string;
    stadium: string;
    tz?: string;
  } | null;
  tryScorers: FrozenTryScorer[];
};

type FrozenSnapshot = {
  round: number;
  match: string;
  matchKey: string;
  payload: FrozenPlayPayload;
  frozenAt?: string;
};

type SavedRoundResult = {
  round: number;
  match: string;
  matchKey: string;
  finalHome: number | null;
  finalAway: number | null;
  playResult: "HIT" | "MISS" | "PUSH" | null;
  tryScorerHits: Record<string, boolean>;
  updatedAt?: string;
};

function normalizeTryScorerPlayerKey(player: string) {
  return String(player || "").trim().toLowerCase();
}

// Map admin HIT/MISS/PUSH onto the existing ProofResult palette so we can reuse
// PremiumResultBadge / getProofResultClass without new colors.
function playResultToProof(result: SavedRoundResult["playResult"]): ProofResult | undefined {
  if (result === "HIT") return "Hit";
  if (result === "MISS") return "Miss";
  if (result === "PUSH") return "Needs Check";
  return undefined;
}

// Build the snapshot payload for a live play + its try scorers at kickoff.
function buildFrozenPayloadFromPlay(
  play: PremiumMarketPlay,
  tryScorers: FrozenTryScorer[],
): FrozenPlayPayload {
  const { row } = play;
  const predictedScore =
    row.predictedHomeScore || row.predictedAwayScore
      ? `${Math.round(row.predictedHomeScore)}-${Math.round(row.predictedAwayScore)}`
      : "";
  return {
    selection: play.selection,
    type: play.type,
    odds: play.odds,
    bookmaker: play.bookmaker,
    modelPct: play.modelPct,
    modelEdge: play.modelEdge,
    marketPoint: play.marketPoint,
    projectedValue: play.projectedValue,
    predictedScore,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    round: row.roundNumber,
    fixture: row.fixture
      ? {
          match: `${row.homeTeam} v ${row.awayTeam}`,
          day: row.fixture.day,
          dateISO: row.fixture.dateISO,
          dateLabel: row.fixture.dateLabel,
          aedt: row.fixture.aedt,
          stadium: row.fixture.stadium,
          tz: row.fixture.tz,
        }
      : null,
    tryScorers,
  };
}

// Reconstruct a PremiumMarketPlay from a frozen snapshot, reusing the live
// prediction row where available so PremiumMarketPlayCard renders identically.
function reconstructFrozenPlay(
  snapshot: FrozenSnapshot,
  row: PredictionRow | null,
): PremiumMarketPlay {
  const payload = snapshot.payload;
  const baseRow: PredictionRow =
    row || ({
      match: snapshot.match,
      roundNumber: payload.round,
      homeTeam: payload.homeTeam,
      awayTeam: payload.awayTeam,
      predictedWinner: payload.homeTeam,
      predictedHomeScore: payload.predictedScore
        ? parseScorePair(payload.predictedScore).homeScore
        : 0,
      predictedAwayScore: payload.predictedScore
        ? parseScorePair(payload.predictedScore).awayScore
        : 0,
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
      bestEdge: 0,
      fixture: payload.fixture
        ? {
            roundNumber: payload.round,
            roundLabel: `Round ${payload.round}`,
            day: payload.fixture.day,
            dateISO: payload.fixture.dateISO,
            dateLabel: payload.fixture.dateLabel,
            tz: payload.fixture.tz || "AEST",
            homeTeam: payload.homeTeam,
            awayTeam: payload.awayTeam,
            stadium: payload.fixture.stadium,
            network: "",
            aedt: payload.fixture.aedt,
            local: payload.fixture.aedt,
          }
        : null,
    } as PredictionRow);

  return {
    id: `frozen-${snapshot.round}-${snapshot.matchKey}`,
    row: baseRow,
    type: payload.type,
    selection: payload.selection,
    bookmaker: payload.bookmaker,
    odds: payload.odds,
    modelPct: payload.modelPct,
    modelEdge: payload.modelEdge,
    marketPoint: payload.marketPoint,
    projectedValue: payload.projectedValue,
  };
}

// Convert a frozen snapshot + saved result into a RoundProofMatchPlay (for the
// rolled-over archive view).
function frozenToProofMatchPlay(
  snapshot: FrozenSnapshot,
  result: SavedRoundResult | null,
): RoundProofMatchPlay {
  const payload = snapshot.payload;
  const finalScore =
    result && result.finalHome != null && result.finalAway != null
      ? `${result.finalHome}-${result.finalAway}`
      : "";
  return {
    match: payload.fixture?.match || snapshot.match,
    selection: payload.selection,
    market: payload.type,
    modelScore: payload.predictedScore || "—",
    finalScore,
    modelPct: payload.modelPct,
    odds: payload.odds,
    bookmaker: payload.bookmaker,
    result: playResultToProof(result?.playResult ?? null) || "Pending",
    note: "",
  };
}

// Australia/Sydney is UTC+10 (AEST) or UTC+11 (AEDT, ~Oct–Apr). NRL rounds in
// this app are stamped AEST, so use +10 for the rollover boundary calc.
const AEST_OFFSET_HOURS = 10;

// Compute the archive boundary: the Tuesday 00:00 AEST AFTER the round's last
// fixture. Before this instant settled cards stay in place; after it the round
// rolls into the dropdown archive.
function getRoundArchiveBoundaryMs(lastFixtureKickoffMs: number): number {
  if (!Number.isFinite(lastFixtureKickoffMs)) return Number.MAX_SAFE_INTEGER;
  // Shift into AEST local time so day-of-week + midnight are computed locally.
  const aestMs = lastFixtureKickoffMs + AEST_OFFSET_HOURS * 60 * 60 * 1000;
  const d = new Date(aestMs);
  const dow = d.getUTCDay(); // 0 Sun .. 2 Tue
  // Days until the NEXT Tuesday strictly after this fixture day.
  let daysUntilTue = (2 - dow + 7) % 7;
  if (daysUntilTue === 0) daysUntilTue = 7;
  const tue = new Date(aestMs);
  tue.setUTCDate(tue.getUTCDate() + daysUntilTue);
  tue.setUTCHours(0, 0, 0, 0);
  // Convert the AEST-local midnight back to a real UTC instant.
  return tue.getTime() - AEST_OFFSET_HOURS * 60 * 60 * 1000;
}

// Returns the set of normalized match keys whose round has rolled over past the
// Tuesday-after boundary (so they should leave the live page and enter the
// archive). Computed per round from the latest fixture kickoff in that round.
function getArchivedMatchKeys(data: DashboardData, now: number): Set<string> {
  const lastKickoffByRound = new Map<number, number>();
  for (const row of data.predictions) {
    if (!Number.isFinite(row.roundNumber)) continue;
    const ko = getFixtureUtcKickoffMs(row.fixture);
    if (!Number.isFinite(ko) || ko === Number.MAX_SAFE_INTEGER) continue;
    const prev = lastKickoffByRound.get(row.roundNumber) ?? 0;
    if (ko > prev) lastKickoffByRound.set(row.roundNumber, ko);
  }

  const archivedRounds = new Set<number>();
  for (const [round, lastKo] of lastKickoffByRound) {
    if (now >= getRoundArchiveBoundaryMs(lastKo)) archivedRounds.add(round);
  }

  const keys = new Set<string>();
  if (archivedRounds.size === 0) return keys;
  for (const row of data.predictions) {
    if (archivedRounds.has(row.roundNumber)) keys.add(getPredictionPairKey(row));
  }
  return keys;
}

// Build a RoundArchive (the shape the dropdown archive UI consumes) for a single
// rolled-over round from its frozen snapshots + saved results. Renders through
// the SAME archive UI as ROUND_14_PROOF.
function buildKvDerivedArchive(
  round: number,
  snapshots: FrozenSnapshot[],
  results: SavedRoundResult[],
): RoundArchive | null {
  if (snapshots.length === 0) return null;
  const resultByKey = new Map<string, SavedRoundResult>();
  for (const r of results) {
    if (r?.matchKey) resultByKey.set(r.matchKey, r);
  }

  const fixtures: RoundArchiveFixture[] = [];
  const matchPlays: RoundProofMatchPlay[] = [];
  const tryScorers: RoundProofTryScorer[] = [];

  for (const snapshot of snapshots) {
    const result = resultByKey.get(snapshot.matchKey) || null;
    const matchLabel = snapshot.payload.fixture?.match || snapshot.match;

    if (snapshot.payload.fixture) {
      const fx = snapshot.payload.fixture;
      fixtures.push({
        match: matchLabel,
        day: fx.day || "",
        dateISO: fx.dateISO || "",
        dateLabel: fx.dateLabel || "",
        aedt: fx.aedt || "",
        stadium: fx.stadium || "",
      });
    }

    matchPlays.push(frozenToProofMatchPlay(snapshot, result));

    for (const ts of snapshot.payload.tryScorers || []) {
      const hit = Boolean(result?.tryScorerHits?.[normalizeTryScorerPlayerKey(ts.player)]);
      tryScorers.push({
        match: matchLabel,
        player: ts.player,
        team: ts.team,
        odds: ts.odds,
        bookmaker: ts.bookmaker,
        result: result ? (hit ? "Hit" : "Miss") : "Pending",
        note: "",
      });
    }
  }

  return {
    round,
    label: `Round ${round} Results`,
    status: "Results",
    fixtures,
    matchPlays,
    tryScorers,
  };
}

// Load + register KV-derived archives for every round that has rolled past the
// Tuesday boundary. Returns the count registered so the App can bump a version.
async function loadKvDerivedArchivesForRounds(rounds: number[]): Promise<RoundArchive[]> {
  const built = await Promise.all(
    rounds.map(async (round) => {
      const [snaps, res] = await Promise.all([
        fetchRoundSnapshots(round),
        fetchRoundResults(round),
      ]);
      return buildKvDerivedArchive(round, snaps, res);
    }),
  );
  return built.filter(Boolean) as RoundArchive[];
}

// Rounds whose Tuesday boundary has passed (eligible for the dropdown archive).
function getArchivedRoundNumbers(data: DashboardData, now: number): number[] {
  const lastKickoffByRound = new Map<number, number>();
  for (const row of data.predictions) {
    if (!Number.isFinite(row.roundNumber)) continue;
    const ko = getFixtureUtcKickoffMs(row.fixture);
    if (!Number.isFinite(ko) || ko === Number.MAX_SAFE_INTEGER) continue;
    const prev = lastKickoffByRound.get(row.roundNumber) ?? 0;
    if (ko > prev) lastKickoffByRound.set(row.roundNumber, ko);
  }
  const rounds: number[] = [];
  for (const [round, lastKo] of lastKickoffByRound) {
    if (now >= getRoundArchiveBoundaryMs(lastKo)) rounds.push(round);
  }
  return rounds;
}

async function fetchRoundSnapshots(round: number): Promise<FrozenSnapshot[]> {
  try {
    const res = await fetch(`/api/round-snapshots?round=${round}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.snapshots) ? json.snapshots : [];
  } catch {
    return [];
  }
}

async function fetchRoundResults(round: number): Promise<SavedRoundResult[]> {
  try {
    const res = await fetch(`/api/round-results?round=${round}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.results) ? json.results : [];
  } catch {
    return [];
  }
}

async function postRoundSnapshot(body: {
  round: number;
  match: string;
  matchKey: string;
  payload: FrozenPlayPayload;
}): Promise<FrozenSnapshot | null> {
  try {
    const res = await fetch(`/api/round-snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.snapshot || null;
  } catch {
    return null;
  }
}

async function postAdminRoundResult(body: {
  round: number;
  match: string;
  matchKey: string;
  finalHome: number | null;
  finalAway: number | null;
  playResult: "HIT" | "MISS" | "PUSH" | null;
  tryScorerHits: Record<string, boolean>;
}): Promise<SavedRoundResult | null> {
  try {
    const res = await fetch(`/api/admin/round-results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result || null;
  } catch {
    return null;
  }
}

// The active live round (max round number across predictions).
function getActiveRound(data: DashboardData): number {
  return Math.max(
    0,
    ...data.predictions
      .map((row) => row.roundNumber)
      .filter((r) => Number.isFinite(r)),
  );
}

// Shared freeze + results data for the active round. Loads snapshots/results
// from KV, snapshots newly-kicked-off plays (first-write-wins), and exposes
// lookup maps keyed by normalized match key.
function useFrozenRoundData(
  data: DashboardData,
  marketMap: SgmMarketMap,
  now: number,
  options?: { enableFreeze?: boolean },
) {
  const enableFreeze = options?.enableFreeze !== false;
  const round = getActiveRound(data);
  const [snapshots, setSnapshots] = useState<FrozenSnapshot[]>([]);
  const [results, setResults] = useState<SavedRoundResult[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const postedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!round) return;
    let mounted = true;
    Promise.all([fetchRoundSnapshots(round), fetchRoundResults(round)]).then(
      ([snaps, res]) => {
        if (!mounted) return;
        setSnapshots(snaps);
        setResults(res);
        for (const s of snaps) {
          if (s?.matchKey) postedKeysRef.current.add(s.matchKey);
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [round, refreshTick]);

  const snapshotByKey = useMemo(() => {
    const map = new Map<string, FrozenSnapshot>();
    for (const s of snapshots) {
      if (s?.matchKey) map.set(s.matchKey, s);
    }
    return map;
  }, [snapshots]);

  const resultByKey = useMemo(() => {
    const map = new Map<string, SavedRoundResult>();
    for (const r of results) {
      if (r?.matchKey) map.set(r.matchKey, r);
    }
    return map;
  }, [results]);

  // Freeze trigger: for each match that has kicked off and has a live play but
  // no snapshot yet, POST it once. First-write-wins on the server locks values.
  useEffect(() => {
    if (!enableFreeze || !round) return;
    if (Object.keys(marketMap || {}).length === 0) return;

    const toPost: {
      round: number;
      match: string;
      matchKey: string;
      payload: FrozenPlayPayload;
    }[] = [];

    for (const row of data.predictions) {
      if (!hasPredictionKickedOff(row, now)) continue;
      const matchKey = getPredictionPairKey(row);
      if (postedKeysRef.current.has(matchKey)) continue;
      if (snapshotByKey.has(matchKey)) {
        postedKeysRef.current.add(matchKey);
        continue;
      }
      const play = getBestPremiumMarketPlayForMatch(row, marketMap);
      if (!play) continue; // odds already gone and no live play — nothing to lock
      const tryScorerSignals = getTryScorerSignalsForPrediction(data, row, 5);
      const frozenScorers: FrozenTryScorer[] = tryScorerSignals.map(({ row: ts }) => ({
        player: ts.player,
        team: ts.team,
        position: ts.position,
        odds: ts.bestOdds,
        bookmaker: ts.bookmaker,
      }));
      postedKeysRef.current.add(matchKey);
      toPost.push({
        round: row.roundNumber,
        match: `${row.homeTeam} v ${row.awayTeam}`,
        matchKey,
        payload: buildFrozenPayloadFromPlay(play, frozenScorers),
      });
    }

    if (toPost.length === 0) return;
    let mounted = true;
    Promise.all(toPost.map((b) => postRoundSnapshot(b))).then((saved) => {
      if (!mounted) return;
      const added = saved.filter(Boolean) as FrozenSnapshot[];
      if (added.length) setSnapshots((prev) => [...prev, ...added]);
    });
    return () => {
      mounted = false;
    };
  }, [enableFreeze, round, data, marketMap, now, snapshotByKey]);

  const refresh = () => setRefreshTick((t) => t + 1);
  const applyResult = (result: SavedRoundResult) => {
    setResults((prev) => {
      const others = prev.filter((r) => r.matchKey !== result.matchKey);
      return [...others, result];
    });
  };

  return { round, snapshots, results, snapshotByKey, resultByKey, refresh, applyResult };
}

function getFeaturedPrediction(predictions: PredictionRow[]) {
  if (!predictions.length) return null;

  const upcomingPredictions = predictions.filter(
    (row) => !hasPredictionKickedOff(row),
  );
  const candidateRows = upcomingPredictions.length
    ? upcomingPredictions
    : predictions;

  const scoreUrgency = (row: PredictionRow) => {
    const kickoff = getFixtureUtcKickoffMs(row.fixture);
    if (!Number.isFinite(kickoff)) return 0;
    const hoursUntilKickoff = (kickoff - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilKickoff < 0) return 0;
    if (hoursUntilKickoff <= 24) return 6;
    if (hoursUntilKickoff <= 72) return 3;
    return 0;
  };

  const scoreMarketAppeal = (odds: number) => {
    if (!odds || odds < 1.3) return -100;
    if (odds <= 3.75) return 5;
    return 1;
  };

  const positiveOfficialPlays = candidateRows.filter(
    (row) =>
      isModelAlignedOfficialPlay(row) &&
      getOfficialPlayEdge(row) > 0 &&
      scoreMarketAppeal(getOfficialPlayMarketOdds(row)) > -100,
  );

  if (positiveOfficialPlays.length) {
    return [...positiveOfficialPlays].sort((a, b) => {
      const aWinPct = getRowSideWinPct(a);
      const bWinPct = getRowSideWinPct(b);
      const aScore =
        getOfficialPlayEdge(a) * 4 +
        aWinPct * 0.15 +
        scoreMarketAppeal(getOfficialPlayMarketOdds(a)) +
        scoreUrgency(a);
      const bScore =
        getOfficialPlayEdge(b) * 4 +
        bWinPct * 0.15 +
        scoreMarketAppeal(getOfficialPlayMarketOdds(b)) +
        scoreUrgency(b);

      if (bScore !== aScore) return bScore - aScore;
      return b.stake - a.stake;
    })[0];
  }

  const positivePredictedWinnerRows = candidateRows.filter(
    (row) =>
      getPredictedWinnerEdge(row) > 0 &&
      scoreMarketAppeal(getPredictedWinnerMarketOdds(row)) > -100,
  );

  const rowsToRank = positivePredictedWinnerRows.length
    ? positivePredictedWinnerRows
    : candidateRows;

  return [...rowsToRank].sort((a, b) => {
    const aWinPct = getPredictedWinnerWinPct(a);
    const bWinPct = getPredictedWinnerWinPct(b);
    const aEdge = getPredictedWinnerEdge(a);
    const bEdge = getPredictedWinnerEdge(b);
    const aScore =
      aEdge * 4 +
      aWinPct * 0.15 +
      scoreMarketAppeal(getPredictedWinnerMarketOdds(a)) +
      scoreUrgency(a);
    const bScore =
      bEdge * 4 +
      bWinPct * 0.15 +
      scoreMarketAppeal(getPredictedWinnerMarketOdds(b)) +
      scoreUrgency(b);

    if (bScore !== aScore) return bScore - aScore;
    return getFixtureSortValue(a) - getFixtureSortValue(b);
  })[0];
}

function parseFixtures(rows: RawRow[]): FixtureRow[] {
  return rows
    .map((row) => ({
      roundNumber: toNumber(
        getValue(row, ["Round Number", "RoundNumber"]),
      ),
      roundLabel:
        getValue(row, ["Round", "Round Label"]) ||
        `Round ${toNumber(getValue(row, ["Round Number", "RoundNumber"]))}`,
      day: getValue(row, ["Day"]),
      dateISO: getValue(row, ["Date ISO", "DateISO"]),
      dateLabel: getValue(row, ["Date"]),
      tz: getValue(row, ["TZ"]),
      homeTeam: normalizeTeamName(
        getValue(row, ["Home Team", "Home"]),
      ),
      awayTeam: normalizeTeamName(
        getValue(row, ["Away Team", "Away"]),
      ),
      stadium: getValue(row, ["Stadium", "Venue"]),
      network: getValue(row, ["Network", "Broadcaster"]),
      aedt: getValue(row, ["AEDT"]),
      local: getValue(row, ["Local"]),
    }))
    .filter((row) => row.homeTeam && row.awayTeam);
}

function parsePredictions(
  rows: RawRow[],
  fixtures: FixtureRow[],
): PredictionRow[] {
  const fixtureMap = new Map<string, FixtureRow[]>();
  const fixturePairMap = new Map<string, FixtureRow[]>();

  fixtures.forEach((fixture) => {
    const matchKey = buildMatchKey(fixture.homeTeam, fixture.awayTeam);
    const pairKey = buildTeamPairKey(fixture.homeTeam, fixture.awayTeam);

    if (!fixtureMap.has(matchKey)) fixtureMap.set(matchKey, []);
    fixtureMap.get(matchKey)!.push(fixture);

    if (!fixturePairMap.has(pairKey)) fixturePairMap.set(pairKey, []);
    fixturePairMap.get(pairKey)!.push(fixture);
  });

  return rows
    .map((row) => {
      const homeTeam = normalizeTeamName(
        getValue(row, ["Home Team", "Home"]),
      );
      const awayTeam = normalizeTeamName(
        getValue(row, ["Away Team", "Away"]),
      );
      const sheetPredictedWinner = normalizeTeamName(
        getValue(row, [
          "Predicted Winner",
          "Winner",
          "Projected Winner",
        ]),
      );
      const predictionRound = toRoundNumber(
        getValue(row, ["Round", "Round Number", "RoundNumber", "NRL Round"]),
      );

      const predictedHomeScore = toNumber(
        getValue(row, [
          "Predicted Home Score",
          "Home Score",
          "Projected Home Score",
        ]),
      );

      const predictedAwayScore = toNumber(
        getValue(row, [
          "Predicted Away Score",
          "Away Score",
          "Projected Away Score",
        ]),
      );
      const predictedWinner =
        predictedHomeScore > predictedAwayScore
          ? homeTeam
          : predictedAwayScore > predictedHomeScore
            ? awayTeam
            : sheetPredictedWinner;

      const bestBetCell = getValue(row, [
        "Best Value Bet",
        "Best Bet",
        "BestValueBet",
      ]);
      const stake = toNumber(getValue(row, ["Stake"]));
      const modelHomeOdds = toNumber(
        getValue(row, ["Home Implied Odds", "Home Model Odds"]),
      );
      const modelAwayOdds = toNumber(
        getValue(row, ["Away Implied Odds", "Away Model Odds"]),
      );
      const marketHomeOdds = toNumber(
        getValue(row, [
          "Best Home Odds",
          "Tab Home Odds",
          "Actual Home Odds (Market)",
          "Home Market Odds",
        ]),
      );
      const marketAwayOdds = toNumber(
        getValue(row, [
          "Best Away Odds",
          "Tab Away Odds",
          "Actual Away Odds (Market)",
          "Away Market Odds",
        ]),
      );
      const homeOverlay = toPercentNumber(
        getValue(row, ["Home Overlay %", "Home Overlay"]),
      );
      const awayOverlay = toPercentNumber(
        getValue(row, ["Away Overlay %", "Away Overlay"]),
      );
      const side = bestBetCell.includes("(Home)")
        ? "Home"
        : bestBetCell.includes("(Away)")
          ? "Away"
          : "";
      const cleanedBestBet = normalizeTeamName(
        bestBetCell
          .replace(" (Home)", "")
          .replace(" (Away)", "")
          .trim(),
      );
      const bestBet =
        cleanedBestBet === "-" || cleanedBestBet === "—"
          ? ""
          : cleanedBestBet;
      const bestEdge = Math.max(homeOverlay, awayOverlay, 0);
      const exactFixtures = fixtureMap.get(buildMatchKey(homeTeam, awayTeam)) || [];
      const pairFixtures = fixturePairMap.get(buildTeamPairKey(homeTeam, awayTeam)) || [];
      const exactRoundFixtures = predictionRound
        ? exactFixtures.filter((candidate) => candidate.roundNumber === predictionRound)
        : [];
      const pairRoundFixtures = predictionRound
        ? pairFixtures.filter((candidate) => candidate.roundNumber === predictionRound)
        : [];
      const exactRoundFixture = chooseBestFixtureCandidate(exactRoundFixtures);
      const pairRoundFixture = chooseBestFixtureCandidate(pairRoundFixtures);
      const exactFixture = chooseBestFixtureCandidate(exactFixtures);
      const pairFixture = chooseBestFixtureCandidate(pairFixtures);
      const fixture = exactRoundFixture || pairRoundFixture || exactFixture || pairFixture;

      return {
        match:
          homeTeam && awayTeam
            ? `${homeTeam} v ${awayTeam}`
            : "",
        roundNumber: predictionRound || fixture?.roundNumber || 0,
        homeTeam,
        awayTeam,
        predictedWinner,
        predictedHomeScore,
        predictedAwayScore,
        modelHomeOdds,
        modelAwayOdds,
        marketHomeOdds,
        marketAwayOdds,
        homeOverlay,
        awayOverlay,
        bestBet,
        side: side as "Home" | "Away" | "",
        stake,
        confidence: buildConfidence(
          bestEdge,
          bestBet,
          predictedWinner,
          side,
          predictedHomeScore,
          predictedAwayScore,
        ),
        fixture,
        bestEdge,
      };
    })
    .filter((row) => row.match);
}

function parseBetLog(rows: RawRow[]): BetLogRow[] {
  return rows
    .map((row) => {
      const resultCell = getValue(row, [
        "Result (W/L)",
        "Result",
      ]).toUpperCase();
      const result: "W" | "L" | "P" =
        resultCell === "W" || resultCell === "L"
          ? resultCell
          : "P";

      const rawMatch = getValue(row, ["Match"]);
      let finalMatch = rawMatch;
      if (rawMatch && rawMatch.includes(" v ")) {
        const parts = rawMatch.split(" v ");
        if (parts.length === 2) {
          finalMatch = `${normalizeTeamName(parts[0])} v ${normalizeTeamName(parts[1])}`;
        }
      }

      return {
        timestamp: getValue(row, ["Timestamp"]),
        round: toNumber(getValue(row, ["Round"])),
        match: finalMatch,
        selection: normalizeTeamName(
          getValue(row, ["Team Bet", "Selection"]),
        ),
        side: getValue(row, ["Side (Home/Away)", "Side"]),
        marketOdds: toNumber(
          getValue(row, [
            "Market Odds (Tab)",
            "Market Odds snapshot",
            "Market Odds",
          ]),
        ),
        oddsTaken: toNumber(getValue(row, ["Odds Taken"])),
        modelOdds: toNumber(getValue(row, ["Model Odds"])),
        overlay: toPercentNumber(
          getValue(row, ["Overlay %", "Overlay"]),
        ),
        modelWinPct: toPercentNumber(
          getValue(row, ["Model Win %", "Model Win Pct"]),
        ),
        stake: toNumber(getValue(row, ["Stake"])),
        result,
        profit: toNumber(
          getValue(row, ["Profit ($)", "Profit"]),
        ),
        closingOdds: toNumber(getValue(row, ["Closing Odds"])),
        clv: toPercentNumber(getValue(row, ["CLV %", "CLV"])),
      };
    })
    .filter((row) => row.match);
}

function parseTryScorers(rows: RawRow[]): TryScorerRow[] {
  return rows
    .map((row) => ({
      round: toRoundNumber(getValue(row, ["Round", "Round Number", "RoundNumber", "NRL Round"])),
      match: getValue(row, ["Match"]),
      player: getValue(row, ["Player"]),
      team: getValue(row, ["Team"]),
      position: getValue(row, ["Position"]),
      statsInsiderPct: toPercentNumber(getValue(row, ["StatsInsider %", "Stats Insider %", "Model %"])),
      bestOdds: toNumber(getValue(row, ["Best Odds"])),
      bookmaker: getValue(row, ["Bookmaker"]),
      marketImpliedPct: toPercentNumber(getValue(row, ["Market Implied %"])),
      edgePct: toPercentNumber(getValue(row, ["Edge %"])),
      value: getValue(row, ["Value"]),
    }))
    .filter((row) => row.player && row.match);
}

function parsePerformanceTracker(rows: RawRow[]) {
  const found: Record<string, number> = {};

  rows.forEach((row) => {
    const values = Object.values(row).map((v) =>
      String(v).trim(),
    );

    values.forEach((val, idx) => {
      const next = values[idx + 1] ?? "";
      const lower = val.toLowerCase();

      if (
        lower.includes("bankroll") &&
        found.currentBankroll === undefined &&
        next
      ) {
        found.currentBankroll = toNumber(next);
      }
      if (lower === "roi" && found.roi === undefined && next) {
        found.roi = toPercentNumber(next);
      }
      if (
        lower.includes("clv") &&
        found.avgClv === undefined &&
        next
      ) {
        found.avgClv = toPercentNumber(next);
      }
      if (
        lower.includes("profit") &&
        found.totalProfit === undefined &&
        next
      ) {
        found.totalProfit = toNumber(next);
      }
    });
  });

  return found;
}

function buildDashboardData(
  predictionRows: RawRow[],
  betLogRows: RawRow[],
  trackerRows: RawRow[],
  fixtureRows: RawRow[],
  tryScorerRows: RawRow[],
): DashboardData {
  const fixtures = parseFixtures(fixtureRows);
  const predictions = parsePredictions(
    predictionRows,
    fixtures,
  );
  const betLog = parseBetLog(betLogRows);
  const tryScorers = parseTryScorers(tryScorerRows);
  const trackerValues = parsePerformanceTracker(trackerRows);

  const settled = betLog.filter((row) => row.result !== "P");
  const pending = betLog.filter((row) => row.result === "P");

  const wins = betLog.filter(
    (row) => row.result === "W",
  ).length;
  const losses = betLog.filter(
    (row) => row.result === "L",
  ).length;
  const settledBets = settled.length;
  const pendingBets = pending.length;

  const totalProfit = settled.reduce(
    (sum, row) => sum + row.profit,
    0,
  );
  const totalStakedSettled = settled.reduce(
    (sum, row) => sum + row.stake,
    0,
  );
  const totalStakedAll = betLog.reduce(
    (sum, row) => sum + row.stake,
    0,
  );
  const currentBankroll =
    trackerValues.currentBankroll ||
    STARTING_BANKROLL + totalProfit;
  const avgClv = settledBets
    ? settled.reduce((sum, row) => sum + row.clv, 0) /
      settledBets
    : 0;
  const beatClosingCount = settled.filter(
    (row) => row.clv > 0,
  ).length;
  const pot = totalStakedSettled
    ? (totalProfit / totalStakedSettled) * 100
    : 0;

  let runningBankroll = STARTING_BANKROLL;
  const bankrollData = [
    { bet: "Start", bankroll: STARTING_BANKROLL },
  ];

  settled.forEach((row, idx) => {
    runningBankroll += row.profit;
    bankrollData.push({
      bet: String(idx + 1),
      bankroll: Number(runningBankroll.toFixed(2)),
    });
  });

  const bankrollValues = bankrollData.map((d) => d.bankroll);
  const peakBankroll = Math.max(
    ...bankrollValues,
    STARTING_BANKROLL,
  );

  let peak = STARTING_BANKROLL;
  let maxDrawdown = 0;
  bankrollData.forEach((point) => {
    peak = Math.max(peak, point.bankroll);
    maxDrawdown = Math.min(maxDrawdown, point.bankroll - peak);
  });

  const peakDrawdown = Math.abs(maxDrawdown);
  const peakDrawdownPct = peakBankroll
    ? (peakDrawdown / peakBankroll) * 100
    : 0;

  const clvData = settled.map((row, idx) => ({
    id: `${row.selection || row.match.split(" v ")[0] || "Bet"}-${idx}`,
    match: row.selection || row.match.split(" v ")[0] || "Bet",
    clv: row.clv,
  }));

  const teamProfitMap = new Map<string, number>();
  settled.forEach((row) => {
    const key = row.selection || "Unknown";
    teamProfitMap.set(
      key,
      (teamProfitMap.get(key) || 0) + row.profit,
    );
  });

  const teamPerformance = Array.from(
    teamProfitMap.entries(),
  ).map(([team, profit]) => ({
    team,
    profit,
  }));

  const roundsMap = new Map<number, BetLogRow[]>();
  betLog.forEach((row) => {
    const round = row.round || 0;
    if (!roundsMap.has(round)) roundsMap.set(round, []);
    roundsMap.get(round)!.push(row);
  });

  const rounds = Array.from(roundsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, rows]) => {
      const settledRound = rows.filter(
        (row) => row.result !== "P",
      );
      const pnl = settledRound.reduce(
        (sum, row) => sum + row.profit,
        0,
      );
      const staked = rows.reduce(
        (sum, row) => sum + row.stake,
        0,
      );
      const settledStake = settledRound.reduce(
        (sum, row) => sum + row.stake,
        0,
      );
      const clv = settledRound.length
        ? settledRound.reduce((sum, row) => sum + row.clv, 0) /
          settledRound.length
        : 0;

      return {
        round: `Round ${round}`,
        bets: rows.length,
        roi: settledStake ? (pnl / settledStake) * 100 : 0,
        clv,
        pnl,
        status:
          settledRound.length === rows.length
            ? "Settled"
            : "Placed",
        staked,
      } as RoundSummary;
    });

  const currentRound = rounds.length
    ? rounds[rounds.length - 1]
    : null;

  const modelRoundNumbers = [
    ...predictions
      .map((row) => row.roundNumber || row.fixture?.roundNumber || 0)
      .filter((round) => Number.isFinite(round) && round > 0),
    ...tryScorers
      .map((row) => row.round)
      .filter((round) => Number.isFinite(round) && round > 0),
  ];
  const latestModelRound = modelRoundNumbers.length
    ? Math.max(...modelRoundNumbers)
    : 0;
  const currentRoundLabel = latestModelRound
    ? `Round ${latestModelRound}`
    : currentRound?.round || "Round 1";

  const averageEdge = predictions.length
    ? predictions.reduce((sum, row) => sum + row.bestEdge, 0) /
      predictions.length
    : 0;

  const strongest = predictions.reduce<PredictionRow | null>(
    (best, row) =>
      !best || row.bestEdge > best.bestEdge ? row : best,
    null,
  );

  const strongestBet = strongest
    ? `${strongest.bestBet || strongest.match} ${formatPercent(strongest.bestEdge, 2)}`
    : "—";

  return {
    predictions,
    betLog,
    fixtures,
    tryScorers,
    bankrollData,
    clvData,
    rounds,
    teamPerformance,
    outcomeMix: [
      { name: "Wins", value: wins },
      { name: "Losses", value: losses },
      { name: "Pending", value: pendingBets },
    ],
    currentBankroll,
    peakBankroll,
    peakDrawdown,
    peakDrawdownPct,
    totalProfit,
    totalStakedSettled,
    totalStakedAll,
    pot,
    settledBets,
    pendingBets,
    wins,
    losses,
    avgClv,
    beatClosingCount,
    currentRoundLabel,
    currentRoundOpenBets: pendingBets,
    currentRoundStake: currentRound?.staked || 0,
    trackerValues,
    averageEdge,
    strongestBet,
  };
}

function ResultPill({ result }: { result: "W" | "L" | "P" }) {
  if (result === "W") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 bg-[#00E676] text-[#0A0A0F] text-sm font-semibold">
        W
      </span>
    );
  }

  if (result === "L") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 bg-[#F87171] text-[#0A0A0F] text-sm font-semibold">
        L
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center h-8 px-3 bg-[#16161D] text-[#9CA3AF] text-xs font-medium uppercase tracking-widest border border-[#1E1E2E]">
      Placed
    </span>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: "Lean" | "Value" | "Strong";
}) {
  const styles =
    confidence === "Strong"
      ? "bg-[#16161D] text-white border border-[#1E1E2E]"
      : confidence === "Value"
        ? "bg-[#16161D] text-white border border-[#1E1E2E]"
        : "bg-[#16161D] text-[#9CA3AF] border border-[#1E1E2E]";

  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-widest ${styles}`}
    >
      {confidence}
    </span>
  );
}

const ADMIN_EMAILS = ["elliott@woodbry.com", "ewoodbry@gmail.com", "elliott@rightedge.com.au"];
const ORIGIN_PREVIEW_EMAIL = "elliott@woodbry.com";
const CRICKET_PROTOTYPE_EMAILS = ["elliott@woodbry.com"];
type AuthTier = "none" | "free" | "premium";
type RuntimeAuthState = {
  checked: boolean;
  email: string | null;
  tier: AuthTier;
};

let runtimeAuthState: RuntimeAuthState = {
  checked: false,
  email: null,
  tier: "none",
};

function updateRuntimeAuthState(nextState: RuntimeAuthState) {
  runtimeAuthState = nextState;
}

function hasEmailAccess(): boolean {
  return runtimeAuthState.tier === "free" || runtimeAuthState.tier === "premium";
}

function getUserEmail(): string | null {
  return runtimeAuthState.email;
}

function canViewOriginPage(): boolean {
  return hasPaidAccess() || getUserEmail() === ORIGIN_PREVIEW_EMAIL;
}

function canAccessCricketPrototype(email = runtimeAuthState.email): boolean {
  return !!email && CRICKET_PROTOTYPE_EMAILS.includes(email.trim().toLowerCase());
}

function getPreviewBookmakerName(bookmaker?: string) {
  return bookmaker || "—";
}

function BetrLogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/betr-square.png"
      alt="Betr"
      className={`${className} rounded-lg border border-[#093AD3] bg-[#093AD3] object-contain shrink-0`}
    />
  );
}

function isBetrBookmaker(name?: string) {
  return normalizeBookmakerName(name || "") === "betr";
}

function getAffiliateButtonClass(bookmaker: string | undefined, sizeClasses: string) {
  const colorClasses = isBetrBookmaker(bookmaker)
    ? "re-betr-button border-[#093AD3] bg-[#093AD3] text-white"
    : "re-primary-cta border-white bg-white text-[#0A0A0F]";

  return `inline-flex max-w-full items-center justify-center gap-2 border ${sizeClasses} font-medium uppercase tracking-widest ${colorClasses} transition hover:opacity-90`;
}

function AffiliateMarketButton({
  payload,
  bookmaker,
  odds,
  label = "View NRL market",
  className = "",
}: {
  payload: string;
  bookmaker?: string;
  odds?: number;
  label?: string;
  className?: string;
}) {
  const hasBetrBranding = isBetrBookmaker(bookmaker);

  return (
    <BetrAffiliateLink
      payload={payload}
      className={`${getAffiliateButtonClass(bookmaker, "w-full min-h-[44px] px-4 py-3 text-[11px] md:text-xs")} ${className}`}
    >
      {hasBetrBranding && <BetrLogoMark className="h-6 w-6" />}
      <span className="min-w-0 truncate">
        {hasBetrBranding ? "Play at Betr" : label}
      </span>
      {typeof odds === "number" && (
        <span className={hasBetrBranding ? "text-white" : "text-black"}>
          ${odds.toFixed(2)}
        </span>
      )}
    </BetrAffiliateLink>
  );
}

const BETR_AFFILIATE_BASE_URL =
  "https://record.betraffiliates.com.au/_Bk4P0TFHeOiYNevImT-MDGNd7ZgqdRLk/1/";

function slugifyPayloadPart(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getBetrAffiliateUrl(payload: string) {
  const url = new URL(BETR_AFFILIATE_BASE_URL);
  url.searchParams.set("payload", payload);
  return url.toString();
}

function BetrAffiliateLink({
  payload,
  className,
  style,
  children,
}: {
  payload: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={getBetrAffiliateUrl(payload)}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

function BookmakerName({
  name,
  className = "text-sm font-bold text-white",
}: {
  name: string;
  className?: string;
}) {
  if (!isBetrBookmaker(name)) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className={`${className} inline-flex items-center gap-2 min-w-0`}>
      <BetrLogoMark className="h-7 w-7" />
      <span className="truncate">Betr</span>
    </span>
  );
}

function isUserAdmin(): boolean {
  try {
    return localStorage.getItem("rightedge_admin_auth") === "true";
  } catch {
    return false;
  }
}

function setEmailAccess(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  updateRuntimeAuthState({
    checked: true,
    email: normalizedEmail,
    tier: runtimeAuthState.tier === "premium" ? "premium" : "free",
  });
}

function hasPaidAccess(): boolean {
  return runtimeAuthState.tier === "premium";
}

function getPaidUserEmail(): string | null {
  return runtimeAuthState.tier === "premium" ? runtimeAuthState.email : null;
}

function setPaidAccess(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  updateRuntimeAuthState({
    checked: true,
    email: normalizedEmail,
    tier: "premium",
  });
}

// ── Free Email Gate Helpers ──────────────────────────────────────────────────
const FAVORITE_TEAM_KEY = 'rightedge_favorite_team';
const NRL_TEAMS = [
  'Brisbane Broncos',
  'Canberra Raiders',
  'Canterbury Bulldogs',
  'Cronulla Sharks',
  'Dolphins',
  'Gold Coast Titans',
  'Manly Sea Eagles',
  'Melbourne Storm',
  'Newcastle Knights',
  'North Queensland Cowboys',
  'Parramatta Eels',
  'Penrith Panthers',
  'South Sydney Rabbitohs',
  'St George Illawarra Dragons',
  'Sydney Roosters',
  'Warriors',
  'Wests Tigers',
] as const;

function getStoredFavoriteTeam(): string {
  try {
    return localStorage.getItem(FAVORITE_TEAM_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredFavoriteTeam(team: string) {
  try {
    localStorage.setItem(FAVORITE_TEAM_KEY, team);
  } catch {}
}

const DEFAULT_PREMIUM_CHECKOUT_PLAN = "weekly";
const PREMIUM_CHECKOUT_RETURN_GUARD_KEY = "rightedge_premium_checkout_return_guard";

function PaymentGateModal({
  open,
  onClose,
  onSuccess,
  onSessionRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSessionRefresh: () => Promise<RuntimeAuthState>;
}) {
  const [step, setStep] = useState<"email" | "processing">("email");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const storedEmail = getUserEmail();
  const checkoutEmail = (storedEmail || email).trim().toLowerCase();
  const trimmedEmail = email.trim().toLowerCase();
  const hasStoredEmail = Boolean(storedEmail);

  useEffect(() => {
    if (!open) return;
    const currentPremiumHash = window.location.hash.replace("#", "");
    const section = ["matches", "origin", "best-bets", "try-scorers"].includes(currentPremiumHash)
      ? currentPremiumHash
      : "best-bets";
    const trackedSection = section === "origin" && !canViewOriginPage() ? "matches" : section;
    (window as any).trackAnalyticsEvent?.("premium_paywall_view", {
      section: trackedSection,
      cta_source: trackedSection,
    });
  }, [open]);

  if (!open) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutEmail || !checkoutEmail.includes("@") || !checkoutEmail.includes(".")) {
      setErrorMsg("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const verifyRes = await fetch(`/api/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        credentials: "include",
        body: JSON.stringify({ email: checkoutEmail }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      const isActiveSubscriber = Boolean(
        verifyData.instantAccess ||
        verifyData.activeSubscriber ||
        verifyData.active_subscriber ||
        verifyData.subscribed ||
        verifyData.active
      );

      if (verifyRes.ok && isActiveSubscriber) {
        const verifiedEmail = (verifyData.email || checkoutEmail).trim().toLowerCase();
        const nextAuthState = await onSessionRefresh();
        if (nextAuthState.tier !== "premium") {
          setErrorMsg("We verified your email, but could not restore the secure session. Please try again.");
          setSubmitting(false);
          return;
        }
        (window as any).trackAnalyticsEvent?.("paid_access_verified", { email: verifiedEmail });
        onSuccess();
        return;
      }

      setStep("processing");
      const currentPremiumHash = window.location.hash.replace("#", "");
      let returnHash = ["matches", "origin", "best-bets", "try-scorers"].includes(currentPremiumHash)
        ? currentPremiumHash
        : "best-bets";
      if (returnHash === "origin" && !canViewOriginPage()) {
        returnHash = "matches";
      }
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}#matches`;

      (window as any).trackAnalyticsEvent?.("premium_email_submit", {
        email: checkoutEmail,
        section: returnHash,
        plan: DEFAULT_PREMIUM_CHECKOUT_PLAN,
        flow: hasStoredEmail ? "known_email_button" : "email_form",
      });

      void fetch(`/api/register-checkout-lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: checkoutEmail,
          source: `premium_${returnHash}`,
          return_hash: returnHash,
          plan: DEFAULT_PREMIUM_CHECKOUT_PLAN,
        }),
      }).catch((leadErr) => {
        console.warn("[RightEdge] Failed to save checkout lead:", leadErr);
      });

      (window as any).trackAnalyticsEvent?.("premium_checkout_start", {
        email: checkoutEmail,
        section: returnHash,
        plan: DEFAULT_PREMIUM_CHECKOUT_PLAN,
        flow: hasStoredEmail ? "known_email_button" : "email_form",
      });

      const checkoutRes = await fetch(`/api/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: checkoutEmail,
          returnUrl,
          returnHash,
          plan: DEFAULT_PREMIUM_CHECKOUT_PLAN,
          cancelUrl,
          cancel_url: cancelUrl,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (checkoutRes.ok && checkoutData.url) {
        (window as any).trackAnalyticsEvent?.("premium_checkout_redirect", {
          email: checkoutEmail,
          section: returnHash,
          plan: DEFAULT_PREMIUM_CHECKOUT_PLAN,
          flow: hasStoredEmail ? "known_email_button" : "email_form",
        });
        try {
          sessionStorage.setItem(PREMIUM_CHECKOUT_RETURN_GUARD_KEY, returnHash);
        } catch {}
        window.location.href = checkoutData.url;
        return;
      }

      setStep("email");
      setErrorMsg(checkoutData.error || "Could not start checkout. Please try again.");
      setSubmitting(false);
    } catch (err) {
      setStep("email");
      setErrorMsg("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#111116] border border-[#1E1E2E] p-8 sm:p-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#16161D] border border-[#1E1E2E] p-2.5">
            <Lock className="w-6 h-6 text-white stroke-[3px]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white uppercase tracking-tight">
              Premium Access
            </h3>
            <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-widest">
              Subscriber login or $14/week
            </p>
          </div>
        </div>

        <p className="text-sm text-[#9CA3AF] font-normal leading-relaxed mb-6">
          {hasStoredEmail
            ? "Unlock the premium read for this round. We’ll use your saved email and send you straight to secure Stripe checkout."
            : "Already Premium? Enter your subscriber email and we’ll unlock access instantly. New here? Use the same email to continue to secure Stripe checkout."}
        </p>

        {step === "processing" ? (
          <div className="flex flex-col items-center text-center py-6">
            <RefreshCw className="w-10 h-10 mb-5 animate-spin text-white" />
            <div className="text-white font-semibold uppercase tracking-tight mb-2">
              Redirecting to Stripe
            </div>
            <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wider">
              Secure checkout is opening now.
            </p>
          </div>
        ) : hasStoredEmail ? (
          <form
            onSubmit={handleEmailSubmit}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#0A0A0F] border border-[#1E1E2E] px-4 py-3">
              <div className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-widest mb-1">
                Checkout email
              </div>
              <div className="text-white text-sm font-semibold truncate">
                {storedEmail}
              </div>
            </div>

            {errorMsg && (
              <p className="text-[#F87171] text-xs font-medium uppercase tracking-wider">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full re-primary-cta border py-4 text-base font-medium uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Unlock Premium — $14/week
                  <ArrowRight className="w-5 h-5 stroke-[3px]" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleEmailSubmit}
            className="flex flex-col gap-4"
          >
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg("");
                }}
                placeholder="your@email.com"
                autoFocus
                disabled={submitting}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] text-white font-normal text-base pl-12 pr-4 py-4 placeholder:text-[#6B7280] focus:outline-none focus:border-white/40 transition-colors disabled:opacity-50"
              />
            </div>

            {errorMsg && (
              <p className="text-[#F87171] text-xs font-medium uppercase tracking-wider">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full re-primary-cta border py-4 text-base font-medium uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : step === "email" ? (
                <>
                  Unlock Premium Plays — $14/week
                  <ArrowRight className="w-5 h-5 stroke-[3px]" />
                </>
              ) : null}
            </button>
          </form>
        )}

        <p className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wider mt-4 text-center">
          Existing subscribers will not be charged again. Secure payment handled by Stripe.
        </p>
      </div>
    </div>
  );
}

function RetentionOfferModal({
  open,
  onClose,
  onContinueToBilling,
}: {
  open: boolean;
  onClose: () => void;
  onContinueToBilling: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setOpeningPortal(false);
    setAccepted(false);
    setErrorMsg("");
    (window as any).trackAnalyticsEvent?.("retention_offer_view", {
      offer: "50_percent_off_2_rounds",
    });
  }, [open]);

  if (!open) return null;

  const handleClaimOffer = async () => {
    const email = getUserEmail();
    if (!email) {
      setErrorMsg("Could not find your email. Please log in again.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/apply-retention-offer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Could not apply the offer. Please try again.");
        setSubmitting(false);
        return;
      }

      (window as any).trackAnalyticsEvent?.("retention_offer_accepted", {
        offer: "50_percent_off_2_rounds",
        invoices_remaining: data.invoicesRemaining,
      });
      setAccepted(true);
      setSubmitting(false);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const handleContinueToBilling = async () => {
    setOpeningPortal(true);
    setErrorMsg("");
    (window as any).trackAnalyticsEvent?.("retention_offer_declined", {
      offer: "50_percent_off_2_rounds",
    });
    try {
      await onContinueToBilling();
    } catch {
      setErrorMsg("Could not open billing. Please try again.");
      setOpeningPortal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-[520px] border border-[#D4D4CF] bg-[#F4F4F1] text-[#090909] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D4D4CF] px-5 py-4 md:px-7">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#6F6F6A]">
              Before you cancel
            </div>
            <h2 className="mt-2 text-3xl font-black uppercase leading-none tracking-tight">
              Stay for half price.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#D4D4CF] p-2 text-[#6F6F6A] transition hover:border-[#090909] hover:text-[#090909]"
            aria-label="Close retention offer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 md:px-7">
          {accepted ? (
            <div className="border border-[#6CD98B] bg-[#E7F6EA] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#2F7D44]">
                Applied
              </div>
              <p className="mt-2 text-xl font-black uppercase leading-tight">
                You have 50% off Premium for the next 2 rounds.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#555550]">
                Your premium access stays active and the discount will remove itself after two successful renewals.
              </p>
            </div>
          ) : (
            <>
              <p className="text-base font-semibold leading-relaxed text-[#555550]">
                Keep Premium for the next two rounds at 50% off. No new checkout,
                no re-entering card details. We will apply it to your existing subscription.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[#D4D4CF] bg-white/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#6F6F6A]">
                    Offer
                  </div>
                  <div className="mt-2 text-2xl font-black">50% off</div>
                </div>
                <div className="border border-[#D4D4CF] bg-white/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#6F6F6A]">
                    Duration
                  </div>
                  <div className="mt-2 text-2xl font-black">2 rounds</div>
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="border border-[#C74343] bg-[#F8E6E6] px-4 py-3 text-sm font-bold text-[#8D2323]">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            {accepted ? (
              <button
                type="button"
                onClick={onClose}
                className="bg-[#093AD3] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#E7E7E4] transition hover:opacity-85"
              >
                Back to Premium
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClaimOffer}
                disabled={submitting || openingPortal}
                className="bg-[#093AD3] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#E7E7E4] transition hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Applying..." : "Keep Premium"}
              </button>
            )}
            <button
              type="button"
              onClick={handleContinueToBilling}
              disabled={submitting || openingPortal}
              className="border border-[#D4D4CF] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#555550] transition hover:border-[#090909] hover:text-[#090909] disabled:cursor-wait disabled:opacity-60"
            >
              {openingPortal ? "Opening..." : "Continue to billing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailGateModal({
  open,
  onClose,
  onSuccess,
  onSessionRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSessionRefresh: () => Promise<RuntimeAuthState>;
}) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
    setErrorMsg("Enter a valid email address.");
    return;
  }

  // Admin bypass
  const BYPASS_EMAILS = [...ADMIN_EMAILS, "test@rightedge.com.au"];
  if (localStorage.getItem('rightedge_admin_auth') === 'true' && BYPASS_EMAILS.includes(trimmed)) {
    setEmailAccess(trimmed);
    window.dispatchEvent(new Event('adminAuthChanged'));
    onSuccess();
    return;
  }

  setSubmitting(true);
  setErrorMsg("");
  try {
    const saveRes = await fetch(`/api/register-free-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      credentials: "include",
      body: JSON.stringify({
        email: trimmed,
        source: "mailing_list",
      }),
    });
    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      setErrorMsg((errData as any).error || "Failed to save your details. Please try again.");
      setSubmitting(false);
      return;
    }
    const nextAuthState = await onSessionRefresh();
    if (nextAuthState.tier === "none") {
      setErrorMsg("We saved your email, but could not start your secure session. Please try again.");
      setSubmitting(false);
      return;
    }
    (window as any).trackAnalyticsEvent?.("mailing_list_signup", {
      email: trimmed,
    });
    onSuccess();
  } catch (err) {
    setErrorMsg("Network error. Please try again.");
    setSubmitting(false);
  }
};
          
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#111116] border border-[#1E1E2E] p-8 sm:p-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#16161D] border border-[#1E1E2E] p-2.5">
            <Lock className="w-6 h-6 text-white stroke-[3px]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white uppercase tracking-tight">
              ACCESS LIVE ROUND DATA
            </h3>
            <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-widest">
              100% FREE — NO CREDIT CARD REQUIRED
            </p>
          </div>
        </div>

        <p className="text-sm text-[#9CA3AF] font-normal leading-relaxed mb-6">
          Enter your email to instantly unlock all model simulations, projected scores, and value overlays for the current round.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {step === "email" ? (
            <>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="your@email.com"
                  autoFocus
                  disabled={submitting}
                  className="w-full bg-[#0A0A0F] border border-[#1E1E2E] text-white font-normal text-base pl-12 pr-4 py-4 placeholder:text-[#6B7280] focus:outline-none focus:border-white/40 transition-colors disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <>
              {successMsg && (
                <div className="bg-[#16161D] text-[#00E676] border border-[#1E1E2E] p-3 text-xs font-medium uppercase tracking-wider">
                  {successMsg}
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  disabled={submitting}
                  className="w-full bg-[#0A0A0F] border border-[#1E1E2E] text-white font-semibold text-2xl text-center tracking-[0.5em] py-4 placeholder:text-[#6B7280] placeholder:tracking-normal focus:outline-none focus:border-white/40 transition-colors disabled:opacity-50"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-[#F87171] text-xs font-medium uppercase tracking-wider">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full re-primary-cta border py-4 text-base font-medium uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : step === "email" ? (
              <>
                ACCESS THE MODEL NOW
                <ArrowRight className="w-5 h-5 stroke-[3px]" />
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          {step === "otp" && (
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setSuccessMsg(""); setErrorMsg(""); }}
              className="text-[#6B7280] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors mt-2"
            >
              Use a different email
            </button>
          )}
        </form>

      </div>
    </div>
  );
}

function PublicNav({
  page,
  setPage,
  onPremiumLogin,
  showCricketLink = false,
}: {
  page: string;
  setPage: (value: string) => void;
  onPremiumLogin: () => void;
  showCricketLink?: boolean;
}) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-[#1E1E2E] bg-[#0A0A0F]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 sm:h-16">
        <button
          type="button"
          onClick={() => setPage("home")}
          className="text-[17px] font-semibold tracking-tight text-white transition hover:opacity-80 sm:text-[18px]"
        >
          RightEdge
        </button>

        <div className="flex items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => setPage("app")}
            className="inline-flex h-9 items-center justify-center bg-white px-4 text-xs font-medium text-[#0A0A0F] transition hover:opacity-85 sm:px-5"
          >
            Predictions
          </button>
          {showCricketLink && (
            <button
              type="button"
              onClick={() => setPage("cricket")}
              className={`hidden h-9 items-center justify-center border px-3 text-xs font-medium transition sm:inline-flex ${
                page === "cricket"
                  ? "border-white bg-white text-[#0A0A0F]"
                  : "border-[#1E1E2E] text-[#9CA3AF] hover:border-white/30 hover:text-white"
              }`}
            >
              Cricket
            </button>
          )}
          <button
            type="button"
            onClick={onPremiumLogin}
            className="inline-flex h-9 items-center justify-center gap-2 border border-[#1E1E2E] px-3 text-xs font-medium text-[#9CA3AF] transition hover:border-white/30 hover:text-white sm:px-3.5"
          >
            <Lock className="h-3.5 w-3.5" />
            Premium Login
          </button>
        </div>
      </div>
    </div>
  );
}

type CricketTeamRating = {
  elo: number;
  runs_for: number;
  runs_against: number;
  n_matches: number;
  last_seen: string;
};

type CricketFixturePrototype = {
  id: string;
  competition: string;
  format: "BBL" | "Test" | "T20I";
  stage: string;
  home: string;
  away: string;
  suppressValuePick?: boolean;
  marketOdds: {
    home: number;
    away: number;
    draw?: number;
  };
};

type CricketComputedFixture = CricketFixturePrototype & {
  probHome: number;
  probAway: number;
  probDraw: number;
  fairHome: number;
  fairAway: number;
  fairDraw: number | null;
  edgeHome: number;
  edgeAway: number;
  edgeDraw: number | null;
  projectedHome: number | null;
  projectedAway: number | null;
  valuePick: "home" | "away" | "draw" | null;
  bestEdge: number;
  confidence: "LEAN" | "SOLID" | "STRONG" | null;
  kellyFraction: number;
};

type CricketLiveOddsOutcome = {
  name: string;
  price: number;
};

type CricketLiveOddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    last_update: string;
    markets?: Array<{
      key: string;
      outcomes?: CricketLiveOddsOutcome[];
    }>;
  }>;
};

const CRICKET_MODEL_PARAMS = {
  bbl_league_avg_runs: 164,
  bbl_runs_std: 26.5,
  bbl_strength_std: 14,
  bbl_form_weight: 0.55,
  test_draw_base: 0.22,
  elo_base: 1500,
};

const CRICKET_RATINGS_GENERATED_AT = "2026-06-15T00:00:00.000000+00:00";

const CRICKET_RATINGS: Record<string, Record<string, CricketTeamRating>> = {
  cricket_international_t20: {
    "West Indies": { elo: 1593.17, runs_for: 163.4, runs_against: 144.2, n_matches: 12, last_seen: "2026-03-01" },
    "Sri Lanka": { elo: 1542.69, runs_for: 149.3, runs_against: 146.6, n_matches: 12, last_seen: "2026-02-28" },
  },
  "Big Bash League": {
    "Sydney Sixers": { elo: 1586.43, runs_for: 143.8, runs_against: 135.6, n_matches: 12, last_seen: "2026-01-25" },
    "Brisbane Heat": { elo: 1509.08, runs_for: 180.2, runs_against: 188.8, n_matches: 12, last_seen: "2026-01-18" },
    "Melbourne Stars": { elo: 1465.03, runs_for: 151.0, runs_against: 148.9, n_matches: 12, last_seen: "2026-01-21" },
    "Sydney Thunder": { elo: 1437.33, runs_for: 161.8, runs_against: 170.6, n_matches: 12, last_seen: "2026-01-16" },
    "Adelaide Strikers": { elo: 1448.48, runs_for: 159.6, runs_against: 164.1, n_matches: 12, last_seen: "2026-01-17" },
    "Melbourne Renegades": { elo: 1390.06, runs_for: 164.2, runs_against: 168.6, n_matches: 12, last_seen: "2026-01-17" },
    "Perth Scorchers": { elo: 1609.74, runs_for: 177.5, runs_against: 154.4, n_matches: 12, last_seen: "2026-01-25" },
    "Hobart Hurricanes": { elo: 1553.85, runs_for: 167.2, runs_against: 162.9, n_matches: 12, last_seen: "2026-01-23" },
  },
  "The Ashes": {
    Australia: { elo: 1550.06, runs_for: 319.1, runs_against: 283.2, n_matches: 12, last_seen: "2026-01-04" },
    England: { elo: 1449.94, runs_for: 283.2, runs_against: 319.1, n_matches: 12, last_seen: "2026-01-04" },
  },
  "Border-Gavaskar Trophy": {
    Australia: { elo: 1470.13, runs_for: 425.9, runs_against: 405.2, n_matches: 12, last_seen: "2017-03-25" },
    India: { elo: 1529.87, runs_for: 405.2, runs_against: 425.9, n_matches: 12, last_seen: "2017-03-25" },
  },
};

const CRICKET_PROTOTYPE_FIXTURES: CricketFixturePrototype[] = [
  {
    id: "bbl-prototype-sixers-scorchers",
    competition: "Big Bash League",
    format: "BBL",
    stage: "October launch sample",
    home: "Sydney Sixers",
    away: "Perth Scorchers",
    marketOdds: { home: 2.22, away: 1.72 },
  },
  {
    id: "bbl-prototype-heat-renegades",
    competition: "Big Bash League",
    format: "BBL",
    stage: "October launch sample",
    home: "Brisbane Heat",
    away: "Melbourne Renegades",
    marketOdds: { home: 1.78, away: 2.08 },
  },
  {
    id: "test-prototype-ashes",
    competition: "The Ashes",
    format: "Test",
    stage: "Summer Test sample",
    home: "Australia",
    away: "England",
    marketOdds: { home: 1.91, away: 3.55, draw: 3.2 },
  },
  {
    id: "test-prototype-india",
    competition: "Border-Gavaskar Trophy",
    format: "Test",
    stage: "Summer Test model check",
    home: "Australia",
    away: "India",
    marketOdds: { home: 2.38, away: 2.48, draw: 3.65 },
  },
];

function normalCdf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * z);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * erf);
}

function clampNumber(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function fairOdds(probability: number) {
  return probability > 0 ? 1 / probability : 0;
}

function devigProbabilities(odds: number[]) {
  const implied = odds.map((odd) => (odd > 0 ? 1 / odd : 0));
  const total = implied.reduce((sum, item) => sum + item, 0);
  return implied.map((item) => (total > 0 ? item / total : 0));
}

function cricketConfidence(edge: number): "LEAN" | "SOLID" | "STRONG" | null {
  if (edge >= 0.1) return "STRONG";
  if (edge >= 0.05) return "SOLID";
  if (edge >= 0.03) return "LEAN";
  return null;
}

function cricketKelly(probability: number, odds: number, cap = 0.25) {
  const b = odds - 1;
  if (b <= 0) return 0;
  const fraction = (b * probability - (1 - probability)) / b;
  return Math.max(0, fraction) * cap;
}

function computeCricketFixture(fixture: CricketFixturePrototype): CricketComputedFixture {
  const ratings = CRICKET_RATINGS[fixture.competition];
  const home = ratings?.[fixture.home];
  const away = ratings?.[fixture.away];

  if (!home || !away) {
    throw new Error(`Missing cricket ratings for ${fixture.home} vs ${fixture.away}`);
  }

  let probHome = 0;
  let probAway = 0;
  let probDraw = 0;
  let projectedHome: number | null = null;
  let projectedAway: number | null = null;

  if (fixture.format !== "Test") {
    const leagueAverage = CRICKET_MODEL_PARAMS.bbl_league_avg_runs;
    const homeRaw = 0.5 * home.runs_for + 0.5 * away.runs_against;
    const awayRaw = 0.5 * away.runs_for + 0.5 * home.runs_against;
    const eloGap = clampNumber(home.elo - away.elo, -200, 200);
    const homeMean = leagueAverage + CRICKET_MODEL_PARAMS.bbl_form_weight * (homeRaw - leagueAverage) + (eloGap / 200) * 10;
    const awayMean = leagueAverage + CRICKET_MODEL_PARAMS.bbl_form_weight * (awayRaw - leagueAverage) - (eloGap / 200) * 10;
    const diffStd = Math.sqrt(2 * (CRICKET_MODEL_PARAMS.bbl_runs_std ** 2 + CRICKET_MODEL_PARAMS.bbl_strength_std ** 2));
    probHome = normalCdf((homeMean - awayMean) / diffStd);
    probAway = 1 - probHome;
    projectedHome = homeMean;
    projectedAway = awayMean;
  } else {
    const expected = 1 / (1 + 10 ** ((away.elo - home.elo) / 400));
    const closeness = 1 - Math.abs(expected - 0.5) * 2;
    probDraw = clampNumber(CRICKET_MODEL_PARAMS.test_draw_base + 0.18 * closeness, 0.05, 0.45);
    const decisive = 1 - probDraw;
    probHome = decisive * expected;
    probAway = decisive * (1 - expected);
  }

  const market = fixture.marketOdds;
  const implied = market.draw
    ? devigProbabilities([market.home, market.away, market.draw])
    : devigProbabilities([market.home, market.away]);
  const edgeHome = probHome - implied[0];
  const edgeAway = probAway - implied[1];
  const edgeDraw = market.draw ? probDraw - implied[2] : null;
  const candidates: Array<{ side: "home" | "away" | "draw"; edge: number; probability: number; odds: number }> = [
    { side: "home", edge: edgeHome, probability: probHome, odds: market.home },
    { side: "away", edge: edgeAway, probability: probAway, odds: market.away },
  ];

  if (market.draw && edgeDraw !== null) {
    candidates.push({ side: "draw", edge: edgeDraw, probability: probDraw, odds: market.draw });
  }

  const best = candidates.sort((a, b) => b.edge - a.edge)[0];
  const confidence = best ? cricketConfidence(best.edge) : null;

  return {
    ...fixture,
    probHome,
    probAway,
    probDraw,
    fairHome: fairOdds(probHome),
    fairAway: fairOdds(probAway),
    fairDraw: fixture.format === "Test" ? fairOdds(probDraw) : null,
    edgeHome,
    edgeAway,
    edgeDraw,
    projectedHome,
    projectedAway,
    valuePick: fixture.suppressValuePick ? null : (confidence && best ? best.side : null),
    bestEdge: best?.edge || 0,
    confidence: fixture.suppressValuePick ? null : confidence,
    kellyFraction: fixture.suppressValuePick ? 0 : (confidence && best ? cricketKelly(best.probability, best.odds) : 0),
  };
}

function formatCricketPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatCricketOdds(value: number | null) {
  if (!value || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function formatCricketSignedPts(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pts`;
}

function getCricketPickLabel(fixture: CricketComputedFixture) {
  if (fixture.valuePick === "home") return fixture.home;
  if (fixture.valuePick === "away") return fixture.away;
  if (fixture.valuePick === "draw") return "Draw";
  return "No premium play";
}

function getCricketBetrH2h(event?: CricketLiveOddsEvent | null) {
  const betrBook = event?.bookmakers?.find((bookmaker) => isBetrBookmaker(bookmaker.key || bookmaker.title));
  return betrBook?.markets?.find((market) => market.key === "h2h")?.outcomes || [];
}

function findCricketOutcomePrice(outcomes: CricketLiveOddsOutcome[], team: string) {
  const target = team.trim().toLowerCase();
  const outcome = outcomes.find((item) => item.name.trim().toLowerCase() === target);
  const price = Number(outcome?.price);
  return Number.isFinite(price) ? price : null;
}

async function fetchCricketLiveOddsCached(home = "West Indies", away = "Sri Lanka") {
  const cacheKey = `rightedge_cricket_live_odds_v1_${home}_${away}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (fetchOddsPromises.has(cacheKey)) {
    return fetchOddsPromises.get(cacheKey)! as Promise<CricketLiveOddsEvent[]>;
  }

  const params = new URLSearchParams({
    bookmaker: "betr",
    home,
    away,
    _: String(Date.now()),
  });

  const fetchPromise = fetch(`/api/cricket-live-odds?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Cricket API Error");
      const data = await res.json();
      if (data.error || !Array.isArray(data)) throw new Error("Invalid Cricket Data");
      fetchOddsPromises.delete(cacheKey);
      return data as CricketLiveOddsEvent[];
    })
    .catch((err) => {
      fetchOddsPromises.delete(cacheKey);
      throw err;
    });

  fetchOddsPromises.set(cacheKey, fetchPromise);
  return fetchPromise as Promise<CricketLiveOddsEvent[]>;
}

function CricketAccessPanel({
  email,
  onRequestAccess,
}: {
  email: string | null;
  onRequestAccess: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[58vh] w-full max-w-[760px] items-center">
      <GlassCard className="w-full p-8 sm:p-10">
        <div className="mb-6 inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#16161D] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
          <Lock className="h-4 w-4" />
          Elliott-only preview
        </div>
        <h1 className="mb-4 text-3xl font-semibold uppercase tracking-tight text-white sm:text-5xl">
          RightEdge Cricket is private.
        </h1>
        <p className="max-w-[620px] text-sm leading-7 text-[#9CA3AF] sm:text-base">
          The cricket prototype is currently limited to elliott@woodbry.com while the BBL and summer Test product is shaped separately from the live NRL experience.
        </p>
        {email && (
          <div className="mt-6 border border-[#1E1E2E] bg-[#0A0A0F] p-4 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
            Signed in as {email}. This email is not enabled for the cricket preview.
          </div>
        )}
        <button
          type="button"
          onClick={onRequestAccess}
          className="mt-8 inline-flex items-center justify-center gap-3 border border-white bg-white px-6 py-3 text-sm font-medium uppercase tracking-wider text-[#0A0A0F] transition hover:opacity-85"
        >
          Sign in with Elliott email
          <ArrowRight className="h-4 w-4 stroke-[3px]" />
        </button>
      </GlassCard>
    </div>
  );
}

function CricketFixtureCard({ fixture }: { fixture: CricketComputedFixture }) {
  const pickLabel = getCricketPickLabel(fixture);
  const pickOdds =
    fixture.valuePick === "home"
      ? fixture.marketOdds.home
      : fixture.valuePick === "away"
        ? fixture.marketOdds.away
        : fixture.valuePick === "draw"
          ? fixture.marketOdds.draw
          : null;

  return (
    <GlassCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#16161D] px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
          <CalendarDays className="h-3.5 w-3.5" />
          {fixture.stage}
        </div>
        <span className="border border-[#1E1E2E] px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-white">
          {fixture.format}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="text-lg font-semibold uppercase tracking-tight text-white sm:text-xl">
            {fixture.home}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
            Home
          </div>
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-[#6B7280]">vs</div>
        <div className="text-right">
          <div className="text-lg font-semibold uppercase tracking-tight text-white sm:text-xl">
            {fixture.away}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
            Away
          </div>
        </div>
      </div>

      {fixture.format === "BBL" && fixture.projectedHome && fixture.projectedAway && (
        <div className="mb-5 border border-[#1E1E2E] bg-[#0A0A0F] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
            <BarChart3 className="h-4 w-4" />
            Projected score
          </div>
          <div className="text-2xl font-semibold uppercase tracking-tight text-white">
            {fixture.projectedHome.toFixed(0)} - {fixture.projectedAway.toFixed(0)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
            Home win
          </div>
          <div className="text-xl font-semibold text-white">{formatCricketPercent(fixture.probHome)}</div>
          <div className="mt-1 text-xs text-[#9CA3AF]">Fair {formatCricketOdds(fixture.fairHome)}</div>
        </div>
        <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
            Away win
          </div>
          <div className="text-xl font-semibold text-white">{formatCricketPercent(fixture.probAway)}</div>
          <div className="mt-1 text-xs text-[#9CA3AF]">Fair {formatCricketOdds(fixture.fairAway)}</div>
        </div>
      </div>

      {fixture.format === "Test" && (
        <div className="mt-3 border border-[#1E1E2E] bg-[#16161D] p-4">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
            Draw probability
          </div>
          <div className="text-xl font-semibold text-white">{formatCricketPercent(fixture.probDraw)}</div>
          <div className="mt-1 text-xs text-[#9CA3AF]">Fair {formatCricketOdds(fixture.fairDraw)}</div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
        <div className="border border-[#1E1E2E] p-3">
          <div>Home edge</div>
          <div className={fixture.edgeHome > 0 ? "mt-1 text-white" : "mt-1 text-[#6B7280]"}>
            {formatCricketSignedPts(fixture.edgeHome)}
          </div>
        </div>
        <div className="border border-[#1E1E2E] p-3">
          <div>Away edge</div>
          <div className={fixture.edgeAway > 0 ? "mt-1 text-white" : "mt-1 text-[#6B7280]"}>
            {formatCricketSignedPts(fixture.edgeAway)}
          </div>
        </div>
        <div className="border border-[#1E1E2E] p-3">
          <div>Market</div>
          <div className="mt-1 text-white">
            {fixture.marketOdds.home.toFixed(2)} / {fixture.marketOdds.away.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E1E2E] pt-5">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
              Premium play
            </div>
            <div className="mt-1 text-base font-semibold uppercase tracking-tight text-white">
              {pickLabel}
            </div>
            {pickOdds && (
              <div className="mt-1 text-xs text-[#9CA3AF]">
                betr sample {pickOdds.toFixed(2)} | Kelly {(fixture.kellyFraction * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <span className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
            fixture.confidence
              ? "border-white bg-white text-[#0A0A0F]"
              : "border-[#1E1E2E] text-[#6B7280]"
          }`}>
            {fixture.confidence || "Watch"}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function CricketLiveTestCard({
  event,
  loading,
  error,
  onRefresh,
}: {
  event: CricketLiveOddsEvent | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const outcomes = getCricketBetrH2h(event);
  const homeTeam = event?.home_team || "West Indies";
  const awayTeam = event?.away_team || "Sri Lanka";
  const homePrice = findCricketOutcomePrice(outcomes, homeTeam);
  const awayPrice = findCricketOutcomePrice(outcomes, awayTeam);
  const canRunHarness = !!event && !!homePrice && !!awayPrice;
  const fixture = canRunHarness
    ? computeCricketFixture({
        id: `live-betr-${event.id}`,
        competition: "cricket_international_t20",
        format: "T20I",
        stage: "Live Betr model run",
        home: homeTeam,
        away: awayTeam,
        marketOdds: { home: homePrice!, away: awayPrice! },
      })
    : null;
  const marketProbabilities = homePrice && awayPrice ? devigProbabilities([homePrice, awayPrice]) : [];

  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#16161D] px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Betr cricket live feed
          </div>
          <h2 className="text-2xl font-semibold uppercase tracking-tight text-white sm:text-3xl">
            West Indies v Sri Lanka
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#9CA3AF]">
            This card pulls the match from the BlueBet/Betr cricket API and runs the RightEdge cricket_international_t20 model against the live head-to-head price.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center gap-2 border border-white bg-white px-4 text-xs font-medium uppercase tracking-widest text-[#0A0A0F] transition hover:opacity-85"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 border border-[#7F1D1D] bg-[#1F0A0A] p-4 text-sm leading-6 text-[#FCA5A5]">
          {error}
        </div>
      )}

      {loading && !event ? (
        <div className="border border-[#1E1E2E] bg-[#16161D] p-5 text-sm font-medium uppercase tracking-widest text-[#9CA3AF]">
          Pulling live Betr cricket odds...
        </div>
      ) : fixture ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Betr price</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-lg font-semibold uppercase tracking-tight text-white">{homeTeam}</div>
                <div className="text-3xl font-semibold text-white">{homePrice!.toFixed(2)}</div>
              </div>
              <div className="mt-2 text-xs text-[#9CA3AF]">
                Market {formatCricketPercent(marketProbabilities[0] || 0)}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Betr price</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-lg font-semibold uppercase tracking-tight text-white">{awayTeam}</div>
                <div className="text-3xl font-semibold text-white">{awayPrice!.toFixed(2)}</div>
              </div>
              <div className="mt-2 text-xs text-[#9CA3AF]">
                Market {formatCricketPercent(marketProbabilities[1] || 0)}
              </div>
            </div>

            <div className="border border-[#1E1E2E] bg-[#0A0A0F] p-4">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Model fair</div>
              <div className="text-xl font-semibold text-white">
                {formatCricketPercent(fixture.probHome)} / {formatCricketPercent(fixture.probAway)}
              </div>
              <div className="mt-1 text-xs text-[#9CA3AF]">
                Fair {formatCricketOdds(fixture.fairHome)} / {formatCricketOdds(fixture.fairAway)}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#0A0A0F] p-4">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Edge check</div>
              <div className="text-xl font-semibold text-white">
                {formatCricketSignedPts(fixture.edgeHome)} / {formatCricketSignedPts(fixture.edgeAway)}
              </div>
              <div className="mt-1 text-xs text-[#9CA3AF]">
                {fixture.confidence ? `${fixture.confidence} value signal` : "No premium play at this price."}
              </div>
            </div>
          </div>

          <div className="border border-[#1E1E2E] bg-[#16161D] p-5">
            <div className="mb-4 inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#0A0A0F] px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-white">
              <BadgeCheck className="h-3.5 w-3.5" />
              Pipeline check
            </div>
            <div className="space-y-3 text-sm leading-6 text-[#9CA3AF]">
              <p>BlueBet event ID: {event?.id}</p>
              <p>
                Start: {event?.commence_time ? new Date(event.commence_time).toLocaleString("en-AU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }) : "-"}
              </p>
              <p>Model: cricket_international_t20, exported from 5,287 men's T20 international matches with rolling Elo and scoring form.</p>
              <p>
                Play: {getCricketPickLabel(fixture)}{fixture.valuePick ? ` | Kelly ${(fixture.kellyFraction * 100).toFixed(1)}%` : ""}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-[#1E1E2E] bg-[#16161D] p-5 text-sm leading-7 text-[#9CA3AF]">
          No live Betr head-to-head market was returned for West Indies v Sri Lanka.
        </div>
      )}
    </GlassCard>
  );
}

function CricketPrototypePage({
  authState,
  onRequestAccess,
}: {
  authState: RuntimeAuthState;
  onRequestAccess: () => void;
}) {
  const [view, setView] = useState<"slate" | "live" | "model" | "build">("slate");
  const [liveEvents, setLiveEvents] = useState<CricketLiveOddsEvent[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const hasAccess = canAccessCricketPrototype(authState.email);
  const fixtures = useMemo(
    () => CRICKET_PROTOTYPE_FIXTURES.map(computeCricketFixture),
    [],
  );
  const premiumCount = fixtures.filter((fixture) => fixture.confidence).length;

  const refreshCricketLiveTest = () => {
    setLiveLoading(true);
    setLiveError("");
    fetchCricketLiveOddsCached()
      .then((events) => {
        setLiveEvents(events);
      })
      .catch((err) => {
        setLiveError((err as Error)?.message || "Unable to load cricket live odds");
      })
      .finally(() => {
        setLiveLoading(false);
      });
  };

  useEffect(() => {
    if (hasAccess) refreshCricketLiveTest();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <CricketAccessPanel
        email={authState.email}
        onRequestAccess={onRequestAccess}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 border-b border-[#1E1E2E] pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#16161D] px-4 py-2 text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
              <Sparkles className="h-4 w-4" />
              Private prototype
            </span>
            <span className="inline-flex items-center gap-2 border border-[#1E1E2E] bg-[#0A0A0F] px-4 py-2 text-xs font-medium uppercase tracking-widest text-white">
              elliott@woodbry.com
            </span>
          </div>
          <h1 className="max-w-[820px] text-4xl font-semibold uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            RightEdge Cricket
          </h1>
          <p className="mt-5 max-w-[760px] text-base leading-8 text-[#9CA3AF] sm:text-lg">
            A separate cricket surface for the October BBL launch window and the Australian summer Test slate: same RightEdge discipline, a cleaner Supabase-ready model pipeline, and no bleed into the live NRL product.
          </p>
        </div>
        <GlassCard className="p-5">
          <img
            src="/logo-square.png"
            alt="RightEdge"
            className="mb-5 h-14 w-14 border border-[#1E1E2E] object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-2xl font-semibold text-white">8</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">BBL teams</div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-2xl font-semibold text-white">{premiumCount}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Sample plays</div>
            </div>
            <div className="col-span-2 border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Ratings export</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {new Date(CRICKET_RATINGS_GENERATED_AT).toLocaleDateString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      <div className="flex flex-wrap gap-2 border border-[#1E1E2E] bg-[#111116] p-2">
        {[
          { id: "slate", label: "Model slate", icon: Target },
          { id: "live", label: "Live Betr test", icon: RefreshCw },
          { id: "model", label: "Offline brain", icon: Gauge },
          { id: "build", label: "Production path", icon: Activity },
        ].map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id as "slate" | "live" | "model" | "build")}
              className={`inline-flex h-10 items-center gap-2 px-4 text-xs font-medium uppercase tracking-widest transition ${
                active
                  ? "bg-white text-[#0A0A0F]"
                  : "bg-[#16161D] text-[#9CA3AF] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {view === "slate" && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {fixtures.map((fixture) => (
            <CricketFixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </section>
      )}

      {view === "live" && (
        <section>
          <CricketLiveTestCard
            event={liveEvents[0] || null}
            loading={liveLoading}
            error={liveError}
            onRefresh={refreshCricketLiveTest}
          />
        </section>
      )}

      {view === "model" && (
        <section className="grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Leakage-safe ratings",
              text: "Python ingests Cricsheet data, builds pre-match Elo and scoring form, then exports only ratings and constants for production.",
            },
            {
              icon: Percent,
              title: "Calibrated probabilities",
              text: "BBL uses projected run distributions. Tests split decisive results from draw probability so the three-way market is handled honestly.",
            },
            {
              icon: Wallet,
              title: "Value layer",
              text: "Fair odds are compared with the actual betr price, de-vigged, confidence-tagged, and sized with capped fractional Kelly.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <GlassCard key={item.title} className="p-6">
                <div className="mb-5 inline-flex border border-[#1E1E2E] bg-[#16161D] p-3 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mb-3 text-xl font-semibold uppercase tracking-tight text-white">
                  {item.title}
                </h2>
                <p className="text-sm leading-7 text-[#9CA3AF]">{item.text}</p>
              </GlassCard>
            );
          })}
        </section>
      )}

      {view === "build" && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <GlassCard className="p-6 sm:p-8">
            <SectionHeader
              title="Cricket production sequence"
              subtitle="Built to become cricket.rightedge.com.au, then port back into NRL next season"
            />
            <div className="mt-6 grid gap-3">
              {[
                "Push Supabase schema: teams, model_params, fixtures, odds_snapshots, edges, picks and click_outs.",
                "Port the BBL and Test simulator to a Supabase Edge Function with the same model constants.",
                "Use The Odds API for cricket_big_bash and cricket_test_match, then compute user-facing edge against betr prices.",
                "Render free probabilities publicly, keep value_pick, edge and Kelly behind a server-side profile tier check.",
                "Send Bet now through a clickout route so betr CPA referrals are logged before redirect.",
              ].map((item, index) => (
                <div key={item} className="flex gap-4 border border-[#1E1E2E] bg-[#16161D] p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#1E1E2E] bg-[#0A0A0F] text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-[#9CA3AF]">{item}</p>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <img src="/betr-square.png" alt="betr" className="h-10 w-10 border border-[#1E1E2E] object-cover" />
              <div>
                <div className="text-sm font-semibold uppercase tracking-tight text-white">CPA-ready flow</div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Placeholder until betr links are confirmed</div>
              </div>
            </div>
            <div className="space-y-3 text-sm leading-7 text-[#9CA3AF]">
              <p>
                This prototype shows the cards and premium-play mechanics without calling live odds APIs from the browser.
              </p>
              <p>
                The production version should compute and gate all premium fields server-side before Vercel renders the page.
              </p>
            </div>
            <div className="mt-6 border border-[#1E1E2E] bg-[#0A0A0F] p-4 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
              18+ only. Statistical estimates, not guarantees. Gamble responsibly.
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}

function mapTeamToOddsApi(team: string): string {
  const t = team.toLowerCase();
  if (t.includes("new south wales") || t.includes("nsw"))
    return "New South Wales Blues";
  if (t.includes("queensland") || t.includes("qld"))
    return "Queensland Maroons";
  if (t.includes("bronco") || t.includes("brisbane"))
    return "Brisbane Broncos";
  if (t.includes("rabbitoh") || t.includes("south"))
    return "South Sydney Rabbitohs";
  if (t.includes("rooster") || t.includes("sydney"))
    return "Sydney Roosters";
  if (t.includes("storm") || t.includes("melbourne"))
    return "Melbourne Storm";
  if (t.includes("panther") || t.includes("penrith"))
    return "Penrith Panthers";
  if (t.includes("eel") || t.includes("parramatta"))
    return "Parramatta Eels";
  if (t.includes("shark") || t.includes("cronulla"))
    return "Cronulla Sharks";
  if (t.includes("cowboy") || t.includes("north queensland"))
    return "North Queensland Cowboys";
  if (t.includes("sea eagle") || t.includes("manly"))
    return "Manly Sea Eagles";
  if (t.includes("knight") || t.includes("newcastle"))
    return "Newcastle Knights";
  if (t.includes("dragon") || t.includes("st george"))
    return "St George Illawarra Dragons";
  if (t.includes("titan") || t.includes("gold coast"))
    return "Gold Coast Titans";
  if (t.includes("bulldog") || t.includes("canterbury"))
    return "Canterbury Bulldogs";
  if (t.includes("warrior") || t.includes("new zealand"))
    return "New Zealand Warriors";
  if (t.includes("raider") || t.includes("canberra"))
    return "Canberra Raiders";
  if (t.includes("tiger") || t.includes("wests"))
    return "Wests Tigers";
  if (t.includes("dolphin")) return "Dolphins";
  return team;
}

// Module level cache to prevent concurrent fetch requests from multiple cards
const fetchOddsPromises = new Map<string, Promise<any>>();
const ODDS_CACHE_KEY = "rightedge_odds_cache_v5_no_betfair";
const ODDS_CACHE_DURATION = 12 * 60 * 60 * 1000; // Protect the 500/month Starter Odds API quota
const BETR_ODDS_REFRESH_MS = 60 * 1000;

async function fetchLiveOddsCached(bookmaker?: "betr" | "pinnacle", sport?: "origin") {
  const sportSuffix = sport === "origin" ? "_origin" : "";
  const cacheKey = `${bookmaker ? `${ODDS_CACHE_KEY}_${bookmaker}` : ODDS_CACHE_KEY}${sportSuffix}`;
  const usePersistentCache = bookmaker !== "betr";

  // 1. Check local storage cache
  if (usePersistentCache) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < ODDS_CACHE_DURATION) {
          return cached.data;
        }
      }
    } catch (e) {
      // Ignore parse errors, proceed to fetch
    }
  }

  // 2. Prevent concurrent fetches during same mount
  if (fetchOddsPromises.has(cacheKey)) {
    return fetchOddsPromises.get(cacheKey)!;
  }

  // 3. Fetch fresh data
  const queryParams = new URLSearchParams();
  if (bookmaker) queryParams.set("bookmaker", bookmaker);
  if (sport === "origin") queryParams.set("sport", "origin");
  queryParams.set("_", String(Date.now()));
  const query = `?${queryParams.toString()}`;
  const fetchOddsPromise = fetch(
    `/api/live-odds${query}`,
    {
      cache: bookmaker === "betr" ? "no-store" : "default",
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        ...(bookmaker === "betr" ? { "Cache-Control": "no-cache" } : {}),
      },
    },
  )
    .then(async (res) => {
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      if (data.error || !Array.isArray(data)) {
        throw new Error("Invalid Data");
      }

      if (usePersistentCache) {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: data,
          }),
        );
      }

      fetchOddsPromises.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      fetchOddsPromises.delete(cacheKey);
      throw err;
    });

  fetchOddsPromises.set(cacheKey, fetchOddsPromise);
  return fetchOddsPromise;
}

async function fetchBestMatchOddsByBookmaker(bookmaker: "pinnacle") {
  const response = await fetch(
    `/api/best-match-odds?bookmaker=${encodeURIComponent(bookmaker)}&_=${Date.now()}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${bookmaker} best odds`);
  }

  return response.json();
}

async function fetchBestTryScorerOddsCached(bookmaker?: "betr") {
  const cacheKey = bookmaker
    ? `rightedge_best_try_scorer_odds_cache_v1_${bookmaker}`
    : "rightedge_best_try_scorer_odds_cache_v1";
  const shouldUsePersistentCache = bookmaker !== "betr";

  if (shouldUsePersistentCache) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < ODDS_CACHE_DURATION) {
          return cached.data;
        }
      }
    } catch (e) {
      // Ignore cache parse errors.
    }
  }

  if (fetchOddsPromises.has(cacheKey)) {
    return fetchOddsPromises.get(cacheKey)!;
  }

  const params = new URLSearchParams({ _: String(Date.now()) });
  if (bookmaker) params.set("bookmaker", bookmaker);

  const fetchPromise = fetch(`/api/best-try-scorer-odds?${params.toString()}`, {
    cache: shouldUsePersistentCache ? "default" : "no-store",
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      Accept: "application/json",
    },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to fetch try scorer odds");
      const data = await res.json();
      if (shouldUsePersistentCache) {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data,
          }),
        );
      }
      fetchOddsPromises.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      fetchOddsPromises.delete(cacheKey);
      throw err;
    });

  fetchOddsPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

type LiveBookmakerOdd = {
  name: string;
  odds: number;
  isBest: boolean;
  url: string;
};

type FreeBetrMarketOutcome = {
  id: string;
  label: string;
  subLabel: string;
  odds: number;
  modelPct?: number;
  modelBadgeLabel?: string;
  payload: string;
  logoTeam?: string;
  teamColors?: { primary: string; secondary: string };
  tag: string;
  tone: "home" | "away" | "over" | "under";
};

function buildLiveH2hOddsForTeam(
  rawOdds: any[],
  homeTeam: string,
  awayTeam: string,
  selectedTeam: string,
): LiveBookmakerOdd[] {
  const homeApiName = mapTeamToOddsApi(homeTeam);
  const awayApiName = mapTeamToOddsApi(awayTeam);
  const selectedApiName = mapTeamToOddsApi(selectedTeam);

  const match = rawOdds.find(
    (item: any) =>
      (item.home_team === homeApiName && item.away_team === awayApiName) ||
      (item.home_team === awayApiName && item.away_team === homeApiName),
  );

  if (!match?.bookmakers?.length) {
    throw new Error("Match not found or no bookmakers");
  }

  const formattedOdds = match.bookmakers
    .filter((bookie: any) => !isExcludedMatchOddsBookmaker(bookie))
    .map((bookie: any) => {
      const h2hMarket = bookie.markets?.find((market: any) => market.key === "h2h");
      if (!h2hMarket) return null;

      const outcome = h2hMarket.outcomes?.find(
        (item: any) => item.name === selectedApiName,
      );
      if (!outcome) return null;

      return {
        name: bookie.title,
        url: getBetrAffiliateUrl("rightedge_match_odds"),
        odds: outcome.price,
        isBest: false,
      };
    })
    .filter(Boolean) as LiveBookmakerOdd[];

  if (!formattedOdds.length) {
    throw new Error("No odds found");
  }

  const sortedOdds = formattedOdds.sort((a, b) => b.odds - a.odds);
  const bestOdd = Math.max(...sortedOdds.map((bookie) => bookie.odds));

  return sortedOdds.map((bookie) => ({
    ...bookie,
    isBest: bookie.odds === bestOdd,
  }));
}

function OfficialPlayCard({ row }: { row: PredictionRow }) {
  const selectedOdds =
    row.side === "Home"
      ? row.marketHomeOdds
      : row.side === "Away"
        ? row.marketAwayOdds
        : 0;
  const selectedModel =
    row.side === "Home"
      ? row.modelHomeOdds
      : row.side === "Away"
        ? row.modelAwayOdds
        : 0;

  const [liveOdds, setLiveOdds] = useState<
    {
      name: string;
      odds: number;
      isBest: boolean;
      url: string;
    }[]
  >([]);
  const [isLoadingOdds, setIsLoadingOdds] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingOdds(true);

    const fetchRealOdds = async () => {
      try {
        const data = await fetchLiveOddsCached();

        if (!isMounted) return;

        const homeApiName = mapTeamToOddsApi(row.homeTeam);
        const awayApiName = mapTeamToOddsApi(row.awayTeam);

        // Find the match in The Odds API
        const match = data.find(
          (m: any) =>
            (m.home_team === homeApiName &&
              m.away_team === awayApiName) ||
            (m.home_team === awayApiName &&
              m.away_team === homeApiName),
        );

        if (
          !match ||
          !match.bookmakers ||
          match.bookmakers.length === 0
        ) {
          throw new Error("Match not found or no bookmakers");
        }

        const formattedOdds = match.bookmakers
          .filter((bookie: any) => !isExcludedMatchOddsBookmaker(bookie))
          .map((bookie: any) => {
            const h2hMarket = bookie.markets.find(
              (m: any) => m.key === "h2h",
            );
            if (!h2hMarket) return null;

            // We need to find the specific side of the bet (Home or Away)
            // row.side tells us if the bet is on the Home team or Away team
            const betTeamName =
              row.side === "Home" ? homeApiName : awayApiName;

            const outcome = h2hMarket.outcomes.find(
              (o: any) => o.name === betTeamName,
            );
            if (!outcome) return null;

            // Map odds api bookie keys to readable names and links
            let name = bookie.title;

            return {
              name,
              url: getBetrAffiliateUrl("rightedge_match_odds"),
              odds: outcome.price,
            };
          })
          .filter(Boolean);

        if (formattedOdds.length === 0)
          throw new Error("No odds found");

        const sortedOdds = formattedOdds
          .sort((a: any, b: any) => b.odds - a.odds)
        const displayOdds = sortedOdds.slice(0, 3);
        const bestOdd = Math.max(
          ...sortedOdds.map((b: any) => b.odds),
        );

        setLiveOdds(
          displayOdds.map((b: any) => ({
            ...b,
            isBest: b.odds === bestOdd,
          })),
        );
      } catch (e) {
        if (!isMounted) return;
        // Fallback to simulated odds if the API fails, has no key, or no match is found
        const base = selectedOdds || 1.9;
        const bookies = [
          {
            name: "Sportsbet",
            url: getBetrAffiliateUrl("rightedge_match_odds"),
            odds: base,
          },
          {
            name: "TAB",
            url: getBetrAffiliateUrl("rightedge_match_odds"),
            odds: base - 0.05,
          },
          {
            name: "Neds",
            url: getBetrAffiliateUrl("rightedge_match_odds"),
            odds: base + 0.05,
          },
        ];
        const randomized = bookies
          .map((b) => ({
            ...b,
            odds: Number(
              (b.odds + (Math.random() * 0.06 - 0.03)).toFixed(
                2,
              ),
            ),
          }))
          .sort((a, b) => b.odds - a.odds);

        const bestOdd = Math.max(
          ...randomized.map((b) => b.odds),
        );
        setLiveOdds(
          randomized.map((b) => ({
            ...b,
            isBest: b.odds === bestOdd,
          })),
        );
      } finally {
        if (isMounted) setIsLoadingOdds(false);
      }
    };

    fetchRealOdds();

    return () => {
      isMounted = false;
    };
  }, [
    selectedOdds,
    row.match,
    row.side,
    row.homeTeam,
    row.awayTeam,
  ]);

  return (
    <GlassCard className="p-6 md:p-8 relative overflow-hidden flex flex-col h-full">
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <span className="inline-flex items-center gap-2 text-[10px] md:text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
            <Lock className="w-3 h-3 md:w-4 md:h-4" />
            Premium
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4 mb-2">
          <TeamLogo
            teamName={row.bestBet || row.predictedWinner}
            className="w-10 h-10 md:w-12 md:h-12 text-lg"
          />
          <div className="text-xl md:text-3xl font-semibold text-white tracking-tight uppercase leading-none">
            {row.bestBet || row.match}
          </div>
        </div>
        <div className="text-[10px] md:text-sm font-medium text-[#9CA3AF] uppercase tracking-widest mb-4 md:mb-6">
          {row.match} •{" "}
          {row.fixture
            ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
            : "Time TBC"}
        </div>
        {(row.predictedHomeScore || row.predictedAwayScore) && (
          <div className="text-[10px] md:text-sm font-medium text-[#9CA3AF] mb-6 md:mb-8 uppercase tracking-widest">
            Projection:{" "}
            <span className="text-white">
              {row.homeTeam}{" "}
              {Math.round(row.predictedHomeScore)} -{" "}
              {Math.round(row.predictedAwayScore)}{" "}
              {row.awayTeam}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 md:gap-4 border-t border-[#1E1E2E] pt-4 md:pt-6 mb-4 md:mb-6">
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#9CA3AF] font-medium mb-1 md:mb-2">
              Market
            </div>
            <div className="text-lg md:text-2xl font-semibold text-white">
              {selectedOdds ? selectedOdds.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#9CA3AF] font-medium mb-1 md:mb-2">
              Model
            </div>
            <div className="text-lg md:text-2xl font-semibold text-white">
              {selectedModel ? selectedModel.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#9CA3AF] font-medium mb-1 md:mb-2">
              Edge
            </div>
            <div className="text-lg md:text-2xl font-semibold text-[#00E676]">
              +{formatPercent(row.bestEdge, 2)}
            </div>
          </div>
        </div>

        {/* Live Multi-Bookie Comparison */}
        <div className="mt-auto border-t border-[#1E1E2E] pt-6">
          <div className="text-xs font-medium text-[#9CA3AF] mb-4 uppercase tracking-widest flex items-center justify-between">
            <span>Live Bookmaker Prices</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping-pong absolute inline-flex h-full w-full rounded-full bg-[#00E676] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E676]"></span>
            </span>
          </div>
          <div className="flex flex-col gap-2 mb-6 min-h-[160px]">
            {isLoadingOdds ? (
              <div className="flex flex-col gap-2 h-full justify-center opacity-50">
                <div className="h-12 bg-white/5 animate-pulse border border-[#1E1E2E]" />
                <div className="h-12 bg-white/5 animate-pulse border border-[#1E1E2E]" />
                <div className="h-12 bg-white/5 animate-pulse border border-[#1E1E2E]" />
              </div>
            ) : (
              liveOdds.map((bookie) => {
                const isBetr = isBetrBookmaker(bookie.name);
                const className = `group flex items-center justify-between min-h-[52px] p-3.5 border ${
                  isBetr
                    ? "border-[#093AD3] bg-[#093AD3]"
                    : bookie.isBest
                      ? "border-[#1E1E2E] bg-[#16161D]"
                      : "border-[#1E1E2E] bg-white/[0.03]"
                } transition hover:bg-white/[0.06]`;
                const content = (
                  <>
                    <BookmakerName name={bookie.name} />
                    <div className="flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-lg font-black ${
                            isBetr
                              ? "text-white"
                              : bookie.isBest
                                ? "text-[#00E676]"
                                : "text-[#9CA3AF]"
                          }`}
                        >
                          ${bookie.odds.toFixed(2)}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-[#6B7280] transition group-hover:text-white" />
                      </div>
                      <span className={isBetr ? "text-[9px] font-medium uppercase tracking-widest text-white/80" : "text-[9px] font-medium uppercase tracking-widest text-[#6B7280] group-hover:text-white"}>
                        {isBetr ? "Back this market at Betr" : "View NRL markets"}
                      </span>
                    </div>
                  </>
                );

                return (
                  <a
                    key={bookie.name}
                    href={bookie.url}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    aria-label={`Open ${bookie.name} market via Betr affiliate link`}
                    className={className}
                  >
                    {content}
                  </a>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-[#16161D] border border-[#1E1E2E] px-6 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-[#9CA3AF] uppercase tracking-widest">
            Suggested stake
          </span>
          <span className="text-2xl font-semibold text-white">
            {row.stake > 0 ? formatCurrency(row.stake, 0) : "—"}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function HomeCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#111116] border border-[#1E1E2E] ${className}`}
    >
      {children}
    </div>
  );
}

function PublicHero() {
  return (
    <section className="relative mt-8 overflow-hidden pt-12 pb-3 sm:mt-10 sm:pt-16 sm:pb-4 md:mt-12 md:pt-20 md:pb-5">
      <div className="max-w-[760px]">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.04] mb-6">
          The NRL Predictive Model.
        </h1>
        
        <p className="text-base sm:text-lg md:text-xl text-[#9CA3AF] leading-relaxed font-normal max-w-[680px]">
          RightEdge simulates every matchup thousands of times to map out true probabilities. No media noise, no gut feelings—just clean data highlighting live market overlays.
        </p>
        <p className="mt-5 max-w-[680px] text-base font-semibold leading-relaxed text-white sm:text-lg">
          All standard match simulations and score projections are 100% free.
        </p>
      </div>
    </section>
  );
}

function HeroStickyCta({ onGoApp }: { onGoApp: (source: string) => void }) {
  return (
    <div className="sticky top-14 z-40 -mx-6 border-y border-[#1E1E2E] bg-[#0A0A0F]/95 px-6 py-3 backdrop-blur-sm sm:top-16">
      <button
        onClick={() => onGoApp("hero_free_round_predictions")}
        className="inline-flex w-full items-center justify-center gap-2 border border-white/90 bg-white px-5 py-3 text-sm font-medium text-[#0A0A0F] transition hover:opacity-85 sm:w-auto sm:px-6"
      >
        View Free Round Predictions
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function OriginRapidPreview({
  onGoApp,
}: {
  onGoApp: (source: string) => void;
}) {
  const teams = [
    {
      name: "NSW Blues",
      short: "NSW",
      score: 22,
      winPct: 0.53,
      odds: 1.79,
      primary: "#0057B8",
      secondary: "#FFFFFF",
      isWinner: true,
    },
    {
      name: "Queensland Maroons",
      short: "QLD",
      score: 20,
      winPct: 0.47,
      odds: 2.04,
      primary: "#7A1737",
      secondary: "#F6D6A8",
      isWinner: false,
    },
  ];

  return (
    <HomeCard className="mb-6 p-5 sm:p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex border border-[#1E1E2E] bg-[#16161D] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              Origin Rapid Preview
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              NSW Blues v Queensland Maroons
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
              Market-calibrated projection for tonight&apos;s opener. Built for a fast Origin read, separate from the standard NRL round model.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
              Accor Stadium
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              Tonight · 8:05 PM AEST
            </div>
          </div>
        </div>

        <div className="overflow-hidden border border-[#1E1E2E] bg-[#0A0A0F]/40">
          {teams.map((team, index) => (
            <div
              key={team.name}
              className="relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[#1E1E2E] px-4 py-4 first:border-t-0 sm:gap-5 sm:px-6"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-4 h-[calc(100%-32px)] w-0.5"
                style={{ backgroundColor: team.primary }}
              />
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center border text-[11px] font-semibold uppercase tracking-[0.08em] sm:h-12 sm:w-12"
                  style={{
                    backgroundColor: team.primary,
                    borderColor: team.secondary,
                    color: team.secondary,
                  }}
                >
                  {team.short}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-xl font-semibold tracking-tight sm:text-2xl ${team.isWinner ? "text-white" : "text-[#9CA3AF]"}`}>
                    {team.name}
                  </div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                    {index === 0 ? "Home" : "Away"} · H2H ${team.odds.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="border border-[#1E1E2E] bg-[#16161D] px-3 py-2 text-center sm:min-w-[78px]">
                <div className="text-[8px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                  Score
                </div>
                <div className={`text-2xl font-semibold leading-none sm:text-3xl ${team.isWinner ? "text-white" : "text-[#9CA3AF]"}`}>
                  {team.score}
                </div>
              </div>
              <div className="border border-[#1E1E2E] bg-[#16161D] px-3 py-2 text-center sm:min-w-[78px]">
                <div className="text-[8px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                  Win %
                </div>
                <div className={`text-lg font-semibold leading-none sm:text-xl ${team.isWinner ? "text-[#00E676]" : "text-[#9CA3AF]"}`}>
                  {formatPercent(team.winPct, 0)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              Projected score
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">20-18</div>
          </div>
          <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              Line signal
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">QLD +2.5</div>
          </div>
          <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              Read
            </div>
            <div className="mt-2 text-sm font-medium leading-relaxed text-[#9CA3AF]">
              NSW edge on win probability, Queensland edge against the current line.
            </div>
          </div>
        </div>

        <div className="border border-[#1E1E2E] bg-[#0A0A0F] p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-[#9CA3AF]">
            Origin is tight, and the market agrees. The rapid model read has NSW narrowly ahead at Accor, but not by enough to clear the current -2.5 line. Queensland +2.5 shapes as the cleaner value angle if the price holds.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => { window.location.hash = "best-bets"; }}
              className="inline-flex items-center justify-center gap-2 border border-white bg-white px-5 py-3 text-sm font-medium text-[#0A0A0F] transition hover:opacity-85"
            >
              Unlock Premium Origin Signals
              <Lock className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onGoApp("origin_rapid_preview_free_predictions")}
              className="inline-flex items-center justify-center gap-2 border border-[#1E1E2E] bg-transparent px-5 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              View Free Round Predictions
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">
            18+ only · Gamble responsibly · 1800 858 858 · gamblinghelponline.org.au
          </div>
        </div>
      </div>
    </HomeCard>
  );
}

function TryScorerTicker({ data }: { data: DashboardData | null }) {
  const plays = useMemo(() => {
    if (!data?.tryScorers.length) return [];

    const currentRoundNumber = toRoundNumber(data.currentRoundLabel);
    const availableRounds = Array.from(
      new Set(
        data.tryScorers
          .map((row) => row.round)
          .filter((round) => Number.isFinite(round) && round > 0),
      ),
    ).sort((a, b) => b - a);
    const latestRound = availableRounds[0] || 0;
    const tickerRound = data.tryScorers.some((row) => row.round === currentRoundNumber)
      ? currentRoundNumber
      : latestRound;

    return data.tryScorers
      .filter((row) => row.round === tickerRound)
      .filter((row) => getTryScorerSignal(row) || isTryScorerBestBetCandidate(row))
      .filter((row) => row.statsInsiderPct > 0 && row.marketImpliedPct > 0 && row.bestOdds > 1)
      .sort(
        (a, b) =>
          (getTryScorerSignal(b)?.sortRank || 0) - (getTryScorerSignal(a)?.sortRank || 0) ||
          b.statsInsiderPct - a.statsInsiderPct ||
          b.bestOdds - a.bestOdds,
      );
  }, [data]);

  if (!plays.length) return null;

  const renderPlay = (row: TryScorerRow, index: number, copy: string) => (
    <React.Fragment key={`${copy}-${getTryScorerKey(row)}-${index}`}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="text-[13px] font-medium text-white uppercase tracking-[0.02em]">
          {row.player}
        </span>
        <span className="text-[13px] font-medium text-[#9CA3AF]">
          · MODEL <span className="text-[#00E676]">{formatPercent(row.statsInsiderPct, 0)}</span>
        </span>
        <span className="text-[13px] font-medium text-[#9CA3AF]">
          · MARKET {formatPercent(row.marketImpliedPct, 0)}
        </span>
        <span className="text-[13px] font-medium text-[#9CA3AF]">
          · ${row.bestOdds.toFixed(2)}
        </span>
      </span>
      <span className="mx-5 text-[#6B7280]">•</span>
    </React.Fragment>
  );

  return (
    <div className="relative h-[44px] overflow-hidden border-y border-[#1E1E2E] bg-[#16161D]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{ background: "linear-gradient(90deg, #F6F6F3 0%, rgba(246,246,243,0) 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
        style={{ background: "linear-gradient(270deg, #F6F6F3 0%, rgba(246,246,243,0) 100%)" }}
      />
      <div className="try-scorer-ticker-track flex h-full w-max items-center">
        <div className="flex h-full shrink-0 items-center pr-10">
          {plays.map((row, index) => renderPlay(row, index, "a"))}
        </div>
        <div className="flex h-full shrink-0 items-center pr-10" aria-hidden="true">
          {plays.map((row, index) => renderPlay(row, index, "b"))}
        </div>
      </div>
    </div>
  );
}

function ReadMore({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col items-start">
      <div
        className={`${expanded ? "" : "line-clamp-3 md:line-clamp-none"}`}
      >
        {children}
      </div>
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="md:hidden text-white text-[10px] font-medium uppercase tracking-widest mt-2 border-b border-[#1E1E2E] hover:opacity-80"
        >
          + Read more
        </button>
      )}
    </div>
  );
}

function getBetrMatchMarketsFromRaw(rawOdds: any[], row: PredictionRow) {
  const marketMap = buildSgmMarketMap(rawOdds);
  const candidateKeys = [
    buildMatchLabelKey(row.match),
    buildMatchKey(row.homeTeam, row.awayTeam),
    buildMatchKey(row.awayTeam, row.homeTeam),
  ];

  for (const key of candidateKeys) {
    const markets = marketMap[key]?.betr;
    if (markets) return markets;
  }

  const rowPairKey = buildTeamPairKey(row.homeTeam, row.awayTeam);
  for (const [matchKey, bookmakers] of Object.entries(marketMap)) {
    const [teamA, teamB] = matchKey.split("__");
    if (teamA && teamB && buildTeamPairKey(teamA, teamB) === rowPairKey) {
      return bookmakers.betr || null;
    }
  }

  return null;
}

function buildFreeBetrPayload(row: PredictionRow, market: string, selection: string) {
  return [
    "rightedge_free",
    slugifyPayloadPart(row.match),
    slugifyPayloadPart(market),
    slugifyPayloadPart(selection),
  ].filter(Boolean).join("_");
}

function getTeamModelPct(row: PredictionRow, team: string) {
  return normalizeTeamName(team) === normalizeTeamName(row.homeTeam)
    ? getImpliedWinPctFromOdds(row.modelHomeOdds)
    : getImpliedWinPctFromOdds(row.modelAwayOdds);
}

function getFreeBetrPrimarySpread(
  markets: SgmMarketBookmakerData,
  team: string,
) {
  const teamKey = normalizeTeamName(team);
  const teamSpreads = markets.spreads.filter((item) =>
    normalizeTeamName(item.team) === teamKey && item.odds > 1 && Number.isFinite(item.point)
  );
  if (teamSpreads.length <= 1) return teamSpreads[0] || null;

  return [...teamSpreads].sort((a, b) => {
    const pairedA = markets.spreads.some((item) =>
      normalizeTeamName(item.team) !== teamKey &&
      Math.abs(item.point + a.point) < 0.001 &&
      item.odds > 1
    );
    const pairedB = markets.spreads.some((item) =>
      normalizeTeamName(item.team) !== teamKey &&
      Math.abs(item.point + b.point) < 0.001 &&
      item.odds > 1
    );
    if (pairedA !== pairedB) return pairedA ? -1 : 1;

    const priceDistanceA = Math.abs(a.odds - 1.9);
    const priceDistanceB = Math.abs(b.odds - 1.9);
    if (Math.abs(priceDistanceA - priceDistanceB) > 0.001) {
      return priceDistanceA - priceDistanceB;
    }

    return Math.abs(a.point) - Math.abs(b.point);
  })[0] || null;
}

function getFreeBetrH2hOutcomes(row: PredictionRow, markets?: SgmMarketBookmakerData | null): FreeBetrMarketOutcome[] {
  if (!markets) return [];

  return [row.homeTeam, row.awayTeam]
    .map((team) => {
      const odds = markets.h2h[normalizeTeamName(team)] || 0;
      if (odds <= 1) return null;
      const modelPct = getTeamModelPct(row, team);
      return {
        id: `h2h-${team}`,
        label: team,
        subLabel: "Head to head",
        odds,
        modelPct,
        modelBadgeLabel: "Win",
        payload: buildFreeBetrPayload(row, "h2h", team),
        logoTeam: team,
        teamColors: getTeamColors(team),
        tag: normalizeTeamName(team) === normalizeTeamName(row.homeTeam) ? "Home" : "Away",
        tone: normalizeTeamName(team) === normalizeTeamName(row.homeTeam) ? "home" : "away",
      };
    })
    .filter(Boolean) as FreeBetrMarketOutcome[];
}

function getFreeBetrLineOutcomes(row: PredictionRow, markets?: SgmMarketBookmakerData | null): FreeBetrMarketOutcome[] {
  if (!markets) return [];

  return [row.homeTeam, row.awayTeam]
    .map((team) => {
      const spread = getFreeBetrPrimarySpread(markets, team);

      if (!spread || spread.odds <= 1) return null;
      const projectedMargin = getSelectedTeamProjectedMargin(row, team);
      const coverEdge = projectedMargin + spread.point;
      const modelPct = probabilityFromEdge(coverEdge, 7.5);

      return {
        id: `line-${team}`,
        label: `${team} ${formatSgmLine(spread.point)}`,
        subLabel: "Line",
        odds: spread.odds,
        modelPct,
        modelBadgeLabel: "Cover",
        payload: buildFreeBetrPayload(row, "line", `${team}_${spread.point}`),
        logoTeam: team,
        teamColors: getTeamColors(team),
        tag: normalizeTeamName(team) === normalizeTeamName(row.homeTeam) ? "Home line" : "Away line",
        tone: normalizeTeamName(team) === normalizeTeamName(row.homeTeam) ? "home" : "away",
      };
    })
    .filter(Boolean) as FreeBetrMarketOutcome[];
}

function getFreeBetrPrimaryTotalPoint(markets: SgmMarketBookmakerData) {
  const points = [...new Set(markets.totals.map((item) => item.point))]
    .filter((point) => Number.isFinite(point));

  return points
    .map((point) => {
      const over = markets.totals.find((item) => item.side === "Over" && item.point === point && item.odds > 1);
      const under = markets.totals.find((item) => item.side === "Under" && item.point === point && item.odds > 1);
      if (!over || !under) return null;

      return {
        point,
        priceGap: Math.abs(over.odds - under.odds),
        marketDistance: Math.abs(((over.odds + under.odds) / 2) - 1.9),
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      (a!.priceGap - b!.priceGap) ||
      (a!.marketDistance - b!.marketDistance) ||
      Math.abs(a!.point) - Math.abs(b!.point)
    )[0]?.point;
}

function getFreeBetrTotalOutcomes(row: PredictionRow, markets?: SgmMarketBookmakerData | null): FreeBetrMarketOutcome[] {
  if (!markets) return [];

  const projectedTotal = row.predictedHomeScore + row.predictedAwayScore;
  if (!projectedTotal) return [];

  const primaryPoint = getFreeBetrPrimaryTotalPoint(markets);
  if (!Number.isFinite(primaryPoint)) return [];

  return (["Over", "Under"] as const)
    .map((side) => {
      const total = markets.totals.find((item) => item.side === side && item.point === primaryPoint);
      if (!total || total.odds <= 1) return null;
      const edge = side === "Over"
        ? projectedTotal - total.point
        : total.point - projectedTotal;
      const modelPct = probabilityFromEdge(edge, 8);

      return {
        id: `total-${side}`,
        label: `${side} ${total.point}`,
        subLabel: `Total points · Model ${Math.round(projectedTotal)} pts`,
        odds: total.odds,
        modelPct,
        modelBadgeLabel: side,
        payload: buildFreeBetrPayload(row, "total", `${side}_${total.point}`),
        tag: side,
        tone: side === "Over" ? "over" : "under",
      };
    })
    .filter(Boolean) as FreeBetrMarketOutcome[];
}

function getFreeBetrOutcomeStyle(outcome: FreeBetrMarketOutcome) {
  return {
    cardStyle: {
      borderColor: "#1E1E2E",
      boxShadow: "none",
    },
    accentStyle: { backgroundColor: "transparent" },
    tagStyle: { backgroundColor: "#16161D", color: "#FFFFFF", border: "1px solid #1E1E2E" },
    priceStyle: { color: "#FFFFFF" },
  };
}

function FreeBetrMarketsPanel({
  row,
  isPremium,
  onRequestAccess,
}: {
  row: PredictionRow;
  isPremium: boolean;
  onRequestAccess: (targetHash?: string) => void;
}) {
  const [activeMarket, setActiveMarket] = useState<"h2h" | "line" | "total">("h2h");
  const [betrMarkets, setBetrMarkets] = useState<SgmMarketBookmakerData | null>(null);
  const [isLoadingOdds, setIsLoadingOdds] = useState(true);
  const isPremiumLockedMarket = !isPremium && activeMarket !== "h2h";

  useEffect(() => {
    let isMounted = true;
    let lastFetchAt = 0;
    setIsLoadingOdds(true);

    const fetchRealOdds = async () => {
      lastFetchAt = Date.now();
      try {
        const data = await fetchLiveOddsCached("betr");
        if (!isMounted) return;
        setBetrMarkets(getBetrMatchMarketsFromRaw(data, row));
      } catch (e) {
        if (!isMounted) return;
        setBetrMarkets(null);
      } finally {
        if (isMounted) setIsLoadingOdds(false);
      }
    };

    const refreshVisibleOdds = () => {
      if (document.visibilityState !== "visible") return;
      fetchRealOdds();
    };

    const refreshOddsOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchAt < 5 * 1000) return;
      fetchRealOdds();
    };

    fetchRealOdds();
    const refreshTimer = window.setInterval(refreshVisibleOdds, BETR_ODDS_REFRESH_MS);
    window.addEventListener("focus", refreshOddsOnReturn);
    document.addEventListener("visibilitychange", refreshOddsOnReturn);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOddsOnReturn);
      document.removeEventListener("visibilitychange", refreshOddsOnReturn);
    };
  }, [row.match]);

  const outcomes =
    activeMarket === "h2h"
      ? getFreeBetrH2hOutcomes(row, betrMarkets)
      : activeMarket === "line"
        ? getFreeBetrLineOutcomes(row, betrMarkets)
        : getFreeBetrTotalOutcomes(row, betrMarkets);

  const hasH2hMarkets = getFreeBetrH2hOutcomes(row, betrMarkets).length > 0;
  const hasLineMarkets = getFreeBetrLineOutcomes(row, betrMarkets).length > 0;
  const hasTotalMarkets = getFreeBetrTotalOutcomes(row, betrMarkets).length > 0;
  const matchCompleted = isFixtureCompleted(row.fixture);

  const marketAvailability =
    activeMarket === "h2h"
      ? hasH2hMarkets
      : activeMarket === "line"
        ? hasLineMarkets
        : hasTotalMarkets;

  const unavailableCopy =
    activeMarket === "total"
      ? {
          title: "Total market not currently in the Betr feed",
          detail:
            "The live affiliate board is sending head-to-head and line prices for this match, but not total points right now.",
        }
      : activeMarket === "line"
        ? {
            title: "Line market not currently in the Betr feed",
            detail:
              "The live affiliate board is not exposing the current handicap for this match right now.",
            }
        : {
            title: "Market not currently in the Betr feed",
            detail:
              "Open the live board at Betr to check whether the market has just been posted.",
          };
  const completedCopy = {
    title: "Match completed",
  };

  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-1 mb-4 border border-[#1E1E2E] bg-[#0A0A0F] p-1">
        {([
          ["h2h", "H2H"],
          ["line", "Line"],
          ["total", "Total"],
        ] as const).map(([market, label]) => (
          <button
            key={market}
            type="button"
            onClick={() => setActiveMarket(market)}
            className={`min-h-[36px] px-2 text-[10px] font-medium uppercase tracking-widest transition ${
              activeMarket === market
                ? "bg-white text-[#0A0A0F]"
                : "bg-transparent text-[#6B7280] hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {market !== "h2h" && !isPremium && <Lock className="h-3 w-3" />}
              {label}
            </span>
          </button>
        ))}
      </div>
      <div className="relative min-h-[132px]">
        {isLoadingOdds ? (
          <div className="flex flex-col gap-2 opacity-50">
            <div className="h-10 bg-white/5 animate-pulse border border-[#1E1E2E]" />
            <div className="h-10 bg-white/5 animate-pulse border border-[#1E1E2E]" />
          </div>
        ) : outcomes.length > 0 ? (
          <div className={`grid grid-cols-1 gap-2 ${isPremiumLockedMarket ? "pointer-events-none select-none blur-sm opacity-45" : ""}`}>
            {outcomes.map((outcome) => {
              const outcomeStyle = getFreeBetrOutcomeStyle(outcome);

              return (
                <BetrAffiliateLink
                  key={outcome.id}
                  payload={outcome.payload}
                  className="group relative min-h-[118px] overflow-hidden border bg-[#111116] transition hover:bg-[#16161D]"
                  style={outcomeStyle.cardStyle}
                >
                  <span
                    className="absolute left-0 top-0 h-full w-1"
                    style={outcomeStyle.accentStyle}
                  />
                  <div className="relative pl-1">
                    <div className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {outcome.logoTeam ? (
                              <TeamLogo teamName={outcome.logoTeam} className="h-7 w-7 text-[9px]" />
                            ) : (
                              <BetrLogoMark className="h-7 w-7" />
                            )}
                            <div className="min-w-0">
                              <span
                                className="inline-flex px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-widest"
                                style={outcomeStyle.tagStyle}
                              >
                                {outcome.tag}
                              </span>
                            </div>
                          </div>
                          <div className="text-base font-semibold text-white uppercase leading-tight">
                            {outcome.label}
                          </div>
                          <div className="mt-1 text-[9px] font-medium uppercase tracking-widest text-[#9CA3AF]">
                            {outcome.subLabel}
                          </div>
                        </div>
                        <div className="mt-1 flex shrink-0 flex-col items-end border border-[#1E1E2E] bg-[#16161D] px-2 py-1 text-right">
                          <span className="text-[7px] font-medium uppercase tracking-widest text-[#9CA3AF]">
                            Model
                          </span>
                          <span className="text-base font-semibold leading-none text-[#00E676] tabular-nums">
                            {Number.isFinite(outcome.modelPct) ? formatPercent(outcome.modelPct || 0, 0) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="re-betr-button mx-4 mb-4 flex items-center justify-between gap-3 border border-[#093AD3] bg-[#093AD3] px-3 py-2 text-white transition group-hover:opacity-90">
                      <div className="flex items-center gap-2 min-w-0">
                        <BetrLogoMark className="h-6 w-6 rounded-sm" />
                        <span className="text-[10px] font-medium uppercase tracking-widest">
                          Back at Betr
                        </span>
                      </div>
                      <div className="shrink-0 text-2xl font-semibold leading-none">
                        ${outcome.odds.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </BetrAffiliateLink>
              );
            })}
          </div>
        ) : (
          <div className={`flex flex-col gap-3 ${isPremiumLockedMarket ? "pointer-events-none select-none blur-sm opacity-45" : ""}`}>
            {!marketAvailability && (
              <div className="border border-[#1E1E2E] bg-[#16161D] px-4 py-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF] mb-2">
                  {matchCompleted ? "Market status" : "Live status"}
                </div>
                <div className="text-sm font-semibold text-white uppercase">
                  {matchCompleted ? completedCopy.title : unavailableCopy.title}
                </div>
                {!matchCompleted && (
                  <div className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                    {unavailableCopy.detail}
                  </div>
                )}
              </div>
            )}
            {!matchCompleted && (
              <BetrAffiliateLink
                payload={buildFreeBetrPayload(row, activeMarket, "markets")}
                className="re-betr-button group flex min-h-[92px] items-center justify-between gap-3 border border-[#093AD3] bg-[#093AD3] p-4 transition hover:opacity-90"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <BetrLogoMark className="h-7 w-7" />
                    <span className="text-[10px] font-medium uppercase tracking-widest text-white">
                      Betr
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white uppercase">
                    Back at Betr
                  </div>
                  <div className="mt-1 text-[9px] font-medium uppercase tracking-widest text-white/70">
                    {marketAvailability ? "View live markets" : "Open live board"}
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-white/80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </BetrAffiliateLink>
            )}
          </div>
        )}
        {isPremiumLockedMarket && !isLoadingOdds && (
          <div className="absolute inset-0 z-10 flex items-center justify-center border border-[#1E1E2E] bg-[#0A0A0F]/80 px-4 text-center backdrop-blur-[2px]">
            <div className="max-w-[260px]">
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center border border-white/15 bg-[#16161D]">
                <Lock className="h-4 w-4 text-white" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white">
                Premium market
              </div>
              <div className="mt-2 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
                Unlock line and total reads
              </div>
              <button
                type="button"
                onClick={() => onRequestAccess("matches")}
                className="mt-4 inline-flex min-h-[36px] items-center justify-center border border-white bg-white px-4 text-[10px] font-semibold uppercase tracking-widest text-[#0A0A0F] transition hover:opacity-90"
              >
                Unlock Premium
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type OriginMarketBoardOutcome = {
  id: string;
  label: string;
  subLabel: string;
  tag: string;
  modelPct: number;
  marketOdds?: number;
  marketSource: string;
  payload: string;
  logoTeam?: string;
  tone?: "home" | "away" | "over" | "under";
};

function OriginMarketBoard({
  row,
  bestMarketMap,
  baselineMarketMap,
  isLoading = false,
}: {
  row: PredictionRow;
  bestMarketMap: SgmMarketMap;
  baselineMarketMap: SgmMarketMap;
  isLoading?: boolean;
}) {
  const [activeMarket, setActiveMarket] = useState<"h2h" | "line" | "total">("h2h");

  const projectedTotal = row.predictedHomeScore + row.predictedAwayScore;
  const pinnacleMarkets = getBookmakerMarketsForPrediction(baselineMarketMap, row, "pinnacle");
  const bestMarkets = getSgmMatchMarkets(bestMarketMap, row);
  const getBestH2hOffer = (team: string, fallbackOdds: number) => {
    const teamKey = normalizeTeamName(team);
    const offers = Object.entries(bestMarkets)
      .map(([bookKey, data]) => {
        const odds = data.h2h[teamKey];
        if (!odds || odds <= 1) return null;
        return {
          bookmaker: displayBookmakerName(bookKey),
          odds,
        };
      })
      .filter(Boolean) as { bookmaker: string; odds: number }[];

    return offers.sort((a, b) => {
      const oddsDiff = b.odds - a.odds;
      if (Math.abs(oddsDiff) > 0.005) return oddsDiff;
      if (isBetrBookmaker(a.bookmaker) && !isBetrBookmaker(b.bookmaker)) return -1;
      if (!isBetrBookmaker(a.bookmaker) && isBetrBookmaker(b.bookmaker)) return 1;
      return a.bookmaker.localeCompare(b.bookmaker);
    })[0] || { bookmaker: "Best available", odds: fallbackOdds };
  };
  const pinnacleHomeH2h = pinnacleMarkets?.h2h[normalizeTeamName(row.homeTeam)] || ORIGIN_MARKET_SNAPSHOT.h2h.home;
  const pinnacleAwayH2h = pinnacleMarkets?.h2h[normalizeTeamName(row.awayTeam)] || ORIGIN_MARKET_SNAPSHOT.h2h.away;
  const homeH2hBest = getBestH2hOffer(row.homeTeam, pinnacleHomeH2h);
  const awayH2hBest = getBestH2hOffer(row.awayTeam, pinnacleAwayH2h);
  const pinnacleHomeLine =
    findSpreadOffer(pinnacleMarkets, row.homeTeam, ORIGIN_MARKET_SNAPSHOT.line.homePoint) ||
    { point: ORIGIN_MARKET_SNAPSHOT.line.homePoint, odds: ORIGIN_MARKET_SNAPSHOT.line.homeOdds, team: row.homeTeam };
  const pinnacleAwayLine =
    findSpreadOffer(pinnacleMarkets, row.awayTeam, ORIGIN_MARKET_SNAPSHOT.line.awayPoint) ||
    { point: ORIGIN_MARKET_SNAPSHOT.line.awayPoint, odds: ORIGIN_MARKET_SNAPSHOT.line.awayOdds, team: row.awayTeam };
  const bestHomeLine =
    findBestSpreadOffer(bestMarketMap, row, row.homeTeam, pinnacleHomeLine.point) ||
    { bookmaker: "Best available", odds: pinnacleHomeLine.odds, point: pinnacleHomeLine.point };
  const bestAwayLine =
    findBestSpreadOffer(bestMarketMap, row, row.awayTeam, pinnacleAwayLine.point) ||
    { bookmaker: "Best available", odds: pinnacleAwayLine.odds, point: pinnacleAwayLine.point };
  const pinnacleOver =
    findTotalOffer(pinnacleMarkets, "Over", ORIGIN_MARKET_SNAPSHOT.total.point) ||
    { side: "Over" as const, point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.overOdds };
  const pinnacleUnder =
    findTotalOffer(pinnacleMarkets, "Under", ORIGIN_MARKET_SNAPSHOT.total.point) ||
    { side: "Under" as const, point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.underOdds };
  const bestOver =
    findBestTotalOffer(bestMarketMap, row, "Over", pinnacleOver.point) ||
    { bookmaker: "Best available", odds: pinnacleOver.odds, point: pinnacleOver.point };
  const bestUnder =
    findBestTotalOffer(bestMarketMap, row, "Under", pinnacleUnder.point) ||
    { bookmaker: "Best available", odds: pinnacleUnder.odds, point: pinnacleUnder.point };

  const displayOutcomes: OriginMarketBoardOutcome[] =
    activeMarket === "h2h"
      ? [
          {
            id: "origin-h2h-home",
            label: row.homeTeam,
            subLabel: `Model ${formatPercent(getImpliedWinPctFromOdds(row.modelHomeOdds), 0)} · Fair ${formatOddsValue(row.modelHomeOdds)}`,
            tag: "NSW",
            modelPct: getImpliedWinPctFromOdds(row.modelHomeOdds),
            marketOdds: homeH2hBest.odds,
            marketSource: homeH2hBest.bookmaker,
            payload: buildFreeBetrPayload(row, "origin_h2h", row.homeTeam),
            logoTeam: row.homeTeam,
            tone: "home",
          },
          {
            id: "origin-h2h-away",
            label: row.awayTeam,
            subLabel: `Model ${formatPercent(getImpliedWinPctFromOdds(row.modelAwayOdds), 0)} · Fair ${formatOddsValue(row.modelAwayOdds)}`,
            tag: "QLD",
            modelPct: getImpliedWinPctFromOdds(row.modelAwayOdds),
            marketOdds: awayH2hBest.odds,
            marketSource: awayH2hBest.bookmaker,
            payload: buildFreeBetrPayload(row, "origin_h2h", row.awayTeam),
            logoTeam: row.awayTeam,
            tone: "away",
          },
        ]
      : activeMarket === "line"
        ? [row.homeTeam, row.awayTeam].map((team) => {
            const isHome = normalizeTeamName(team) === normalizeTeamName(row.homeTeam);
            const point = isHome ? pinnacleHomeLine.point : pinnacleAwayLine.point;
            const offer = isHome ? bestHomeLine : bestAwayLine;
            const projectedMargin = getSelectedTeamProjectedMargin(row, team);
            const modelPct = probabilityFromEdge(projectedMargin + point, 7.5);
            return {
              id: `origin-line-${isHome ? "home" : "away"}`,
              label: `${team} ${formatSgmLine(point)}`,
              subLabel: `Model cover ${formatPercent(modelPct, 0)} · Score margin ${row.predictedHomeScore}-${row.predictedAwayScore}`,
              tag: isHome ? "NSW line" : "QLD line",
              modelPct,
              marketOdds: offer.odds,
              marketSource: offer.bookmaker,
              payload: buildFreeBetrPayload(row, "origin_line", `${team}_${point}`),
              logoTeam: team,
              tone: isHome ? "home" : "away",
            };
          })
        : [
          {
            id: "origin-total-over",
              label: `Over ${pinnacleOver.point}`,
              subLabel: `Model ${Math.round(projectedTotal)} pts · Over probability ${formatPercent(probabilityFromEdge(projectedTotal - pinnacleOver.point, 8), 0)}`,
              tag: "Over",
              modelPct: probabilityFromEdge(projectedTotal - pinnacleOver.point, 8),
              marketOdds: bestOver.odds,
              marketSource: bestOver.bookmaker,
              payload: buildFreeBetrPayload(row, "origin_total", `over_${pinnacleOver.point}`),
              tone: "over",
            },
            {
              id: "origin-total-under",
              label: `Under ${pinnacleUnder.point}`,
              subLabel: `Model ${Math.round(projectedTotal)} pts · Under probability ${formatPercent(probabilityFromEdge(pinnacleUnder.point - projectedTotal, 8), 0)}`,
              tag: "Under",
              modelPct: probabilityFromEdge(pinnacleUnder.point - projectedTotal, 8),
              marketOdds: bestUnder.odds,
              marketSource: bestUnder.bookmaker,
              payload: buildFreeBetrPayload(row, "origin_total", `under_${pinnacleUnder.point}`),
              tone: "under",
            },
          ];

  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium mb-2">
              Market board
            </div>
            <div className="text-lg md:text-2xl font-semibold tracking-tight text-white">
              Origin II market board
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 border border-[#1E1E2E] bg-[#0A0A0F] p-1">
          {([
            ["h2h", "H2H"],
            ["line", "Line"],
            ["total", "Total"],
          ] as const).map(([market, label]) => (
            <button
              key={market}
              type="button"
              onClick={() => setActiveMarket(market)}
              className={`min-h-[38px] px-2 text-[10px] font-medium uppercase tracking-widest transition ${
                activeMarket === market
                  ? "bg-white text-[#0A0A0F]"
                  : "bg-transparent text-[#6B7280] hover:bg-white/5 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="h-40 border border-[#1E1E2E] bg-white/5 animate-pulse" />
            <div className="h-40 border border-[#1E1E2E] bg-white/5 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {displayOutcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="border border-[#1E1E2E] bg-[#111116] p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {outcome.logoTeam ? (
                        <TeamLogo teamName={outcome.logoTeam} className="h-8 w-8 text-[10px]" />
                      ) : (
                        <BetrLogoMark className="h-8 w-8" />
                      )}
                      <span className="inline-flex px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-widest border border-[#1E1E2E] bg-[#16161D] text-white">
                        {outcome.tag}
                      </span>
                    </div>
                    <div className="text-lg md:text-2xl font-semibold tracking-tight text-white leading-tight">
                      {outcome.label}
                    </div>
                    <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      {outcome.subLabel}
                    </div>
                  </div>
                  <div className="shrink-0 border border-[#1E1E2E] bg-[#16161D] px-3 py-2 text-right min-w-[104px]">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium mb-1">
                      Model
                    </div>
                    <div className="text-xl md:text-2xl font-semibold text-[#00E676] tabular-nums">
                      {formatPercent(outcome.modelPct, 0)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border border-[#1E1E2E] bg-[#16161D] px-3 py-3 mb-4">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium mb-1">
                      {outcome.marketSource}
                    </div>
                    <div className="text-sm md:text-base text-white font-medium">
                      {typeof outcome.marketOdds === "number" && outcome.marketOdds > 1
                        ? formatOddsValue(outcome.marketOdds)
                        : "Open live market"}
                    </div>
                  </div>
                  {!isBetrBookmaker(outcome.marketSource) && (
                    <div className="text-[9px] uppercase tracking-[0.18em] text-[#6B7280] font-medium text-right max-w-[110px]">
                      Check the live board at Betr
                    </div>
                  )}
                </div>

                <BetrAffiliateLink
                  payload={outcome.payload}
                  className="re-betr-button flex items-center justify-between gap-3 border border-[#093AD3] bg-[#093AD3] px-4 py-3 text-white transition hover:opacity-90"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BetrLogoMark className="h-6 w-6 rounded-sm" />
                    <span className="text-[10px] font-medium uppercase tracking-widest">
                      Open at Betr
                    </span>
                  </div>
                  {typeof outcome.marketOdds === "number" && isBetrBookmaker(outcome.marketSource) ? (
                    <span className="text-2xl font-semibold leading-none shrink-0">
                      {formatOddsValue(outcome.marketOdds)}
                    </span>
                  ) : (
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-white/80" />
                  )}
                </BetrAffiliateLink>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function FeaturedMatchPreview({
  row,
  onRequestPremium,
}: {
  row: PredictionRow | null;
  onRequestPremium: (source: string) => void;
}) {
  if (!row) return null;

  const selectedTeam = normalizeTeamName(
    row.predictedWinner,
  );
  const selectedOdds =
    selectedTeam === normalizeTeamName(row.homeTeam)
      ? row.marketHomeOdds
      : selectedTeam === normalizeTeamName(row.awayTeam)
        ? row.marketAwayOdds
        : 0;
  const selectedModel =
    selectedTeam === normalizeTeamName(row.homeTeam)
      ? row.modelHomeOdds
      : selectedTeam === normalizeTeamName(row.awayTeam)
        ? row.modelAwayOdds
        : 0;
  const selectedIsHome = selectedTeam === normalizeTeamName(row.homeTeam);
  const selectedIsAway = selectedTeam === normalizeTeamName(row.awayTeam);
  const selectedEdge = selectedIsHome
    ? row.homeOverlay
    : selectedIsAway
      ? row.awayOverlay
      : 0;
  const selectedEdgeLabel =
    selectedIsHome || selectedIsAway
      ? `${selectedEdge >= 0 ? "+" : ""}${formatPercent(selectedEdge, 2)}`
      : "—";
  const selectedEdgeClass =
    !selectedIsHome && !selectedIsAway
      ? "text-[#9CA3AF]"
      : selectedEdge >= 0
        ? "text-[#00E676]"
        : "text-[#F87171]";

  const featuredWinPct = getPredictedWinnerWinPct(row);

  const homeScore = Math.round(row.predictedHomeScore);
  const awayScore = Math.round(row.predictedAwayScore);
  const homeWinsProjection = homeScore > awayScore;
  const awayWinsProjection = awayScore > homeScore;
  const fixtureMeta = row.fixture
    ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
    : "Time TBC";

  const ScoreRow = ({
    team,
    score,
    isWinner,
  }: {
    team: string;
    score: number;
    isWinner: boolean;
  }) => {
    const colors = getTeamColors(team);

    return (
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[#1E1E2E] px-4 py-5 first:border-t-0 sm:px-6 sm:py-6">
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 h-[calc(100%-32px)] w-0.5 opacity-80"
          style={{ backgroundColor: colors.primary }}
        />
        <div className="flex min-w-0 items-center gap-4">
          <TeamLogo
            teamName={team}
            className={`h-10 w-10 shrink-0 sm:h-12 sm:w-12 ${isWinner ? "" : "opacity-70"}`}
          />
          <span
            className={`min-w-0 truncate text-2xl font-semibold uppercase tracking-tight sm:text-3xl md:text-4xl ${
              isWinner ? "text-white" : "text-[#9CA3AF]"
            }`}
          >
            {team}
          </span>
        </div>
        <div
          className={`min-w-[68px] border border-[#1E1E2E] bg-[#16161D] px-4 py-2 text-center text-3xl font-semibold leading-none tracking-tight sm:min-w-[80px] sm:text-4xl ${
            isWinner ? "text-white" : "text-[#9CA3AF]"
          }`}
        >
          {score}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-5">
      <HomeCard className="p-5 sm:p-6 md:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              {row.fixture?.stadium || "Venue TBC"}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#6B7280]">
              {fixtureMeta}
            </div>
          </div>

          <div className="overflow-hidden border border-[#1E1E2E] bg-[#0A0A0F]/40">
            <ScoreRow
              team={row.homeTeam}
              score={homeScore}
              isWinner={homeWinsProjection || homeScore === awayScore}
            />
            <ScoreRow
              team={row.awayTeam}
              score={awayScore}
              isWinner={awayWinsProjection || homeScore === awayScore}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                Win prob
              </div>
              <div className="text-xl font-semibold text-[#00E676]">
                {formatPercent(featuredWinPct, 2)}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                Model odds
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedModel ? selectedModel.toFixed(2) : "—"}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                Market odds
              </div>
              <div className="text-xl font-semibold text-white">
                {selectedOdds ? selectedOdds.toFixed(2) : "—"}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                Model edge
              </div>
              <div className={`text-xl font-semibold ${selectedEdgeClass}`}>
                {selectedEdgeLabel}
              </div>
            </div>
          </div>
        </div>
      </HomeCard>
      <button
        type="button"
        onClick={() => onRequestPremium("home_featured_match_premium_cta")}
        className="mt-3 w-full border border-[#1E1E2E] bg-[#08080C] p-1 text-left transition hover:border-white/25 hover:bg-[#111116]"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[#1E1E2E] bg-[#111116] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                Premium
              </span>
            </div>
            <div className="text-sm font-black uppercase tracking-wide text-white sm:text-base">
              Unlock best plays and try scorers
            </div>
          </div>
          <span className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 border border-white bg-white px-3 text-[10px] font-black uppercase tracking-widest text-[#0A0A0F] sm:px-4">
            Unlock
            <ArrowRight className="h-4 w-4 stroke-[3px]" />
          </span>
        </div>
      </button>
    </div>
  );
}

function ProbabilityPathModule() {
  return (
    <div className="relative h-56 overflow-hidden border border-[#1E1E2E] bg-[#0A0A0F] p-5">
      <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
        <span>Kickoff</span>
        <span>Simulated paths</span>
        <span>Final range</span>
      </div>
      <svg
        className="absolute inset-x-4 top-14 h-28 w-[calc(100%-32px)]"
        viewBox="0 0 320 120"
        role="img"
        aria-label="Simulation paths converging into a projected score distribution"
      >
        <defs>
          <linearGradient id="probability-path-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6B7280" stopOpacity="0.2" />
            <stop offset="65%" stopColor="#9CA3AF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#00E676" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {[
          "M12 60 C70 12 115 18 162 46 C205 72 244 76 305 51",
          "M12 60 C74 32 100 78 160 62 C210 48 242 30 305 51",
          "M12 60 C62 92 114 96 164 72 C208 52 250 59 305 51",
          "M12 60 C58 44 96 18 152 28 C210 38 250 44 305 51",
          "M12 60 C84 72 116 38 164 52 C210 66 246 70 305 51",
          "M12 60 C70 108 124 86 164 86 C218 86 250 62 305 51",
        ].map((path, index) => (
          <path
            key={path}
            d={path}
            className="rightedge-probability-path"
            style={{ animationDelay: `${index * 0.18}s` }}
            fill="none"
            stroke="url(#probability-path-gradient)"
            strokeLinecap="square"
            strokeWidth="1.4"
          />
        ))}
        <line x1="304" x2="304" y1="18" y2="98" stroke="#1E1E2E" strokeWidth="1" />
        {[32, 41, 49, 58, 70, 84].map((y, index) => (
          <circle
            key={y}
            className="rightedge-probability-dot"
            style={{ animationDelay: `${index * 0.16}s` }}
            cx="304"
            cy={y}
            r={index === 2 ? 4.5 : 2.5}
            fill={index === 2 ? "#00E676" : "#9CA3AF"}
            opacity={index === 2 ? 1 : 0.5}
          />
        ))}
      </svg>
      <div className="absolute inset-x-5 bottom-5">
        <div className="mb-3 flex h-20 items-end justify-center gap-1.5">
          {[18, 34, 55, 76, 96, 78, 52, 31, 16].map((height, index) => (
            <div
              key={`${height}-${index}`}
              className="rightedge-bell-bar w-full max-w-[18px] bg-white"
              style={{ height: `${height}%`, animationDelay: `${index * 0.08}s` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[#1E1E2E] pt-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
            Projected score
          </span>
          <span className="text-lg font-semibold text-white">24 - 21</span>
        </div>
      </div>
    </div>
  );
}

function MarketComparisonModule() {
  return (
    <div className="relative h-56 border border-[#1E1E2E] bg-[#0A0A0F] p-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
            Price comparison
          </div>
          <div className="mt-1 text-sm text-[#6B7280]">Market vs true price</div>
        </div>
        <div className="border border-[#1E1E2E] bg-[#16161D] px-3 py-2 text-right">
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
            Overlay
          </div>
          <div className="text-lg font-semibold text-[#00E676]">+8.9%</div>
        </div>
      </div>

      <div className="relative mt-8 h-16">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#1E1E2E]" />
        <div className="absolute left-[22%] top-1/2 h-8 w-px -translate-y-1/2 bg-[#6B7280]" />
        <div className="absolute left-[64%] top-1/2 h-8 w-px -translate-y-1/2 bg-[#00E676]" />
        <div className="rightedge-overlay-gap absolute left-[22%] right-[36%] top-1/2 h-1 -translate-y-1/2 bg-[#00E676]" />

        <div className="absolute left-[22%] top-0 -translate-x-1/2 border border-[#1E1E2E] bg-[#16161D] px-3 py-2">
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
            Bookmaker
          </div>
          <div className="text-xl font-semibold text-white">$1.80</div>
        </div>
        <div className="absolute left-[64%] bottom-0 -translate-x-1/2 border border-[#00E676]/60 bg-[#111116] px-3 py-2 shadow-[0_0_22px_rgba(0,230,118,0.14)]">
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#00E676]">
            RightEdge
          </div>
          <div className="text-xl font-semibold text-white">$1.55</div>
        </div>
      </div>

      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-end text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
        <span className="text-[#00E676]">Price gap lights up</span>
      </div>
    </div>
  );
}

function PremiumPlayTeaserModule() {
  return (
    <div className="relative h-56 overflow-hidden border border-[#1E1E2E] bg-[#0A0A0F] p-5">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 border border-[#1E1E2E] bg-[#111116] px-2.5 py-1.5">
        <Lock className="h-3.5 w-3.5 text-white" />
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
          Premium
        </span>
      </div>

      <div className="rightedge-premium-blur pointer-events-none select-none">
        <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
          Official model play
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-4 border border-[#1E1E2E] bg-[#111116] p-4">
          <div>
            <div className="text-2xl font-semibold uppercase tracking-tight text-white">
              Bulldogs -3.5
            </div>
            <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              Line · Model 58%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
              Market
            </div>
            <div className="text-2xl font-semibold text-white">$1.95</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {["Edge +7.2%", "Stake 1.4u", "CLV target"].map((item) => (
            <div key={item} className="border border-[#1E1E2E] bg-[#16161D] p-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0A0F]/35">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center border border-white bg-white text-[#0A0A0F]">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
            Premium play locked
          </div>
          <div className="max-w-[220px] text-xs leading-relaxed text-[#9CA3AF]">
            See the exact plays, prices and staking signals.
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodologyModuleCard({
  number,
  title,
  body,
  children,
}: {
  number: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <HomeCard className="p-5 sm:p-6">
      <h3 className="mb-3 text-sm font-semibold text-white uppercase tracking-[0.08em]">
        {number} / {title}
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-[#9CA3AF]">
        {body}
      </p>
      {children}
    </HomeCard>
  );
}

function HomeMethodology() {
  return (
    <div className="mt-8 mb-4" id="how-it-works">
      <div className="mb-6 px-2">
        <h2 className="text-3xl font-semibold text-white uppercase tracking-tight">
          How it works
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MethodologyModuleCard
          number="01"
          title="Data Simulation"
          body="We execute 10,000 algorithmic simulations per match—processing deep player metrics and historical data to establish true, un-biased win probabilities."
        >
          <ProbabilityPathModule />
        </MethodologyModuleCard>
        <MethodologyModuleCard
          number="02"
          title="Value Detection"
          body="The system automatically converts those probabilities into fair odds, instantly filtering the market to isolate bookmaker pricing inefficiencies."
        >
          <MarketComparisonModule />
        </MethodologyModuleCard>
        <MethodologyModuleCard
          number="03"
          title="Executing The Edge"
          body="When a market inefficiency crosses our strict value threshold, the system flags it as an active Premium Play. No gut feelings, just pure mathematical edge."
        >
          <PremiumPlayTeaserModule />
        </MethodologyModuleCard>
      </div>
    </div>
  );
}

function HomePage({
  data,
  onGoApp,
  onRequestPremium,
}: {
  data: DashboardData | null;
  onGoApp: (source: string) => void;
  onRequestPremium: (source: string) => void;
}) {
  const featured = getFeaturedPrediction(
    data?.predictions || [],
  );

  return (
    <div className="flex flex-col">
      <TryScorerTicker data={data} />
      <PublicHero />
      <HeroStickyCta onGoApp={onGoApp} />
      <div id="featured-match-section">
        <FeaturedMatchPreview
          row={featured}
          onRequestPremium={onRequestPremium}
        />
      </div>
      <HomeMethodology />
    </div>
  );
}
function ArticlesPage() {
  const articles = [
    {
      hash: "article-round-5-2026",
      tag: "PREDICTIONS",
      tagColor: "bg-[#16161D] border border-[#1E1E2E] text-[#9CA3AF]",
      title: "NRL Round 5 2026 — Model vs Market",
      excerpt: "Full model output for every Round 5 match. Projected scores, win probabilities, and identified edges across all eight games.",
      date: "April 2026",
    },
    {
      hash: "article-methodology",
      tag: "METHODOLOGY",
      tagColor: "bg-[#16161D] border border-[#1E1E2E] text-[#9CA3AF]",
      title: "How the RightEdge Model Works",
      excerpt: "A deep dive into how we simulate every NRL match, calculate true win probabilities, and identify where bookmakers are mispricing the market.",
      date: "April 2026",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <GlassCard className="p-8">
        <h1 className="text-4xl font-semibold text-white uppercase tracking-tight mb-2">
          Articles
        </h1>
        <p className="text-[#9CA3AF] font-medium uppercase tracking-widest text-sm">
          Model insights, methodology and round previews
        </p>
      </GlassCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((article) => (
          <div
            key={article.hash}
            onClick={() => { window.location.hash = article.hash; }}
            className="bg-[#111116] border border-[#1E1E2E] p-8 cursor-pointer hover:bg-[#16161D] transition"
          >
            <div className={`inline-flex px-3 py-1 text-xs font-medium uppercase tracking-widest mb-4 ${article.tagColor}`}>
              {article.tag}
            </div>
            <h2 className="text-xl font-semibold text-white uppercase tracking-tight mb-3">
              {article.title}
            </h2>
            <p className="text-[#9CA3AF] font-normal text-sm leading-relaxed mb-6">
              {article.excerpt}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280] text-xs font-medium uppercase tracking-widest">
                {article.date}
              </span>
              <span className="text-white text-xs font-medium uppercase tracking-widest flex items-center gap-1">
                Read <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodologyPage() {
  const blocks = [
    {
      title: "1. Model Probability",
      text: "Each matchup is assigned a model-based probability and converted into fair odds.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
    {
      title: "2. Market Comparison",
      text: "Market prices are pulled alongside model odds so edges can be evaluated in real time.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
    {
      title: "3. Value Detection",
      text: "A value edge exists when the market offers a better price than the model implies.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
    {
      title: "4. Official Play Filter",
      text: "Not every lean becomes an official play. The product should clearly separate interest from action.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
    {
      title: "5. Staking Discipline",
      text: "Stake sizing uses Kelly-derived logic with a conservative fractional cap.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
    {
      title: "6. Performance Measurement",
      text: "Track realised profit, ROI, bankroll curve and CLV to judge whether the edge is real.",
      color: "text-white",
      borderColor: "border-[#1E1E2E]",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <GlassCard className="p-8 md:p-12">
        <div className="inline-flex items-center gap-2 bg-[#16161D] border border-[#1E1E2E] px-4 py-2 text-sm font-medium text-[#9CA3AF] mb-6 uppercase tracking-widest">
          <Info className="w-4 h-4" />
          How RightEdge Works
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight mb-4 sm:mb-6 uppercase">
          Mathematical precision over gut instinct.
        </h2>
        <div className="text-[#9CA3AF] font-normal leading-relaxed text-sm sm:text-base md:text-lg max-w-[840px]">
          <ReadMore>
            RightEdge is an analytics service that provides
            serious NRL bettors with the data needed to make
            informed decisions. We don't guess the winner; we
            calculate the true probability of every outcome. By
            comparing our proprietary model's odds against the
            bookmakers' prices, we identify positive expected
            value (EV) and share these exact "edges" alongside
            strict staking advice with our members.
          </ReadMore>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {blocks.map((block) => (
          <GlassCard
            key={block.title}
            className={`p-8 ${block.borderColor}`}
          >
            <div
              className={`text-xl font-semibold mb-4 uppercase tracking-tight ${block.color}`}
            >
              {block.title}
            </div>
            <div className="text-[#9CA3AF] font-normal text-base leading-7">
              {block.text}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-8">
        <SectionHeader
          title="Transparency checklist"
          subtitle="These are the trust markers the public product should show over time"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            "Timestamped picks",
            "Public results page",
            "Closing line value tracking",
            "Separate leans from official plays",
            "Bankroll curve and drawdown",
            "Clear responsible gambling notice",
          ].map((item) => (
            <div
              key={item}
              className="bg-[#16161D] p-6 flex items-center gap-4 text-white font-medium uppercase tracking-wider text-sm border border-[#1E1E2E]"
            >
              <BadgeCheck className="w-6 h-6 text-white" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function ResultsPage({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-8">
      <GlassCard className="p-4 md:p-8 overflow-hidden border-l-4 border-l-[#0047FF]">
        <SectionHeader
          title="Bet log"
          subtitle="Placed, settled and pending official tracked history"
        />

        {/* CLV methodology note */}
        <div className="flex items-start gap-2.5 bg-[#0047FF]/8 border border-[#0047FF]/25 px-4 py-3 mb-6 text-xs font-mono text-white/50 leading-relaxed">
          <span className="text-[#0047FF] font-black shrink-0 mt-px">ℹ</span>
          <span><span className="text-white/70 font-bold">CLV note —</span> Closing Line Value is measured against the closing price from the same bookmaker and market where the bet was placed.</span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1160px]">
            <thead>
              <tr className="border-b-2 border-white/10">
                {[
                  "Round",
                  "Match",
                  "Selection",
                  "Odds Taken",
                  "Stake",
                  "Result",
                  "Profit",
                  "Closing Odds",
                  "CLV",
                ].map((h) => (
                  <th
                    key={h}
                    className="pb-4 px-4 font-black text-white/50 uppercase tracking-widest text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.betLog.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-6 px-4 text-sm font-bold text-white/70">
                    {row.round}
                  </td>
                  <td className="py-6 px-4 text-sm font-black text-white">
                    {row.match}
                  </td>
                  <td className="py-6 px-4 text-sm text-[#FFEA00] font-black uppercase tracking-wider">
                    {row.selection}
                  </td>
                  <td className="py-6 px-4 text-sm font-bold text-white/75">
                    {(row.oddsTaken || row.marketOdds || 0).toFixed(2)}
                  </td>
                  <td className="py-6 px-4 text-sm font-bold text-white/75">
                    {formatCurrency(row.stake, 0)}
                  </td>
                  <td className="py-6 px-4">
                    <ResultPill result={row.result} />
                  </td>
                  <td
                    className={`py-6 px-4 text-sm font-black ${
                      row.result === "P"
                        ? "text-white/45"
                        : row.profit >= 0
                        ? "text-[#00E676]"
                        : "text-[#FF2E63]"
                    }`}
                  >
                    {row.result === "P"
                      ? "Pending"
                      : formatSignedCurrency(row.profit, 2)}
                  </td>
                  <td className="py-6 px-4 text-sm font-bold text-white/60">
                    {row.closingOdds ? row.closingOdds.toFixed(2) : "—"}
                  </td>
                  <td className="py-6 px-4 text-sm font-black text-[#0047FF]">
                    {row.result === "P"
                      ? "—"
                      : formatPercent(row.clv, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-4">
          {data.betLog.map((row, i) => (
            <div
              key={i}
              className="bg-[#1E232B] border-2 border-white/10 p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[10px] uppercase font-black text-white/50 tracking-widest mb-1">
                    Round {row.round}
                  </div>
                  <div className="text-lg font-black text-white leading-none mb-1">
                    {row.match}
                  </div>
                  <div className="text-sm font-black text-[#FFEA00] uppercase tracking-wider">
                    {row.selection}
                  </div>
                </div>
                <ResultPill result={row.result} />
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-white/10 mb-4">
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/50 mb-1">
                    Odds Taken
                  </div>
                  <div className="text-lg font-black text-white">
                    {(row.oddsTaken || row.marketOdds || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/50 mb-1">
                    Stake
                  </div>
                  <div className="text-lg font-black text-white">
                    {formatCurrency(row.stake, 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/50 mb-1">
                    Profit
                  </div>
                  <div
                    className={`text-sm font-black ${
                      row.result === "P"
                        ? "text-white/45"
                        : row.profit >= 0
                        ? "text-[#00E676]"
                        : "text-[#FF2E63]"
                    }`}
                  >
                    {row.result === "P"
                      ? "Pending"
                      : formatSignedCurrency(row.profit, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/50 mb-1">
                    Close Odds
                  </div>
                  <div className="text-sm font-black text-white/80">
                    {row.closingOdds ? row.closingOdds.toFixed(2) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/50 mb-1">
                    CLV
                  </div>
                  <div className="text-sm font-black text-[#0047FF]">
                    {row.result === "P"
                      ? "0.00%"
                      : formatPercent(row.clv, 2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
function OverviewPage({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        <div className="col-span-2 lg:col-span-1 border-2 border-[#FFEA00] shadow-[2px_2px_0_0_#FFEA00] md:shadow-[4px_4px_0_0_#FFEA00] relative overflow-hidden min-h-[120px] md:min-h-[170px] bg-[#111317]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,234,0,0.1),transparent_50%)]" />
          <div className="absolute top-0 right-0 p-4 opacity-[0.2]">
            <Wallet className="w-16 h-16 md:w-24 md:h-24 text-[#FFEA00]" />
          </div>
          <div className="relative z-10 p-4 md:p-6 flex flex-col justify-between h-full">
            <div>
              <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#FFEA00] font-black mb-1 md:mb-2">
                Total bankroll
              </div>
              <div className="text-2xl md:text-4xl font-black tracking-tight mb-2 md:mb-3 text-white">
                {formatCurrency(data.currentBankroll, 0)}
              </div>
              <div className="text-[10px] md:text-sm text-black font-black bg-[#FFEA00] inline-block px-2 py-1 md:px-3 uppercase tracking-widest">
                Start: {formatCurrency(STARTING_BANKROLL, 0)}
              </div>
            </div>
          </div>
        </div>

        <MetricCard
          label="Return"
          value={formatPercent(
            ((data.currentBankroll - STARTING_BANKROLL) /
              STARTING_BANKROLL) *
              100,
            2,
          )}
          subtext={
            <span className="text-[#00E676] font-black inline-flex items-center gap-1 md:gap-2">
              <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 stroke-[3px]" />
              ROI on base
            </span>
          }
          icon={<Percent className="w-4 h-4 md:w-5 md:h-5" />}
          accent="green"
        />

        <MetricCard
          label="Average CLV"
          value={formatPercent(data.avgClv, 2)}
          subtext={
            <span className="text-[#FFEA00] font-black inline-flex items-center gap-1 md:gap-2">
              <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 stroke-[3px]" />
              Beat closing {data.beatClosingCount}/
              {data.settledBets || 0}
            </span>
          }
          icon={<Target className="w-4 h-4 md:w-5 md:h-5" />}
          accent="gold"
        />

        <MetricCard
          label="Profit on turnover"
          value={formatPercent(data.pot, 2)}
          subtext={`From ${formatCurrency(data.totalStakedSettled, 0)} settled staked`}
          icon={<LineChart className="w-4 h-4 md:w-5 md:h-5" />}
          accent="blue"
        />

        <MetricCard
          label="Bets executed"
          value={String(data.betLog.length)}
          subtext={`${data.wins}W / ${data.losses}L / ${data.pendingBets}P`}
          icon={<Activity className="w-4 h-4 md:w-5 md:h-5" />}
          accent="neutral"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        <GlassCard className="p-4 md:p-8 border-l-4 border-l-[#FFEA00]">
          <SectionHeader
            title="Equity curve"
            subtitle="Bankroll progression across settled bets"
          />
          <div className="h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.bankrollData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="bet"
                  tick={{
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                  width={60}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatCurrency(Number(value), 2),
                    "Bankroll",
                  ]}
                  contentStyle={{
                    background: "#16161D",
                    border: "1px solid #1E1E2E",
                    borderRadius: "0px",
                    color: "#FFFFFF",
                    fontWeight: "500",
                    boxShadow: "none",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill="rgba(255,255,255,0.06)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 md:p-8 border-l-4 border-l-[#00E676]">
          <SectionHeader
            title="CLV distribution"
            subtitle="Closing line value by settled selections"
          />
          <div className="h-[250px] md:h-[300px] pr-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.clvData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="id"
                  tickFormatter={(val) => val.split("-")[0]}
                  tick={{
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  labelFormatter={(val: string) =>
                    val ? val.split("-")[0] : ""
                  }
                  formatter={(value: any) => [
                    formatPercent(Number(value), 2),
                    "CLV",
                  ]}
                  contentStyle={{
                    background: "#16161D",
                    border: "1px solid #1E1E2E",
                    borderRadius: "0px",
                    color: "#FFFFFF",
                    fontWeight: "500",
                    boxShadow: "none",
                  }}
                />
                <Bar dataKey="clv" radius={[0, 0, 0, 0]}>
                  {data.clvData.map((_, idx) => (
                    <Cell
                      key={`clv-${idx}`}
                      fill={idx === 0 ? "#00E676" : "#9CA3AF"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function RoundCentrePage({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {data.rounds.map((row) => (
          <GlassCard
            key={row.round}
            className="p-4 md:p-8 relative overflow-hidden border-l-4 border-l-[#0047FF]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,71,255,0.1),transparent_45%)]" />
            <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 md:mb-8 relative z-10 gap-4">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-black mb-1 md:mb-2">
                  {row.round}
                </div>
                <div className="text-2xl md:text-4xl font-black text-white mb-1 md:mb-2 uppercase">
                  {row.status}
                </div>
                <div className="text-xs md:text-sm font-bold text-[#FFEA00] uppercase tracking-widest">
                  {row.bets} tracked bets •{" "}
                  {formatCurrency(row.staked, 0)} staked
                </div>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-black uppercase tracking-widest border-2 self-start ${
                  row.status === "Settled"
                    ? "bg-[#00E676] text-black border-[#00E676]"
                    : "bg-[#1E232B] text-white border-white/10"
                }`}
              >
                {row.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-4 relative z-10 border-t-2 border-white/10 pt-4 md:pt-6">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1 md:mb-2">
                  Round PnL
                </div>
                <div
                  className={`text-lg md:text-2xl font-black ${row.pnl >= 0 ? "text-[#00E676]" : "text-[#FF2E63]"}`}
                >
                  {formatSignedCurrency(row.pnl, 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1 md:mb-2">
                  Round ROI
                </div>
                <div className="text-lg md:text-2xl font-black text-white">
                  {formatPercent(row.roi, 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1 md:mb-2">
                  Avg CLV
                </div>
                <div className="text-lg md:text-2xl font-black text-[#0047FF]">
                  {formatPercent(row.clv, 2)}
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function PredictionsPage({
  data,
  onRequestAccess,
  isPremium,
  isAdmin = false,
  selectedArchive,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
  isPremium: boolean;
  isAdmin?: boolean;
  selectedArchive?: RoundArchive | null;
}) {
  const now = useMinuteNow();
  const rows = useMemo(
    () => selectedArchive
      ? buildArchivedPredictionRows(selectedArchive).sort(sortPredictionsByFixture)
      : [...data.predictions].sort(sortPredictionsByFixture),
    [data.predictions, selectedArchive],
  );
  const [marketMap, setMarketMap] = useState<SgmMarketMap>({});
  // Freeze + results data for the live page (disabled in archive view).
  const frozen = useFrozenRoundData(data, marketMap, now, {
    enableFreeze: !selectedArchive,
  });

  useEffect(() => {
    if (selectedArchive) {
      setMarketMap({});
      return;
    }

    let isMounted = true;

    fetchLiveOddsCached()
      .then((rawOdds) => {
        if (!isMounted) return;
        setMarketMap(buildSgmMarketMap(rawOdds));
      })
      .catch(() => {
        if (!isMounted) return;
        setMarketMap({});
      });

    return () => {
      isMounted = false;
    };
  }, [selectedArchive]);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <ResponsibleGamblingNotice />

      {selectedArchive && (
        <GlassCard className="p-4 md:p-5 border-l-4 border-l-[#00E676]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                Previous round results
              </div>
              <div className="mt-1 text-lg md:text-2xl font-black uppercase tracking-tight text-white">
                {selectedArchive.label}
              </div>
            </div>
            <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white/45">
              {selectedArchive.matchPlays.filter((play) => play.result === "Hit").length}/{selectedArchive.matchPlays.length} match plays hit
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {rows.map((row, i) => {
          const projectedHomeScore = row.predictedHomeScore
            ? Math.round(row.predictedHomeScore)
            : null;
          const projectedAwayScore = row.predictedAwayScore
            ? Math.round(row.predictedAwayScore)
            : null;
          const predictedWinnerKey = normalizeTeamName(row.predictedWinner);
          const homeIsPredictedWinner =
            predictedWinnerKey === normalizeTeamName(row.homeTeam);
          const awayIsPredictedWinner =
            predictedWinnerKey === normalizeTeamName(row.awayTeam);
          const hasPredictedWinner = homeIsPredictedWinner || awayIsPredictedWinner;
          const homeColors = getTeamColors(row.homeTeam);
          const awayColors = getTeamColors(row.awayTeam);
          const matchPairKey = getPredictionPairKey(row);
          const frozenSnapshot = selectedArchive ? undefined : frozen.snapshotByKey.get(matchPairKey);
          const savedResult = selectedArchive ? null : frozen.resultByKey.get(matchPairKey) || null;
          const rowKickedOff = !selectedArchive && hasPredictionKickedOff(row, now);
          const livePlay = selectedArchive ? null : getBestPremiumMarketPlayForMatch(row, marketMap);
          // After kickoff the live odds stop feeding — render the frozen play so
          // the strip keeps its kickoff values instead of vanishing.
          const premiumMarketPlay =
            !livePlay && rowKickedOff && frozenSnapshot
              ? reconstructFrozenPlay(frozenSnapshot, row)
              : livePlay;
          const settledPremiumBet = selectedArchive ? null : getSettledBetForPrediction(data, row);
          const liveTryScorerSignals = selectedArchive ? [] : getTryScorerSignalsForPrediction(data, row);
          // Frozen try scorers fill in if the live sheet signals dropped out.
          const tryScorerSignals =
            liveTryScorerSignals.length === 0 && rowKickedOff && frozenSnapshot
              ? (frozenSnapshot.payload.tryScorers || []).map((ts) => ({
                  row: {
                    round: frozenSnapshot.round,
                    match: frozenSnapshot.payload.fixture?.match || frozenSnapshot.match,
                    player: ts.player,
                    team: ts.team,
                    position: ts.position || "",
                    statsInsiderPct: 0,
                    bestOdds: ts.odds,
                    bookmaker: ts.bookmaker,
                    marketImpliedPct: 0,
                    edgePct: 0,
                    value: "",
                  } as TryScorerRow,
                  signal: null as ReturnType<typeof getTryScorerSignal>,
                }))
              : liveTryScorerSignals;
          const frozenScorerList: FrozenTryScorer[] =
            frozenSnapshot?.payload.tryScorers ??
            liveTryScorerSignals.map(({ row: ts }) => ({
              player: ts.player,
              team: ts.team,
              position: ts.position,
              odds: ts.bestOdds,
              bookmaker: ts.bookmaker,
            }));
          const proofMatchPlays = getRoundProofMatchPlaysForPrediction(row, selectedArchive);
          const proofTryScorerHits = getRoundProofTryScorerHitsForPrediction(row, selectedArchive);
          const proofFinalScore = proofMatchPlays.find((play) => play.finalScore)?.finalScore || "";
          const proofFinalScorePair = proofFinalScore ? parseScorePair(proofFinalScore) : null;
          // An admin-entered result (final score or HIT/MISS/PUSH) settles the card
          // immediately, even before the fixture's scheduled completion — so dummy
          // results entered in the Results tab render the settled view right away.
          const hasSavedSettlement = Boolean(
            savedResult &&
              ((savedResult.finalHome != null && savedResult.finalAway != null) ||
                savedResult.playResult),
          );
          const savedFinalScorePair =
            savedResult && savedResult.finalHome != null && savedResult.finalAway != null
              ? { homeScore: savedResult.finalHome, awayScore: savedResult.finalAway }
              : null;
          const displayHomeScore = proofFinalScorePair
            ? proofFinalScorePair.homeScore
            : savedFinalScorePair
              ? savedFinalScorePair.homeScore
              : projectedHomeScore;
          const displayAwayScore = proofFinalScorePair
            ? proofFinalScorePair.awayScore
            : savedFinalScorePair
              ? savedFinalScorePair.awayScore
              : projectedAwayScore;
          const matchCompleted = Boolean(selectedArchive) || isFixtureCompleted(row.fixture, now) || hasSettledRoundProofForPrediction(row, selectedArchive) || hasSavedSettlement;
          const fixtureStatus = matchCompleted
            ? {
                label: "Completed",
                className: "border-white/10 bg-white/[0.04] text-white/35",
              }
            : getFixtureStatusBadge(row.fixture, now);

          if (matchCompleted) {
            return (
              <GlassCard
                key={i}
                className="p-3 md:p-4 relative overflow-hidden border-l-4 border-l-white/15"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] md:text-[10px] uppercase font-medium tracking-widest text-[#6B7280]">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span>
                        {row.fixture
                          ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
                          : "TBC"}
                      </span>
                      <span className={`inline-flex shrink-0 border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${fixtureStatus.className}`}>
                        {fixtureStatus.label}
                      </span>
                    </div>
                    <span className="truncate">
                      {row.fixture?.stadium || "Venue TBC"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(56px,auto)] items-center gap-2 overflow-hidden border border-[#1E1E2E] bg-[#111116] px-2.5 py-2">
                      <span
                        className="absolute left-0 top-0 h-full w-1"
                        style={{ backgroundColor: homeColors.secondary }}
                      />
                      <div className="flex min-w-0 items-center gap-2 pl-1">
                        <TeamLogo teamName={row.homeTeam} className="h-7 w-7 rounded-sm" />
                        <span className={`min-w-0 truncate text-sm md:text-base font-black uppercase tracking-tight ${
                          hasPredictedWinner && !homeIsPredictedWinner ? "text-white/50" : "text-white"
                        }`}>
                          {row.homeTeam}
                        </span>
                      </div>
                      <div className={`border border-[#1E1E2E] bg-[#16161D] px-2 py-1 text-center text-lg md:text-xl font-black tabular-nums ${
                        hasPredictedWinner && !homeIsPredictedWinner ? "text-white/50" : "text-white"
                      }`}>
                        {displayHomeScore ?? "—"}
                      </div>
                    </div>

                    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(56px,auto)] items-center gap-2 overflow-hidden border border-[#1E1E2E] bg-[#111116] px-2.5 py-2">
                      <span
                        className="absolute left-0 top-0 h-full w-1"
                        style={{ backgroundColor: awayColors.secondary }}
                      />
                      <div className="flex min-w-0 items-center gap-2 pl-1">
                        <TeamLogo teamName={row.awayTeam} className="h-7 w-7 rounded-sm" />
                        <span className={`min-w-0 truncate text-sm md:text-base font-black uppercase tracking-tight ${
                          hasPredictedWinner && !awayIsPredictedWinner ? "text-white/50" : "text-white"
                        }`}>
                          {row.awayTeam}
                        </span>
                      </div>
                      <div className={`border border-[#1E1E2E] bg-[#16161D] px-2 py-1 text-center text-lg md:text-xl font-black tabular-nums ${
                        hasPredictedWinner && !awayIsPredictedWinner ? "text-white/50" : "text-white"
                      }`}>
                        {displayAwayScore ?? "—"}
                      </div>
                    </div>
                  </div>
                  {(matchCompleted || isPremium) && (
                    <MatchPremiumSignalStrip
                      matchCompleted={matchCompleted}
                      isPremium={isPremium}
                      play={premiumMarketPlay}
                      settledBet={settledPremiumBet}
                      tryScorerSignals={tryScorerSignals}
                      proofMatchPlays={proofMatchPlays}
                      proofTryScorerHits={proofTryScorerHits}
                      matchLabel={`${row.homeTeam} v ${row.awayTeam}`}
                      savedResult={savedResult}
                      frozenTryScorers={frozenScorerList}
                    />
                  )}
                </div>
              </GlassCard>
            );
          }

          return (
            <GlassCard
              key={i}
              className="p-0 relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="p-5 md:p-6">
                <div className="overflow-hidden border border-[#1E1E2E] bg-[#111116]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E1E2E] bg-[#16161D] px-3 py-2 text-[10px] uppercase font-medium text-[#9CA3AF] tracking-widest">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span>
                        {row.fixture
                          ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
                          : "TBC"}
                      </span>
                      <span className={`inline-flex shrink-0 border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${fixtureStatus.className}`}>
                        {fixtureStatus.label}
                      </span>
                    </div>
                    <span className="text-[#6B7280]">
                      {row.fixture?.stadium || "Venue TBC"}
                    </span>
                  </div>
                  <div className="p-3 md:p-4">
                    <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(74px,auto)] items-center gap-2 border-b border-[#1E1E2E] pb-2">
                      <div className="text-[9px] md:text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
                        Teams
                      </div>
                      <div className="text-right text-[9px] md:text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF] whitespace-nowrap">
                        Proj score
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(74px,auto)] items-center gap-2 overflow-hidden bg-[#111116] border border-[#1E1E2E] p-2.5">
                        <span
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ backgroundColor: homeColors.secondary }}
                        />
                        <div className="flex min-w-0 items-center gap-2.5 pl-1">
                          <TeamLogo
                            teamName={row.homeTeam}
                            className="w-9 h-9 rounded-sm"
                          />
                          <span
                            className={`min-w-0 text-lg md:text-2xl font-black uppercase tracking-tight truncate ${
                              hasPredictedWinner && !homeIsPredictedWinner
                                ? "text-white/50"
                                : "text-white"
                            }`}
                          >
                            {row.homeTeam}
                          </span>
                        </div>
                        <div
                          className={`border border-[#1E1E2E] bg-[#16161D] px-2 py-1.5 text-center text-2xl md:text-3xl font-black tabular-nums ${
                            hasPredictedWinner && !homeIsPredictedWinner
                                ? "text-white/50"
                                : "text-white"
                          }`}
                        >
                          {projectedHomeScore ?? "—"}
                        </div>
                      </div>
                      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(74px,auto)] items-center gap-2 overflow-hidden bg-[#111116] border border-[#1E1E2E] p-2.5">
                        <span
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ backgroundColor: awayColors.secondary }}
                        />
                        <div className="flex min-w-0 items-center gap-2.5 pl-1">
                          <TeamLogo
                            teamName={row.awayTeam}
                            className="w-9 h-9 rounded-sm"
                          />
                          <span
                            className={`min-w-0 text-lg md:text-2xl font-black uppercase tracking-tight truncate ${
                              hasPredictedWinner && !awayIsPredictedWinner
                                ? "text-white/50"
                                : "text-white"
                            }`}
                          >
                            {row.awayTeam}
                          </span>
                        </div>
                        <div
                          className={`border border-[#1E1E2E] bg-[#16161D] px-2 py-1.5 text-center text-2xl md:text-3xl font-black tabular-nums ${
                            hasPredictedWinner && !awayIsPredictedWinner
                                ? "text-white/50"
                                : "text-white"
                          }`}
                        >
                          {projectedAwayScore ?? "—"}
                        </div>
                      </div>
                    </div>
                    {(matchCompleted || isPremium) && (
                      <MatchPremiumSignalStrip
                        matchCompleted={matchCompleted}
                        isPremium={isPremium}
                        play={premiumMarketPlay}
                        settledBet={settledPremiumBet}
                        tryScorerSignals={tryScorerSignals}
                        proofMatchPlays={proofMatchPlays}
                        proofTryScorerHits={proofTryScorerHits}
                        matchLabel={`${row.homeTeam} v ${row.awayTeam}`}
                        savedResult={savedResult}
                        frozenTryScorers={frozenScorerList}
                      />
                    )}
                    {!matchCompleted && !isPremium && (
                      <UpcomingPremiumUnlockCta onRequestAccess={onRequestAccess} />
                    )}
                    <FreeBetrMarketsPanel
                      row={row}
                      isPremium={isPremium}
                      onRequestAccess={onRequestAccess}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

type PremiumMarketPlay = {
  id: string;
  row: PredictionRow;
  type: "Line" | "Total" | "Head 2 Head";
  selection: string;
  bookmaker: string;
  odds: number;
  modelPct: number;
  modelEdge: number;
  marketPoint?: number;
  projectedValue?: number;
};

function getProofResultClass(result: ProofResult) {
  if (result === "Hit") return "border-[#00E676]/45 bg-[#00E676]/12 text-[#00E676]";
  if (result === "Miss") return "border-[#FF2E63]/45 bg-[#FF2E63]/12 text-[#FF2E63]";
  if (result === "Pending") return "border-[#FFEA00]/45 bg-[#FFEA00]/12 text-[#FFEA00]";
  return "border-white/15 bg-white/[0.04] text-white/45";
}

function getProofMarketLabel(market: RoundProofMatchPlay["market"] | PremiumMarketPlay["type"]) {
  if (market === "Head 2 Head") return "H2H";
  if (market === "Line") return "Line";
  return "Total";
}

function MatchPremiumSignalStrip({
  matchCompleted,
  isPremium,
  play,
  settledBet,
  tryScorerSignals,
  proofMatchPlays = [],
  proofTryScorerHits = [],
  matchLabel,
  savedResult,
  frozenTryScorers,
}: {
  matchCompleted: boolean;
  isPremium: boolean;
  play?: PremiumMarketPlay | null;
  settledBet?: BetLogRow | null;
  tryScorerSignals: { row: TryScorerRow; signal: ReturnType<typeof getTryScorerSignal> }[];
  proofMatchPlays?: RoundProofMatchPlay[];
  proofTryScorerHits?: RoundProofTryScorer[];
  matchLabel?: string;
  savedResult?: SavedRoundResult | null;
  frozenTryScorers?: FrozenTryScorer[];
}) {
  // Settled try-scorer hits entered by an admin in the Results tab are synthesized
  // into the same proof shape so they render exactly like a hardcoded archive's
  // try-scorer hits, when no hardcoded proof exists for this match.
  const savedTryScorerProofHits: RoundProofTryScorer[] =
    !proofTryScorerHits.length && savedResult?.tryScorerHits && frozenTryScorers?.length
      ? frozenTryScorers
          .filter((ts) => savedResult.tryScorerHits[normalizeTryScorerPlayerKey(ts.player)])
          .map((ts) => ({
            match: matchLabel || ts.team,
            player: ts.player,
            team: ts.team,
            odds: ts.odds,
            bookmaker: ts.bookmaker,
            result: "Hit" as const,
            note: "",
          }))
      : [];
  const tryScorerProofHits = proofTryScorerHits.length
    ? proofTryScorerHits
    : savedTryScorerProofHits;
  const savedFinalScoreLine =
    savedResult && savedResult.finalHome != null && savedResult.finalAway != null ? (
      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/55">
        Final {savedResult.finalHome}–{savedResult.finalAway}
      </div>
    ) : null;
  const savedPlayProof = playResultToProof(savedResult?.playResult ?? null);

  const hasTryScorers = tryScorerSignals.length > 0;
  const scorerLabel = hasTryScorers
    ? tryScorerSignals.map(({ row }) => row.player).join(" / ")
    : "Try scorer signals";
  const proofMatchPlay = proofMatchPlays[0] || null;
  const proofMatchPlaySelection = proofMatchPlay?.selection
    .replace(/\bhead-to-head\b/i, "H2H")
    .trim();
  const matchPlayLabel = proofMatchPlay
    ? `${proofMatchPlaySelection}${proofMatchPlay.odds ? ` @ $${proofMatchPlay.odds.toFixed(2)}` : ""}`.trim()
    : settledBet
      ? `${settledBet.selection || settledBet.side || "Premium play"} ${settledBet.oddsTaken ? `@ $${settledBet.oddsTaken.toFixed(2)}` : ""}`.trim()
      : play
        ? `${play.selection} ${play.odds ? `@ $${play.odds.toFixed(2)}` : ""}`.trim()
        : "Premium match play";

  if (matchCompleted) {
    const fallbackMatchPlay = settledBet
      ? [{
          match: settledBet.match,
          selection: settledBet.selection || settledBet.side || "Premium play",
          market: "Head 2 Head" as const,
          modelScore: "",
          finalScore: "",
          odds: settledBet.oddsTaken,
          bookmaker: "Model",
          result: settledBet.result === "W" ? "Hit" as const : settledBet.result === "L" ? "Miss" as const : "Pending" as const,
          note: "",
        }]
      : [];
    // If an admin has saved a result for this match (but no hardcoded proof
    // exists), synthesize a settled play from the frozen snapshot + result so
    // the completed card shows the final score + HIT/MISS badge.
    const savedResultMatchPlay =
      !proofMatchPlays.length && savedResult && play
        ? [{
            match: matchLabel || play.selection,
            selection: play.selection,
            market: play.type,
            modelScore:
              play.row.predictedHomeScore || play.row.predictedAwayScore
                ? `${Math.round(play.row.predictedHomeScore)}-${Math.round(play.row.predictedAwayScore)}`
                : "",
            finalScore:
              savedResult.finalHome != null && savedResult.finalAway != null
                ? `${savedResult.finalHome}-${savedResult.finalAway}`
                : "",
            odds: play.odds,
            bookmaker: play.bookmaker,
            result: savedPlayProof || "Pending",
            note: "",
          } as RoundProofMatchPlay]
        : [];
    const matchPlays = proofMatchPlays.length
      ? proofMatchPlays
      : savedResultMatchPlay.length
        ? savedResultMatchPlay
        : fallbackMatchPlay;

    if (!matchPlays.length && !tryScorerProofHits.length) return null;

    return (
      <div className="mt-3 flex flex-col gap-2">
        {matchPlays.map((proof) => (
          <div
            key={`${proof.match}-${proof.selection}`}
            className="border border-[#1E1E2E] bg-[#111116] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#6B7280]">
                    {getProofMarketLabel(proof.market)}
                  </span>
                </div>
                <div className="truncate text-xs md:text-sm font-black uppercase tracking-wide text-white">
                  {proof.selection}
                </div>
                {(proof.finalScore || proof.modelScore) && (
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">
                    {proof.modelScore && `Model ${proof.modelScore}`}
                    {proof.modelScore && proof.finalScore && " · "}
                    {proof.finalScore && `Final ${proof.finalScore}`}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${getProofResultClass(proof.result)}`}>
                  {proof.result}
                </span>
                {proof.odds > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                    ${proof.odds.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {tryScorerProofHits.length > 0 && (
          <div className="border border-[#1E1E2E] bg-[#111116] px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#6B7280]">
                Try scorers
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tryScorerProofHits.map((scorer) => (
                <span
                  key={`${scorer.match}-${scorer.player}`}
                  className="inline-flex max-w-full items-center gap-1.5 border border-[#00E676]/30 bg-[#00E676]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#00E676]"
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{scorer.player}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!matchCompleted && !isPremium) {
    return null;
  }

  return (
    <div className="mt-3 border border-[#1E1E2E] bg-[#08080C] p-1">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <div className="min-w-0 border border-[#1E1E2E] bg-[#111116] px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            <span className="text-[8px] font-black uppercase tracking-widest text-[#6B7280]">
              Play
            </span>
          </div>
          <div className="truncate text-xs font-black uppercase text-white">
            {matchPlayLabel}
          </div>
        </div>
        <div className="min-w-0 border border-[#1E1E2E] bg-[#111116] px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-[#6B7280]">
              Try scorers
            </span>
          </div>
          <div className="truncate text-xs font-black uppercase text-white">
            {scorerLabel}
          </div>
        </div>
      </div>
      {isPremium && !play && !hasTryScorers && (
        <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#6B7280]">
          Premium signals will appear as markets settle.
        </div>
      )}
      {savedPlayProof && (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {savedFinalScoreLine}
          <PremiumResultBadge result={savedPlayProof} />
        </div>
      )}
    </div>
  );
}

function UpcomingPremiumUnlockCta({
  onRequestAccess,
}: {
  onRequestAccess: (targetHash?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onRequestAccess("best-bets")}
      className="mt-3 w-full border border-[#1E1E2E] border-l-2 border-l-[#00E676] bg-[#111116] text-left transition hover:bg-[#16161D]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#00E676]" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">
              Premium best plays
            </span>
          </div>
          <div className="truncate text-xs md:text-sm font-black uppercase tracking-wide text-white">
            Match play + try scorers locked
          </div>
        </div>
        <span className="inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1.5 bg-[#00E676] px-4 text-[9px] font-black uppercase tracking-widest text-white">
          Unlock
          <ArrowRight className="h-3.5 w-3.5 stroke-[3px]" />
        </span>
      </div>
    </button>
  );
}

function PremiumResultBadge({ result }: { result?: ProofResult }) {
  if (result !== "Hit" && result !== "Miss") return null;
  return (
    <span className={`inline-flex shrink-0 border px-2.5 py-1 text-[8px] md:text-[10px] font-black uppercase tracking-widest ${getProofResultClass(result)}`}>
      {result}
    </span>
  );
}

function probabilityFromEdge(edge: number, scale = 7.5) {
  return Math.max(1, Math.min(99, (1 / (1 + Math.exp(-(edge / scale)))) * 100));
}

/**
 * RIGHTEDGE_TUNING — single source of truth for best-bet selection.
 *
 * IMPORTANT: For lines and totals, "modelPct" is NOT a real win probability.
 * It is a relabelled points-gap (probabilityFromEdge maps a points edge to a
 * 1-99 number via a sigmoid). The honest lever for lines/totals is the POINTS
 * gap, not a % floor. H2H is the only market where modelPct is a true win prob,
 * so H2H is gated on win% and is the safer hit-rate anchor.
 *
 * Tune here; do not reintroduce inline literals elsewhere.
 */
const RIGHTEDGE_TUNING = {
  // Sigmoid sensitivity converting a points edge to a model number.
  lineScale: 7.5,
  totalScale: 8,
  // Minimum POINTS the model must beat the market by (selectivity, not win%).
  minLineEdgePts: 1.5, // was 3.0 — too tight, starved the headline list
  minTotalEdgePts: 4.0,
  // H2H is a true win-probability market. This is now just a sanity floor: the
  // model must rate the team as a genuine winner (>50%). The VALUE gate
  // (model% > market implied%) is what actually qualifies the play — so a value
  // underdog the market underrates (e.g. model 52% vs implied 45%) can surface,
  // which is exactly the priced-up pick subscribers can't get from the bookie.
  minH2hWinPct: 50, // was 56/58 — lowered so value underdogs aren't blocked
  // Minimum value edge (model% minus implied%) for a play to count.
  minValueEdgePct: 0.5,
  // Odds bounds.
  minOdds: 1.55,
  minH2hOdds: 1.35, // H2H must clear positive value edge; short favs rarely do, so keep a real-price floor
  // Headline Best Bets cap odds for "feel-good" hit-rate; Value Plays may go higher.
  maxOddsHeadline: 2.4,
} as const;

const MIN_PREMIUM_MATCH_VALUE_EDGE_PCT = RIGHTEDGE_TUNING.minValueEdgePct;

function getPremiumMatchValueEdgePct(modelPct: number, odds: number) {
  return modelPct - getImpliedWinPctFromOdds(odds);
}

function hasPremiumMatchValueEdge(modelPct: number, odds: number) {
  return getPremiumMatchValueEdgePct(modelPct, odds) >= MIN_PREMIUM_MATCH_VALUE_EDGE_PCT;
}

function formatPremiumMatchEdge(modelPct: number, odds: number) {
  if (!modelPct || !odds) return "—";
  const edgePct = getPremiumMatchValueEdgePct(modelPct, odds);
  return `${edgePct >= 0 ? "+" : ""}${formatPercent(edgePct, 1)}`;
}

function isSamePremiumMarketOffer(a: PremiumMarketPlay, b: PremiumMarketPlay) {
  if (a.type !== b.type) return false;
  if (Math.abs(a.odds - b.odds) > 0.005) return false;

  if (a.type === "Head 2 Head") {
    return normalizeTeamName(a.selection) === normalizeTeamName(b.selection);
  }

  return (
    normalizeTeamName(a.selection) === normalizeTeamName(b.selection) &&
    Math.abs((a.marketPoint || 0) - (b.marketPoint || 0)) <= 0.01
  );
}

function compareBetrPreferenceForSameOffer(a: PremiumMarketPlay, b: PremiumMarketPlay) {
  if (!isSamePremiumMarketOffer(a, b)) return 0;
  if (isBetrBookmaker(a.bookmaker) && !isBetrBookmaker(b.bookmaker)) return -1;
  if (!isBetrBookmaker(a.bookmaker) && isBetrBookmaker(b.bookmaker)) return 1;
  return 0;
}

type PremiumPlayMode = "bestbet" | "value";

function getBestPremiumMarketPlayForMatch(
  row: PredictionRow,
  marketMap: SgmMarketMap,
  mode: PremiumPlayMode = "bestbet",
): PremiumMarketPlay | null {
  const matchMarkets = getSgmMatchMarkets(marketMap, row);
  const candidates: PremiumMarketPlay[] = [];
  const projectedTotal = row.predictedHomeScore + row.predictedAwayScore;
  const projectedHomeMargin = row.predictedHomeScore - row.predictedAwayScore;
  const predictedWinner = normalizeTeamName(row.predictedWinner);
  const winnerWinPct = getPredictedWinnerWinPct(row);
  const sheetWinnerMarketOdds = getPredictedWinnerMarketOdds(row);

  const isHeadline = mode === "bestbet";
  // Headline Best Bets cap odds for the "feel-good" hit-rate weekly product.
  // Value Plays may chase longer prices.
  const withinHeadlineOdds = (odds: number) =>
    !isHeadline || odds <= RIGHTEDGE_TUNING.maxOddsHeadline;

  // EVERY market — including H2H — must clear a positive value edge in ALL
  // modes. We do NOT headline negative-edge short favourites: that just tells
  // subscribers what the bookies already tell them. H2H stays eligible so that
  // when the model genuinely rates an underdog (or finds value in a close
  // match), that priced-up play surfaces — the kind of pick worth paying for.
  const h2hPassesValue = (winPct: number, odds: number) =>
    hasPremiumMatchValueEdge(winPct, odds);

  Object.entries(matchMarkets).forEach(([bookKey, bookData]) => {
    const bookmaker = displayBookmakerName(bookKey);

    bookData.spreads.forEach((spread) => {
      const team = normalizeTeamName(spread.team);
      const projectedTeamMargin =
        team === normalizeTeamName(row.homeTeam)
          ? projectedHomeMargin
          : -projectedHomeMargin;
      const coverEdge = projectedTeamMargin + spread.point;
      const modelPct = probabilityFromEdge(coverEdge, RIGHTEDGE_TUNING.lineScale);

      // Lines are ~coinflips by design — gate on the POINTS the model beats the
      // line by (selectivity), not a fake win%.
      if (coverEdge < RIGHTEDGE_TUNING.minLineEdgePts) return;
      if (spread.odds < RIGHTEDGE_TUNING.minOdds || !withinHeadlineOdds(spread.odds)) return;
      if (!hasPremiumMatchValueEdge(modelPct, spread.odds)) return;

      candidates.push({
        id: `${row.match}-${bookKey}-line-${team}-${spread.point}`,
        row,
        type: "Line",
        selection: `${team} ${formatSgmLine(spread.point)}`,
        bookmaker,
        odds: spread.odds,
        modelPct,
        modelEdge: coverEdge,
        marketPoint: spread.point,
        projectedValue: projectedTeamMargin,
      });
    });

    bookData.totals.forEach((total) => {
      if (!projectedTotal) return;

      const edge =
        total.side === "Over"
          ? projectedTotal - total.point
          : total.point - projectedTotal;
      const modelPct = probabilityFromEdge(edge, RIGHTEDGE_TUNING.totalScale);

      // Totals: gate on the POINTS gap between model total and market line.
      if (Math.abs(edge) < RIGHTEDGE_TUNING.minTotalEdgePts) return;
      if (total.odds < RIGHTEDGE_TUNING.minOdds || !withinHeadlineOdds(total.odds)) return;
      if (!hasPremiumMatchValueEdge(modelPct, total.odds)) return;

      candidates.push({
        id: `${row.match}-${bookKey}-total-${total.side}-${total.point}`,
        row,
        type: "Total",
        selection: `${total.side} ${total.point}`,
        bookmaker,
        odds: total.odds,
        modelPct,
        modelEdge: edge,
        marketPoint: total.point,
        projectedValue: projectedTotal,
      });
    });

    Object.entries(bookData.h2h).forEach(([team, odds]) => {
      if (normalizeTeamName(team) !== predictedWinner) return;
      // H2H is a true win-probability market — the safe hit-rate anchor.
      if (winnerWinPct < RIGHTEDGE_TUNING.minH2hWinPct) return;
      if (odds < RIGHTEDGE_TUNING.minH2hOdds || !withinHeadlineOdds(odds)) return;
      if (!h2hPassesValue(winnerWinPct, odds)) return;

      candidates.push({
        id: `${row.match}-${bookKey}-h2h-${team}`,
        row,
        type: "Head 2 Head",
        selection: `${team} head-to-head`,
        bookmaker,
        odds,
        modelPct: winnerWinPct,
        modelEdge: winnerWinPct - getImpliedWinPctFromOdds(odds),
        projectedValue: Math.abs(projectedHomeMargin),
      });
    });
  });

  if (
    winnerWinPct >= RIGHTEDGE_TUNING.minH2hWinPct &&
    sheetWinnerMarketOdds >= RIGHTEDGE_TUNING.minH2hOdds &&
    withinHeadlineOdds(sheetWinnerMarketOdds)
  ) {
    const bestLiveH2hCandidate = candidates
      .filter((candidate) => candidate.type === "Head 2 Head")
      .sort((a, b) => b.odds - a.odds)[0];

    if (
      h2hPassesValue(winnerWinPct, sheetWinnerMarketOdds) &&
      (!bestLiveH2hCandidate || sheetWinnerMarketOdds > bestLiveH2hCandidate.odds)
    ) {
      candidates.push({
        id: `${row.match}-sheet-best-h2h`,
        row,
        type: "Head 2 Head",
        selection: `${row.predictedWinner} head-to-head`,
        bookmaker: "Best available",
        odds: sheetWinnerMarketOdds,
        modelPct: winnerWinPct,
        modelEdge: winnerWinPct - getImpliedWinPctFromOdds(sheetWinnerMarketOdds),
        projectedValue: Math.abs(projectedHomeMargin),
      });
    }
  }

  if (!candidates.length) {
    const odds = sheetWinnerMarketOdds;
    if (
      winnerWinPct >= RIGHTEDGE_TUNING.minH2hWinPct &&
      odds >= RIGHTEDGE_TUNING.minH2hOdds &&
      withinHeadlineOdds(odds) &&
      h2hPassesValue(winnerWinPct, odds)
    ) {
      return {
        id: `${row.match}-fallback-h2h`,
        row,
        type: "Head 2 Head",
        selection: `${row.predictedWinner} head-to-head`,
        bookmaker: "Best available",
        odds,
        modelPct: winnerWinPct,
        modelEdge: winnerWinPct - getImpliedWinPctFromOdds(odds),
        projectedValue: Math.abs(projectedHomeMargin),
      };
    }
    return null;
  }

  const rankedCandidates = candidates.sort((a, b) => {
    const aValueEdge = getPremiumMatchValueEdgePct(a.modelPct, a.odds);
    const bValueEdge = getPremiumMatchValueEdgePct(b.modelPct, b.odds);

    if (isHeadline) {
      // BEST BETS: every candidate already cleared a POSITIVE value edge above.
      // Lead with the size of that value edge (the defensible "the model beats
      // the market price" signal), then prefer margin markets (lines/totals)
      // where the model has the most consistent edge. H2H stays eligible and
      // ranks on its own value edge — so a genuine underdog/close-match value
      // pick can headline, but a short favourite without edge never does.
      const typeRank = (play: PremiumMarketPlay) =>
        play.type === "Line" ? 3 : play.type === "Total" ? 2 : 1;
      const aScore = (aValueEdge * 3) + (typeRank(a) * 1.5) + Math.min(6, Math.max(0, a.modelEdge));
      const bScore = (bValueEdge * 3) + (typeRank(b) * 1.5) + Math.min(6, Math.max(0, b.modelEdge));
      const scoreDiff = bScore - aScore;
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      const betrPreference = compareBetrPreferenceForSameOffer(a, b);
      if (betrPreference) return betrPreference;
      const valueEdgeDiff = bValueEdge - aValueEdge;
      if (Math.abs(valueEdgeDiff) > 0.001) return valueEdgeDiff;
      return b.modelPct - a.modelPct;
    }

    // VALUE PLAYS (ROI): value edge weighted highest, longer odds rewarded.
    const typeRank = (play: PremiumMarketPlay) =>
      play.type === "Line" ? 3 : play.type === "Total" ? 2 : 1;
    const aScore = (aValueEdge * 2) + a.modelPct + Math.min(8, Math.max(0, (a.odds - 1.8) * 6)) + typeRank(a);
    const bScore = (bValueEdge * 2) + b.modelPct + Math.min(8, Math.max(0, (b.odds - 1.8) * 6)) + typeRank(b);
    const scoreDiff = bScore - aScore;
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    const betrPreference = compareBetrPreferenceForSameOffer(a, b);
    if (betrPreference) return betrPreference;
    const valueEdgeDiff = bValueEdge - aValueEdge;
    if (Math.abs(valueEdgeDiff) > 0.001) return valueEdgeDiff;
    return b.odds - a.odds;
  });

  return rankedCandidates[0];
}

function buildPremiumMarketPlays(
  data: DashboardData,
  marketMap: SgmMarketMap,
  now = Date.now(),
  includeStarted = false,
  mode: PremiumPlayMode = "bestbet",
) {
  const settledMatchKeys = new Set(
    data.betLog
      .filter((b) => b.result === "W" || b.result === "L")
      .map((b) => buildMatchLabelKey(b.match)),
  );

  return [...data.predictions]
    .sort(sortPredictionsByFixture)
    .filter((row) => includeStarted || !settledMatchKeys.has(buildMatchLabelKey(row.match)))
    .filter((row) => includeStarted || !hasPredictionKickedOff(row, now))
    .map((row) => getBestPremiumMarketPlayForMatch(row, marketMap, mode))
    .filter(Boolean) as PremiumMarketPlay[];
}

// Admin-only inline form to enter a match result. Pre-fills from a saved
// result. Renders nothing for non-admins (callers also gate on isAdmin).
function AdminResultEntryForm({
  round,
  matchKey,
  matchLabel,
  hasPlay,
  playSelection,
  tryScorers,
  savedResult,
  onSaved,
  compact = false,
}: {
  round: number;
  matchKey: string;
  matchLabel: string;
  hasPlay: boolean;
  playSelection?: string;
  tryScorers: FrozenTryScorer[];
  savedResult?: SavedRoundResult | null;
  onSaved: (result: SavedRoundResult) => void;
  compact?: boolean;
}) {
  const [finalHome, setFinalHome] = useState<string>(
    savedResult?.finalHome != null ? String(savedResult.finalHome) : "",
  );
  const [finalAway, setFinalAway] = useState<string>(
    savedResult?.finalAway != null ? String(savedResult.finalAway) : "",
  );
  const [playResult, setPlayResult] = useState<"HIT" | "MISS" | "PUSH" | null>(
    savedResult?.playResult ?? null,
  );
  const [scorerHits, setScorerHits] = useState<Record<string, boolean>>(
    savedResult?.tryScorerHits ?? {},
  );
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    setFinalHome(savedResult?.finalHome != null ? String(savedResult.finalHome) : "");
    setFinalAway(savedResult?.finalAway != null ? String(savedResult.finalAway) : "");
    setPlayResult(savedResult?.playResult ?? null);
    setScorerHits(savedResult?.tryScorerHits ?? {});
  }, [savedResult]);

  const toggleResult = (value: "HIT" | "MISS" | "PUSH") =>
    setPlayResult((prev) => (prev === value ? null : value));

  const handleSave = async () => {
    setSaving(true);
    setSaveState("idle");
    const saved = await postAdminRoundResult({
      round,
      match: matchLabel,
      matchKey,
      finalHome: finalHome === "" ? null : Number(finalHome),
      finalAway: finalAway === "" ? null : Number(finalAway),
      playResult,
      tryScorerHits: scorerHits,
    });
    setSaving(false);
    if (saved) {
      setSaveState("saved");
      onSaved(saved);
    } else {
      setSaveState("error");
    }
  };

  const resultBtnClass = (value: "HIT" | "MISS" | "PUSH") => {
    const active = playResult === value;
    if (!active) return "border-white/15 bg-white/[0.03] text-white/55";
    if (value === "HIT") return "border-[#00E676]/45 bg-[#00E676]/12 text-[#00E676]";
    if (value === "MISS") return "border-[#FF2E63]/45 bg-[#FF2E63]/12 text-[#FF2E63]";
    return "border-[#FFEA00]/45 bg-[#FFEA00]/12 text-[#FFEA00]";
  };

  return (
    <div className={`border border-[#1E1E2E] bg-[#0E0E13] ${compact ? "p-3" : "p-3 md:p-4"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[#FFEA00]">
          Admin · Enter result
        </div>
        {saveState === "saved" && (
          <span className="text-[9px] font-black uppercase tracking-widest text-[#00E676]">Saved</span>
        )}
        {saveState === "error" && (
          <span className="text-[9px] font-black uppercase tracking-widest text-[#FF2E63]">Save failed</span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-white/45">Home</div>
          <input
            type="number"
            inputMode="numeric"
            value={finalHome}
            onChange={(e) => setFinalHome(e.target.value)}
            className="w-16 border border-[#1E1E2E] bg-[#16161D] px-2 py-1.5 text-sm font-black text-white"
          />
        </div>
        <div className="pb-1.5 text-white/40 font-black">–</div>
        <div>
          <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-white/45">Away</div>
          <input
            type="number"
            inputMode="numeric"
            value={finalAway}
            onChange={(e) => setFinalAway(e.target.value)}
            className="w-16 border border-[#1E1E2E] bg-[#16161D] px-2 py-1.5 text-sm font-black text-white"
          />
        </div>
      </div>

      {hasPlay && (
        <div className="mt-3">
          <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-white/45">
            Best play{playSelection ? ` · ${playSelection}` : ""}
          </div>
          <div className="flex gap-2">
            {(["HIT", "MISS", "PUSH"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleResult(value)}
                className={`border px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition ${resultBtnClass(value)}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-white/45">
          Try scorers — tick if scored
        </div>
        {tryScorers.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {tryScorers.map((ts) => {
              const key = normalizeTryScorerPlayerKey(ts.player);
              const checked = Boolean(scorerHits[key]);
              return (
                <label key={key} className="flex items-center gap-2 text-[11px] font-bold text-white/80">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setScorerHits((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#00E676]"
                  />
                  <span className="truncate">{ts.player}</span>
                  <span className="text-white/35 uppercase tracking-widest text-[9px]">{ts.team}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="border border-[#1E1E2E] bg-[#111116] px-3 py-2 text-[10px] font-bold leading-relaxed text-white/45">
            Try-scorer players will appear here once this round's try-scorer model is published.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 w-full border border-[#00E676]/45 bg-[#00E676]/12 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#00E676] transition hover:bg-[#00E676]/20 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save result"}
      </button>
    </div>
  );
}

// Public settled summary: final score line shown under a settled card.
function FrozenFinalScoreLine({ result }: { result: SavedRoundResult }) {
  if (result.finalHome == null || result.finalAway == null) return null;
  return (
    <div className="mt-3 md:mt-4 text-[10px] md:text-xs font-black uppercase tracking-widest text-white/55">
      Final {result.finalHome}–{result.finalAway}
    </div>
  );
}

function PremiumMarketPlayCard({
  play,
  now,
  savedResult,
}: {
  play: PremiumMarketPlay;
  now: number;
  savedResult?: SavedRoundResult | null;
}) {
  const { row } = play;
  const fixtureStatus = getFixtureStatusBadge(row.fixture, now);
  // Prefer an admin-entered result for this match; fall back to hardcoded proof.
  const savedProofResult = playResultToProof(savedResult?.playResult ?? null);
  const proofResult = savedProofResult ?? getRoundProofForPremiumPlay(play)?.result;
  const edgeLabel = formatPremiumMatchEdge(play.modelPct, play.odds);
  const predictedScore =
    row.predictedHomeScore || row.predictedAwayScore
      ? `${Math.round(row.predictedHomeScore)}-${Math.round(row.predictedAwayScore)}`
      : "—";
  const originBadge = getOriginBadgeConfig(play.selection);
  const detail =
    play.type === "Line"
      ? `Model margin ${play.projectedValue && play.projectedValue > 0 ? "+" : ""}${Math.round(play.projectedValue || 0)} vs market ${formatSgmLine(play.marketPoint || 0)}`
      : play.type === "Total"
        ? `Model total ${Math.round(play.projectedValue || 0)} vs market ${play.marketPoint}`
        : `Model winner ${formatPercent(play.modelPct, 1)} vs market ${formatPercent(getImpliedWinPctFromOdds(play.odds), 1)}`;

  return (
    <GlassCard className="p-4 md:p-6 border-l-4 border-l-[#00E676]">
      <div className="flex items-start justify-between gap-3 md:gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase font-black text-white/45 tracking-widest">
            <span>
              {row.fixture
                ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
                : "Time TBC"}
            </span>
            <span className={`inline-flex shrink-0 border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${fixtureStatus.className}`}>
              {fixtureStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5 md:gap-3">
            {originBadge ? (
              <OriginTeamBadge
                teamName={play.selection}
                className="h-9 w-9 rounded-sm text-[10px] md:h-11 md:w-11 md:text-xs shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
              />
            ) : (
              <TeamLogo
                teamName={play.type === "Total" ? row.predictedWinner : play.selection}
                className="w-9 h-9 md:w-11 md:h-11 rounded-sm shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
              />
            )}
            <div className="min-w-0">
              <div className="text-lg md:text-3xl font-black text-white uppercase tracking-tight leading-[1.05] break-words">
                {play.selection}
              </div>
              <div className="mt-1 text-[9px] md:text-xs font-black text-[#FFEA00] uppercase tracking-widest">
                {row.homeTeam} v {row.awayTeam}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="bg-[#FF2E63] text-white px-2.5 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {play.type}
          </span>
          <PremiumResultBadge result={proofResult} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3">
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Score
          </div>
          <div className="text-base md:text-lg font-black text-white">
            {predictedScore}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Model %
          </div>
          <div className="text-base md:text-lg font-black text-[#00E676]">
            {formatPercent(play.modelPct, 1)}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Edge
          </div>
          <div className="text-base md:text-lg font-black text-[#00E676]">
            {edgeLabel}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Odds
          </div>
          <div className={isBetrBookmaker(play.bookmaker) ? "text-base md:text-lg font-black text-[#093AD3]" : "text-base md:text-lg font-black text-[#FFEA00]"}>
            ${play.odds.toFixed(2)}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Bookie
          </div>
          <BookmakerName
            name={getPreviewBookmakerName(play.bookmaker)}
            className="break-words text-[11px] md:text-xs font-black uppercase leading-tight text-white"
          />
        </div>
      </div>
      <AffiliateMarketButton
        payload="rightedge_premium_play"
        bookmaker={play.bookmaker}
        odds={play.odds}
        label="View NRL market"
        className="mt-3 md:mt-4"
      />
      <div className="mt-3 md:mt-4 text-[10px] md:text-xs font-bold text-white/45 uppercase tracking-widest leading-relaxed">
        {detail}
      </div>
      {savedResult ? <FrozenFinalScoreLine result={savedResult} /> : null}
    </GlassCard>
  );
}

function getProofPlayLogoTeam(play: RoundProofMatchPlay) {
  if (play.market === "Total") {
    return String(play.match || "").split(/\s+v\s+/i)[0] || play.selection;
  }
  return play.selection
    .replace(/\s+[+-]\d+(\.\d+)?\s*$/i, "")
    .replace(/\s+head-to-head\s*$/i, "")
    .trim();
}

function RoundProofMarketPlayCard({ play }: { play: RoundProofMatchPlay }) {
  const modelPct = play.modelPct || 0;
  const edgeLabel = formatPremiumMatchEdge(modelPct, play.odds);

  return (
    <GlassCard className="p-4 md:p-6 border-l-4 border-l-[#00E676]">
      <div className="flex items-start justify-between gap-3 md:gap-4 mb-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase font-black text-white/45 tracking-widest">
            <span>{play.match}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <TeamLogo
              teamName={getProofPlayLogoTeam(play)}
              className="w-9 h-9 md:w-11 md:h-11 rounded-sm shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
            />
            <div className="min-w-0">
              <div className="text-lg md:text-3xl font-black text-white uppercase tracking-tight leading-[1.05] break-words">
                {play.selection}
              </div>
              <div className="mt-1 text-[9px] md:text-xs font-black text-[#FFEA00] uppercase tracking-widest">
                {play.match}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="bg-[#FF2E63] text-white px-2.5 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {play.market}
          </span>
          <PremiumResultBadge result={play.result} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3">
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Score
          </div>
          <div className="text-base md:text-lg font-black text-white">
            {play.modelScore || "—"}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Model %
          </div>
          <div className="text-base md:text-lg font-black text-[#00E676]">
            {modelPct ? formatPercent(modelPct, 1) : "—"}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Edge
          </div>
          <div className="text-base md:text-lg font-black text-[#00E676]">
            {edgeLabel}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Odds
          </div>
          <div className={isBetrBookmaker(play.bookmaker) ? "text-base md:text-lg font-black text-[#093AD3]" : "text-base md:text-lg font-black text-[#FFEA00]"}>
            ${play.odds.toFixed(2)}
          </div>
        </div>
        <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Bookie
          </div>
          <BookmakerName
            name={getPreviewBookmakerName(play.bookmaker)}
            className="break-words text-[11px] md:text-xs font-black uppercase leading-tight text-white"
          />
        </div>
      </div>

      <div className="mt-3 md:mt-4 text-[10px] md:text-xs font-bold text-white/45 uppercase tracking-widest leading-relaxed">
        Final {play.finalScore}{play.note ? ` · ${play.note}` : ""}
      </div>
    </GlassCard>
  );
}

// REQ2 — Dedicated admin-only results entry page. Lists every kicked-off
// fixture in the active round with a compact AdminResultEntryForm each, prefilled
// from saved KV results. Try-scorer signals come from the frozen snapshot (locked
// at kickoff) when present, else computed live.
function AdminResultsPage({
  data,
  isAdmin = false,
}: {
  data: DashboardData;
  isAdmin?: boolean;
}) {
  const [marketMap, setMarketMap] = useState<SgmMarketMap>({});
  const now = useMinuteNow();

  useEffect(() => {
    let isMounted = true;
    fetchLiveOddsCached()
      .then((rawOdds) => {
        if (isMounted) setMarketMap(buildSgmMarketMap(rawOdds));
      })
      .catch(() => {
        if (isMounted) setMarketMap({});
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Freeze is already driven by the public pages; here we only read.
  const frozen = useFrozenRoundData(data, marketMap, now, { enableFreeze: false });

  const fixtures = useMemo(() => {
    return data.predictions
      .filter((row) => row.roundNumber === frozen.round)
      .map((row) => {
        const matchKey = getPredictionPairKey(row);
        const matchLabel = `${row.homeTeam} v ${row.awayTeam}`;
        const snapshot = frozen.snapshotByKey.get(matchKey) || null;
        const livePlay = getBestPremiumMarketPlayForMatch(row, marketMap);
        const playSelection =
          snapshot?.payload?.selection || livePlay?.selection || undefined;
        const hasPlay = Boolean(snapshot?.payload?.selection || livePlay);
        const frozenScorers: FrozenTryScorer[] = snapshot?.payload?.tryScorers?.length
          ? snapshot.payload.tryScorers
          : getTryScorerSignalsForPrediction(data, row, 5).map(({ row: ts }) => ({
              player: ts.player,
              team: ts.team,
              position: ts.position,
              odds: ts.bestOdds,
              bookmaker: ts.bookmaker,
            }));
        return { row, matchKey, matchLabel, hasPlay, playSelection, frozenScorers };
      })
      .sort((a, b) => getFixtureSortValue(a.row) - getFixtureSortValue(b.row));
  }, [data, frozen.round, frozen.snapshotByKey, marketMap, now]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#FFEA00]">
          Admin
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
          Results Entry · Round {frozen.round || data.currentRoundLabel}
        </h1>
        <p className="mt-2 text-sm font-medium text-white/55">
          Every fixture this round — enter results at any time. Enter the final score, mark the best
          play, and tick try scorers that scored. Saved results publish to the live cards.
        </p>
      </div>

      {fixtures.length === 0 ? (
        <GlassCard className="p-8">
          <div className="text-sm font-bold uppercase tracking-widest text-white/55">
            No fixtures found for this round yet.
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {fixtures.map((fx) => (
            <GlassCard key={fx.matchKey} className="p-4 md:p-5">
              <div className="mb-3 text-base md:text-lg font-black uppercase tracking-tight text-white">
                {fx.matchLabel}
              </div>
              <AdminResultEntryForm
                round={fx.row.roundNumber}
                matchKey={fx.matchKey}
                matchLabel={fx.matchLabel}
                hasPlay={fx.hasPlay}
                playSelection={fx.playSelection}
                tryScorers={fx.frozenScorers}
                savedResult={frozen.resultByKey.get(fx.matchKey) || null}
                onSaved={frozen.applyResult}
                compact
              />
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function BestBetsPage({
  data,
  onRequestAccess,
  isPremium = false,
  isAdmin = false,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
  isPremium?: boolean;
  isAdmin?: boolean;
}) {
  const [marketMap, setMarketMap] = useState<SgmMarketMap>({});
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const now = useMinuteNow();

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMarkets(true);

    fetchLiveOddsCached()
      .then((rawOdds) => {
        if (!isMounted) return;
        setMarketMap(buildSgmMarketMap(rawOdds));
      })
      .catch(() => {
        if (!isMounted) return;
        setMarketMap({});
      })
      .finally(() => {
        if (isMounted) setIsLoadingMarkets(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const frozen = useFrozenRoundData(data, marketMap, now, { enableFreeze: true });
  // Match keys for matches whose round has rolled over into the archive — these
  // are removed from the live Premium Plays page and shown in the dropdown.
  const archivedMatchKeys = useMemo(
    () => getArchivedMatchKeys(data, now),
    [data, now],
  );

  const predictionByPairKey = useMemo(() => {
    const map = new Map<string, PredictionRow>();
    for (const row of data.predictions) map.set(getPredictionPairKey(row), row);
    return map;
  }, [data.predictions]);

  const canViewStartedPremiumPlays = isPremium || isAdmin;
  // BEST BETS: hit-rate / feel-good list — H2H favourites led, headline odds capped.
  // After kickoff the live odds stop feeding, so we merge in frozen snapshots so
  // the play stays visible exactly as it was at kickoff (first-write-wins).
  const matchReads = useMemo(() => {
    const live = buildPremiumMarketPlays(data, marketMap, now, canViewStartedPremiumPlays, "bestbet");
    const byKey = new Map<string, PremiumMarketPlay>();
    for (const play of live) {
      const key = getPredictionPairKey(play.row);
      if (archivedMatchKeys.has(key)) continue;
      byKey.set(key, play);
    }
    // Overlay frozen plays for kicked-off matches (replaces empty-odds live play).
    for (const snapshot of frozen.snapshots) {
      if (archivedMatchKeys.has(snapshot.matchKey)) continue;
      const row = predictionByPairKey.get(snapshot.matchKey) || null;
      if (row && !hasPredictionKickedOff(row, now)) continue;
      byKey.set(snapshot.matchKey, reconstructFrozenPlay(snapshot, row));
    }
    return [...byKey.values()]
      .sort((a, b) => getFixtureSortValue(a.row) - getFixtureSortValue(b.row))
      .slice(0, isAdmin ? 50 : 8);
  }, [data, marketMap, now, canViewStartedPremiumPlays, isAdmin, frozen.snapshots, archivedMatchKeys, predictionByPairKey]);
  // VALUE PLAYS: ROI list — value-edge ranked, longer prices allowed. Deduped
  // against Best Bets so the same match never shows the identical selection twice.
  const valuePlayReads = useMemo(() => {
    const bestBetSelectionKeys = new Set(
      matchReads.map((play) => `${buildMatchLabelKey(play.row.match)}|${play.type}|${play.selection}`),
    );
    return buildPremiumMarketPlays(data, marketMap, now, canViewStartedPremiumPlays, "value")
      .filter(
        (play) =>
          !bestBetSelectionKeys.has(`${buildMatchLabelKey(play.row.match)}|${play.type}|${play.selection}`),
      )
      .slice(0, isAdmin ? 50 : 8);
  }, [data, marketMap, now, canViewStartedPremiumPlays, isAdmin, matchReads]);

  const latestTryScorerRound = Math.max(
    0,
    ...data.tryScorers.map((row) => row.round).filter((round) => Number.isFinite(round)),
  );
  const latestTryScorers = data.tryScorers.filter(
    (row) => row.round === latestTryScorerRound,
  );
  const tryScorerGroups = latestTryScorers.reduce((groups, row) => {
    if (!groups[row.match]) groups[row.match] = [];
    groups[row.match].push(row);
    return groups;
  }, {} as Record<string, TryScorerRow[]>);
  const predictionByMatch = new Map(
    data.predictions.map((prediction) => [
      buildMatchLabelKey(prediction.match),
      prediction,
    ]),
  );
  const isTryScorerMatchLive = (row: TryScorerRow) =>
    hasPredictionKickedOff(predictionByMatch.get(buildMatchLabelKey(row.match)), now);
  const liveTryScorerBestBets = Object.values(tryScorerGroups)
    .flatMap((players) => {
      const keys = getMatchBestBetKeys(players);
      return players
        .filter((row) => canViewStartedPremiumPlays || !isTryScorerMatchLive(row))
        .filter((row) => keys.has(getTryScorerKey(row)))
        .map((row) => ({
          row,
          signal: getTryScorerSignal(row, keys),
        }));
    });
  // Overlay frozen try scorers for kicked-off matches so the scorer signals do
  // not vanish when the sheet stops feeding their odds.
  const liveScorerKeys = new Set(
    liveTryScorerBestBets.map(
      ({ row }) => `${getMatchPairKeyFromLabel(row.match)}|${normalizeTryScorerPlayerKey(row.player)}`,
    ),
  );
  const frozenTryScorerBestBets = frozen.snapshots
    .filter((snapshot) => !archivedMatchKeys.has(snapshot.matchKey))
    .flatMap((snapshot) =>
      (snapshot.payload.tryScorers || [])
        .filter(
          (ts) =>
            !liveScorerKeys.has(
              `${snapshot.matchKey}|${normalizeTryScorerPlayerKey(ts.player)}`,
            ),
        )
        .map((ts) => ({
          row: {
            round: snapshot.round,
            match: snapshot.payload.fixture?.match || snapshot.match,
            player: ts.player,
            team: ts.team,
            position: ts.position || "",
            statsInsiderPct: 0,
            bestOdds: ts.odds,
            bookmaker: ts.bookmaker,
            marketImpliedPct: 0,
            edgePct: 0,
            value: "",
          } as TryScorerRow,
          signal: null as ReturnType<typeof getTryScorerSignal>,
        })),
    );
  const tryScorerBestBets = [...liveTryScorerBestBets, ...frozenTryScorerBestBets]
    .filter(({ row }) => !archivedMatchKeys.has(getMatchPairKeyFromLabel(row.match)))
    .sort((a, b) => {
      const aFixture = predictionByMatch.get(buildMatchLabelKey(a.row.match));
      const bFixture = predictionByMatch.get(buildMatchLabelKey(b.row.match));
      const aFixtureTime = aFixture ? getFixtureSortValue(aFixture) : Number.MAX_SAFE_INTEGER;
      const bFixtureTime = bFixture ? getFixtureSortValue(bFixture) : Number.MAX_SAFE_INTEGER;

      if (aFixtureTime !== bFixtureTime) return aFixtureTime - bFixtureTime;
      if ((b.signal?.sortRank || 0) !== (a.signal?.sortRank || 0)) {
        return (b.signal?.sortRank || 0) - (a.signal?.sortRank || 0);
      }
      return b.row.statsInsiderPct - a.row.statsInsiderPct;
    })
    .slice(0, isAdmin ? 50 : 8);

  // Per-card settled overlay context (results entry now lives in the Results tab).
  const cardPropsForPlay = (play: PremiumMarketPlay) => {
    const matchKey = getPredictionPairKey(play.row);
    return {
      savedResult: frozen.resultByKey.get(matchKey) || null,
    };
  };

  if (!isPremium && !isAdmin) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <GlassCard className="p-8 md:p-12 text-center !border-[#FF2E63] !shadow-[8px_8px_0_0_#FF2E63] relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,46,99,0.08),transparent_55%)]" />
          <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
            <div className="bg-[#FF2E63] p-4 mb-6 shadow-[4px_4px_0_0_#0047FF]">
              <Lock className="w-10 h-10 text-white stroke-[3px]" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-3">
              Premium Plays
            </h2>
            <p className="text-sm md:text-base text-white/70 font-bold leading-relaxed mb-8">
              Unlock the strongest match reads and Try Scorer best bets from the full RightEdge model.
            </p>
            <button
              onClick={() => onRequestAccess("best-bets")}
              className="inline-flex items-center justify-center gap-3 bg-[#FF2E63] text-white px-8 py-4 text-base font-black uppercase tracking-wider hover:bg-[#E62959] transition-colors shadow-[4px_4px_0_0_#0047FF]"
            >
              Unlock Premium Plays — $14/week
              <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">
            Match Best Bets
          </h3>
          <div className="text-[10px] md:text-xs font-black text-white/45 uppercase tracking-widest mt-1">
            Where our model sees the most value against the market this round
          </div>
        </div>
        {isLoadingMarkets ? (
          <GlassCard className="p-4 md:p-8 text-center border-l-4 border-l-white/20">
            <div className="text-white/50 font-bold uppercase tracking-widest text-[10px] md:text-base">
              Loading live line and total prices...
            </div>
          </GlassCard>
        ) : matchReads.length === 0 ? (
          <GlassCard className="p-4 md:p-8 text-center border-l-4 border-l-white/20">
            <div className="text-white/50 font-bold uppercase tracking-widest text-[10px] md:text-base">
              MODELLING IN PROGRESS - PREDICTIONS AVAILABLE EVERY WEDNESDAY
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:gap-6">
            {matchReads.map((play) => (
              <PremiumMarketPlayCard key={play.id} play={play} now={now} {...cardPropsForPlay(play)} />
            ))}
          </div>
        )}
      </div>

      {!isLoadingMarkets && valuePlayReads.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">
              Value Plays
            </h3>
            <div className="text-[10px] md:text-xs font-black text-white/45 uppercase tracking-widest mt-1">
              Bigger model edges at longer prices — higher variance, higher ROI
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:gap-6">
            {valuePlayReads.map((play) => (
              <PremiumMarketPlayCard key={play.id} play={play} now={now} {...cardPropsForPlay(play)} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">
            Try Scorer Best Bets
          </h3>
          <div className="text-[10px] md:text-xs font-black text-white/45 uppercase tracking-widest mt-1">
            Top scorer signals from the premium Try Scorers model
          </div>
        </div>
        {tryScorerBestBets.length === 0 ? (
          <GlassCard className="p-4 md:p-8 text-center border-l-4 border-l-white/20">
            <div className="text-white/50 font-bold uppercase tracking-widest text-[10px] md:text-base">
              No Try Scorer best bets qualify right now.
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:gap-6">
            {tryScorerBestBets.map(({ row, signal }) => {
              const scorerMatchKey = getMatchPairKeyFromLabel(row.match);
              const savedScorerResult = frozen.resultByKey.get(scorerMatchKey);
              const scorerHit = savedScorerResult?.tryScorerHits?.[
                normalizeTryScorerPlayerKey(row.player)
              ];
              const proofResult =
                scorerHit === true
                  ? ("Hit" as ProofResult)
                  : scorerHit === false && savedScorerResult?.playResult
                    ? ("Miss" as ProofResult)
                    : getRoundProofForTryScorer(row)?.result;
              return (
              <GlassCard
                key={getTryScorerKey(row)}
                className="p-4 md:p-6 border-l-4 border-l-[#FF2E63]"
              >
                <div className="flex items-start justify-between gap-3 md:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 md:gap-3 mb-2.5 md:mb-3">
                      <TeamLogo
                        teamName={row.team}
                        className="w-8 h-8 md:w-9 md:h-9 rounded-sm"
                      />
                      <div className="min-w-0">
                        <div className="break-words text-lg md:text-2xl font-black text-white tracking-tight leading-[1.05]">
                          {row.player}
                        </div>
                        <div className="mt-1 text-[9px] md:text-xs font-black text-[#FFEA00] uppercase tracking-widest">
                          {row.team} · {row.position} · R{row.round}
                        </div>
                      </div>
                    </div>
                    <div className="text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">
                      {row.match}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`px-2.5 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest ${getTryScorerSignalClass(signal?.label)}`}>
                      {signal?.label || "Best Bet"}
                    </span>
                    <PremiumResultBadge result={proofResult} />
                  </div>
                </div>
                <div className="mt-4 md:mt-5 grid grid-cols-3 gap-2.5 md:gap-3">
                  <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Model %
                    </div>
                    <div className="text-base md:text-lg font-black text-white">
                      {formatPercent(row.statsInsiderPct, 1)}
                    </div>
                  </div>
                  <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Odds
                    </div>
                    <div className={isBetrBookmaker(row.bookmaker) ? "text-base md:text-lg font-black text-[#093AD3]" : "text-base md:text-lg font-black text-[#00E676]"}>
                      ${row.bestOdds.toFixed(2)}
                    </div>
                  </div>
                  <div className="min-w-0 bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Bookie
                    </div>
                    <BookmakerName
                      name={getPreviewBookmakerName(row.bookmaker)}
                      className="break-words text-[11px] md:text-xs font-black uppercase leading-tight text-[#FFEA00]"
                    />
                  </div>
                </div>
                <AffiliateMarketButton
                  payload="rightedge_try_scorer"
                  bookmaker={row.bookmaker}
                  odds={row.bestOdds}
                  label="View NRL market"
                  className="mt-3 md:mt-4"
                />
              </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ORIGIN_RAPID_PROPS = {
  nsw: [
    { player: "Mark Nawaqanitawase", probability: 43.5 },
    { player: "Brian To'o", probability: 37.5 },
    { player: "Tolutau Koula", probability: 34.0 },
    { player: "James Tedesco", probability: 32.4 },
    { player: "Kotoni Staggs", probability: 32.0 },
  ],
  qld: [
    { player: "Selwyn Cobbo", probability: 40.1 },
    { player: "Hamiso Tabuai-Fidow", probability: 37.2 },
    { player: "Jojo Fifita", probability: 35.7 },
    { player: "Robert Toia", probability: 25.7 },
    { player: "Harry Grant", probability: 23.4 },
  ],
};

const ORIGIN_MARKET_SNAPSHOT = {
  updatedLabel: "Model baseline",
  h2h: {
    home: 1.729,
    away: 2.12,
  },
  line: {
    homePoint: -2.5,
    homeOdds: 2.07,
    awayPoint: 2.5,
    awayOdds: 1.769,
  },
  total: {
    point: 42.5,
    overOdds: 1.909,
    underOdds: 1.909,
  },
};

function normalizeOriginPlayerName(name: string) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOriginSnapshotMarkets(row: PredictionRow): SgmMarketBookmakerData {
  return {
    h2h: {
      [normalizeTeamName(row.homeTeam)]: ORIGIN_MARKET_SNAPSHOT.h2h.home,
      [normalizeTeamName(row.awayTeam)]: ORIGIN_MARKET_SNAPSHOT.h2h.away,
    },
    spreads: [
      { team: row.homeTeam, point: ORIGIN_MARKET_SNAPSHOT.line.homePoint, odds: ORIGIN_MARKET_SNAPSHOT.line.homeOdds },
      { team: row.awayTeam, point: ORIGIN_MARKET_SNAPSHOT.line.awayPoint, odds: ORIGIN_MARKET_SNAPSHOT.line.awayOdds },
    ],
    totals: [
      { side: "Over", point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.overOdds },
      { side: "Under", point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.underOdds },
    ],
  };
}

function buildOriginPremiumMarketPlay(
  row: PredictionRow,
  betrMarkets: SgmMarketBookmakerData | null | undefined,
  pinnacleMarkets: SgmMarketBookmakerData | null | undefined,
): PremiumMarketPlay | null {
  const baselineMarkets = pinnacleMarkets || getOriginSnapshotMarkets(row);
  const displayMarkets = betrMarkets || null;
  const candidates: PremiumMarketPlay[] = [];
  const projectedTotal = row.predictedHomeScore + row.predictedAwayScore;
  const projectedHomeMargin = row.predictedHomeScore - row.predictedAwayScore;

  const addCandidate = ({
    id,
    type,
    selection,
    modelOdds,
    marketOdds,
    marketPoint,
    projectedValue,
  }: {
    id: string;
    type: PremiumMarketPlay["type"];
    selection: string;
    modelOdds: number;
    marketOdds: number;
    marketPoint?: number;
    projectedValue?: number;
  }) => {
    if (!modelOdds || !marketOdds || modelOdds <= 1 || marketOdds <= 1) return;
    const modelPct = getImpliedWinPctFromOdds(modelOdds);
    const valueEdge = getPremiumMatchValueEdgePct(modelPct, marketOdds);
    if (valueEdge < MIN_PREMIUM_MATCH_VALUE_EDGE_PCT) return;

    candidates.push({
      id,
      row,
      type,
      selection,
      bookmaker: "Betr",
      odds: marketOdds,
      modelPct,
      modelEdge: valueEdge,
      marketPoint,
      projectedValue,
    });
  };

  const homeKey = normalizeTeamName(row.homeTeam);
  const awayKey = normalizeTeamName(row.awayTeam);
  addCandidate({
    id: "origin-game-2-h2h-home",
    type: "Head 2 Head",
    selection: `${row.homeTeam} head-to-head`,
    modelOdds: baselineMarkets.h2h[homeKey],
    marketOdds: displayMarkets?.h2h[homeKey] || 0,
    projectedValue: Math.abs(projectedHomeMargin),
  });
  addCandidate({
    id: "origin-game-2-h2h-away",
    type: "Head 2 Head",
    selection: `${row.awayTeam} head-to-head`,
    modelOdds: baselineMarkets.h2h[awayKey],
    marketOdds: displayMarkets?.h2h[awayKey] || 0,
    projectedValue: Math.abs(projectedHomeMargin),
  });

  baselineMarkets.spreads.forEach((baselineSpread) => {
    const betrSpread = findSpreadOffer(displayMarkets, baselineSpread.team, baselineSpread.point);
    if (!betrSpread) return;
    const isHome = normalizeTeamName(baselineSpread.team) === homeKey;
    addCandidate({
      id: `origin-game-2-line-${isHome ? "home" : "away"}-${baselineSpread.point}`,
      type: "Line",
      selection: `${baselineSpread.team} ${formatSgmLine(baselineSpread.point)}`,
      modelOdds: baselineSpread.odds,
      marketOdds: betrSpread.odds,
      marketPoint: baselineSpread.point,
      projectedValue: isHome ? projectedHomeMargin : -projectedHomeMargin,
    });
  });

  baselineMarkets.totals.forEach((baselineTotal) => {
    const betrTotal = findTotalOffer(displayMarkets, baselineTotal.side, baselineTotal.point);
    if (!betrTotal) return;
    addCandidate({
      id: `origin-game-2-total-${baselineTotal.side}-${baselineTotal.point}`,
      type: "Total",
      selection: `${baselineTotal.side} ${baselineTotal.point}`,
      modelOdds: baselineTotal.odds,
      marketOdds: betrTotal.odds,
      marketPoint: baselineTotal.point,
      projectedValue: projectedTotal,
    });
  });

  return candidates.sort((a, b) => {
    const edgeDiff = getPremiumMatchValueEdgePct(b.modelPct, b.odds) - getPremiumMatchValueEdgePct(a.modelPct, a.odds);
    if (Math.abs(edgeDiff) > 0.001) return edgeDiff;
    const typeRank = (play: PremiumMarketPlay) =>
      play.type === "Line" ? 3 : play.type === "Total" ? 2 : 1;
    const typeDiff = typeRank(b) - typeRank(a);
    if (typeDiff) return typeDiff;
    return b.modelPct - a.modelPct;
  })[0] || null;
}

function getOriginTryScorerRead(probability: number, odds?: number) {
  const marketPct = odds && odds > 1 ? getImpliedWinPctFromOdds(odds) : 0;
  const edge = marketPct ? probability - marketPct : 0;
  const labels = [
    ...(edge > 0 ? ["Best Bet"] : []),
    ...(probability > 38 ? ["High Probability"] : []),
  ];
  return { edge, labels };
}

function getOriginMarketRead(
  label: string,
  modelOdds?: number,
  marketOdds?: number,
) {
  const modelPct = modelOdds && modelOdds > 1 ? getImpliedWinPctFromOdds(modelOdds) : 0;
  const edge = marketOdds && marketOdds > 1 ? getPremiumMatchValueEdgePct(modelPct, marketOdds) : 0;
  return { label, modelPct, edge };
}

function OriginPage({
  onRequestAccess,
  isAdmin = false,
}: {
  onRequestAccess: (targetHash?: string) => void;
  isAdmin?: boolean;
}) {
  const now = useMinuteNow();
  const [originBetrMarketMap, setOriginBetrMarketMap] = useState<SgmMarketMap>({});
  const [originPinnacleMarketMap, setOriginPinnacleMarketMap] = useState<SgmMarketMap>({});
  const [originTryScorerOddsByPlayer, setOriginTryScorerOddsByPlayer] = useState<Record<string, { bestOdds: number; bookmaker: string }>>({});
  const [activeOriginMarketRead, setActiveOriginMarketRead] = useState<"h2h" | "line" | "total">("h2h");

  const originRowBase: PredictionRow = {
    match: "NSW Blues v Queensland Maroons",
    roundNumber: 15,
    homeTeam: "New South Wales Blues",
    awayTeam: "Queensland Maroons",
    predictedWinner: "New South Wales Blues",
    predictedHomeScore: 20,
    predictedAwayScore: 18,
    modelHomeOdds: ORIGIN_MARKET_SNAPSHOT.h2h.home,
    modelAwayOdds: ORIGIN_MARKET_SNAPSHOT.h2h.away,
    marketHomeOdds: ORIGIN_MARKET_SNAPSHOT.h2h.home,
    marketAwayOdds: ORIGIN_MARKET_SNAPSHOT.h2h.away,
    homeOverlay: 0,
    awayOverlay: 0,
    bestBet: "Queensland Maroons",
    side: "Away",
    stake: 0,
    confidence: "Lean",
    bestEdge: 0,
    fixture: {
      roundNumber: 15,
      roundLabel: "State of Origin",
      day: "Wednesday",
      dateISO: "2026-06-17",
      dateLabel: "Jun 17",
      tz: "AEST",
      homeTeam: "New South Wales Blues",
      awayTeam: "Queensland Maroons",
      stadium: "MCG",
      network: "",
      aedt: "8:05 PM",
      local: "8:05 PM",
    },
  };

  useEffect(() => {
    let mounted = true;

    const fetchOriginOdds = async () => {
      try {
        const [betrResult, pinnacleResult, tryScorerResult] = await Promise.allSettled([
          fetchLiveOddsCached("betr", "origin"),
          fetchLiveOddsCached("pinnacle", "origin"),
          fetchBestTryScorerOddsCached("betr"),
        ]);

        if (!mounted) return;

        setOriginBetrMarketMap(
          betrResult.status === "fulfilled" ? buildSgmMarketMap(betrResult.value) : {},
        );
        setOriginPinnacleMarketMap(
          pinnacleResult.status === "fulfilled" ? buildSgmMarketMap(pinnacleResult.value) : {},
        );

        if (tryScorerResult.status === "fulfilled") {
          const oddsRows = Array.isArray(tryScorerResult.value?.odds)
            ? tryScorerResult.value.odds
            : [];
          const originPairKey = buildTeamPairKey(originRowBase.homeTeam, originRowBase.awayTeam);
          const scorerOdds = oddsRows.reduce((acc: Record<string, { bestOdds: number; bookmaker: string }>, row: any) => {
            const rowPairKey = buildTeamPairKey(row.homeTeam || row.sheetHomeTeam || "", row.awayTeam || row.sheetAwayTeam || "");
            const rowMatchKey = buildTeamPairKey(
              String(row.sheetMatch || "").split(/\s+v\s+/i)[0] || "",
              String(row.sheetMatch || "").split(/\s+v\s+/i)[1] || "",
            );
            if (rowPairKey !== originPairKey && rowMatchKey !== originPairKey) return acc;

            const playerKey = normalizeOriginPlayerName(row.normalizedPlayer || row.player || "");
            const odds = Number(row.bestOdds) || 0;
            if (!playerKey || odds <= 1) return acc;
            acc[playerKey] = {
              bestOdds: odds,
              bookmaker: row.bookmaker || "Best available",
            };
            return acc;
          }, {});
          setOriginTryScorerOddsByPlayer(scorerOdds);
        } else {
          setOriginTryScorerOddsByPlayer({});
        }
      } catch {
        if (!mounted) return;
        setOriginBetrMarketMap({});
        setOriginPinnacleMarketMap({});
        setOriginTryScorerOddsByPlayer({});
      }
    };

    fetchOriginOdds();

    return () => {
      mounted = false;
    };
  }, [originRowBase.awayTeam, originRowBase.homeTeam, originRowBase.match]);

  const originBetrMarkets = getBookmakerMarketsForPrediction(originBetrMarketMap, originRowBase, "betr");
  const originPinnacleMarkets = getBookmakerMarketsForPrediction(originPinnacleMarketMap, originRowBase, "pinnacle");
  const originBetrHomeOdds =
    originBetrMarkets?.h2h[normalizeTeamName(originRowBase.homeTeam)] ||
    ORIGIN_MARKET_SNAPSHOT.h2h.home;
  const originBetrAwayOdds =
    originBetrMarkets?.h2h[normalizeTeamName(originRowBase.awayTeam)] ||
    ORIGIN_MARKET_SNAPSHOT.h2h.away;
  const originRow: PredictionRow = {
    ...originRowBase,
    modelHomeOdds: originPinnacleMarkets?.h2h[normalizeTeamName(originRowBase.homeTeam)] || ORIGIN_MARKET_SNAPSHOT.h2h.home,
    modelAwayOdds: originPinnacleMarkets?.h2h[normalizeTeamName(originRowBase.awayTeam)] || ORIGIN_MARKET_SNAPSHOT.h2h.away,
    marketHomeOdds: originBetrHomeOdds,
    marketAwayOdds: originBetrAwayOdds,
  };
  const states = [
    {
      key: "nsw",
      name: "NSW Blues",
      short: "NSW",
      score: originRow.predictedHomeScore,
      winPct: getImpliedWinPctFromOdds(originRow.modelHomeOdds),
      colors: {
        primary: "#7CC6FF",
        secondary: "#183153",
      },
      props: ORIGIN_RAPID_PROPS.nsw,
    },
    {
      key: "qld",
      name: "Queensland Maroons",
      short: "QLD",
      score: originRow.predictedAwayScore,
      winPct: getImpliedWinPctFromOdds(originRow.modelAwayOdds),
      colors: {
        primary: "#8A1748",
        secondary: "#F5E6EE",
      },
      props: ORIGIN_RAPID_PROPS.qld,
    },
  ] as const;
  const originPinnacleBaselineMarkets = originPinnacleMarkets || getOriginSnapshotMarkets(originRow);
  const originMarketLine =
    findSpreadOffer(originPinnacleBaselineMarkets, originRow.awayTeam, ORIGIN_MARKET_SNAPSHOT.line.awayPoint) ||
    { point: ORIGIN_MARKET_SNAPSHOT.line.awayPoint, odds: ORIGIN_MARKET_SNAPSHOT.line.awayOdds, team: originRow.awayTeam };
  const originMarketTotal =
    findTotalOffer(originPinnacleBaselineMarkets, "Over", ORIGIN_MARKET_SNAPSHOT.total.point) ||
    { side: "Over" as const, point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.overOdds };
  const originHomeLine =
    findSpreadOffer(originPinnacleBaselineMarkets, originRow.homeTeam, ORIGIN_MARKET_SNAPSHOT.line.homePoint) ||
    { point: ORIGIN_MARKET_SNAPSHOT.line.homePoint, odds: ORIGIN_MARKET_SNAPSHOT.line.homeOdds, team: originRow.homeTeam };
  const originAwayLine =
    findSpreadOffer(originPinnacleBaselineMarkets, originRow.awayTeam, ORIGIN_MARKET_SNAPSHOT.line.awayPoint) ||
    { point: ORIGIN_MARKET_SNAPSHOT.line.awayPoint, odds: ORIGIN_MARKET_SNAPSHOT.line.awayOdds, team: originRow.awayTeam };
  const originOverTotal =
    findTotalOffer(originPinnacleBaselineMarkets, "Over", ORIGIN_MARKET_SNAPSHOT.total.point) ||
    { side: "Over" as const, point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.overOdds };
  const originUnderTotal =
    findTotalOffer(originPinnacleBaselineMarkets, "Under", ORIGIN_MARKET_SNAPSHOT.total.point) ||
    { side: "Under" as const, point: ORIGIN_MARKET_SNAPSHOT.total.point, odds: ORIGIN_MARKET_SNAPSHOT.total.underOdds };
  const originMarketReadGroups = [
    {
      id: "h2h" as const,
      title: "H2H",
      reads: [
        getOriginMarketRead("NSW", originRow.modelHomeOdds, originBetrMarkets?.h2h[normalizeTeamName(originRow.homeTeam)] || originRow.marketHomeOdds),
        getOriginMarketRead("QLD", originRow.modelAwayOdds, originBetrMarkets?.h2h[normalizeTeamName(originRow.awayTeam)] || originRow.marketAwayOdds),
      ],
    },
    {
      id: "line" as const,
      title: "Line",
      reads: [
        getOriginMarketRead(
          `NSW ${formatSgmLine(originHomeLine.point)}`,
          originHomeLine.odds,
          findSpreadOffer(originBetrMarkets, originRow.homeTeam, originHomeLine.point)?.odds,
        ),
        getOriginMarketRead(
          `QLD ${formatSgmLine(originAwayLine.point)}`,
          originAwayLine.odds,
          findSpreadOffer(originBetrMarkets, originRow.awayTeam, originAwayLine.point)?.odds,
        ),
      ],
    },
    {
      id: "total" as const,
      title: `Total ${originMarketTotal.point}`,
      reads: [
        getOriginMarketRead("Over", originOverTotal.odds, findTotalOffer(originBetrMarkets, "Over", originOverTotal.point)?.odds),
        getOriginMarketRead("Under", originUnderTotal.odds, findTotalOffer(originBetrMarkets, "Under", originUnderTotal.point)?.odds),
      ],
    },
  ];
  const activeOriginMarketReadGroup =
    originMarketReadGroups.find((group) => group.id === activeOriginMarketRead) ||
    originMarketReadGroups[0];
  const originPremiumPlay = buildOriginPremiumMarketPlay(originRow, originBetrMarkets, originPinnacleBaselineMarkets);
  const originQueenslandLineOdds = findSpreadOffer(originBetrMarkets, originRow.awayTeam, originAwayLine.point)?.odds;
  const originQueenslandLineModelPct = getImpliedWinPctFromOdds(originAwayLine.odds);
  const originQueenslandLineEdge = originQueenslandLineOdds
    ? getPremiumMatchValueEdgePct(originQueenslandLineModelPct, originQueenslandLineOdds)
    : 0;
  const originQueenslandLinePlay: PremiumMarketPlay | null =
    originQueenslandLineOdds && originQueenslandLineEdge > 0
      ? {
          id: `origin-game-2-line-away-${originAwayLine.point}`,
          row: originRow,
          type: "Line",
          selection: `${originRow.awayTeam} ${formatSgmLine(originAwayLine.point)}`,
          bookmaker: "Betr",
          odds: originQueenslandLineOdds,
          modelPct: originQueenslandLineModelPct,
          modelEdge: originQueenslandLineEdge,
          marketPoint: originAwayLine.point,
          projectedValue: originRow.predictedAwayScore - originRow.predictedHomeScore,
        }
      : null;
  const originAllPremiumPlays = [
    originPremiumPlay,
    originQueenslandLinePlay && originPremiumPlay?.id !== originQueenslandLinePlay.id
      ? originQueenslandLinePlay
      : null,
  ].filter(Boolean) as PremiumMarketPlay[];
  // Lead with the margin (Line) play as the headline — that's where the model
  // adds value over the market. H2H and other markets fall in behind it.
  const originPremiumPlays = [
    ...originAllPremiumPlays.filter((play) => play.type === "Line"),
    ...originAllPremiumPlays.filter((play) => play.type !== "Line"),
  ];
  const originTryScorerSignals = states.flatMap((state) =>
    state.props.map((prop) => {
      const liveOdds = originTryScorerOddsByPlayer[normalizeOriginPlayerName(prop.player)];
      const read = getOriginTryScorerRead(prop.probability, liveOdds?.bestOdds);
      return {
        state,
        prop,
        liveOdds,
        read,
      };
    }),
  );
  const positiveOriginTryScorerSignals = originTryScorerSignals
    .filter(({ read }) => read.edge > 0)
    .sort((a, b) => {
      const edgeDiff = b.read.edge - a.read.edge;
      if (Math.abs(edgeDiff) > 0.001) return edgeDiff;
      return b.prop.probability - a.prop.probability;
    });

  if (!hasPaidAccess() && !isAdmin) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <GlassCard className="p-6 md:p-10 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4 mb-6">
              <Shield className="w-10 h-10 text-white stroke-[2px]" />
            </div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-3">
              State of Origin Game 2
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold text-white uppercase tracking-tight mb-3">
              NSW Blues v Queensland Maroons
            </h2>
            <p className="text-sm md:text-base text-[#9CA3AF] leading-relaxed mb-8">
              Unlock the Game 2 model card, premium line read, live sportsbook price and anytime try scorer signals.
            </p>
            <button
              onClick={() => onRequestAccess("origin")}
              className="inline-flex items-center justify-center gap-3 re-primary-cta border px-8 py-4 text-base font-medium uppercase tracking-wider transition hover:opacity-90"
            >
              Unlock Origin Signals
              <ArrowRight className="w-5 h-5 stroke-[2px]" />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <GlassCard className="p-5 md:p-8 border-l-4 border-l-[#0047FF]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-[#9CA3AF] font-medium mb-2">
                State of Origin Game 2
              </div>
              <h2 className="text-2xl md:text-4xl font-semibold tracking-tight text-white uppercase leading-none">
                NSW Blues v Queensland Maroons
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] md:text-xs font-medium uppercase tracking-widest text-[#9CA3AF]">
                <span>MCG</span>
                <span className="text-[#6B7280]">/</span>
                <span>Wednesday Jun 17</span>
                <span className="text-[#6B7280]">/</span>
                <span>8:05 PM AEST</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3">
            {states.map((state, index) => (
              <div
                key={state.key}
                className="relative grid grid-cols-1 items-center gap-3 border border-[#1E1E2E] bg-[#111116] p-3 sm:grid-cols-[minmax(0,1fr)_auto] md:p-4"
              >
                <span
                  className="absolute left-0 top-0 h-full w-1"
                  style={{ backgroundColor: state.colors.primary }}
                />
                <div className="flex min-w-0 items-center gap-3 pl-2">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center border text-[10px] font-semibold uppercase tracking-widest md:h-12 md:w-12"
                    style={{
                      backgroundColor: state.colors.primary,
                      borderColor: state.colors.secondary,
                      color: state.colors.secondary,
                    }}
                  >
                    {state.short}
                  </div>
                  <div className="min-w-0">
                    <div className={`truncate text-xl md:text-3xl font-semibold tracking-tight uppercase ${
                      index === 0 ? "text-white" : "text-[#9CA3AF]"
                    }`}>
                      {state.name}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-auto md:gap-3">
                  <div className="min-w-[70px] border border-[#1E1E2E] bg-[#16161D] px-2 py-2 text-center md:min-w-[90px]">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#6B7280] font-medium mb-1">
                      Score
                    </div>
                    <div className={`text-2xl md:text-3xl font-semibold leading-none ${
                      index === 0 ? "text-white" : "text-[#9CA3AF]"
                    }`}>
                      {state.score}
                    </div>
                  </div>
                  <div className="min-w-[70px] border border-[#1E1E2E] bg-[#16161D] px-2 py-2 text-center md:min-w-[90px]">
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[#6B7280] font-medium mb-1">
                      Model %
                    </div>
                    <div className="text-2xl md:text-3xl font-semibold leading-none text-[#00E676]">
                      {formatPercent(state.winPct, 1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
              <div className="text-[8px] md:text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                Model margin
              </div>
              <div className="text-base md:text-2xl font-semibold text-white">
                2 pts
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
              <div className="text-[8px] md:text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                Market line
              </div>
              <div className="text-base md:text-2xl font-semibold text-white">
                QLD {formatSgmLine(originMarketLine.point)}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
              <div className="text-[8px] md:text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                Model total
              </div>
              <div className="text-base md:text-2xl font-semibold text-white">
                {originRow.predictedHomeScore + originRow.predictedAwayScore}
              </div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
              <div className="text-[8px] md:text-[9px] font-medium uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                Market total
              </div>
              <div className="text-base md:text-2xl font-semibold text-white">
                {originMarketTotal.point}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* THE EDGE — top play this game (hero) */}
      {(() => {
        const lead = originPremiumPlays[0] || null;
        const margin = Math.abs(
          originRow.predictedHomeScore - originRow.predictedAwayScore,
        );
        const marginLabel =
          originRow.predictedHomeScore >= originRow.predictedAwayScore
            ? `NSW by ${margin}`
            : `QLD by ${margin}`;
        if (!lead) {
          return (
            <GlassCard className="p-4 md:p-6 border-l-4 border-l-[#6B7280]">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-2">
                No positive edge
              </div>
              <div className="text-lg md:text-2xl font-black uppercase tracking-tight text-white">
                Waiting for Betr to move into value range.
              </div>
            </GlassCard>
          );
        }
        const isLine = lead.type === "Line";
        const rationale = isLine ? (
          <>
            Our model sees a <span className="font-black text-white">{margin}-point game</span> (NSW{" "}
            {originRow.predictedHomeScore}–{originRow.predictedAwayScore}). The market is laying{" "}
            <span className="font-black text-white">{lead.selection}</span>, so we&apos;re taking the underdog
            start <span className="font-black text-white">plus the hook</span> on a margin the model rates tighter
            than the price implies.
          </>
        ) : (
          <>
            Our model sees a <span className="font-black text-white">{margin}-point game</span> (NSW{" "}
            {originRow.predictedHomeScore}–{originRow.predictedAwayScore}).{" "}
            <span className="font-black text-white">{lead.selection}</span> beats the market price our model
            implies — this isn&apos;t just the bookies&apos; favourite.
          </>
        );
        return (
          <GlassCard className="overflow-hidden p-0 border-l-4 border-l-[#00E676]">
            <div className="flex items-center justify-between gap-3 bg-[#0A0A0F] px-4 py-3 md:px-6">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                The edge — top play this game
              </div>
              <div className="bg-[#00E676] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                Best bet
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4 md:p-6">
              <div>
                <div className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white leading-none">
                  {lead.selection}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                  <span>{lead.type}</span>
                  <span className="text-[#6B7280]">·</span>
                  <span>NSW Blues v QLD Maroons</span>
                  <span className="text-[#6B7280]">·</span>
                  <span>{lead.bookmaker || "Betr"}</span>
                </div>
              </div>
              <div className="border-l-2 border-l-[#00E676] bg-[#111116] px-4 py-3">
                <p className="text-[12px] md:text-sm font-medium leading-relaxed text-white/70">
                  {rationale}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                    Model margin
                  </div>
                  <div className="text-base md:text-2xl font-black text-white">{marginLabel}</div>
                </div>
                <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                    Market line
                  </div>
                  <div className="text-base md:text-2xl font-black text-white">
                    QLD {formatSgmLine(originMarketLine.point)}
                  </div>
                </div>
                <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                    Model %
                  </div>
                  <div className="text-base md:text-2xl font-black text-white">
                    {formatPercent(lead.modelPct, 1)}
                  </div>
                </div>
                <div className="border border-[#1E1E2E] bg-[#16161D] p-3 md:p-4">
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                    Edge
                  </div>
                  <div className="text-base md:text-2xl font-black text-[#00E676]">
                    +{formatPercent(lead.modelEdge, 1)}
                  </div>
                </div>
              </div>
              <AffiliateMarketButton
                payload="rightedge_origin_top_play"
                bookmaker={lead.bookmaker || "Betr"}
                odds={lead.odds}
                label={`Back at ${lead.bookmaker || "Betr"} · $${lead.odds.toFixed(2)}`}
                className="w-full justify-center py-3.5 text-sm"
              />
            </div>
          </GlassCard>
        );
      })()}

      <div className="flex flex-col gap-4">
        {(() => {
          // Hero = the single highest positive-edge scorer (value play).
          const heroScorer = positiveOriginTryScorerSignals[0] || null;
          const heroPlayerKey = heroScorer ? normalizeOriginPlayerName(heroScorer.prop.player) : "";
          // Context list = every OTHER scorer, grouped BY TEAM. We show model
          // probability only here (no edge) — shown for context, not called as plays.
          const contextScorers = originTryScorerSignals
            .filter((s) => normalizeOriginPlayerName(s.prop.player) !== heroPlayerKey);
          const contextByTeam = states
            .map((state) => ({
              state,
              scorers: contextScorers
                .filter((s) => s.state.key === state.key)
                .sort((a, b) => b.prop.probability - a.prop.probability),
            }))
            .filter((group) => group.scorers.length > 0);
          return (
            <div className="flex flex-col gap-4">
              {heroScorer ? (
                <GlassCard className="overflow-hidden border-l-4 border-l-[#00E676] p-0">
                  <div className="flex items-center gap-3 bg-[#00E676] px-4 py-2.5 md:px-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                      Value scorer of the game
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                    <div className="min-w-0">
                      <div className="truncate text-xl font-black uppercase tracking-tight text-white md:text-2xl">
                        {heroScorer.prop.player}
                      </div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
                        {heroScorer.state.name} · Anytime try scorer
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
                      <div className="min-w-[78px] border border-[#1E1E2E] bg-[#1E232B] px-3 py-2 text-center">
                        <div className="text-[7px] font-black uppercase tracking-[0.18em] text-white/45">
                          Model %
                        </div>
                        <div className="mt-0.5 text-base font-black text-white md:text-lg">
                          {formatPercent(heroScorer.prop.probability, 1)}
                        </div>
                      </div>
                      <div className="min-w-[78px] border border-[#1E1E2E] bg-[#1E232B] px-3 py-2 text-center">
                        <div className="text-[7px] font-black uppercase tracking-[0.18em] text-white/45">
                          Edge
                        </div>
                        <div className="mt-0.5 text-base font-black text-[#00E676] md:text-lg">
                          +{formatPercent(heroScorer.read.edge, 1)}
                        </div>
                      </div>
                      {heroScorer.liveOdds ? (
                        <AffiliateMarketButton
                          payload="rightedge_origin_try_scorer"
                          bookmaker={heroScorer.liveOdds.bookmaker || "Betr"}
                          odds={heroScorer.liveOdds.bestOdds}
                          label={`Back $${heroScorer.liveOdds.bestOdds.toFixed(2)}`}
                          className="justify-center whitespace-nowrap px-4 py-2.5 text-[11px] [&_span]:!min-w-0 [&_span]:!whitespace-nowrap"
                        />
                      ) : (
                        <div className="border border-[#1E1E2E] bg-[#1E232B] px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-white/45">
                          Odds pending
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-4 md:p-5 border-l-4 border-l-[#6B7280]">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45 mb-2">
                    No value scorer
                  </div>
                  <div className="text-base md:text-xl font-black uppercase tracking-tight text-white">
                    No anytime scorer is priced as value right now.
                  </div>
                </GlassCard>
              )}

              {contextByTeam.length > 0 && (
                <div className="flex flex-col gap-4">
                  <p className="text-[11px] font-medium leading-relaxed text-white/45">
                    The model&apos;s read on every other scorer in this game. None are priced as value right now, so they&apos;re
                    <span className="font-black text-white"> shown for context only — not called as plays.</span>
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {contextByTeam.map(({ state, scorers }) => (
                      <div key={`origin-context-team-${state.key}`} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-9 shrink-0 items-center justify-center border text-[8px] font-black uppercase tracking-widest"
                            style={{
                              backgroundColor: state.colors.primary,
                              borderColor: state.colors.secondary,
                              color: state.colors.secondary,
                            }}
                          >
                            {state.short}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                            {state.name}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {scorers.map(({ prop }) => (
                            <div
                              key={`origin-context-scorer-${state.key}-${prop.player}`}
                              className="flex items-center justify-between gap-3 border border-[#1E1E2E] bg-[#111116] px-3 py-2.5"
                            >
                              <div className="min-w-0 truncate text-sm font-black text-white">
                                {prop.player}
                              </div>
                              <div className="flex shrink-0 items-baseline gap-1.5">
                                <span className="text-[7px] font-black uppercase tracking-[0.18em] text-white/45">
                                  Model
                                </span>
                                <span className="text-sm font-black text-white/70">
                                  {formatPercent(prop.probability, 1)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ALSO WORTH A LOOK — secondary positive-edge plays (lead is already in the hero) */}
      {originPremiumPlays.length > 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">
              Also worth a look
            </h3>
            <span className="border border-[#1E1E2E] bg-[#16161D] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
              Positive edge
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:gap-5">
            {originPremiumPlays.slice(1).map((play) => (
              <GlassCard key={play.id} className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0 truncate text-lg md:text-2xl font-black uppercase tracking-tight text-white">
                    {play.selection}
                  </div>
                  <span className="shrink-0 border border-[#1E1E2E] bg-[#16161D] px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                    {play.type === "Total" ? "Total" : play.type === "Line" ? "Line" : "H2H"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 md:grid-cols-4 md:gap-3 md:px-5">
                  <div className="border border-[#1E1E2E] bg-[#16161D] p-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                      Model %
                    </div>
                    <div className="text-base md:text-xl font-black text-[#00E676]">
                      {formatPercent(play.modelPct, 1)}
                    </div>
                  </div>
                  <div className="border border-[#1E1E2E] bg-[#16161D] p-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                      Market %
                    </div>
                    <div className="text-base md:text-xl font-black text-white">
                      {formatPercent(getImpliedWinPctFromOdds(play.odds), 1)}
                    </div>
                  </div>
                  <div className="border border-[#1E1E2E] bg-[#16161D] p-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                      Edge
                    </div>
                    <div className="text-base md:text-xl font-black text-[#00E676]">
                      +{formatPercent(play.modelEdge, 1)}
                    </div>
                  </div>
                  <div className="border border-[#1E1E2E] bg-[#16161D] p-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                      Odds
                    </div>
                    <div className="text-base md:text-xl font-black text-white">
                      ${play.odds.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-5">
                  <AffiliateMarketButton
                    payload="rightedge_origin_secondary_play"
                    bookmaker={play.bookmaker || "Betr"}
                    odds={play.odds}
                    label={`Back at ${play.bookmaker || "Betr"} · $${play.odds.toFixed(2)}`}
                    className="w-full justify-center py-3 text-sm"
                  />
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      <GlassCard className="p-4 md:p-5 border-l-4 border-l-[#00E676]">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] font-medium mb-2">
              Game 1 archive
            </div>
            <div className="text-lg md:text-xl font-semibold tracking-tight text-white uppercase">
              NSW Blues 22-20 Queensland Maroons
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                Final result
              </div>
              <div className="text-lg font-black text-white">NSW 22-20</div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                Model exact score
              </div>
              <div className="text-lg font-black text-[#00E676]">NSW 22-20</div>
            </div>
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                    Official best play
                  </div>
                  <div className="text-lg font-black text-white">QLD +4.5</div>
                </div>
                <PremiumResultBadge result="Hit" />
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function TryScorersPage({
  data,
  onRequestAccess,
  isPremium = false,
  isAdmin = false,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
  isPremium?: boolean;
  isAdmin?: boolean;
}) {
  const availableRounds = useMemo(
    () =>
      Array.from(
        new Set(
          data.tryScorers
            .map((row) => row.round)
            .filter((round) => Number.isFinite(round) && round > 0),
        ),
      ).sort((a, b) => b - a),
    [data.tryScorers],
  );

  const latestRound = availableRounds[0] || 0;
  const availableRoundKey = availableRounds.join("|");
  const [selectedRound, setSelectedRound] = useState<number | "all">(
    latestRound || "all",
  );

  useEffect(() => {
    if (!availableRounds.length) {
      setSelectedRound("all");
      return;
    }

    setSelectedRound((current) => {
      if (current === "all") return latestRound;
      return availableRounds.includes(current) ? current : latestRound;
    });
  }, [availableRoundKey, latestRound]);

  const roundFilteredRows =
    selectedRound === "all"
      ? data.tryScorers
      : data.tryScorers.filter((row) => row.round === selectedRound);

  const valuePlays = roundFilteredRows
    .filter((row) => getTryScorerSignal(row) || isTryScorerBestBetCandidate(row));
  const roundLabel =
    selectedRound === "all" ? "All rounds" : `Round ${selectedRound}`;

  const matchGroups = valuePlays.reduce((groups, row) => {
    if (!groups[row.match]) groups[row.match] = [];
    groups[row.match].push(row);
    return groups;
  }, {} as Record<string, TryScorerRow[]>);

  const matchCount = Object.keys(matchGroups).length;

  if (!isPremium && !isAdmin) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <GlassCard className="p-8 md:p-12 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
            <div className="border border-[#1E1E2E] bg-[#16161D] p-4 mb-6">
              <Lock className="w-10 h-10 text-white stroke-[2px]" />
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold text-white uppercase tracking-tight mb-3">
              Premium Content
            </h2>
            <p className="text-sm md:text-base text-[#9CA3AF] leading-relaxed mb-8">
              Try Scorer plays are included with RightEdge Premium. Unlock the full round to see model plays, Try Scorer signals and live prices.
            </p>
            <button
              onClick={() => onRequestAccess("try-scorers")}
              className="inline-flex items-center justify-center gap-3 re-primary-cta border px-8 py-4 text-base font-medium uppercase tracking-wider transition hover:opacity-90"
            >
              Unlock Premium Plays — $14/week
              <ArrowRight className="w-5 h-5 stroke-[2px]" />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="bg-[#1E232B] border-2 border-white/10 px-4 py-3 shadow-[4px_4px_0_0_#0047FF]">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">
              Showing
            </div>
            <div className="text-sm font-black text-white uppercase tracking-wider">
              {roundLabel} · {valuePlays.length} plays · {matchCount} matches
            </div>
          </div>

          <div className="relative min-w-[180px]">
            <select
              value={selectedRound === "all" ? "all" : String(selectedRound)}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedRound(value === "all" ? "all" : Number(value));
              }}
              className="w-full appearance-none bg-[#111317] border-2 border-[#FFEA00] text-white px-4 py-3 pr-10 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-[#00E676] shadow-[4px_4px_0_0_#FF2E63]"
            >
              {availableRounds.map((round) => (
                <option key={round} value={round}>
                  Round {round}
                </option>
              ))}
              {availableRounds.length > 1 && <option value="all">All rounds</option>}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFEA00]" />
          </div>
        </div>
      </div>

      {valuePlays.length === 0 ? (
        <GlassCard className="p-8 text-center border-l-4 border-l-white/20">
          <div className="text-white/50 font-bold uppercase tracking-widest text-sm">
            No value plays identified for {roundLabel.toLowerCase()} yet.
          </div>
          {availableRounds.length > 0 && selectedRound !== latestRound && (
            <button
              type="button"
              onClick={() => setSelectedRound(latestRound)}
              className="mt-5 inline-flex items-center justify-center gap-2 bg-[#FFEA00] text-black px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-[#FFD600] transition-colors shadow-[4px_4px_0_0_#FF2E63]"
            >
              Show latest round
              <ArrowRight className="w-4 h-4 stroke-[3px]" />
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-10">
          {Object.entries(matchGroups).map(([match, players]) => {
            const teams = match.split(" v ");
            const homeTeam = teams[0] || "";
            const awayTeam = teams[1] || "";
            const bestBetKeys = getMatchBestBetKeys(players);
            const sortedPlayers = [...players].sort((a, b) => {
              const aSignal = getTryScorerSignal(a, bestBetKeys);
              const bSignal = getTryScorerSignal(b, bestBetKeys);
              return (
                (bSignal?.sortRank || 0) - (aSignal?.sortRank || 0) ||
                b.statsInsiderPct - a.statsInsiderPct ||
                b.edgePct - a.edgePct
              );
            });

            return (
              <div key={match}>
                {/* Match Header */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: getTeamColors(homeTeam).primary }} />
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: getTeamColors(awayTeam).primary }} />
                  <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{homeTeam} v {awayTeam}</span>
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        {["Player", "Round", "Model %", "Market %", "Best Odds", "Bookmaker", "Signal"].map((h) => (
                          <th key={h} className="pb-3 px-3 font-black text-white/40 uppercase tracking-widest text-[10px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sortedPlayers.map((row, i) => {
                        const signal = getTryScorerSignal(row, bestBetKeys);
                        return (
                        <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2">
                              <TeamLogo teamName={row.team} className="w-5 h-5 text-[8px]" />
                              <span className="text-sm font-black text-white">{row.player}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs font-black text-white/40 uppercase tracking-widest">
                            {row.round ? `R${row.round}` : "—"}
                          </td>
                          <td className="py-4 px-3 text-sm font-bold text-white">
                            {formatPercent(row.statsInsiderPct, 1)}
                          </td>
                          <td className="py-4 px-3 text-sm font-bold text-white/50">
                            {formatPercent(row.marketImpliedPct, 1)}
                          </td>
                          <td className="py-4 px-3">
                            <div className={isBetrBookmaker(row.bookmaker) ? "text-sm font-black text-[#093AD3]" : "text-sm font-black text-[#00E676]"}>
                              ${row.bestOdds.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs font-bold text-[#FFEA00] uppercase tracking-wider min-w-[150px]">
                            <AffiliateMarketButton
                              payload="rightedge_try_scorer"
                              bookmaker={row.bookmaker}
                              odds={row.bestOdds}
                              label={getPreviewBookmakerName(row.bookmaker)}
                              className="!min-h-[34px] !px-2.5 !py-1 !text-[10px]"
                            />
                          </td>
                          <td className="py-4 px-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-black uppercase tracking-widest ${getTryScorerSignalClass(signal?.label)}`}>
                              {signal?.label || "Watch"}
                            </span>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden flex flex-col divide-y divide-white/5">
                  {sortedPlayers.map((row, i) => {
                    const teamColors = getTeamColors(row.team);
                    const signal = getTryScorerSignal(row, bestBetKeys);
                    return (
                      <div key={i} className="py-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-white mb-1">{row.player}</div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-xs font-black" style={{ color: teamColors.secondary === '#FFFFFF' || teamColors.secondary === '#000000' ? '#FFFFFF' : teamColors.secondary }}>
                              {row.team}
                            </span>
                            <span className="text-xs text-white/40">· {row.position}</span>
                            {row.round > 0 && <span className="text-xs text-white/40">· R{row.round}</span>}
                          </div>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider">
                            Model {formatPercent(row.statsInsiderPct, 1)} · Market {formatPercent(row.marketImpliedPct, 1)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={isBetrBookmaker(row.bookmaker) ? "text-xl font-black text-[#093AD3]" : "text-xl font-black text-white"}>
                            ${row.bestOdds.toFixed(2)}
                          </div>
                          <AffiliateMarketButton
                            payload="rightedge_try_scorer"
                            bookmaker={row.bookmaker}
                            odds={row.bestOdds}
                            label="View market"
                            className="!min-h-[34px] !px-2.5 !py-1 !text-[9px]"
                          />
                          <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getTryScorerSignalClass(signal?.label)}`}>
                            {signal?.label || "Watch"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
               </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SgmLeg = {
  label: string;
  typeLabel: string;
  team?: string;
  modelPct: number;
  odds: number;
};

type SgmCombo = {
  id: string;
  title: string;
  confidence: "High Prob" | "Attack Stack" | "Scorer Pair";
  bookmaker: string;
  estimatedOdds: number;
  modelHitPct: number;
  legs: SgmLeg[];
};

type SgmMatchGroup = {
  key: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  selectedTeam: string;
  projectedMargin: number;
  combos: SgmCombo[];
};

type SgmMarketBookmakerData = {
  h2h: Record<string, number>;
  spreads: {
    team: string;
    point: number;
    odds: number;
  }[];
  totals: {
    side: "Over" | "Under";
    point: number;
    odds: number;
  }[];
};

type SgmMarketMap = Record<string, Record<string, SgmMarketBookmakerData>>;

function normalizeBookmakerName(name: string) {
  const key = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key || key.includes("multiple")) return "";
  if (key.includes("pointsbet")) return "pointsbet";
  if (key.includes("betright")) return "betright";
  if (key === "betr" || key.startsWith("betr") || key.includes("betrapp")) return "betr";
  if (key.includes("betfair")) return "betfair";
  if (key.includes("ladbrokes")) return "ladbrokes";
  if (key.includes("sportsbet")) return "sportsbet";
  if (key.includes("bet365")) return "bet365";
  if (key.includes("dabble")) return "dabble";
  if (key.includes("neds")) return "neds";
  if (key.includes("tabtouch")) return "tab";
  if (key.includes("tab")) return "tab";
  return key;
}

function displayBookmakerName(name: string) {
  const normalized = normalizeBookmakerName(name);
  const labels: Record<string, string> = {
    pointsbet: "PointsBet",
    betright: "BetRight",
    betr: "Betr",
    ladbrokes: "Ladbrokes",
    sportsbet: "Sportsbet",
    bet365: "Bet365",
    dabble: "Dabble",
    neds: "Neds",
    tab: "TAB",
    pinnacle: "Pinnacle",
  };
  return labels[normalized] || name || "Best available";
}

function isExcludedMatchOddsBookmaker(bookmaker: any) {
  const normalized = normalizeBookmakerName(bookmaker?.title || bookmaker?.key || "");
  return normalized === "betfair";
}

function buildSgmMarketMap(rawOdds: any[]): SgmMarketMap {
  const prices: SgmMarketMap = {};

  for (const event of rawOdds || []) {
    const homeTeam = normalizeTeamName(event.home_team || "");
    const awayTeam = normalizeTeamName(event.away_team || "");
    if (!homeTeam || !awayTeam) continue;

    const matchKey = buildMatchKey(homeTeam, awayTeam);
    for (const bookmaker of event.bookmakers || []) {
      if (isExcludedMatchOddsBookmaker(bookmaker)) continue;

      const bookKey = normalizeBookmakerName(bookmaker.title || bookmaker.key || "");
      if (!bookKey) continue;
      if (!prices[matchKey]) prices[matchKey] = {};
      if (!prices[matchKey][bookKey]) {
        prices[matchKey][bookKey] = {
          h2h: {},
          spreads: [],
          totals: [],
        };
      }

      const h2hMarket = (bookmaker.markets || []).find((market: any) => market.key === "h2h");
      const spreadMarket = (bookmaker.markets || []).find((market: any) => market.key === "spreads");
      const totalsMarket = (bookmaker.markets || []).find((market: any) => market.key === "totals");

      for (const outcome of h2hMarket?.outcomes || []) {
        const team = normalizeTeamName(outcome.name || "");
        const price = Number(outcome.price) || 0;
        if (!team || price <= 1) continue;
        prices[matchKey][bookKey].h2h[team] = price;
      }

      for (const outcome of spreadMarket?.outcomes || []) {
        const team = normalizeTeamName(outcome.name || "");
        const price = Number(outcome.price) || 0;
        const point = Number(outcome.point);
        if (!team || price <= 1 || !Number.isFinite(point)) continue;
        prices[matchKey][bookKey].spreads.push({ team, point, odds: price });
      }

      for (const outcome of totalsMarket?.outcomes || []) {
        const side = String(outcome.name || "");
        const price = Number(outcome.price) || 0;
        const point = Number(outcome.point);
        if (!["Over", "Under"].includes(side) || price <= 1 || !Number.isFinite(point)) continue;
        prices[matchKey][bookKey].totals.push({
          side: side as "Over" | "Under",
          point,
          odds: price,
        });
      }
    }
  }

  return prices;
}

function getPredictionSide(match: PredictionRow) {
  const homePct = getImpliedWinPctFromOdds(match.modelHomeOdds);
  const awayPct = getImpliedWinPctFromOdds(match.modelAwayOdds);
  const homeIsSelected = homePct >= awayPct;
  return {
    team: homeIsSelected ? match.homeTeam : match.awayTeam,
    modelPct: homeIsSelected ? homePct : awayPct,
    odds: homeIsSelected ? match.marketHomeOdds : match.marketAwayOdds,
  };
}

function getH2hOddsForBookmaker(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  team: string,
  bookmaker: string,
  fallbackOdds: number,
) {
  const matchKey = buildMatchLabelKey(match.match);
  const teamKey = normalizeTeamName(team);
  const bookKey = normalizeBookmakerName(bookmaker);
  return marketMap[matchKey]?.[bookKey]?.h2h[teamKey] || fallbackOdds || 0;
}

function getSgmMatchMarkets(marketMap: SgmMarketMap, match: PredictionRow) {
  const parts = String(match.match || "").split(/\s+v\s+/i);
  const directKey = buildMatchLabelKey(match.match);
  if (marketMap[directKey]) return marketMap[directKey];
  // The Odds API can label home/away in the opposite order from our fixture
  // (notably State of Origin). Fall back to the reversed pairing.
  if (parts.length === 2) {
    const reversedKey = buildMatchKey(parts[1], parts[0]);
    if (marketMap[reversedKey]) return marketMap[reversedKey];
  }
  return {};
}

function getBookmakerMarketsForPrediction(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  bookmaker: string,
) {
  const bookKey = normalizeBookmakerName(bookmaker);
  if (!bookKey) return null;
  return getSgmMatchMarkets(marketMap, match)[bookKey] || null;
}

function findSpreadOffer(
  markets: SgmMarketBookmakerData | null | undefined,
  team: string,
  point: number,
) {
  if (!markets) return null;
  const teamKey = normalizeTeamName(team);
  return markets.spreads.find((spread) =>
    normalizeTeamName(spread.team) === teamKey &&
    Math.abs(spread.point - point) <= 0.01,
  ) || null;
}

function findTotalOffer(
  markets: SgmMarketBookmakerData | null | undefined,
  side: "Over" | "Under",
  point: number,
) {
  if (!markets) return null;
  return markets.totals.find((total) =>
    total.side === side &&
    Math.abs(total.point - point) <= 0.01,
  ) || null;
}

function findBestSpreadOffer(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  team: string,
  point: number,
) {
  const offers = Object.entries(getSgmMatchMarkets(marketMap, match))
    .map(([bookKey, data]) => {
      const offer = findSpreadOffer(data, team, point);
      if (!offer) return null;
      return {
        bookmaker: displayBookmakerName(bookKey),
        odds: offer.odds,
        point: offer.point,
      };
    })
    .filter(Boolean) as { bookmaker: string; odds: number; point: number }[];

  return offers.sort((a, b) => {
    const oddsDiff = b.odds - a.odds;
    if (Math.abs(oddsDiff) > 0.005) return oddsDiff;
    if (isBetrBookmaker(a.bookmaker) && !isBetrBookmaker(b.bookmaker)) return -1;
    if (!isBetrBookmaker(a.bookmaker) && isBetrBookmaker(b.bookmaker)) return 1;
    return a.bookmaker.localeCompare(b.bookmaker);
  })[0] || null;
}

function findBestTotalOffer(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  side: "Over" | "Under",
  point: number,
) {
  const offers = Object.entries(getSgmMatchMarkets(marketMap, match))
    .map(([bookKey, data]) => {
      const offer = findTotalOffer(data, side, point);
      if (!offer) return null;
      return {
        bookmaker: displayBookmakerName(bookKey),
        odds: offer.odds,
        point: offer.point,
      };
    })
    .filter(Boolean) as { bookmaker: string; odds: number; point: number }[];

  return offers.sort((a, b) => {
    const oddsDiff = b.odds - a.odds;
    if (Math.abs(oddsDiff) > 0.005) return oddsDiff;
    if (isBetrBookmaker(a.bookmaker) && !isBetrBookmaker(b.bookmaker)) return -1;
    if (!isBetrBookmaker(a.bookmaker) && isBetrBookmaker(b.bookmaker)) return 1;
    return a.bookmaker.localeCompare(b.bookmaker);
  })[0] || null;
}

function marketHasCoreSgmData(data?: SgmMarketBookmakerData) {
  if (!data) return false;
  return Object.keys(data.h2h).length > 0 && data.spreads.length > 0 && data.totals.length > 0;
}

function resolveSgmBookmaker(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  preferredBookmaker: string,
) {
  const matchMarkets = getSgmMatchMarkets(marketMap, match);
  const preferredKey = normalizeBookmakerName(preferredBookmaker);

  if (preferredKey && marketHasCoreSgmData(matchMarkets[preferredKey])) {
    return displayBookmakerName(preferredKey);
  }

  const fullMarketBookKey = Object.entries(matchMarkets).find(([, data]) =>
    marketHasCoreSgmData(data),
  )?.[0];

  if (fullMarketBookKey) return displayBookmakerName(fullMarketBookKey);

  if (preferredKey && matchMarkets[preferredKey]) {
    return displayBookmakerName(preferredKey);
  }

  return preferredBookmaker && normalizeBookmakerName(preferredBookmaker)
    ? displayBookmakerName(preferredBookmaker)
    : "Best available";
}

function formatSgmLine(point: number) {
  if (point > 0) return `+${point}`;
  return String(point);
}

function getSelectedTeamProjectedMargin(match: PredictionRow, selectedTeam: string) {
  const homeMargin = match.predictedHomeScore - match.predictedAwayScore;
  return normalizeTeamName(selectedTeam) === normalizeTeamName(match.homeTeam)
    ? homeMargin
    : -homeMargin;
}

function getSpreadLeg(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  selectedTeam: string,
  bookmaker: string,
) {
  const bookKey = normalizeBookmakerName(bookmaker);
  const spread = getSgmMatchMarkets(marketMap, match)[bookKey]?.spreads.find(
    (row) => normalizeTeamName(row.team) === normalizeTeamName(selectedTeam),
  );
  if (!spread) return null;

  const projectedMargin = getSelectedTeamProjectedMargin(match, selectedTeam);
  const coverEdge = projectedMargin + spread.point;
  // Unified with the best-bet engine: single source of truth for line model %.
  const modelPct = probabilityFromEdge(coverEdge, RIGHTEDGE_TUNING.lineScale);

  return {
    label: `${selectedTeam} ${formatSgmLine(spread.point)} line`,
    typeLabel: "Line",
    team: selectedTeam,
    modelPct,
    odds: spread.odds,
  } as SgmLeg;
}

function getTotalLeg(
  marketMap: SgmMarketMap,
  match: PredictionRow,
  bookmaker: string,
) {
  const bookKey = normalizeBookmakerName(bookmaker);
  const projectedTotal = match.predictedHomeScore + match.predictedAwayScore;
  const totals = getSgmMatchMarkets(marketMap, match)[bookKey]?.totals || [];
  if (!totals.length || !projectedTotal) return null;

  const sortedTotals = [...totals].sort(
    (a, b) => Math.abs(projectedTotal - a.point) - Math.abs(projectedTotal - b.point),
  );
  const total = sortedTotals[0];
  const side = projectedTotal >= total.point ? "Over" : "Under";
  const matchingTotal = totals.find((row) => row.side === side && row.point === total.point) || total;
  const totalDiff = Math.abs(projectedTotal - matchingTotal.point);

  return {
    label: `${side} ${matchingTotal.point} total points`,
    typeLabel: "Total",
    // Unified with the best-bet engine: single source of truth for total model %.
    modelPct: probabilityFromEdge(totalDiff, RIGHTEDGE_TUNING.totalScale),
    odds: matchingTotal.odds,
  } as SgmLeg;
}

function buildSgmHitPct(legs: SgmLeg[], correlationMultiplier: number) {
  const independent = legs.reduce(
    (product, leg) => product * (Math.max(leg.modelPct, 1) / 100),
    1,
  );
  return Math.max(1, Math.min(55, independent * correlationMultiplier * 100));
}

function makeSgmCombo({
  id,
  title,
  confidence,
  bookmaker,
  legs,
  correlationMultiplier,
}: {
  id: string;
  title: string;
  confidence: SgmCombo["confidence"];
  bookmaker: string;
  legs: SgmLeg[];
  correlationMultiplier: number;
}): SgmCombo | null {
  if (legs.length < 2 || legs.some((leg) => !leg.modelPct || !leg.odds)) return null;
  const modelHitPct = buildSgmHitPct(legs, correlationMultiplier);
  if (modelHitPct < 40) return null;

  return {
    id,
    title,
    confidence,
    bookmaker: displayBookmakerName(bookmaker),
    estimatedOdds: legs.reduce((product, leg) => product * leg.odds, 1),
    modelHitPct,
    legs,
  };
}

function buildSgmMatchGroups(
  data: DashboardData,
  marketMap: SgmMarketMap = {},
): SgmMatchGroup[] {
  const settledMatchKeys = new Set(
    data.betLog
      .filter((b) => b.result === "W" || b.result === "L")
      .map((b) => buildMatchLabelKey(b.match)),
  );

  const tryScorersByMatch = data.tryScorers
    .filter((row) => row.statsInsiderPct >= 45 && row.bestOdds > 1)
    .reduce((groups, row) => {
      const key = buildMatchLabelKey(row.match);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
      return groups;
    }, {} as Record<string, TryScorerRow[]>);

  const fixtureOrder = new Map(
    data.fixtures.map((fixture, idx) => [
      buildMatchKey(fixture.homeTeam, fixture.awayTeam),
      idx,
    ]),
  );

  return data.predictions
    .filter((match) => !settledMatchKeys.has(buildMatchLabelKey(match.match)))
    .map((match) => {
      const matchKey = buildMatchLabelKey(match.match);
      const selected = getPredictionSide(match);
      const projectedMargin = Math.abs(match.predictedHomeScore - match.predictedAwayScore);
      const selectedTeamScorers = [...(tryScorersByMatch[matchKey] || [])]
        .filter((row) => normalizeTeamName(row.team) === normalizeTeamName(selected.team))
        .sort((a, b) => b.statsInsiderPct - a.statsInsiderPct);
      const allScorers = [...(tryScorersByMatch[matchKey] || [])]
        .sort((a, b) => b.statsInsiderPct - a.statsInsiderPct);
      const combos: SgmCombo[] = [];

      const addCombo = (combo: SgmCombo | null) => {
        if (combo && !combos.some((existing) => existing.id === combo.id)) {
          combos.push(combo);
        }
      };

      const topTeamScorer = selectedTeamScorers[0];
      if (topTeamScorer) {
        const bookie = resolveSgmBookmaker(marketMap, match, topTeamScorer.bookmaker);
        const h2hOddsForBookie = getH2hOddsForBookmaker(
          marketMap,
          match,
          selected.team,
          bookie,
          selected.odds,
        );
        const sideLeg = {
          label: `${selected.team} head-to-head`,
          typeLabel: "Head 2 Head",
          team: selected.team,
          modelPct: selected.modelPct,
          odds: h2hOddsForBookie,
        };
        const topScorerLeg = {
          label: topTeamScorer.player,
          typeLabel: "Anytime try",
          team: topTeamScorer.team,
          modelPct: topTeamScorer.statsInsiderPct,
          odds: topTeamScorer.bestOdds,
        };
        const spreadLeg = getSpreadLeg(marketMap, match, selected.team, bookie);
        const totalLeg = getTotalLeg(marketMap, match, bookie);

        addCombo(makeSgmCombo({
          id: `${matchKey}-side-top-scorer`,
          title: "Side + top scorer",
          confidence: "High Prob",
          bookmaker: bookie,
          correlationMultiplier: 1.1,
          legs: [sideLeg, topScorerLeg],
        }));

        if (totalLeg) {
          addCombo(makeSgmCombo({
            id: `${matchKey}-side-top-scorer-total`,
            title: "Side + scorer + total",
            confidence: "High Prob",
            bookmaker: bookie,
            correlationMultiplier: normalizeTeamName(topTeamScorer.team) === normalizeTeamName(selected.team)
              ? 1.14
              : 1.02,
            legs: [sideLeg, topScorerLeg, totalLeg],
          }));

          addCombo(makeSgmCombo({
            id: `${matchKey}-scorer-total`,
            title: "Scorer + total",
            confidence: "High Prob",
            bookmaker: bookie,
            correlationMultiplier: normalizeTeamName(topTeamScorer.team) === normalizeTeamName(selected.team)
              ? 1.24
              : 1.08,
            legs: [topScorerLeg, totalLeg],
          }));
        }

        if (spreadLeg) {
          addCombo(makeSgmCombo({
            id: `${matchKey}-line-top-scorer`,
            title: "Line + scorer",
            confidence: "High Prob",
            bookmaker: bookie,
            correlationMultiplier: normalizeTeamName(topTeamScorer.team) === normalizeTeamName(selected.team)
              ? 1.35
              : 1.05,
            legs: [spreadLeg, topScorerLeg],
          }));
        }
      }

      const sameBookieTeamPair = selectedTeamScorers.find((first, idx) =>
        selectedTeamScorers.slice(idx + 1).some(
          (second) => normalizeBookmakerName(second.bookmaker) === normalizeBookmakerName(first.bookmaker),
        ),
      );
      const secondSameBookieTeamScorer = sameBookieTeamPair
        ? selectedTeamScorers.find(
            (row) =>
              row.player !== sameBookieTeamPair.player &&
              normalizeBookmakerName(row.bookmaker) === normalizeBookmakerName(sameBookieTeamPair.bookmaker),
          )
        : undefined;

      if (sameBookieTeamPair && secondSameBookieTeamScorer && (projectedMargin >= 8 || selected.modelPct >= 58)) {
        const bookie = resolveSgmBookmaker(marketMap, match, sameBookieTeamPair.bookmaker);
        const h2hOddsForBookie = getH2hOddsForBookmaker(
          marketMap,
          match,
          selected.team,
          bookie,
          selected.odds,
        );
        addCombo(makeSgmCombo({
          id: `${matchKey}-team-attack-stack`,
          title: "Winning team attack stack",
          confidence: "Attack Stack",
          bookmaker: bookie,
          correlationMultiplier: 1.22,
          legs: [
            { label: `${selected.team} head-to-head`, typeLabel: "Head 2 Head", team: selected.team, modelPct: selected.modelPct, odds: h2hOddsForBookie },
            { label: sameBookieTeamPair.player, typeLabel: "Anytime try", team: sameBookieTeamPair.team, modelPct: sameBookieTeamPair.statsInsiderPct, odds: sameBookieTeamPair.bestOdds },
            { label: secondSameBookieTeamScorer.player, typeLabel: "Anytime try", team: secondSameBookieTeamScorer.team, modelPct: secondSameBookieTeamScorer.statsInsiderPct, odds: secondSameBookieTeamScorer.bestOdds },
          ],
        }));
      }

      const sameBookiePair = allScorers.find((first, idx) =>
        allScorers.slice(idx + 1).some(
          (second) => normalizeBookmakerName(second.bookmaker) === normalizeBookmakerName(first.bookmaker),
        ),
      );
      const secondSameBookieScorer = sameBookiePair
        ? allScorers.find(
            (row) =>
              row.player !== sameBookiePair.player &&
              normalizeBookmakerName(row.bookmaker) === normalizeBookmakerName(sameBookiePair.bookmaker),
          )
        : undefined;

      if (sameBookiePair && secondSameBookieScorer) {
        const bookie = resolveSgmBookmaker(marketMap, match, sameBookiePair.bookmaker);
        addCombo(makeSgmCombo({
          id: `${matchKey}-two-scorers`,
          title: "Two highest-probability scorers",
          confidence: "Scorer Pair",
          bookmaker: bookie,
          correlationMultiplier:
            normalizeTeamName(sameBookiePair.team) === normalizeTeamName(secondSameBookieScorer.team)
              ? 1.08
              : 0.96,
          legs: [
            { label: sameBookiePair.player, typeLabel: "Anytime try", team: sameBookiePair.team, modelPct: sameBookiePair.statsInsiderPct, odds: sameBookiePair.bestOdds },
            { label: secondSameBookieScorer.player, typeLabel: "Anytime try", team: secondSameBookieScorer.team, modelPct: secondSameBookieScorer.statsInsiderPct, odds: secondSameBookieScorer.bestOdds },
          ],
        }));
      }

      return {
        key: matchKey,
        match: match.match,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        selectedTeam: selected.team,
        projectedMargin,
        combos: combos.sort((a, b) => b.modelHitPct - a.modelHitPct),
      };
    })
    .filter((group) => group.combos.length > 0)
    .sort((a, b) => {
      const aOrder = fixtureOrder.get(a.key) ?? 999;
      const bOrder = fixtureOrder.get(b.key) ?? 999;
      return aOrder - bOrder;
    });
}

function SgmComboCard({ combo }: { combo: SgmCombo }) {
  const showHighProbBadge = combo.modelHitPct >= 50;

  return (
    <GlassCard className="p-5 md:p-6 relative overflow-hidden border-l-4 border-l-[#0047FF]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,71,255,0.08),transparent_55%)]" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-lg md:text-2xl font-black text-white tracking-tight">
              {combo.title}
            </div>
          </div>
          {showHighProbBadge ? (
            <span className="shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-[#00E676] text-black">
              High Prob
            </span>
          ) : null}
        </div>

        <div className="space-y-3 mb-5">
          {combo.legs.map((leg) => (
            <div key={`${combo.id}-${leg.label}`} className="flex items-start gap-3 bg-[#111317] border border-white/10 p-3">
              {leg.team ? (
                <TeamLogo teamName={leg.team} className="w-7 h-7 text-[10px]" />
              ) : (
                <div className="w-7 h-7 flex items-center justify-center bg-[#FFEA00] text-black shrink-0">
                  <Target className="w-4 h-4 stroke-[3px]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-[#FFEA00] font-black uppercase tracking-widest mb-1">
                  {leg.typeLabel}
                </div>
                <div className="text-sm font-black text-white uppercase tracking-wide leading-snug">
                  {leg.label}
                </div>
                <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">
                  Odds {leg.odds.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <div className="bg-[#111317] border border-white/10 p-3 max-w-[220px]">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">
              Est. odds
            </div>
            <div className="text-2xl font-black text-[#00E676]">
              {combo.estimatedOdds.toFixed(2)}
            </div>
            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">
              {combo.bookmaker}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SgmBuilderPage({
  data,
  onRequestAccess,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
}) {
  const [sgmMarketMap, setSgmMarketMap] = useState<SgmMarketMap>({});
  const groups = useMemo(
    () => buildSgmMatchGroups(data, sgmMarketMap),
    [data, sgmMarketMap],
  );
  const [selectedMatchKey, setSelectedMatchKey] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchLiveOddsCached()
      .then((rawOdds) => {
        if (mounted) setSgmMarketMap(buildSgmMarketMap(rawOdds));
      })
      .catch(() => {
        if (mounted) setSgmMarketMap({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!groups.length) {
      setSelectedMatchKey("");
      return;
    }
    setSelectedMatchKey((current) =>
      groups.some((group) => group.key === current) ? current : groups[0].key,
    );
  }, [groups]);

  const selectedGroup =
    groups.find((group) => group.key === selectedMatchKey) || groups[0];

  if (!hasPaidAccess()) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <GlassCard className="p-8 md:p-12 text-center !border-[#FF2E63] !shadow-[8px_8px_0_0_#FF2E63] relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,234,0,0.08),transparent_55%)]" />
          <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
            <div className="bg-[#FF2E63] p-4 mb-6 shadow-[4px_4px_0_0_#0047FF]">
              <Lock className="w-10 h-10 text-white stroke-[3px]" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-3">
              Premium Content
            </h2>
            <p className="text-sm md:text-base text-white/70 font-bold leading-relaxed mb-8">
              Same Game Multis are included with RightEdge Premium: cleaner same-bookie team, total and try-scorer combinations by match.
            </p>
            <button
              onClick={() => onRequestAccess("sgm-builder")}
              className="inline-flex items-center justify-center gap-3 bg-[#FF2E63] text-white px-8 py-4 text-base font-black uppercase tracking-wider hover:bg-[#E62959] transition-colors shadow-[4px_4px_0_0_#0047FF]"
            >
              Unlock Premium Plays — $14/week
              <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-1 md:mb-2">
            Same Game Multi Builder
          </h2>
          <div className="text-[10px] md:text-sm font-bold text-[#FFEA00] uppercase tracking-widest">
            Pick a match — high probability team + try scorer combinations
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <GlassCard className="p-8 text-center border-l-4 border-l-white/20">
          <div className="text-white/50 font-bold uppercase tracking-widest text-sm">
            No same game multi combos qualify yet.
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
          <div className="flex xl:flex-col gap-3 overflow-x-auto xl:overflow-visible pb-2 xl:pb-0">
            {groups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelectedMatchKey(group.key)}
                className={`min-w-[240px] xl:min-w-0 text-left p-4 border-2 transition-colors ${
                  selectedGroup?.key === group.key
                    ? "border-[#FFEA00] bg-[#1E232B] shadow-[4px_4px_0_0_#FF2E63]"
                    : "border-white/10 bg-[#111317] hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <TeamLogo teamName={group.homeTeam} className="w-7 h-7 text-[10px]" />
                  <TeamLogo teamName={group.awayTeam} className="w-7 h-7 text-[10px]" />
                </div>
                <div className="text-sm font-black text-white uppercase tracking-tight">
                  {group.match}
                </div>
                <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-2">
                  {group.combos.length} combos
                </div>
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {selectedGroup && (
              <div className="space-y-5">
                <GlassCard className="p-5 border-l-4 border-l-[#FFEA00]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="text-2xl font-black text-white uppercase tracking-tight">
                        {selectedGroup.match}
                      </div>
                      <div className="text-xs font-black text-[#FFEA00] uppercase tracking-widest mt-2">
                        Highest probability side: {selectedGroup.selectedTeam}
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      Projected margin {selectedGroup.projectedMargin.toFixed(0)}
                    </div>
                  </div>
                </GlassCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {selectedGroup.combos.map((combo) => (
                    <SgmComboCard key={combo.id} combo={combo} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-widest text-white/30 leading-relaxed">
        SGM prices can move inside bookmaker apps. Estimated odds use the listed bookmaker where available.
      </div>
    </div>
  );
}

function AnalyticsPage({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <MetricCard
          label="Settled bets"
          value={String(data.settledBets)}
          subtext="Only resolved bets included here"
          icon={<Trophy className="w-5 h-5" />}
          accent="green"
        />
        <MetricCard
          label="Average settled CLV"
          value={formatPercent(data.avgClv, 2)}
          subtext="Best leading indicator of model quality"
          icon={<Target className="w-5 h-5" />}
          accent="gold"
        />
        <MetricCard
          label="Net profit"
          value={formatSignedCurrency(data.totalProfit, 2)}
          subtext="Settled realised profit"
          icon={<DollarSign className="w-5 h-5" />}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        <GlassCard className="p-4 md:p-8 border-l-4 border-l-[#FF2E63]">
          <SectionHeader
            title="Profit by team"
            subtitle="Which teams have actually made or lost you money"
          />
          <div className="h-[250px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.teamPerformance}
                layout="vertical"
                margin={{
                  top: 0,
                  right: 16,
                  left: 16,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  horizontal
                  vertical={false}
                />
                <XAxis
                  type="number"
                  tick={{
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="team"
                  type="category"
                  tick={{
                    fill: "rgba(255,255,255,0.8)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatCurrency(Number(value), 2),
                    "Profit",
                  ]}
                  contentStyle={{
                    background: "#16161D",
                    border: "1px solid #1E1E2E",
                    borderRadius: "0px",
                    color: "#fff",
                    fontWeight: "500",
                    boxShadow: "none",
                  }}
                />
                <Bar dataKey="profit" radius={[0, 0, 0, 0]}>
                  {data.teamPerformance.map((row, idx) => (
                    <Cell
                      key={`team-${row.team}-${idx}`}
                      fill={
                        row.profit >= 0 ? "#00E676" : "#F87171"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 md:p-8 border-l-4 border-l-[#FFEA00]">
          <SectionHeader
            title="Outcome mix"
            subtitle="Wins, losses and live pending bets"
          />
          <div className="h-[250px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "#16161D",
                    border: "1px solid #1E1E2E",
                    borderRadius: "0px",
                    color: "#FFFFFF",
                    fontWeight: "500",
                    boxShadow: "none",
                  }}
                />
                <Pie
                  data={data.outcomeMix}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {data.outcomeMix.map((entry, index) => (
                    <Cell
                      key={`pie-cell-2-${index}`}
                      fill={
                        ["#00E676", "#F87171", "#6B7280"][index]
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-6 mt-6">
            <div className="bg-[#111317] border-2 border-[#00E676] shadow-[2px_2px_0_0_#00E676] md:shadow-[4px_4px_0_0_#00E676] p-2 md:p-4 text-center">
              <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1">
                Wins
              </div>
              <div className="text-xl md:text-3xl font-black text-[#00E676]">
                {data.wins}
              </div>
            </div>
            <div className="bg-[#111317] border-2 border-[#FF2E63] shadow-[2px_2px_0_0_#FF2E63] md:shadow-[4px_4px_0_0_#FF2E63] p-2 md:p-4 text-center">
              <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1">
                Losses
              </div>
              <div className="text-xl md:text-3xl font-black text-[#FF2E63]">
                {data.losses}
              </div>
            </div>
            <div className="bg-[#111317] border-2 border-[#0047FF] shadow-[2px_2px_0_0_#0047FF] md:shadow-[4px_4px_0_0_#0047FF] p-2 md:p-4 text-center">
              <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1">
                Pending
              </div>
              <div className="text-xl md:text-3xl font-black text-[#0047FF]">
                {data.pendingBets}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function RoundSwitcher({
  liveLabel,
  selectedArchiveRound,
  onSelectArchiveRound,
}: {
  liveLabel: string;
  selectedArchiveRound: number | null;
  onSelectArchiveRound: (round: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedArchive = ROUND_ARCHIVES.find((archive) => archive.round === selectedArchiveRound) || null;
  const label = selectedArchive ? selectedArchive.label : `${liveLabel} Live`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 bg-[#16161D] px-3 md:px-4 py-1.5 md:py-2 border border-[#1E1E2E] text-left transition hover:border-white/25"
      >
        {!selectedArchive && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping-pong rounded-full bg-[#00E676] opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00E676]" />
          </span>
        )}
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[220px] border border-[#1E1E2E] bg-[#111116] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={() => {
              onSelectArchiveRound(null);
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest transition ${
              !selectedArchive
                ? "bg-white text-[#0A0A0F]"
                : "text-[#9CA3AF] hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <span>{liveLabel} Live</span>
            <span className="h-2 w-2 bg-[#00E676]" />
          </button>
          {ROUND_ARCHIVES.map((archive) => (
            <button
              key={archive.round}
              type="button"
              onClick={() => {
                onSelectArchiveRound(archive.round);
                setOpen(false);
              }}
              className={`mt-1 flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest transition ${
                selectedArchive?.round === archive.round
                  ? "bg-white text-[#0A0A0F]"
                  : "text-[#9CA3AF] hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span>{archive.label}</span>
              <span className="text-[8px] opacity-70">{archive.matchPlays.length} plays</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppDashboard({
  data,
  loading,
  error,
  refreshing,
  loadData,
  onExit,
  onRequestAccess,
  isPremium,
}: {
  data: DashboardData | null;
  loading: boolean;
  error: string;
  refreshing: boolean;
  loadData: (isRefresh?: boolean) => void;
  onExit: () => void;
  onRequestAccess: (targetHash?: string) => void;
  isPremium: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(() => isUserAdmin());
  const canViewOrigin = canViewOriginPage();

  useEffect(() => {
    const handleAdminAuth = () => {
      setIsAdmin(isUserAdmin());
      setAuthState({ ...runtimeAuthState });
      setPaidAccessState(hasPaidAccess());
    };
    window.addEventListener('adminAuthChanged', handleAdminAuth);
    return () => window.removeEventListener('adminAuthChanged', handleAdminAuth);
  }, []);

  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "origin" && !canViewOriginPage()) {
      return "matches";
    }
    if (
      ["matches", "origin", "best-bets", "try-scorers", "performance", "admin", "admin-results"].includes(
        hash,
      )
    ) {
      return hash;
    }
    return "matches";
  });
  const [selectedArchiveRound, setSelectedArchiveRound] = useState<number | null>(null);
  const [showRetentionOffer, setShowRetentionOffer] = useState(false);
  // Bumped after KV-derived (rolled-over) archives register so the archive
  // dropdown + selected-archive lookup re-read the module-level registry.
  const [archiveVersion, setArchiveVersion] = useState(0);

  // REQ3 rollover: load archives for rounds past their Tuesday boundary and
  // register them so they render through the same dropdown UI as ROUND_14_PROOF.
  useEffect(() => {
    if (!data) return;
    const rounds = getArchivedRoundNumbers(data, Date.now());
    if (rounds.length === 0) return;
    let mounted = true;
    loadKvDerivedArchivesForRounds(rounds).then((archives) => {
      if (!mounted || archives.length === 0) return;
      registerKvDerivedArchives(archives);
      setArchiveVersion((v) => v + 1);
    });
    return () => {
      mounted = false;
    };
  }, [data]);

  const selectedRoundArchive = useMemo(
    () => ROUND_ARCHIVES.find((archive) => archive.round === selectedArchiveRound) || null,
    [selectedArchiveRound, archiveVersion],
  );

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "origin" && !canViewOrigin) {
        setPage("matches");
        window.history.replaceState({}, document.title, `${window.location.pathname}#matches`);
        return;
      }
      if (
        [
          "matches",
          "origin",
          "best-bets",
          "try-scorers",
          "performance",
          "admin",
          "admin-results",
        ].includes(hash)
      ) {
        setPage(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () =>
      window.removeEventListener(
        "hashchange",
        handleHashChange,
      );
  }, [canViewOrigin]);

  useEffect(() => {
    if (page === "origin" && !canViewOrigin) {
      setPage("matches");
      window.history.replaceState({}, document.title, `${window.location.pathname}#matches`);
    }
  }, [canViewOrigin, page]);

  const handlePageChange = (newPage: string) => {
    if (newPage === "origin" && !canViewOrigin) {
      onRequestAccess("origin");
      return;
    }
    setPage(newPage);
    window.location.hash = newPage;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const mobilePages = useMemo(() => getAppPages(isAdmin, canViewOrigin), [canViewOrigin, isAdmin]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);

  const openCustomerPortal = async () => {
    try {
      const email = getUserEmail();
      if (!email) {
        alert("Could not find your email. Please try logging in again.");
        return;
      }

      const res = await fetch(`/api/create-customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email,
          returnUrl: window.location.href
        })
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      } else {
        throw new Error(data.error || "Failed to open subscription portal.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error. Please try again later.";
      alert(message);
      throw err;
    }
  };

  const handleManageSubscription = () => {
    void openCustomerPortal();
  };

  const handleCancelPremiumClick = () => {
    const email = getUserEmail();
    if (!email) {
      alert("Could not find your email. Please try logging in again.");
      return;
    }

    setShowRetentionOffer(true);
  };

  const pageTitle = useMemo(() => {
    switch (page) {
      case "matches":
        return {
          subtitle: "Matches",
        };
      case "origin":
        return {
          title: "Premium",
          subtitle: "State of Origin",
        };
      case "best-bets":
        return {
          title: "Premium",
          subtitle: "Premium Plays",
        };
      case "try-scorers":
        return {
          title: "Premium",
          subtitle: "Try Scorer Value Plays",
        };
      case "performance":
        return {
          subtitle: "Performance",
        };
      case "admin":
        return {
          title: "Admin",
          subtitle: "Email broadcast dashboard",
        };
      default:
        return {
          title: "Matches",
          subtitle: "Model predictions and pricing",
        };
    }
  }, [page]);

  return (
    <>
      <RetentionOfferModal
        open={showRetentionOffer}
        onClose={() => setShowRetentionOffer(false)}
        onContinueToBilling={openCustomerPortal}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-8 pb-24 xl:pb-0">
        <GlassCard className="hidden xl:block p-6 h-fit xl:sticky xl:top-6">
          <div className="flex items-center gap-4 pb-6 border-b border-[#1E1E2E] mb-6">
            <div>
              <div className="text-4xl font-semibold tracking-tight text-white uppercase">
                RightEdge
              </div>
              <div className="text-xs text-[#9CA3AF] font-medium tracking-widest uppercase mt-2">
                NRL Predictions • 2026
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {getAppPages(isAdmin, canViewOrigin).map((item) => (
              <SidebarItem
                key={item.id}
                active={page === item.id}
                icon={item.icon}
                label={item.label}
                premium={item.id === "origin" || item.id === "best-bets" || item.id === "try-scorers"}
                onClick={() => {
                  handlePageChange(item.id);
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              />
            ))}
          </div>

          <div className="mt-10 bg-[#16161D] border border-[#1E1E2E] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-[#9CA3AF] font-medium">
                Live status
              </div>
              <button
                onClick={() => loadData(true)}
                className="text-[#9CA3AF] hover:text-white transition-colors"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="inline-flex items-center gap-2 bg-[#16161D] border border-[#1E1E2E] px-3 py-1.5 text-white text-xs font-medium uppercase tracking-widest">
              <span className="w-2.5 h-2.5 bg-black" />
              Active
            </div>
            <div className="mt-4 text-sm text-white/70 leading-relaxed font-bold">
            </div>
            <button 
              onClick={handleManageSubscription}
              className="mt-6 w-full flex items-center justify-center gap-2 re-secondary-cta border py-3 text-xs font-medium uppercase tracking-widest transition hover:opacity-80"
            >
              Manage Subscription
            </button>
            <button
              onClick={handleCancelPremiumClick}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-[#1E1E2E] py-3 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF] transition hover:border-[#C74343]/50 hover:text-[#C74343]"
            >
              Cancel Premium
            </button>
          </div>
        </GlassCard>

        <div className="min-w-0 flex flex-col gap-4 md:gap-8">
          <div className="xl:hidden flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={onExit}
                className="flex items-center gap-2 text-[#6B7280] text-[10px] font-medium uppercase tracking-widest hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Home
              </button>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={handleManageSubscription}
                  className="text-[#6B7280] text-[10px] font-medium uppercase tracking-widest hover:text-white transition-colors"
                >
                  Manage Subscription
                </button>
                <button
                  onClick={handleCancelPremiumClick}
                  className="text-[#8D2323] text-[10px] font-medium uppercase tracking-widest hover:text-[#C74343] transition-colors"
                >
                  Cancel Premium
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 md:gap-6 pb-4 md:pb-6 border-b border-[#1E1E2E]">
            <div className="flex justify-between items-start xl:block">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#9CA3AF] font-medium mb-1 md:mb-2">
                  {pageTitle.title}
                </div>
                <h1 className="text-[18px] md:text-4xl font-semibold tracking-tight text-white uppercase leading-none">
                  {pageTitle.subtitle}
                </h1>
              </div>
              <button
                onClick={() => loadData(true)}
                className="xl:hidden bg-[#16161D] p-2 border border-[#1E1E2E] text-white shrink-0 ml-4 mt-1"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-sm text-white font-medium uppercase tracking-wider mt-2 xl:mt-0">
              {page === "matches" ? (
                <RoundSwitcher
                  liveLabel={data?.currentRoundLabel || "Round 1"}
                  selectedArchiveRound={selectedArchiveRound}
                  onSelectArchiveRound={setSelectedArchiveRound}
                />
              ) : (
                <span className="inline-flex items-center gap-2 bg-[#16161D] px-3 md:px-4 py-1.5 md:py-2 border border-[#1E1E2E]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping-pong rounded-full bg-[#00E676] opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00E676]" />
                  </span>
                  <span>{data?.currentRoundLabel || "Round 1"} Live</span>
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-10 h-10 mx-auto mb-6 animate-spin text-white" />
                <div className="text-white font-semibold text-xl mb-2 uppercase tracking-tight">
                  Loading live sheet data
                </div>
                <div className="text-[#9CA3AF] text-sm font-medium uppercase tracking-wider">
                  Pulling Match Predictions, Bet Log, Fixtures
                  and Performance Tracker
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <GlassCard className="p-10 max-w-[560px] w-full">
                <div className="text-4xl font-semibold text-white mb-4 uppercase tracking-tight">
                  Couldn’t load live data
                </div>
                <div className="text-[#9CA3AF] mb-8 whitespace-pre-line font-normal">
                  {error}
                </div>
                <button
                  onClick={() => loadData()}
                  className="inline-flex items-center gap-3 re-primary-cta border px-8 py-4 font-medium hover:opacity-90 uppercase tracking-wide transition"
                >
                  <RefreshCw className="w-5 h-5 stroke-[3px]" />
                  Retry
                </button>
              </GlassCard>
            </div>
          ) : data ? (
            <>
              {page === "best-bets" && (
                <BestBetsPage
                  data={data}
                  onRequestAccess={onRequestAccess}
                  isPremium={isPremium}
                  isAdmin={isAdmin}
                />
              )}
              {page === "matches" && (
                <PredictionsPage
                  data={data}
                  onRequestAccess={onRequestAccess}
                  isPremium={isPremium || isAdmin}
                  isAdmin={isAdmin}
                  selectedArchive={selectedRoundArchive}
                />
              )}
              {page === "origin" && canViewOrigin && (
                <OriginPage
                  onRequestAccess={onRequestAccess}
                  isAdmin={isAdmin}
                />
              )}
              {page === "try-scorers" && (
                <TryScorersPage
                  data={data}
                  onRequestAccess={onRequestAccess}
                  isPremium={isPremium}
                  isAdmin={isAdmin}
                />
              )}
              {page === "admin" && (
                <AdminDashboard
                  data={data}
                  onNavigateAdStudio={() => {
                    window.location.hash = "ad-studio";
                  }}
                />
              )}
              {page === "admin-results" && isAdmin && (
                <AdminResultsPage data={data} isAdmin={isAdmin} />
              )}
              {page === "performance" && (
                <div className="space-y-8">
                  <ResultsPage data={data} />
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="rightedge-mobile-bottom-nav xl:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0F] border-t border-[#1E1E2E] z-[100] px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div
          className="grid gap-1 items-stretch"
          style={{ gridTemplateColumns: `repeat(${mobilePages.length}, minmax(0, 1fr))` }}
        >
        {mobilePages.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              handlePageChange(item.id);
            }}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-sm border px-1 py-2 transition-all ${
              page === item.id
                ? "border-[#2A2A3A] bg-[#16161D] text-white"
                : "border-transparent text-[#6B7280] hover:text-white"
            }`}
          >
            <div className="shrink-0">{item.icon}</div>
            <span className="max-w-full truncate text-[9px] sm:text-[10px] font-medium uppercase tracking-wider">
              {item.mobileLabel || item.label}
            </span>
          </button>
        ))}
        </div>
      </div>
    </>
  );
}

function AdStudio({
  onExit,
  data,
}: {
  onExit: () => void;
  data: DashboardData | null;
}) {
  const [matchIndex, setMatchIndex] = useState(0);
  const [view, setView] = useState<"story" | "pfp">("story");

  // Use the selected match from the current predictions data, or a fallback if not loaded
  const match = data?.predictions?.[matchIndex];
  const totalMatches = data?.predictions?.length || 1;

  const homeTeam = match?.homeTeam || "Broncos";
  const awayTeam = match?.awayTeam || "Roosters";
  const homeScore =
    match?.predictedHomeScore.toFixed(1) || "24.8";
  const awayScore =
    match?.predictedAwayScore.toFixed(1) || "16.2";

  // Calculate win probability from model odds
  const homeProb = match
    ? (1 / match.modelHomeOdds) * 100
    : 68.5;
  const awayProb = match
    ? (1 / match.modelAwayOdds) * 100
    : 31.5;
  const winProb = Math.max(homeProb, awayProb).toFixed(1);

  // Determine the value play for the ad based on Edge (Market vs True)
  const homeTrueOdds = match?.modelHomeOdds || 1.45;
  const awayTrueOdds = match?.modelAwayOdds || 3.15;
  const homeBookieOdds = match?.marketHomeOdds || 1.85;
  const awayBookieOdds = match?.marketAwayOdds || 2.1;

  const homeEdge =
    (1 / homeTrueOdds - 1 / homeBookieOdds) * 100;
  const awayEdge =
    (1 / awayTrueOdds - 1 / awayBookieOdds) * 100;

  const valueIsHome = homeEdge >= awayEdge;
  const favoredTeam = valueIsHome ? homeTeam : awayTeam;
  const trueOdds = valueIsHome ? homeTrueOdds : awayTrueOdds;
  const bookieOdds = valueIsHome
    ? homeBookieOdds
    : awayBookieOdds;

  const edgePct = Math.max(homeEdge, awayEdge).toFixed(1);
  const hasEdge = Math.max(homeEdge, awayEdge) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-center overflow-hidden p-4 md:p-8">
      <div className="w-full max-w-[450px] mb-4 flex items-center justify-between shrink-0 z-[60]">
        <button
          onClick={onExit}
          className="bg-[#FF2E63] text-white px-4 py-2 font-black uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          Close
        </button>

        {/* Toggle Controls */}
        <div className="flex bg-[#111317] border-2 border-white/10 p-1">
          <button
            onClick={() => setView("story")}
            className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${view === "story" ? "bg-[#FFEA00] text-black" : "text-white/50 hover:text-white"}`}
          >
            Ad
          </button>
          <button
            onClick={() => setView("pfp")}
            className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${view === "pfp" ? "bg-[#FFEA00] text-black" : "text-white/50 hover:text-white"}`}
          >
            Logo
          </button>
        </div>

        {/* Match Navigator Controls (Only for Story View) */}
        {view === "story" ? (
          <div className="flex items-center gap-2 bg-[#111317] border-2 border-white/10 p-1">
            <button
              onClick={() =>
                setMatchIndex(Math.max(0, matchIndex - 1))
              }
              disabled={matchIndex === 0}
              className="p-1 text-white/50 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white text-xs font-black uppercase tracking-widest px-2">
              Match {matchIndex + 1}
            </span>
            <button
              onClick={() =>
                setMatchIndex(
                  Math.min(totalMatches - 1, matchIndex + 1),
                )
              }
              disabled={matchIndex === totalMatches - 1}
              className="p-1 text-white/50 hover:text-white disabled:opacity-30 transition-colors transform rotate-180"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="w-[100px]" /> /* Spacer to keep flex layout balanced */
        )}
      </div>

      {view === "pfp" ? (
        /* 1080x1080 Square IG Profile Picture View (1:1) */
        <div className="relative w-full max-w-[400px] aspect-square bg-[#000000] border-2 border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {/* Subtle circle overlay to show IG crop area */}
          <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none m-4" />

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
            {/* The "Severed Edge" - Pure visual identity, no text */}
            <svg
              viewBox="0 0 120 120"
              className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] transform hover:scale-105 transition-transform duration-700"
            >
              {/* Main Monolith Base */}
              <polygon
                points="19,101 89,101 89,71 49,31 19,31"
                fill="#FFFFFF"
              />
              {/* The Severed Right Edge (Shifted diagonally up and right) */}
              <polygon
                points="61,19 101,19 101,59"
                fill="#FFFFFF"
              />
            </svg>
          </div>

          <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-white/30 uppercase font-black tracking-widest pointer-events-none">
            Screenshot Square
          </div>
        </div>
      ) : (
        /* 1080x1920 IG Story Container Aspect Ratio (9:16) */
        <div className="@container relative w-full h-full max-h-[80vh] aspect-[9/16] bg-[#000000] border-2 border-white/10 flex flex-col justify-between overflow-hidden shadow-[0_0_100px_rgba(255,46,99,0.15)] shrink-0">
          {/* Glow */}
          <div className="absolute top-0 right-0 w-[120cqw] h-[120cqw] bg-[#FF2E63] blur-[20cqw] opacity-[0.2] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[100cqw] h-[100cqw] bg-[#0047FF] blur-[20cqw] opacity-[0.15] rounded-full pointer-events-none transform -translate-x-1/3 translate-y-1/3" />

          {/* Header Text */}
          <div className="px-[8cqw] relative z-10 pt-[12cqw]">
            <h1 className="text-[8cqw] leading-[0.95] font-black text-white uppercase tracking-tight">
              The NRL predictive model <br />
              <span className="text-[#FF2E63]">
                they don't want you to have.
              </span>
            </h1>
          </div>

          {/* Featured Mockup */}
          <div className="px-[8cqw] relative z-10 flex flex-col items-center justify-center w-full my-[2cqw]">
            <div className="w-full bg-[#111317] border-[0.6cqw] border-[#FF2E63] shadow-[2cqw_2cqw_0_0_#FF2E63] p-[4cqw] relative transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="absolute -top-[3cqw] -right-[3cqw] w-[8cqw] h-[8cqw] bg-[#FF2E63] flex items-center justify-center shadow-[-0.8cqw_0.8cqw_0_0_rgba(0,0,0,0.5)] transform rotate-12">
                <Flame className="w-[4cqw] h-[4cqw] text-white" />
              </div>

              <div className="text-[2.5cqw] font-black text-[#FFEA00] uppercase tracking-widest mb-[4cqw] text-center">
                Projected Final Score
              </div>

              <div className="flex items-center justify-between mb-[4cqw]">
                <div className="flex flex-col items-center gap-[1.5cqw] w-[40%]">
                  <TeamLogo
                    teamName={homeTeam}
                    className="w-[14cqw] h-[14cqw] text-[6cqw] border-[0.4cqw]"
                  />
                  <div className="text-[3.5cqw] font-black text-white uppercase tracking-tight text-center leading-none mt-[1cqw]">
                    {homeTeam}
                  </div>
                </div>

                <div className="text-[5cqw] font-black text-white/20 uppercase tracking-widest">
                  VS
                </div>

                <div className="flex flex-col items-center gap-[1.5cqw] w-[40%]">
                  <TeamLogo
                    teamName={awayTeam}
                    className="w-[14cqw] h-[14cqw] text-[6cqw] border-[0.4cqw]"
                  />
                  <div className="text-[3.5cqw] font-black text-white uppercase tracking-tight text-center leading-none mt-[1cqw]">
                    {awayTeam}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[1.5cqw] relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-[0.3cqw] bg-white/10 -translate-x-1/2" />
                <div className="p-[1.5cqw] text-center">
                  <div className="text-[1.8cqw] uppercase tracking-widest text-white/50 font-black mb-[0.8cqw]">
                    Projected
                  </div>
                  <div
                    className={`text-[10cqw] font-black leading-none ${Number(homeScore) > Number(awayScore) ? "text-[#FFEA00]" : "text-white/50"}`}
                  >
                    {homeScore}
                  </div>
                </div>
                <div className="p-[1.5cqw] text-center">
                  <div className="text-[1.8cqw] uppercase tracking-widest text-white/50 font-black mb-[0.8cqw]">
                    Projected
                  </div>
                  <div
                    className={`text-[10cqw] font-black leading-none ${Number(awayScore) > Number(homeScore) ? "text-[#FFEA00]" : "text-white/50"}`}
                  >
                    {awayScore}
                  </div>
                </div>
              </div>

              <div className="mt-[4cqw] flex justify-center border-t-[0.4cqw] border-white/10 pt-[3cqw]">
                <div className="w-full text-center">
                  <div
                    className={`inline-block text-white px-[2cqw] py-[0.5cqw] text-[1.8cqw] font-black uppercase tracking-widest mb-[2cqw] ${hasEdge ? "bg-[#00E676] text-black" : "bg-[#FF2E63]"}`}
                  >
                    {hasEdge
                      ? `+${edgePct}% Positive EV Edge`
                      : `The Value Play: ${favoredTeam}`}
                  </div>

                  <div className="flex justify-between items-center bg-[#1E232B] border-[0.2cqw] border-white/10 p-[2cqw]">
                    <div className="w-1/2 text-center border-r-[0.2cqw] border-white/10">
                      <div className="text-[1.5cqw] uppercase tracking-widest text-white/50 font-black mb-[0.5cqw]">
                        Bookie Odds
                      </div>
                      <div className="text-[4cqw] font-black text-white/50 line-through decoration-[#FF2E63] decoration-[0.4cqw]">
                        ${Number(bookieOdds).toFixed(2)}
                      </div>
                    </div>
                    <div className="w-1/2 text-center">
                      <div className="text-[1.5cqw] uppercase tracking-widest text-[#FFEA00] font-black mb-[0.5cqw]">
                        True Odds
                      </div>
                      <div className="text-[6cqw] font-black leading-none text-[#FFEA00]">
                        ${Number(trueOdds).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic CTA */}
          <div className="relative z-10 flex flex-col items-center pb-[10cqw] px-[8cqw]">
            <div className="bg-[#FFEA00] px-[5cqw] py-[3cqw] flex items-center justify-center gap-[2cqw] shadow-[1cqw_1cqw_0_0_#FF2E63] mb-[6cqw] w-[95%] mx-auto border-[0.4cqw] border-black">
              <span className="text-[4.5cqw] font-black text-black uppercase tracking-tighter text-center leading-none">
                Check Our Profile For
                <br />
                This Round's Best Bets
              </span>
            </div>

            <div className="text-center">
              <div className="text-[4cqw] font-black text-white uppercase tracking-widest">
                Link In Bio • Premium Access
              </div>
            </div>

            <div className="mt-[4cqw] animate-bounce">
              <ChevronDown className="w-[8cqw] h-[8cqw] text-[#FFEA00] transform rotate-180" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [sitePage, setSitePage] = useState("home");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [emailGateTarget, setEmailGateTarget] = useState<"app" | "cricket">("app");
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [authState, setAuthState] = useState<RuntimeAuthState>(() => runtimeAuthState);
  const [paidAccessState, setPaidAccessState] = useState(() => hasPaidAccess());
  const [isAdmin, setIsAdmin] = useState(() => isUserAdmin());

  const applyAuthState = (nextState: RuntimeAuthState) => {
    updateRuntimeAuthState(nextState);
    setAuthState(nextState);
    setPaidAccessState(nextState.tier === "premium");
    setIsAdmin(isUserAdmin());

    if (nextState.email && ADMIN_EMAILS.includes(nextState.email)) {
      localStorage.setItem("rightedge_internal_visitor", "true");
    }
  };

  const refreshAuthSession = async (): Promise<RuntimeAuthState> => {
    try {
      const res = await fetch(`/api/auth/session`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.authenticated && data.email) {
        const nextState: RuntimeAuthState = {
          checked: true,
          email: String(data.email).trim().toLowerCase(),
          tier: data.tier === "premium" ? "premium" : "free",
        };
        applyAuthState(nextState);
        return nextState;
      }

      const nextState: RuntimeAuthState = {
        checked: true,
        email: null,
        tier: "none",
      };
      applyAuthState(nextState);
      return nextState;
    } catch {
      const nextState: RuntimeAuthState = {
        checked: true,
        email: null,
        tier: "none",
      };
      applyAuthState(nextState);
      return nextState;
    }
  };

  // Setup Analytics Tracking (meta tags now handled by <Helmet> — rendered synchronously)
  useEffect(() => {
    // Advanced Traffic Tracking
    const trackAnalyticsEvent = async (type: string, data: any = {}) => {
      // ── Visitor ID: stable anonymous ID, persisted in localStorage ──────────
      // This is the PRIMARY unique-visitor identifier. It is generated once on
      // first visit and never changes, regardless of whether the user provides
      // an email. No IP address is used for identification.
      let visitorId = localStorage.getItem('rightedge_visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('rightedge_visitor_id', visitorId);
      }

      // ── Session ID: scoped to tab lifetime via sessionStorage ────────────────
      let sessionId = sessionStorage.getItem('rightedge_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('rightedge_session_id', sessionId);
      }

      // ── Parse UTMs ───────────────────────────────────────────────────────────
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || '';
      const utmMedium = urlParams.get('utm_medium') || '';
      const utmCampaign = urlParams.get('utm_campaign') || '';

      // Infer source if no UTM
      let inferredSource = utmSource;
      if (!inferredSource) {
        const ref = document.referrer.toLowerCase();
        if (ref.includes('reddit.com')) inferredSource = 'reddit';
        else if (ref.includes('discord.com')) inferredSource = 'discord';
        else if (ref.includes('t.co') || ref.includes('twitter.com')) inferredSource = 'x';
        else if (ref.includes('google.com')) inferredSource = 'google';
        else if (ref) inferredSource = 'referral';
        else inferredSource = 'direct';
      }

      // ── Internal traffic detection ───────────────────────────────────────────
      // Any single true condition marks the entire event as internal.
      // When detected, we also write rightedge_internal_visitor to localStorage
      // so that ALL future sessions from this browser are immediately internal —
      // even before any email is entered.
      let isInternal = false;

      // 0. This visitor_id was previously marked internal (persisted across sessions)
      if (localStorage.getItem('rightedge_internal_visitor') === 'true') isInternal = true;

      // 1. Manual override flag
      if (localStorage.getItem('rightedge_internal_traffic') === 'true') isInternal = true;

      // 2. Admin panel authenticated (current or past session this visit)
      if (localStorage.getItem('rightedge_admin_auth') === 'true') isInternal = true;

      const visitorEmail = getUserEmail();

      // 3. Current page is the admin route
      if (window.location.hash.toLowerCase().includes('admin')) isInternal = true;

      // Persist internal status permanently for this browser so the very first
      // pageview of a future session is already correctly flagged.
      if (isInternal) {
        localStorage.setItem('rightedge_internal_visitor', 'true');
      }

      // ── Device detection ─────────────────────────────────────────────────────
      const ua = navigator.userAgent;
      let device = 'desktop';
      if (/mobile/i.test(ua)) device = 'mobile';
      if (/ipad|tablet/i.test(ua)) device = 'tablet';

      const payload = {
        type,
        path: window.location.hash || "home",
        url: window.location.href,
        referrer: document.referrer,
        utm_source: inferredSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        visitor_id: visitorId,
        session_id: sessionId,
        // visitor_email is only set after login — links the anonymous visitor_id
        // to a known identity without requiring email entry for earlier events.
        ...(visitorEmail ? { visitor_email: visitorEmail } : {}),
        device,
        user_agent: ua,
        is_internal: isInternal,
        is_subscriber: hasPaidAccess(),
        ...data
      };

      if (visitorEmail) {
        identifyPostHogUser(visitorEmail, {
          tier: authState.tier,
          is_subscriber: hasPaidAccess(),
          visitor_id: visitorId,
        });
      }

      capturePostHogEvent(type, payload);
      trackLinkedInConversion(type);

      try {
        await fetch(`/api/track-event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": publicAnonKey,
            "Authorization": `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Failed to track event:", err);
      }
    };

    // Track pageview on route change (excluding admin views)
    if (sitePage !== 'admin') {
      trackAnalyticsEvent(`${sitePage}_view`);
    }

    // Expose globally for other components to track events like clicks/conversions
    (window as any).trackAnalyticsEvent = trackAnalyticsEvent;
  }, [sitePage, authState.email, authState.tier]);

  useEffect(() => {
    const handleAdminAuth = () => {
      setIsAdmin(isUserAdmin());
    };
    window.addEventListener('adminAuthChanged', handleAdminAuth);
    return () => window.removeEventListener('adminAuthChanged', handleAdminAuth);
  }, []);

  const trackHashPageView = (hashValue?: string) => {
    const rawHash = (hashValue ?? window.location.hash.replace("#", "")) || "home";
    const analyticsName = rawHash.replace(/-/g, "_");
    (window as any).trackAnalyticsEvent?.(`${analyticsName}_view`, {
      section: rawHash,
      app_section: ["matches", "origin", "best-bets", "try-scorers", "performance", "admin", "admin-results"].includes(rawHash),
    });
  };

  const navigateToApp = (source: string = 'unknown') => {
    (window as any).trackAnalyticsEvent?.('unlock_click', { cta_source: source });
    if (hasEmailAccess()) {
      setSitePage("app");
      window.location.hash = "matches";
    } else {
      setEmailGateTarget("app");
      setShowEmailGate(true);
    }
  };

  const requestCricketAccess = () => {
    if (canAccessCricketPrototype(authState.email)) {
      setSitePage("cricket");
      window.location.hash = "cricket";
      return;
    }
    setEmailGateTarget("cricket");
    setShowEmailGate(true);
  };

  const requestPremiumAccess = (source: string = 'unknown') => {
    let targetHash = ["matches", "origin", "best-bets", "try-scorers"].includes(source)
      ? source
      : "best-bets";
    if (targetHash === "origin" && !canViewOriginPage()) {
      targetHash = "matches";
    }
    setSitePage("app");
    window.location.hash = targetHash;
    setShowEmailGate(false);
    if (hasPaidAccess() || isUserAdmin()) {
      setPaidAccessState(hasPaidAccess());
      setShowPaymentGate(false);
      return;
    }

    const knownEmail = getUserEmail();
    if (hasEmailAccess() && knownEmail) {
      (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
        email: knownEmail,
        section: targetHash,
        cta_source: source,
        flow: "known_email_button",
      });
      setShowPaymentGate(true);
      return;
    }

    (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
      section: targetHash,
      cta_source: source,
    });
    setShowPaymentGate(true);
  };

  const checkHash = () => {
    const hash = window.location.hash.replace("#", "");
    const appHashes = ["matches", "origin", "best-bets", "try-scorers", "performance", "admin", "admin-results"];
    const premiumHashes = ["origin", "best-bets", "try-scorers"];
    const publicHashes = ["results", "methodology", "ad-studio", "articles", "article-round-5-2026", "article-methodology", "cricket"];

    if (hash === "origin" && !canViewOriginPage()) {
      window.history.replaceState({}, document.title, `${window.location.pathname}#matches`);
      trackHashPageView("matches");
      setShowEmailGate(false);
      setShowPaymentGate(false);
      if (hasEmailAccess() || hasPaidAccess()) {
        setSitePage("app");
      } else {
        setSitePage("home");
      }
      return;
    }

    if (hash === "sgm-builder") {
      window.location.hash = "best-bets";
      return;
    }

    if (premiumHashes.includes(hash)) {
      trackHashPageView(hash);
      setSitePage("app");
      setShowEmailGate(false);

      if (hasPaidAccess() || isUserAdmin()) {
        setPaidAccessState(hasPaidAccess());
        setShowPaymentGate(false);
      } else if (hasEmailAccess() && getUserEmail()) {
        let shouldSuppressCheckoutReturn = false;
        try {
          shouldSuppressCheckoutReturn = Boolean(sessionStorage.getItem(PREMIUM_CHECKOUT_RETURN_GUARD_KEY));
          if (shouldSuppressCheckoutReturn) {
            sessionStorage.removeItem(PREMIUM_CHECKOUT_RETURN_GUARD_KEY);
          }
        } catch {}

        if (shouldSuppressCheckoutReturn) {
          setPaidAccessState(false);
          setShowPaymentGate(false);
          window.history.replaceState({}, document.title, `${window.location.pathname}#matches`);
          setSitePage("app");
          return;
        }

        setPaidAccessState(false);
        (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
          email: getUserEmail(),
          section: hash,
          cta_source: "direct_hash",
          flow: "known_email_button",
        });
        setShowPaymentGate(true);
      } else {
        setPaidAccessState(false);
        (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
          section: hash,
          cta_source: "direct_hash",
        });
        setShowPaymentGate(true);
      }
      return;
    }

    if (appHashes.includes(hash)) {
      trackHashPageView(hash);
      if (hasEmailAccess() || hasPaidAccess()) {
        setShowEmailGate(false);
        setSitePage("app");
      } else {
        setShowEmailGate(false);
        setSitePage("home");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (publicHashes.includes(hash)) {
      trackHashPageView(hash);
      setSitePage(hash);
    } else if (hash === "home" || !hash) {
      trackHashPageView("home");
      setSitePage("home");
    }
  };

  useEffect(() => {
    const confirmStripeSuccess = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("success") !== "true") return;

      const sessionId = searchParams.get("session_id");
      const fallbackReturnHash = searchParams.get("return_hash") || window.location.hash.replace("#", "") || "best-bets";
      let returnHash = ["matches", "origin", "best-bets", "try-scorers"].includes(fallbackReturnHash)
        ? fallbackReturnHash
        : "best-bets";
      if (returnHash === "origin" && !canViewOriginPage()) {
        returnHash = "matches";
      }

      if (!sessionId) {
        (window as any).trackAnalyticsEvent?.("premium_checkout_missing_session", { return_hash: returnHash });
        window.history.replaceState({}, document.title, `${window.location.pathname}#${returnHash}`);
        setSitePage("app");
        return;
      }

      try {
        const res = await fetch(`/api/confirm-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.email) {
          try {
            sessionStorage.removeItem(PREMIUM_CHECKOUT_RETURN_GUARD_KEY);
          } catch {}
          const nextAuthState = await refreshAuthSession();
          if (nextAuthState.tier !== "premium") {
            (window as any).trackAnalyticsEvent?.("premium_checkout_confirm_failed", {
              session_id: sessionId,
              error: "session_not_restored",
            });
            window.history.replaceState({}, document.title, `${window.location.pathname}#${returnHash}`);
            setSitePage("home");
            return;
          }

          setShowEmailGate(false);

          let confirmedReturnHash = ["matches", "origin", "best-bets", "try-scorers"].includes(data.returnHash)
            ? data.returnHash
            : returnHash;
          if (confirmedReturnHash === "origin" && !canViewOriginPage()) {
            confirmedReturnHash = "matches";
          }

          (window as any).trackAnalyticsEvent?.("premium_checkout_confirmed", {
            email: data.email,
            section: confirmedReturnHash,
            session_id: sessionId,
          });

          window.history.replaceState({}, document.title, `${window.location.pathname}#${confirmedReturnHash}`);
          setSitePage("app");
          return;
        }

        (window as any).trackAnalyticsEvent?.("premium_checkout_confirm_failed", {
          session_id: sessionId,
          error: data.error || "unknown",
        });
        window.history.replaceState({}, document.title, `${window.location.pathname}#${returnHash}`);
        setSitePage("app");
      } catch (err) {
        console.error("[RightEdge] Failed to confirm checkout session:", err);
        (window as any).trackAnalyticsEvent?.("premium_checkout_confirm_error", { session_id: sessionId });
        window.history.replaceState({}, document.title, `${window.location.pathname}#${returnHash}`);
        setSitePage("app");
      }
    };

    let cancelled = false;

    const bootstrap = async () => {
      await confirmStripeSuccess();
      if (cancelled) return;
      await refreshAuthSession();
      if (cancelled) return;
      checkHash();
      window.addEventListener("hashchange", checkHash);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", checkHash);
    };
  }, []);

  const handleEmailSuccess = () => {
    setShowEmailGate(false);
    if (emailGateTarget === "cricket") {
      setSitePage("cricket");
      window.location.hash = "cricket";
      return;
    }
    setSitePage("app");
    window.location.hash = "matches";
  };

  const handleSetPage = (page: string) => {
    if (page === "app") {
      navigateToApp("nav_predictions");
    } else {
      window.location.hash = page;
    }
  };

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        // Clear live odds cache to force a fresh fetch
        try {
          localStorage.removeItem(ODDS_CACHE_KEY);
          localStorage.removeItem(`${ODDS_CACHE_KEY}_betr`);
          fetchOddsPromises.delete(ODDS_CACHE_KEY);
          fetchOddsPromises.delete(`${ODDS_CACHE_KEY}_betr`);
        } catch (e) {}
      } else {
        setLoading(true);
      }

      setError("");

      const [
        predictionRows,
        betLogRows,
        trackerRows,
        fixtureRows,
        tryScorerRows,
      ] = await Promise.all([
        fetchSheetRows(SHEET_GIDS.matchPredictions),
        fetchSheetRows(SHEET_GIDS.betLog),
        fetchSheetRows(SHEET_GIDS.performanceTracker),
        fetchSheetRows(SHEET_GIDS.fixtures2026),
        fetchSheetRows(SHEET_GIDS.tryScorers),
      ]);

      const dashboardData = buildDashboardData(
        predictionRows,
        betLogRows,
        trackerRows,
        fixtureRows,
        tryScorerRows,
      );

      setData(dashboardData);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unknown error loading Google Sheets data",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <HelmetProvider>
<Helmet>
  {/* ── Google Search Console Verification ── */}
  <meta name="google-site-verification" content="wb31UE7IgqZ6wAT2M2iIJ8YK1dZjdQc_LSYaiuRBsd0" />

  {/* ── Primary SEO ── */}
  <title>RightEdge NRL Analytics and Value Insights</title>
  <meta name="description" content="RightEdge is Australia's NRL analytics platform for match predictions, projected scores, model probabilities and value insights every round." />
  <meta name="keywords" content="RightEdge, RightEdge NRL, NRL analytics, NRL predictions, NRL match intelligence, NRL match predictions, NRL projected scores, NRL odds, NRL model probabilities, rugby league analytics, NRL 2026" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.rightedge.com.au/" />

  {/* ── Open Graph / Facebook ── */}
  <meta property="og:url" content="https://www.rightedge.com.au/" />
  <meta property="og:title" content="RightEdge NRL Analytics and Value Insights" />
  <meta property="og:image" content="https://www.rightedge.com.au/logo-square.png" />
  
  {/* UPDATED: Points to your new square logo */}
  <meta property="og:image" content="https://www.rightedge.com.au/logo-square.png" />
  <meta property="og:locale" content="en_AU" />

  {/* ── Twitter / X Card ── */}
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="RightEdge NRL Analytics and Value Insights" />
  <meta name="twitter:image" content="https://www.rightedge.com.au/logo-square.png" />
  
  {/* UPDATED: Points to your new square logo */}
  <meta name="twitter:image" content="https://www.rightedge.com.au/logo-square.png" />

  {/* ── JSON-LD Structured Data (Unchanged) ── */}
  <script type="application/ld+json">{JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "RightEdge",
    "alternateName": ["RightEdge NRL", "RightEdge NRL Analytics"],
    "url": "https://www.rightedge.com.au/",
    "description": "Australia's NRL analytics platform for match predictions, projected scores, model probabilities and value insights every round.",
    "inLanguage": "en-AU"
  })}</script>
</Helmet>
    <div className="rightedge-admin-editorial-theme min-h-screen bg-background text-foreground relative overflow-x-clip font-sans">
      <div className="absolute inset-0 pointer-events-none" />

      <div
        className={`max-w-[1200px] mx-auto relative z-10 flex flex-col ${sitePage === "app" ? "gap-10 px-3 py-4 sm:px-6 sm:py-6" : "gap-3 sm:gap-4 px-6 pb-6 pt-[72px] sm:pt-[80px]"}`}
      >
        <div
          className={
            sitePage === "app" ? "hidden xl:block" : "block"
          }
        >
          <PublicNav
            page={sitePage}
            setPage={handleSetPage}
            onPremiumLogin={() => requestPremiumAccess("nav_premium_login")}
            showCricketLink={canAccessCricketPrototype(authState.email)}
          />
        </div>

        {sitePage === "home" && (
          <HomePage
            data={data}
            onGoApp={navigateToApp}
            onRequestPremium={requestPremiumAccess}
          />
        )}

        {sitePage === "results" && data && (
          <ResultsPage data={data} />
        )}
        {sitePage === "methodology" && <MethodologyPage />}
        {sitePage === "articles" && <ArticlesPage />}
        {sitePage === "article-round-5-2026" && <ArticleRound5 />}
        {sitePage === "cricket" && (
          <CricketPrototypePage
            authState={authState}
            onRequestAccess={requestCricketAccess}
          />
        )}
        {sitePage === "ad-studio" && (
          <AdStudio
            onExit={() => {
              window.location.hash = "home";
            }}
            data={data}
          />
        )}
        {sitePage === "admin" && (
          <AdminDashboard
            data={data}
            onNavigateAdStudio={() => {
              window.location.hash = "ad-studio";
            }}
          />
        )}
        {sitePage === "app" && (
          <AppDashboard
            key={paidAccessState ? "paid" : "unpaid"}
            data={data}
            loading={loading}
            error={error}
            refreshing={refreshing}
            loadData={loadData}
            isPremium={paidAccessState || isAdmin}
            onRequestAccess={(targetHash = "best-bets") => {
              if (targetHash === "origin" && !canViewOriginPage()) {
                targetHash = "matches";
              }
              setSitePage("app");
              window.location.hash = targetHash;
              if (hasPaidAccess()) {
                setPaidAccessState(true);
                setShowEmailGate(false);
                return;
              }
              const knownEmail = getUserEmail();
              if (hasEmailAccess() && knownEmail) {
                setPaidAccessState(false);
                (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
                  email: knownEmail,
                  section: targetHash,
                  cta_source: targetHash,
                  flow: "known_email_button",
                });
                setShowPaymentGate(true);
                return;
              }
              (window as any).trackAnalyticsEvent?.("premium_paywall_open", {
                section: targetHash,
                cta_source: targetHash,
              });
              setShowPaymentGate(true);
            }}
            onExit={() => {
              window.location.hash = "home";
            }}
          />
        )}

        <EmailGateModal
          open={showEmailGate}
          onClose={() => {
            (window as any).trackAnalyticsEvent?.('paywall_dismiss');
            setEmailGateTarget("app");
            setShowEmailGate(false);
          }}
          onSuccess={handleEmailSuccess}
          onSessionRefresh={refreshAuthSession}
        />

        <PaymentGateModal
          open={showPaymentGate}
          onClose={() => {
            (window as any).trackAnalyticsEvent?.("premium_paywall_close", {
              section: window.location.hash.replace("#", "") || "unknown",
            });
            setShowPaymentGate(false);
          }}
          onSuccess={() => {
            setPaidAccessState(hasPaidAccess());
            setShowEmailGate(false);
            setShowPaymentGate(false);
            setSitePage("app");
            const currentPremiumHash = window.location.hash.replace("#", "");
            let returnHash = ["matches", "origin", "best-bets", "try-scorers"].includes(currentPremiumHash)
              ? currentPremiumHash
              : "best-bets";
            if (returnHash === "origin" && !canViewOriginPage()) {
              returnHash = "matches";
            }
            window.location.hash = returnHash;
          }}
          onSessionRefresh={refreshAuthSession}
        />

        <div className="p-8 mt-8 border-t-4 border-white/10 bg-[#111317]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-white font-black text-2xl uppercase tracking-tighter mb-2">
                RightEdge
                <button
                  onClick={async () => {
                    try {
                      await fetch(`/api/auth/logout`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${publicAnonKey}`,
                        },
                        credentials: "include",
                      });
                    } catch {}
                    window.location.reload();
                  }}
                  className="ml-4 text-[10px] text-white/20 hover:text-[#FF2E63] transition-colors"
                  title="Debug: Reset Email Access"
                >
                  [RESET ACCESS]
                </button>
              </div>
              <div className="text-sm font-bold text-[#FFEA00] uppercase tracking-widest">
                NRL Predictions & Premium Plays
              </div>
            </div>
            <div className="text-xs text-white/50 leading-relaxed font-bold max-w-[720px] uppercase tracking-wider">
              <p className="mb-4">
                RightEdge provides projected scores, win
                probabilities, model odds, premium match plays,
                and Try Scorer signals for the
                NRL. Premium plays are filtered to match the
                model's strongest weekly reads.
              </p>
              <p className="mb-4 text-[#9CA3AF]">
                Disclaimer: RightEdge is an independent
                analytics tool and is not affiliated with,
                endorsed by, or licensed by the National Rugby
                League or its clubs.
              </p>
              <ResponsibleGamblingNotice compact />
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    window.location.hash = "admin";
                  }}
                  className="text-[10px] text-white/20 hover:text-[#00E676] uppercase tracking-widest font-black transition-colors"
                >
                  Admin Access
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </HelmetProvider>
  );
}
