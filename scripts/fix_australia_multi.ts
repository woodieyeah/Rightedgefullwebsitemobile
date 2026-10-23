/**
 * Realign the Australia v Fiji multi with its swapped core play.
 *
 * The core play moved from Australia -36.5 to -44.5, but the multi's line leg
 * still reads -36.5 and its price ($1.80) was quoted for the old line. Left
 * alone the card shows a core play on one line and a multi on another, and
 * settlement would grade the multi against a line we no longer advertise.
 *
 * Both legs are re-priced at the book against the CURRENT core line.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const EVENT = 2311433;
const MATCH_KEY = "australia__fiji";
const CORE_TEAM = "Australia";
const CORE_POINT = -44.5;
const SENTINEL = 101;

const norm = (x: string) =>
  String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = await res.text();
  return t.trim() ? JSON.parse(t) : null;
}

const walk = (n: any, ev = "", id = 0, out: any[] = []): any[] => {
  if (!n || typeof n !== "object") return out;
  const name = n.EventName ?? ev;
  const eid = n.EventId ?? id;
  if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name, EventId: eid });
  for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name, eid, out);
  return out;
};

const bb = async (code: string) => {
  const r = await fetch(`https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=${EVENT}&GroupTypeCode=${code}&format=json`, {
    headers: { "User-Agent": "rightedge.com.au", Accept: "application/json" },
  });
  return walk(await r.json());
};

async function priceSgm(legs: any[]): Promise<number | null> {
  const res = await fetch("https://web20-api.bluebet.com.au/SameGameMultiPrice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      "User-Agent": "rightedge.com.au", Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: EVENT, Markets: legs }),
  });
  const d = await res.json().catch(() => null);
  if (!d || d.ErrorNo !== 0 || !d.Price) return null;
  const p = Number(d.Price);
  return p === SENTINEL ? null : p;
}

const fixture = (await supabase(`fixtures?match_key=eq.${MATCH_KEY}&select=id`))[0];
const sgm = (await supabase(`picks?fixture_id=eq.${fixture.id}&market=eq.sgm&result_status=eq.pending&select=id,selection,entry_odds`))[0];
console.log(`currently: ${sgm.selection} @ $${sgm.entry_odds}`);
console.log(`core play is now ${CORE_TEAM} ${CORE_POINT}\n`);

const g18 = await bb("G18");
const g20 = await bb("G20");

const line = g18.find(
  (o) => /^Match Result/i.test(o.EventName) && norm(o.OutcomeName) === norm(CORE_TEAM) && Number(o.Points) === CORE_POINT,
);
if (!line) { console.error(`the ${CORE_TEAM} ${CORE_POINT} line is not quoted — aborting`); process.exit(1); }

const squad: Array<{ display_name: string; position: string }> =
  await supabase("player_headshots?select=display_name,position&competition=eq.rlwc");
const positionOf = new Map(squad.map((p) => [norm(p.display_name), p.position ?? ""]));

const scorers = g20
  .filter((o) => /^Anytime Tryscorer/i.test(o.EventName) && norm(o.PlayerTeamName ?? "") === norm(CORE_TEAM))
  .map((o) => ({ ...o, pos: positionOf.get(norm(o.OutcomeName)) ?? "" }))
  .filter((o) => o.pos.trim().toLowerCase() !== "reserve")
  .sort((a, b) => Number(a.Price) - Number(b.Price));

// Prefer a forward: Round 1's only winning multi used one.
const forwards = scorers.filter((s) => /prop|row|lock|hooker/i.test(s.pos));
const pool = [...forwards, ...scorers.filter((s) => !forwards.includes(s))];

const lineLeg = {
  EventId: line.EventId, OutcomeId: line.OutcomeId, MarketType: "WIN", FixedWin: Number(line.Price),
  FixedMarketId: 0, MarketTypeDesc: "Match Result", GroupByHeader: "Match Result",
  Points: CORE_POINT, BetDetailTypeCode: "W", OutcomeName: `${CORE_TEAM} ${CORE_POINT}`,
};

let chosen: { price: number; s: any } | null = null;
for (const s of pool.slice(0, 6)) {
  const price = await priceSgm([
    lineLeg,
    {
      EventId: s.EventId, OutcomeId: s.OutcomeId, MarketType: "TSCORER", FixedWin: Number(s.Price),
      FixedMarketId: 0, MarketTypeDesc: "Anytime Tryscorer", GroupByHeader: "Anytime Tryscorer",
      Points: 0, BetDetailTypeCode: "TS", OutcomeName: s.OutcomeName,
    },
  ]);
  if (price === null || price < 2.2) continue;
  chosen = { price, s };
  break;
}

if (!chosen) {
  console.error("no acceptable multi could be priced against the new line — leaving the existing pick in place");
  process.exit(1);
}

const selection = `${CORE_TEAM} ${CORE_POINT} + ${chosen.s.OutcomeName} anytime try`;
const product = Number(line.Price) * Number(chosen.s.Price);
const ratio = chosen.price / product;
console.log(`REPLACE -> ${selection} @ $${chosen.price.toFixed(2)}`);
console.log(`  legs $${line.Price} / $${chosen.s.Price}  product $${product.toFixed(2)}  ratio ${ratio.toFixed(2)}  (${chosen.s.pos})`);

if (ratio < 0.4 || ratio > 1.6) {
  console.error("price is implausible against its legs — aborting rather than publishing it");
  process.exit(1);
}

if (DRY_RUN) { console.log("\n(dry run: nothing written)"); process.exit(0); }

await supabase(`picks?id=eq.${sgm.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    selection,
    entry_odds: chosen.price,
    entry_bookmaker: "betr",
    entry_captured_at: new Date().toISOString(),
    market_probability: Number((1 / chosen.price).toFixed(4)),
    model_probability: null,
  }),
});
await supabase(`pick_legs?pick_id=eq.${sgm.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
await supabase("pick_legs", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify([
    { pick_id: sgm.id, leg_index: 0, market: "line", selection: CORE_TEAM, point: CORE_POINT, leg_odds: Number(line.Price) },
    { pick_id: sgm.id, leg_index: 1, market: "anytime_try", selection: chosen.s.OutcomeName, point: null, leg_odds: Number(chosen.s.Price) },
  ]),
});
console.log("\nwritten (legs replaced)");
