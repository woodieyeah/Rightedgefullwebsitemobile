/**
 * Rebuild the multis that contradict their swapped core play.
 *
 * After the core-play swap, three fixtures advertised a multi backing the
 * favourite's handicap while the core play backed the underdog's. That tells a
 * subscriber to back both sides of the same line, which is incoherent and
 * would be obvious to anyone reading the card.
 *
 * The replacement shape pairs the NEW core selection with a try scorer. Note
 * the book refuses to combine an underdog handicap with a try-scorer leg on
 * these fixtures (it answers with its $101 maximum-payout sentinel rather
 * than an error), so where the core play is now the underdog the multi falls
 * back to two try scorers from the favourite — which does not contradict an
 * underdog handicap, since the favourite can score tries and still fail to
 * cover.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA_BB = "rightedge.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const SGM_SENTINEL = 101;
const MIN_PRICE = 2.2;
const MAX_PRICE = 9;

interface Job { matchKey: string; label: string; event: number; fav: string; coreTeam: string; corePoint: number }

const JOBS: Job[] = [
  { matchKey: "lebanon__tonga", label: "Tonga v Lebanon", event: 2311016, fav: "Tonga", coreTeam: "Lebanon", corePoint: 44.5 },
  { matchKey: "england__france", label: "England v France", event: 2311019, fav: "England", coreTeam: "France", corePoint: 57.5 },
  { matchKey: "cookislands__newzealand", label: "NZ v Cook Islands", event: 2311425, fav: "New Zealand", coreTeam: "Cook Islands", corePoint: 54.5 },
];

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing credentials."); process.exit(1); }

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

async function getJson(url: string, ua: string, attempts = 4): Promise<any> {
  let last: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(String((last as Error)?.message));
}

async function priceSgm(event: number, legs: any[]): Promise<number | null> {
  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      "User-Agent": UA_BB, Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: event, Markets: legs }),
  });
  const d = await res.json().catch(() => null);
  if (!d || d.ErrorNo !== 0 || !d.Price) return null;
  const p = Number(d.Price);
  if (p === SGM_SENTINEL || p < MIN_PRICE || p > MAX_PRICE) return null;
  return p;
}

const tryLeg = (o: any) => ({
  EventId: o.EventId, OutcomeId: o.OutcomeId, MarketType: "TSCORER",
  FixedWin: Number(o.Price), FixedMarketId: 0,
  MarketTypeDesc: "Anytime Tryscorer", GroupByHeader: "Anytime Tryscorer",
  Points: 0, BetDetailTypeCode: "TS", OutcomeName: o.OutcomeName,
});

console.log(`Rebuilding ${JOBS.length} multi(s)${DRY_RUN ? " (DRY RUN)" : ""}\n`);

let done = 0;
for (const job of JOBS) {
  console.log(`=== ${job.label} ===`);
  console.log(`  core play is now ${job.coreTeam} +${job.corePoint}`);

  const fixture = (await supabase(`fixtures?match_key=eq.${job.matchKey}&select=id`))?.[0];
  const sgm = (await supabase(`picks?fixture_id=eq.${fixture.id}&market=eq.sgm&result_status=eq.pending&select=id,selection,entry_odds`))?.[0];
  if (!sgm) { console.log("  no pending multi — skipped\n"); continue; }
  console.log(`  currently: ${sgm.selection} @ $${sgm.entry_odds}  (contradicts the core play)`);

  const g20 = walk(await getJson(`https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=${job.event}&GroupTypeCode=G20&format=json`, UA_BB));

  // Positions come from the headshot import, which already carries them for
  // all 230 squad members — including the Interchange-vs-Reserve distinction.
  const squad: Array<{ display_name: string; position: string }> = await supabase(
    "player_headshots?select=display_name,position&competition=eq.rlwc",
  );
  const positionOf = new Map(squad.map((p) => [norm(p.display_name), p.position ?? ""]));

  const candidates = g20
    .filter((o) => /^Anytime Tryscorer/i.test(o.EventName))
    .map((o) => ({ ...o, pos: positionOf.get(norm(o.OutcomeName)) ?? "" }))
    // A Reserve is not in the matchday 17, so the leg would void rather than
    // win or lose. Publishing one would be a leg that cannot land.
    .filter((o) => o.pos.trim().toLowerCase() !== "reserve")
    // Two short-priced wingers is the shape that went 1 from 6 in Round 1 and
    // pays almost nothing for needing two things. Require a leg that pays.
    .filter((o) => Number(o.Price) >= 1.8)
    .sort((a, b) => Number(a.Price) - Number(b.Price));

  if (candidates.length < 2) { console.log("  not enough priced try-scorer quotes — skipped\n"); continue; }

  // Prefer a forward or spine player over another outside back: Round 1's
  // only winning multi used a forward, and every losing one stacked wingers.
  const preferred = candidates.filter((s) => /prop|row|lock|hooker|five-eighth|halfback|fullback/i.test(s.pos));
  const pool = [...preferred, ...candidates.filter((s) => !preferred.includes(s))];

  let chosen: { price: number; a: any; b: any } | null = null;
  outer: for (let i = 0; i < Math.min(pool.length, 5); i++) {
    for (let j = i + 1; j < Math.min(pool.length, 6); j++) {
      const price = await priceSgm(job.event, [tryLeg(pool[i]), tryLeg(pool[j])]);
      if (price === null) continue;
      chosen = { price, a: pool[i], b: pool[j] };
      break outer;
    }
  }

  if (!chosen) { console.log("  the book would not price any compatible multi — skipped\n"); continue; }

  const selection = `${chosen.a.OutcomeName} + ${chosen.b.OutcomeName} anytime try`;
  const product = Number(chosen.a.Price) * Number(chosen.b.Price);
  console.log(
    `  REPLACE -> ${selection} @ $${chosen.price.toFixed(2)}  ` +
    `(legs $${chosen.a.Price} / $${chosen.b.Price}, product $${product.toFixed(2)})`,
  );

  if (DRY_RUN) { console.log("  (dry run)\n"); continue; }

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

  // Replace the legs so settlement checks the right two players.
  await supabase(`pick_legs?pick_id=eq.${sgm.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabase("pick_legs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { pick_id: sgm.id, leg_index: 0, market: "anytime_try", selection: chosen.a.OutcomeName, point: null, leg_odds: Number(chosen.a.Price) },
      { pick_id: sgm.id, leg_index: 1, market: "anytime_try", selection: chosen.b.OutcomeName, point: null, leg_odds: Number(chosen.b.Price) },
    ]),
  });
  done++;
  console.log("  written (legs replaced)\n");
}

console.log(DRY_RUN ? "DRY RUN complete." : `Done — ${done} multi(s) rebuilt.`);
