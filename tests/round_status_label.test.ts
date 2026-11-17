/**
 * A finished season must not be labelled "Live".
 *
 * THE BUG, visible on the simulator
 * The MATCHES dashboard showed a green dot and "Round 31 Live" while the NRL
 * 2026 season was over. RoundSwitcher built its label as `${liveLabel} Live`
 * unconditionally, so the "Live" suffix and the live dot were rendered no
 * matter what the data said. Round 31's only fixture is Roosters v Knights,
 * played 4 October 2026 and settled; /round-results returned {"results":[]}
 * and /round-snapshots returned a single completed match.
 *
 * THE RULE
 * "Live" is a claim about the present and must be derived from whether any
 * fixture is actually upcoming -- the same predicate that already governs the
 * featured card (hasPredictionKickedOff). When nothing is upcoming the UI must
 * say so plainly and keep historical results reachable, never relabel settled
 * matches as current opportunities.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { describeRoundStatus } from "../src/app/round-status.ts";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("a round with an upcoming fixture is Live", () => {
  const s = describeRoundStatus({ label: "Round 12", upcomingCount: 3 });
  assert.equal(s.isLive, true);
  assert.equal(s.label, "Round 12 Live");
  assert.equal(s.showLiveDot, true);
});

test("a round with no upcoming fixtures is not Live", () => {
  const s = describeRoundStatus({ label: "Round 31", upcomingCount: 0 });
  assert.equal(s.isLive, false);
  assert.doesNotMatch(s.label, /\bLive\b/, `"${s.label}" still claims to be live`);
  assert.equal(s.showLiveDot, false);
});

test("the completed state is explicit, not blank", () => {
  // The user must be told why there are no cards, not left with an empty page.
  const s = describeRoundStatus({ label: "Round 31", upcomingCount: 0 });
  assert.match(s.label, /Complete|Final/i);
  assert.match(s.emptyMessage, /no upcoming|season|complete/i);
});

test("historical results stay reachable when the season is over", () => {
  const s = describeRoundStatus({ label: "Round 31", upcomingCount: 0 });
  assert.equal(s.allowArchiveBrowsing, true, "archives must remain accessible");
});

test("selecting an archive never shows a live dot", () => {
  const s = describeRoundStatus({ label: "Round 12", upcomingCount: 5, archiveSelected: true });
  assert.equal(s.showLiveDot, false, "an archived round is not live");
  assert.equal(s.isLive, false);
});

test("a missing or malformed count is treated as not-live", () => {
  // Fail closed: never claim live on absent data.
  for (const bad of [undefined, null, NaN, -1, "3"] as unknown[]) {
    const s = describeRoundStatus({ label: "Round 1", upcomingCount: bad as number });
    assert.equal(s.isLive, false, `upcomingCount=${String(bad)} wrongly reported live`);
  }
});

test("RoundSwitcher no longer hardcodes the Live suffix", () => {
  const i = app.indexOf("function RoundSwitcher(");
  assert.ok(i !== -1, "RoundSwitcher not found");
  const fn = app.slice(i, i + 3000);
  assert.doesNotMatch(
    fn,
    /`\$\{liveLabel\} Live`/,
    "the label still appends Live unconditionally",
  );
  assert.match(fn, /describeRoundStatus\(/, "RoundSwitcher does not use the derived status");
});
