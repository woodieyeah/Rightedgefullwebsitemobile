// Throwaway probe: runs the exact client path the browser will run.
import { fetchCompetitionFixtures, selectCurrentFixtures } from "../src/app/rlwc/fixtures.ts";
import { adaptFixtures } from "../src/app/rlwc/adapt.ts";
import { publicAnonKey } from "../utils/supabase/info.tsx";

async function main() {
  const fixtures = await fetchCompetitionFixtures("rlwc", publicAnonKey);
  console.log("fetched from supabase:", fixtures.length);

  const current = selectCurrentFixtures(fixtures);
  const adapted = adaptFixtures(current);
  console.log("adapted predictions:", adapted.predictions.length);
  console.log();

  for (const p of adapted.predictions.slice(0, 4)) {
    const f = p.fixture;
    console.log(`  ${p.match}`);
    console.log(`     round ${p.roundNumber} · ${f?.day} ${f?.dateLabel} · ${f?.aedt} ${f?.tz} · ${f?.stadium}`);
    console.log(`     proj ${p.predictedHomeScore}-${p.predictedAwayScore} · bestBet ${JSON.stringify(p.bestBet)}`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
