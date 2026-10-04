/**
 * Model Lab — hidden admin-only prototype page.
 *
 * Purpose: prove the 2027 architecture end-to-end on a real match before the
 * Rugby League World Cup, without touching anything subscribers can see.
 *
 *   sharp anchor (exchange back/lay midpoint, spread-gated)
 *     -> true probability
 *     -> value edge vs every soft bookmaker
 *     -> pick ledger with automated settlement, P&L, ROI and CLV
 *
 * VISIBILITY
 * Rendered only when `isAdmin` is true, exactly like Results Entry and Admin
 * (see getAppPages). It holds no secrets — the market capture is public odds
 * data. The gate exists so subscribers are not shown an unvalidated model.
 *
 * DATA
 * `grand-final-capture.json` is a frozen snapshot of real market data taken on
 * 2026-10-04 before kickoff. Fixture data for the lab only — nothing here feeds
 * the live site, the freeze snapshot, or the published plays.
 *
 * STYLING — READ BEFORE EDITING
 * The app runs under `rightedge-admin-editorial-theme`, which rewrites the dark
 * palette into the light editorial one at runtime (src/styles/theme.css). That
 * override covers SOLID tokens only:
 *     bg-[#111116]  bg-[#16161D]  text-white  text-[#9CA3AF]  border-[#1E1E2E]
 *
 * It does NOT cover opacity variants. `bg-white/5`, `bg-[#00E676]/10` and
 * `text-white/40` pass through untouched and render as near-invisible washes on
 * the cream background. Never use an opacity variant on this page.
 *
 * Structure mirrors the live match / premium-play cards: bordered panels with a
 * header row, metric tiles of bordered #16161D with [8px] 0.18em labels,
 * #00E676 for positive numbers, #6B7280 for tile labels, #FF2E63 for negative.
 */

import { useEffect, useMemo, useState } from "react";
import capture from "./grand-final-capture.json";
import {
  settleAll,
  summarisePicks,
  type MatchResult,
  type Pick,
} from "../../model/pick-ledger";
import {
  parseScoresFeed,
  toMatchResults,
  type ParsedScore,
} from "../../model/score-feed";

const VALUE_THRESHOLD_PCT = 2;

function fmtPct(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

function fmtUnits(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}u`;
}

/** Panel matching GlassCard. */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111116] border border-[#1E1E2E] ${className}`}>{children}</div>;
}

