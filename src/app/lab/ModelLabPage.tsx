/**
 * Model Lab — hidden admin-only prototype page.
 *
 * Proves the 2027 sharp-anchor engine on a real match before the Rugby League
 * World Cup. Admin-gated (`isAdmin`), not in the nav, reachable at #model-lab.
 *
 * PRESENTATION RULES — this is a punter-facing surface, not a readout.
 * Show: who is playing, projected score, the play, the price, where to bet.
 * Do NOT ship methodology onto the page. Spread gates, de-vig method, margin
 * SD, back/lay midpoints, offer counts and "scores arrive from the feed" are
 * engineering notes — they belong in this header and in commit messages, never
 * in front of a subscriber. If there is no qualifying play, say so in three
 * words, not a paragraph about thresholds.
 *
 * Reuses the live components so the page carries real team identity:
 * TeamLogo (club colours + crest icon), getTeamColors (accent bars) and
 * AffiliateMarketButton (Betr-branded CTA) are imported from App.tsx.
 *
 * ENGINEERING CAVEATS (deliberately not rendered)
 * - Projected score derives from Pinnacle's de-vigged line and total.
 * - Margin SD 12.5 is an assumption, not fitted to NRL history. It moves the
 *   line-market edges materially and must be fitted before RLWC.
 * - True probability is the Betfair back/lay midpoint, de-vigged, gated at a
 *   5% maximum spread.
 * - Try scorers and SGM are not modelled by this engine; they come from a
 *   different pipeline on the live site and are omitted here rather than
 *   shown as empty sections.
 *
 * STYLING
 * The app runs under `rightedge-admin-editorial-theme` (src/styles/theme.css),
 * which converts solid tokens (bg-[#111116], bg-[#16161D], text-white,
 * text-[#6B7280], border-[#1E1E2E]) and text-white/20..70 to the light theme.
 * It does NOT convert `bg-white/N` or `bg-[#colour]/N` — those render as
 * invisible washes. Never use them. Inline `style` with team colours is safe
 * and is how the live cards do their accent bars.
 */

import { useEffect, useMemo, useState } from "react";
import capture from "./grand-final-capture.json";
import { AffiliateMarketButton, TeamLogo, getTeamColors } from "../App";
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
type MarketTab = "h2h" | "line" | "total";

function fmtUnits(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}u`;
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
      {children}
    </div>
  );
}

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
    <span className={`shrink-0 border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${toneClass}`}>
      {children}
    </span>
  );
}

/** Team row with crest and club-colour accent bar, as on the live match card. */
function TeamRow({ team, score, dimmed }: { team: string; score: number; dimmed: boolean }) {
  const colors = getTeamColors(team);
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(74px,auto)] items-center gap-3 overflow-hidden border border-[#1E1E2E] bg-[#111116] p-3">
      <span
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: colors.secondary }}
      />
      <div className="flex min-w-0 items-center gap-3 pl-1.5">
        <TeamLogo teamName={team} className="h-10 w-10 rounded-sm" />
        <span className={`min-w-0 truncate text-lg md:text-2xl font-black uppercase tracking-tight ${dimmed ? "text-white/50" : "text-white"}`}>
          {team}
        </span>
      </div>
      <div className={`border border-[#1E1E2E] bg-[#16161D] px-2 py-1.5 text-center text-2xl md:text-3xl font-black tabular-nums ${dimmed ? "text-white/50" : "text-white"}`}>
        {score}
      </div>
    </div>
  );
}

