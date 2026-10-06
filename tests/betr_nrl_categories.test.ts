import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Exercise the production importer without starting the Deno HTTP server.
// Only the API and odds formatting boundary are stubbed; category selection,
// event collection, deduplication and fetch scheduling run unchanged.
const source = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url), "utf8",
);
const start = source.indexOf("async function fetchBlueBetNrlOddsRaw(");
const end = source.indexOf("async function fetchBlueBetCricketOddsRaw(", start);
assert.ok(start >= 0 && end > start, "production NRL importer must be found");
const importer = stripTypeScriptTypes(source.slice(start, end));

const match = (id: string) => ({ MasterEventId: id, MasterEventName: "Penrith Panthers v Cronulla Sharks" });
const category = (name: string, id: string) => ({ CategoryName: name, MasterEvents: [match(id)] });

async function runImporter(categories: any[], options?: { includeOrigin?: boolean }) {
  const requestedIds: string[] = [];
  const fetchBlueBetJson = async (path: string) => {
    if (path.startsWith("/MasterCategory?")) {
      return { MasterCategories: [
        { MasterCategoryName: "NRL", Categories: categories },
        // An exact category name under the wrong parent must still be excluded.
        { MasterCategoryName: "NRLW", Categories: [category("NRL Finals", "wrong-parent")] },
      ] };
    }
    const id = new URL(path, "https://fixture.invalid").searchParams.get("MasterEventId")!;
    requestedIds.push(id);
    return { id, bookmakers: [{ key: "betr" }] };
  };
  const fetchOdds = new Function(
    "fetchBlueBetJson", "asBlueBetArray", "buildBlueBetEventOdds",
    `${importer}\nreturn fetchBlueBetNrlOddsRaw;`,
  )(fetchBlueBetJson, (value: any) => Array.isArray(value) ? value : [], (payload: any) => payload);
  const odds = await fetchOdds(options);
  return { requestedIds, ids: odds.map((event: any) => event.id) };
}

test("Betr imports exact NRL Finals alongside regular matches, not specials, futures or NRLW", async () => {
  const categories = [
    category("NRL", "regular"),
    category("NRL Matches", "matches"),
    category("NRL Finals", "finals"),
    category("nRl FiNaLs", "mixed-case-finals"),
    category("NRL Specials", "specials"),
    category("NRL Futures", "futures"),
    category("NRL Finals Specials", "finals-specials"),
    category("NRL Finals Futures", "finals-futures"),
    category("NRLW", "nrlw"),
    category("NRLW Finals", "nrlw-finals"),
    category("NRL Grand Final", "unapproved-category"),
  ];
  const expected = ["regular", "matches", "finals", "mixed-case-finals"];
  const result = await runImporter(categories, { includeOrigin: false });
  assert.deepEqual(result.requestedIds, expected);
  assert.deepEqual(result.ids, expected);
});

test("Betr preserves optional State of Origin inclusion while admitting finals", async () => {
  const categories = [category("NRL Finals", "finals"), category("State of Origin", "origin")];
  assert.deepEqual((await runImporter(categories)).ids, ["finals", "origin"]);
  assert.deepEqual((await runImporter(categories, { includeOrigin: false })).ids, ["finals"]);
});

test("Betr deduplicates finals matches and ignores non-match events", async () => {
  const categories = [category("NRL Matches", "same-game"), {
    Category: "NRL Finals",
    MasterEvents: [match("same-game"), match("finals-only"), {
      MasterEventId: "outright", MasterEventName: "NRL Premiership Winner",
    }],
  }];
  const result = await runImporter(categories);
  assert.deepEqual(result.requestedIds, ["same-game", "finals-only"]);
  assert.deepEqual(result.ids, ["same-game", "finals-only"]);
});