/** Metric tile matching the live premium-play cards. */
function Tile({ label, value, tone = "white" }: {
  label: string;
  value: string;
  tone?: "white" | "green" | "red" | "muted";
}) {
  const toneClass = {
    white: "text-white",
    green: "text-[#00E676]",
    red: "text-[#FF2E63]",
    muted: "text-[#6B7280]",
  }[tone];
  return (
    <div className="border border-[#1E1E2E] bg-[#16161D] p-3">
      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
        {label}
      </div>
      <div className={`text-base md:text-xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

/** Square chip matching the card badges. Solid fills only — no opacity. */
function Chip({ children, tone = "muted" }: {
  children: React.ReactNode;
  tone?: "muted" | "green" | "red" | "gold";
}) {
  const toneClass = {
    muted: "border-[#1E1E2E] bg-[#16161D] text-[#6B7280]",
    green: "border-[#00E676] bg-[#00E676] text-black",
    red: "border-[#FF2E63] bg-[#FF2E63] text-white",
    gold: "border-[#FFEA00] bg-[#FFEA00] text-black",
  }[tone];
  return (
    <span className={`shrink-0 border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${toneClass}`}>
      {children}
    </span>
  );
}

function CardHead({ title, meta, chip }: { title: string; meta?: string; chip?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#1E1E2E] px-4 py-3 md:px-5">
      <div className="min-w-0">
        <div className="truncate text-lg md:text-2xl font-black uppercase tracking-tight text-white">
          {title}
        </div>
        {meta && (
          <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
            {meta}
          </div>
        )}
      </div>
      {chip}
    </div>
  );
}

/** The plays the lab model would publish, derived from the capture. */
function buildLabPicks(): Pick[] {
  const offers = capture.offers as any[];
  const qualifying = offers.filter((o) => o.edgePct >= VALUE_THRESHOLD_PCT);
  // Nothing cleared the bar today. Record the best candidate per market anyway
  // so settlement, P&L and CLV can be exercised against a real result.
  const source = qualifying.length
    ? qualifying
    : ["h2h", "line", "total"]
        .map((m) => offers.filter((o) => o.market === m).sort((a, b) => b.edgePct - a.edgePct)[0])
        .filter(Boolean);

  return source.map((o, i) => ({
    id: `lab-${i}`,
    matchKey: capture.matchKey,
    competition: "NRL" as const,
    market: o.market,
    selection: o.selection,
    point: o.point ?? undefined,
    entryPrice: o.price,
    stakeUnits: 1,
    bookmaker: o.book,
    placedAt: capture.capturedAt,
    modelProbability: o.fairPct,
  }));
}

export function ModelLabPage() {
  const picks = useMemo(buildLabPicks, []);

  // Scores arrive from the feed. No human types a result.
  const [scores, setScores] = useState<ParsedScore[]>([]);
  const [feedState, setFeedState] = useState<"loading" | "ok" | "error">("loading");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/scores?daysFrom=2", { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const payload = await res.json();
        if (cancelled) return;
        setScores(parseScoresFeed(payload?.events));
        setFetchedAt(payload?.fetchedAt ?? null);
        setFeedState("ok");
      } catch {
        if (!cancelled) setFeedState("error");
      }
    };
    load();
    // Poll while a match is in progress so the ledger settles by itself.
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const match = useMemo(
    () => scores.find((s) => s.matchKey === capture.matchKey) ?? null,
    [scores],
  );

  // Only FINAL matches produce settleable results — a live score never settles.
  const results: MatchResult[] = useMemo(() => toMatchResults(scores), [scores]);
  const settled = useMemo(() => settleAll(picks, results), [picks, results]);
  const summary = useMemo(() => summarisePicks(picks, results), [picks, results]);

  const anchor = capture.anchor as any;
  const sharp = capture.sharpLines as any;
  const topOffers = (capture.offers as any[]).slice(0, 8);
  const probs = Object.entries(anchor.probabilities as Record<string, number>);

  return (
    <div className="space-y-5 md:space-y-6 pb-24">
      {/* ---------- page header, matching SectionHeader ---------- */}
      <div className="mb-6 md:mb-8 border-b border-[#1E1E2E] pb-4 md:pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Chip tone="gold">Admin Only</Chip>
          <Chip>Not Published</Chip>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-white uppercase tracking-tight mb-1 md:mb-2">
          Model Lab · 2027 Engine
        </h2>
        <div className="text-[10px] md:text-sm font-medium text-[#9CA3AF] uppercase tracking-widest">
          {capture.homeTeam} v {capture.awayTeam} ·{" "}
          {new Date(capture.capturedAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}{" "}
          AEST
        </div>
      </div>

      {/* ---------- 1. true probability ---------- */}
      <Card className="overflow-hidden p-0">
        <CardHead
          title="True Probability"
          meta="Step 1 · Betfair back/lay midpoint, de-vigged"
          chip={<Chip tone="green">Gate Pass</Chip>}
        />
        <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2 md:gap-3 md:p-5">
          {probs.map(([team, pct]) => (
            <div key={team} className="border border-[#1E1E2E] bg-[#16161D] p-4">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#6B7280] mb-1.5">
                {team}
              </div>
              <div className="text-2xl md:text-3xl font-black text-[#00E676]">
                {pct.toFixed(2)}%
              </div>
              <div className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                Back ${anchor.back[team]} · Lay ${anchor.lay[team]} · Fair ${(100 / pct).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-[#1E1E2E] px-4 py-3 md:px-5 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
          Widest back/lay spread {anchor.maxSpreadPct}% · gate 5%
        </div>
      </Card>

      {/* ---------- 2. sharp lines ---------- */}
      <Card className="overflow-hidden p-0">
        <CardHead
          title="Sharp Lines"
          meta="Step 2 · Pinnacle, de-vigged"
          chip={<Chip>Projected</Chip>}
        />
        <div className="px-4 pt-4 md:px-5">
          <div className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
            {capture.homeTeam} {sharp.projectedScore[capture.homeTeam]}
            <span className="text-[#6B7280] mx-2">–</span>
            {sharp.projectedScore[capture.awayTeam]} {capture.awayTeam}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 md:gap-3 md:p-5">
          <Tile label="Line" value={`${sharp.line.point > 0 ? "+" : ""}${sharp.line.point}`} />
          <Tile label="Total" value={String(sharp.total.point)} />
          <Tile label="Margin SD" value={String(sharp.marginSdAssumed)} tone="muted" />
        </div>
        <div className="border-t border-[#1E1E2E] px-4 py-3 md:px-5 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
          Margin SD is an assumption — not fitted to NRL history
        </div>
      </Card>

      {/* ---------- 3. value scan ---------- */}
      <Card className="overflow-hidden p-0">
        <CardHead
          title="Value Scan"
          meta={`Step 3 · ${capture.offers.length} offers · threshold +${VALUE_THRESHOLD_PCT}%`}
          chip={<Chip tone="red">No Qualifier</Chip>}
        />
        <div>
          {topOffers.map((o, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-[#1E1E2E] px-4 py-3 md:px-5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm md:text-base font-black uppercase tracking-tight text-white">
                  {o.selection}
                  {o.point != null ? ` ${o.point > 0 ? "+" : ""}${o.point}` : ""}
                </div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                  {o.market} · {o.book} · fair {o.fairPct}%
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-sm md:text-base font-black text-white">${o.price}</div>
                <div className={`min-w-[64px] text-right text-sm md:text-base font-black ${
                  o.edgePct >= VALUE_THRESHOLD_PCT ? "text-[#00E676]"
                  : o.edgePct >= 0 ? "text-white" : "text-[#FF2E63]"}`}>
                  {fmtPct(o.edgePct)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 md:px-5 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
          No offer cleared the threshold · ledger tracks best candidate per market
        </div>
      </Card>

      {/* ---------- 4. settlement ---------- */}
      <Card className="overflow-hidden p-0">
        <CardHead
          title="Settlement"
          meta="Step 4 · Scores arrive automatically"
          chip={
            feedState === "error" ? <Chip tone="red">Feed Down</Chip>
            : match?.status === "final" ? <Chip tone="green">Full Time</Chip>
            : match?.status === "live" ? <Chip tone="gold">Live</Chip>
            : <Chip>Pending</Chip>
          }
        />

        {/* score banner */}
        <div className="border-b border-[#1E1E2E] px-4 py-4 md:px-5">
          {feedState === "loading" && (
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
              Loading scores…
            </div>
          )}
          {feedState === "error" && (
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#FF2E63]">
              Score feed unavailable · picks stay pending · nothing guessed
            </div>
          )}
          {feedState === "ok" && !match && (
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
              No score row for this match yet
            </div>
          )}
          {feedState === "ok" && match && (
            <>
              <div className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                {match.homeTeam} {match.homeScore ?? "–"}
                <span className="text-[#6B7280] mx-2">–</span>
                {match.awayScore ?? "–"} {match.awayTeam}
              </div>
              <div className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                {match.status === "live" ? "Live scores never settle · ledger waits for full time · " : ""}
                Feed{" "}
                {match.lastUpdate
                  ? new Date(match.lastUpdate).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })
                  : "—"}
                {fetchedAt
                  ? ` · fetched ${new Date(fetchedAt).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })}`
                  : ""}{" "}
                AEST · refresh 60s
              </div>
            </>
          )}
        </div>

        {/* pick rows */}
        <div>
          {settled.map((s) => (
            <div
              key={s.pick.id}
              className="flex items-center justify-between gap-3 border-b border-[#1E1E2E] px-4 py-3 md:px-5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm md:text-base font-black uppercase tracking-tight text-white">
                  {s.pick.selection}
                  {s.pick.point != null ? ` ${s.pick.point > 0 ? "+" : ""}${s.pick.point}` : ""}
                </div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
                  {s.pick.market} · {s.pick.bookmaker} · ${s.pick.entryPrice}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Chip tone={
                  s.outcome === "win" ? "green"
                  : s.outcome === "loss" ? "red"
                  : s.outcome === "pending" ? "muted" : "gold"
                }>
                  {s.outcome}
                </Chip>
                <div className={`min-w-[64px] text-right text-sm md:text-base font-black ${
                  s.profitUnits === null ? "text-[#6B7280]"
                  : s.profitUnits > 0 ? "text-[#00E676]"
                  : s.profitUnits < 0 ? "text-[#FF2E63]" : "text-white"}`}>
                  {fmtUnits(s.profitUnits)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* totals */}
        <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4 md:gap-3 md:p-5">
          <Tile label="Staked" value={`${summary.stakedUnits.toFixed(2)}u`} />
          <Tile label="Returned" value={`${summary.returnedUnits.toFixed(2)}u`} />
          <Tile
            label="Profit"
            value={fmtUnits(summary.profitUnits)}
            tone={summary.profitUnits > 0 ? "green" : summary.profitUnits < 0 ? "red" : "white"}
          />
          <Tile
            label="ROI"
            value={summary.settled ? fmtPct(summary.roiPct) : "—"}
            tone={summary.roiPct > 0 ? "green" : summary.roiPct < 0 ? "red" : "white"}
          />
        </div>

        <div className="border-t border-[#1E1E2E] px-4 py-3 md:px-5 text-[9px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
          {summary.settled} settled · {summary.pending} pending · {summary.wins}W–{summary.losses}L
          {summary.pushes ? `–${summary.pushes}P` : ""} · strike{" "}
          {summary.settled ? `${summary.strikeRatePct.toFixed(1)}%` : "—"} · avg CLV{" "}
          {summary.averageClvPct === null ? "not captured" : fmtPct(summary.averageClvPct)}
        </div>
      </Card>
    </div>
  );
}
