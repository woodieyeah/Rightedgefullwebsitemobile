import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveInternationalTeam,
  INTERNATIONAL_TEAMS,
} from "../src/app/teams/international-teams.ts";

// RLWC teams are countries. Matched by country name, displayed by country name.

test("every nation in the tournament field resolves to its country name", () => {
  for (const country of [
    "Australia", "New Zealand", "Samoa", "England", "Tonga",
    "Papua New Guinea", "Fiji", "Cook Islands", "Lebanon", "France",
  ]) {
    const team = resolveInternationalTeam(country);
    assert.ok(team, `${country} must resolve`);
    assert.equal(team.name, country);
  }
});

test("each nation has distinct colours and an icon", () => {
  const seen = new Set<string>();
  for (const team of Object.values(INTERNATIONAL_TEAMS)) {
    assert.match(team.primary, /^#[0-9A-F]{6}$/i, `${team.name} primary`);
    assert.match(team.secondary, /^#[0-9A-F]{6}$/i, `${team.name} secondary`);
    assert.ok(team.icon.length > 0, `${team.name} icon`);
    assert.notEqual(team.primary, team.secondary, `${team.name} needs contrast`);
    const pair = `${team.primary}|${team.secondary}`;
    assert.ok(!seen.has(pair), `${team.name} duplicates another nation's colours`);
    seen.add(pair);
  }
});

test("country codes a feed may send resolve", () => {
  assert.equal(resolveInternationalTeam("PNG")?.name, "Papua New Guinea");
  assert.equal(resolveInternationalTeam("NZL")?.name, "New Zealand");
  assert.equal(resolveInternationalTeam("ENG")?.name, "England");
});

test("resolution ignores case, spacing and punctuation", () => {
  for (const variant of ["  australia  ", "AUSTRALIA", "Australia."]) {
    assert.equal(resolveInternationalTeam(variant)?.name, "Australia");
  }
  assert.equal(resolveInternationalTeam("cook islands")?.name, "Cook Islands");
});

// ---------------------------------------------------------------------------
// NRL clubs must never be claimed. This is why matching is exact.
// ---------------------------------------------------------------------------

test("the New Zealand Warriors stay an NRL club", () => {
  for (const label of ["New Zealand Warriors", "new zealand warriors", "Warriors"]) {
    assert.equal(resolveInternationalTeam(label), null, `'${label}' is the club`);
  }
  // The country on its own is still the nation.
  assert.equal(resolveInternationalTeam("New Zealand")?.name, "New Zealand");
});

test("no NRL club name resolves to a nation", () => {
  for (const club of [
    "Broncos", "Raiders", "Bulldogs", "Sharks", "Dolphins", "Titans",
    "Sea Eagles", "Storm", "Knights", "Warriors", "Cowboys", "Eels",
    "Panthers", "Rabbitohs", "Dragons", "Roosters", "Tigers", "Lions",
    "Sydney Roosters", "Newcastle Knights", "New Zealand Warriors",
    "South Sydney Rabbitohs", "North Qld Cowboys", "St Geo Illa Dragons",
    "Gold Coast Titans", "Wests Tigers", "Sydney", "Newcastle", "Brisbane",
    "Melbourne", "Canberra", "Penrith", "Parramatta", "Cronulla", "Manly",
  ]) {
    assert.equal(resolveInternationalTeam(club), null, `'${club}' must stay a club`);
  }
});

test("a longer label containing a country does not resolve", () => {
  // Exact matching only — no substring claims.
  assert.equal(resolveInternationalTeam("Australia Kangaroos"), null);
  assert.equal(resolveInternationalTeam("Samoa National Team"), null);
});

test("unknown and empty names return null", () => {
  for (const name of ["", "   ", "Zzz"]) {
    assert.equal(resolveInternationalTeam(name), null);
  }
  assert.equal(resolveInternationalTeam(null as any), null);
  assert.equal(resolveInternationalTeam(undefined as any), null);
});

test("an RLWC fixture resolves both countries", () => {
  const home = resolveInternationalTeam("Australia");
  const away = resolveInternationalTeam("New Zealand");
  assert.ok(home && away);
  assert.equal(home.name, "Australia");
  assert.equal(away.name, "New Zealand");
  assert.notEqual(home.primary, away.primary);
});

test("an NRL fixture resolves neither side", () => {
  assert.equal(resolveInternationalTeam("Sydney Roosters"), null);
  assert.equal(resolveInternationalTeam("Newcastle Knights"), null);
});
