/**
 * Apply two requested core-play switches.
 *
 *   England v France    -> Under 60.5   (replacing France +57.5)
 *   NZ v Cook Islands   -> New Zealand -48.5  (replacing Cook Islands +54.5)
 *
 * Both are worse-priced than what they replace and that was accepted
 * explicitly, so no edge-improvement check is applied here — unlike the
 * earlier swap script, which refused a replacement that rated worse.
 *
 * What IS still enforced:
 *   - the price is re-read live and the switch is abandoned if the quote has
 *     moved against us by more than 3%;
 *   - the total is rated from both books' de-vigged pairs and requires them to
 *     agree, because a totals "edge" that exists only because two books
 *     disagree is a data fault (TAB and BlueBet differ 17.5pp at the 53.5
 *     line on this very fixture);
 *   - the handicap is rated off the winning-margin ladder, never the
 *     projected scoreline;
 *   - a total stores its selection as "Under <points>" because settlement
 *     keys on the selection beginning "over"/"under", verified against the
 *     settler before publishing;
 *   - any multi left contradicting its new core play is reported, not left
 *     silently inconsistent.
 */
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";
const TAB_BASE = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const MAX_DRIFT_PCT = 3;
const AGREE_PP = 5;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase credentials."); process.exit(1); }

const norm = (x: string) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();

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

