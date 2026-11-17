/**
 * Website-only account controls must not appear in the native shell.
 *
 * MANAGE SUBSCRIPTION calls /create-customer-portal, which since the identity
 * hotfix returns 403 unless the session is identityVerified -- a state the
 * native shell cannot reach, because the session lives in an HttpOnly cookie a
 * capacitor://localhost WKWebView cannot hold. Tapping it natively can only
 * produce an error.
 *
 * RESET ACCESS clears the local auth state to re-trigger the email gate. In
 * the shell there is no gate to re-trigger (public content is reached without
 * one), so the control is meaningless and only risks confusing the user.
 *
 * Neither may change on the website: a paid subscriber must still manage and
 * cancel their subscription exactly as before.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { showsWebsiteOnlyAccountControls } from "../src/app/round-status.ts";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("account controls are hidden natively, shown on the web", () => {
  assert.equal(showsWebsiteOnlyAccountControls({ isNative: false }), true);
  assert.equal(showsWebsiteOnlyAccountControls({ isNative: true }), false);
});

test("Manage Subscription is gated on the shell check", () => {
  // Only count real renders, not the explanatory comment above the panel.
  const hits = [...app.matchAll(/^\s+Manage Subscription$/gm)];
  assert.ok(hits.length >= 2, `expected >= 2 Manage Subscription renders, got ${hits.length}`);
  for (const m of hits) {
    const before = app.slice(Math.max(0, m.index! - 2200), m.index!);
    assert.match(
      before,
      /showsWebsiteOnlyAccountControls\(|webAccountControls/,
      "a Manage Subscription control is not gated for the native shell",
    );
  }
});

test("Reset Access is gated on the shell check", () => {
  const i = app.indexOf("[RESET ACCESS]");
  assert.ok(i !== -1, "RESET ACCESS control not found");
  const before = app.slice(Math.max(0, i - 2200), i);
  assert.match(
    before,
    /showsWebsiteOnlyAccountControls\(|webAccountControls/,
    "Reset Access is still rendered in the native shell",
  );
});

test("the website behaviour is unchanged", () => {
  // The helper must be a pure visibility gate -- it must not touch the portal
  // call, the auth state, or anything the website relies on.
  const src = readFileSync(new URL("../src/app/round-status.ts", import.meta.url), "utf8");
  const i = src.indexOf("export function showsWebsiteOnlyAccountControls");
  const fn = src.slice(i, i + 400);
  assert.doesNotMatch(fn, /fetch|credentials|localStorage|setPaidAccess/);
});

test("openCustomerPortal still sends credentials on the web", () => {
  // Hiding the button must not have weakened the call itself.
  const i = app.indexOf("const openCustomerPortal =");
  const fn = app.slice(i, i + 1400);
  assert.match(fn, /credentials: 'include'/, "the portal call lost its cookie");
  assert.match(fn, /create-customer-portal/);
});
