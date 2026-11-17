/**
 * Cross-version compatibility between the website bundle and the edge function.
 *
 * WHY THIS MATTERS
 * The two deploy separately, and Vercel can be rolled back independently. The
 * previously deployed bundle computes:
 *
 *   isActiveSubscriber = !!(instantAccess || activeSubscriber ||
 *                           active_subscriber || subscribed || active)
 *
 * and, when that is true, calls onSessionRefresh() expecting a premium cookie.
 * The patched backend deliberately does not set one until a code is redeemed.
 * So if /verify-email answered `active: true`, every stale or cached client
 * would hit "could not restore the secure session" with no way forward —
 * which is exactly what a frontend-only rollback would cause.
 *
 * These tests pin both halves of the matrix:
 *   new bundle + old backend  -> must still work (forward compatible)
 *   old bundle + new backend  -> must degrade to a readable instruction
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

function routeBody(path: string): string {
  const marker = `app.post("${path}"`;
  const start = server.indexOf(marker);
  assert.ok(start !== -1, `route ${path} not found`);
  const after = server.slice(start + marker.length);
  const next = after.search(/\napp\.(post|get|put|delete)\(/);
  return next === -1 ? after : after.slice(0, next);
}

/** The exact truthiness test performed by the previously deployed bundle. */
const LEGACY_UNLOCK_KEYS = [
  "instantAccess",
  "activeSubscriber",
  "active_subscriber",
  "subscribed",
  "active",
];

test("/verify-email never sets a legacy unlock flag truthy", () => {
  // Any of these being true makes an OLD client believe it is already
  // premium, after which it demands a cookie that no longer exists.
  const body = routeBody("/verify-email");
  const success = body.slice(body.indexOf("verificationRequired: true") - 400);

  for (const key of LEGACY_UNLOCK_KEYS) {
    assert.doesNotMatch(
      success,
      new RegExp(`${key}:\\s*true`),
      `/verify-email returns ${key}: true, which dead-ends the previously deployed bundle`,
    );
  }
  // active must be explicitly false, not merely absent, so the legacy
  // expression evaluates false rather than undefined-but-truthy elsewhere.
  assert.match(success, /active:\s*false/);
});

test("the no-subscription answer is indistinguishable from the code answer", () => {
  // Both branches return active:false, so the endpoint cannot be used to
  // enumerate which addresses hold a subscription.
  const body = routeBody("/verify-email");
  const matches = [...body.matchAll(/active:\s*(true|false)/g)].map((m) => m[1]);
  assert.ok(matches.length >= 2, "expected both branches to answer explicitly");
  assert.ok(
    matches.every((v) => v === "false"),
    `/verify-email leaks subscription status via the active field: ${matches.join(", ")}`,
  );
});

test("/create-checkout-session gives a stale client a readable instruction", () => {
  // The old bundle looks for `url`; finding none it renders `error`. Without
  // an error string it shows "Could not start checkout", which is wrong and
  // unactionable for someone who already pays.
  const body = routeBody("/create-checkout-session");
  const start = body.indexOf("alreadySubscribed: true");
  assert.ok(start !== -1, "alreadySubscribed branch missing");
  const branch = body.slice(start - 200, start + 700);

  assert.match(branch, /error:\s*["'`]/, "no error string for legacy clients");
  assert.match(branch, /code/i, "the instruction does not mention a code");
  assert.doesNotMatch(branch, /url:/, "a stale client would redirect to a non-existent URL");
});

test("the current client reads the new signals before the legacy ones", () => {
  // Order matters: alreadySubscribed carries a compatibility `error` field,
  // so if the client checked `error` first it would show a failure for a
  // perfectly successful code dispatch.
  const already = app.indexOf("checkoutData.alreadySubscribed");
  const url = app.indexOf("checkoutData.url");
  const error = app.indexOf("checkoutData.error");
  assert.ok(already !== -1 && url !== -1 && error !== -1);
  assert.ok(already < url, "alreadySubscribed must be checked before url");
  assert.ok(already < error, "alreadySubscribed must be checked before error");

  const verification = app.indexOf("verifyData.verificationRequired");
  const processing = app.indexOf('setStep("processing")');
  assert.ok(verification !== -1 && processing !== -1);
  assert.ok(verification < processing, "verificationRequired must be checked first");
});

test("the current client tolerates the OLD backend (forward compatible)", () => {
  // During the gap between deploys, and for any cached bundle, the new client
  // may talk to the old function. It must fall through to checkout rather
  // than requiring fields the old backend never sends.
  const at = app.indexOf("verifyData.verificationRequired");
  // Include the guard that PRECEDES the field reference.
  const block = app.slice(at - 60, at + 400);
  // Guarded by `verifyRes.ok && ...`, so a missing field simply falls through.
  assert.match(block, /verifyRes\.ok\s*&&\s*verifyData\.verificationRequired/);

  const checkoutAt = app.indexOf("checkoutData.alreadySubscribed");
  const checkoutBlock = app.slice(checkoutAt - 60, checkoutAt + 400);
  assert.match(checkoutBlock, /checkoutRes\.ok\s*&&\s*checkoutData\.alreadySubscribed/);
});

test("no rollback target can restore an email-only premium grant", () => {
  // The whole point: whatever is rolled back, the backend must never again
  // mint premium from an unproven email.
  const verify = routeBody("/verify-email");
  assert.doesNotMatch(verify, /createAuthSession/);
  assert.doesNotMatch(verify, /writeAuthSessionCookie/);

  const checkout = routeBody("/create-checkout-session");
  assert.doesNotMatch(checkout, /createAuthSession/);
  assert.doesNotMatch(checkout, /createInstantAccessUrl/);

  // And the redemption half stays gone.
  const code = server.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /kv\.(set|get|del)\(\s*`instant_access:/);
});
