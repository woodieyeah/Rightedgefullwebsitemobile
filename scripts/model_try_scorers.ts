/**
 * Try-scorer model for the RLWC opener.
 *
 * TWO INDEPENDENT ESTIMATES, COMPARED
 *
 * 1. Market: TAB's "To Score a Try" market de-vigged. Forty players, so the
 *    overround is large and must be removed before the prices mean anything.
 *
 * 2. Positional: every player's expected try rate from their position, scaled
 *    to the tries this match is projected to produce. Positional base rates are
 *    measured from 2,139 real rows of the 2026 NRL try-scorer sheet (Wing 45.4%,
 *    Fullback 36.3%, Centre 33.9%, ... Prop 9.1%), and positions are joined to
 *    RLWC players by name, since every player in both squads played NRL 2026.
 *
 * The positional estimate is independent of tonight's prices, so where the two
 * disagree there is a defensible reason to prefer a player the market has not
 * made favourite.
 *
 * This does NOT claim edge. Bookmaker margin on a 40-runner market is large
 * enough that almost nothing shows positive expected value. What it claims is a
 * ranking: which players are most likely to score, given position and the
 * projected scoreline, independent of their price.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";

/**
 * Fixture to model. Defaults to tonight's match; override with --match.
 *   npx tsx scripts/model_try_scorers.ts --match "Samoa v France"
 */
const matchArg = process.argv.indexOf("--match");
const MATCH_NAME = matchArg >= 0 ? process.argv[matchArg + 1] : "Samoa v France";

const TAB_MATCH =
  "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League" +
  `/competitions/World%20Cup/matches/${encodeURIComponent(MATCH_NAME)}?jurisdiction=QLD`;

const SHEET_TRY_SCORERS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTKzRm_dhMcH-2sf_Yf3O6hqQE0_t13TeanTOJF0wwHSTv8Lb8gmR9zlJ1TceW106fM3e6-LHBVCjF8/pub?single=true&output=csv&gid=222068410";

/** Measured from the 2026 NRL try-scorer sheet; see header. */
const POSITION_BASE_RATE: Record<string, number> = {
  wing: 45.4,
  fullback: 36.3,
  centre: 33.9,
  back: 33.5,
  "back row": 30.9,
  "five-eighth": 30.1,
  halfback: 26.2,
  "second row": 21.6,
  hooker: 16.2,
  interchange: 10.0,
  lock: 9.3,
  prop: 9.1,
};

interface Candidate {
  player: string;
  /** Short code taken from the feed's "(Sam)" / "(Fra)" suffix. */
  team: string;
  price: number;
  position: string | null;
  baseRate: number | null;
  marketProb: number;
  modelProb: number | null;
}

function normaliseName(name: string): string {
  return name
    .replace(/\([A-Za-z]{2,4}\)/g, "")
    .replace(/[^a-z\s-]/gi, "")
    .trim()
    .toLowerCase();
}

/** "C N-Klokstad" style abbreviations: match on surname when the full name fails. */
function surname(name: string): string {
  const parts = normaliseName(name).split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

async function loadPositions(): Promise<Map<string, string>> {
  const csv = await (await fetch(SHEET_TRY_SCORERS)).text();
  const lines = csv.split("\n").filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim());
  const playerIdx = header.indexOf("Player");
  const positionIdx = header.indexOf("Position");

  const byName = new Map<string, string>();
  const bySurname = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const player = (cells[playerIdx] ?? "").trim();
    const position = (cells[positionIdx] ?? "").trim();
    if (!player || !position) continue;
    byName.set(normaliseName(player), position);
    const s = surname(player);
    // Only keep an unambiguous surname mapping.
    if (s.length > 3) {
      if (bySurname.has(s) && bySurname.get(s) !== position) bySurname.set(s, "__AMBIGUOUS__");
      else bySurname.set(s, position);
    }
  }

  // Fold surnames in as a fallback without overwriting exact matches.
  for (const [s, position] of bySurname) {
    if (position === "__AMBIGUOUS__") continue;
    if (!byName.has(s)) byName.set(`surname:${s}`, position);
  }
  return byName;
}

function lookupPosition(positions: Map<string, string>, player: string): string | null {
  const exact = positions.get(normaliseName(player));
  if (exact) return exact;
  return positions.get(`surname:${surname(player)}`) ?? null;
}

