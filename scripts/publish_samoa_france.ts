/**
 * Publish the Samoa v France selections (RLWC round 1, Fri 16 Oct).
 *
 * Every price is re-read live immediately before writing, and the SGM price
 * comes from Betr's own correlation endpoint.
 *
 * NOTE ON THIS SGM: it prices ABOVE the product of its legs ($2.00 x $2.37 =
 * $4.74, quoted $5.35). That is correct, not a fault. Both legs are Samoan
 * try markets competing for the same pool of tries, so To'o taking two of them
 * makes a try for Manuleleua LESS likely. Negative correlation means the
 * combination is rarer than independence implies and the fair price is higher.
 * The earlier "must price below the product" guard was wrong and has been
 * replaced with a plausibility band.
 *
 * Usage:
 *   npx tsx scripts/publish_samoa_france.ts [--dry-run]
 */

import { buildPickRows, type PublishedPick } from "../src/model/published-picks.ts";
import {
  coverProbabilityFromBands,
  parseMarginBands,
} from "../src/model/line-cover.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0 Safari/537.36";
const HEADERS = { Accept: "application/json", "User-Agent": UA };
const BETR = { ...HEADERS, Origin: "https://www.betr.com.au", Referer: "https://www.betr.com.au/" };

const MASTER_EVENT_ID = 2292700;
const TWO_TRIES_EVENT = 92927442;
const ANYTIME_EVENT = 92928895;
const TAB_MATCH =
  "https://webapi.tab.com.au/v1/tab-info-service/sports/Rugby%20League/competitions/World%20Cup/matches/Samoa%20v%20France?jurisdiction=QLD";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function getJson(url: string, headers = HEADERS): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
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

