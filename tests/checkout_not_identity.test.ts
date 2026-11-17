/**
 * A completed Stripe payment is not proof of email ownership.
 *
 * WHY
 * The checkout email is customer-supplied. Stripe confirms that *someone*
 * paid and typed that address; it does not confirm the payer controls the
 * inbox. So a paid checkout may grant PREMIUM ENTITLEMENT but must never
 * grant the authority to manage Stripe customers attached to that address.
 *
 * Two concrete risks in /confirm-checkout-session:
 *
 * 1. Email substitution. An attacker pays with a victim's address. Stripe
 *    reports payment_status "paid" and customer_details.email = victim, so
 *    the backend would mint a session for the victim's address. If that
 *    session were identity-verified, the attacker could open the VICTIM's
 *    billing portal and cancel their real subscription.
 *
 * 2. Replay. A cs_ id is long-lived and retrievable indefinitely. Anyone
 *    holding it (browser history, a shared URL, a referrer log) could POST it
 *    again and mint a fresh session for that email.
 *
 * The rule enforced here: only a redeemed emailed code or the admin email
 * challenge sets identityVerified. Payment grants tier, never identity.
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
  const start = server.indexOf(marker);
  assert.ok(start !== -1, `route ${path} not found`);
  const after = server.slice(start + marker.length);
  const next = after.search(/\napp\.(post|get|put|delete)\(/);
  return next === -1 ? after : after.slice(0, next);
}

// ---------------------------------------------------------------------------
// Payment grants entitlement, never identity
// ---------------------------------------------------------------------------

test("a paid checkout does NOT mint an identity-verified session", () => {
  const body = routeBody("/confirm-checkout-session");
  const mint = body.match(/createAuthSession\(([\s\S]*?)\);/);
  assert.ok(mint, "no session mint found in /confirm-checkout-session");
  assert.doesNotMatch(
    mint[1],
    /\btrue\b/,
    "a Stripe payment is being treated as proof of email ownership — the checkout email is customer-supplied",
  );
});

test("a paid checkout still grants premium entitlement", () => {
  // The fix must not break paying customers.
  const body = routeBody("/confirm-checkout-session");
  assert.match(body, /createAuthSession\(\s*email\s*,\s*"premium"/);
  assert.match(body, /writeAuthSessionCookie/);
  assert.match(body, /saveVerifiedSubscriber/);
});

test("only an emailed code or the admin challenge sets identityVerified", () => {
  // Enumerate every call that passes a truthy 4th argument and require the
  // proof to be an email-delivered challenge, not a payment.
  const calls = [...server.matchAll(/createAuthSession\(([\s\S]{0,220}?)\);/g)];
  assert.ok(calls.length >= 4, `expected the known mint sites, found ${calls.length}`);

  for (const call of calls) {
    const args = call[1];
    if (/email:\s*string/.test(args)) continue; // the declaration itself
    // A 4th positional argument, or the sameAddress guard, claims verification.
    const claims = /,\s*(true|sameAddress)\s*,?\s*$/.test(args.trim()) || /\btrue\s*,?\s*$/.test(args.trim());
    if (!claims) continue;

    const before = server.slice(Math.max(0, call.index! - 3000), call.index!);
    const emailProof =
      /verifyAndConsumePremiumChallenge/.test(before) ||
      /verifyAndConsumeAdminChallenge/.test(before) ||
      /sameAddress/.test(before);
    assert.ok(
      emailProof,
      `identity claimed without an email-delivered proof near: createAuthSession(${args.trim().slice(0, 70)})`,
    );
    // Explicitly reject payment as the proof.
    const paymentOnly =
      /payment_status/.test(before) &&
      !/verifyAndConsumePremiumChallenge|verifyAndConsumeAdminChallenge|sameAddress/.test(before);
    assert.ok(!paymentOnly, "payment alone was accepted as proof of email ownership");
  }
});

// ---------------------------------------------------------------------------
// Replay containment
// ---------------------------------------------------------------------------

test("a checkout session id is recorded as used", () => {
  const body = routeBody("/confirm-checkout-session");
  assert.match(
    body,
    /checkout_session_used:/,
    "checkout sessions are not tracked, so a cs_ id can be replayed indefinitely",
  );
});

test("a replayed checkout beyond the grace window mints no session", () => {
  const body = routeBody("/confirm-checkout-session");
  // The legitimate case is a page refresh moments after returning from
  // Stripe, so a short grace window must re-mint. Outside it, the caller is
  // told to sign in with a code instead of receiving a session.
  assert.match(body, /CHECKOUT_CONFIRM_GRACE_MS|graceMs/, "no grace window is defined");
  assert.match(
    body,
    /verificationRequired:\s*true/,
    "a stale replay must direct the caller to the emailed-code sign-in",
  );
  // And the mint must be guarded, not unconditional.
  const mintIdx = body.indexOf("createAuthSession");
  const guardIdx = body.search(/withinGrace|replayAllowed/);
  assert.ok(guardIdx !== -1, "the mint is not guarded by a replay check");
  assert.ok(guardIdx < mintIdx, "the replay check must precede the session mint");
});

test("the replay marker is keyed by the Stripe session id", () => {
  const body = routeBody("/confirm-checkout-session");
  assert.match(body, /checkout_session_used:\$\{(session\.id|sessionId)\}/);
});

// ---------------------------------------------------------------------------
// Billing still demands verified identity
// ---------------------------------------------------------------------------

for (const route of ["/create-customer-portal", "/apply-retention-offer"]) {
  test(`${route} is unreachable with a payment-only session`, () => {
    const body = routeBody(route);
    assert.match(body, /identityVerified !== true/);
    assert.match(body, /40[13]/);
  });
}

test("no route treats payment as sufficient for Stripe management", () => {
  const routeRe = /app\.(post|get|put|delete)\("([^"]+)"/g;
  const routes: { path: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(server))) routes.push({ path: m[2], start: m.index });

  const offenders: string[] = [];
  for (let i = 0; i < routes.length; i++) {
    const body = server.slice(routes[i].start, routes[i + 1]?.start ?? server.length);
    // Only routes that MANAGE an existing customer on behalf of a session.
    // Helper functions reached from the Stripe webhook also call
    // subscriptions.update, but the webhook is authenticated by signature and
    // carries no user session, so it is out of scope here.
    if (!/billingPortal\.sessions\.create/.test(body) && !/const session = await getAuthSessionFromRequest|const authSession = await getAuthSessionFromRequest/.test(body)) {
      continue;
    }
    if (!/billingPortal\.sessions\.create|subscriptions\.update\(activeSubscription/.test(body)) continue;
    if (/requireAdmin|isVerifiedAdminSession/.test(body)) continue;
    if (!/identityVerified !== true/.test(body)) offenders.push(routes[i].path);
  }
  assert.deepEqual(offenders, [], `manage Stripe without verified identity: ${offenders.join(", ")}`);
});

test("the Stripe webhook is signature-authenticated, not session-authorised", () => {
  // The webhook legitimately mutates subscriptions without a user session.
  // Its authority comes from the Stripe signature, which must stay enforced.
  const body = routeBody("/stripe-webhook");
  assert.match(body, /constructEventAsync|webhooks\.constructEvent/);
  assert.doesNotMatch(body, /getAuthSessionFromRequest/, "the webhook must not depend on a user session");
});
