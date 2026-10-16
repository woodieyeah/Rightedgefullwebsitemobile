import assert from "node:assert/strict";
import test from "node:test";
import {
  findHeadshot,
  headshotIndex,
  normalisePlayerName,
  parseHeadshots,
  resolveHeadshotUrl,
} from "../src/model/player-headshots.ts";

/**
 * Headshots come from NRL.com match centre pages. The feed's names do not
 * match the bookmakers' exactly — TAB writes "Brian Too", Betr and the feed
 * write "Brian To'o" — so matching must be punctuation-insensitive.
 *
 * A missing or ambiguous match must yield null so the card falls back to the
 * existing avatar. Showing the wrong player's face beside a bet is worse than
 * showing none.
 */

const SAMPLE =
  '{"firstName":"Brian","lastName":"To&#39;o","position":"Winger",' +
  '"headImage":"/remote.axd?http://rugbyimages.statsperform.com/Headshots/Too.png?center=0.3"},' +
  '{"firstName":"Francis","lastName":"Manuleleua","position":"Second Row",' +
  '"headImage":"/remote.axd?http://rugbyimages.statsperform.com/Headshots/Manuleleua.png"}';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("players and positions are extracted from the embedded squad list", () => {
  const players = parseHeadshots(SAMPLE);
  assert.equal(players.length, 2);
  assert.equal(players[0].name, "Brian To'o");
  assert.equal(players[0].position, "Winger");
  assert.equal(players[1].name, "Francis Manuleleua");
});

test("HTML entities in names are decoded", () => {
  // The page escapes its JSON, so "To&#39;o" must become "To'o".
  assert.equal(parseHeadshots(SAMPLE)[0].name, "Brian To'o");
});

test("a duplicate player is listed once", () => {
  const players = parseHeadshots(SAMPLE + "," + SAMPLE);
  assert.equal(players.length, 2);
});

test("empty or junk input yields no players rather than throwing", () => {
  assert.deepEqual(parseHeadshots(""), []);
  assert.deepEqual(parseHeadshots("<html>no squad here</html>"), []);
});

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

test("the feed's proxy wrapper is unwrapped to the real URL", () => {
  // /remote.axd? 404s when called directly, so the wrapped URL must be used.
  const url = resolveHeadshotUrl("/remote.axd?http://images.example.com/a.png");
  assert.equal(url, "https://images.example.com/a.png");
});

test("http is upgraded to https", () => {
  // The site is served over HTTPS; a browser blocks mixed content outright.
  assert.equal(resolveHeadshotUrl("http://images.example.com/a.png"), "https://images.example.com/a.png");
});

test("a protocol-relative URL is made https", () => {
  assert.equal(resolveHeadshotUrl("//images.example.com/a.png"), "https://images.example.com/a.png");
});

test("an already-https URL is left alone", () => {
  assert.equal(resolveHeadshotUrl("https://images.example.com/a.png"), "https://images.example.com/a.png");
});

test("a site-relative path is resolved against nrl.com", () => {
  assert.equal(resolveHeadshotUrl("/images/a.png"), "https://www.nrl.com/images/a.png");
});

test("an unusable reference yields null", () => {
  assert.equal(resolveHeadshotUrl(""), null);
  assert.equal(resolveHeadshotUrl("   "), null);
});

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------

test("punctuation differences between books and the feed still match", () => {
  // TAB: "Brian Too". Betr and the feed: "Brian To'o".
  assert.equal(normalisePlayerName("Brian To'o"), normalisePlayerName("Brian Too"));
});

test("accents are stripped so Fa'alogo matches Faalogo", () => {
  assert.equal(normalisePlayerName("Sualauvi Fa'alogo"), normalisePlayerName("Sualauvi Faalogo"));
});

test("a trailing team code is ignored", () => {
  assert.equal(normalisePlayerName("Brian Too (Sam)"), "brian too");
});

test("case and extra spacing do not matter", () => {
  assert.equal(normalisePlayerName("  BRIAN   TOO  "), "brian too");
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const index = headshotIndex(parseHeadshots(SAMPLE));

test("a player is found by exact name", () => {
  assert.ok(findHeadshot(index, "Francis Manuleleua"));
});

test("a bookmaker's spelling finds the feed's player", () => {
  assert.ok(findHeadshot(index, "Brian Too"), "TAB spelling must match");
});

test("an unknown player yields null, not a wrong face", () => {
  assert.equal(findHeadshot(index, "Someone Else"), null);
});

test("an ambiguous surname yields null rather than guessing", () => {
  // Two players sharing a surname must never resolve to one of them.
  const twins = headshotIndex([
    { name: "Jarome Luai", position: "Half", url: "https://x/a.png" },
    { name: "Brandon Luai", position: "Wing", url: "https://x/b.png" },
  ]);
  assert.equal(findHeadshot(twins, "Luai"), null);
  assert.equal(findHeadshot(twins, "Someone Luai"), null);
});

test("an unambiguous surname resolves", () => {
  assert.ok(findHeadshot(index, "Manuleleua"));
});

test("a very short surname is not surname-matched", () => {
  const short = headshotIndex([{ name: "Billy Li", position: "Wing", url: "https://x/a.png" }]);
  assert.equal(findHeadshot(short, "Someone Li"), null);
});

test("empty input yields null", () => {
  assert.equal(findHeadshot(index, ""), null);
});

// ---------------------------------------------------------------------------
// Market suffixes on leg labels
// ---------------------------------------------------------------------------

test("a market suffix on a leg label is stripped before matching", () => {
  // SGM legs are labelled "Brian To'o 2+ tries", not just the player name.
  assert.ok(findHeadshot(index, "Brian To'o 2+ tries"), "must match the player");
});

test("other market suffixes are stripped too", () => {
  assert.ok(findHeadshot(index, "Francis Manuleleua anytime try"));
  assert.ok(findHeadshot(index, "Brian To'o 3+ tries"));
  assert.ok(findHeadshot(index, "Francis Manuleleua first tryscorer"));
});

// ---------------------------------------------------------------------------
// Abbreviated first names
//
// TAB shortens a long name to fit its market: "Dallin Watene-Zelezniak" is
// listed as "Dallin W-Zelezniak (Ton)". The surname fragment after the hyphen
// is still unique, so the player is identifiable — but only when the match is
// unambiguous.
// ---------------------------------------------------------------------------

test("an abbreviated hyphenated surname still resolves", () => {
  const idx = {
    "dallin watenezelezniak": "https://img/dwz.png",
    "dominic young": "https://img/young.png",
  };
  assert.equal(findHeadshot(idx, "Dallin W-Zelezniak (Ton)"), "https://img/dwz.png");
});

test("an abbreviation matching two players resolves to neither", () => {
  const idx = {
    "dallin watenezelezniak": "https://img/a.png",
    "darren wilsonzelezniak": "https://img/b.png",
  };
  assert.equal(findHeadshot(idx, "D W-Zelezniak"), null);
});

test("stripping a suffix never invents a match", () => {
  // The suffix stripper must not reduce an unknown name to a known one.
  assert.equal(findHeadshot(index, "Nobody Here 2+ tries"), null);
});
