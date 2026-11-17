# Premium authentication and Stripe authorisation review

Branch: `security/premium-auth-review`. **Not deployed, not merged.**
No production data, subscription or payment was modified during this review.

## Method

Source inspection of `supabase/functions/server/index.tsx`, plus non-mutating
probes against the **deployed** function using a throwaway address
(`nonexistent-probe-<timestamp>@rightedge-security-check.invalid`) that cannot
match any real customer. No live customer account or billing session was used.

The decisive signal for the two Stripe endpoints: an unauthenticated request
returned **`404 "No active subscription found for this email."`**. A 404 means
the handler ran the Stripe customer lookup and only then failed to find a
match — so no authorisation check executed. A gated endpoint returns 401
before touching Stripe.

## Findings — all four confirmed in the deployed function

### 1. `/verify-email` minted a premium session from an email alone — CRITICAL

`index.tsx:3536` resolved an active Stripe subscription from the request body,
then called `createAuthSession(email, "premium")` and
`writeAuthSessionCookie(c, ...)` directly.

Knowing any subscriber's email address was sufficient to receive their
**180-day `HttpOnly` premium session cookie**. No code, no password, no
payment. Full account takeover of every paying subscriber, at the cost of
guessing an email address.

*Verified:* a non-subscriber probe returned `{"active":false}` and set
**0** session cookies, confirming the branch is reached only for addresses
that do have a subscription — i.e. exactly the real customers.

### 2. `/create-checkout-session` issued instant-access links — CRITICAL

`index.tsx:3916` called `createInstantAccessUrl(...)` for any email found to
have an active subscription, returning a URL containing
`session_id=cs_rightedge_<uuid>`. `/confirm-checkout-session:4739` redeemed
that token for a premium session.

The endpoint is unauthenticated by design (new customers have no session), so
anyone could request the link for a stranger's address and be logged in as
them. *Verified:* the probe returned **HTTP 200 with a live
`checkout.stripe.com` URL**, proving the handler executes unauthenticated.

### 3. `/create-customer-portal` opened billing portals on an email alone — HIGH

`index.tsx:3749` ran `stripe.customers.list({ email, limit: 1 })` straight
from the request body and created a `billingPortal.sessions` link. That portal
can view invoices, change the payment method and cancel the subscription.
*Verified:* **404 unauthenticated.**

### 4. `/apply-retention-offer` modified subscriptions on an email alone — HIGH

`index.tsx:3778` resolved the subscription from the body and applied a
discount coupon to it. This **writes to live billing** for an address the
caller never proved they own. *Verified:* **404 unauthenticated.**

### Additional findings from auditing the same flaw class

Every route reading `body.email` was enumerated rather than only the four
reported.

- **`/subscribe` — LOW, not changed.** Writes a subscriber record for an
  unproven email, but requires a genuine active Stripe subscription, mints no
  session and sets no cookie. Not referenced anywhere in `src/` or the built
  bundle, so it is unreachable from the product. Left alone deliberately:
  changing an unused endpoint adds risk without reducing exposure.
- **`/verify-otp` — dead code.** No frontend caller; compares a plaintext KV
  value and returns `{success:true}` without minting anything.
- **`/admin/*` — correctly gated** by the `app.use("/admin/*")` middleware at
  `index.tsx:541`, which calls `requireAdmin`.
- **`/auth/admin/verify`** mints a session but only after
  `verifyAndConsumeAdminChallenge`, which is the pattern this patch copies.

## The fix

**New module `supabase/functions/server/premium_auth.ts`**, deliberately
mirroring the already-correct `admin_auth.ts`:

- 6-digit code from `crypto.getRandomValues` (not `Math.random`)
- stored only as an **HMAC-SHA256**, so a KV dump yields no working codes
- the signed payload is `email:code`, which makes a challenge
  **non-transferable** — moving the record to another address invalidates it
- **constant-time** comparison, so no timing oracle on a 6-digit secret
- 10-minute expiry, **5-attempt cap** (10^6 is otherwise brute-forceable),
  30-second reissue cooldown, single-use on success
- `requirePremiumCodeHmacSecret` throws rather than defaulting — a constant
  fallback would make every code forgeable from the source

**Route changes:**

