/**
 * Model Lab — hidden admin-only prototype page.
 *
 * Proves the 2027 architecture end-to-end on a real match before the Rugby
 * League World Cup, without touching anything subscribers can see:
 *
 *   sharp anchor (exchange back/lay midpoint, spread-gated) -> true probability
 *   -> value edge vs every soft bookmaker
 *   -> pick ledger with automated settlement, P&L, ROI and CLV
 *
 * VISIBILITY
 * Rendered only when `isAdmin` is true, like Results Entry and Admin. It holds
 * no secrets — the capture is public odds data. The gate exists so subscribers
 * are not shown an unvalidated model.
 *
 * LAYOUT (per the design brief)
 * One main match surface at full content width, split ~60/40:
 *   LEFT  — "What does the model expect?"  matchup, projected score, markets
 *   RIGHT — "What is RightEdge recommending?"  core play, scorers, multi
 * Model / Edge / Odds are three labelled numbers on one line, not three boxed
 * tiles. Bookmaker prices are compact market rows, never large promotional
 * buttons — they must not outweigh the actual recommendation. Uppercase and
 * letter-spacing are reserved for eyebrows and chips, not body text.
 *
 * STYLING — READ BEFORE EDITING
 * The app runs under `rightedge-admin-editorial-theme` (src/styles/theme.css),
 * which rewrites the dark palette to the light editorial one at runtime. It
 * converts SOLID tokens (bg-[#111116], bg-[#16161D], bg-[#1E232B], text-white,
 * text-[#9CA3AF], text-[#6B7280], border-[#1E1E2E]) and the text-white/20..70
 * opacity steps.
 *
 * It does NOT convert any `bg-white/N` or `bg-[#colour]/N` — those pass through
 * and render as near-invisible washes on the cream background. Never use them.
 * `bg-[#0047FF]` is forced to #F1F1EF, so blue cannot mark an active control;
 * the live card uses `bg-white text-[#0A0A0F]` instead (App.tsx:6908).
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
type MarketTab = "h2h" | "line" | "total";

function fmtPct(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

function fmtUnits(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}u`;
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

/** Section eyebrow — uppercase is reserved for these. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
      {children}
    </div>
  );
}

/** Solid chip. No opacity fills — the theme cannot convert them. */
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

/** Labelled numbers on one line — replaces boxed tiles per the brief. */
function InlineStats({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
            {it.label}
          </div>
          <div className={`text-lg md:text-xl font-black tabular-nums ${it.tone ?? "text-white"}`}>
            {it.value}
          </div>
        </div>
      ))}
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

/** Best available (longest) price per selection for a market tab. */
function bestRowsFor(market: MarketTab) {
  const offers = (capture.offers as any[]).filter((o) => o.market === market);
  const bySelection = new Map<string, any>();
  for (const o of offers) {
    const key = `${o.selection}|${o.point ?? ""}`;
    const current = bySelection.get(key);
    if (!current || o.price > current.price) bySelection.set(key, o);
  }
  return [...bySelection.values()].sort((a, b) => b.fairPct - a.fairPct);
}

