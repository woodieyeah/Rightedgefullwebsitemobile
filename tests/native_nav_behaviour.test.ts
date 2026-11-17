/**
 * Bottom-nav behaviour in the native shell.
 *
 * THE PROBLEM
 * The bottom nav offers Matches / Plays / Multi. "Plays" is the `best-bets`
 * hash, which checkHash() treats as PREMIUM. Tapping it natively therefore
 * runs handlePremiumNatively(), which opens the system browser -- so a user
 * exploring the tab bar gets kicked out of the app, every single tap, with an
 * alert each time. That is not a usable free experience.
 *
 * THE RULE
 * Premium stays protected: the native shell must never render premium content.
 * But a nav tap is exploration, not a request to buy, so it must show an
 * in-app explanation of what Plays is and a single deliberate button to open
 * the website -- rather than launching the browser on contact.
 *
 * Multi is NOT premium at the routing level (MultiPage gates its own content
 * on isPremium), so it must open natively and simply show its free view.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isPremiumNavTarget, nativeNavBehaviour } from "../src/app/round-status.ts";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("best-bets is recognised as the premium nav target", () => {
  assert.equal(isPremiumNavTarget("best-bets"), true);
  assert.equal(isPremiumNavTarget("matches"), false);
  assert.equal(isPremiumNavTarget("multi"), false);
});

test("a native tap on Plays shows an in-app notice, not an instant browser launch", () => {
  const b = nativeNavBehaviour("best-bets", { isNative: true, isPremium: false });
  assert.equal(b.action, "show-premium-notice");
  assert.equal(b.opensBrowserImmediately, false, "the browser must not open on a nav tap");
  assert.equal(b.rendersPremiumContent, false, "premium content must never render natively");
});

test("Matches and Multi open normally in the native shell", () => {
  for (const id of ["matches", "multi"]) {
    const b = nativeNavBehaviour(id, { isNative: true, isPremium: false });
    assert.equal(b.action, "navigate", `${id} should open natively`);
    assert.equal(b.rendersPremiumContent, false);
  }
});

test("a paid user on the website still reaches Plays normally", () => {
  const b = nativeNavBehaviour("best-bets", { isNative: false, isPremium: true });
  assert.equal(b.action, "navigate");
  assert.equal(b.rendersPremiumContent, true);
});

test("an unpaid website user gets the existing paywall, unchanged", () => {
  const b = nativeNavBehaviour("best-bets", { isNative: false, isPremium: false });
  assert.equal(b.action, "paywall");
  assert.equal(b.rendersPremiumContent, false);
});

test("native premium never renders premium content even if a tier is claimed", () => {
  // Defence in depth: the shell has no verified session, so a premium claim
  // originating client-side must not unlock content.
  const b = nativeNavBehaviour("best-bets", { isNative: true, isPremium: true });
  assert.equal(b.rendersPremiumContent, false);
  assert.equal(b.action, "show-premium-notice");
});

test("the nav routes through the native-aware handler", () => {
  const i = app.indexOf("const handlePageChange =");
  assert.ok(i !== -1, "handlePageChange not found");
  const fn = app.slice(i, i + 900);
  assert.match(
    fn,
    /isPremiumNavTarget|isNativeShell\(\)/,
    "handlePageChange sets the premium hash directly, which kicks the user to the browser",
  );
});