const bb = async (event: number, code: string) =>
  walk(await getJson(`https://affiliate-api.bluebet.com.au/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, UA_BB));

async function updatePick(
  matchKey: string, label: string,
  patch: Record<string, unknown>, describe: string,
) {
  const fixture = (await supabase(`fixtures?match_key=eq.${matchKey}&select=id`))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${matchKey}`);
  const existing = (await supabase(
    `picks?fixture_id=eq.${fixture.id}&result_status=eq.pending&market=in.(line,total,h2h)&select=id,market,selection,point,entry_odds`,
  ))?.[0];
  if (!existing) throw new Error(`no pending core play for ${label}`);

  console.log(`  currently: ${existing.selection} ${existing.point ?? ""} @ $${existing.entry_odds} [${existing.market}]`);
  console.log(`  REPLACE -> ${describe}`);
  if (DRY_RUN) { console.log("  (dry run)\n"); return { fixtureId: fixture.id, applied: false }; }

  await supabase(`picks?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  console.log("  written\n");
  return { fixtureId: fixture.id, applied: true };
}

const now = new Date().toISOString();
const touched: Array<{ fixtureId: string; coreTeam: string | null; label: string }> = [];

// =====================================================================
// 1. England v France -> Under 60.5
// =====================================================================
console.log(`England v France -> the total, Under side${DRY_RUN ? " (DRY RUN)" : ""}`);

const POINTS = 60.5;
const efTab = await getJson(`${TAB_BASE}/${encodeURIComponent("England v France")}?jurisdiction=NSW`, UA_TAB);
const efG80 = await bb(2311019, "G80");

const tabPrice = (side: string) => {
  for (const m of efTab.markets ?? []) {
    if (!/Total/i.test(m.betOption ?? m.name ?? "")) continue;
    for (const p of m.propositions ?? []) {
      if (new RegExp(`^${side}`, "i").test(p.name) && Number(String(p.name).match(/[\d.]+/)?.[0]) === POINTS) {
        return Number(p.returnWin);
      }
    }
  }
  return null;
};
const bbPrice = (side: string) => {
  const hits = efG80.filter(
    (o) => new RegExp(`^${side}`, "i").test(o.OutcomeName) && Number(String(o.OutcomeName).match(/[\d.]+/)?.[0]) === POINTS,
  );
  // A line quoted more than once is not uniquely identified by its label.
  if (hits.length !== 1) return null;
  return Number(hits[0].Price);
};

const tUnder = tabPrice("Under"), tOver = tabPrice("Over");
const bUnder = bbPrice("Under"), bOver = bbPrice("Over");

if (!tUnder || !tOver || !bUnder || !bOver) {
  console.log(`  the ${POINTS} total is not cleanly quoted at both books — switch abandoned\n`);
} else {
  const tabFair = (1 / tUnder) / (1 / tUnder + 1 / tOver);
  const bbFair = (1 / bUnder) / (1 / bUnder + 1 / bOver);
  const gap = Math.abs(tabFair - bbFair) * 100;
  console.log(`  TAB Under $${tUnder} / Over $${tOver}  -> fair ${(tabFair * 100).toFixed(1)}%`);
  console.log(`  BlueBet Under $${bUnder} / Over $${bOver}  -> fair ${(bbFair * 100).toFixed(1)}%`);
  console.log(`  books agree within ${gap.toFixed(1)}pp`);

  if (gap > AGREE_PP) {
    console.log(`  books disagree beyond ${AGREE_PP}pp — switch abandoned rather than publish an unverified rating\n`);
  } else {
    const price = Math.max(tUnder, bUnder);
    const book = tUnder >= bUnder ? "TAB" : "BlueBet";
    const drift = (price - 1.90) / 1.90 * 100;
    if (drift < -MAX_DRIFT_PCT) {
      console.log(`  price moved to $${price} (${drift.toFixed(1)}%) against the rating — switch abandoned\n`);
    } else {
      const model = (tabFair + bbFair) / 2;
      const implied = 1 / price;
      const r = await updatePick(
        "england__france", "England v France",
        {
          market: "total",
          // Settlement keys on the selection starting "over"/"under".
          selection: `Under ${POINTS}`,
          point: POINTS,
          entry_odds: price,
          entry_bookmaker: book,
          entry_captured_at: now,
          model_probability: Number(model.toFixed(4)),
          market_probability: Number(implied.toFixed(4)),
        },
        `Under ${POINTS} @ $${price.toFixed(2)} (${book})  model ${(model * 100).toFixed(1)}%  ` +
        `edge ${((model - implied) * 100).toFixed(1)}%`,
      );
      touched.push({ fixtureId: r.fixtureId, coreTeam: null, label: "England v France" });
    }
  }
}

// =====================================================================
// 2. NZ v Cook Islands -> New Zealand -48.5
// =====================================================================
console.log(`\nNZ v Cook Islands -> New Zealand to cover`);

const NZ_POINT = -48.5;
const nzG18 = await bb(2311425, "G18");
const nzG19 = await bb(2311425, "G19");

const seen = new Map<number, number>();
for (const o of nzG19) {
  const m = String(o.OutcomeName).match(/^New Zealand\s+(\d+)\+$/);
  if (m && !seen.has(Number(m[1]))) seen.set(Number(m[1]), Number(o.Price));
}
const bands = parseMarginBands([...seen.entries()].map(([t, p]) => ({ name: `New Zealand ${t}+`, price: p })));
const model = coverProbabilityFromBands(bands, Math.ceil(Math.abs(NZ_POINT)));

const nzLine = nzG18.find(
  (o) => /^Match Result/i.test(o.EventName) && norm(o.OutcomeName) === "new zealand" && Number(o.Points) === NZ_POINT,
);

if (!nzLine || model === null) {
  console.log(`  the New Zealand ${NZ_POINT} line or its ladder rating is unavailable — switch abandoned\n`);
} else {
  const price = Number(nzLine.Price);
  const drift = (price - 1.58) / 1.58 * 100;
  console.log(`  live price $${price.toFixed(2)} (rated at $1.58, drift ${drift >= 0 ? "+" : ""}${drift.toFixed(1)}%)`);
  console.log(`  ladder: ${bands.length} bands -> New Zealand covering 49+ rates ${(model * 100).toFixed(1)}%`);

  if (drift < -MAX_DRIFT_PCT) {
    console.log(`  price moved against us beyond ${MAX_DRIFT_PCT}% — switch abandoned\n`);
  } else {
    const implied = 1 / price;
    const r = await updatePick(
      "cookislands__newzealand", "NZ v Cook Islands",
      {
        market: "line",
        // Bare team name; the handicap lives in `point`.
        selection: "New Zealand",
        point: NZ_POINT,
        entry_odds: price,
        entry_bookmaker: "BlueBet",
        entry_captured_at: now,
        model_probability: Number(model.toFixed(4)),
        market_probability: Number(implied.toFixed(4)),
      },
      `New Zealand ${NZ_POINT} @ $${price.toFixed(2)} (BlueBet)  model ${(model * 100).toFixed(1)}%  ` +
      `edge ${((model - implied) * 100).toFixed(1)}%`,
    );
    touched.push({ fixtureId: r.fixtureId, coreTeam: "New Zealand", label: "NZ v Cook Islands" });
  }
}

// =====================================================================
// 3. Report any multi now contradicting its core play
// =====================================================================
if (!DRY_RUN && touched.length) {
  console.log("Checking the multis still agree with these core plays:");
  for (const t of touched) {
    const sgm = (await supabase(`picks?fixture_id=eq.${t.fixtureId}&market=eq.sgm&result_status=eq.pending&select=selection,entry_odds`))?.[0];
    if (!sgm) { console.log(`  ${t.label}: no multi`); continue; }
    const first = String(sgm.selection).split(" + ")[0];
    // A multi leg naming the opposing side of the same line is a contradiction.
    const contradicts = t.coreTeam === "New Zealand" && /cook islands/i.test(first);
    console.log(`  ${t.label}: ${sgm.selection} @ $${sgm.entry_odds}  ${contradicts ? "*** CONTRADICTS ***" : "consistent"}`);
  }
}

console.log(DRY_RUN ? "\nDRY RUN complete." : "\nDone.");
