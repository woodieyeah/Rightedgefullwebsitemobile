/**
 * Native users must reach the free predictions dashboard, and must NOT reach
 * anything premium or administrative.
 *
 * THE BUG
 * navigateToApp() opened the dashboard only when hasEmailAccess() was true,
 * otherwise it raised the email gate. checkHash() did the same for a direct
 * #matches hash, bouncing the user back to the home page. Neither is
 * satisfiable in the native shell: the session lives in an HttpOnly,
 * SameSite=Lax cookie that a capacitor://localhost WKWebView cannot hold, so
 * an iPhone user tapping "Free Predictions" hit a gate with no way through.
 *
 * WHY OPENING IT IS LEGITIMATE, NOT A BYPASS
 * hasEmailAccess() is `tier === "free" || tier === "premium"` -- it is an
 * email-capture gate, not an authorisation check. The dashboard's own data is a
 * PUBLISHED Google Sheet CSV (/spreadsheets/d/e/<id>/pub?output=csv) which
 * needs no credentials at all. So nothing is being circumvented: the native
 * path reads exactly the public data the website serves to a free visitor.
 *
 * WHAT MUST STILL BE REFUSED
 * Premium entitlement is `tier === "premium"`, derived server-side from Stripe,
 * and admin from a verified admin session. Those gates are untouched, so the
 * native shell can see public predictions and nothing more.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

function region(marker: string, lines = 30): string {
  const i = app.indexOf(marker);
  assert.ok(i !== -1, `marker not found: ${marker}`);
  return app.slice(i, i + lines * 90);
}

test("navigateToApp opens the dashboard in the native shell", () => {
  const fn = region("const navigateToApp =");
  assert.match(
    fn,
    /isNativeShell\(\)/,
    "navigateToApp still requires a browser-cookie session on iOS",
  );
});

test("navigateToApp does not raise the email gate natively", () => {
  const i = app.indexOf("const navigateToApp =");
  const fn = app.slice(i, app.indexOf("const requestCricketAccess", i));
  // The native shell must take the branch that opens the dashboard, and the
  // email gate must remain only on the else path.
  assert.match(fn, /if \(isNativeShell\(\) \|\| hasEmailAccess\(\)\) \{/);
  const thenBranch = fn.slice(fn.indexOf("{", fn.indexOf("isNativeShell()")), fn.indexOf("} else {"));
  assert.match(thenBranch, /setSitePage\("app"\)/);
  assert.doesNotMatch(
    thenBranch,
    /setShowEmailGate\(true\)/,
    "the native branch still opens the unsatisfiable email gate",
  );
});

test("checkHash lets the native shell stay on app hashes", () => {
  const fn = region("const appHashes =", 60);
  assert.match(
    fn,
    /isNativeShell\(\)/,
    "checkHash still bounces native users off #matches",
  );
});

test("premium hashes are NOT opened natively", () => {
  // #best-bets is premium; the native shell must not be handed it.
  const fn = region("const premiumHashes =", 60);
  const premiumBlock = fn.slice(0, fn.indexOf("if (appHashes.includes(hash))"));
  assert.doesNotMatch(
    premiumBlock,
    /isNativeShell\(\)\s*\|\|\s*hasPaidAccess\(\)/,
    "native presence must never stand in for paid access",
  );
});

test("no fake session is minted anywhere for native", () => {
  // Granting a tier locally would be exactly the vulnerability class that was
  // just fixed in the backend.
  assert.doesNotMatch(app, /setPaidAccess\(\s*["'`]native/i);
  assert.doesNotMatch(app, /tier:\s*["']premium["']\s*,?\s*\/\/\s*native/i);
  const nativeLines = app.split("\n").filter((l) => /isNativeShell\(\)/.test(l));
  for (const line of nativeLines) {
    assert.doesNotMatch(
      line,
      /hasPaidAccess|setPaidAccess|isUserAdmin|adminVerified|identityVerified/,
      `native check is entangled with an authorisation check: ${line.trim()}`,
    );
  }
});

test("the admin hash is never reachable via the native branch", () => {
  const fn = region('if (hash === "admin")', 20);
  assert.doesNotMatch(fn, /isNativeShell\(\)/);
});

test("paid and admin gate counts are unchanged", () => {
  // A regression here would mean a premium surface lost its guard.
  const paid = (app.match(/hasPaidAccess\(\)/g) || []).length;
  const admin = (app.match(/isUserAdmin\(\)/g) || []).length;
  assert.ok(paid >= 12, `hasPaidAccess() call sites dropped to ${paid}, expected >= 12`);
  assert.ok(admin >= 6, `isUserAdmin() call sites dropped to ${admin}, expected >= 6`);
});
