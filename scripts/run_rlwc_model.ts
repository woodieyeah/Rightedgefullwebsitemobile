/**
 * Run the full model over every RLWC fixture using BlueBet's grouped markets.
 *
 * Fetches each MasterEvent across the market groups listed in its own
 * GroupLinks, then derives win probability, margin and projected scoreline.
 * Read-only; prints a table.
 */

import {
  deriveProjection,
  devigTwoWay,
  extractHandicap,
  extractHeadToHead,
  type BlueBetEvent,
} from "../src/model/bluebet-markets.ts";

const WEB20 = "https://web20-api.bluebet.com.au";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": UA,
  Origin: "https://www.betr.com.au",
  Referer: "https://www.betr.com.au/",
};

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function loadAllMarkets(masterEventId: number): Promise<{
  name: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  markets: BlueBetEvent[];
}> {
  const base = await getJson(`${WEB20}/MasterEvent?MasterEventId=${masterEventId}`);
  const me = base.MasterEvent ?? {};
  const name: string = me.MasterEventName ?? "?";
  const [homeTeam, awayTeam] = name.split(" v ").map((s) => s.trim());

  const groups: string[] = (base.GroupLinks ?? [])
    .map((g: any) => g.GroupTypeCode)
    .filter(Boolean);

  const markets: BlueBetEvent[] = [...(base.Events ?? [])];
  for (const group of groups) {
    try {
      const payload = await getJson(
        `${WEB20}/MasterEvent?MasterEventId=${masterEventId}&GroupTypeCode=${group}`,
      );
      for (const event of payload.Events ?? []) {
        if (!markets.some((m) => m.EventName === event.EventName)) markets.push(event);
      }
    } catch {
      // A group that fails to load simply contributes nothing.
    }
  }

  return { name, homeTeam, awayTeam, kickoff: me.MinAdvertisedStartTime ?? "", markets };
}

async function main() {
  const ids = [2292811, 2292700, 2299390, 2292886, 2299391];

  for (const id of ids) {
    const { name, homeTeam, awayTeam, kickoff, markets } = await loadAllMarkets(id);

    console.log(`\n=== ${name}  (${kickoff.slice(0, 16)}Z, ${markets.length} markets) ===`);

    const matchResult = markets.find((m) => (m.EventName ?? "").startsWith("Match Result"));

    if (matchResult) {
      const h2h = extractHeadToHead(matchResult, homeTeam, awayTeam);
      if (h2h) {
        const fair = devigTwoWay(h2h.homePrice, h2h.awayPrice)!;
        console.log(
          `  win prob   ${homeTeam} ${(fair.first * 100).toFixed(1)}%  ` +
            `${awayTeam} ${(fair.second * 100).toFixed(1)}%   ` +
            `(book ${(fair.overround * 100).toFixed(1)}%, prices $${h2h.homePrice} / $${h2h.awayPrice})`,
        );
      }
      const handicap = extractHandicap(matchResult, homeTeam);
      if (handicap) {
        const sign = handicap.margin > 0 ? "+" : "";
        console.log(`  margin     ${homeTeam} ${sign}${handicap.margin} @ $${handicap.price}`);
      }
    }

    const projection = deriveProjection({ homeTeam, awayTeam, markets });
    if (projection) {
      console.log(
        `  PROJECTED  ${homeTeam} ${projection.home.toFixed(1)} - ` +
          `${projection.away.toFixed(1)} ${awayTeam}   ` +
          `[total ${projection.total.toFixed(1)}, via ${projection.source}]`,
      );
    } else {
      console.log("  PROJECTED  none — no totals market for this fixture yet");
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
