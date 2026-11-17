/**
 * Knowing someone's email address must not grant access to their account.
 *
 * Four endpoints were confirmed to act on a body-supplied email with no proof
 * that the caller owns it, against the deployed function:
 *
 *   /verify-email            created a PREMIUM session for any email with an
 *                            active Stripe subscription
 *   /create-checkout-session returned an instant-access link for any existing
 *                            subscriber's email
 *   /create-customer-portal  reached Stripe unauthenticated (404 for an
 *                            unknown email proves no auth gate ran)
 *   /apply-retention-offer   same, and it MODIFIES a live subscription
 *
 * These tests pin the fix at the source level, which is how the admin routes
 * are already covered, plus unit tests for the new ownership-proof module.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PREMIUM_CODE_MAX_ATTEMPTS,
  PREMIUM_CODE_TTL_SECONDS,
  buildPremiumChallengeKey,
  canIssuePremiumChallenge,
  createPremiumChallenge,
  generatePremiumCode,
  getPremiumCodeHash,
  normalizePremiumCode,
} from "../supabase/functions/server/premium_auth.ts";

const SECRET = "test-only-premium-code-hmac-secret-at-least-32-bytes";
const serverSource = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);

/** The body of a route handler, so assertions cannot match a neighbour. */
function routeBody(path: string): string {
  const marker = `app.post("${path}"`;
  const start = serverSource.indexOf(marker);
  assert.ok(start !== -1, `route ${path} not found`);
  const after = serverSource.slice(start + marker.length);
  const nextRoute = after.search(/\napp\.(post|get|put|delete)\(/);
  return nextRoute === -1 ? after : after.slice(0, nextRoute);
}

// ---------------------------------------------------------------------------
// The ownership-proof primitive
// ---------------------------------------------------------------------------

test("a premium code is numeric, fixed length and random", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = generatePremiumCode();
    assert.match(code, /^[0-9]{6}$/);
    codes.add(code);
  }
  // 200 draws from 10^6 should essentially never collide into a tiny set.
  assert.ok(codes.size > 150, `codes are not random enough: ${codes.size} distinct`);
});

test("codes are stored as an HMAC, never in plaintext", async () => {
  const code = "123456";
  const challenge = await createPremiumChallenge("a@b.com", code, SECRET, 0);
  assert.ok(!JSON.stringify(challenge).includes(code), "the plaintext code was stored");
  assert.match(challenge.codeHash, /^[0-9a-f]{64}$/);
});

test("the same code under a different secret yields a different hash", async () => {
  const a = await createPremiumChallenge("a@b.com", "123456", SECRET, 0);
  const b = await createPremiumChallenge("a@b.com", "123456", SECRET + "x", 0);
  assert.notEqual(a.codeHash, b.codeHash);
});

test("a correct code verifies and a wrong code does not", async () => {
  // getPremiumCodeHash is the production primitive: the edge function hashes
  // the submitted code and hands the hash to the atomic SQL comparison.
  const challenge = await createPremiumChallenge("a@b.com", "123456", SECRET, 0);
  assert.equal(await getPremiumCodeHash("a@b.com", "123456", SECRET), challenge.codeHash);
  assert.notEqual(await getPremiumCodeHash("a@b.com", "654321", SECRET), challenge.codeHash);
});

test("a code issued for one email cannot verify another", async () => {
  // The email is inside the signed payload, so the same digits hash
  // differently per account. Moving a challenge record to another address
  // cannot unlock it.
  const challenge = await createPremiumChallenge("victim@example.com", "123456", SECRET, 0);
  const attackerHash = await getPremiumCodeHash("attacker@example.com", "123456", SECRET);
  assert.notEqual(attackerHash, challenge.codeHash);
});

