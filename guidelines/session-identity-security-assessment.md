# Security assessment: session possession is not identity

Production: `main` @ `6ad5e064`, Edge Function **version 199 — PATCHED AND LIVE**
Status: **DEPLOYED 2026-11-17.** Exploit closed, 9/9 production probe, 10/10
gates. No sessions revoked.

## Deployment outcome (2026-11-17)

| | |
|---|---|
| Edge Function | version **199**, ACTIVE, `verify_jwt=false`, booted first try (no 503) |
| Website bundle | `/assets/index-DOMGrSPe.js` — **unchanged**, no website deploy needed |
| `/api/*` health | `/`, `/api/scores`, `/api/health` all `200` |
| Production probe | **9/9 PASS** (was 3 FAIL incl. "EXPLOITABLE: a billing portal URL was issued") |
| Release gates | **10/10 PASS** |
| Tests | 651 pass, 0 fail; build clean; function parses |
| Customer data | 164 subscribers, 1,351 free-access records intact; 23 probe artefacts removed |

Verified live after deploy: impersonation → portal now **403**; emailed code
→ redeem → `tier=premium, premium=true` → portal **200** → logout → portal
**401**; free registration `200` with `tier=free`; `identityVerified: true`
persisted on the real session record.

### A completed Stripe payment is NOT proof of email ownership

Correcting my own earlier mistake: the first version of this fix set
`identityVerified = true` on a paid checkout. The checkout email is
customer-supplied, so an attacker could pay using a victim's address and then
manage the **victim's** real Stripe customer. `identityVerified` is now set by
exactly two paths, both requiring possession of the inbox:

```
/auth/admin/verify      admin email challenge
/verify-premium-code    redeemed 6-digit emailed code
```

`/confirm-checkout-session` still grants the premium **tier** and writes the
subscriber record, so paying customers keep immediate access — it simply no
longer confers billing authority.

### Checkout-session replay

A `cs_` id is retrievable from Stripe indefinitely and travels in a URL
(history, shared links, referrer logs). The first confirmation now records
`checkout_session_used:<cs_id>`. Replays inside a **30-minute grace window**
still mint a session (the client re-POSTs on reload, and React StrictMode
double-invokes the effect in development); later replays return **409** with
`verificationRequired` and no session.

**Remaining accepted Premium-access replay risk:** replaying a `cs_` id inside
the grace window, or paying with someone else's address, can still obtain a
**premium-tier** session for that address. It grants content only — never
billing — and `/auth/session` re-derives entitlement from Stripe on every
call, so it cannot outlive the subscription. Closing it fully requires an
emailed code at the end of checkout, which would add friction for every new
customer; recommended as a follow-up, not an emergency.

### Email delivery — a real defect found, and it was not spam

Resend's API (not just its accept response) shows all four earlier code
emails to `betr@rightedge.com.au` were **`suppressed`**, then a fresh send
**`bounced`**:

```
smtp; The email account that you tried to reach does not exist.   (Permanent / General)
```

**`betr@rightedge.com.au` has no mailbox.** It was suppressed on 2026-08-04
after a bounce, so every "success" I previously reported for that address was
Resend accepting a message it then refused to deliver. My earlier claim that
delivery was merely "unconfirmed" was too generous — it was failing.

Proven on a real mailbox instead: a code to **`elliott@rightedge.com.au`**
reached `last_event = delivered`, and that delivered code redeemed
successfully → premium → billing portal `200` → logout.

Fleet deliverability over the last 100 emails: **81 reached the inbox**
(delivered/opened/clicked), 10 failed, 9 in flight — about **89%**. Of 164
subscribers, exactly **1** is on the suppression list, and it is this
dead test address. **No real customer is blocked from receiving a login code.**

---

## 1. Confirmed vulnerability

### CRITICAL — zero-credential billing takeover

Reproduced against the **live deployed function**, targeting an account we
control (`betr@rightedge.com.au`):

```
POST /register-free-access   {"email":"<target>"}   -> 200, Set-Cookie: rightedge_session=…
POST /create-customer-portal {"email":"<target>"}   -> 200, {"url":"https://billing.stripe.com/…"}
```

**No code, no password, no payment.** That portal exposes invoices, allows
changing the payment method, and allows cancelling the subscription. The same
session also reaches `/apply-retention-offer`, which **writes** to live
billing.