/** The plays the lab model would publish, derived from the capture. */
function buildLabPicks(): Pick[] {
  const offers = capture.offers as any[];
  const qualifying = offers.filter((o) => o.edgePct >= VALUE_THRESHOLD_PCT);
  // Nothing cleared the bar today. Track the best candidate per market anyway
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

/** Best available (longest) price per selection for a market tab. */
function bestRowsFor(market: MarketTab) {
  const bySelection = new Map<string, any>();
  for (const o of (capture.offers as any[]).filter((x) => x.market === market)) {
    const key = `${o.selection}|${o.point ?? ""}`;
    const current = bySelection.get(key);
    if (!current || o.price > current.price) bySelection.set(key, o);
  }
  return [...bySelection.values()].sort((a, b) => b.fairPct - a.fairPct);
}

export function ModelLabPage() {
  const picks = useMemo(buildLabPicks, []);
  const [tab, setTab] = useState<MarketTab>("h2h");

  const [scores, setScores] = useState<ParsedScore[]>([]);
  const [feedState, setFeedState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/scores?daysFrom=2", { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const payload = await res.json();
        if (cancelled) return;
        setScores(parseScoresFeed(payload?.events));
        setFeedState("ok");
      } catch {
        if (!cancelled) setFeedState("error");
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const match = useMemo(
    () => scores.find((s) => s.matchKey === capture.matchKey) ?? null,
    [scores],
  );

  // Only FINAL matches settle — a live score never does.
  const results: MatchResult[] = useMemo(() => toMatchResults(scores), [scores]);
  const settled = useMemo(() => settleAll(picks, results), [picks, results]);
  const summary = useMemo(() => summarisePicks(picks, results), [picks, results]);

  const sharp = capture.sharpLines as any;
  const home = capture.homeTeam;
  const away = capture.awayTeam;
  const projHome = sharp.projectedScore[home];
  const projAway = sharp.projectedScore[away];
  const homeWinning = projHome >= projAway;

  const rows = useMemo(() => bestRowsFor(tab), [tab]);
  const best = (capture.offers as any[])[0];
  const qualifies = best.edgePct >= VALUE_THRESHOLD_PCT;
  const bestColors = getTeamColors(best.selection);

  return (
    <div className="flex flex-col gap-5 md:gap-6 pb-24">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1E1E2E] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Chip tone="gold">Admin only</Chip>
            <Chip>Not published</Chip>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-white uppercase tracking-tight">
            Model Lab · 2027 Engine
          </h2>
        </div>
      </div>

      {/* main match surface */}
      <div className="border border-[#1E1E2E] bg-[#111116]">
        <div className="grid grid-cols-1 lg:grid-cols-5">

          {/* LEFT — the match */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#1E1E2E]">
            <div className="p-5 md:p-6">
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                {home} v {away}
              </h3>
              <div className="mt-1 text-sm text-white/50">
                {new Date(capture.commenceTime).toLocaleString("en-AU", {
                  timeZone: "Australia/Sydney", weekday: "long",
                  hour: "numeric", minute: "2-digit",
                })}{" "}
                AEST · Accor Stadium
              </div>

              <div className="mt-5 border-t border-[#1E1E2E] pt-5">
                <Eyebrow>Projected score</Eyebrow>
                <div className="mt-3 flex flex-col gap-2">
                  <TeamRow team={home} score={projHome} dimmed={!homeWinning} />
                  <TeamRow team={away} score={projAway} dimmed={homeWinning} />
                </div>
              </div>
            </div>

            {/* market tabs */}
            <div className="border-t border-[#1E1E2E] px-5 md:px-6 pt-4">
              <div className="grid grid-cols-3 gap-1 border border-[#1E1E2E] bg-[#16161D] p-1">
                {(["h2h", "line", "total"] as MarketTab[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTab(m)}
                    className={`min-h-[34px] px-2 text-[10px] font-black uppercase tracking-widest transition ${
                      tab === m ? "bg-white text-[#0A0A0F]" : "bg-transparent text-[#6B7280]"
                    }`}
                  >
                    {m === "h2h" ? "H2H" : m}
                  </button>
                ))}
              </div>
            </div>

            {/* market rows with crests */}
            <div className="px-5 md:px-6 pb-5 md:pb-6">
              {rows.map((o, i) => {
                const isTeam = o.selection !== "Over" && o.selection !== "Under";
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-[#1E1E2E] py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {isTeam && <TeamLogo teamName={o.selection} className="h-8 w-8 rounded-sm" />}
                      <div className="min-w-0">
                        <div className="truncate text-base font-black uppercase tracking-tight text-white">
                          {o.selection}{o.point != null ? ` ${signed(o.point)}` : ""}
                        </div>
                        <div className="mt-0.5 text-xs text-white/50">{o.book}</div>
                      </div>
                    </div>
                    <span className="shrink-0 text-lg font-black text-white tabular-nums">
                      ${o.price.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — the play */}
          <div className="lg:col-span-2">
            <div className="p-5 md:p-6">
              <Eyebrow>RightEdge play</Eyebrow>

              {qualifies ? (
                <>
                  <div className="mt-3">
                    <Chip tone="green">Core play</Chip>
                  </div>
                  <div
                    className="relative mt-4 overflow-hidden border border-[#1E1E2E] bg-[#16161D] p-4"
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-1.5"
                      style={{ backgroundColor: bestColors.secondary }}
                    />
                    <div className="flex items-center gap-3 pl-1.5">
                      <TeamLogo teamName={best.selection} className="h-11 w-11 rounded-sm" />
                      <div className="min-w-0">
                        <div className="truncate text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                          {best.selection}{best.point != null ? ` ${signed(best.point)}` : ""}
                        </div>
                        <div className="text-xs text-white/50">{best.book}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-7 pl-1.5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
                          Model
                        </div>
                        <div className="text-xl font-black tabular-nums text-[#00E676]">
                          {best.fairPct}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
                          Odds
                        </div>
                        <div className="text-xl font-black tabular-nums text-white">
                          ${best.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <AffiliateMarketButton
                    payload="rightedge_model_lab_play"
                    bookmaker={best.book}
                    odds={best.price}
                    label={`Back at ${best.book}`}
                    className="mt-4"
                  />
                </>
              ) : (
                <>
                  <div className="mt-3">
                    <Chip tone="red">No play</Chip>
                  </div>
                  <div className="mt-4 border border-[#1E1E2E] bg-[#16161D] p-5 text-center">
                    <div className="text-lg font-black uppercase tracking-tight text-white">
                      No play this match
                    </div>
                    <div className="mt-1 text-sm text-white/50">
                      The market is priced correctly
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* settlement */}
      <div className="border border-[#1E1E2E] bg-[#111116]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1E2E] px-5 py-4 md:px-6">
          <Eyebrow>Results</Eyebrow>
          {feedState === "error" ? <Chip tone="red">Feed down</Chip>
            : match?.status === "final" ? <Chip tone="green">Full time</Chip>
            : match?.status === "live" ? <Chip tone="gold">Live</Chip>
            : <Chip>Pending</Chip>}
        </div>

        {feedState === "ok" && match && (match.status === "live" || match.status === "final") && (
          <div className="border-b border-[#1E1E2E] px-5 py-4 md:px-6">
            <div className="flex flex-col gap-2">
              <TeamRow
                team={match.homeTeam}
                score={match.homeScore ?? 0}
                dimmed={(match.homeScore ?? 0) < (match.awayScore ?? 0)}
              />
              <TeamRow
                team={match.awayTeam}
                score={match.awayScore ?? 0}
                dimmed={(match.awayScore ?? 0) < (match.homeScore ?? 0)}
              />
            </div>
          </div>
        )}

        <div className="px-5 md:px-6">
          {settled.map((s) => {
            const isTeam = s.pick.selection !== "Over" && s.pick.selection !== "Under";
            return (
              <div
                key={s.pick.id}
                className="flex items-center justify-between gap-4 border-b border-[#1E1E2E] py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isTeam && <TeamLogo teamName={s.pick.selection} className="h-8 w-8 rounded-sm" />}
                  <div className="min-w-0">
                    <div className="truncate text-base font-black uppercase tracking-tight text-white">
                      {s.pick.selection}{s.pick.point != null ? ` ${signed(s.pick.point)}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      {s.pick.bookmaker} · ${s.pick.entryPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Chip tone={
                    s.outcome === "win" ? "green"
                    : s.outcome === "loss" ? "red"
                    : s.outcome === "pending" ? "muted" : "gold"
                  }>
                    {s.outcome}
                  </Chip>
                  <span className={`min-w-[64px] text-right text-base font-black tabular-nums ${
                    s.profitUnits === null ? "text-white/45"
                    : s.profitUnits > 0 ? "text-[#00E676]"
                    : s.profitUnits < 0 ? "text-[#FF2E63]" : "text-white"}`}>
                    {fmtUnits(s.profitUnits)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 px-5 py-4 md:px-6">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
              Record
            </div>
            <div className="text-xl font-black tabular-nums text-white">
              {summary.wins}–{summary.losses}
              {summary.pushes ? `–${summary.pushes}` : ""}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
              Profit
            </div>
            <div className={`text-xl font-black tabular-nums ${
              summary.profitUnits > 0 ? "text-[#00E676]"
              : summary.profitUnits < 0 ? "text-[#FF2E63]" : "text-white"}`}>
              {fmtUnits(summary.profitUnits)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
              Strike rate
            </div>
            <div className="text-xl font-black tabular-nums text-white">
              {summary.settled ? `${summary.strikeRatePct.toFixed(0)}%` : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
