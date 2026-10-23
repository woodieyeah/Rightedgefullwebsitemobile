/**
 * Unpublish the pending try-scorer picks.
 *
 * The selection rule was provably "shortest price": devigAnytimeTryMarket
 * applies one shared multiplier to every runner, so ranking by model
 * probability is identical to ranking by price and no runner can ever rate
 * above the market. Record across 14 settled picks: 3 wins, -8.75u, -55% ROI
 * in the $1.50-1.99 band, and the model expected 5.6 winners where 3 arrived.
 *
 * Only PENDING picks are touched. The settled losses stay exactly as they are
 * — the tracker is the honest record of a product that lost money, and
 * deleting that history would flatter the model.
 *
 * `published` is set false rather than deleting the rows, so the selections
 * remain available for calibrating the replacement model.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing credentials."); process.exit(1); }

const H = {
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, Prefer: "return=representation", ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = await res.text();
  return t.trim() ? JSON.parse(t) : null;
}

const pending = await rest(
  "picks?market=eq.anytime_try&result_status=eq.pending&published=eq.true" +
  "&select=id,selection,entry_odds,fixture_id",
);

console.log(`${pending.length} pending try-scorer pick(s) to unpublish${DRY_RUN ? " (DRY RUN)" : ""}\n`);
for (const p of pending) {
  console.log(`  ${String(p.selection).padEnd(28)} $${p.entry_odds}`);
}

// Confirm the settled history will be untouched.
const settled = await rest(
  "picks?market=eq.anytime_try&result_status=neq.pending&select=id,result_status",
);
console.log(`\n${settled.length} settled try-scorer pick(s) will be LEFT IN PLACE (the honest record).`);

// Any multi containing a try-scorer leg is a separate product and stays: its
// legs were chosen for correlation and price, not by the shortest-price rule.
const multis = await rest("picks?market=eq.sgm&result_status=eq.pending&select=selection,entry_odds");
console.log(`${multis.length} pending multi(s) unaffected:`);
for (const m of multis) console.log(`  $${String(m.entry_odds).padEnd(6)} ${m.selection}`);

if (DRY_RUN) { console.log("\nDRY RUN complete."); process.exit(0); }

let done = 0;
for (const p of pending) {
  await rest(`picks?id=eq.${p.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ published: false, published_at: null }),
  });
  done++;
}

const left = await rest(
  "picks?market=eq.anytime_try&result_status=eq.pending&published=eq.true&select=id",
);
console.log(`\nUnpublished ${done}. Pending try-scorer picks still published: ${left.length}`);
