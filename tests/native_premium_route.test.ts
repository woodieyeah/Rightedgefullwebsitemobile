/**
 * Native Premium navigation must use a real website route and must never open
 * an in-app payment or login modal.
 *
 * TWO DEFECTS
 *
 * 1. The native Premium button opened `/?premium=1`. Nothing in the codebase
 *    reads a `premium` query parameter -- the only occurrence was the one I
 *    wrote. The website opens Premium via the `#best-bets` hash, which
 *    checkHash() handles through its premiumHashes list. `/?premium=1` serves
 *    HTTP 200 because index.html is returned for any path, so a status check
 *    does NOT prove the route works; the parameter was simply ignored and the
 *    user landed on the plain home page.
 *
 * 2. AppDashboard's onRequestAccess and the direct premium-hash path both call
 *    setShowPaymentGate(true), opening a Stripe checkout modal inside the
 *    native shell. That modal depends on the session cookie the WKWebView
 *    cannot hold, so it renders a dead end.
 *
 * All three premium entry points funnel through one helper,
 * handlePremiumNatively(), which returns true when it has taken over. Testing
 * the helper plus "every caller checks it before its gate" is what actually
 * guarantees no dead modal, rather than asserting on inlined code.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { websiteUrl, PREMIUM_WEBSITE_PATH } from "../src/app/native-shell.ts";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("the premium path is the real website route, not an invented param", () => {
  // #best-bets is what checkHash() treats as premium.
  assert.equal(PREMIUM_WEBSITE_PATH, "/#best-bets");
  assert.equal(websiteUrl(PREMIUM_WEBSITE_PATH), "https://rightedge.com.au/#best-bets");
});

test("the invented premium query parameter is gone", () => {
  assert.doesNotMatch(
    app,
    /premium=1/,
    "?premium=1 is not handled anywhere in the app",
  );
});

test("the single native premium helper opens the verified route with the notice", () => {
  const i = app.indexOf("const handlePremiumNatively =");
  assert.ok(i !== -1, "handlePremiumNatively was not found");
  const fn = app.slice(i, i + 1200);
  assert.match(fn, /if \(!isNativeShell\(\)\) return false;/, "no web short-circuit");
  assert.match(fn, /openExternal\(websiteUrl\(PREMIUM_WEBSITE_PATH\)\)/, "wrong route");
  assert.match(fn, /NATIVE_PREMIUM_NOTICE/, "no 'does not sign in this app' notice");
  assert.match(fn, /return true;/, "callers cannot tell it handled the action");
});

test("requestPremiumAccess defers to the helper before anything else", () => {
  const i = app.indexOf("const requestPremiumAccess =");
  const fn = app.slice(i, i + 1400);
  assert.match(fn, /if \(handlePremiumNatively\(source\)\) return;/);
  // The handoff must precede the hash/gate logic.
  assert.ok(
    fn.indexOf("handlePremiumNatively") < fn.indexOf("targetHash"),
    "the native handoff must come before the in-app premium flow",
  );
});

test("AppDashboard premium actions hand off before the payment gate", () => {
  const i = app.indexOf('onRequestAccess={(targetHash = "best-bets") => {');
  assert.ok(i !== -1, "the AppDashboard onRequestAccess wiring was not found");
  const handler = app.slice(i, i + 2600);
  const nativeAt = handler.indexOf("handlePremiumNatively");
  const gateAt = handler.indexOf("setShowPaymentGate(true)");
  assert.ok(nativeAt !== -1, "no native handoff in the AppDashboard premium handler");
  assert.ok(
    gateAt === -1 || nativeAt < gateAt,
    "the native handoff must come BEFORE setShowPaymentGate, or the modal still opens",
  );
});

test("a direct premium hash hands off and lands on a usable screen", () => {
  const i = app.indexOf("if (premiumHashes.includes(hash))");
  const branch = app.slice(i, i + 2600);
  const nativeAt = branch.indexOf("handlePremiumNatively");
  const gateAt = branch.indexOf("setShowPaymentGate(true)");
  assert.ok(nativeAt !== -1, "a direct #best-bets hash still opens the in-app paywall");
  assert.ok(nativeAt < gateAt, "the native branch must precede the payment gate");
  // It must not strand the app on a blank premium screen.
  const nativeBlock = branch.slice(nativeAt, gateAt);
  assert.match(nativeBlock, /#matches/, "the native branch does not return to a usable screen");
  assert.match(nativeBlock, /setShowPaymentGate\(false\)/);
});

test("every setShowPaymentGate(true) is guarded by the native handoff", () => {
  // Belt and braces: no in-app payment modal may open in the shell.
  const occurrences = [...app.matchAll(/setShowPaymentGate\(true\)/g)];
  assert.ok(occurrences.length > 0, "no payment gate call sites found at all");
  for (const m of occurrences) {
    const before = app.slice(Math.max(0, m.index! - 3000), m.index!);
    assert.match(
      before,
      /handlePremiumNatively/,
      "a setShowPaymentGate(true) has no native handoff above it",
    );
  }
});

test("the helper is the only place that opens the premium website", () => {
  // One funnel means one place to audit, and no caller can forget the notice.
  const handoffs = [...app.matchAll(/openExternal\(websiteUrl\(PREMIUM_WEBSITE_PATH\)\)/g)];
  assert.equal(handoffs.length, 1, "premium handoff is duplicated; keep a single funnel");
});
