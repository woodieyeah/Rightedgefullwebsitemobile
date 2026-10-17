/**
 * Publish the England v Tonga core play: Tonga head to head.
 *
 * Prices are read live at write time. The model figure comes from the
 * winning-margin ladder, which is an independent market — "Tonga 1+" is the
 * outright win, so it rates the head to head without circularity.
 *
 * market_probability stores the DE-VIGGED two-way fair, matching the opener's
 * Australia h2h row (58.1% stored against a raw implied 60.6%). Storing the
 * raw implied figure instead would overstate the market and understate us.
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const TAB = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/England%20v%20Tonga?jurisdiction=NSW";
const BB = "https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=2292886&GroupTypeCode=";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";
const MATCH_KEY = "england__tonga";
const MODEL_VERSION = "rlwc-consensus-v1";
const AGREEMENT_GATE_PCT = 5;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

const walk = (n: any, ev = "", out: any[] = []): any[] => {
  if (!n || typeof n !== "object") return out;
  const name = n.EventName ?? ev;
  if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name });
  for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, out);
  return out;
};

async function main() {
  console.log(`England v Tonga — core play${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(
    `fixtures?match_key=eq.${MATCH_KEY}&select=id,home_team,away_team,kickoff_at`,
  ))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY}`);

  const existing = await supabase(
    `picks?fixture_id=eq.${fixture.id}&market=eq.h2h&select=id,selection,result_status`,
  );
  if (existing?.length) {
    throw new Error(
      `a head-to-head pick already exists for this fixture (${existing[0].selection}); refusing to duplicate`,
    );
  }

  // --- live prices -------------------------------------------------------
  const tab = await (await fetch(TAB, { headers: { "User-Agent": UA_TAB, Accept: "application/json" } })).json();
  const h2h = (tab.markets ?? []).find((m: any) => /^Head To Head$/i.test(m.betOption ?? m.name ?? ""));
  const tonga = h2h?.propositions?.find((p: any) => p.name === "Tonga");
  const england = h2h?.propositions?.find((p: any) => p.name === "England");
  if (!tonga?.returnWin || !england?.returnWin) throw new Error("TAB head to head unavailable");

  const tabTonga = Number(tonga.returnWin);
  const tabEngland = Number(england.returnWin);

  const bbRaw = await (await fetch(`${BB}G18&format=json`, { headers: { "User-Agent": UA_BB, Accept: "application/json" } })).json();
  const mr = walk(bbRaw).filter((o) => /^Match Result/i.test(o.EventName) && Number(o.Points) === 0);
  const bbTonga = Number(mr.find((o) => o.OutcomeName === "Tonga")?.Price);
  const bbEngland = Number(mr.find((o) => o.OutcomeName === "England")?.Price);
  if (!bbTonga || !bbEngland) throw new Error("BlueBet head to head unavailable");

  // --- book agreement gate ----------------------------------------------
  const gapTonga = (Math.abs(tabTonga - bbTonga) / tabTonga) * 100;
  const gapEngland = (Math.abs(tabEngland - bbEngland) / tabEngland) * 100;
  const worst = Math.max(gapTonga, gapEngland);
  console.log(`  TAB      Tonga $${tabTonga} / England $${tabEngland}`);
  console.log(`  BlueBet  Tonga $${bbTonga} / England $${bbEngland}`);
  console.log(`  agreement gap ${worst.toFixed(2)}%  ->  ${worst <= AGREEMENT_GATE_PCT ? "AGREE" : "DISAGREE"}`);
  if (worst > AGREEMENT_GATE_PCT) {
    throw new Error("books disagree beyond the gate; refusing to publish");
  }

  // Best available price across the two books.
  const price = Math.max(tabTonga, bbTonga);
  const bookmaker = tabTonga >= bbTonga ? "TAB" : "BlueBet";

  // De-vigged two-way fair, consistent with the opener's h2h row.
  const over = 1 / tabTonga + 1 / tabEngland;
  const fair = 1 / tabTonga / over;

  // --- independent model rating ------------------------------------------
  const g19 = walk(await (await fetch(`${BB}G19&format=json`, { headers: { "User-Agent": UA_BB, Accept: "application/json" } })).json());
  const ladder = g19
    .filter((o) => /^Tonga\s+\d+\+$/.test(o.OutcomeName))
    .map((o) => ({ name: o.OutcomeName, price: Number(o.Price) }));
  const bands = parseMarginBands(ladder);
  // Winning by 1+ is the outright win, so the ladder rates the head to head.
  const model = bands.length >= 2 ? coverProbabilityFromBands(bands, 1) : null;
  if (model === null) throw new Error("no ladder rating for Tonga; refusing to publish");

  console.log(`\n  CORE  Tonga @ $${price} (${bookmaker})`);
  console.log(`        model ${(model * 100).toFixed(1)}%   market fair ${(fair * 100).toFixed(1)}%   edge ${((model - fair) * 100).toFixed(1)}%`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }

  const now = new Date().toISOString();
  const written = await supabase("picks", {
    method: "POST",
    body: JSON.stringify([{
      fixture_id: fixture.id,
      model_version: MODEL_VERSION,
      market: "h2h",
      // Bare team name; a head to head carries no handicap.
      selection: "Tonga",
      point: null,
      entry_odds: price,
      entry_bookmaker: bookmaker,
      entry_captured_at: now,
      model_probability: Number(model.toFixed(4)),
      market_probability: Number(fair.toFixed(4)),
      stake_units: 1,
      result_status: "pending",
      published: true,
      published_at: now,
    }]),
  });

  console.log(`\nWrote ${written.length} pick: ${written[0].selection} @ $${written[0].entry_odds}`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