Your diagnosis was exactly right. `/register-free-access` mints a session for
a body-supplied email (deployed source, lines 54–57 of the handler):

```ts
const existingSession = await getAuthSessionFromRequest(c);
const sessionTier: AuthSessionTier = existingSession?.tier === "premium" ? "premium" : "free";
const authSession = await createAuthSession(email, sessionTier);
writeAuthSessionCookie(c, authSession.token);
```

and the billing endpoints treated `session.email === body.email` as
authorisation. That check is worthless when **anyone can mint a session for
any address**. My previous fix closed the "knowing an email is enough" hole
and left "minting a session for that email is enough" wide open — the same
class of bug, one layer in.

### MEDIUM — premium tier propagation (real, not exploitable for content)

The same line copied `premium` from **any** presented session onto a new
session for an **unrelated** address. Verified at the data layer: the stored
record for an unrelated probe address read `tier: premium`.

It did **not** yield premium content, because `/auth/session` re-derives
entitlement from Stripe:

```ts
const premium = session.tier === "premium" ? await isPremiumSubscriberActive(session.email) : false;
```

So the paywall held. But the stored tier was wrong, and any future code
trusting `session.tier` would have granted access. Fixed regardless.

### Audit — every mint site and every session-trusting route

`createAuthSession` call sites, with the proof preceding each:

| Route | Proof |
|---|---|
| `/auth/admin/verify` | admin email code |
| `/verify-premium-code` | redeemed emailed code |
| `/confirm-checkout-session` | `payment_status === "paid"` |
| **`/register-free-access`** | **none** |

Routes trusting a session for something sensitive:

| Route | Reaches | Gate before fix |
|---|---|---|
| `/create-customer-portal` | Stripe | email match only |
| `/apply-retention-offer` | Stripe (writes) | email match only |
| `/register-free-access` | mints a session | none |
| `/auth/session` | read-only | re-derives from Stripe |
| `/admin/*` | admin data | admin challenge (correct) |

---

## 2. Minimal hotfix

**Separate verified identity from registration**, with one new field.

`StoredAuthSession.identityVerified?: boolean` — true **only** after a
redeemed emailed code, a paid Stripe checkout, or the admin challenge.
`createAuthSession` defaults it to `false`.

```ts
// /create-customer-portal and /apply-retention-offer
if (authSession.identityVerified !== true) {
  return c.json({ error: "Please sign in with the code we email you…",
                  verificationRequired: true }, 403);
}
```

Strict `!== true` so the **744 live sessions that predate the field fail
closed**. `renewAuthSession` spreads the stored session, so the flag survives
refresh — checked explicitly by a test, because rebuilding the object field by
field would silently downgrade every verified subscriber on refresh.

Free registration keeps working and still issues a session, but unverified,
and tier inheritance now requires the **same address** *and* prior
verification:

```ts
const sameAddress = existingSession?.email === email
                 && existingSession?.identityVerified === true;
const sessionTier = sameAddress && existingSession?.tier === "premium" ? "premium" : "free";
```

Four files, no schema migration, no change to Stripe, the model, or the RLWC
product.

### Impact on legitimate users

| Who | Effect |
|---|---|
| Free visitors | **No change.** Registration, email gate, free content all work |
| Premium content | **No change.** `/auth/session` re-derives from Stripe |
| Billing portal / cancellation | Must sign in with an emailed code first, once |
| New checkout | **No change** |
| New sign-ins | Already verified — the flag is set at redemption |

The one-time friction hits **112 distinct subscriber emails** holding legacy
sessions. The 403 message is actionable and both client callers already
surface it.

---

## 3. Session remediation

Current live-session inventory:

| | |
|---|---|
| Live sessions | **747** |
| Live free | 359 (242 distinct emails) |
| Live premium | 388 |
| Carrying `identityVerified` | **0** |
| Live sessions whose email owns a Stripe customer | **472** |
| **Free sessions sitting on a subscriber email** | **89** |

Those 89 are the direct evidence for your Priority 2 concern: free sessions
were never identity-verified, and 89 of them are attached to addresses that
own a subscription.

**Finding: with the fix deployed, the free sessions do not need revocation.**