async function main() {
  const match = await (await fetch(TAB_MATCH, {
    headers: { Accept: "application/json", "User-Agent": UA },
  })).json();

  const market = (match.markets ?? []).find((m: any) => m.betOption === "To Score a Try");
  if (!market) throw new Error("To Score a Try market not found");

  const positions = await loadPositions();

  // ---- 1. De-vig the market ------------------------------------------------
  // Team codes come from the feed's own "(Sam)" / "(Fra)" suffix rather than
  // being hardcoded, so this runs on any fixture.
  const raw = (market.propositions ?? [])
    .filter((p: any) => Number(p.returnWin) > 0)
    .map((p: any) => {
      const code = String(p.name).match(/\(([A-Za-z]{2,4})\)/)?.[1] ?? "?";
      return {
        player: String(p.name),
        team: code,
        price: Number(p.returnWin),
      };
    });

  const impliedSum = raw.reduce((s: number, r: any) => s + 1 / r.price, 0);
  console.log(`${MATCH_NAME} — To Score a Try: ${raw.length} runners, book ${(impliedSum * 100).toFixed(1)}%`);

  // Anytime-tryscorer markets are not mutually exclusive, so the book does not
  // normalise to 1. Scale so the probabilities sum to the expected number of
  // try SCORERS implied by the projected tries, not to 100%.
  //
  // Projected tries are DERIVED from this fixture's own line and total rather
  // than hardcoded: solving home+away=total and home-away=margin gives each
  // side's projected points, and dividing by points-per-try gives tries.
  // A hardcoded pair would be silently wrong on every other match.
  const lineMarket = (match.markets ?? []).find((m: any) => m.betOption === "Line");
  const totalMarket = (match.markets ?? []).find(
    (m: any) => m.betOption === "Total Points Over/Under",
  );
  if (!lineMarket || !totalMarket) {
    throw new Error("line or total market unavailable — cannot project tries");
  }

  const teams = [...new Set(raw.map((r: any) => r.team))] as string[];
  const homeCode = teams[0];

  // TAB's line propositions carry the full team name ("Samoa -47.5") while
  // try-scorer props use a short code ("(Sam)"), so match on the code being a
  // prefix of the line's team name. The total's number appears only in its
  // name ("Over 58.5"), not as its own field.
  const lineProps = lineMarket.propositions ?? [];
  const homeProp = lineProps.find((p: any) =>
    String(p.name).toLowerCase().startsWith(homeCode.toLowerCase()),
  );
  const totalProp = (totalMarket.propositions ?? []).find((p: any) =>
    /^over/i.test(String(p.name)),
  );

  const totalPoints = Number(String(totalProp?.name ?? "").match(/[\d.]+/)?.[0]);
  const homeHandicap = Number(
    homeProp?.line ?? String(homeProp?.name ?? "").match(/[-+][\d.]+/)?.[0],
  );
  if (!Number.isFinite(totalPoints) || !Number.isFinite(homeHandicap)) {
    throw new Error("could not read the line or total — refusing to guess");
  }

  // The handicap is signed from the team's own perspective, so the margin is
  // its negation. Look it up by name, never by array position.
  const homeMargin = -homeHandicap;
  const POINTS_PER_TRY = 5.4;
  const projectedPoints: Record<string, number> = {
    [homeCode]: (totalPoints + homeMargin) / 2,
  };
  for (const t of teams) {
    if (t !== homeCode) projectedPoints[t] = (totalPoints - homeMargin) / 2;
  }

  const projectedTries: Record<string, number> = {};
  for (const t of teams) {
    projectedTries[t] = Math.max(projectedPoints[t], 0) / POINTS_PER_TRY;
  }

  console.log(
    `Line ${homeCode} ${homeHandicap > 0 ? "+" : ""}${homeHandicap}, total ${totalPoints} -> ` +
      teams.map((t) => `${t} ${projectedPoints[t].toFixed(1)}pts / ${projectedTries[t].toFixed(1)} tries`).join(", "),
  );
  console.log();

  const candidates: Candidate[] = [];

  for (const team of teams) {
    const squad = raw.filter((r: any) => r.team === team);
    if (!squad.length) continue;
    const teamImplied = squad.reduce((s: number, r: any) => s + 1 / r.price, 0);
    // Distinct scorers is slightly below total tries because of doubles.
    const expectedScorers = projectedTries[team] * 0.88;
    const scale = teamImplied > 0 ? expectedScorers / teamImplied : 0;

    // Positional model: base rate scaled so the squad's total matches the same
    // expected number of scorers. This is what makes it independent of price.
    const withPos = squad.map((r: any) => {
      const position = lookupPosition(positions, r.player);
      const baseRate = position ? POSITION_BASE_RATE[position.toLowerCase()] ?? null : null;
      return { ...r, position, baseRate };
    });
    const baseSum = withPos.reduce((s: number, r: any) => s + (r.baseRate ?? 0), 0);
    const posScale = baseSum > 0 ? expectedScorers / (baseSum / 100) : 0;

    for (const r of withPos) {
      candidates.push({
        ...r,
        marketProb: (1 / r.price) * scale,
        modelProb: r.baseRate !== null ? (r.baseRate / 100) * posScale : null,
      });
    }
  }

  // ---- 2. Report -----------------------------------------------------------
  const matched = candidates.filter((c) => c.modelProb !== null);
  console.log(`Position resolved for ${matched.length}/${candidates.length} players\n`);

  console.log("player                        team  price   market%  model%   diff   position");
  console.log("-".repeat(86));
  for (const c of [...candidates].sort((a, b) => (b.modelProb ?? -1) - (a.modelProb ?? -1))) {
    const model = c.modelProb === null ? "   -  " : `${(c.modelProb * 100).toFixed(1)}%`.padStart(6);
    const diff =
      c.modelProb === null ? "   -  " : `${((c.modelProb - c.marketProb) * 100 >= 0 ? "+" : "")}${((c.modelProb - c.marketProb) * 100).toFixed(1)}`.padStart(6);
    console.log(
      `${c.player.replace(/\s*\([A-Za-z]{2,4}\)/, "").padEnd(28)}  ${c.team.padEnd(4)}  $${c.price.toFixed(2).padStart(5)}  ` +
        `${(c.marketProb * 100).toFixed(1).padStart(6)}%  ${model}  ${diff}   ${c.position ?? "unknown"}`,
    );
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
