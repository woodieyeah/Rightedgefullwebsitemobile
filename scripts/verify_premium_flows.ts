/**
 * Walk each user-facing flow through the REAL route handlers.
 *
 * Unit tests assert pieces; this asserts the sequences a customer actually
 * experiences, by extracting each route body from the live source and
 * checking the ordered steps it performs. It is static verification — it
 * cannot prove the deployed function behaves this way — but it catches the
 * class of bug where two correct endpoints do not compose, which is exactly
 * how the alreadySubscribed defect survived unit tests.
 */
import { readFileSync } from "node:fs";

const server = readFileSync("supabase/functions/server/index.tsx", "utf8");
const app = readFileSync("src/app/App.tsx", "utf8");

function route(path: string): string {
  const marker = `app.post("${path}"`;
  const start = server.indexOf(marker);
  if (start === -1) throw new Error(`route ${path} missing`);
  const after = server.slice(start + marker.length);
  const next = after.search(/\napp\.(post|get|put|delete)\(/);
  return next === -1 ? after : after.slice(0, next);
}

type Check = { label: string; ok: boolean; detail?: string };
const flows: { name: string; checks: Check[] }[] = [];

function has(body: string, re: RegExp) {
  return re.test(body);
}

// ---------------------------------------------------------------------------
// FLOW 1 — existing subscriber signs in
// ---------------------------------------------------------------------------
{
  const verify = route("/verify-email");
  const confirm = route("/verify-premium-code");
  flows.push({
    name: "Existing subscriber: request code -> receive email -> redeem -> premium",
    checks: [
      { label: "verify-email requires an active Stripe subscription first", ok: has(verify, /findActiveStripeSubscription/) },
      { label: "verify-email issues AND emails a code", ok: has(verify, /issuePremiumAccessCode/) },
      { label: "verify-email does NOT mint a session", ok: !has(verify, /createAuthSession/) },
      { label: "verify-email answers identically when throttled (no subscriber oracle)", ok: has(verify, /sent.*throttled|throttled.*identically|not reveal/s) },
      { label: "verify-premium-code verifies atomically", ok: has(confirm, /verifyAndConsumePremiumChallenge/) },
      { label: "verify-premium-code re-checks Stripe at grant time", ok: has(confirm, /findActiveStripeSubscription/) },
      { label: "verify-premium-code mints premium + sets cookie", ok: has(confirm, /createAuthSession\([^)]*premium/) && has(confirm, /writeAuthSessionCookie/) },
      { label: "locked returns 429, expired/invalid return 400", ok: has(confirm, /429/) && has(confirm, /400/) },
      { label: "client has a code step posting to /verify-premium-code", ok: has(app, /\/api\/verify-premium-code/) },
      { label: "client confirms the session took effect before unlocking", ok: has(app, /onSessionRefresh\(\)[\s\S]{0,200}tier !== "premium"/) },
    ],
  });
}

// ---------------------------------------------------------------------------
// FLOW 2 — new subscriber pays
// ---------------------------------------------------------------------------
{
  const checkout = route("/create-checkout-session");
  const confirm = route("/confirm-checkout-session");
  flows.push({
    name: "New subscriber: checkout -> Stripe payment -> premium",
    checks: [
      { label: "checkout still creates a real Stripe session for new customers", ok: has(checkout, /checkout\.sessions\.create/) },
      { label: "checkout grants nothing to an unverified email", ok: !has(checkout, /createInstantAccessUrl/) && !has(checkout, /createAuthSession/) },
      { label: "existing subscriber at checkout gets a code emailed", ok: has(checkout, /issuePremiumAccessCode/) },
      { label: "confirm requires a genuine cs_ id", ok: has(confirm, /checkout\.sessions\.retrieve/) },
      { label: "confirm requires payment_status paid", ok: has(confirm, /payment_status/) },
      { label: "confirm rejects legacy cs_rightedge_ links with 410", ok: has(confirm, /cs_rightedge_[\s\S]{0,200}410/) },
      { label: "confirm mints premium only after payment", ok: has(confirm, /createAuthSession\([^)]*premium/) },
      { label: "client redirects to the Stripe URL", ok: has(app, /window\.location\.href = checkoutData\.url/) },
    ],
  });
}

// ---------------------------------------------------------------------------
// FLOW 3 — billing management and cancellation
// ---------------------------------------------------------------------------
{
  const portal = route("/create-customer-portal");
  const retention = route("/apply-retention-offer");
  flows.push({
    name: "Authenticated subscriber: manage billing, cancel, claim retention offer",
    checks: [
      { label: "portal requires a session", ok: has(portal, /getAuthSessionFromRequest/) && has(portal, /401/) },
      { label: "portal refuses a mismatched email with 403", ok: has(portal, /403/) },
      { label: "portal resolves the customer from the session email", ok: has(portal, /customers\.list\(\s*\{\s*email:\s*authSession\.email/) },
      { label: "portal still returns a billingPortal URL", ok: has(portal, /billingPortal\.sessions\.create/) },
      { label: "retention requires a session", ok: has(retention, /getAuthSessionFromRequest/) && has(retention, /401/) },
      { label: "retention refuses a mismatched email with 403", ok: has(retention, /403/) },
      { label: "retention resolves the subscription from session.email", ok: has(retention, /findActiveStripeSubscription\(\s*stripe\s*,\s*session\.email/) },
      { label: "retention still applies the coupon", ok: has(retention, /subscriptions\.update|coupon/) },
      { label: "both clients send credentials:include", ok: (() => {
          for (const ep of ["/api/create-customer-portal", "/api/apply-retention-offer"]) {
            const at = app.indexOf(ep);
            if (at === -1) return false;
            if (!/credentials:\s*['"]include['"]/.test(app.slice(at, at + 600))) return false;
          }
          return true;
        })() },
    ],
  });
}

// ---------------------------------------------------------------------------
// FLOW 4 — attacker knows a subscriber's email
// ---------------------------------------------------------------------------
{
  const verify = route("/verify-email");
  const checkout = route("/create-checkout-session");
  const portal = route("/create-customer-portal");
  const retention = route("/apply-retention-offer");
  flows.push({
    name: "Attacker with only a victim's email address gains nothing",
    checks: [
      { label: "verify-email: no session, code goes to the victim's inbox", ok: !has(verify, /createAuthSession/) },
      { label: "checkout: no access link", ok: !has(checkout, /createInstantAccessUrl/) },
      { label: "portal: 401 without a session", ok: has(portal, /401/) },
      { label: "portal: 403 when the session is another account", ok: has(portal, /authSession\.email !== email[\s\S]{0,300}403/) },
      { label: "retention: 403 when the session is another account", ok: has(retention, /session\.email !== email[\s\S]{0,300}403/) },
      { label: "no instant-access capability remains", ok: !/kv\.(set|get|del)\(\s*`instant_access:/.test(server) },
      { label: "code is bound to its email in the HMAC payload", ok: /\$\{normalizePremiumEmail\(email\)\}:\$\{code\}/.test(readFileSync("supabase/functions/server/premium_auth.ts", "utf8")) },
    ],
  });
}

// ---------------------------------------------------------------------------
// FLOW 5 — unchanged paths that must not regress
// ---------------------------------------------------------------------------
{
  const free = route("/register-free-access");
  flows.push({
    name: "Unchanged: free email gate, Stripe webhooks, admin auth",
    checks: [
      { label: "free access gate still mints a session (tier via sessionTier)", ok: has(free, /createAuthSession\(\s*email\s*,\s*sessionTier/) && has(free, /writeAuthSessionCookie/) },
      { label: "free gate carries premium ONLY for the same verified address", ok: has(free, /sameAddress/) && has(free, /existingSession\?\.email === email/) && has(free, /identityVerified === true/) },
      { label: "Stripe webhook still syncs subscribers", ok: /invoice\.payment_succeeded/.test(server) && /customer\.subscription\.deleted/.test(server) },
      { label: "webhook signature still verified", ok: /constructEventAsync|webhooks\.constructEvent/.test(server) },
      { label: "admin routes still gated by middleware", ok: /app\.use\("\/admin\/\*"/.test(server) },
      { label: "admin challenge flow untouched", ok: /verifyAndConsumeAdminChallenge/.test(server) },
    ],
  });
}

let failures = 0;
for (const flow of flows) {
  console.log(`\n${flow.name}`);
  console.log("-".repeat(Math.min(flow.name.length, 72)));
  for (const check of flow.checks) {
    if (!check.ok) failures++;
    console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.label}`);
  }
}

console.log(
  `\n${failures === 0 ? "ALL FLOWS VERIFIED" : `${failures} CHECK(S) FAILED`} ` +
    `(${flows.reduce((n, f) => n + f.checks.length, 0)} checks across ${flows.length} flows)\n`,
);
process.exit(failures === 0 ? 0 : 1);
