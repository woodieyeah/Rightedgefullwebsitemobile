/**
 * A multi's scorer may be the opposition, but only deliberately.
 *
 * The swap script refused any scorer not on the anchor's team. That guard
 * caught a real class of mistake (a player quietly listed under the wrong
 * side), but it also blocks a legitimate bet: "New Zealand +8.5 + Reece
 * Walsh" backs New Zealand to stay within 8.5 while an Australian scores,
 * and those outcomes are perfectly compatible.
 *
 * The rule is therefore: same-team is allowed silently, cross-team requires
 * an explicit opt-in, and a scorer with no team at all is always refused
 * because nothing can be verified about them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkScorerTeam } from "../src/model/scorer-team.ts";

test("a scorer on the anchor's team is allowed", () => {
  const r = checkScorerTeam({ scorer: "Kalyn Ponga", scorerTeam: "New Zealand", anchorTeam: "New Zealand" });
  assert.equal(r.allowed, true);
  assert.equal(r.crossTeam, false);
});

test("an opposition scorer is refused unless explicitly allowed", () => {
  const r = checkScorerTeam({ scorer: "Reece Walsh", scorerTeam: "Australia", anchorTeam: "New Zealand" });
  assert.equal(r.allowed, false);
  assert.equal(r.crossTeam, true);
  assert.match(r.reason!, /opposition/i);
});

test("an opposition scorer is allowed with the opt-in and reported as cross-team", () => {
  const r = checkScorerTeam({
    scorer: "Reece Walsh", scorerTeam: "Australia", anchorTeam: "New Zealand",
    allowCrossTeam: true,
  });
  assert.equal(r.allowed, true);
  assert.equal(r.crossTeam, true);
});

test("a scorer with no listed team is always refused", () => {
  for (const allowCrossTeam of [false, true]) {
    const r = checkScorerTeam({ scorer: "Someone", scorerTeam: "", anchorTeam: "New Zealand", allowCrossTeam });
    assert.equal(r.allowed, false, `allowCrossTeam=${allowCrossTeam}`);
    assert.match(r.reason!, /no team/i);
  }
});

test("team comparison ignores case and spacing", () => {
  const r = checkScorerTeam({ scorer: "X", scorerTeam: "new  zealand", anchorTeam: "New Zealand" });
  assert.equal(r.allowed, true);
  assert.equal(r.crossTeam, false);
});
