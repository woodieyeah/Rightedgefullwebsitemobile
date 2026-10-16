/**
 * Build today's RLWC card: core play, try scorers and an SGM per fixture.
 *
 * Every price is read live here and nothing is carried over from an earlier
 * run — a card published against a stale price is a card that misprices risk.
 */
import { devigAnytimeTryMarket } from "../src/model/devig-try-market.ts";
import { parseMarginBands, coverProbabilityFromBands } from "../src/model/line-cover.ts";

const TAB = "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches";
const BB = "https://affiliate-api.bluebet.com.au";
const UA_TAB = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const UA_BB = "rightedge.com.au";

const FIXTURES = [
  { tabKey: "PNG v Lebanon", label: "Papua New Guinea v Lebanon", event: 2299390,
    fav: "Papua New Guinea", favTab: "PNG", dog: "Lebanon", dogTab: "Leb" },
  { tabKey: "England v Tonga", label: "England v Tonga", event: 2292886,
    fav: "Tonga", favTab: "Ton", dog: "England", dogTab: "Eng" },
];

async function tabMatch(key: string) {
  const res = await fetch(`${TAB}/${encodeURIComponent(key)}?jurisdiction=NSW`, {
    headers: { "User-Agent": UA_TAB, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TAB ${key} HTTP ${res.status}`);
  return res.json();
}

async function bbGroup(event: number, code: string) {
  const res = await fetch(`${BB}/MasterEvent?MasterEventId=${event}&GroupTypeCode=${code}&format=json`, {
    headers: { "User-Agent": UA_BB, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`BlueBet ${code} HTTP ${res.status}`);
  const data = await res.json();
  const out: any[] = [];
  const walk = (n: any, ev = "") => {
    if (!n || typeof n !== "object") return;
    const name = n.EventName ?? ev;
    if (n.OutcomeName && n.Price != null) out.push({ ...n, EventName: name });
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, name);
  };
  walk(data);
  return out;
}

const market = (d: any, name: string) =>
  (d.markets ?? []).find((m: any) => new RegExp(`^${name}$`, "i").test(m.betOption ?? m.name ?? ""));

async function main() {
  for (const f of FIXTURES) {
    console.log(`\n${"=".repeat(68)}\n${f.label}\n${"=".repeat(68)}`);

    const tab = await tabMatch(f.tabKey);
    const h2h = market(tab, "Head To Head");
    const line = market(tab, "Line");
    const total = market(tab, "Total Points Over/Under");
    const anytime = market(tab, "To Score a Try");

    const favH2h = h2h.propositions.find((p: any) => p.name === f.fav || p.name === f.favTab);
    const dogH2h = h2h.propositions.find((p: any) => p.name === f.dog || p.name === f.dogTab);
    const over = total.propositions.find((p: any) => /^Over/i.test(p.name));
    const totalPts = Number(String(over.name).match(/[\d.]+/)![0]);

    const favLine = line.propositions.find((p: any) => p.name.startsWith(f.fav) || p.name.startsWith(f.favTab));
    const lineVal = Number(String(favLine.name).match(/-?[\d.]+/)![0]);

    const book = 1 / favH2h.returnWin + 1 / dogH2h.returnWin;
    console.log(`\nMarket (TAB, read live)`);
    console.log(`  ${f.fav} $${favH2h.returnWin} / ${f.dog} $${dogH2h.returnWin}   book ${(book * 100).toFixed(2)}%`);
    console.log(`  line ${favLine.name} $${favLine.returnWin}   total ${totalPts}`);

    // Margin ladder from BlueBet: an independent market, so it can rate the line.
    const g19 = await bbGroup(f.event, "G19");
    const ladder = g19
      .filter((o) => new RegExp(`^${f.fav}\\s+\\d+\\+$`).test(o.OutcomeName))
      .map((o) => ({ name: o.OutcomeName, price: Number(o.Price) }));
    const bands = parseMarginBands(ladder);
    const need = Math.ceil(Math.abs(lineVal));
    const cover = bands.length >= 2 ? coverProbabilityFromBands(bands, need) : null;

    console.log(`\nLine rating (from the ${f.fav} winning-margin ladder, ${bands.length} bands)`);
    if (cover === null) {
      console.log(`  no rating — ${need}+ sits outside the quoted ladder; failing closed`);
    } else {
      const implied = 1 / favLine.returnWin;
      console.log(`  needs ${need}+   model ${(cover * 100).toFixed(1)}%   price implies ${(implied * 100).toFixed(1)}%   edge ${((cover - implied) * 100).toFixed(1)}%`);
    }

    // Try scorers, de-vigged against the expected distinct-scorer count.
    const runners = anytime.propositions.map((p: any) => ({ name: String(p.name), odds: Number(p.returnWin) }));
    const rated = devigAnytimeTryMarket(runners, totalPts).sort((a, b) => b.probability - a.probability);

    console.log(`\nTry scorers (${runners.length} runners, de-vigged to expected distinct scorers)`);
    console.log(`  ${"player".padEnd(30)} price    model`);
    for (const r of rated.slice(0, 6)) {
      console.log(`  ${r.name.padEnd(30)} $${String(r.odds).padEnd(7)} ${(r.probability * 100).toFixed(1)}%`);
    }
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
