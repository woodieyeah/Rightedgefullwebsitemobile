import React, { useEffect, useMemo, useState } from "react";
import { HelmetProvider, Helmet } from "react-helmet-async";
import {
  projectId,
  publicAnonKey,
} from "../../utils/supabase/info";
import { AdminDashboard } from "./components/AdminDashboard";
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
  Unlock,
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
    return { primary: "#0B0D10", secondary: "#0047FF" };
  const normalized = teamName.toLowerCase();
  for (const [key, value] of Object.entries(NRL_COLORS)) {
    if (normalized.includes(key)) return value;
  }
  return { primary: "#0B0D10", secondary: "#0047FF" };
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
      className={`flex items-center justify-center border-2 shadow-[2px_2px_0px_rgba(255,255,255,0.1)] shrink-0 ${className}`}
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
    icon: <Target className="w-5 h-5" />,
  },
  {
    id: "best-bets",
    label: "Premium Plays",
    icon: <Flame className="w-5 h-5" />,
  },
  {
    id: "try-scorers",
    label: "Try Scorers",
    icon: <Trophy className="w-5 h-5" />,
  },
];

function getAppPages(isAdmin: boolean) {
  if (isAdmin) {
    return [
      ...appPages,
      {
        id: "admin",
        label: "Admin",
        icon: <Mail className="w-5 h-5" />,
      },
    ];
  }
  return appPages;
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
      className={`absolute blur-3xl opacity-20 pointer-events-none ${className || ""}`}
      style={{ background: gradient }}
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
      className={`bg-[#111317] border-2 border-white/10 shadow-[8px_8px_0_0_#0047FF] ${className}`}
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
  const accentBorder = {
    neutral: "border-white/10",
    green: "border-[#00E676]",
    gold: "border-[#FFEA00]",
    blue: "border-[#0047FF]",
  }[accent];

  const accentText = {
    neutral: "text-white/50",
    green: "text-[#00E676]",
    gold: "text-[#FFEA00]",
    blue: "text-[#0047FF]",
  }[accent];

  const accentShadow = {
    neutral: "shadow-[4px_4px_0_0_#1E232B]",
    green: "shadow-[4px_4px_0_0_#00E676]",
    gold: "shadow-[4px_4px_0_0_#FFEA00]",
    blue: "shadow-[4px_4px_0_0_#0047FF]",
  }[accent];

  return (
    <div
      className={`bg-[#111317] p-4 md:p-6 flex flex-col justify-between min-h-[120px] md:min-h-[150px] relative overflow-hidden border-2 ${accentBorder} ${accentShadow}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.02),transparent_50%)]" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2 md:mb-4">
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-black">
            {label}
          </div>
          <div
            className={`${accentText} scale-75 md:scale-100 origin-top-right`}
          >
            {icon}
          </div>
        </div>
        <div
          className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white mb-1 md:mb-2 truncate"
          title={value}
        >
          {value}
        </div>
      </div>
      <div
        className="text-[10px] md:text-xs lg:text-sm font-bold text-white/50 relative z-10 uppercase tracking-wider truncate"
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
      className={`w-full flex items-center justify-between px-4 py-4 min-h-[64px] transition-all border-l-4 ${
        active
          ? "bg-[#1E232B] border-[#FFEA00] text-white shadow-[4px_4px_0_0_#FF2E63]"
          : "bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-8 h-8 flex items-center justify-center shrink-0 ${active ? "text-[#FFEA00]" : "text-white/50"}`}
        >
          {icon}
        </div>
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span
            className={`text-base tracking-wide uppercase whitespace-nowrap ${active ? "font-black" : "font-bold"}`}
          >
            {label}
          </span>
          {premium && (
            <span
              className={`inline-flex w-fit px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border leading-none ${
                active
                  ? "bg-[#FFEA00] text-black border-[#FFEA00]"
                  : "bg-[#FF2E63]/10 text-[#FF2E63] border-[#FF2E63]/40"
              }`}
            >
              Premium
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={`w-5 h-5 shrink-0 ${active ? "opacity-100 text-[#FFEA00]" : "opacity-0"}`}
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
    <div className="mb-4 md:mb-8 border-b-2 border-white/10 pb-3 md:pb-4">
      <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-1 md:mb-2">
        {title}
      </h2>
      <div className="text-[10px] md:text-sm font-bold text-white/50 uppercase tracking-widest">
        {subtitle}
      </div>
    </div>
  );
}

function ResponsibleGamblingNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`border-2 border-black bg-white text-black ${
        compact ? "p-4" : "p-5 md:p-6"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-5">
        <div>
          <div className="text-sm md:text-xl font-black uppercase tracking-tight mb-1">
            What&apos;s gambling really costing you?
          </div>
          <div className="text-[11px] md:text-sm font-bold leading-relaxed">
            For free and confidential support call{" "}
            <a
              href="tel:1800858858"
              className="underline decoration-2 underline-offset-2 hover:text-[#0047FF] transition-colors"
            >
              1800 858 858
            </a>{" "}
            or visit{" "}
            <a
              href="https://www.gamblinghelponline.org.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-2 underline-offset-2 hover:text-[#0047FF] transition-colors"
            >
              gamblinghelponline.org.au
            </a>
            .
          </div>
        </div>
        <div className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">
          18+ only
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

function normalizeTeamName(value: string) {
  if (!value) return "";
  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();

  const aliases: Record<string, string> = {
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

  for (const [key, normalized] of Object.entries(aliases)) {
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

  return [...candidates].sort((a, b) => {
    const aKickoff = getFixtureUtcKickoffMs(a);
    const bKickoff = getFixtureUtcKickoffMs(b);
    const aUpcoming = aKickoff >= now;
    const bUpcoming = bKickoff >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming && bUpcoming) return aKickoff - bKickoff;
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
      className: "bg-[#FF2E63] text-white",
      sortRank: 3,
    };
  }

  if (highProbabilityNearFair) {
    return {
      label: "High Prob",
      className: "bg-[#0047FF] text-white",
      sortRank: 2,
    };
  }

  if (clearValue) {
    return {
      label: "Value",
      className: "bg-[#FFEA00] text-black",
      sortRank: 1,
    };
  }

  return null;
}

function getTryScorerSignalClass(label?: string) {
  if (label === "Best Bet") return "bg-[#FF2E63] text-white";
  if (label === "High Prob") return "bg-[#0047FF] text-white";
  if (label === "Value") return "bg-[#FFEA00] text-black";
  return "bg-white/10 text-white/50";
}

function getFeaturedPrediction(predictions: PredictionRow[]) {
  if (!predictions.length) return null;

  const officialPlays = predictions.filter(
    (row) => isModelAlignedOfficialPlay(row),
  );

  if (officialPlays.length) {
    return [...officialPlays].sort((a, b) => {
      const aWinPct = getRowSideWinPct(a);
      const bWinPct = getRowSideWinPct(b);

      if (bWinPct !== aWinPct) return bWinPct - aWinPct;
      if (b.bestEdge !== a.bestEdge)
        return b.bestEdge - a.bestEdge;
      return b.stake - a.stake;
    })[0];
  }

  return [...predictions].sort((a, b) => {
    const aWinPct = getPredictedWinnerWinPct(a);
    const bWinPct = getPredictedWinnerWinPct(b);

    if (bWinPct !== aWinPct) return bWinPct - aWinPct;
    return b.bestEdge - a.bestEdge;
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
      const predictedWinner = normalizeTeamName(
        getValue(row, [
          "Predicted Winner",
          "Winner",
          "Projected Winner",
        ]),
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
      const exactFixture = chooseBestFixtureCandidate(exactFixtures);
      const pairFixture = chooseBestFixtureCandidate(pairFixtures);
      const fixture = pairFixture || exactFixture;

      return {
        match:
          homeTeam && awayTeam
            ? `${homeTeam} v ${awayTeam}`
            : "",
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
      .map((row) => row.fixture?.roundNumber || 0)
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
      <span className="inline-flex items-center justify-center w-8 h-8 bg-[#00E676] text-black text-sm font-black shadow-[4px_4px_0_0_#111317]">
        W
      </span>
    );
  }

  if (result === "L") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 bg-[#FF2E63] text-white text-sm font-black shadow-[4px_4px_0_0_#111317]">
        L
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center h-8 px-3 bg-[#1E232B] text-white/50 text-xs font-bold uppercase tracking-widest border border-white/10">
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
      ? "bg-[#FFEA00] text-black"
      : confidence === "Value"
        ? "bg-[#00E676] text-black"
        : "bg-[#1E232B] text-white border border-white/10";

  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-widest ${styles}`}
    >
      {confidence}
    </span>
  );
}

const EMAIL_ACCESS_KEY = "rightedge_email_access";

function hasEmailAccess(): boolean {
  try {
    if (hasPaidAccess()) return true;

    const val = localStorage.getItem(EMAIL_ACCESS_KEY);
    if (!val) return false;

    if (val.startsWith("{")) {
      const data = JSON.parse(val);
      // Support legacy expiresAt check just in case, but prefer simple subscribed flag
      if (data.email && (data.subscribed || (data.expiresAt && Date.now() < data.expiresAt))) {
        return true;
      }
    }
    
    // Clear old simple email strings or expired data
    localStorage.removeItem(EMAIL_ACCESS_KEY);
    return false;
  } catch {
    return false;
  }
}

function getUserEmail(): string | null {
  try {
    const val = localStorage.getItem(EMAIL_ACCESS_KEY);
    if (!val) return null;
    if (val.startsWith("{")) {
      const data = JSON.parse(val);
      return data.email ? String(data.email).trim().toLowerCase() : null;
    }
    return null;
  } catch {
    return null;
  }
}

function getPreviewBookmakerName(bookmaker?: string) {
  return bookmaker || "—";
}

function BetrLogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/betr-square.png"
      alt="Betr"
      className={`${className} rounded-lg border border-[#73F4DB] bg-[#113bd8] object-contain shrink-0`}
    />
  );
}

function isBetrBookmaker(name?: string) {
  return normalizeBookmakerName(name || "") === "betr";
}

function getAffiliateButtonClass(bookmaker: string | undefined, sizeClasses: string) {
  const colorClasses = isBetrBookmaker(bookmaker)
    ? "border-[#73F4DB] bg-[#113bd8] text-white shadow-[4px_4px_0_0_rgba(115,244,219,0.65)]"
    : "border-[#FFEA00] bg-[#FFEA00] text-black shadow-[4px_4px_0_0_#FF2E63]";

  return `inline-flex max-w-full items-center justify-center gap-2 border-2 ${sizeClasses} font-black uppercase tracking-widest ${colorClasses} transition hover:-translate-y-0.5 hover:brightness-110`;
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
        <span className={hasBetrBranding ? "text-[#73F4DB]" : "text-black"}>
          ${odds.toFixed(2)}
        </span>
      )}
    </BetrAffiliateLink>
  );
}

