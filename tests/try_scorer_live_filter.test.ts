import assert from "node:assert/strict";
import test from "node:test";

/**
 * Guards the try-scorer page against publishing completed matches.
 *
 * Try-scorer rows carry a round number and a match label but no kickoff time,
 * so the page cannot tell a finished match from an upcoming one on its own. It
 * showed the 2026 Grand Final (Sydney v Newcastle) nine days after it was
 * played, with live "Best Bet" and "Value" signals attached to a settled game.
 *
 * The fix joins each row to its fixture by team pair and drops rows whose
 * fixture has finished, using the same three-hour window as the matches page.
 * This file pins that behaviour independently of React.
 */

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

interface Row { round: number; match: string; player: string }
interface Fixture { homeTeam: string; awayTeam: string; kickoffMs: number }

/** Mirror of buildTeamPairKey / getMatchPairKeyFromLabel in App.tsx. */
function pairKey(a: string, b: string): string {
  return [a, b].map((s) => s.trim().toLowerCase()).sort().join("__");
}
function pairKeyFromLabel(label: string): string {
  const parts = String(label || "").split(/\s+v\s+/i);
  if (parts.length === 2) return pairKey(parts[0], parts[1]);
  return String(label || "").trim().toLowerCase();
}

/**
 * The selection rule under test: keep a row only when its fixture is known and
 * has not finished. A row whose fixture cannot be resolved is KEPT, so a naming
 * mismatch degrades to showing too much rather than silently hiding plays.
 */
function selectLiveRows(rows: Row[], fixtures: Fixture[], now: number): Row[] {
  const kickoffByPair = new Map<string, number>();
  for (const f of fixtures) {
    kickoffByPair.set(pairKey(f.homeTeam, f.awayTeam), f.kickoffMs);
  }

  return rows.filter((row) => {
    const kickoff = kickoffByPair.get(pairKeyFromLabel(row.match));
    if (kickoff === undefined || !Number.isFinite(kickoff)) return true;
    return now - kickoff <= THREE_HOURS_MS;
  });
}

const NOW = Date.parse("2026-10-13T00:00:00Z");
const GRAND_FINAL = Date.parse("2026-10-04T08:30:00Z");
const RLWC_OPENER = Date.parse("2026-10-15T09:05:00Z");

const grandFinalRows: Row[] = [
  { round: 31, match: "Sydney v Newcastle", player: "Daniel Tupou" },
  { round: 31, match: "Sydney v Newcastle", player: "Mark Nawaqanitawase" },
  { round: 31, match: "Sydney v Newcastle", player: "Daly Cherry-Evans" },
];

const fixtures: Fixture[] = [
  { homeTeam: "Sydney", awayTeam: "Newcastle", kickoffMs: GRAND_FINAL },
  { homeTeam: "Australia", awayTeam: "New Zealand", kickoffMs: RLWC_OPENER },
];

test("the completed Grand Final's try scorers are dropped", () => {
  assert.deepEqual(selectLiveRows(grandFinalRows, fixtures, NOW), []);
});

test("an upcoming match's try scorers are kept", () => {
  const rows: Row[] = [{ round: 101, match: "Australia v New Zealand", player: "Example" }];
  assert.equal(selectLiveRows(rows, fixtures, NOW).length, 1);
});

test("a match in progress is kept", () => {
  const rows: Row[] = [{ round: 31, match: "Sydney v Newcastle", player: "Daniel Tupou" }];
  const duringMatch = GRAND_FINAL + 60 * 60 * 1000;
  assert.equal(selectLiveRows(rows, fixtures, duringMatch).length, 1);
});

test("rows drop off just after the three-hour window", () => {
  const rows: Row[] = [{ round: 31, match: "Sydney v Newcastle", player: "Daniel Tupou" }];
  assert.equal(selectLiveRows(rows, fixtures, GRAND_FINAL + THREE_HOURS_MS - 1000).length, 1);
  assert.equal(selectLiveRows(rows, fixtures, GRAND_FINAL + THREE_HOURS_MS + 1000).length, 0);
});

test("a row whose fixture is unknown is kept, not silently hidden", () => {
  // Fail open: a naming mismatch must not make premium plays disappear.
  const rows: Row[] = [{ round: 99, match: "Unknown v Mystery", player: "Example" }];
  assert.equal(selectLiveRows(rows, fixtures, NOW).length, 1);
});

test("team order in the label does not matter", () => {
  const rows: Row[] = [{ round: 31, match: "Newcastle v Sydney", player: "Daniel Tupou" }];
  assert.deepEqual(selectLiveRows(rows, fixtures, NOW), []);
});

test("a mixed list keeps only the upcoming match", () => {
  const rows: Row[] = [
    ...grandFinalRows,
    { round: 101, match: "Australia v New Zealand", player: "Example" },
  ];
  const kept = selectLiveRows(rows, fixtures, NOW);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].match, "Australia v New Zealand");
});

test("an empty row list stays empty", () => {
  assert.deepEqual(selectLiveRows([], fixtures, NOW), []);
});
