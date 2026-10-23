/**
 * RLWC content must survive a failure in the NRL sheet pipeline.
 *
 * buildDashboardData runs before the RLWC merge and OUTSIDE its try/catch. The
 * NRL season is finished and the sheets are degraded — 34 of 35 prediction
 * rows are now blank and one sheet times out entirely — so if any parser
 * throws on that shape, the outer catch swallows it, setData never runs, and
 * every page renders its empty state. Paying subscribers then see "No play
 * clears the conservative Core Play threshold" while ten published picks sit
 * healthy in Supabase.
 *
 * RLWC is the live product. It must never be hostage to the NRL sheet.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("buildDashboardData is wrapped so a sheet parse failure cannot blank the app", () => {
  const call = APP.indexOf("dashboardData = buildDashboardData(");
  assert.ok(call > 0, "buildDashboardData call not found");

  const before = APP.slice(Math.max(0, call - 800), call);
  assert.match(
    before,
    /try\s*\{[^{}]*$/s,
    "buildDashboardData must be inside its own try block",
  );
});

test("a sheet failure still leaves a usable dashboard object", () => {
  const call = APP.indexOf("dashboardData = buildDashboardData(");
  const after = APP.slice(call, call + 1400);
  assert.match(
    after,
    /catch[\s\S]{0,400}buildDashboardData\(\s*\[\]/,
    "a parse failure must fall back to an empty dashboard, not abort the load",
  );
});

test("setData is always reached, even when the sheet pipeline fails", () => {
  const setData = APP.indexOf("setData(dashboardData);");
  assert.ok(setData > 0, "setData(dashboardData) not found");
  const call = APP.indexOf("dashboardData = buildDashboardData(");
  assert.ok(setData > call, "setData must follow the dashboard build");
});