| Endpoint | Before | After |
|---|---|---|
| `/verify-email` | minted premium session | emails a code, returns `verificationRequired` |
| `/verify-premium-code` | *(new)* | only non-payment path to premium; re-checks Stripe at grant time |
| `/create-checkout-session` | instant-access URL | returns `alreadySubscribed`, grants nothing |
| `/confirm-checkout-session` | redeemed `cs_rightedge_` | **410 Gone**; only real `cs_` with `payment_status === "paid"` |
| `/create-customer-portal` | body email → Stripe | 401 without session, 403 on mismatch, Stripe queried with `session.email` |
| `/apply-retention-offer` | body email → Stripe write | 401 / 403, subscription resolved from `session.email` |

`createInstantAccessUrl` is deleted outright.

Two details worth noting. The rate-limited branch of `/verify-email` returns
the **same response shape** as success, so the endpoint cannot be used as an
oracle for "is this address a subscriber". And `/verify-premium-code`
re-queries Stripe at grant time rather than trusting the lookup from the
earlier request, in case the subscription lapsed between the two calls.

## Preserving legitimate flows

A security patch that locks out paying customers is a worse outcome than the
bug. Client changes in `src/app/App.tsx`:

- the premium modal gained a **`code` step** posting to
  `/verify-premium-code`, so existing subscribers can still sign in
- the `alreadySubscribed` response routes to that same step instead of
  charging a second time
- **a real break was found and fixed:** `/apply-retention-offer` and
  `/create-customer-portal` were called **without `credentials: "include"`**.
  With the new session requirement they would have returned 401 for every
  legitimate user — cancellation and billing management would have broken
  completely. A regression test now pins credentials on both callers.
- stale copy promising instant unlock was corrected

Unchanged: new-customer Stripe checkout, the webhook path
(`invoice.payment_succeeded`, `customer.subscription.*` — 164 subscriber
records are maintained by it), renewal, the free-email gate, and admin auth.

## Session remediation assessment

Measured read-only from `kv_store_f8a832e3` (note: the table suffix is
`f8a832e3`, **not** the `3b84b96c` route prefix):

| | |
|---|---|
| Total `auth_session:*` records | **1,853** |
| Premium sessions | 691 (**384 live**, 307 expired) |
| Free sessions | 1,162 |
| Distinct emails with a live premium session | **103** |
| Distinct premium emails all-time | 146 |
| Outstanding `instant_access:*` tokens | **0** |
| Earliest still-live premium session | 2026-05-25 |

**Recommendation: revoke all 384 live premium sessions.**

The reasoning is that sessions are keyed only by token (`auth_session:<token>`)
and the record carries `token, email, tier, createdAt, expiresAt,
adminVerified` — there is **no provenance field**, so a session minted by the
vulnerable `/verify-email` path is indistinguishable from one minted by a paid
checkout. Since any of the 384 could be an impersonation, and 103 real
customers are affected, the honest position is that none can be cleared
individually.

Cost of revoking: those 103 subscribers must sign in again, which now works
via the emailed code. That is a mild inconvenience against an unknown number
of potentially live hijacked sessions.

Mitigating evidence, not a reason to skip it: **0 outstanding instant-access
tokens**, so no finding-2 capability is currently redeemable, and the KV store
holds no access logs that could prove exploitation either way. **Absence of
evidence here is not evidence of absence** — the vulnerable paths left no
audit trail by design.

Revocation is a **production database write** and has not been performed.
It needs explicit approval, and should run only after this patch is deployed —
revoking first would simply let the vulnerable endpoints mint fresh sessions.

## Required before deploy

`PREMIUM_CODE_HMAC_SECRET` must be set in the edge function's environment
(≥32 chars). The module throws without it, so `/verify-email` would return 500
and **no subscriber could sign in**. Set it before deploying, not after.

## Verification

- **606 tests pass** (587 before this work), production build clean
- 19 new tests in `tests/premium_auth_security.test.ts`, written to **fail
  first**: 10 unit tests on the primitive, 7 route assertions, 2 client
  assertions. Pre-patch result was **10 pass / 7 fail**, each failure naming
  one confirmed vulnerability.
- The brute-force, expiry, non-transferability and plaintext-storage
  properties are covered by direct unit tests, not source pattern matching.

## Not verifiable without a deploy

The probes above confirm the **deployed** code is vulnerable; they cannot
confirm the **patched** code behaves correctly in production, because the
patch is not deployed. What remains untested against the live function: code
delivery through Resend, the 401/403 responses, and that a legitimate
subscriber completes the code flow end to end.
