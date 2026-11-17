# Security hotfix: release and rollback plan

Branch: `security/premium-auth-review` @ `f99f10be`
Base: `main` @ `593358d8` (production)
Status: **NOT deployed, NOT merged.** Awaiting approval.

---

## 1. What changed since the review

Three defects were found and fixed **before** deployment.

### 1a. `alreadySubscribed` promised a code it never sent — CONFIRMED

Your read was right. `/create-checkout-session` returned
`verificationRequired: true` but never issued a challenge, so an existing
subscriber who reached checkout saw a 6-digit code box that **no code could
ever satisfy**. They would have been permanently unable to sign in.

Fixed by extracting `issuePremiumAccessCode()` and calling it from both
`/verify-email` and `/create-checkout-session`. A test now asserts that
**every** route returning `verificationRequired` also issues a code, so the
two cannot drift again.

### 1b. The branch shipped three undefined-symbol runtime crashes — CRITICAL

`security/premium-auth-review` carried three `resolveApiUrl(...)` calls left
over from the Capacitor work, **with no import**. `vite build` uses esbuild,
which strips TypeScript types without checking them, and TypeScript is not
installed in this project — so the build passed and the bundle shipped a bare
reference.

Verified directly: the built bundle contained `resolveApiUrl(` exactly once
and never defined it. Affected calls were **premium code verification, the
retention offer, and the billing portal** — the three things this release
exists to fix. All would have thrown `ReferenceError` on click.

Fixed by reverting to plain relative paths. `tests/undefined_symbol_guard.test.ts`
now pins this, and I validated the guard by reintroducing the bug: it fails
with it, passes without.

### 1c. Code verification was not concurrency-safe — HIGH

The original implementation was read-modify-write in the edge function:

```
challenge = kv.get(key)      // N parallel requests all read attempts = 0
result    = verify(challenge)
kv.set(key, {attempts: 1})   // N parallel requests all write attempts = 1
```

Two consequences: the 5-attempt cap became worth **5 × N** guesses, and
single-use broke — two requests submitting the same correct code both saw a
present challenge and both minted a 180-day premium session.

Fixed with `supabase/migrations/20261117000000_atomic_premium_challenges.sql`,
using `pg_advisory_xact_lock` + `SELECT … FOR UPDATE`, mirroring
`20260823000000_atomic_admin_challenges.sql` which already solved this for
admin login. Verification, the attempt increment and the single-use delete now
happen in one transaction. The reissue cooldown moved into SQL too, so
parallel requests cannot each email a fresh code.

The non-atomic helper was **deleted** rather than left beside the real path.

---

## 2. Branch isolation

`git diff --stat main..HEAD` touches **9 files**, none native:

```
scripts/revoke_premium_sessions.ts
scripts/verify_premium_flows.ts
src/app/App.tsx
supabase/functions/server/index.tsx
supabase/functions/server/premium_auth.ts
supabase/functions/server/premium_challenge_store.ts
supabase/migrations/20261117000000_atomic_premium_challenges.sql
tests/premium_auth_security.test.ts
tests/premium_challenge_concurrency.test.ts
tests/undefined_symbol_guard.test.ts
guidelines/*.md
```

No `ios/`, no `capacitor.config.*`, **no Capacitor dependencies in
`package.json`**, and zero `resolveApiUrl` references anywhere in `src/`.
Confirmed by grep, not assumption. The Capacitor work remains isolated on
`feature/capacitor-api-compat`.

---

## 3. Verification results

| Check | Result |
|---|---|
| Full test suite | **619 pass, 0 fail** (587 at session start) |
| Production build | clean, 1.24s |
| Flow verification (`verify_premium_flows.ts`) | **40/40 checks, 5 flows** |
| Committed linux binaries | **0 deletions, 0 modifications** |
| Secrets in new files | none |
| Customer emails in artefacts | none |

### Verified without deploying

- **Existing subscriber sign-in** (10 checks): Stripe check → code issued and
  emailed → atomic redeem → Stripe re-checked at grant time → premium cookie.
  The client confirms the session actually took effect before unlocking.
- **New subscriber checkout** (8 checks): real `checkout.sessions.create`
  preserved; nothing granted to an unverified email; `payment_status === "paid"`
  still required; legacy `cs_rightedge_` links return 410.
- **Billing / cancellation / retention** (9 checks): 401 without session, 403
  on mismatch, customer resolved from `session.email`, coupon still applied,
  and **both clients send `credentials: "include"`** — the regression that
  would have 401'd every real subscriber.
- **Attacker with only an email** (7 checks): no session, no access link, no
  instant-access capability, and the code is bound to its email inside the
  HMAC payload so it is non-transferable.
