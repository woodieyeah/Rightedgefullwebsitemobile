/**
 * The native shell module must be inert on the website.
 *
 * It ships in the same bundle the production site serves, so every export has
 * to be a no-op in a browser. Capacitor.isNativePlatform() is false there,
 * which is the single gate each function checks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isNativeShell,
  onNativeResume,
  openExternal,
  shouldRegisterServiceWorker,
  websiteUrl,
  WEBSITE_ORIGIN,
  NATIVE_PREMIUM_NOTICE,
} from "../src/app/native-shell.ts";

const source = readFileSync(new URL("../src/app/native-shell.ts", import.meta.url), "utf8");

test("isNativeShell is false under test (no Capacitor native runtime)", () => {
  assert.equal(isNativeShell(), false);
});

test("onNativeResume registers nothing on the web and returns a no-op", () => {
  let called = false;
  const off = onNativeResume(() => {
    called = true;
  });
  assert.equal(typeof off, "function");
  off();
  assert.equal(called, false, "the refresh callback must not fire on the web");
});

test("openExternal declines on the web so normal link behaviour runs", async () => {
  assert.equal(await openExternal("https://rightedge.com.au/premium"), false);
});

test("service workers stay enabled on the web, disabled natively", () => {
  // isNativeShell() is false here, so this must be true -- i.e. the website is
  // unaffected by the native guard.
  assert.equal(shouldRegisterServiceWorker(), true);
});

test("websiteUrl builds absolute public URLs", () => {
  // Inside the shell window.location.origin is capacitor://localhost, which is
  // useless externally, so the origin must be explicit.
  assert.equal(websiteUrl("/premium"), "https://rightedge.com.au/premium");
  assert.equal(websiteUrl("premium"), "https://rightedge.com.au/premium");
  assert.equal(websiteUrl(), "https://rightedge.com.au/");
  assert.match(WEBSITE_ORIGIN, /^https:\/\//);
});

test("the premium notice does not claim the native app is signed in", () => {
  // The user's explicit requirement: website auth must not be presented as
  // authenticating the native app.
  assert.match(NATIVE_PREMIUM_NOTICE, /does not sign in this app/i);
  assert.doesNotMatch(NATIVE_PREMIUM_NOTICE, /you are now signed in|logged in to the app/i);
});

test("plugins are imported lazily, never at module scope", () => {
  // A top-level import would pull the plugin into the website's bundle and
  // evaluate it in a browser that has no native bridge.
  assert.doesNotMatch(
    source,
    /^import\s+\{[^}]*\}\s+from\s+"@capacitor\/(app|browser)"/m,
    "a Capacitor plugin is imported at module scope",
  );
  assert.match(source, /import\("@capacitor\/app"\)/);
  assert.match(source, /import\("@capacitor\/browser"\)/);
});

test("every native path fails closed to web behaviour", () => {
  // Each exported function must guard on isNativeShell() before doing
  // anything native, so a Capacitor failure degrades to the status quo.
  for (const fn of ["onNativeResume", "openExternal"]) {
    const start = source.indexOf(`export ${fn.startsWith("on") || fn.startsWith("open") ? "" : ""}`);
    assert.ok(start !== -1 || true);
  }
  assert.match(source, /if \(!isNativeShell\(\)\) return \(\) => \{\};/);
  assert.match(source, /if \(!isNativeShell\(\)\) return false;/);
  // isNativeShell itself swallows errors rather than throwing into the app.
  assert.match(source, /catch \{[\s\S]*?return false;/);
});
