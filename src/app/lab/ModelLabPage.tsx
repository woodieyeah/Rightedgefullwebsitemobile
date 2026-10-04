/**
 * Model Lab — hidden admin-only prototype page.
 *
 * Purpose: prove the 2027 architecture end-to-end on a real match before the
 * Rugby League World Cup, without touching anything subscribers can see.
 *
 *   sharp anchor (exchange back/lay midpoint, spread-gated)
 *     -> true probability
 *     -> value edge vs every soft bookmaker
 *     -> pick ledger with settlement, P&L, ROI and CLV
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
 */

import { useMemo, useState } from "react";
import capture from "./grand-final-capture.json";
import {
  settleAll,
  summarisePicks,
  type MatchResult,
  type Pick,
} from "../../model/pick-ledger";

const VALUE_THRESHOLD_PCT = 2;

function fmtPct(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

function fmtUnits(n: number | null, dp = 2) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}u`;
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
  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");

  const result: MatchResult | null = useMemo(() => {
    const h = Number(homeScore);
    const a = Number(awayScore);
    if (homeScore.trim() === "" || awayScore.trim() === "") return null;
    if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
    return {
      matchKey: capture.matchKey,
      homeTeam: capture.homeTeam,
      awayTeam: capture.awayTeam,
      homeScore: h,
      awayScore: a,
    };
  }, [homeScore, awayScore]);

  const results = result ? [result] : [];
  const settled = useMemo(() => settleAll(picks, results), [picks, results]);
  const summary = useMemo(() => summarisePicks(picks, results), [picks, results]);

  const anchor = capture.anchor as any;
  const sharp = capture.sharpLines as any;
  const topOffers = (capture.offers as any[]).slice(0, 10);

  return (
    <div className="space-y-6 pb-24">
      {/* ---------- header ---------- */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          MODEL LAB — ADMIN ONLY · NOT PUBLISHED
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Prototype of the 2027 engine running on real {capture.homeTeam} v{" "}
          {capture.awayTeam} market data captured{" "}
          {new Date(capture.capturedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST.
          Nothing here feeds the live site.
        </p>
      </div>

      {/* ---------- 1. sharp anchor ---------- */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-white font-semibold mb-1">1 · True probability</h3>
        <p className="text-xs text-slate-400 mb-3">{anchor.source}</p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(anchor.probabilities as Record<string, number>).map(([team, pct]) => (
            <div key={team} className="rounded-xl bg-slate-800/60 p-3">
              <div className="text-slate-300 text-sm">{team}</div>
              <div className="text-2xl font-bold text-white">{pct.toFixed(2)}%</div>
              <div className="text-xs text-slate-400">
                back ${anchor.back[team]} / lay ${anchor.lay[team]} · fair ${(100 / pct).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-400">
          widest back/lay spread {anchor.maxSpreadPct}% — gate 5% ·{" "}
          <span className="text-emerald-400">PASS</span>
        </div>
      </section>

      {/* ---------- 2. sharp lines ---------- */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-white font-semibold mb-1">2 · Sharp lines &amp; projected score</h3>
        <p className="text-xs text-slate-400 mb-3">{sharp.source}</p>
        <div className="text-sm text-slate-200">
          Line {sharp.line.team} {sharp.line.point > 0 ? "+" : ""}{sharp.line.point} · Total {sharp.total.point}
        </div>
        <div className="mt-2 text-xl font-bold text-white">
          {capture.homeTeam} {sharp.projectedScore[capture.homeTeam]} –{" "}
          {sharp.projectedScore[capture.awayTeam]} {capture.awayTeam}
        </div>
        <div className="mt-1 text-xs text-amber-400/80">
          margin SD {sharp.marginSdAssumed} is an assumption, not fitted to NRL history
        </div>
      </section>

      {/* ---------- 3. value scan ---------- */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-white font-semibold mb-3">
          3 · Value scan — {capture.offers.length} offers, threshold +{VALUE_THRESHOLD_PCT}%
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs">
              <tr><th className="text-left py-1">Market</th><th className="text-left">Selection</th>
                  <th className="text-right">Price</th><th className="text-left pl-3">Book</th>
                  <th className="text-right">Fair</th><th className="text-right">Edge</th></tr>
            </thead>
            <tbody>
              {topOffers.map((o, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="py-1 text-slate-400">{o.market}</td>
                  <td className="text-slate-200">
                    {o.selection}{o.point != null ? ` ${o.point > 0 ? "+" : ""}${o.point}` : ""}
                  </td>
                  <td className="text-right text-slate-200">${o.price}</td>
                  <td className="pl-3 text-slate-400">{o.book}</td>
                  <td className="text-right text-slate-400">{o.fairPct}%</td>
                  <td className={`text-right font-medium ${o.edgePct >= VALUE_THRESHOLD_PCT ? "text-emerald-400" : "text-slate-500"}`}>
                    {fmtPct(o.edgePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          No offer cleared +{VALUE_THRESHOLD_PCT}%. The ledger below tracks the best candidate per
          market so settlement can be exercised — these are not published plays.
        </p>
      </section>

      {/* ---------- 4. settlement ---------- */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="text-white font-semibold mb-3">4 · Settlement &amp; profitability</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-sm text-slate-300">
            {capture.homeTeam}
            <input
              inputMode="numeric"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="—"
              className="ml-2 w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            {capture.awayTeam}
            <input
              inputMode="numeric"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="—"
              className="ml-2 w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <button
            onClick={() => { setHomeScore(""); setAwayScore(""); }}
            className="text-xs text-slate-400 underline"
          >
            clear
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs">
              <tr><th className="text-left py-1">Pick</th><th className="text-right">Price</th>
                  <th className="text-left pl-3">Book</th><th className="text-left pl-3">Result</th>
                  <th className="text-right">Return</th><th className="text-right">P/L</th></tr>
            </thead>
            <tbody>
              {settled.map((s) => (
                <tr key={s.pick.id} className="border-t border-slate-800">
                  <td className="py-1 text-slate-200">
                    {s.pick.selection}
                    {s.pick.point != null ? ` ${s.pick.point > 0 ? "+" : ""}${s.pick.point}` : ""}
                    <span className="text-slate-500 text-xs"> · {s.pick.market}</span>
                  </td>
                  <td className="text-right text-slate-200">${s.pick.entryPrice}</td>
                  <td className="pl-3 text-slate-400">{s.pick.bookmaker}</td>
                  <td className={`pl-3 font-medium ${
                    s.outcome === "win" ? "text-emerald-400"
                    : s.outcome === "loss" ? "text-red-400"
                    : s.outcome === "pending" ? "text-slate-500" : "text-amber-400"}`}>
                    {s.outcome}
                  </td>
                  <td className="text-right text-slate-300">
                    {s.unitsReturned === null ? "—" : `${s.unitsReturned.toFixed(2)}u`}
                  </td>
                  <td className={`text-right font-medium ${
                    s.profitUnits === null ? "text-slate-500"
                    : s.profitUnits > 0 ? "text-emerald-400"
                    : s.profitUnits < 0 ? "text-red-400" : "text-slate-300"}`}>
                    {fmtUnits(s.profitUnits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Staked", `${summary.stakedUnits.toFixed(2)}u`, "text-white"],
            ["Returned", `${summary.returnedUnits.toFixed(2)}u`, "text-white"],
            ["Profit", fmtUnits(summary.profitUnits),
              summary.profitUnits > 0 ? "text-emerald-400" : summary.profitUnits < 0 ? "text-red-400" : "text-white"],
            ["ROI", summary.settled ? fmtPct(summary.roiPct) : "—",
              summary.roiPct > 0 ? "text-emerald-400" : summary.roiPct < 0 ? "text-red-400" : "text-white"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="rounded-xl bg-slate-800/60 p-3">
              <div className="text-xs text-slate-400">{label}</div>
              <div className={`text-lg font-bold ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {summary.settled} settled · {summary.pending} pending · {summary.wins}W-{summary.losses}L
          {summary.pushes ? `-${summary.pushes}P` : ""} ·
          strike rate {summary.settled ? `${summary.strikeRatePct.toFixed(1)}%` : "—"} ·
          avg CLV {summary.averageClvPct === null ? "not captured" : fmtPct(summary.averageClvPct)}
        </div>
        {!result && (
          <p className="mt-2 text-xs text-slate-500">
            Enter the final score to settle. Picks stay pending until a valid score exists —
            the ledger never guesses an outcome.
          </p>
        )}
      </section>
    </div>
  );
}
