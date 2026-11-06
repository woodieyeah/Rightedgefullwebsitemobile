/**
 * Swap the Tonga multi's try-scorer leg from Watene-Zelezniak to Robert Toia.
 *
 * The multi is re-priced at the book's own endpoint rather than having the
 * player's name edited in place: a correlated price is not the leg product,
 * so changing a leg without re-pricing would publish a number no bookmaker
 * is offering. Round 2 shipped a multi whose legs had drifted from its own
 * price and it had to be rebuilt.
 *
 * Fails closed. Nothing is written unless:
 *   - the new scorer is quoted in the ANYTIME market and listed under Tonga,
 *   - the anchor handicap is still quoted on the same side as the core play,
 *   - the endpoint returns a real price (not ErrorNo, not the $101 sentinel),
 *   - that price sits within 0.4x-1.6x the leg product.
 *
 * Usage: npx tsx scripts/swap_tonga_multi_leg.ts [--dry-run]
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const BB_BASE = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_BB = "rightedge.com.au";

const MATCH_KEY = "newzealand__tonga";
const LABEL = "New Zealand v Tonga";
const EVENT = 2325881;
const ANCHOR_TEAM = "Tonga";
const NEW_SCORER = "Robert Toia";
const OLD_SCORER = "Dallin Watene-Zelezniak";

const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const norm = (x: string) =>
  String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

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

async function getJson(url: string, attempts = 4): Promise<any> {
  let last: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA_BB },
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(String((last as Error)?.message ?? last));
}

interface Out {
  name: string; price: number; points: number;
  betType: string; eventName: string;
  eventId: number; outcomeId: number; team: string;
}

function collect(node: any, out: Out[] = [], ev = ""): Out[] {
  if (!node || typeof node !== "object") return out;
  const e = node.EventName ?? ev;
  const price = Number(node.Price);
  const name = node.OutcomeName;
  if (name && Number.isFinite(price) && price > 1) {
    out.push({
      name: String(name), price,
      points: Number(node.Points ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      eventName: String(e ?? ""),
      eventId: Number(node.EventId ?? 0),
      outcomeId: Number(node.OutcomeId ?? 0),
      team: String(node.PlayerTeamName ?? ""),
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, out, String(e ?? ""));
  return out;
}

function sgmLeg(o: Out, kind: "line" | "try", point: number) {
  return kind === "line"
    ? { EventId: o.eventId, OutcomeId: o.outcomeId, MarketType: "WIN", FixedWin: o.price, FixedMarketId: 0,
        MarketTypeDesc: `Match Result (${LABEL})`, GroupByHeader: "Match Result",
        Points: point, BetDetailTypeCode: "W", OutcomeName: `${o.name} ${point}` }
    : { EventId: o.eventId, OutcomeId: o.outcomeId, MarketType: "TSCORER", FixedWin: o.price, FixedMarketId: 0,
        MarketTypeDesc: `Anytime Tryscorer (${LABEL})`, GroupByHeader: "Anytime Tryscorer",
        Points: 0, BetDetailTypeCode: "TS", OutcomeName: o.name };
}

async function main() {
  console.log(`Swapping ${OLD_SCORER} -> ${NEW_SCORER} in the ${LABEL} multi${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(`fixtures?match_key=eq.${MATCH_KEY}&select=id`))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY}`);

  const picks = await supabase(
    `picks?fixture_id=eq.${fixture.id}&select=id,market,selection,entry_odds,result_status`,
  );
  const sgm = (picks ?? []).find((p: any) => p.market === "sgm");
  if (!sgm) throw new Error("no multi published for this fixture");
  if (sgm.result_status !== "pending") {
    throw new Error(`multi is already ${sgm.result_status} — refusing to rewrite a settled pick`);
  }
  const core = (picks ?? []).find((p: any) => p.market === "line");
  console.log(`  current multi: ${sgm.selection}  $${sgm.entry_odds}`);
  console.log(`  core play:     ${core?.selection} ${core?.point ?? ""}`);

  // ---- live markets ----------------------------------------------------
  const all: Out[] = [];
  for (const code of ["G18", "G20"]) {
    try { all.push(...collect(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${EVENT}&GroupTypeCode=${code}&format=json`))); } catch { /* group may be absent */ }
  }
  if (!all.length) throw new Error("no BlueBet outcomes");

  const anchor = all.find((o) => o.betType === "HC" && norm(o.name) === norm(ANCHOR_TEAM));
  if (!anchor) throw new Error(`no handicap anchor for ${ANCHOR_TEAM}`);
  if (anchor.points <= 0) {
    throw new Error(`anchor ${anchor.name} ${anchor.points} is no longer the underdog side — would contradict the core play`);
  }

  const scorer = all.find((o) =>
    /^anytime tryscorer$/i.test(o.eventName) && norm(o.name) === norm(NEW_SCORER));
  if (!scorer) throw new Error(`${NEW_SCORER} is not quoted in the anytime market`);
  if (norm(scorer.team) !== norm(ANCHOR_TEAM)) {
    throw new Error(`${NEW_SCORER} is listed under ${scorer.team || "no team"}, not ${ANCHOR_TEAM}`);
  }
  console.log(`  anchor: ${anchor.name} +${anchor.points} $${anchor.price}`);
  console.log(`  scorer: ${scorer.name} $${scorer.price} (${scorer.team})`);

  // ---- re-price the combination ----------------------------------------
  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA_BB,
      Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({
      MasterEventID: EVENT,
      Markets: [sgmLeg(anchor, "line", anchor.points), sgmLeg(scorer, "try", 0)],
    }),
  });
  const d = await res.json().catch(() => null);
  if (!d) throw new Error("no response from the SGM endpoint");
  if (d.ErrorNo !== 0) throw new Error(`SGM endpoint refused: ErrorNo ${d.ErrorNo} ${String(d.Message ?? "").slice(0, 80)}`);
  const price = Number(d.Price);
  if (!Number.isFinite(price) || !price) throw new Error("SGM endpoint returned no price");
  if (price === SGM_SENTINEL) throw new Error("SGM returned the $101 refusal sentinel, not a price");
  if (price < MIN_SGM_PRICE) throw new Error(`SGM price $${price} is too short to publish`);

  const product = anchor.price * scorer.price;
  const ratio = price / product;
  if (ratio < 0.4 || ratio > 1.6) {
    throw new Error(`SGM price $${price.toFixed(2)} is ${ratio.toFixed(2)}x the leg product — rejected`);
  }

  const selection = `${ANCHOR_TEAM} +${anchor.points} + ${scorer.name} anytime try`;
  console.log(`\n  NEW multi: ${selection}  $${price.toFixed(2)}  (product $${product.toFixed(2)}, ratio ${ratio.toFixed(2)})`);

  if (DRY_RUN) { console.log("\n  DRY RUN — nothing written."); return; }

  const now = new Date().toISOString();
  await supabase(`picks?id=eq.${sgm.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      selection,
      entry_odds: price,
      market_probability: Number((1 / price).toFixed(4)),
      entry_captured_at: now,
      published_at: now,
    }),
  });

  // Legs are replaced wholesale so a stale leg cannot survive the swap.
  await supabase(`pick_legs?pick_id=eq.${sgm.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabase("pick_legs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { pick_id: sgm.id, leg_index: 0, market: "line", selection: ANCHOR_TEAM, point: anchor.points, leg_odds: anchor.price },
      { pick_id: sgm.id, leg_index: 1, market: "anytime_try", selection: scorer.name, point: null, leg_odds: scorer.price },
    ]),
  });

  console.log("  updated the pick and replaced both legs.");
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
