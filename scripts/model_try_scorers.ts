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

const TAB_MATCH =
  "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/Australia%20v%20New%20Zealand?jurisdiction=QLD";

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
  team: "Aus" | "NZ";
  price: number;
  position: string | null;
  baseRate: number | null;
  marketProb: number;
  modelProb: number | null;
}

function normaliseName(name: string): string {
  return name
    .replace(/\((?:Aus|NZ)\)/gi, "")
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
  const raw = (market.propositions ?? [])
    .filter((p: any) => Number(p.returnWin) > 0)
    .map((p: any) => ({
      player: String(p.name),
      team: /\(NZ\)/i.test(String(p.name)) ? ("NZ" as const) : ("Aus" as const),
      price: Number(p.returnWin),
    }));

  const impliedSum = raw.reduce((s: number, r: any) => s + 1 / r.price, 0);
  console.log(`To Score a Try: ${raw.length} runners, book ${(impliedSum * 100).toFixed(1)}%`);

  // Anytime-tryscorer markets are not mutually exclusive, so the book does not
  // normalise to 1. Scale so the probabilities sum to the expected number of
  // try SCORERS implied by the projected tries, not to 100%.
  const projectedTries = { Aus: 3.7, NZ: 3.2 };
  console.log(`Projected tries: Australia ${projectedTries.Aus}, New Zealand ${projectedTries.NZ}`);
  console.log();

  const candidates: Candidate[] = [];

  for (const team of ["Aus", "NZ"] as const) {
    const squad = raw.filter((r: any) => r.team === team);
    const teamImplied = squad.reduce((s: number, r: any) => s + 1 / r.price, 0);
    // Distinct scorers is slightly below total tries because of doubles.
    const expectedScorers = projectedTries[team] * 0.88;
    const scale = expectedScorers / teamImplied;

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
      `${c.player.replace(/\s*\((?:Aus|NZ)\)/i, "").padEnd(28)}  ${c.team.padEnd(4)}  $${c.price.toFixed(2).padStart(5)}  ` +
        `${(c.marketProb * 100).toFixed(1).padStart(6)}%  ${model}  ${diff}   ${c.position ?? "unknown"}`,
    );
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