test("expiry and the attempt cap are enforced in SQL, not in the edge function", () => {
  // These were previously enforced by a read-modify-write helper that could
  // not survive concurrency. The helper is deleted; the guarantees now live
  // in the migration and are covered by premium_challenge_concurrency.
  const authSource = readFileSync(
    new URL("../supabase/functions/server/premium_auth.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    authSource,
    /export async function verifyPremiumChallenge/,
    "the non-atomic verifier is back; concurrent requests can share an attempt count",
  );
  assert.equal(PREMIUM_CODE_MAX_ATTEMPTS, 5);
  assert.equal(PREMIUM_CODE_TTL_SECONDS, 600);
});

test("a challenge cannot be reissued without a cooldown", () => {
  const issuedAt = 1_000_000;
  assert.equal(canIssuePremiumChallenge(null, issuedAt), true);
  const challenge = { email: "a@b.com", codeHash: "x", issuedAt, attempts: 0 };
  assert.equal(canIssuePremiumChallenge(challenge, issuedAt + 1_000), false);
  assert.equal(canIssuePremiumChallenge(challenge, issuedAt + 60_000), true);
});

test("code input is normalised but a non-code is rejected", () => {
  assert.equal(normalizePremiumCode(" 123 456 "), "123456");
  assert.equal(normalizePremiumCode("123-456"), "123456");
  assert.equal(normalizePremiumCode("12345"), null);
  assert.equal(normalizePremiumCode("abcdef"), null);
  assert.equal(normalizePremiumCode(""), null);
  assert.equal(normalizePremiumCode(undefined), null);
});

test("challenge keys are namespaced per email", () => {
  assert.equal(buildPremiumChallengeKey("A@B.com"), "premium_challenge:a@b.com");
  assert.notEqual(buildPremiumChallengeKey("a@b.com"), buildPremiumChallengeKey("c@d.com"));
});

// ---------------------------------------------------------------------------
// The routes must require authorisation
// ---------------------------------------------------------------------------

test("/verify-email never mints a premium session from an email alone", () => {
  const body = routeBody("/verify-email");
  // The vulnerability was exactly this pair of calls on an unproven email.
  assert.doesNotMatch(
    body,
    /createAuthSession\(\s*email\s*,\s*["']premium["']/,
    "/verify-email still creates a premium session from the request body",
  );
  assert.doesNotMatch(body, /instantAccess:\s*true/, "/verify-email still advertises instant access");
  // It must instead issue an emailed ownership challenge.
  assert.match(body, /issuePremiumAccessCode/);
});

test("every route that promises to have SENT a code actually sends one", () => {
  // /create-checkout-session once returned verificationRequired WITHOUT
  // issuing a challenge, so existing subscribers saw a code screen while no
  // email was ever sent and no code could ever work.
  //
  // A route may still ASK the client to go and verify (the billing 403 does)
  // without sending anything itself. The distinction is the message: only a
  // route claiming "we emailed you" must actually issue a code.
  const re = /app\.post\("([^"]+)"/g;
  const routes: { path: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(serverSource))) routes.push({ path: m[1], start: m.index });

  for (let i = 0; i < routes.length; i++) {
    const body = serverSource.slice(routes[i].start, routes[i + 1]?.start ?? serverSource.length);
    const claimsSent = /we emailed you|code we emailed/i.test(body);
    if (!claimsSent) continue;
    assert.match(
      body,
      /issuePremiumAccessCode/,
      `${routes[i].path} tells the user a code was emailed but never issues one`,
    );
  }
});

test("a route that only requests verification does not claim to have sent a code", () => {
  // The billing 403 asks the user to sign in with a code; the sign-in flow
  // sends it. Claiming otherwise would be a lie the user cannot act on.
  for (const route of ["/create-customer-portal", "/apply-retention-offer"]) {
    const body = routeBody(route);
    if (!/verificationRequired/.test(body)) continue;
    assert.doesNotMatch(
      body,
      /we emailed you/i,
      `${route} claims a code was already sent, but it does not send one`,
    );
  }
});

test("/create-checkout-session cannot hand an existing subscriber instant access", () => {
  const body = routeBody("/create-checkout-session");
  assert.doesNotMatch(
    body,
    /createInstantAccessUrl/,
    "/create-checkout-session still issues an instant-access link",
  );
});

test("the instant-access capability is gone entirely", () => {
  // The token was stored under instant_access:<uuid> and redeemed by
  // /confirm-checkout-session for a premium session, with no proof of
  // ownership anywhere in the chain. Strip comments first so the historical
  // note explaining the removal does not look like live code.
  const code = serverSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /function createInstantAccessUrl/);
  assert.doesNotMatch(code, /kv\.(set|get|del)\(\s*`instant_access:/);
  // The only surviving mention may be the 410 guard that rejects old links.
  const mints = [...code.matchAll(/cs_rightedge_/g)];
  assert.equal(mints.length, 1, "cs_rightedge_ is still used for more than the rejection guard");
});

test("/create-customer-portal requires an authenticated session for that email", () => {
  const body = routeBody("/create-customer-portal");
  assert.match(body, /getAuthSessionFromRequest/, "no session is read");
  assert.match(body, /401/, "an unauthenticated caller is not refused");
  assert.match(body, /403/, "a mismatched session is not refused");
  // The Stripe customer must be resolved from the SESSION email. The local
  // variable is authSession here because `session` is already the Stripe
  // portal session later in this handler — a duplicate declaration broke the
  // worker boot once, so the name must stay distinct.
  assert.match(body, /customers\.list\(\s*\{\s*email:\s*authSession\.email/);
  assert.doesNotMatch(
    body,
    /customers\.list\(\s*\{\s*email\s*,/,
    "Stripe is still queried with a body-supplied email",
  );
});

test("/apply-retention-offer requires an authenticated session for that email", () => {
  const body = routeBody("/apply-retention-offer");
  assert.match(body, /getAuthSessionFromRequest/, "no session is read");
  assert.match(body, /401/, "an unauthenticated caller is not refused");
  assert.match(body, /session\.email/);
  // It must not resolve a subscription from the request body.
  assert.doesNotMatch(
    body,
    /findActiveStripeSubscription\(\s*stripe\s*,\s*email\s*\)/,
    "the retention offer still acts on a body-supplied email",
  );
});

test("/confirm-checkout-session only trusts Stripe's own session record", () => {
  const body = routeBody("/confirm-checkout-session");
  // A real cs_ id is a capability proving that checkout completed. The
  // locally minted cs_rightedge_ variety was not, so it must now be refused
  // outright rather than redeemed.
  assert.match(body, /cs_rightedge_[\s\S]{0,200}?410/, "old access links are not refused with 410");
  assert.doesNotMatch(
    body,
    /instant_access:/,
    "/confirm-checkout-session still redeems instant-access tokens",
  );
  assert.match(body, /checkout\.sessions\.retrieve/);
  assert.match(body, /payment_status/);
});

test("the gated billing callers send the session cookie", () => {
  // Both endpoints now return 401 without a session. A caller that omits
  // credentials:"include" would break billing for every legitimate
  // subscriber, which is exactly the kind of regression this patch risks.
  const appSource = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

  for (const endpoint of ["/api/create-customer-portal", "/api/apply-retention-offer"]) {
    const at = appSource.indexOf(endpoint);
    assert.ok(at !== -1, `${endpoint} is no longer called`);
    // Inspect the fetch options object that follows the URL.
    const options = appSource.slice(at, at + 600);
    assert.match(
      options,
      /credentials:\s*['"]include['"]/,
      `${endpoint} is called without credentials:"include" and will 401`,
    );
  }
});

test("the premium modal has a code step wired to /verify-premium-code", () => {
  const appSource = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
  // Without this, a legitimate subscriber has no way to finish signing in.
  assert.match(appSource, /\/api\/verify-premium-code/);
  assert.match(appSource, /verificationRequired/);
  assert.match(appSource, /alreadySubscribed/);
  // The old client-side unlock conditions must be gone.
  assert.doesNotMatch(appSource, /verifyData\.instantAccess/);
});

test("the premium session tier is only granted on a verified path", () => {
  // "Verified" here means the TIER is justified: either a redeemed emailed
  // code (which also proves identity) or a confirmed Stripe payment (which
  // proves entitlement but NOT email ownership). Both are acceptable grounds
  // for the premium tier; only the former may set identityVerified, which is
  // asserted separately in checkout_not_identity.test.ts.
  const premiumGrants = [...serverSource.matchAll(/createAuthSession\([^)]*["']premium["']/g)];
  assert.ok(premiumGrants.length > 0, "no premium session is ever created");
  for (const grant of premiumGrants) {
    const before = serverSource.slice(Math.max(0, grant.index! - 4_000), grant.index!);
    const proven =
      /verifyAndConsumePremiumChallenge/.test(before) ||
      /payment_status/.test(before) ||
      /checkout\.sessions\.retrieve/.test(before) ||
      /syncStripeCheckoutSession/.test(before);
    assert.ok(
      proven,
      `a premium session is created without ownership proof near: ${grant[0]}`,
    );
  }
});
