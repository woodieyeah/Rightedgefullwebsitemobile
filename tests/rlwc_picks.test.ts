import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSelection,
  picksByFixture,
  selectCorePlay,
  selectSgm,
  selectTryScorers,
  type PublicPick,
} from "../src/app/rlwc/picks.ts";

const FIXTURE = "eda89772-662c-41d0-af09-cf1ff42912ca";

const base = {
  fixture_id: FIXTURE,
  match_key: "australia__newzealand",
  competition: "rlwc",
  point: null,
  model_probability: 0.5,
  result_status: "pending" as const,
  profit_units: null,
  published_at: "2026-10-15T00:00:00Z",
  legs: [] as never[],
};

/** The opener's real published card. */
const opener: PublicPick[] = [
  { ...base, id: "1", market: "h2h", selection: "Australia", entry_odds: 1.65, entry_bookmaker: "Betr", model_probability: 0.5808 },
  {
    ...base, id: "2", market: "sgm", selection: "Australia + Tom Trbojevic anytime try",
    entry_odds: 2.80, entry_bookmaker: "Betr", model_probability: 0.357,
    legs: [
      { selection: "Australia", market: "h2h", odds: 1.65, result: "pending" },
      { selection: "Tom Trbojevic", market: "anytime_try", odds: 2.10, result: "pending" },
    ] as any,
  },
  { ...base, id: "3", market: "anytime_try", selection: "Dane Gagai", entry_odds: 4.00, entry_bookmaker: "TAB", model_probability: 0.218 },
  { ...base, id: "4", market: "anytime_try", selection: "Cameron Munster", entry_odds: 5.00, entry_bookmaker: "TAB", model_probability: 0.221 },
  { ...base, id: "5", market: "anytime_try", selection: "Tom Dearden", entry_odds: 6.00, entry_bookmaker: "TAB", model_probability: 0.192 },
];

// ---------------------------------------------------------------------------
// Core play selection
// ---------------------------------------------------------------------------

test("the head-to-head is the headline play", () => {
  const core = selectCorePlay(opener)!;
  assert.equal(core.selection, "Australia");
  assert.equal(core.entry_odds, 1.65);
});

test("a try scorer is never the headline play", () => {
  const tryOnly = opener.filter((p) => p.market === "anytime_try");
  assert.equal(selectCorePlay(tryOnly), null);
});

test("a multi never headlines as the core play", () => {
  // Superseded: this previously asserted that a multi could headline when no
  // match play existed. It is a different product with its own section and
  // tracker, and England v Tonga was published without a core play on
  // purpose — surfacing its 20% three-leg multi as the headline misrepresents
  // the card.
  const sgmOnly = opener.filter((p) => p.market === "sgm");
  assert.equal(selectCorePlay(sgmOnly), null);
});

test("no picks yields no headline", () => {
  assert.equal(selectCorePlay([]), null);
});

// ---------------------------------------------------------------------------
// SGM
// ---------------------------------------------------------------------------

test("the multi is found with both legs intact", () => {
  const sgm = selectSgm(opener)!;
  assert.equal(sgm.entry_odds, 2.80);
  assert.equal(sgm.legs.length, 2);
  assert.equal(sgm.legs[0].selection, "Australia");
  assert.equal(sgm.legs[1].selection, "Tom Trbojevic");
});

test("the multi's price is not the product of its legs", () => {
  // The whole point of reading Betr's correlated price: 1.65 * 2.10 = 3.465.
  const sgm = selectSgm(opener)!;
  const product = sgm.legs.reduce((p, l) => p * l.odds, 1);
  assert.ok(sgm.entry_odds < product, `${sgm.entry_odds} must be below ${product}`);
});

test("a one-legged multi is not treated as a multi", () => {
  const broken = [{ ...opener[1], legs: [opener[1].legs[0]] as any }];
  assert.equal(selectSgm(broken), null);
});

// ---------------------------------------------------------------------------
// Try scorers
// ---------------------------------------------------------------------------

test("try scorers are returned shortest price first", () => {
  const scorers = selectTryScorers(opener);
  assert.deepEqual(scorers.map((p) => p.selection), ["Dane Gagai", "Cameron Munster", "Tom Dearden"]);
});

test("the head-to-head and multi are excluded from the try-scorer strip", () => {
  for (const pick of selectTryScorers(opener)) {
    assert.notEqual(pick.market, "h2h");
    assert.notEqual(pick.market, "sgm");
  }
});

// ---------------------------------------------------------------------------
// Grouping and display
// ---------------------------------------------------------------------------

test("picks group by fixture", () => {
  const other: PublicPick = { ...base, id: "9", fixture_id: "other", market: "h2h", selection: "Samoa", entry_odds: 1.01, entry_bookmaker: "TAB" };
  const grouped = picksByFixture([...opener, other]);
  assert.equal(grouped.get(FIXTURE)!.length, 5);
  assert.equal(grouped.get("other")!.length, 1);
});

test("a selection with a line renders the line", () => {
  assert.equal(
    describeSelection({ ...base, id: "x", market: "line", selection: "Australia", point: -3.5, entry_odds: 1.85, entry_bookmaker: "TAB" }),
    "Australia -3.5",
  );
  assert.equal(
    describeSelection({ ...base, id: "y", market: "line", selection: "New Zealand", point: 3.5, entry_odds: 1.95, entry_bookmaker: "TAB" }),
    "New Zealand +3.5",
  );
});

test("a pick-em line renders zero rather than being dropped", () => {
  assert.equal(
    describeSelection({ ...base, id: "z", market: "line", selection: "Australia", point: 0, entry_odds: 1.9, entry_bookmaker: "TAB" }),
    "Australia 0",
  );
});

test("a selection with no line renders plainly", () => {
  assert.equal(describeSelection(opener[0]), "Australia");
});

// ---------------------------------------------------------------------------
// A multi is not a core play
//
// selectCorePlay fell through to "sgm" when a fixture had no match play, so
// England v Tonga — deliberately published WITHOUT a core play, because the
// line rated the wrong side of its price — would have surfaced its 20%
// three-leg multi as the headline play.
// ---------------------------------------------------------------------------

const sgmOnly: PublicPick = {
  id: "s1", fixture_id: "f9", match_key: "england__tonga", competition: "rlwc",
  market: "sgm", selection: "Tonga + two scorers", point: null,
  entry_odds: 4.9, entry_bookmaker: "betr",
  model_probability: null, market_probability: 0.204,
  result_status: "pending", profit_units: null,
  published_at: "2026-10-17T00:00:00Z",
  legs: [
    { leg_index: 0, market: "h2h", selection: "Tonga", point: null, leg_odds: 1.67 },
    { leg_index: 1, market: "anytime_try", selection: "Jojo Fifita", point: null, leg_odds: 2.25 },
  ] as never,
};

test("a fixture with only a multi has no core play", () => {
  assert.equal(selectCorePlay([sgmOnly]), null);
});

test("the multi is still available to the multi section", () => {
  assert.equal(selectSgm([sgmOnly])?.id, "s1");
});

test("a real match play is still chosen when present", () => {
  const line: PublicPick = {
    ...sgmOnly, id: "l1", market: "line", selection: "Tonga", point: -2.5,
    entry_odds: 1.9, legs: [] as never,
  };
  assert.equal(selectCorePlay([sgmOnly, line])?.id, "l1");
});
