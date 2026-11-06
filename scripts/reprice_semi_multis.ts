/**
 * Reprice both semi-final multis at their TRUE handicap prices.
 *
 * The published multis were priced with an outright-shaped leg, so Betr
 * ignored the handicap: "Tonga +7.5 + Toia" was quoted $5.80, which is the
 * price of "Tonga to WIN + Toia". The real handicap prices are materially
 * shorter, and a subscriber following the card could not have obtained $5.80
 * for the bet as described.
 *
 * This rewrites each multi with:
 *   - the chosen anchor, as a correctly shaped HC leg (buildSgmLeg enforces
 *     the shape and refuses a zero point or a missing FixedMarketId),
 *   - the price the endpoint returns for that exact combination,
 *   - legs replaced wholesale so no stale leg survives.
 *
 * Fails closed per fixture. Refuses outright to touch a settled pick.
 *
 * Usage: npx tsx scripts/reprice_semi_multis.ts [--dry-run]
 */
import { buildSgmLeg, type SgmOutcome } from "../src/model/sgm-legs.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const BB_BASE = "https://affiliate-api.bluebet.com.au";
const SGM_ENDPOINT = "https://web20-api.bluebet.com.au/SameGameMultiPrice";
const UA_BB = "rightedge.com.au";

const SGM_SENTINEL = 101;
const MIN_SGM_PRICE = 1.45;

interface Target {
  matchKey: string;
  label: string;
  event: number;
  anchorTeam: string;
  /** The chosen start, as decided. */
  anchorPoint: number;
  scorer: string;
}

const TARGETS: Target[] = [
  {
    matchKey: "newzealand__tonga", label: "New Zealand v Tonga", event: 2325881,
    anchorTeam: "Tonga", anchorPoint: 18.5, scorer: "Robert Toia",
  },
  {
    matchKey: "australia__samoa", label: "Australia v Samoa", event: 2325886,
    anchorTeam: "Australia", anchorPoint: -8.5, scorer: "Tom Trbojevic",
  },
];

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
      fixedMarketId: Number(node.FixedMarketId ?? 0),
      betType: String(node.BetDetailTypeCode ?? ""),
      eventName: String(e ?? ""),
      team: String(node.PlayerTeamName ?? ""),
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, out, String(e ?? ""));
  return out;
}

async function run(target: Target) {
  console.log(`\n${"=".repeat(74)}\n${target.label}\n${"=".repeat(74)}`);

  const fixture = (await supabase(`fixtures?match_key=eq.${target.matchKey}&select=id`))?.[0];
  if (!fixture) throw new Error(`fixture not found: ${target.matchKey}`);

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

  const all: Out[] = [];
  for (const code of ["G18", "G19", "G20"]) {
    try { all.push(...collect(await getJson(`${BB_BASE}/MasterEvent?MasterEventId=${target.event}&GroupTypeCode=${code}&format=json`))); } catch { /* group may be absent */ }
  }
  if (!all.length) throw new Error("no BlueBet outcomes");

  // The anchor must be the exact start chosen, matched on its own points.
  const anchor = all.find((o) =>
    o.betType === "HC" && norm(o.name) === norm(target.anchorTeam) &&
    Math.abs(o.points - target.anchorPoint) < 0.01);
  if (!anchor) throw new Error(`${target.anchorTeam} ${target.anchorPoint} is no longer quoted`);

  // The anchor must stay on the same side as the core play, or the product
  // contradicts itself.
  if (core?.selection && norm(core.selection) !== norm(target.anchorTeam)) {
    throw new Error(`anchor ${target.anchorTeam} contradicts the core play ${core.selection}`);
  }

  const scorer = all.find((o) =>
    /^anytime tryscorer$/i.test(o.eventName) && norm(o.name) === norm(target.scorer));
  if (!scorer) throw new Error(`${target.scorer} is not quoted in the anytime market`);
  if (norm(scorer.team) !== norm(target.anchorTeam)) {
    throw new Error(`${target.scorer} is listed under ${scorer.team || "no team"}, not ${target.anchorTeam}`);
  }

  console.log(`  anchor: ${anchor.name} ${anchor.points > 0 ? "+" : ""}${anchor.points} $${anchor.price}  (fmi ${anchor.fixedMarketId})`);
  console.log(`  scorer: ${scorer.name} $${scorer.price}`);

  const markets = [
    buildSgmLeg(anchor, "handicap", target.label),
    buildSgmLeg(scorer, "try-scorer", target.label),
  ];

  const res = await fetch(SGM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA_BB,
      Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
    },
    body: JSON.stringify({ MasterEventID: target.event, Markets: markets }),
  });
  const d = await res.json().catch(() => null);
  if (!d) throw new Error("no response from the SGM endpoint");
  if (d.ErrorNo !== 0) throw new Error(`endpoint refused: ErrorNo ${d.ErrorNo} ${String(d.Message ?? "").slice(0, 80)}`);
  const price = Number(d.Price);
  if (!Number.isFinite(price) || !price) throw new Error("endpoint returned no price");
  if (price === SGM_SENTINEL) throw new Error("endpoint returned the $101 refusal sentinel");
  if (price < MIN_SGM_PRICE) throw new Error(`price $${price} is too short to publish`);

  // Sanity: the handicap price must differ from the outright-anchored price,
  // otherwise the endpoint is still ignoring the start.
  const outright = all.find((o) => o.betType === "W" && norm(o.name) === norm(target.anchorTeam) && o.points === 0)
    ?? all.find((o) => norm(o.name) === norm(target.anchorTeam) && o.points === 0);
  if (outright) {
    const r2 = await fetch(SGM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA_BB,
        Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/",
      },
      body: JSON.stringify({ MasterEventID: target.event, Markets: [
        buildSgmLeg(outright, "outright", target.label),
        buildSgmLeg(scorer, "try-scorer", target.label),
      ] }),
    });
    const d2 = await r2.json().catch(() => null);
    const outrightPrice = d2 && d2.ErrorNo === 0 ? Number(d2.Price) : null;
    if (outrightPrice !== null) {
      const same = Math.abs(outrightPrice - price) < 0.01;
      console.log(`  control: outright-anchored would be $${outrightPrice.toFixed(2)} — ` +
        (same ? "IDENTICAL, the handicap is still being ignored" : "differs, the handicap is being honoured"));
      if (same) throw new Error("handicap price matches the outright price — leg shape still wrong");
    }
  }

  const selection = `${target.anchorTeam} ${anchor.points > 0 ? "+" : ""}${anchor.points} + ${scorer.name} anytime try`;
  console.log(`  now: ${selection}  $${price.toFixed(2)}`);

  if (DRY_RUN) { console.log("  (dry run — nothing written)"); return; }

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
  await supabase(`pick_legs?pick_id=eq.${sgm.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabase("pick_legs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { pick_id: sgm.id, leg_index: 0, market: "line", selection: target.anchorTeam, point: anchor.points, leg_odds: anchor.price },
      { pick_id: sgm.id, leg_index: 1, market: "anytime_try", selection: scorer.name, point: null, leg_odds: scorer.price },
    ]),
  });
  console.log("  updated the pick and replaced both legs.");
}

async function main() {
  console.log(`Repricing the semi-final multis at their true handicap prices${DRY_RUN ? " (DRY RUN)" : ""}`);
  for (const target of TARGETS) {
    try { await run(target); }
    catch (e: any) { console.log(`  FAILED: ${e?.message ?? e}  — left unchanged`); }
  }
  console.log(`\n${DRY_RUN ? "DRY RUN complete." : "Done."}`);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