- **Unchanged paths** (6 checks): free email gate (including its
  premium-tier preservation), Stripe webhook sync, webhook signature
  verification, admin middleware, admin challenge flow.
- **Concurrency** (10 tests): 8 parallel correct-code submissions yield
  **exactly one** success; 40 parallel wrong guesses charge **at most 5**
  attempts; cooldown refuses a second issue inside 30s.

### Live baseline against the DEPLOYED function

Probed with `probe-<ts>@rightedge-security-check.invalid`, which cannot match
a real customer. No live account or billing session touched.

```
verify-email             200  {"active":false}
create-checkout-session  200  {"url":"https://checkout.stripe.com/g/pay/cs_live_..."}
create-customer-portal   404  No active subscription found for this email.
apply-retention-offer    404  No active subscription found for this email.
verify-premium-code      404  (route does not exist — patch is not deployed)
```

The 404s prove the Stripe lookup runs **before** any authorisation check. The
`cs_live_` URL proves `/create-checkout-session` executes fully
unauthenticated. **All four vulnerabilities are live in production right now.**

### Resend configuration — verified working

`POST /auth/admin/request` against production returned **202** with the
generic response, meaning `RESEND_API_KEY` and the sender are configured and
the existing code-email path works today. The premium code reuses
`getResendClient()` and `getFromEmail()` — the identical mechanism — so no new
email configuration is required.

`getFromEmail()` falls back to `RightEdge <elliott@rightedge.com.au>` when
`RESEND_FROM_EMAIL` is unset, so delivery works either way.

### `PREMIUM_CODE_HMAC_SECRET`

A 64-character secret was generated with `crypto.randomBytes(32)` and stored
in `~/.hermes/.env` (mode 600). It satisfies the module's own ≥32-char guard.
**The value has never been printed to chat and is not in the repo.**

It is **not yet set in the edge function environment** — that is a manual step
you must perform in the Supabase dashboard before deploying. Without it,
`/verify-email` throws and **nobody can sign in**.

---

## 4. What still requires a deploy to verify

Static verification cannot prove runtime behaviour. After deploying:

1. Code email actually arrives (Resend → a real inbox).
2. The 401/403 responses return as written.
3. A real subscriber completes request → receive → redeem end to end.
4. The atomic RPCs exist and are callable by `service_role` (the migration
   must be applied **before** the function, or verification returns 500).
5. New-customer checkout completes against live Stripe.

I have **not** performed a Stripe test-mode end-to-end run: this project uses
a single `STRIPE_SECRET_KEY` (currently live — the probe returned a `cs_live_`
session), and there is no test-mode key configured. Creating one and seeding a
test customer would be a production configuration change, which is outside
what you approved. **This is the largest unverified gap**, and it is why step 3
of the deployment sequence uses a controlled real account.

---

## 5. Deployment sequence

Order matters. The migration must land first, or code verification returns 500.

```
STEP 0  Confirm the current production bundle hash, for rollback reference
        curl -s https://rightedge.com.au/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | tail -1

STEP 1  Set the secret in the edge function environment (Supabase dashboard)
        PREMIUM_CODE_HMAC_SECRET = <64-char value from ~/.hermes/.env>
        Nothing else changes. No deploy yet.

STEP 2  Apply the migration
        supabase db push     (or run the SQL in the dashboard)
        Verify: the three premium_challenge RPCs exist and are granted to
        service_role only.
        SAFE TO STOP HERE — new functions, nothing calls them yet.

STEP 3  Deploy the edge function
        supabase functions deploy make-server-3b84b96c
        Immediately verify with the throwaway probe:
          verify-premium-code     -> 400 (route exists, rejects a bad code)
          create-customer-portal  -> 401 (was 404)
          apply-retention-offer   -> 401 (was 404)
          create-checkout-session -> 200 with a cs_live_ URL for a NEW email
        Then with one controlled real subscriber account:
          request a code -> confirm the email arrives -> redeem -> premium

STEP 4  Deploy the website (merge to main; Vercel ships main)
        Verify the live bundle hash CHANGED from step 0, and that the
        premium modal shows the code step.

STEP 5  Re-run the probe suite and confirm all four endpoints are gated.

STEP 6  ONLY AFTER steps 3-5 verify: revoke sessions
        npx tsx scripts/revoke_premium_sessions.ts            # dry run again
        npx tsx scripts/revoke_premium_sessions.ts --apply    # destructive
        Then confirm one revoked account can sign back in via code.
```

**Steps 3 and 4 are order-sensitive in one direction only.** Deploying the
function first leaves the old website calling `/verify-email` and receiving
`verificationRequired`, which the old bundle does not understand — an existing
subscriber would see "could not verify" until step 4 completes. Keep the gap
short. Deploying the website first is worse: it would post to
`/verify-premium-code`, which would not exist yet.

