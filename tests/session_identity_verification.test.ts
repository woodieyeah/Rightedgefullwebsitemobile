/**
 * A session must not be mistaken for proof of email ownership.
 *
 * CONFIRMED EXPLOIT against the deployed function (version 197):
 *   1. POST /register-free-access {email: "<victim>"}   -> 200 + session cookie
 *   2. POST /create-customer-portal {email: "<victim>"} -> 200 + a
 *      billing.stripe.com URL for the victim's subscription
 *
 * No code, no password, no payment. The attacker can then view invoices,
 * change the card and cancel the subscription. Tested against an account we
 * control; no real customer was touched.
 *
 * Root cause: /register-free-access mints a session for a body-supplied email
 * with no ownership proof, and the billing endpoints treat "the session email
 * equals the requested email" as authorisation. Possession of a session is
 * not evidence of identity when anyone can mint one for any address.
 *
 * Secondary defect: the same endpoint copied `premium` from whatever session
 * the caller presented onto the NEW session for an unrelated email. Premium
 * CONTENT was not exposed because /auth/session re-derives entitlement from
 * Stripe via isPremiumSubscriberActive, but the stored tier was wrong, and
 * any future code trusting session.tier would have granted access.
 *
 * The fix separates VERIFIED identity (an emailed code, a paid Stripe
 * checkout, or the admin challenge) from unverified free registration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);

function routeBody(path: string): string {
  const marker = `app.post("${path}"`;
  const getMarker = `app.get("${path}"`;
  let start = server.indexOf(marker);
  let len = marker.length;
  if (start === -1) {
    start = server.indexOf(getMarker);
    len = getMarker.length;
  }
  assert.ok(start !== -1, `route ${path} not found`);
  const after = server.slice(start + len);
  const next = after.search(/\napp\.(post|get|put|delete)\(/);
  return next === -1 ? after : after.slice(0, next);
}

// ---------------------------------------------------------------------------
// Verified identity must be a distinct, explicit concept
// ---------------------------------------------------------------------------

test("the session record carries an explicit identityVerified flag", () => {
  const start = server.indexOf("type StoredAuthSession");
  const shape = server.slice(start, server.indexOf("};", start) + 2);
  assert.match(
    shape,
    /identityVerified\?:\s*boolean/,
    "StoredAuthSession has no identityVerified field, so verified identity cannot be distinguished from free registration",
  );
});

test("identityVerified defaults to false, never true", () => {
  const fn = server.slice(
    server.indexOf("async function createAuthSession"),
    server.indexOf("async function createAuthSession") + 900,
  );
  assert.match(
    fn,
    /identityVerified\s*=\s*false/,
    "createAuthSession must default identityVerified to false — a new session proves nothing",
  );
});

test("session renewal preserves identityVerified", () => {
  // renewAuthSession spreads the stored session, so the flag must survive a
  // refresh. If it were rebuilt field by field, every refresh would silently
  // downgrade a verified subscriber.
  const fn = server.slice(
    server.indexOf("async function renewAuthSession"),
    server.indexOf("async function renewAuthSession") + 900,
  );
  assert.match(fn, /\.\.\.session/, "renewAuthSession must spread the stored session");
});

// ---------------------------------------------------------------------------
// Only genuine proof may set the flag
// ---------------------------------------------------------------------------

test("only verified paths mint an identity-verified session", () => {
  const mints = [...server.matchAll(/createAuthSession\(([^;]*?)\)/gs)];
  assert.ok(mints.length >= 4, `expected the known mint sites, found ${mints.length}`);

  for (const mint of mints) {
    const args = mint[1];
    // Skip the function declaration itself.
    if (/email:\s*string/.test(args)) continue;
    if (!/true/.test(args)) continue; // not claiming verification

    const before = server.slice(Math.max(0, mint.index! - 3000), mint.index!);
    const proven =
      /verifyAndConsumePremiumChallenge/.test(before) ||
      /verifyAndConsumeAdminChallenge/.test(before) ||
      /payment_status/.test(before) ||
      /checkout\.sessions\.retrieve/.test(before);
    assert.ok(
      proven,
      `a session claims verification without proof near: createAuthSession(${args.trim().slice(0, 60)})`,
    );
  }
});

test("/verify-premium-code mints a verified session", () => {
  const body = routeBody("/verify-premium-code");
  assert.match(body, /verifyAndConsumePremiumChallenge/);
  assert.match(
    body,
    /createAuthSession\([^)]*true/,
    "a redeemed emailed code must produce a verified session",
  );
});

test("/confirm-checkout-session grants premium but NOT verified identity", () => {
  const body = routeBody("/confirm-checkout-session");
  assert.match(body, /payment_status/);
  // Payment proves someone paid using this address, not that they control
  // the inbox — the checkout email is customer-supplied. So premium tier is
  // granted, identity is not. Billing management needs an emailed code.
  assert.match(body, /createAuthSession\(\s*email\s*,\s*"premium"\s*\)/);
  const mint = body.match(/createAuthSession\(([\s\S]*?)\);/);
  assert.ok(mint);
  assert.doesNotMatch(
    mint[1],
    /\btrue\b/,
    "a Stripe payment must not set identityVerified",
  );
});

// ---------------------------------------------------------------------------
// Free registration must stay unverified and must not inherit premium
// ---------------------------------------------------------------------------

test("/register-free-access never mints an unconditionally verified session", () => {
  const body = routeBody("/register-free-access");
  const mint = body.match(/createAuthSession\(([\s\S]*?)\n    \);/);
  assert.ok(mint, "no session mint found");
  // It may pass the `sameAddress` guard, but never a bare `true`.
  assert.doesNotMatch(
    mint[1],
    /^\s*(email|sessionTier|false|,|\s)*\btrue\b/m,
    "/register-free-access claims verified identity unconditionally",
  );
  assert.match(
    mint[1],
    /sameAddress/,
    "verification must be conditioned on the session already belonging to this verified address",
  );
});

test("/register-free-access cannot propagate premium to another email", () => {
  const body = routeBody("/register-free-access");
  // The old line copied the tier from ANY presented session:
  //   const sessionTier = existingSession?.tier === "premium" ? "premium" : "free";
  // The guard must be the sameAddress conjunction, never a bare tier read.
  assert.doesNotMatch(
    body,
    /AuthSessionTier\s*=\s*existingSession\?\.tier === "premium"/,
    "premium still propagates from any presented session",
  );
  // Inheritance must require BOTH the same address and prior verification.
  assert.match(body, /existingSession\?\.email === email/);
  assert.match(body, /existingSession\?\.identityVerified === true/);
  assert.match(body, /sameAddress && existingSession\?\.tier === "premium"/);
});

// ---------------------------------------------------------------------------
// Sensitive operations require verified identity
// ---------------------------------------------------------------------------

for (const route of ["/create-customer-portal", "/apply-retention-offer"]) {
  test(`${route} requires a verified identity, not merely a session`, () => {
    const body = routeBody(route);
    assert.match(body, /getAuthSessionFromRequest/, "no session is read");
    assert.match(
      body,
      /identityVerified/,
      `${route} authorises on session possession alone — a free registration for any email reaches Stripe`,
    );
    // The email comparison alone is NOT sufficient and must not be the only gate.
    assert.match(body, /40[13]/, "no refusal status for an unverified caller");
  });
}

test("no Stripe-touching route authorises on an email match alone", () => {
  const routeRe = /app\.(post|get|put|delete)\("([^"]+)"/g;
  const routes: { path: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(server))) routes.push({ path: m[2], start: m.index });

  const offenders: string[] = [];
  for (let i = 0; i < routes.length; i++) {
    const body = server.slice(routes[i].start, routes[i + 1]?.start ?? server.length);
    const touchesStripe = /stripe\.(customers|subscriptions|billingPortal)/.test(body);
    if (!touchesStripe) continue;
    const adminGated = /requireAdmin|isVerifiedAdminSession/.test(body);
    if (adminGated) continue;
    const readsSession = /getAuthSessionFromRequest/.test(body);
    if (!readsSession) continue; // unauthenticated by design (checkout) — covered elsewhere
    if (!/identityVerified/.test(body)) offenders.push(routes[i].path);
  }

  assert.deepEqual(
    offenders,
    [],
    `these routes reach Stripe with an unverified session: ${offenders.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Existing sessions must fail closed
// ---------------------------------------------------------------------------

test("a session without the flag is treated as unverified", () => {
  // The 1,853 sessions already in production have no identityVerified field.
  // The check must be an explicit === true so undefined fails closed and
  // those sessions cannot reach billing until the owner verifies.
  for (const route of ["/create-customer-portal", "/apply-retention-offer"]) {
    const body = routeBody(route);
    assert.match(
      body,
      /identityVerified\s*!==\s*true|identityVerified\s*===\s*true/,
      `${route} must compare identityVerified strictly against true`,
    );
    assert.doesNotMatch(
      body,
      /!\s*\w*\.identityVerified\s*\)/,
      `${route} uses loose falsiness; be explicit so a malformed value fails closed`,
    );
  }
});