Post-fix route audit — *"routes a free unverified session can still use for
Stripe: **NONE**"*. Every sensitive path now demands `identityVerified ===
true`, which no existing session has. They fail closed. A stale free session
can read free content and nothing more, which is exactly what it was for.

**The 388 premium sessions still warrant revocation**, for the original
reason: no provenance field, so a session minted by the old vulnerable
`/verify-email` is indistinguishable from a legitimate one. The
`--cutoff` targeting already built handles this, and post-fix those sessions
cannot reach billing either — which lowers the urgency from "contain an active
exploit" to "clear sessions of unknown origin".

Recommended order:
1. Deploy this fix (closes the live exploit).
2. Revoke the pre-cutoff **premium** sessions on your approval.
3. Leave free sessions alone — they are inert once billing requires
   verification. Optionally expire the oldest later, as hygiene, not security.

---

## 4. Verification

| Check | Result |
|---|---|
| Tests | **641 pass, 0 fail** (+13: 12 identity + 1 companion) |
| Production build | clean |
| Edge function parses | 3/3 (the guard that caught the 503) |
| Flow verification | 40/40 |
| Live probe vs **deployed** function | **3 FAIL** — "EXPLOITABLE: a billing portal URL was issued" |
| Live probe vs this build | 9/9 expected to pass once deployed |
| `node_modules` | 0 deletions |
| Probe artefacts | 23 removed; 164 subscribers and 1,351 free-access records intact |

`scripts/probe_session_identity.ts` is the integration test you asked for. It
runs against a live function with unroutable `…@rightedge-security-check.invalid`
addresses and asserts: free registration still works, an unverified session is
refused (403) on its **own** email, the impersonation path is refused, premium
does not propagate, an anonymous caller gets 401 **before** Stripe is queried,
and legitimate premium sign-in still issues a code.

One test of mine was **wrong and I corrected it**: it demanded that every route
returning `verificationRequired` must itself send a code. The billing 403
legitimately asks the user to go and verify without sending anything. The
assertion now keys on the claim ("we emailed you") rather than the flag, with a
companion test that a route which only *requests* verification does not claim a
code was already sent.

---

## 5. Still unverified

1. **Email receipt in the intended inbox.** You are right that Resend
   accepting a request is not delivery. I confirmed: a `200` with no
   `[premium-code] Failed to send` in the function logs, a correctly formed
   challenge in the store, and that the HMAC matches the code the email
   contained. **I cannot read the mailbox.** Someone must open the
   `betr@rightedge.com.au` inbox and confirm the message arrived, and whether
   it landed in spam.
2. **The fix against the live function** — it is not deployed. All current
   endpoint evidence is from the *vulnerable* deployment.
3. **Whether the exploit was ever used.** No access logs exist. Cannot be
   proven or excluded.
4. **Stripe test-mode E2E.** Still only a live key; unchanged from before.

---

## 6. GO / NO-GO

**GO — deploy this fix as an emergency hotfix.**

A zero-credential billing takeover is live right now. Anyone who knows a
subscriber's email can open their Stripe billing portal and cancel their
subscription. That is worse than the four issues already fixed, because it
needs no information beyond an email address and leaves the attacker holding a
working session.

The fix is four files, fully tested, fails closed, and the function parses
(the guard added after the earlier 503). Deploying the Edge Function alone is
sufficient — **no website change is required**, so there is no bundle
ordering problem this time.

Conditions:
1. Deploy the **Edge Function only**. The live bundle already handles a 403
   with the server's message.
2. Immediately re-run `probe_session_identity.ts` with
   `PROBE_SUBSCRIBER_EMAIL` set; require **9/9**.
3. Then confirm a controlled account can still reach the billing portal after
   signing in with a code — that is the legitimate path the fix must preserve.
4. Session revocation stays blocked pending your separate approval.

### Residual risks after deploying

| Risk | Severity | Note |
|---|---|---|
| 112 subscriber emails must re-verify once before managing billing | Medium | Expect support contacts; message is actionable |
| Email deliverability unconfirmed | Medium | **Needs a human to check the inbox** |
| Premium sessions of unknown origin remain | Medium | Inert for billing post-fix; revocation still recommended |
| 89 free sessions on subscriber emails | Low post-fix | Cannot reach Stripe once verification is required |
| `/register-free-access` still accepts any address | Accepted | It is an email capture form; it now grants nothing |
