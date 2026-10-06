import assert from "node:assert/strict";
import test from "node:test";

/**
 * Guards the live-view filter on the matches page.
 *
 * The page previously rendered every prediction row, so a finished match stayed
 * on screen indefinitely — after the 2026 Grand Final the completed Roosters v
 * Knights card sat above the upcoming RLWC fixtures. The filter uses the same
 * three-hour window as isFixtureCompleted, which is replicated here.
 */

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

/** Mirror of isFixtureCompleted's rule in App.tsx. */
function isCompleted(kickoffMs: number, now: number): boolean {
  return Number.isFinite(kickoffMs) && now - kickoffMs > THREE_HOURS_MS;
}

const GRAND_FINAL = Date.parse("2026-10-04T08:30:00Z"); // 6:30pm AEST
const RLWC_OPENER = Date.parse("2026-10-15T09:05:00Z"); // 8:05pm AEDT
const NOW = Date.parse("2026-10-06T03:00:00Z");         // 2 days later

test("a match finished two days ago is filtered out", () => {
  assert.equal(isCompleted(GRAND_FINAL, NOW), true);
});

test("an upcoming match is never filtered out", () => {
  assert.equal(isCompleted(RLWC_OPENER, NOW), false);
});

test("a match still in progress stays visible", () => {
  // Kicked off 90 minutes ago: inside the three-hour window.
  const kickoff = NOW - 90 * 60 * 1000;
  assert.equal(isCompleted(kickoff, NOW), false);
});

test("a match drops off just after the three-hour window", () => {
  assert.equal(isCompleted(NOW - THREE_HOURS_MS - 1000, NOW), true);
  assert.equal(isCompleted(NOW - THREE_HOURS_MS + 1000, NOW), false);
});

test("an unparseable kickoff is treated as not completed, so it stays visible", () => {
  // Fail-open: a fixture with a bad date must not silently vanish.
  assert.equal(isCompleted(Number.NaN, NOW), false);
});

test("filtering a mixed round leaves only upcoming fixtures", () => {
  const rows = [
    { name: "Roosters v Knights", kickoff: GRAND_FINAL },
    { name: "Australia v New Zealand", kickoff: RLWC_OPENER },
    { name: "Samoa v France", kickoff: Date.parse("2026-10-16T06:45:00Z") },
  ];
  const visible = rows.filter((r) => !isCompleted(r.kickoff, NOW)).map((r) => r.name);
  assert.deepEqual(visible, ["Australia v New Zealand", "Samoa v France"]);
});