---

## 6. Rollback plan

**The authentication endpoints must never be rolled back.** Reverting them
restores full account takeover of every paying subscriber.

| Failure | Response |
|---|---|
| Migration fails | Nothing else has shipped; fix the SQL and retry. No customer impact. |
| Code emails do not arrive | **Do not revert.** Check `RESEND_API_KEY` and the Resend dashboard. Existing subscribers with a live session keep working (revocation has not run yet). Fix forward. |
| Code verification returns 500 | Almost certainly the migration did not apply or the RPC grant is missing. Verify step 2; fix forward. |
| `PREMIUM_CODE_HMAC_SECRET` missing | `/verify-email` throws. Set the variable — this is a config fix, not a code rollback. |
| Website bundle broken | Roll back **only the Vercel deployment** to the step-0 hash. The hardened edge function stays. Subscribers with live sessions are unaffected; new sign-ins wait for a fixed bundle. |
| Billing portal 401s for real users | Check `credentials: "include"` survived the deploy (a test pins it). Fix forward. |

**Forward-only recovery path:** if the code flow proves unusable in production,
the correct emergency measure is to *temporarily* widen delivery (e.g. a second
email provider) — **not** to restore the vulnerable endpoints.

Because revocation is step 6, every rollback scenario before it leaves the 384
existing sessions intact, so current subscribers retain access throughout.

---

## 7. Session remediation

`scripts/revoke_premium_sessions.ts` — **dry run by default**, `--apply`
required.

Dry run output (verified, nothing deleted — table still 1,853 rows afterwards):

```
sessions in table ........... 1853
free (untouched) ............ 1162
premium already expired ..... 307 (untouched)
TARGETED for revocation ..... 384
distinct accounts affected .. 103
of which admin-verified ..... 0
```

Targeting predicate — all three must hold:
`key.startsWith("auth_session:")` AND `tier === "premium"` AND not expired.

Safety properties:
- Emails and tokens are **never printed**. Accounts appear as per-run salted
  SHA-256 digests, so the same account is recognisable within a report but not
  identifiable, and digests are not comparable across runs.
- The prefix filter is re-checked in code, not trusted from the query.
- Assertions abort before any delete if a target is outside
  `auth_session:` or is not premium.
- A manifest is written **before** deleting, containing key *digests* only, so
  it cannot be used to resurrect a session.
- Deletes go by exact key in batches of 50, then the script re-counts and
  reports remaining live premium sessions and the unchanged free count.
- `DELETE` syntax was validated against a key that cannot exist (HTTP 204)
  without touching real data.

Largest account holds 54 sessions (2026-06-13 → 2026-09-27), which is normal
accumulation: every sign-in mints a new session and nothing prunes them.

**Run this only after step 5 verifies**, so the 103 affected subscribers can
immediately sign back in.

---

## 8. GO / NO-GO

**GO — conditional on three things you must do.**

The patch is correct, isolated, and more thoroughly verified than the code it
replaces. Three live critical/high vulnerabilities make waiting the riskier
choice: right now anyone who knows a subscriber's email can take over their
account.

Conditions:
1. **Set `PREMIUM_CODE_HMAC_SECRET`** in the edge function env before
   deploying. Without it, nobody can sign in.
2. **Apply the migration before the function.** Reversed, code verification
   returns 500.
3. **Keep the step 3 → step 4 gap short.** In between, existing subscribers
   cannot complete a sign-in.

### Outstanding risks

| Risk | Severity | Mitigation |
|---|---|---|
| No Stripe test-mode E2E run | **Medium-high** | Single live key configured; creating a test key is a production change you did not approve. Mitigate with one controlled real account at step 3. |
| Code email deliverability to real inboxes untested | Medium | Resend verified working in production (202 from the admin path); premium reuses the identical client. Spam placement is unknown until a real send. |
| Sign-in friction is new | Medium | Subscribers who never entered a code before now must. Expect support contacts. The 10-minute expiry and 30s cooldown may frustrate some. |
| 103 subscribers must re-authenticate | Medium | Unavoidable given no provenance field. Sequenced last, after sign-in is proven working. |
| `/subscribe` still writes on an unproven email | Low | Mints no session, unreachable from the product. Deliberately unchanged. |
| No access logs | Low (informational) | Exploitation can be neither proven nor excluded. Revocation is the honest response. |
| `App.tsx` is 16k lines | Low here | This change is confined to two modal handlers and two fetch calls. |

### What I did not do

- Did not deploy, merge, revoke sessions, or modify any subscription.
- Did not set the secret in the production environment.
- Did not create a Stripe test-mode key.
- Did not touch `main`, which remains at `593358d8`.