export function ModelLabPage() {
  const picks = useMemo(buildLabPicks, []);
  const [tab, setTab] = useState<MarketTab>("h2h");

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
  const home = capture.homeTeam;
  const away = capture.awayTeam;
  const projHome = sharp.projectedScore[home];
  const projAway = sharp.projectedScore[away];
  const homeWinning = projHome >= projAway;

  const rows = useMemo(() => bestRowsFor(tab), [tab]);
  const best = (capture.offers as any[])[0];
  const qualifies = best.edgePct >= VALUE_THRESHOLD_PCT;

  return (
    <div className="flex flex-col gap-5 md:gap-6 pb-24">
      {/* ---------- page header ---------- */}
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
        <div className="text-xs text-white/50">
          Captured{" "}
          {new Date(capture.capturedAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}{" "}
          AEST
        </div>
      </div>

      {/* ---------- one main match surface ---------- */}
      <div className="border border-[#1E1E2E] bg-[#111116]">
        <div className="grid grid-cols-1 lg:grid-cols-5">

          {/* ===== LEFT ~60% — what the model expects ===== */}
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

              {/* projected score — the centrepiece */}
              <div className="mt-5 border-t border-[#1E1E2E] pt-5">
                <Eyebrow>Projected score</Eyebrow>
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className={`text-xl md:text-2xl font-black uppercase tracking-tight ${homeWinning ? "text-white" : "text-white/50"}`}>
                      {home}
                    </span>
                    <span className={`text-3xl md:text-4xl font-black tabular-nums ${homeWinning ? "text-white" : "text-white/50"}`}>
                      {projHome}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className={`text-xl md:text-2xl font-black uppercase tracking-tight ${!homeWinning ? "text-white" : "text-white/50"}`}>
                      {away}
                    </span>
                    <span className={`text-3xl md:text-4xl font-black tabular-nums ${!homeWinning ? "text-white" : "text-white/50"}`}>
                      {projAway}
                    </span>
                  </div>
                </div>
                <div className="mt-5">
                  <InlineStats items={[
                    { label: "Sharp line", value: signed(sharp.line.point) },
                    { label: "Sharp total", value: String(sharp.total.point) },
                    { label: "Spread gate", value: `${anchor.maxSpreadPct}%`, tone: "text-[#00E676]" },
                  ]} />
                </div>
                <div className="mt-3 text-xs text-white/45">
                  Line and total from Pinnacle, de-vigged. Margin SD{" "}
                  {sharp.marginSdAssumed} is an assumption, not fitted to NRL history.
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

            {/* compact market rows — deliberately not promotional buttons */}
            <div className="px-5 md:px-6 pb-5 md:pb-6">
              {rows.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-b border-[#1E1E2E] py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-black uppercase tracking-tight text-white">
                      {o.selection}{o.point != null ? ` ${signed(o.point)}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-white/45">
                      Model {o.fairPct}% · best at {o.book}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-5">
                    <span className="text-lg font-black text-white tabular-nums">
                      ${o.price.toFixed(2)}
                    </span>
                    <span className={`min-w-[60px] text-right text-sm font-black tabular-nums ${
                      o.edgePct >= VALUE_THRESHOLD_PCT ? "text-[#00E676]"
                      : o.edgePct >= 0 ? "text-white" : "text-[#FF2E63]"}`}>
                      {fmtPct(o.edgePct)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-3 text-xs text-white/45">
                True probability from the Betfair back/lay midpoint, de-vigged.
                Back ${anchor.back[home]} / lay ${anchor.lay[home]} {home}.
              </div>
            </div>
          </div>

          {/* ===== RIGHT ~40% — what RightEdge recommends ===== */}
          <div className="lg:col-span-2">
            <div className="p-5 md:p-6">
              <Eyebrow>RightEdge plays</Eyebrow>

              {/* core play — strongest element after the matchup */}
              <div className="mt-4">
                <Chip tone={qualifies ? "green" : "red"}>
                  {qualifies ? "Core play" : "No qualifying play"}
                </Chip>
                <div className="mt-3 text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  {best.selection}{best.point != null ? ` ${signed(best.point)}` : ""}
                </div>
                <div className="mt-1 text-sm text-white/50">
                  {best.market} · {best.book}
                </div>
                <div className="mt-4">
                  <InlineStats items={[
                    { label: "Model", value: `${best.fairPct}%`, tone: "text-[#00E676]" },
                    { label: "Edge", value: fmtPct(best.edgePct),
                      tone: best.edgePct >= VALUE_THRESHOLD_PCT ? "text-[#00E676]" : "text-[#FF2E63]" },
                    { label: "Odds", value: `$${best.price.toFixed(2)}` },
                  ]} />
                </div>
                <div className="mt-3 text-xs text-white/45">
                  {qualifies
                    ? `Clears the +${VALUE_THRESHOLD_PCT}% threshold.`
                    : `Best of ${capture.offers.length} offers, below the +${VALUE_THRESHOLD_PCT}% threshold — the engine publishes nothing.`}
                </div>
              </div>

              {/* try scorers */}
              <div className="mt-6 border-t border-[#1E1E2E] pt-5">
                <Eyebrow>Try scorers</Eyebrow>
                <div className="mt-2 text-sm text-white/45">
                  Not modelled by the lab engine — no sharp anchor exists for scorer
                  markets on this feed.
                </div>
              </div>

              {/* same game multi */}
              <div className="mt-6 border-t border-[#1E1E2E] pt-5">
                <Eyebrow>Same game multi</Eyebrow>
                <div className="mt-2 text-sm text-white/45">
                  Not modelled yet. Correlated legs need a joint model, not three
                  independent prices multiplied together.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- settlement — the new capability ---------- */}
      <div className="border border-[#1E1E2E] bg-[#111116]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1E2E] px-5 py-4 md:px-6">
          <div>
            <Eyebrow>Settlement &amp; profitability</Eyebrow>
            <div className="mt-1 text-sm text-white/50">
              Scores arrive from the feed — never typed
            </div>
          </div>
          {feedState === "error" ? <Chip tone="red">Feed down</Chip>
            : match?.status === "final" ? <Chip tone="green">Full time</Chip>
            : match?.status === "live" ? <Chip tone="gold">Live</Chip>
            : <Chip>Pending</Chip>}
        </div>

        <div className="px-5 py-4 md:px-6">
          {feedState === "loading" && (
            <div className="text-sm text-white/45">Loading scores…</div>
          )}
          {feedState === "error" && (
            <div className="text-sm font-bold text-[#FF2E63]">
              Score feed unavailable — picks stay pending, nothing is guessed.
            </div>
          )}
          {feedState === "ok" && !match && (
            <div className="text-sm text-white/45">No score row for this match yet.</div>
          )}
          {feedState === "ok" && match && (
            <>
              <div className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                {match.homeTeam} {match.homeScore ?? "–"}
                <span className="text-white/45 mx-2">–</span>
                {match.awayScore ?? "–"} {match.awayTeam}
              </div>
              <div className="mt-2 text-xs text-white/45">
                {match.status === "live"
                  ? "Live scores never settle — the ledger waits for full time. "
                  : ""}
                Feed{" "}
                {match.lastUpdate
                  ? new Date(match.lastUpdate).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })
                  : "—"}
                {fetchedAt
                  ? ` · fetched ${new Date(fetchedAt).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })}`
                  : ""}{" "}
                AEST · refreshes every 60s
              </div>
            </>
          )}
        </div>

        <div className="px-5 md:px-6">
          {settled.map((s) => (
            <div
              key={s.pick.id}
              className="flex items-center justify-between gap-4 border-t border-[#1E1E2E] py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-base font-black uppercase tracking-tight text-white">
                  {s.pick.selection}{s.pick.point != null ? ` ${signed(s.pick.point)}` : ""}
                </div>
                <div className="mt-0.5 text-xs text-white/45">
                  {s.pick.market} · {s.pick.bookmaker} · ${s.pick.entryPrice.toFixed(2)}
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
          ))}
        </div>

        <div className="border-t border-[#1E1E2E] px-5 py-4 md:px-6">
          <InlineStats items={[
            { label: "Staked", value: `${summary.stakedUnits.toFixed(2)}u` },
            { label: "Returned", value: `${summary.returnedUnits.toFixed(2)}u` },
            { label: "Profit", value: fmtUnits(summary.profitUnits),
              tone: summary.profitUnits > 0 ? "text-[#00E676]"
                : summary.profitUnits < 0 ? "text-[#FF2E63]" : "text-white" },
            { label: "ROI", value: summary.settled ? fmtPct(summary.roiPct) : "—",
              tone: summary.roiPct > 0 ? "text-[#00E676]"
                : summary.roiPct < 0 ? "text-[#FF2E63]" : "text-white" },
          ]} />
          <div className="mt-3 text-xs text-white/45">
            {summary.settled} settled · {summary.pending} pending · {summary.wins}W–{summary.losses}L
            {summary.pushes ? `–${summary.pushes}P` : ""} · strike rate{" "}
            {summary.settled ? `${summary.strikeRatePct.toFixed(1)}%` : "—"} · avg CLV{" "}
            {summary.averageClvPct === null ? "not captured" : fmtPct(summary.averageClvPct)}
          </div>
        </div>
      </div>
    </div>
  );
}
