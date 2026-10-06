/**
 * Guards the NRL club registry against the international one.
 *
 * getTeamColors / getTeamIcon now consult the nation registry FIRST. The danger
 * is a nation stealing a club's identity — above all "New Zealand", which is
 * both the Kiwis and a prefix of the New Zealand Warriors.
 *
 * App.tsx cannot be imported here (it pulls in React, CSS and the whole app), so
 * these tests assert the same precedence rule against the registry directly:
 * every NRL club label must be DECLINED by resolveInternationalTeam, which is
 * exactly what makes the club lookup in App.tsx run unchanged.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolveInternationalTeam } from "../src/app/teams/international-teams.ts";

/** Every key present in App.tsx's NRL_COLORS / NRL_MASCOTS registries. */
const NRL_REGISTRY_KEYS = [
  "broncos", "brisbane", "raiders", "canberra", "bulldogs", "canterbury",
  "sharks", "cronulla", "dolphins", "titans", "gold coast", "sea eagles",
  "manly", "storm", "melbourne", "knights", "newcastle", "warriors",
  "new zealand", "cowboys", "north qld", "eels", "parramatta", "panthers",
  "penrith", "rabbitohs", "souths", "dragons", "st geo illa", "roosters",
  "sydney", "tigers", "wests tigers",
];

/** Full club names as they appear in the predictions sheet and odds feeds. */
const NRL_CLUB_LABELS = [
  "Brisbane Broncos", "Canberra Raiders", "Canterbury Bulldogs",
  "Cronulla Sharks", "Dolphins", "Gold Coast Titans", "Manly Sea Eagles",
  "Melbourne Storm", "Newcastle Knights", "New Zealand Warriors",
  "North Qld Cowboys", "Parramatta Eels", "Penrith Panthers",
  "South Sydney Rabbitohs", "St Geo Illa Dragons", "Sydney Roosters",
  "Wests Tigers",
];

test("no NRL registry key is claimed by a nation, except the ambiguous one", () => {
  for (const key of NRL_REGISTRY_KEYS) {
    const nation = resolveInternationalTeam(key);
    if (key === "new zealand") {
      // Bare "new zealand" IS the Kiwis. The club key only ever appears inside
      // the full label "New Zealand Warriors", which is asserted below.
      assert.ok(nation, "bare 'new zealand' should resolve to the Kiwis");
      assert.equal(nation.name, "New Zealand");
      continue;
    }
    assert.equal(nation, null, `NRL key '${key}' must not resolve to a nation`);
  }
});

test("every full NRL club label is declined by the nation registry", () => {
  for (const label of NRL_CLUB_LABELS) {
    assert.equal(
      resolveInternationalTeam(label),
      null,
      `'${label}' must keep its club identity`,
    );
  }
});

test("the Warriors keep their identity in every label form", () => {
  for (const label of [
    "New Zealand Warriors",
    "new zealand warriors",
    "NZ Warriors",
    "Warriors",
  ]) {
    assert.equal(resolveInternationalTeam(label), null, `'${label}' is the club`);
  }
});

test("Sydney Roosters are never read as a nation", () => {
  // "Sydney" is an NRL key; no nation may claim it.
  for (const label of ["Sydney", "Sydney Roosters", "Roosters"]) {
    assert.equal(resolveInternationalTeam(label), null);
  }
});

test("an RLWC fixture resolves both nations", () => {
  const home = resolveInternationalTeam("Australia");
  const away = resolveInternationalTeam("New Zealand");
  assert.ok(home && away);
  assert.equal(home.name, "Australia");
  assert.equal(away.name, "New Zealand");
  assert.notEqual(home.primary, away.primary);
});

test("an NRL fixture resolves neither side to a nation", () => {
  assert.equal(resolveInternationalTeam("Sydney Roosters"), null);
  assert.equal(resolveInternationalTeam("Newcastle Knights"), null);
});
