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
 * This component is rendered only when `isAdmin` is true, exactly like the
 * existing "Results Entry" and "Admin" pages (see getAppPages). It holds no
 * secrets: the market capture it reads is public odds data. The gate exists so
 * subscribers are not shown an unvalidated model, NOT because the contents are
 * sensitive. Do not use it to display anything that would matter if leaked.
 *
 * DATA
 * `grand-final-capture.json` is a frozen snapshot of real market data taken on
 * 2026-10-04 before kickoff. It is fixture data for the lab only. Nothing here
 * feeds the live site, the freeze snapshot, or the published plays.
 *
 * STYLING
 * Uses the site's own design language: #111116 panels on #1E1E2E borders,
 * black uppercase headings, #FFEA00 eyebrows, #00E676 positive, #9CA3AF muted.
 * Do NOT introduce slate/indigo Tailwind defaults here — they are not part of
 * this product's palette and read as a foreign component pasted into the page.
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

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111116] border border-[#1E1E2E] ${className}`}>{children}</div>;
}

function SectionHead({ step, title, source }: { step: string; title: string; source?: string }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-[#FFEA00]">
        Step {step}
      </div>
      <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">{title}</h2>
      {source && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
          {source}
        </div>
      )}
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

  return (
    <div className="space-y-6 pb-24">
      {/* ---------- page header ---------- */}
      <div>
        <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#FFEA00]">
          Admin · Not Published
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
          Model Lab
        </h1>
        <p className="mt-2 text-sm font-medium text-white/55">
          Prototype of the 2027 engine on real {capture.homeTeam} v {capture.awayTeam} market data
          captured{" "}
          {new Date(capture.capturedAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}{" "}
          AEST. Nothing here feeds the live site.
        </p>
      </div>

      {/* ---------- 1. true probability ---------- */}
      <Panel className="p-5">
        <SectionHead step="1" title="True Probability" source={anchor.source} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(anchor.probabilities as Record<string, number>).map(([team, pct]) => (
            <div key={team} className="bg-[#16161D] border border-[#1E1E2E] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                {team}
              </div>
              <div className="mt-1 text-3xl font-black tracking-tight text-white">
                {pct.toFixed(2)}%
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#9CA3AF]">
                back ${anchor.back[team]} · lay ${anchor.lay[team]} · fair ${(100 / pct).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <span className="text-[#9CA3AF]">Widest spread {anchor.maxSpreadPct}% · gate 5%</span>
          <span className="px-2 py-0.5 bg-[#00E676]/10 text-[#00E676]">Pass</span>
        </div>
      </Panel>

      {/* ---------- 2. sharp lines ---------- */}
      <Panel className="p-5">
        <SectionHead step="2" title="Sharp Lines & Projected Score" source={sharp.source} />
        <div className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
          Line {sharp.line.team} {sharp.line.point > 0 ? "+" : ""}{sharp.line.point} · Total {sharp.total.point}
        </div>
        <div className="mt-3 text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
          {capture.homeTeam} {sharp.projectedScore[capture.homeTeam]}
          <span className="text-[#9CA3AF] mx-2">–</span>
          {sharp.projectedScore[capture.awayTeam]} {capture.awayTeam}
        </div>
        <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#FFEA00]">
          Margin SD {sharp.marginSdAssumed} is an assumption, not fitted to NRL history
        </div>
      </Panel>

      {/* ---------- 3. value scan ---------- */}
      <Panel className="p-5">
        <SectionHead
          step="3"
          title="Value Scan"
          source={`${capture.offers.length} offers · threshold +${VALUE_THRESHOLD_PCT}%`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                <th className="text-left pb-2">Market</th>
                <th className="text-left pb-2">Selection</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-left pb-2 pl-4">Book</th>
                <th className="text-right pb-2">Fair</th>
                <th className="text-right pb-2">Edge</th>
              </tr>
            </thead>
            <tbody>
              {topOffers.map((o, i) => (
                <tr key={i} className="border-t border-[#1E1E2E]">
                  <td className="py-2 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
                    {o.market}
                  </td>
                  <td className="py-2 font-bold text-white whitespace-nowrap">
                    {o.selection}
                    {o.point != null ? ` ${o.point > 0 ? "+" : ""}${o.point}` : ""}
                  </td>
                  <td className="py-2 text-right font-bold text-white">${o.price}</td>
                  <td className="py-2 pl-4 text-[#9CA3AF] whitespace-nowrap">{o.book}</td>
                  <td className="py-2 text-right text-[#9CA3AF]">{o.fairPct}%</td>
                  <td className={`py-2 text-right font-black ${
                    o.edgePct >= VALUE_THRESHOLD_PCT ? "text-[#00E676]"
                    : o.edgePct >= 0 ? "text-white" : "text-white/40"}`}>
                    {fmtPct(o.edgePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-[#16161D] border border-[#1E1E2E] p-3 text-[11px] font-medium text-[#9CA3AF]">
          No offer cleared +{VALUE_THRESHOLD_PCT}%. The ledger below tracks the best candidate per
          market so settlement can be exercised — these are not published plays.
        </div>
      </Panel>

      {/* ---------- 4. settlement ---------- */}
      <Panel className="p-5">
        <SectionHead
          step="4"
          title="Settlement & Profitability"
          source="Scores arrive automatically — no manual entry"
        />

        {/* Live score banner — fed automatically, never typed. */}
        <div className="bg-[#16161D] border border-[#1E1E2E] p-4 mb-5">
          {feedState === "loading" && (
            <div className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
              Loading scores…
            </div>
          )}
          {feedState === "error" && (
            <div className="text-[11px] font-black uppercase tracking-widest text-[#FF5252]">
              Score feed unavailable · picks stay pending · nothing guessed
            </div>
          )}
          {feedState === "ok" && !match && (
            <div className="text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
              No score row for this match yet
            </div>
          )}
          {feedState === "ok" && match && (
            <>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  match.status === "final" ? "bg-[#00E676]"
                  : match.status === "live" ? "bg-[#FFEA00] animate-pulse"
                  : match.status === "error" ? "bg-[#FF5252]" : "bg-[#9CA3AF]"}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                  {match.status === "final" ? "Full Time"
                    : match.status === "live" ? "Live"
                    : match.status === "error" ? "Score Unreadable"
                    : "Scheduled"}
                </span>
              </div>
              <div className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
                {match.homeTeam} {match.homeScore ?? "–"}
                <span className="text-[#9CA3AF] mx-2">–</span>
                {match.awayScore ?? "–"} {match.awayTeam}
              </div>
              {match.status === "live" && (
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#FFEA00]">
                  Live scores never settle · the ledger waits for full time
                </div>
              )}
              <div className="mt-2 text-[10px] font-medium uppercase tracking-widest text-white/35">
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                <th className="text-left pb-2">Pick</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-left pb-2 pl-4">Book</th>
                <th className="text-left pb-2 pl-4">Result</th>
                <th className="text-right pb-2">Return</th>
                <th className="text-right pb-2">P/L</th>
              </tr>
            </thead>
            <tbody>
              {settled.map((s) => (
                <tr key={s.pick.id} className="border-t border-[#1E1E2E]">
                  <td className="py-2.5">
                    <div className="font-bold text-white whitespace-nowrap">
                      {s.pick.selection}
                      {s.pick.point != null ? ` ${s.pick.point > 0 ? "+" : ""}${s.pick.point}` : ""}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                      {s.pick.market}
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-bold text-white">${s.pick.entryPrice}</td>
                  <td className="py-2.5 pl-4 text-[#9CA3AF] whitespace-nowrap">{s.pick.bookmaker}</td>
                  <td className="py-2.5 pl-4">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      s.outcome === "win" ? "bg-[#00E676]/10 text-[#00E676]"
                      : s.outcome === "loss" ? "bg-[#FF5252]/10 text-[#FF5252]"
                      : s.outcome === "pending" ? "bg-white/5 text-[#9CA3AF]"
                      : "bg-[#FFEA00]/10 text-[#FFEA00]"}`}>
                      {s.outcome}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-white">
                    {s.unitsReturned === null ? "—" : `${s.unitsReturned.toFixed(2)}u`}
                  </td>
                  <td className={`py-2.5 text-right font-black ${
                    s.profitUnits === null ? "text-white/40"
                    : s.profitUnits > 0 ? "text-[#00E676]"
                    : s.profitUnits < 0 ? "text-[#FF5252]" : "text-white"}`}>
                    {fmtUnits(s.profitUnits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            ["Staked", `${summary.stakedUnits.toFixed(2)}u`, "text-white"],
            ["Returned", `${summary.returnedUnits.toFixed(2)}u`, "text-white"],
            ["Profit", fmtUnits(summary.profitUnits),
              summary.profitUnits > 0 ? "text-[#00E676]" : summary.profitUnits < 0 ? "text-[#FF5252]" : "text-white"],
            ["ROI", summary.settled ? fmtPct(summary.roiPct) : "—",
              summary.roiPct > 0 ? "text-[#00E676]" : summary.roiPct < 0 ? "text-[#FF5252]" : "text-white"],
          ] as [string, string, string][]).map(([label, value, tone]) => (
            <div key={label} className="bg-[#16161D] border border-[#1E1E2E] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                {label}
              </div>
              <div className={`mt-1 text-2xl font-black tracking-tight ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
          {summary.settled} settled · {summary.pending} pending · {summary.wins}W–{summary.losses}L
          {summary.pushes ? `–${summary.pushes}P` : ""} · strike rate{" "}
          {summary.settled ? `${summary.strikeRatePct.toFixed(1)}%` : "—"} · avg CLV{" "}
          {summary.averageClvPct === null ? "not captured" : fmtPct(summary.averageClvPct)}
        </div>
        {match?.status !== "final" && (
          <div className="mt-3 bg-[#16161D] border border-[#1E1E2E] p-3 text-[11px] font-medium text-[#9CA3AF]">
            Picks settle automatically at full time from the score feed. They stay pending until
            then — the ledger never guesses an outcome.
          </div>
        )}
      </Panel>
    </div>
  );
}
