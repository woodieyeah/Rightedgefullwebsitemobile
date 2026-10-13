import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

/**
 * Guards the server's NRL team-name normaliser against international fixtures.
 *
 * The normaliser matches on plain substring containment, which is correct for
 * the 17 NRL clubs but hostile to nation names: "New Zealand" contains the
 * Warriors' city, so an RLWC fixture was published as
 * "Australia v New Zealand Warriors" in the live odds feed.
 *
 * The same shape of collision exists for several other nations, so this file
 * asserts the whole class, not just the one that was observed.
 */

const source = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("function normalizeNrlTeamName(");
assert.ok(start >= 0, "normalizeNrlTeamName must be found");
const end = source.indexOf("\nfunction ", start + 1);
const normalise = new Function(
  `${stripTypeScriptTypes(source.slice(start, end))}\nreturn normalizeNrlTeamName;`,
)();

// ---------------------------------------------------------------------------
// Nations must survive untouched.
// ---------------------------------------------------------------------------

const NATIONS = [
  "Australia",
  "New Zealand",
  "Samoa",
  "Tonga",
  "England",
  "Fiji",
  "Papua New Guinea",
  "Cook Islands",
  "Lebanon",
  "France",
  "Wales",
  "Ireland",
  "Scotland",
  "Italy",
  "Jamaica",
  "Greece",
];

for (const nation of NATIONS) {
  test(`${nation} is never rewritten into an NRL club`, () => {
    assert.equal(normalise(nation), nation);
  });
}

test("New Zealand does not become the Warriors", () => {
  // The observed defect: the live odds feed published
  // "Australia v New Zealand Warriors".
  assert.equal(normalise("New Zealand"), "New Zealand");
  assert.notEqual(normalise("New Zealand"), "New Zealand Warriors");
});

// ---------------------------------------------------------------------------
// NRL clubs must still normalise exactly as before.
// ---------------------------------------------------------------------------

const CLUBS: [string, string][] = [
  ["Warriors", "New Zealand Warriors"],
  ["New Zealand Warriors", "New Zealand Warriors"],
  ["NZ Warriors", "New Zealand Warriors"],
  ["Broncos", "Brisbane Broncos"],
  ["Brisbane", "Brisbane Broncos"],
  ["Rabbitohs", "South Sydney Rabbitohs"],
  ["South Sydney", "South Sydney Rabbitohs"],
  ["Roosters", "Sydney Roosters"],
  ["Sydney Roosters", "Sydney Roosters"],
  ["Storm", "Melbourne Storm"],
  ["Panthers", "Penrith Panthers"],
  ["Eels", "Parramatta Eels"],
  ["Sharks", "Cronulla Sharks"],
  ["Cowboys", "North Queensland Cowboys"],
  ["Sea Eagles", "Manly Sea Eagles"],
  ["Knights", "Newcastle Knights"],
  ["Dragons", "St George Illawarra Dragons"],
  ["Titans", "Gold Coast Titans"],
  ["Bulldogs", "Canterbury Bulldogs"],
  ["Raiders", "Canberra Raiders"],
  ["Wests Tigers", "Wests Tigers"],
  ["Dolphins", "Dolphins"],
];

for (const [input, expected] of CLUBS) {
  test(`"${input}" still normalises to ${expected}`, () => {
    assert.equal(normalise(input), expected);
  });
}

test("State of Origin sides still normalise", () => {
  assert.equal(normalise("NSW"), "New South Wales Blues");
  assert.equal(normalise("Blues"), "New South Wales Blues");
  assert.equal(normalise("QLD"), "Queensland Maroons");
  assert.equal(normalise("Maroons"), "Queensland Maroons");
});

test("an empty or unknown name is returned trimmed, not invented", () => {
  assert.equal(normalise(""), "");
  assert.equal(normalise("  Some Unknown Club  "), "Some Unknown Club");
});
