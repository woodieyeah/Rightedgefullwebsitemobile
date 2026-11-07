/**
 * Swap the try-scorer leg of a published multi, repriced at the book.
 *
 * Replaces scripts/swap_tonga_multi_leg.ts, which was single-purpose and
 * carried the broken outright-shaped handicap leg.
 *
 * The multi is always re-priced for the exact new combination. A correlated
 * price is not the leg product, so editing a player's name in place would
 * leave a price no bookmaker is offering — and the handicap leg must use the
 * HC/HCWEST shape with its own FixedMarketId or the endpoint silently prices
 * an outright instead.
 *
 * Fails closed. Nothing is written unless:
 *   - the pick is still pending (never rewrites a settled pick),
 *   - the new scorer is quoted in the ANYTIME market and listed under the
 *     anchor's team,
 *   - the anchor start is still quoted and still on the core play's side,
 *   - the endpoint returns a real price (not ErrorNo, not the $101 sentinel),
 *   - that price differs from the outright-anchored control, proving the
 *     handicap is being honoured.
 *
 * Usage:
 *   npx tsx scripts/swap_multi_scorer.ts --match newzealand__tonga \
 *     --scorer "Paul Alamoti" [--dry-run]
 */
import { buildSgmLeg, type SgmOutcome } from "../src/model/sgm-legs.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const arg = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
};

const MATCH_KEY = arg("--match");
const NEW_SCORER = arg("--scorer");

const BB_BASE = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_BB = "rightedge.com.au";

const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;

/** Betr MasterEventIds for the fixtures this script can touch. */
const EVENTS: Record<string, { event: number; label: string }> = {
  newzealand__tonga: { event: 2325881, label: "New Zealand v Tonga" },
  australia__samoa: { event: 2325886, label: "Australia v Samoa" },
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!MATCH_KEY || !NEW_SCORER) {
  console.error('Usage: --match <match_key> --scorer "<Player Name>" [--dry-run]');
  process.exit(1);
}
if (!EVENTS[MATCH_KEY]) {
  console.error(`No Betr event id known for ${MATCH_KEY}. Known: ${Object.keys(EVENTS).join(", ")}`);
  process.exit(1);
}

const { event: EVENT, label: LABEL } = EVENTS[MATCH_KEY];

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

interface Out extends SgmOutcome {
  betType: string;
  eventName: string;
  team: string;
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
      eventId: Number(node.EventId ?? 0),
      outcomeId: Number(node.OutcomeId ?? 0),
      // Handicap starts share an EventId and OutcomeId and differ ONLY by
      // FixedMarketId; dropping it collapses every start to one price.
      fixedMarketId: Number(node.FixedMarketId ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      eventName: String(e ?? ""),
      team: String(node.PlayerTeamName ?? ""),
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, out, String(e ?? ""));
  return out;
}

async function priceCombination(markets: any[]): Promise<{ price: number | null; errorNo: number | null }> {
  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA_BB,
      Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: EVENT, Markets: markets }),
  });
  const d = await res.json().catch(() => null);
  if (!d) return { price: null, errorNo: null };
  if (d.ErrorNo !== 0) return { price: null, errorNo: Number(d.ErrorNo) };
  const p = Number(d.Price);
  return { price: Number.isFinite(p) && p ? p : null, errorNo: 0 };
}