const BETR_AFFILIATE_BASE_URL =
  "https://record.betraffiliates.com.au/_Bk4P0TFHeOiYNevImT-MDGNd7ZgqdRLk/1/";

function getBetrAffiliateUrl(payload: string) {
  const url = new URL(BETR_AFFILIATE_BASE_URL);
  url.searchParams.set("payload", payload);
  return url.toString();
}

function BetrAffiliateLink({
  payload,
  className,
  children,
}: {
  payload: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={getBetrAffiliateUrl(payload)}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
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
    return getUserEmail() === "elliott@woodbry.com";
  } catch {
    return false;
  }
}

function setEmailAccess(email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem(
      EMAIL_ACCESS_KEY,
      JSON.stringify({ email: normalizedEmail, subscribed: true }),
    );
    // Permanently stamp this browser as internal if the email is ours.
    // This means all future sessions from this device are correctly excluded
    // from the Real Users view — even before email entry.
    const INTERNAL_EMAILS = ['elliott@woodbry.com', 'ewoodbry@gmail.com'];
    if (INTERNAL_EMAILS.includes(normalizedEmail)) {
      localStorage.setItem('rightedge_internal_visitor', 'true');
    }
  } catch {}
}

const PAID_ACCESS_KEY = "rightedge_paid_access";

function hasPaidAccess(): boolean {
  try {
    const val = localStorage.getItem(PAID_ACCESS_KEY);
    if (!val) return false;

    if (val.startsWith("{")) {
      const data = JSON.parse(val);
      if (data.email && (data.subscribed || (data.expiresAt && Date.now() < data.expiresAt))) {
        return true;
      }
    }

    localStorage.removeItem(PAID_ACCESS_KEY);
    return false;
  } catch {
    return false;
  }
}

function getPaidUserEmail(): string | null {
  try {
    const val = localStorage.getItem(PAID_ACCESS_KEY);
    if (!val) return null;
    if (val.startsWith("{")) {
      const data = JSON.parse(val);
      return data.email || null;
    }
    return null;
  } catch {
    return null;
  }
}

function setPaidAccess(email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem(
      EMAIL_ACCESS_KEY,
      JSON.stringify({ email: normalizedEmail, subscribed: true }),
    );
    localStorage.setItem(
      PAID_ACCESS_KEY,
      JSON.stringify({ email: normalizedEmail, subscribed: true }),
    );
    localStorage.setItem('rightedge_subscriber', 'true');

    const INTERNAL_EMAILS = ['elliott@woodbry.com', 'ewoodbry@gmail.com'];
    if (INTERNAL_EMAILS.includes(normalizedEmail)) {
      localStorage.setItem('rightedge_internal_visitor', 'true');
    }
  } catch {}
}

// ── Free Featured Match Email Gate ───────────────────────────────────────────
// No payment required — just collects email and unlocks the featured match.
const FEATURED_ACCESS_KEY = 'rightedge_featured_access';

function hasFeaturedMatchAccess(): boolean {
  try {
    return localStorage.getItem(FEATURED_ACCESS_KEY) === 'true';
  } catch {
    return false;
  }
}

function setFeaturedMatchAccess(email: string) {
  try {
    localStorage.setItem(FEATURED_ACCESS_KEY, 'true');
    localStorage.setItem('rightedge_featured_email', email);
    // Also mark as internal if admin email
    const INTERNAL_EMAILS = ['elliott@woodbry.com', 'ewoodbry@gmail.com'];
    if (INTERNAL_EMAILS.includes(email.trim().toLowerCase())) {
      localStorage.setItem('rightedge_internal_visitor', 'true');
    }
  } catch {}
}