async function main() {
  console.log(`Publishing Samoa v France${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // ---- TAB: line, total, try scorers --------------------------------------
  const tab = await getJson(TAB_MATCH);
  const lineMarket = (tab.markets ?? []).find((m: any) => m.betOption === "Line");
  const samoaLine = (lineMarket?.propositions ?? []).find((p: any) =>
    String(p.name).toLowerCase().startsWith("samoa"),
  );
  if (!samoaLine?.returnWin) throw new Error("Samoa line unavailable");
  const linePoint = Number(String(samoaLine.name).match(/[-+][\d.]+/)?.[0]);
  if (!Number.isFinite(linePoint)) throw new Error("could not read the Samoa handicap");

  const tryMarket = (tab.markets ?? []).find((m: any) => m.betOption === "To Score a Try");
  const tabTryPrice = (name: string) => {
    const p = (tryMarket?.propositions ?? []).find((x: any) =>
      String(x.name).toLowerCase().startsWith(name.toLowerCase()),
    );
    if (!p?.returnWin) throw new Error(`TAB try price unavailable for ${name}`);
    return Number(p.returnWin);
  };

  // ---- Betr: SGM legs ------------------------------------------------------
  const g20 = await getJson(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G20`,
    BETR,
  );
  const findOutcome = (eventPrefix: string, player: string) => {
    const ev = (g20.Events ?? []).find((e: any) =>
      String(e.EventName ?? "").startsWith(eventPrefix),
    );
    const o = (ev?.Outcomes ?? []).find((x: any) =>
      String(x.OutcomeName ?? "").toLowerCase().includes(player.toLowerCase()),
    );
    if (!o?.Price) throw new Error(`Betr price unavailable: ${player} in ${eventPrefix}`);
    return { outcomeId: Number(o.OutcomeId), price: Number(o.Price), name: String(o.OutcomeName) };
  };

  const too = findOutcome("Player to Score 2 Tries", "To'o");
  const manuleleua = findOutcome("Anytime Tryscorer", "Manuleleua");

  const sgmRes = await fetch("https://web20-api.bluebet.com.au/SameGameMultiPrice", {
    method: "POST",
    headers: { ...BETR, "Content-Type": "application/json" },
    body: JSON.stringify({
      MasterEventID: MASTER_EVENT_ID,
      Markets: [
        { EventId: TWO_TRIES_EVENT, OutcomeId: too.outcomeId, MarketType: "TSCORER",
          FixedWin: too.price, FixedMarketId: 0,
          MarketTypeDesc: "Player to Score 2 Tries (Samoa v France)",
          GroupByHeader: "Player to Score 2 Tries", Points: 0,
          BetDetailTypeCode: "TS", OutcomeName: too.name },
        { EventId: ANYTIME_EVENT, OutcomeId: manuleleua.outcomeId, MarketType: "TSCORER",
          FixedWin: manuleleua.price, FixedMarketId: 0,
          MarketTypeDesc: "Anytime Tryscorer (Samoa v France)",
          GroupByHeader: "Anytime Tryscorer", Points: 0,
          BetDetailTypeCode: "TS", OutcomeName: manuleleua.name },
      ],
    }),
  });
  const sgm = await sgmRes.json();
  if (sgm?.ErrorNo !== 0 || !sgm?.Price) {
    throw new Error(`SGM price unavailable: ${JSON.stringify(sgm)}`);
  }

  // ---- De-vig the try-scorer market ---------------------------------------
  // Non-exclusive market: normalise to the expected distinct scorers implied
  // by this fixture's total, never to 1.0.
  const totalMarket = (tab.markets ?? []).find(
    (m: any) => m.betOption === "Total Points Over/Under",
  );
  const totalPoints = Number(
    String((totalMarket?.propositions ?? []).find((p: any) => /^over/i.test(p.name))?.name ?? "")
      .match(/[\d.]+/)?.[0],
  );
  if (!Number.isFinite(totalPoints)) throw new Error("total unavailable — cannot de-vig");

  const samoaPoints = (totalPoints + -linePoint) / 2;
  const expectedSamoanScorers = (samoaPoints / 5.4) * 0.87;
  const samoanProps = (tryMarket?.propositions ?? []).filter(
    (p: any) => /\(Sam\)/i.test(String(p.name)) && Number(p.returnWin) > 0,
  );
  const samoanRawSum = samoanProps.reduce((s: number, p: any) => s + 1 / Number(p.returnWin), 0);
  const devigScale = Math.min(expectedSamoanScorers / samoanRawSum, 1);
  const devigged = (price: number) => (1 / price) * devigScale;

  console.log(
    `TAB line Samoa ${linePoint} @ $${samoaLine.returnWin}, total ${totalPoints} -> ` +
      `Samoa ${samoaPoints.toFixed(1)}pts, ~${expectedSamoanScorers.toFixed(1)} distinct scorers`,
  );
  console.log(
    `try-scorer book ${(samoanRawSum * 100).toFixed(0)}% (Samoa only) -> de-vig scale ${devigScale.toFixed(3)}\n`,
  );

  // Mid-priced Samoan runners where the positional model and the market
  // broadly AGREE. The model's headline "+27%" reads are discarded: at a
  // projected 9.8 Samoan tries it is extrapolating far outside the NRL range
  // it was fitted on, so those gaps are artefacts rather than value.
  const tryScorers = [
    { name: "Stephen Crichton", model: 0.607 },
    { name: "Clayton Faulalo", model: 0.607 },
    { name: "Francis Manuleleua", model: 0.435 },
  ];

  // ---- Independent cover probability for the line -------------------------
  // The projected scoreline is solved FROM the handicap, so it cannot rate the
  // handicap. Betr's winning-margin ladder is a separate market and gives an
  // independent read.
  const g19 = await getJson(
    `https://web20-api.bluebet.com.au/MasterEvent?MasterEventId=${MASTER_EVENT_ID}&GroupTypeCode=G19`,
    BETR,
  );
  const marginEvent = (g19.Events ?? []).find((e: any) =>
    String(e.EventName ?? "").startsWith("Samoa - Winning Margin"),
  );
  const bands = parseMarginBands(
    (marginEvent?.Outcomes ?? []).map((o: any) => ({
      name: String(o.OutcomeName),
      price: Number(o.Price),
    })),
  );
  const coverProbability = coverProbabilityFromBands(bands, Math.abs(linePoint));
  console.log(
    `margin ladder: ${bands.length} band(s) -> cover ${Math.abs(linePoint)} = ` +
      (coverProbability === null ? "unavailable" : `${(coverProbability * 100).toFixed(1)}%`),
  );

  const picks: PublishedPick[] = [
    {
      kind: "core", market: "line", selection: "Samoa", point: linePoint,
      entryOdds: Number(samoaLine.returnWin), entryBookmaker: "TAB",
      // Read off Betr's winning-margin ladder, which prices the margin
      // directly and is therefore independent of the handicap itself.
      // Null when the ladder is unavailable — never a guess.
      modelProbability: coverProbability,
      marketProbability: coverProbability === null ? null : 1 / Number(samoaLine.returnWin) / 1.05,
    } as PublishedPick & { marketProbability: number | null },
    {
      kind: "sgm", market: "sgm",
      selection: "Brian To'o 2+ tries + Francis Manuleleua anytime try", point: null,
      entryOdds: Number(sgm.Price), entryBookmaker: "Betr",
      modelProbability: 1 / Number(sgm.Price),
      legs: [
        { label: "Brian To'o 2+ tries", market: "player_2_tries", odds: too.price },
        { label: "Francis Manuleleua", market: "anytime_try", odds: manuleleua.price },
      ],
    },
    ...tryScorers.map((t): PublishedPick => {
      const price = tabTryPrice(t.name.split(" ").slice(-1)[0] === "Manuleleua" ? "Francis Manuleleua" : t.name);
      return {
        kind: "try_scorer", market: "anytime_try", selection: t.name, point: null,
        entryOdds: price, entryBookmaker: "TAB",
        modelProbability: t.model,
        marketProbability: devigged(price),
      } as PublishedPick & { marketProbability: number };
    }),
  ];

  // match_key is stored alphabetised, not home-then-away: Samoa (home) v
  // France (away) is keyed "france__samoa".
  const [fixture] = await supabase(
    "fixtures?select=id,home_team,away_team,kickoff_at&match_key=eq.france__samoa",
  );
  if (!fixture) throw new Error("Samoa v France fixture not found");

  const rows = buildPickRows(fixture.id, picks);
  // Attach the de-vigged market probability, which buildPickRows does not own.
  // PostgREST requires every object in a batch insert to carry identical keys,
  // so the column is set on EVERY row — null where there is no de-vigged read.
  for (let i = 0; i < picks.length; i++) {
    const mp = (picks[i] as any).marketProbability;
    (rows[i] as any).market_probability = mp ?? null;
  }

  console.log(`${fixture.home_team} v ${fixture.away_team}  (${fixture.kickoff_at})\n`);
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const mp = (rows[i] as any).market_probability;
    const model = pick.modelProbability === null ? "—" : `${(pick.modelProbability * 100).toFixed(1)}%`;
    const market =
      mp === undefined || mp === null ? "—" : `${(mp * 100).toFixed(1)}%`;
    const point = pick.point === null ? "" : ` ${pick.point}`;
    console.log(
      `  [${pick.kind.padEnd(11)}] ${(pick.selection + point).padEnd(52)} ` +
        `$${pick.entryOdds.toFixed(2)}  ${pick.entryBookmaker.padEnd(5)} model ${model.padStart(6)}  market ${market.padStart(6)}`,
    );
    if (pick.legs) {
      const product = pick.legs.reduce((p, l) => p * l.odds, 1);
      console.log(`                 legs: ${pick.legs.map((l) => `${l.label} $${l.odds.toFixed(2)}`).join(" + ")}`);
      console.log(
        `                 product $${product.toFixed(2)} -> Betr $${pick.entryOdds.toFixed(2)} ` +
          `(${(((pick.entryOdds / product) - 1) * 100).toFixed(1)}%, negatively correlated)`,
      );
    }
  }

  if (DRY_RUN) {
    console.log(`\nWould write ${rows.length} pick row(s)`);
    return;
  }

  await supabase(
    `picks?fixture_id=eq.${fixture.id}&result_status=eq.pending`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  const written = await supabase("picks", { method: "POST", body: JSON.stringify(rows) });
  console.log(`\nWrote ${rows.length} pick row(s)`);

  const parent = (written ?? []).find((r: any) => r.market === "sgm");
  const sgmPick = picks.find((p) => p.legs?.length);
  if (parent && sgmPick?.legs) {
    await supabase("pick_legs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        sgmPick.legs.map((leg, index) => ({
          pick_id: parent.id,
          leg_index: index,
          market: leg.market,
          selection: leg.label,
          point: null,
          leg_odds: leg.odds,
        })),
      ),
    });
    console.log(`Wrote ${sgmPick.legs.length} SGM leg(s)`);
  }
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