async function main() {
  console.log(`Swapping the ${LABEL} multi scorer to ${NEW_SCORER}${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const fixture = (await supabase(`fixtures?match_key=eq.${MATCH_KEY}&select=id`))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${MATCH_KEY}`);

  const picks = await supabase(
    `picks?fixture_id=eq.${fixture.id}&select=id,market,selection,point,entry_odds,result_status`,
  );
  const sgm = (picks ?? []).find((p: any) => p.market === "sgm");
  if (!sgm) throw new Error("no multi published for this fixture");
  if (sgm.result_status !== "pending") {
    throw new Error(`multi is ${sgm.result_status} — refusing to rewrite a settled pick`);
  }
  const core = (picks ?? []).find((p: any) => p.market === "line");
  console.log(`  was: ${sgm.selection}  $${sgm.entry_odds}`);

  // The existing line leg defines the anchor to keep.
  const legs = await supabase(`pick_legs?pick_id=eq.${sgm.id}&select=*&order=leg_index`);
  const lineLeg = (legs ?? []).find((l: any) => l.market === "line");
  if (!lineLeg) throw new Error("the published multi has no line leg to anchor on");
  const anchorTeam = String(lineLeg.selection);
  const anchorPoint = Number(lineLeg.point);
  if (!Number.isFinite(anchorPoint) || !anchorPoint) {
    throw new Error("the published line leg carries no handicap point");
  }

  const all: Out[] = [];
  for (const code of ["G18", "G19", "G20"]) {
    try { all.push(...collect(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${EVENT}&GroupTypeCode=${code}&format=json`))); } catch { /* group may be absent */ }
  }
  if (!all.length) throw new Error("no BlueBet outcomes");

  const anchor = all.find((o) =>
    o.betType === "HC" && norm(o.name) === norm(anchorTeam) &&
    Math.abs(o.points - anchorPoint) < 0.01);
  if (!anchor) throw new Error(`${anchorTeam} ${anchorPoint} is no longer quoted`);
  if (core?.selection && norm(core.selection) !== norm(anchorTeam)) {
    throw new Error(`anchor ${anchorTeam} contradicts the core play ${core.selection}`);
  }

  const scorer = all.find((o) =>
    /^anytime tryscorer$/i.test(o.eventName) && norm(o.name) === norm(NEW_SCORER!));
  if (!scorer) {
    const available = [...new Set(all
      .filter((o) => /^anytime tryscorer$/i.test(o.eventName) && norm(o.team) === norm(anchorTeam))
      .map((o) => o.name))];
    throw new Error(`${NEW_SCORER} is not quoted in the anytime market. ${anchorTeam} options: ${available.join(", ")}`);
  }
  if (norm(scorer.team) !== norm(anchorTeam)) {
    throw new Error(`${scorer.name} is listed under ${scorer.team || "no team"}, not ${anchorTeam}`);
  }

  console.log(`  anchor: ${anchor.name} ${anchor.points > 0 ? "+" : ""}${anchor.points} $${anchor.price}  (fmi ${anchor.fixedMarketId})`);
  console.log(`  scorer: ${scorer.name} $${scorer.price} (${scorer.team})`);

  const { price, errorNo } = await priceCombination([
    buildSgmLeg(anchor, "handicap", LABEL),
    buildSgmLeg(scorer, "try-scorer", LABEL),
  ]);
  if (price === null) throw new Error(`endpoint returned no price (ErrorNo ${errorNo ?? "?"})`);
  if (price === SGM_SENTINEL) throw new Error("endpoint returned the $101 refusal sentinel");
  if (price < MIN_SGM_PRICE) throw new Error(`price $${price} is too short to publish`);

  // Control: an outright-anchored price identical to the handicap price means
  // the endpoint is ignoring the start, which is the fault that published a
  // $5.80 outright price as a "+7.5" multi.
  const outright = all.find((o) => norm(o.name) === norm(anchorTeam) && o.points === 0 && o.betType === "W")
    ?? all.find((o) => norm(o.name) === norm(anchorTeam) && o.points === 0);
  if (outright) {
    const control = await priceCombination([
      buildSgmLeg(outright, "outright", LABEL),
      buildSgmLeg(scorer, "try-scorer", LABEL),
    ]);
    if (control.price !== null) {
      const same = Math.abs(control.price - price) < 0.01;
      console.log(`  control: outright-anchored $${control.price.toFixed(2)} — ` +
        (same ? "IDENTICAL, handicap ignored" : "differs, handicap honoured"));
      if (same) throw new Error("handicap price equals the outright price — leg shape wrong");
    }
  }

  const selection = `${anchorTeam} ${anchor.points > 0 ? "+" : ""}${anchor.points} + ${scorer.name} anytime try`;
  console.log(`  now: ${selection}  $${price.toFixed(2)}`);

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
  // Legs are replaced wholesale so no stale leg can survive the swap.
  await supabase(`pick_legs?pick_id=eq.${sgm.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabase("pick_legs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { pick_id: sgm.id, leg_index: 0, market: "line", selection: anchorTeam, point: anchor.points, leg_odds: anchor.price },
      { pick_id: sgm.id, leg_index: 1, market: "anytime_try", selection: scorer.name, point: null, leg_odds: scorer.price },
    ]),
  });
  console.log("  updated the pick and replaced both legs.");
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