function FeaturedMatchEmailGate({
  open,
  onClose,
  onSuccess,
  onPremiumSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onPremiumSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMsg('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const verifyRes = await fetch(`/api/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      const isPremiumSubscriber = Boolean(
        verifyData.instantAccess ||
        verifyData.activeSubscriber ||
        verifyData.active_subscriber ||
        verifyData.subscribed ||
        verifyData.active
      );

      if (verifyRes.ok && isPremiumSubscriber) {
        const verifiedEmail = (verifyData.email || trimmed).trim().toLowerCase();
        setEmailAccess(verifiedEmail);
        setPaidAccess(verifiedEmail);
        setFeaturedMatchAccess(verifiedEmail);
        (window as any).trackAnalyticsEvent?.('premium_access_from_free_gate', { email: verifiedEmail });
        onPremiumSuccess();
        return;
      }

      // Save email server-side first — only unlock the match if the save confirms.
      const saveRes = await fetch(
        `/api/register-free-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email: trimmed, source: 'featured_match_free' }),
        }
      );

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        setErrorMsg((errData as any).error || 'Failed to save your email. Please try again.');
        setSubmitting(false);
        return;
      }

      // Server confirmed — now unlock locally and track
      setFeaturedMatchAccess(trimmed);
      (window as any).trackAnalyticsEvent?.('featured_match_unlocked', { email: trimmed });
      setDone(true);

      // Short pause so user sees success state, then close
      setTimeout(() => {
        onSuccess();
      }, 900);
    } catch (err: any) {
      setErrorMsg('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#111317] border-4 border-[#0047FF] shadow-[8px_8px_0_0_#0047FF] p-8 sm:p-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {done ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="bg-[#00E676] p-3 mb-4">
              <Unlock className="w-8 h-8 text-black stroke-[3px]" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Match Unlocked!
            </h3>
            <p className="text-sm text-white/60">
              Enjoy the projected scores, win probability, and model analysis.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-[#0047FF] p-2.5">
                <Unlock className="w-6 h-6 text-white stroke-[3px]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Unlock Featured Match
                </h3>
                <p className="text-[10px] font-bold text-[#00E676] uppercase tracking-widest">
                  Free — No credit card needed
                </p>
              </div>
            </div>

            <p className="text-sm text-white/70 font-bold leading-relaxed mb-6">
              Enter your email to unlock the free preview. Premium members go straight to the full round card.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                  placeholder="your@email.com"
                  autoFocus
                  disabled={submitting}
                  className="w-full bg-[#0B0D10] border-2 border-white/10 text-white font-bold text-base pl-12 pr-4 py-4 placeholder:text-white/20 focus:outline-none focus:border-[#0047FF] transition-colors disabled:opacity-50"
                />
              </div>

              {errorMsg && (
                <p className="text-[#FF2E63] text-xs font-bold uppercase tracking-wider">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0047FF] text-white py-4 text-base font-black uppercase tracking-wider hover:bg-[#003BCC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Unlock Now — It's Free
                    <ArrowRight className="w-5 h-5 stroke-[3px]" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-white/30 text-center font-mono">
                We'll keep you updated with NRL picks each round. Unsubscribe anytime.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentGateModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"email" | "processing">("email");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const trimmedEmail = email.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;
    const currentPremiumHash = window.location.hash.replace("#", "");
    const section = ["matches", "best-bets", "try-scorers"].includes(currentPremiumHash)
      ? currentPremiumHash
      : "best-bets";
    (window as any).trackAnalyticsEvent?.("premium_paywall_view", {
      section,
      cta_source: section,
    });
  }, [open]);

  if (!open) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
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
        body: JSON.stringify({ email: trimmedEmail }),
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
        const verifiedEmail = (verifyData.email || trimmedEmail).trim().toLowerCase();
        setEmailAccess(verifiedEmail);
        setPaidAccess(verifiedEmail);
        (window as any).trackAnalyticsEvent?.("paid_access_verified", { email: verifiedEmail });
        onSuccess();
        return;
      }

      setStep("processing");
      const currentPremiumHash = window.location.hash.replace("#", "");
      const returnHash = ["matches", "best-bets", "try-scorers"].includes(currentPremiumHash)
        ? currentPremiumHash
        : "best-bets";
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}#${returnHash}`;

      (window as any).trackAnalyticsEvent?.("premium_email_submit", {
        email: trimmedEmail,
        section: returnHash,
      });

      try {
        await fetch(`/api/register-checkout-lead`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email: trimmedEmail,
            source: `premium_${returnHash}`,
            return_hash: returnHash,
          }),
        });
      } catch (leadErr) {
        console.warn("[RightEdge] Failed to save checkout lead:", leadErr);
      }

      (window as any).trackAnalyticsEvent?.("premium_checkout_start", {
        email: trimmedEmail,
        section: returnHash,
      });

      const checkoutRes = await fetch(`/api/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          returnUrl,
          returnHash,
          cancelUrl,
          cancel_url: cancelUrl,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (checkoutRes.ok && checkoutData.url) {
        (window as any).trackAnalyticsEvent?.("premium_checkout_redirect", {
          email: trimmedEmail,
          section: returnHash,
        });
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
      <div className="relative w-full max-w-md bg-[#111317] border-4 border-[#FF2E63] shadow-[8px_8px_0_0_#FF2E63] p-8 sm:p-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#FF2E63] p-2.5">
            <Lock className="w-6 h-6 text-white stroke-[3px]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Premium Access
            </h3>
            <p className="text-[10px] font-bold text-[#FFEA00] uppercase tracking-widest">
              Subscriber login or $9/week
            </p>
          </div>
        </div>

        <p className="text-sm text-white/70 font-bold leading-relaxed mb-6">
          Already Premium? Enter your subscriber email and we’ll unlock access instantly. New here? Use the same email to continue to secure Stripe checkout.
        </p>

        {step === "processing" ? (
          <div className="flex flex-col items-center text-center py-6">
            <RefreshCw className="w-10 h-10 mb-5 animate-spin text-[#FF2E63]" />
            <div className="text-white font-black uppercase tracking-tight mb-2">
              Redirecting to Stripe
            </div>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Secure checkout is opening now.
            </p>
          </div>
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
                className="w-full bg-[#0B0D10] border-2 border-white/10 text-white font-bold text-base pl-12 pr-4 py-4 placeholder:text-white/20 focus:outline-none focus:border-[#FF2E63] transition-colors disabled:opacity-50"
              />
            </div>

            {errorMsg && (
              <p className="text-[#FF2E63] text-xs font-bold uppercase tracking-wider">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FF2E63] text-white py-4 text-base font-black uppercase tracking-wider hover:bg-[#E62959] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[4px_4px_0_0_#0047FF]"
            >
              {submitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : step === "email" ? (
                <>
                  Unlock Premium Plays — $9/week
                  <ArrowRight className="w-5 h-5 stroke-[3px]" />
                </>
              ) : null}
            </button>
          </form>
        )}

        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-4 text-center">
          Existing subscribers will not be charged again. Secure payment handled by Stripe.
        </p>
      </div>
    </div>
  );
}

function EmailGateModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  const BYPASS_EMAILS = ["elliott@woodbry.com", "test@rightedge.com.au"];
  if (BYPASS_EMAILS.includes(trimmed)) {
    setEmailAccess(trimmed);
    window.dispatchEvent(new Event('adminAuthChanged'));
    onSuccess();
    return;
  }

  setSubmitting(true);
  setErrorMsg("");
  try {
    await fetch(`/api/register-free-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email: trimmed, source: "mailing_list" }),
    });
    setEmailAccess(trimmed);
    (window as any).trackAnalyticsEvent?.("mailing_list_signup", { email: trimmed });
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
      <div className="relative w-full max-w-md bg-[#111317] border-4 border-white shadow-[8px_8px_0_0_#0047FF] p-8 sm:p-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#FFEA00] p-2.5">
            <Lock className="w-6 h-6 text-black stroke-[3px]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              UNLOCK INSTANT ACCESS
            </h3>
            <p className="text-[10px] font-bold text-[#FFEA00] uppercase tracking-widest">
              FREE — NO CREDIT CARD NEEDED
            </p>
          </div>
        </div>

        <p className="text-sm text-white/70 font-bold leading-relaxed mb-6">
          Enter your email to access full model predictions, projected scores and live odds instantly. Free, no credit card needed.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {step === "email" ? (
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
                className="w-full bg-[#0B0D10] border-2 border-white/10 text-white font-bold text-base pl-12 pr-4 py-4 placeholder:text-white/20 focus:outline-none focus:border-[#FFEA00] transition-colors disabled:opacity-50"
              />
            </div>
          ) : (
            <>
              {successMsg && (
                <div className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 p-3 text-xs font-bold uppercase tracking-wider">
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
                  className="w-full bg-[#0B0D10] border-2 border-white/10 text-white font-black text-2xl text-center tracking-[0.5em] py-4 placeholder:text-white/20 placeholder:tracking-normal focus:outline-none focus:border-[#00E676] transition-colors disabled:opacity-50"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-[#FF2E63] text-xs font-bold uppercase tracking-wider">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#FFEA00] text-black py-4 text-base font-black uppercase tracking-wider hover:bg-[#FFD600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[4px_4px_0_0_#FF2E63]"
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
              className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors mt-2"
            >
              Use a different email
            </button>
          )}
        </form>

        {step === "email" && (
          <div className="mt-6 text-center">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
              INSTANT ACCESS. NO WAITING.
            </p>
          </div>
        )}

        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-4 text-center">
          FREE FOREVER. UNSUBSCRIBE ANYTIME.
        </p>
      </div>
    </div>
  );
}

function PublicNav({
  page,
  setPage,
  onPremiumLogin,
}: {
  page: string;
  setPage: (value: string) => void;
  onPremiumLogin: () => void;
}) {
  const primaryItems = [
    { id: "home", label: "Home" },
    { id: "app", label: "Predictions" },
  ];
  const secondaryItems = [
    { id: "methodology", label: "Methodology" },
    { id: "articles", label: "Articles" },
  ];

  return (
    <div className="px-4 py-3 sm:px-6 sm:py-5 sticky top-2 sm:top-6 z-40 bg-[#111317] border-4 border-white shadow-[4px_4px_0_0_#0047FF] sm:shadow-[8px_8px_0_0_#0047FF]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-6">
        <div>
          <div className="text-2xl sm:text-4xl font-black tracking-tighter text-white uppercase">
            RightEdge
          </div>
          <div className="text-[9px] sm:text-xs text-[#00E676] font-bold tracking-widest uppercase mt-1">
            NRL analytics and value insights
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2 sm:gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1 w-full lg:w-auto">
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            {primaryItems.map((item) => {
              const active = page === item.id;
              const isPredictions = item.id === "app";
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`${item.id === "home" ? "hidden sm:inline-flex" : "inline-flex flex-1 sm:flex-none"} shrink-0 items-center justify-center px-3 py-2 sm:px-5 sm:py-2.5 text-[11px] sm:text-sm font-black uppercase tracking-wider transition-colors ${
                    active && isPredictions
                      ? "bg-[#1E232B] text-[#FFEA00] border border-[#FFEA00]/60 sm:bg-[#FFEA00] sm:text-black sm:border-0 sm:shadow-[4px_4px_0_0_#FF2E63]"
                      : active
                        ? "bg-[#1E232B] text-[#FFEA00] border-2 border-[#FFEA00] shadow-none translate-x-[2px] translate-y-[2px] sm:translate-x-[4px] sm:translate-y-[4px]"
                        : isPredictions
                          ? "bg-[#1E232B] text-white border border-white/15 hover:border-[#FFEA00]/70 sm:bg-[#FFEA00] sm:text-black sm:hover:bg-[#FFD600] sm:border-0 sm:shadow-[4px_4px_0_0_#FF2E63]"
                          : "bg-[#1E232B] text-white hover:bg-white hover:text-black border border-white/10 hover:border-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={onPremiumLogin}
              className="shrink-0 inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 text-[11px] sm:text-sm font-black uppercase tracking-wider transition-colors bg-[#FF2E63] text-white hover:bg-[#E62959] shadow-[2px_2px_0_0_#0047FF] sm:shadow-[4px_4px_0_0_#0047FF]"
            >
              Premium Login
              <Crown className="w-4 h-4 stroke-[3px]" />
            </button>
          </div>
          <div className="hidden sm:flex gap-2 sm:gap-3">
            {secondaryItems.map((item) => {
              const active = page === item.id;
              const isExternal = item.id === "articles";
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isExternal) {
                      window.location.href = "https://articles.rightedge.com.au";
                    } else {
                      setPage(item.id);
                    }
                  }}
                  className={`shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-[#1E232B] text-[#FFEA00] border-2 border-[#FFEA00] shadow-none translate-x-[2px] translate-y-[2px] sm:translate-x-[4px] sm:translate-y-[4px]"
                      : "bg-[#1E232B] text-white hover:bg-white hover:text-black border border-white/10 hover:border-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function mapTeamToOddsApi(team: string): string {
  const t = team.toLowerCase();
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
let fetchOddsPromise: Promise<any> | null = null;
const ODDS_CACHE_KEY = "rightedge_odds_cache_v5_no_betfair";
const ODDS_CACHE_DURATION = 30 * 60 * 1000; // Protect the 500/month free Odds API quota

async function fetchLiveOddsCached() {
  // 1. Check local storage cache
  try {
    const cachedStr = localStorage.getItem(ODDS_CACHE_KEY);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < ODDS_CACHE_DURATION) {
        return cached.data;
      }
    }
  } catch (e) {
    // Ignore parse errors, proceed to fetch
  }

  // 2. Prevent concurrent fetches during same mount
  if (fetchOddsPromise) {
    return fetchOddsPromise;
  }

  // 3. Fetch fresh data
  fetchOddsPromise = fetch(
    `/api/live-odds`,
    {
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
      },
    },
  )
    .then(async (res) => {
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      if (data.error || !Array.isArray(data)) {
        throw new Error("Invalid Data");
      }

      // Update local storage cache
      localStorage.setItem(
        ODDS_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data: data,
        }),
      );

      fetchOddsPromise = null;
      return data;
    })
    .catch((err) => {
      fetchOddsPromise = null;
      throw err;
    });

  return fetchOddsPromise;
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
    <GlassCard className="p-5 md:p-8 relative overflow-hidden !border-[#FF2E63] !shadow-[8px_8px_0_0_#FF2E63] flex flex-col h-full">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,46,99,0.05),transparent_50%)]" />
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <span className="inline-flex items-center gap-2 bg-[#FF2E63] px-3 py-1.5 text-[10px] md:text-xs font-black text-white uppercase tracking-wider">
            <Flame className="w-3 h-3 md:w-4 md:h-4" />
            Official Play
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4 mb-2">
          <TeamLogo
            teamName={row.bestBet || row.predictedWinner}
            className="w-10 h-10 md:w-12 md:h-12 text-lg"
          />
          <div className="text-xl md:text-3xl font-black text-white tracking-tight uppercase leading-none">
            {row.bestBet || row.match}
          </div>
        </div>
        <div className="text-[10px] md:text-sm font-bold text-[#FFEA00] uppercase tracking-widest mb-4 md:mb-6">
          {row.match} •{" "}
          {row.fixture
            ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
            : "Time TBC"}
        </div>
        {(row.predictedHomeScore || row.predictedAwayScore) && (
          <div className="text-[10px] md:text-sm font-bold text-white/50 mb-6 md:mb-8 uppercase tracking-widest">
            Projection:{" "}
            <span className="text-white">
              {row.homeTeam}{" "}
              {Math.round(row.predictedHomeScore)} -{" "}
              {Math.round(row.predictedAwayScore)}{" "}
              {row.awayTeam}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 md:gap-4 border-t-2 border-white/10 pt-4 md:pt-6 mb-4 md:mb-6">
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1 md:mb-2">
              Market
            </div>
            <div className="text-lg md:text-2xl font-black text-white">
              {selectedOdds ? selectedOdds.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-bold mb-1 md:mb-2">
              Model
            </div>
            <div className="text-lg md:text-2xl font-black text-white">
              {selectedModel ? selectedModel.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#00E676] font-bold mb-1 md:mb-2">
              Edge
            </div>
            <div className="text-lg md:text-2xl font-black text-[#00E676]">
              +{formatPercent(row.bestEdge, 2)}
            </div>
          </div>
        </div>

        {/* Live Multi-Bookie Comparison */}
        <div className="mt-auto border-t-2 border-white/10 pt-6">
          <div className="text-xs font-bold text-white/50 mb-4 uppercase tracking-widest flex items-center justify-between">
            <span>Live Bookmaker Prices</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping-pong absolute inline-flex h-full w-full rounded-full bg-[#00E676] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E676]"></span>
            </span>
          </div>
          <div className="flex flex-col gap-2 mb-6 min-h-[160px]">
            {isLoadingOdds ? (
              <div className="flex flex-col gap-2 h-full justify-center opacity-50">
                <div className="h-12 bg-white/5 animate-pulse border-2 border-white/5" />
                <div className="h-12 bg-white/5 animate-pulse border-2 border-white/5" />
                <div className="h-12 bg-white/5 animate-pulse border-2 border-white/5" />
              </div>
            ) : (
              liveOdds.map((bookie) => {
                const isBetr = isBetrBookmaker(bookie.name);
                const className = `group flex items-center justify-between min-h-[52px] p-3.5 border-2 ${
                  isBetr
                    ? "border-[#73F4DB] bg-[#113bd8]"
                    : bookie.isBest
                      ? "border-[#00E676] bg-[rgba(0,230,118,0.05)]"
                      : "border-white/10 bg-white/[0.03]"
                } shadow-[3px_3px_0_0_rgba(0,71,255,0.35)] transition hover:-translate-y-0.5 hover:border-[#FFEA00] hover:bg-white/[0.06] hover:brightness-110`;
                const content = (
                  <>
                    <BookmakerName name={bookie.name} />
                    <div className="flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-lg font-black ${
                            isBetr
                              ? "text-[#73F4DB]"
                              : bookie.isBest
                                ? "text-[#00E676]"
                                : "text-white/70"
                          }`}
                        >
                          ${bookie.odds.toFixed(2)}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-white/35 transition group-hover:text-[#FFEA00]" />
                      </div>
                      <span className={isBetr ? "text-[9px] font-black uppercase tracking-widest text-[#73F4DB]" : "text-[9px] font-black uppercase tracking-widest text-white/35 group-hover:text-[#FFEA00]"}>
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

        <div className="bg-[#111317] border-2 border-[#0047FF] shadow-[4px_4px_0_0_#0047FF] px-6 py-4 flex items-center justify-between">
          <span className="text-sm font-bold text-white/50 uppercase tracking-widest">
            Suggested stake
          </span>
          <span className="text-2xl font-black text-white">
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
      className={`bg-[#111317] border-l-4 border-[#0047FF] shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function PublicHero({
  data,
  onGoApp,
  onUnlockFeatured,
  onRequestPremium,
}: {
  data: DashboardData | null;
  onGoApp: (source: string) => void;
  onUnlockFeatured: () => void;
  onRequestPremium: (source: string) => void;
}) {
  return (
    <HomeCard className="p-6 md:p-8 md:py-10 relative overflow-hidden !border-[#FF2E63]">
      <div className="absolute inset-0 bg-[#111317]" />
      <div className="absolute -top-10 -left-8 h-[230px] w-[62%] rounded-br-[190px] bg-[#FF2E63]/95 sm:bg-[#FF2E63]/38" />
      <div className="absolute -right-24 bottom-0 h-[210px] w-[58%] rounded-tl-[180px] bg-[#0047FF]/65 sm:bg-[#0047FF]/24" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(17,19,23,0)_0%,rgba(17,19,23,0.08)_34%,rgba(17,19,23,0.92)_76%)] sm:bg-[linear-gradient(100deg,rgba(17,19,23,0.08),rgba(17,19,23,0.9)_74%)]" />
      <div className="relative z-10 max-w-[800px]">
        <div className="inline-flex items-center gap-2 bg-[#FF2E63]/15 border border-[#FF2E63]/50 px-3 py-1.5 text-[10px] sm:text-xs font-bold text-[#FFEA00] sm:text-white mb-4 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          NRL Match Intelligence
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-white leading-[1.05] mb-4">
          Don&apos;t Go In Blind This NRL Round – Backed by Data, Not Guesswork.
        </h1>
        
        <p className="text-sm sm:text-base md:text-lg text-white/70 leading-relaxed mb-6 font-bold max-w-[680px]">
          See projected scores, model probabilities and match analysis for every NRL round.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            onClick={() => onRequestPremium('hero_unlock_premium_picks')}
            className="order-1 sm:order-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#FF2E63] sm:bg-[#0047FF] px-6 py-3 text-base font-black text-white hover:bg-[#E62959] sm:hover:bg-[#003BCC] transition-colors uppercase tracking-wide shadow-[3px_3px_0_0_#0047FF] sm:shadow-none"
          >
            Unlock Premium Picks
            <Crown className="w-4 h-4 stroke-[3px]" />
          </button>

          <button
            onClick={() => onGoApp('hero_unlock_best_bets')}
            className="order-2 sm:order-1 inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#1E232B] sm:bg-[#FFEA00] text-white sm:text-black border-2 border-[#FFEA00]/70 sm:border-0 px-8 py-3 text-base font-black hover:border-[#FFEA00] sm:hover:bg-[#FFD600] transition-colors uppercase tracking-wide sm:shadow-[4px_4px_0_0_#FF2E63]"
          >
            View Free Match Predictions
            <ArrowRight className="w-4 h-4 stroke-[3px]" />
          </button>
        </div>
      </div>
    </HomeCard>
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
          className="md:hidden text-[#FFEA00] text-[10px] font-black uppercase tracking-widest mt-2 border-b border-[#FFEA00]/30 hover:border-[#FFEA00]"
        >
          + Read more
        </button>
      )}
    </div>
  );
}

function MatchLiveOddsPanel({
  row,
  selectedTeam,
  fallbackOdds,
  locked = false,
}: {
  row: PredictionRow;
  selectedTeam: string;
  fallbackOdds: number;
  locked?: boolean;
}) {
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
        const selectedApiName = mapTeamToOddsApi(selectedTeam);

        const match = data.find(
          (m: any) =>
            (m.home_team === homeApiName && m.away_team === awayApiName) ||
            (m.home_team === awayApiName && m.away_team === homeApiName),
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
            };
          })
          .filter(Boolean);

        if (formattedOdds.length === 0) {
          throw new Error("No odds found");
        }

        const sortedOdds = formattedOdds
          .sort((a: any, b: any) => b.odds - a.odds)
        const displayOdds = sortedOdds.slice(0, 3);
        const bestOdd = Math.max(...sortedOdds.map((bookie: any) => bookie.odds));

        setLiveOdds(
          displayOdds.map((bookie: any) => ({
            ...bookie,
            isBest: bookie.odds === bestOdd,
          })),
        );
      } catch (e) {
        if (!isMounted) return;
        const base = fallbackOdds || 1.9;
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
          .map((bookie) => ({
            ...bookie,
            odds: Number((bookie.odds + (Math.random() * 0.06 - 0.03)).toFixed(2)),
          }))
          .sort((a, b) => b.odds - a.odds);
        const bestOdd = Math.max(...randomized.map((bookie) => bookie.odds));

        setLiveOdds(
          randomized.map((bookie) => ({
            ...bookie,
            isBest: bookie.odds === bestOdd,
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
  }, [fallbackOdds, row.homeTeam, row.awayTeam, selectedTeam]);

  return (
    <div className="mt-5 border-t-2 border-white/10 pt-5">
      <div className="text-[10px] font-black text-white/45 mb-3 uppercase tracking-widest flex items-center justify-between">
        <span>Live Bookmaker Prices</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping-pong absolute inline-flex h-full w-full rounded-full bg-[#00E676] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E676]" />
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[136px]">
        {isLoadingOdds ? (
          <div className="flex flex-col gap-2 opacity-50">
            <div className="h-10 bg-white/5 animate-pulse border-2 border-white/5" />
            <div className="h-10 bg-white/5 animate-pulse border-2 border-white/5" />
            <div className="h-10 bg-white/5 animate-pulse border-2 border-white/5" />
          </div>
        ) : (
          liveOdds.map((bookie) => {
            const isBetr = isBetrBookmaker(bookie.name);
            const className = `group flex items-center justify-between min-h-[46px] p-3 border-2 ${
              isBetr
                ? "border-[#73F4DB] bg-[#113bd8]"
                : bookie.isBest
                ? "border-[#00E676] bg-[rgba(0,230,118,0.05)]"
                : "border-white/10 bg-white/[0.03]"
            } shadow-[3px_3px_0_0_rgba(0,71,255,0.35)] transition hover:-translate-y-0.5 hover:border-[#FFEA00] hover:bg-white/[0.06] hover:brightness-110`;
            const content = (
              <>
                <BookmakerName name={bookie.name} />
                <div className="flex flex-col items-end gap-1 text-right">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-lg font-black ${
                        isBetr
                          ? "text-[#73F4DB]"
                          : bookie.isBest ? "text-[#00E676]" : "text-white/70"
                      }`}
                    >
                      {locked ? <BlurredText>${bookie.odds.toFixed(2)}</BlurredText> : `$${bookie.odds.toFixed(2)}`}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-white/35 transition group-hover:text-[#FFEA00]" />
                  </div>
                  <span className={isBetr ? "text-[9px] font-black uppercase tracking-widest text-[#73F4DB]" : "text-[9px] font-black uppercase tracking-widest text-white/35 group-hover:text-[#FFEA00]"}>
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
  );
}

function BlurredText({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center relative group px-1 mx-0.5">
      <span className="filter blur-[6px] opacity-70 select-none pointer-events-none">{children}</span>
      <Lock className="w-4 h-4 text-white/50 absolute z-10" />
    </span>
  );
}

function FeaturedMatchPreview({
  row,
  onGoApp,
  hasFeaturedAccess,
  onUnlockFeatured,
}: {
  row: PredictionRow | null;
  onGoApp: (source: string) => void;
  hasFeaturedAccess: boolean;
  onUnlockFeatured: () => void;
}) {
  if (!row) return null;

  const isOfficialPlay = isModelAlignedOfficialPlay(row);
  const selectedTeam = normalizeTeamName(
    isOfficialPlay ? row.bestBet : row.predictedWinner,
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

  const featuredWinPct =
    isOfficialPlay
      ? getRowSideWinPct(row)
      : getPredictedWinnerWinPct(row);

  const margin = Math.abs(
    (row.predictedHomeScore || 0) -
      (row.predictedAwayScore || 0),
  );

  const displayBestBet =
    row.bestBet?.replace("Sydney", "Roosters") || row.bestBet;
  const displayPredictedWinner =
    row.predictedWinner?.replace("Sydney", "Roosters") ||
    row.predictedWinner;

  const Blur = ({ children }: { children: React.ReactNode }) =>
    hasFeaturedAccess ? <span>{children}</span> : <BlurredText>{children}</BlurredText>;

  const takeaway =
    isOfficialPlay ? (
      <>
        The model has <Blur>{displayBestBet}</Blur> winning by <Blur>{margin} points</Blur> with a <Blur>{formatPercent(featuredWinPct, 1)}</Blur> true win probability. The price still clears our premium filter, so this matchup qualifies as an official model-aligned play.
      </>
    ) : (
      <>
        The model projects <Blur>{displayPredictedWinner}</Blur> to win by <Blur>{margin} points</Blur> with a <Blur>{formatPercent(featuredWinPct, 1)}</Blur> true win probability. It is still a strong match projection, but it does not currently meet the full premium filter for an official H2H play.
      </>
    );

  return (
    <div className="mt-8 mb-4">
      <h2 className="text-3xl font-black text-white mb-6 px-2 uppercase tracking-tight">
        Featured Match
      </h2>
      <HomeCard className="p-8 md:p-12 relative overflow-hidden !border-[#0047FF]">
        <div className="absolute inset-0 bg-[#111317]" />
        <div className="absolute top-0 right-0 h-[390px] w-[82%] bg-[#0047FF]/95 sm:bg-[#0047FF]/58" />
        <div className="absolute -left-48 top-0 h-[520px] w-[520px] rounded-full bg-[#111317]/95" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,rgba(17,19,23,0),#111317_62%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4 mb-8">
              {isOfficialPlay ? (
                <span className="inline-flex items-center gap-2 bg-[#FF2E63] px-3 py-1.5 text-sm font-bold text-white uppercase tracking-wider">
                  <Flame className="w-4 h-4" />
                  Official Play
                </span>
              ) : (
                <span className="inline-flex items-center bg-white/[0.1] px-3 py-1.5 text-sm font-bold text-white uppercase tracking-wider">
                  Match Preview
                </span>
              )}
              <span className="text-sm font-bold text-[#FFEA00] uppercase tracking-widest">
                {row.fixture?.stadium || "Venue TBC"} •{" "}
                {row.fixture
                  ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
                  : "Time TBC"}
              </span>
            </div>

            {/* Score card — click to unlock if not yet accessed */}
            <div 
              className={`flex flex-col mb-8 max-w-3xl border-4 bg-black/40 relative shadow-[8px_8px_0_0_rgba(255,255,255,0.05)] transition-all ${
                hasFeaturedAccess
                  ? 'border-[#00E676]/40 cursor-default'
                  : 'border-white/10 cursor-pointer group hover:border-[#0047FF]/50'
              }`}
              onClick={() => { if (!hasFeaturedAccess) onUnlockFeatured(); }}
            >
              {!hasFeaturedAccess && (
                <>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-20 pointer-events-none" />
                  <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-[#FFEA00] text-black px-6 py-3 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Enter Email to Unlock
                    </div>
                  </div>
                </>
              )}
              {hasFeaturedAccess && (
                <div className="absolute -top-3 -left-3 bg-[#00E676] text-black text-[10px] font-black uppercase tracking-widest px-3 py-1.5 z-30 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Unlocked
                </div>
              )}

              <div className="absolute -top-3 -right-3 bg-[#0047FF] text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-2 shadow-[4px_4px_0_0_#111317] z-30">
                Projected Score
              </div>

              <div className="flex items-center justify-between p-6 sm:p-8 border-b-4 border-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0047FF]/10 mix-blend-overlay"></div>
                <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                  <TeamLogo
                    teamName={row.homeTeam}
                    className="w-12 h-12 sm:w-16 sm:h-16 opacity-80"
                  />
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
                    {row.homeTeam}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl md:text-6xl font-black text-[#0047FF] tracking-tighter leading-none relative z-10">
                  {hasFeaturedAccess
                    ? Math.round(row.predictedHomeScore)
                    : <BlurredText>{Math.round(row.predictedHomeScore)}</BlurredText>
                  }
                </div>
              </div>

              <div className="flex items-center justify-between p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0047FF]/10 mix-blend-overlay"></div>
                <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                  <TeamLogo
                    teamName={row.awayTeam}
                    className="w-12 h-12 sm:w-16 sm:h-16 opacity-80"
                  />
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
                    {row.awayTeam}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl md:text-6xl font-black text-[#0047FF] tracking-tighter leading-none relative z-10">
                  {hasFeaturedAccess
                    ? Math.round(row.predictedAwayScore)
                    : <BlurredText>{Math.round(row.predictedAwayScore)}</BlurredText>
                  }
                </div>
              </div>
            </div>

            {/* Best Bet — blurred until email entered */}
            {isOfficialPlay && (
              <div className="mb-10 inline-flex flex-col items-start border-l-[6px] border-[#00E676] bg-[#00E676]/10 px-6 py-5 shadow-[4px_4px_0_0_rgba(0,230,118,0.2)]">
                <span className="text-xs font-black text-[#00E676] uppercase tracking-widest mb-1">
                  Model Play
                </span>
                <span className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
                  {hasFeaturedAccess ? displayBestBet : <BlurredText>{displayBestBet}</BlurredText>}
                </span>
              </div>
            )}

            <div className="text-base sm:text-lg md:text-xl font-medium text-white/80 leading-relaxed max-w-3xl mb-8 sm:mb-10 bg-white/5 p-6 border-l-4 border-[#FFEA00]">
              <span className="font-black text-[#FFEA00] uppercase tracking-wider block sm:inline sm:mr-3 mb-2 sm:mb-0">
                Model says:
              </span>
              {takeaway}
            </div>

            {/* Stats row — blurred until email entered */}
            <div className="flex flex-wrap items-center gap-6 sm:gap-10 pt-8 border-t border-white/[0.08]">
              <div>
                <div className="text-[10px] sm:text-xs font-bold text-white/50 mb-1 sm:mb-2 uppercase tracking-widest">
                  Win Prob
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#00E676]">
                  {hasFeaturedAccess ? formatPercent(featuredWinPct, 2) : <BlurredText>{formatPercent(featuredWinPct, 2)}</BlurredText>}
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs font-bold text-white/50 mb-1 sm:mb-2 uppercase tracking-widest">
                  Model Odds
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {hasFeaturedAccess ? (selectedModel ? selectedModel.toFixed(2) : "—") : <BlurredText>{selectedModel ? selectedModel.toFixed(2) : "—"}</BlurredText>}
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs font-bold text-white/50 mb-1 sm:mb-2 uppercase tracking-widest">
                  Market Odds
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {hasFeaturedAccess ? (selectedOdds ? selectedOdds.toFixed(2) : "—") : <BlurredText>{selectedOdds ? selectedOdds.toFixed(2) : "—"}</BlurredText>}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-widest">
                  Model Edge
                </div>
                <div className="text-2xl font-black text-[#FF2E63]">
                  +{formatPercent(row.bestEdge, 2)}
                </div>
              </div>
            </div>

            {/* Unlock CTA — shown only when not yet accessed */}
            {!hasFeaturedAccess && (
              <div className="mt-8">
                <button
                  onClick={onUnlockFeatured}
                  className="inline-flex items-center gap-2 bg-[#FFEA00] text-black px-8 py-4 text-base font-black hover:bg-[#FFD600] transition-colors uppercase tracking-wide shadow-[4px_4px_0_0_#FF2E63]"
                >
                  <Mail className="w-5 h-5" />
                  Unlock Match — Free
                </button>
                <p className="text-xs text-white/40 mt-2 font-mono">No credit card required. Just your email.</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-auto flex flex-col items-end gap-4 mt-4 md:mt-0">
            <button
              onClick={() => onGoApp('featured_view_predictions')}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#0047FF] text-white px-8 py-4 text-lg font-black hover:bg-[#003BCC] transition-colors uppercase tracking-wide"
            >
              View Predictions
              <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
            <AffiliateMarketButton
              payload="rightedge_featured_match"
              bookmaker="Betr"
              label="Open Betr market"
              className="w-full md:w-[286px]"
            />
          </div>
        </div>
      </HomeCard>
    </div>
  );
}

function HomeMethodology({ onGoApp }: { onGoApp: (source: string) => void }) {
  return (
    <div className="mt-8 mb-4" id="how-it-works">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 px-2">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">
            How it works
          </h2>
          <div className="text-[#00E676] font-bold uppercase tracking-widest text-xs mt-1">
            How the model works
          </div>
        </div>
        <button
          onClick={() => onGoApp('methodology_view_predictions')}
          className="text-sm font-black text-white hover:text-[#FFEA00] uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          View Predictions <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HomeCard className="p-8 border-t-8 border-[#0047FF]">
          <div className="text-4xl font-black text-[#0047FF] mb-4">
            01
          </div>
          <h3 className="text-xl font-black text-white uppercase mb-2">
            Model Probability
          </h3>
          <p className="text-white/70 font-bold text-sm leading-relaxed">
            We simulate every NRL matchup thousands of times
            using advanced team ratings, player values, and
            historical data to generate true win probabilities.
          </p>
        </HomeCard>
        <HomeCard className="p-8 border-t-8 border-[#FFEA00]">
          <div className="text-4xl font-black text-[#FFEA00] mb-4">
            02
          </div>
          <h3 className="text-xl font-black text-white uppercase mb-2">
            Market Comparison
          </h3>
          <p className="text-white/70 font-bold text-sm leading-relaxed">
            Our true probabilities are converted into fair odds
            and continuously compared against live bookmaker
            pricing to identify mathematical overlays.
          </p>
        </HomeCard>
        <HomeCard className="p-8 border-t-8 border-[#FF2E63]">
          <div className="text-4xl font-black text-[#FF2E63] mb-4">
            03
          </div>
          <h3 className="text-xl font-black text-white uppercase mb-2">
            Model Plays
          </h3>
          <p className="text-white/70 font-bold text-sm leading-relaxed">
            When the model identifies a meaningful gap
            between its probability and the market price,
            it becomes a model play.
          </p>
        </HomeCard>
      </div>
    </div>
  );
}

function HomePage({
  data,
  onGoApp,
  hasFeaturedAccess,
  onUnlockFeatured,
  onRequestPremium,
}: {
  data: DashboardData | null;
  onGoApp: (source: string) => void;
  hasFeaturedAccess: boolean;
  onUnlockFeatured: () => void;
  onRequestPremium: (source: string) => void;
}) {
  const featured = getFeaturedPrediction(
    data?.predictions || [],
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PublicHero
        data={data}
        onGoApp={onGoApp}
        onUnlockFeatured={onUnlockFeatured}
        onRequestPremium={onRequestPremium}
      />
      <div id="featured-match-section">
        <FeaturedMatchPreview
          row={featured}
          onGoApp={onGoApp}
          hasFeaturedAccess={hasFeaturedAccess}
          onUnlockFeatured={onUnlockFeatured}
        />
      </div>
      <HomeMethodology onGoApp={onGoApp} />
    </div>
  );
}
function ArticlesPage() {
  const articles = [
    {
      hash: "article-round-5-2026",
      tag: "PREDICTIONS",
      tagColor: "bg-[#FF2E63]",
      title: "NRL Round 5 2026 — Model vs Market",
      excerpt: "Full model output for every Round 5 match. Projected scores, win probabilities, and identified edges across all eight games.",
      date: "April 2026",
    },
    {
      hash: "article-methodology",
      tag: "METHODOLOGY",
      tagColor: "bg-[#0047FF]",
      title: "How the RightEdge Model Works",
      excerpt: "A deep dive into how we simulate every NRL match, calculate true win probabilities, and identify where bookmakers are mispricing the market.",
      date: "April 2026",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <GlassCard className="p-8 border-l-4 border-l-[#0047FF]">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
          Articles
        </h1>
        <p className="text-white/50 font-bold uppercase tracking-widest text-sm">
          Model insights, methodology and round previews
        </p>
      </GlassCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((article) => (
          <div
            key={article.hash}
            onClick={() => { window.location.hash = article.hash; }}
            className="bg-[#111317] border-2 border-white/10 shadow-[8px_8px_0_0_#0047FF] p-8 border-l-4 border-l-[#FFEA00] cursor-pointer hover:border-l-[#0047FF] transition-all"
          >
            <div className={`inline-flex px-3 py-1 text-xs font-black text-white uppercase tracking-widest mb-4 ${article.tagColor}`}>
              {article.tag}
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-3">
              {article.title}
            </h2>
            <p className="text-white/60 font-bold text-sm leading-relaxed mb-6">
              {article.excerpt}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-white/30 text-xs font-bold uppercase tracking-widest">
                {article.date}
              </span>
              <span className="text-[#FFEA00] text-xs font-black uppercase tracking-widest flex items-center gap-1">
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
      color: "text-[#0047FF]",
      borderColor: "border-[#0047FF]",
    },
    {
      title: "2. Market Comparison",
      text: "Market prices are pulled alongside model odds so edges can be evaluated in real time.",
      color: "text-[#FF2E63]",
      borderColor: "border-[#FF2E63]",
    },
    {
      title: "3. Value Detection",
      text: "A value edge exists when the market offers a better price than the model implies.",
      color: "text-[#FFEA00]",
      borderColor: "border-[#FFEA00]",
    },
    {
      title: "4. Official Play Filter",
      text: "Not every lean becomes an official play. The product should clearly separate interest from action.",
      color: "text-[#00E676]",
      borderColor: "border-[#00E676]",
    },
    {
      title: "5. Staking Discipline",
      text: "Stake sizing uses Kelly-derived logic with a conservative fractional cap.",
      color: "text-[#0047FF]",
      borderColor: "border-[#0047FF]",
    },
    {
      title: "6. Performance Measurement",
      text: "Track realised profit, ROI, bankroll curve and CLV to judge whether the edge is real.",
      color: "text-[#FF2E63]",
      borderColor: "border-[#FF2E63]",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <GlassCard className="p-8 md:p-12 border-l-4 border-l-[#0047FF]">
        <div className="inline-flex items-center gap-2 bg-[#0047FF] px-4 py-2 text-sm font-black text-white mb-6 uppercase tracking-widest">
          <Info className="w-4 h-4" />
          How RightEdge Works
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 sm:mb-6 uppercase">
          Mathematical precision over gut instinct.
        </h2>
        <div className="text-white/70 font-bold leading-relaxed text-sm sm:text-base md:text-lg max-w-[840px]">
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
            className={`p-8 border-l-4 ${block.borderColor}`}
          >
            <div
              className={`text-xl font-black mb-4 uppercase tracking-tighter ${block.color}`}
            >
              {block.title}
            </div>
            <div className="text-white/70 font-bold text-base leading-7">
              {block.text}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-8 border-l-4 border-l-[#FFEA00]">
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
              className="bg-[#1E232B] p-6 flex items-center gap-4 text-white font-bold uppercase tracking-wider text-sm border border-white/5"
            >
              <BadgeCheck className="w-6 h-6 text-[#FFEA00]" />
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
                    background: "#FFEA00",
                    border: "none",
                    borderRadius: "0px",
                    color: "#000",
                    fontWeight: "900",
                    boxShadow: "8px 8px 0px rgba(0,0,0,1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#FFEA00"
                  strokeWidth={4}
                  fill="rgba(255,234,0,0.1)"
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
                    background: "#00E676",
                    border: "none",
                    borderRadius: "0px",
                    color: "#000",
                    fontWeight: "900",
                    boxShadow: "8px 8px 0px rgba(0,0,0,1)",
                  }}
                />
                <Bar dataKey="clv" radius={[0, 0, 0, 0]}>
                  {data.clvData.map((_, idx) => (
                    <Cell
                      key={`clv-${idx}`}
                      fill={idx === 0 ? "#00E676" : "#FFEA00"}
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
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
}) {
  const rows = [...data.predictions].sort(sortPredictionsByFixture);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <ResponsibleGamblingNotice />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
        {rows.map((row, i) => {
          const predictedScore =
            row.predictedHomeScore || row.predictedAwayScore
              ? `${Math.round(row.predictedHomeScore)} - ${Math.round(row.predictedAwayScore)}`
              : "—";

          const winnerOdds = getPredictedWinnerMarketOdds(row);
          const winnerModelOdds = getPredictedWinnerModelOdds(row);
          const winnerWinPct = getPredictedWinnerWinPct(row);

          return (
            <GlassCard
              key={i}
              className="p-0 relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] uppercase font-black text-white/50 tracking-widest mb-3">
                      {row.fixture
                        ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
                        : "TBC"}
                    </div>
                    <div className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo
                          teamName={row.homeTeam}
                          className="w-10 h-10 rounded-sm shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
                        />
                        <span className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                          {row.homeTeam}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <TeamLogo
                          teamName={row.awayTeam}
                          className="w-10 h-10 rounded-sm shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
                        />
                        <span className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                          {row.awayTeam}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-white/50 mt-4 uppercase tracking-widest">
                      {row.fixture?.stadium || "TBC"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative px-5 md:px-6 pb-5 md:pb-6">
                <div className="grid grid-cols-2 gap-4 pb-5 border-b-2 border-white/10 mb-5">
                  <div className="bg-[#1E232B] p-3 border-l-4 border-l-[#FFEA00]">
                    <div className="text-[10px] uppercase font-black tracking-widest text-[#FFEA00] mb-1">
                      Proj Score
                    </div>
                    <div className="text-xl md:text-2xl font-black text-white">
                      {predictedScore}
                    </div>
                  </div>
                  <div className="bg-[#1E232B] p-3 border-l-4 border-l-[#00E676]">
                    <div className="text-[10px] uppercase font-black tracking-widest text-[#00E676] mb-1">
                      Proj Winner
                    </div>
                    {row.predictedWinner ? (
                      <div className="flex items-center gap-2 mt-1">
                        <TeamLogo
                          teamName={row.predictedWinner}
                          className="w-6 h-6 text-[10px]"
                        />
                        <span className="text-sm md:text-base font-black text-white truncate">
                          {row.predictedWinner}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white/35 font-black text-lg">
                        —
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center text-xs">
                  <div className="font-black text-white/50 uppercase tracking-widest text-[10px] pr-2">
                    Win %
                  </div>
                  <div className="font-black text-[#00E676] uppercase tracking-widest text-[10px] text-center">
                    Model
                  </div>
                  <div className="font-black text-[#FFEA00] uppercase tracking-widest text-[10px] text-center">
                    Model Odds
                  </div>

                  <div className="font-black text-white/70 uppercase text-[11px] tracking-wider">
                    Home
                  </div>
                  <div className="bg-[#1E232B] py-2.5 text-center font-black text-white border-b-2 border-[#00E676]/30">
                    {formatPercent(
                      getImpliedWinPctFromOdds(
                        row.modelHomeOdds,
                      ),
                      1,
                    )}
                  </div>
                  <div className="bg-[#1E232B] py-2.5 text-center font-black text-white border-b-2 border-[#FFEA00]/30">
                    {row.modelHomeOdds ? row.modelHomeOdds.toFixed(2) : "—"}
                  </div>

                  <div className="font-black text-white/70 uppercase text-[11px] tracking-wider">
                    Away
                  </div>
                  <div className="bg-[#1E232B] py-2.5 text-center font-black text-white border-b-2 border-[#00E676]/30">
                    {formatPercent(
                      getImpliedWinPctFromOdds(
                        row.modelAwayOdds,
                      ),
                      1,
                    )}
                  </div>
                  <div className="bg-[#1E232B] py-2.5 text-center font-black text-white border-b-2 border-[#FFEA00]/30">
                    {row.modelAwayOdds ? row.modelAwayOdds.toFixed(2) : "—"}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="bg-[#111317] border border-white/10 p-3">
                    <div className="text-[10px] uppercase font-black tracking-widest text-white/45 mb-1">
                      Model Winner %
                    </div>
                    <div className="text-lg font-black text-[#00E676]">
                      {formatPercent(winnerWinPct, 1)}
                    </div>
                  </div>
                  <div className="bg-[#111317] border border-white/10 p-3">
                    <div className="text-[10px] uppercase font-black tracking-widest text-white/45 mb-1">
                      Model Odds
                    </div>
                    <div className="text-lg font-black text-white">
                      {winnerModelOdds ? winnerModelOdds.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="bg-[#111317] border border-white/10 p-3">
                    <div className="text-[10px] uppercase font-black tracking-widest text-white/45 mb-1">
                      Best Odds
                    </div>
                    <div className="text-lg font-black text-[#FFEA00]">
                      {winnerOdds ? `$${winnerOdds.toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>

                <MatchLiveOddsPanel
                  row={row}
                  selectedTeam={row.predictedWinner}
                  fallbackOdds={winnerOdds}
                  locked={false}
                />
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

function probabilityFromEdge(edge: number, scale = 7.5) {
  return Math.max(1, Math.min(99, (1 / (1 + Math.exp(-(edge / scale)))) * 100));
}

function getBestPremiumMarketPlayForMatch(
  row: PredictionRow,
  marketMap: SgmMarketMap,
): PremiumMarketPlay | null {
  const matchMarkets = getSgmMatchMarkets(marketMap, row);
  const candidates: PremiumMarketPlay[] = [];
  const projectedTotal = row.predictedHomeScore + row.predictedAwayScore;
  const projectedHomeMargin = row.predictedHomeScore - row.predictedAwayScore;
  const predictedWinner = normalizeTeamName(row.predictedWinner);
  const winnerWinPct = getPredictedWinnerWinPct(row);

  Object.entries(matchMarkets).forEach(([bookKey, bookData]) => {
    const bookmaker = displayBookmakerName(bookKey);

    bookData.spreads.forEach((spread) => {
      const team = normalizeTeamName(spread.team);
      const projectedTeamMargin =
        team === normalizeTeamName(row.homeTeam)
          ? projectedHomeMargin
          : -projectedHomeMargin;
      const coverEdge = projectedTeamMargin + spread.point;
      const modelPct = probabilityFromEdge(coverEdge, 7.5);

      if (modelPct < 53 || spread.odds < 1.55) return;

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
      const modelPct = probabilityFromEdge(edge, 8);

      if (modelPct < 53 || total.odds < 1.55) return;

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
      if (winnerWinPct < 55 || odds < 1.35) return;

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

  if (!candidates.length) {
    const odds = getPredictedWinnerMarketOdds(row);
    if (winnerWinPct >= 55 && odds >= 1.35) {
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
    const typeRank = (play: PremiumMarketPlay) =>
      play.type === "Line" ? 3 : play.type === "Total" ? 2 : 1;
    const aScore = a.modelPct + Math.min(8, Math.max(0, (a.odds - 1.8) * 6)) + typeRank(a);
    const bScore = b.modelPct + Math.min(8, Math.max(0, (b.odds - 1.8) * 6)) + typeRank(b);
    return bScore - aScore;
  });

  return rankedCandidates[0];
}

function buildPremiumMarketPlays(
  data: DashboardData,
  marketMap: SgmMarketMap,
  now = Date.now(),
) {
  const settledMatchKeys = new Set(
    data.betLog
      .filter((b) => b.result === "W" || b.result === "L")
      .map((b) => buildMatchLabelKey(b.match)),
  );

  return [...data.predictions]
    .sort(sortPredictionsByFixture)
    .filter((row) => !settledMatchKeys.has(buildMatchLabelKey(row.match)))
    .filter((row) => !hasPredictionKickedOff(row, now))
    .map((row) => getBestPremiumMarketPlayForMatch(row, marketMap))
    .filter(Boolean) as PremiumMarketPlay[];
}

function PremiumMarketPlayCard({ play }: { play: PremiumMarketPlay }) {
  const { row } = play;
  const predictedScore =
    row.predictedHomeScore || row.predictedAwayScore
      ? `${Math.round(row.predictedHomeScore)}-${Math.round(row.predictedAwayScore)}`
      : "—";
  const detail =
    play.type === "Line"
      ? `Model margin ${play.projectedValue && play.projectedValue > 0 ? "+" : ""}${Math.round(play.projectedValue || 0)} vs market ${formatSgmLine(play.marketPoint || 0)}`
      : play.type === "Total"
        ? `Model total ${Math.round(play.projectedValue || 0)} vs market ${play.marketPoint}`
        : `Model winner ${formatPercent(play.modelPct, 1)} vs market ${formatPercent(getImpliedWinPctFromOdds(play.odds), 1)}`;

  return (
    <GlassCard className="p-4 md:p-6 border-l-4 border-l-[#00E676]">
      <div className="flex items-start justify-between gap-3 md:gap-4 mb-4">
        <div>
          <div className="text-[10px] uppercase font-black text-white/45 tracking-widest mb-2">
            {row.fixture
              ? `${row.fixture.day} ${row.fixture.dateLabel} @ ${row.fixture.aedt} AEST`
              : "Time TBC"}
          </div>
          <div className="flex items-center gap-2.5 md:gap-3">
            <TeamLogo
              teamName={play.type === "Total" ? row.predictedWinner : play.selection}
              className="w-9 h-9 md:w-11 md:h-11 rounded-sm shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
            />
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
        <span className="shrink-0 bg-[#FF2E63] text-white px-2.5 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
          {play.type}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        <div className="bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Score
          </div>
          <div className="text-base md:text-lg font-black text-white">
            {predictedScore}
          </div>
        </div>
        <div className="bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Model %
          </div>
          <div className="text-base md:text-lg font-black text-[#00E676]">
            {formatPercent(play.modelPct, 1)}
          </div>
        </div>
        <div className="bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Odds
          </div>
          <div className={isBetrBookmaker(play.bookmaker) ? "text-base md:text-lg font-black text-[#73F4DB]" : "text-base md:text-lg font-black text-[#FFEA00]"}>
            ${play.odds.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#1E232B] p-2.5 md:p-3">
          <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
            Bookie
          </div>
          <BookmakerName
            name={getPreviewBookmakerName(play.bookmaker)}
            className="text-[11px] md:text-xs font-black uppercase text-white"
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
    </GlassCard>
  );
}

function BestBetsPage({
  data,
  onRequestAccess,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
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

  const matchReads = useMemo(
    () => buildPremiumMarketPlays(data, marketMap, now).slice(0, 8),
    [data, marketMap, now],
  );

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
  const tryScorerBestBets = Object.values(tryScorerGroups)
    .flatMap((players) => {
      const keys = getMatchBestBetKeys(players);
      return players
        .filter((row) => !isTryScorerMatchLive(row))
        .filter((row) => keys.has(getTryScorerKey(row)))
        .map((row) => ({
          row,
          signal: getTryScorerSignal(row, keys),
        }));
    })
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
    .slice(0, 8);

  if (!hasPaidAccess()) {
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
              Unlock Premium Plays — $9/week
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
            Best Match Plays
          </h3>
          <div className="text-[10px] md:text-xs font-black text-white/45 uppercase tracking-widest mt-1">
            Model margin and total compared against current market lines
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
              No match reads available right now.
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
            {matchReads.map((play) => (
              <PremiumMarketPlayCard key={play.id} play={play} />
            ))}
          </div>
        )}
      </div>

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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
            {tryScorerBestBets.map(({ row, signal }) => (
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
                      <div>
                        <div className="text-lg md:text-2xl font-black text-white tracking-tight leading-[1.05]">
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
                  <span className={`shrink-0 px-2.5 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest ${getTryScorerSignalClass(signal?.label)}`}>
                    {signal?.label || "Best Bet"}
                  </span>
                </div>
                <div className="mt-4 md:mt-5 grid grid-cols-3 gap-2.5 md:gap-3">
                  <div className="bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Model %
                    </div>
                    <div className="text-base md:text-lg font-black text-white">
                      {formatPercent(row.statsInsiderPct, 1)}
                    </div>
                  </div>
                  <div className="bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Odds
                    </div>
                    <div className={isBetrBookmaker(row.bookmaker) ? "text-base md:text-lg font-black text-[#73F4DB]" : "text-base md:text-lg font-black text-[#00E676]"}>
                      ${row.bestOdds.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-[#1E232B] p-2.5 md:p-3">
                    <div className="text-[9px] font-black text-white/45 uppercase tracking-widest mb-1">
                      Bookie
                    </div>
                    <BookmakerName
                      name={getPreviewBookmakerName(row.bookmaker)}
                      className="text-[11px] md:text-xs font-black uppercase text-[#FFEA00]"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TryScorersPage({
  data,
  onRequestAccess,
}: {
  data: DashboardData;
  onRequestAccess: (targetHash?: string) => void;
}) {
  const now = useMinuteNow();
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

  const predictionByMatch = useMemo(
    () =>
      new Map(
        data.predictions.map((prediction) => [
          buildMatchLabelKey(prediction.match),
          prediction,
        ]),
      ),
    [data.predictions],
  );

  const roundFilteredRows =
    selectedRound === "all"
      ? data.tryScorers
      : data.tryScorers.filter((row) => row.round === selectedRound);

  const valuePlays = roundFilteredRows
    .filter((row) => !hasPredictionKickedOff(predictionByMatch.get(buildMatchLabelKey(row.match)), now))
    .filter((row) => getTryScorerSignal(row) || isTryScorerBestBetCandidate(row));
  const roundLabel =
    selectedRound === "all" ? "All rounds" : `Round ${selectedRound}`;

  const matchGroups = valuePlays.reduce((groups, row) => {
    if (!groups[row.match]) groups[row.match] = [];
    groups[row.match].push(row);
    return groups;
  }, {} as Record<string, TryScorerRow[]>);

  const matchCount = Object.keys(matchGroups).length;

  if (!hasPaidAccess()) {
    return (
      <div className="flex flex-col gap-6 md:gap-8">
        <GlassCard className="p-8 md:p-12 text-center !border-[#FF2E63] !shadow-[8px_8px_0_0_#FF2E63] relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,46,99,0.08),transparent_55%)]" />
          <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
            <div className="bg-[#FF2E63] p-4 mb-6 shadow-[4px_4px_0_0_#0047FF]">
              <Lock className="w-10 h-10 text-white stroke-[3px]" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-3">
              Premium Content
            </h2>
            <p className="text-sm md:text-base text-white/70 font-bold leading-relaxed mb-8">
              Try Scorer plays are included with RightEdge Premium. Unlock the full round to see model plays, Try Scorer signals and live prices.
            </p>
            <button
              onClick={() => onRequestAccess("try-scorers")}
              className="inline-flex items-center justify-center gap-3 bg-[#FF2E63] text-white px-8 py-4 text-base font-black uppercase tracking-wider hover:bg-[#E62959] transition-colors shadow-[4px_4px_0_0_#0047FF]"
            >
              Unlock Premium Plays — $9/week
              <ArrowRight className="w-5 h-5 stroke-[3px]" />
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
                <div className="hidden md:block">
                  <table className="w-full text-left border-collapse">
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
                            <div className={isBetrBookmaker(row.bookmaker) ? "text-sm font-black text-[#73F4DB]" : "text-sm font-black text-[#00E676]"}>
                              ${row.bestOdds.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs font-bold text-[#FFEA00] uppercase tracking-wider">
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
                          <div className={isBetrBookmaker(row.bookmaker) ? "text-xl font-black text-[#73F4DB]" : "text-xl font-black text-white"}>
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
  return marketMap[buildMatchLabelKey(match.match)] || {};
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
  const modelPct = Math.max(38, Math.min(76, 50 + (coverEdge * 4)));

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
    modelPct: Math.max(38, Math.min(76, 50 + (totalDiff * 3))),
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
              Unlock Premium Plays — $9/week
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
                    background: "#FF2E63",
                    border: "none",
                    borderRadius: "0px",
                    color: "#fff",
                    fontWeight: "900",
                    boxShadow: "8px 8px 0px rgba(0,0,0,1)",
                  }}
                />
                <Bar dataKey="profit" radius={[0, 0, 0, 0]}>
                  {data.teamPerformance.map((row, idx) => (
                    <Cell
                      key={`team-${row.team}-${idx}`}
                      fill={
                        row.profit >= 0 ? "#00E676" : "#FF2E63"
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
                    background: "#FFEA00",
                    border: "none",
                    borderRadius: "0px",
                    color: "#000",
                    fontWeight: "900",
                    boxShadow: "8px 8px 0px rgba(0,0,0,1)",
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
                        ["#00E676", "#FF2E63", "#0047FF"][index]
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

function AppDashboard({
  data,
  loading,
  error,
  refreshing,
  loadData,
  onExit,
  onRequestAccess,
}: {
  data: DashboardData | null;
  loading: boolean;
  error: string;
  refreshing: boolean;
  loadData: (isRefresh?: boolean) => void;
  onExit: () => void;
  onRequestAccess: (targetHash?: string) => void;
}) {
  const [isAdmin, setIsAdmin] = useState(() => isUserAdmin());

  useEffect(() => {
    const handleAdminAuth = () => {
      setIsAdmin(isUserAdmin());
    };
    window.addEventListener('adminAuthChanged', handleAdminAuth);
    return () => window.removeEventListener('adminAuthChanged', handleAdminAuth);
  }, []);

  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    if (
      ["matches", "best-bets", "try-scorers", "performance", "admin"].includes(
        hash,
      )
    ) {
      return hash;
    }
    return "matches";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (
        [
          "matches",
          "best-bets",
          "try-scorers",
          "performance",
          "admin",
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
  }, []);

  const handlePageChange = (newPage: string) => {
    setPage(newPage);
    window.location.hash = newPage;
  };

  const handleManageSubscription = async () => {
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
      } else {
        alert(data.error || "Failed to open subscription portal.");
      }
    } catch (err) {
      alert("Network error. Please try again later.");
    }
  };

  const pageTitle = useMemo(() => {
    switch (page) {
      case "matches":
        return {
          subtitle: "Matches",
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
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-8 pb-24 xl:pb-0">
        <GlassCard className="hidden xl:block p-6 h-fit xl:sticky xl:top-6 border-l-4 border-l-[#FFEA00]">
          <div className="flex items-center gap-4 pb-6 border-b-2 border-white/10 mb-6">
            <div>
              <div className="text-4xl font-black tracking-tighter text-white uppercase">
                RightEdge
              </div>
              <div className="text-xs text-[#FFEA00] font-black tracking-widest uppercase mt-2">
                NRL Predictions • 2026
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {getAppPages(isAdmin).map((item) => (
              <SidebarItem
                key={item.id}
                active={page === item.id}
                icon={item.icon}
                label={item.label}
                premium={item.id === "best-bets" || item.id === "try-scorers"}
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

          <div className="mt-10 bg-[#1E232B] border-2 border-white/10 shadow-[4px_4px_0_0_#111317] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-white/50 font-black">
                Live status
              </div>
              <button
                onClick={() => loadData(true)}
                className="text-[#FFEA00] hover:text-white transition-colors"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="inline-flex items-center gap-2 bg-[#00E676] px-3 py-1.5 text-black text-xs font-black uppercase tracking-widest">
              <span className="w-2.5 h-2.5 bg-black" />
              Active
            </div>
            <div className="mt-4 text-sm text-white/70 leading-relaxed font-bold">
            </div>
            <button 
              onClick={handleManageSubscription}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#111317] border border-white/10 text-white/70 hover:text-white hover:border-white/30 py-3 text-xs font-black uppercase tracking-widest transition-colors"
            >
              Manage Subscription
            </button>
          </div>
        </GlassCard>

        <div className="min-w-0 flex flex-col gap-4 md:gap-8">
          <div className="xl:hidden flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={onExit}
                className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest hover:text-[#FFEA00] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Home
              </button>
              <button
                onClick={handleManageSubscription}
                className="text-white/50 text-[10px] font-black uppercase tracking-widest hover:text-[#FFEA00] transition-colors"
              >
                Manage Subscription
              </button>
            </div>
          </div>
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 md:gap-6 pb-4 md:pb-6 border-b-2 border-white/10">
            <div className="flex justify-between items-start xl:block">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#FFEA00] font-black mb-1 md:mb-2">
                  {pageTitle.title}
                </div>
                <h1 className="text-[18px] md:text-4xl font-black tracking-tight text-white uppercase leading-none">
                  {pageTitle.subtitle}
                </h1>
              </div>
              <button
                onClick={() => loadData(true)}
                className="xl:hidden bg-[#1E232B] p-2 border-2 border-white/10 text-[#FFEA00] shadow-[2px_2px_0_0_#111317] shrink-0 ml-4 mt-1"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-sm text-white font-black uppercase tracking-wider mt-2 xl:mt-0">
              <span className="inline-flex items-center gap-2 bg-[#1E232B] px-3 md:px-4 py-1.5 md:py-2 border-2 border-[#00E676]/45 shadow-[2px_2px_0_0_#111317] md:shadow-[4px_4px_0_0_rgba(0,230,118,0.22)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping-pong rounded-full bg-[#00E676] opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00E676]" />
                </span>
                <span>{data?.currentRoundLabel || "Round 1"} Live</span>
              </span>
            </div>
          </div>

          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-10 h-10 mx-auto mb-6 animate-spin text-[#FFEA00]" />
                <div className="text-white font-black text-xl mb-2 uppercase tracking-tight">
                  Loading live sheet data
                </div>
                <div className="text-white/50 text-sm font-bold uppercase tracking-wider">
                  Pulling Match Predictions, Bet Log, Fixtures
                  and Performance Tracker
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <GlassCard className="p-10 max-w-[560px] w-full border-l-4 border-l-[#FF2E63]">
                <div className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">
                  Couldn’t load live data
                </div>
                <div className="text-white/70 mb-8 whitespace-pre-line font-bold">
                  {error}
                </div>
                <button
                  onClick={() => loadData()}
                  className="inline-flex items-center gap-3 bg-[#FFEA00] text-black px-8 py-4 font-black hover:bg-[#FFD600] uppercase tracking-wide transition-colors"
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
                />
              )}
              {page === "matches" && (
                <PredictionsPage
                  data={data}
                  onRequestAccess={onRequestAccess}
                />
              )}
              {page === "try-scorers" && (
                <TryScorersPage
                  data={data}
                  onRequestAccess={onRequestAccess}
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
              {page === "performance" && (
                <div className="space-y-8">
                  <ResultsPage data={data} />
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-[#111317] border-t-2 border-white/10 z-[100] px-1 pb-4 pt-2 flex justify-around items-center shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
        {getAppPages(isAdmin).map((item) => (
          <button
            key={item.id}
            onClick={() => handlePageChange(item.id)}
            className={`flex flex-col items-center p-2 min-w-[50px] sm:min-w-[60px] transition-all ${
              page === item.id
                ? "text-[#FFEA00] scale-110"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <div className="mb-1">{item.icon}</div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
              {item.label}
            </span>
          </button>
        ))}
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
  const [showFeaturedGate, setShowFeaturedGate] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [paidAccessState, setPaidAccessState] = useState(() => hasPaidAccess());
  const [featuredAccess, setFeaturedAccess] = useState(() => hasFeaturedMatchAccess());
  const [isAdmin, setIsAdmin] = useState(() => isUserAdmin());

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
      const INTERNAL_EMAILS = ['elliott@woodbry.com', 'ewoodbry@gmail.com'];
      let isInternal = false;

      // 0. This visitor_id was previously marked internal (persisted across sessions)
      if (localStorage.getItem('rightedge_internal_visitor') === 'true') isInternal = true;

      // 1. Manual override flag
      if (localStorage.getItem('rightedge_internal_traffic') === 'true') isInternal = true;

      // 2. Admin panel authenticated (current or past session this visit)
      if (localStorage.getItem('rightedge_admin_auth') === 'true') isInternal = true;

      // 3. Logged-in email is an internal address (rightedge_email_access)
      let visitorEmail: string | null = null;
      try {
        const accessVal = localStorage.getItem('rightedge_email_access');
        if (accessVal) {
          const parsed = JSON.parse(accessVal);
          if (parsed.email) {
            visitorEmail = parsed.email.toLowerCase();
            if (INTERNAL_EMAILS.includes(visitorEmail)) isInternal = true;
          }
        }
      } catch (e) {}

      // 4. Legacy rightedge_user key
      try {
        const userStr = localStorage.getItem('rightedge_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.email && INTERNAL_EMAILS.includes(user.email.toLowerCase())) isInternal = true;
        }
      } catch (e) {}

      // 5. Current page is the admin route
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
        is_subscriber: !!localStorage.getItem('rightedge_subscriber'),
        ...data
      };

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
  }, [sitePage]);

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
      app_section: ["matches", "best-bets", "try-scorers", "performance", "admin"].includes(rawHash),
    });
  };

  const navigateToApp = (source: string = 'unknown') => {
    (window as any).trackAnalyticsEvent?.('unlock_click', { cta_source: source });
    if (hasEmailAccess()) {
      setSitePage("app");
      window.location.hash = "matches";
    } else {
      setShowEmailGate(true);
    }
  };

  const requestPremiumAccess = (source: string = 'unknown') => {
    const targetHash = ["matches", "best-bets", "try-scorers"].includes(source)
      ? source
      : "best-bets";
    setSitePage("app");
    window.location.hash = targetHash;
    if (hasPaidAccess()) {
      setPaidAccessState(true);
      setShowEmailGate(false);
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
    const appHashes = ["matches", "best-bets", "try-scorers", "performance", "admin"];
    const publicHashes = ["results", "methodology", "ad-studio", "articles", "article-round-5-2026", "article-methodology"];

    if (hash === "sgm-builder") {
      window.location.hash = "best-bets";
      return;
    }

    if (appHashes.includes(hash)) {
      trackHashPageView(hash);
      if (hasEmailAccess() || hasPaidAccess()) {
        setShowEmailGate(false);
        setSitePage("app");
      } else {
        setShowEmailGate(true);
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
      const returnHash = ["matches", "best-bets", "try-scorers"].includes(fallbackReturnHash)
        ? fallbackReturnHash
        : "best-bets";

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
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.email) {
          setEmailAccess(data.email);
          setPaidAccess(data.email);
          setPaidAccessState(true);
          setShowEmailGate(false);

          const confirmedReturnHash = ["matches", "best-bets", "try-scorers"].includes(data.returnHash)
            ? data.returnHash
            : returnHash;

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

    confirmStripeSuccess();
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () =>
      window.removeEventListener("hashchange", checkHash);
  }, []);

  const handleEmailSuccess = () => {
    setShowEmailGate(false);
    setSitePage("app");
  };

  const handleSetPage = (page: string) => {
    if (page === "app") {
      window.location.hash = "matches";
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
    <div className="min-h-screen bg-[#0B0D10] text-[#F5F3EE] relative overflow-hidden font-sans">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27 viewBox=%270 0 200 200%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27200%27 height=%27200%27 filter=%27url(%23n)%27 opacity=%271%27/%3E%3C/svg%3E")',
        }}
      />

      <div
        className={`max-w-[1600px] mx-auto relative z-10 flex flex-col gap-10 ${sitePage === "app" ? "px-3 py-4 sm:px-6 sm:py-6" : "px-6 py-6"}`}
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
          />
        </div>

        {sitePage === "home" && (
          <HomePage
            data={data}
            onGoApp={navigateToApp}
            hasFeaturedAccess={featuredAccess}
            onRequestPremium={requestPremiumAccess}
            onUnlockFeatured={() => {
              document.getElementById('featured-match-section')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => setShowFeaturedGate(true), 300);
            }}
          />
        )}

        {sitePage === "results" && data && (
          <ResultsPage data={data} />
        )}
        {sitePage === "methodology" && <MethodologyPage />}
        {sitePage === "articles" && <ArticlesPage />}
        {sitePage === "article-round-5-2026" && <ArticleRound5 />}
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
            onRequestAccess={(targetHash = "best-bets") => {
              setSitePage("app");
              window.location.hash = targetHash;
              if (hasPaidAccess()) {
                setPaidAccessState(true);
                setShowEmailGate(false);
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
            setShowEmailGate(false);
          }}
          onSuccess={handleEmailSuccess}
        />

        <FeaturedMatchEmailGate
          open={showFeaturedGate}
          onClose={() => setShowFeaturedGate(false)}
          onSuccess={() => {
            setFeaturedAccess(true);
            setShowFeaturedGate(false);
          }}
          onPremiumSuccess={() => {
            setFeaturedAccess(true);
            setPaidAccessState(hasPaidAccess());
            setShowEmailGate(false);
            setShowFeaturedGate(false);
            setSitePage("app");
            window.location.hash = "best-bets";
          }}
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
            const returnHash = ["matches", "best-bets", "try-scorers"].includes(currentPremiumHash)
              ? currentPremiumHash
              : "best-bets";
            window.location.hash = returnHash;
          }}
        />

        <div className="p-8 mt-8 border-t-4 border-white/10 bg-[#111317]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-white font-black text-2xl uppercase tracking-tighter mb-2">
                RightEdge
                <button
                  onClick={() => {
                    localStorage.removeItem(
                      "rightedge_email_access",
                    );
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
              <p className="text-[#FF2E63]/80 mb-4">
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
