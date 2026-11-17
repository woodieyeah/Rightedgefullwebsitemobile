# Security hotfix: final release plan

Branch: `security/premium-auth-review` @ `211dbdac`
Base: `main` @ `593358d8` (production, unchanged)
Status: **NOT deployed, NOT merged, no sessions revoked.** Awaiting approval.

---

## 1. SQL permissions — verified against the real database

### Text comparison with the known-good admin migration

All three new functions are structurally identical to
`20260823000000_atomic_admin_challenges.sql`:

| | premium (new) | admin (existing) |
|---|---|---|
| `create or replace function` | 3 | 3 |
| `security definer` | 3 | 3 |
| `set search_path = public, pg_temp` | 3 | 3 |
| `revoke all … from public, anon, authenticated` | 3 | 3 |
| `grant execute … to service_role` | 3 | 3 |

Every revoke and grant names the **full argument signature**, which matters: a
signature mismatch would silently leave the default `PUBLIC EXECUTE` in place.

### Actual privileges in the live database

Queried `pg_proc.proacl` for the existing admin functions, deployed with the
identical pattern:

```
cancel_admin_challenge_f8a832e3   secdef=true  search_path=public, pg_temp
  acl: postgres=X/postgres | service_role=X/postgres
issue_admin_challenge_f8a832e3    secdef=true  search_path=public, pg_temp
  acl: postgres=X/postgres | service_role=X/postgres
verify_admin_challenge_f8a832e3   secdef=true  search_path=public, pg_temp
  acl: postgres=X/postgres | service_role=X/postgres
```

**No `anon`, no `authenticated`, no bare `=X` (PUBLIC) entry.** `proacl` being
non-null is itself the proof: a function left at default privileges has
`proacl = NULL`, meaning PUBLIC holds EXECUTE. The explicit revoke is what
populates the ACL.

Because the premium migration uses byte-identical revoke/grant structure it
will produce the same ACL. **This must be re-verified after applying it** —
gate query included in step 2.

### Supabase security advisors

Current findings, all pre-existing and unrelated to this change:

| Finding | Level | Count | Status |
|---|---|---|---|
| `security_definer_view` (`public_fixtures`, `public_picks`, `public_player_headshots`) | ERROR | 3 | Pre-existing — the intentional RLWC read views |
| `rls_enabled_no_policy` | INFO | 9 | Pre-existing — deny-by-default is the intent; `anon` reaches data only via views |
| `auth_leaked_password_protection` | WARN | 1 | Pre-existing, unrelated (no Supabase Auth passwords in use) |

**Notably absent: `function_search_path_mutable`** — confirming the existing
`SECURITY DEFINER` functions are correctly pinned and the new ones follow the
same form. Re-run advisors after the migration.

---

## 2. Real PostgreSQL verification

No local Postgres, Docker or Supabase CLI exists in this environment, so I
created an isolated `hotfix_verify` schema in the project database, ran the
function bodies against **real Postgres**, and dropped the schema afterwards.
Production tables were never touched — verified after cleanup at **1,853
sessions / 164 subscriber records / 0 premium challenges**, identical to before.

### A real hazard found and fixed

`PERFORM` also sets `FOUND` in PL/pgSQL. Demonstrated directly:

```
FOUND after SELECT INTO (no row) = false
FOUND after PERFORM pg_sleep(0)  = true
```

My functions used `if not found then return 'invalid'`. Production was
*accidentally* correct because nothing sat between the `SELECT INTO` and the
check — but one added log line would have silently broken it, and a missing
challenge would then report **`expired` instead of `invalid`**, because
`(null->>'issuedAt')::bigint` coalesces to `0` and looks ancient.

All three functions now test the variable explicitly (`challenge is null`,
`existing_value is null`). This was observed live: the first race test returned
`expired` for losing workers; after hardening the same test returns `invalid`.

### Sequential logic, real jsonb and casts

```
issue first ........................ true
reissue inside 30s cooldown ........ false   (cooldown enforced in SQL)
wrong guess ........................ invalid
right hash + WRONG email ........... invalid (non-transferable)
attempts after 5 wrong guesses ..... 1,2,3,4,5 then locked
correct code after cap ............. locked
correct code (fresh challenge) ..... success
replay of the same correct code .... invalid (single use)
rows left .......................... 0       (consumed)
```

### Genuine concurrency — parallel HTTP connections, not mocks

Six parallel connections, each holding the advisory lock 1.2s, all submitting
the **correct** code:

```
worker1 invalid   worker4 invalid
worker2 invalid   worker5 invalid
worker3 invalid   worker6 success
→ successes: 1    invalid: 5    expired: 0
```

Without the lock all six would have succeeded. Twenty parallel **wrong**
guesses against a cap of 5, with the charge site instrumented to count only
attempts actually debited:

```
attempts_actually_charged = 5   cap = 5   cap_held = true
challenge_rows_left = 0
```

**The 5-attempt cap holds under 20× parallel load** — the guarantee the
original read-modify-write implementation could not provide.

---

## 3. Rollback — corrected

### Your concern was right, and worse than stated

I downloaded the live production bundle (`/assets/index-D6bfwJl9.js`,
731,982 bytes) and grepped it:

| | occurrences |
|---|---|
| `verificationRequired` | **0** |
| `verify-premium-code` | **0** |
| `instantAccess` | 1 |

The live code is:

```js
A = !!($.instantAccess || $.activeSubscriber || $.active_subscriber
       || $.subscribed || $.active);
if (E.ok && A) { /* calls onSessionRefresh, expects a premium cookie */ }
```

With the original patch (`active: true`), a rolled-back or merely **cached**
bundle would set `A = true`, call `onSessionRefresh()`, find no premium cookie,
and stop at *"could not restore the secure session"* — a dead end for every
subscriber. A frontend-only rollback was not a safe recovery option.

### Two changes make the backend degrade safely

1. **`/verify-email` now returns `active: false`.** No legacy unlock flag is
   ever truthy, so a stale client falls through instead of dead-ending. Second
   benefit: both the subscriber and non-subscriber branches now answer
   `active: false`, so the endpoint **no longer leaks whether an address holds
   a subscription**.
2. **The `alreadySubscribed` branch carries a human-readable `error` string.**
   The old bundle looks for `url`, finds none, and renders `error` — so it
   shows *"We emailed you a 6-digit access code… or reload this page"* rather
   than a bogus "Could not start checkout".

Check order in the new client was verified: `alreadySubscribed` is read
**before** `url` and `error`, so the compatibility field is never mistaken for
a failure.

### The compatibility matrix decides the deploy order

| | old backend | new backend |
|---|---|---|
| **old bundle** | works (today) | degrades to a readable instruction |
| **new bundle** | **works** — falls through to checkout, old backend still grants | works |

The new bundle is compatible with **both** backends; the old bundle is not.
**Therefore the website ships FIRST, then the function.** My previous plan had
this backwards.

### Secure recovery procedure

| Failure | Action | Never |
|---|---|---|
| Website bundle broken after step 3 | Roll Vercel back to the step-0 hash. Old bundle + old backend is still intact, because the function has not shipped yet. | — |
| Function misbehaving after step 4 | **Keep the patched function.** Fix forward. The old bundle still receives actionable instructions, so subscribers are not dead-ended. | Do not redeploy the pre-patch function |
| Codes not arriving | Fix Resend / sender config. Existing sessions still work — revocation has not run. | Do not restore email-only grant |
| Verification returns 500 | Migration not applied or RPC grant missing. Re-run step 2. | Do not bypass the RPC |
| Secret missing | Set `PREMIUM_CODE_HMAC_SECRET`. Config fix, not a code rollback. | Do not add a default secret |
| Total failure, access must be restored urgently | Issue codes admin-initiated, or extend specific sessions. | **Never** redeploy `createInstantAccessUrl` or the email-only `createAuthSession` |

`tests/deploy_compatibility.test.ts` (6 tests) pins both halves of the matrix
and asserts no rollback target can restore an email-only premium grant.

---

## 4. Final deployment sequence

`scripts/verify_release_gates.ts` automates the checks at each step.

```
STEP 0  RECORD THE ROLLBACK POINT
        curl -s https://rightedge.com.au/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | tail -1
        Current: /assets/index-D6bfwJl9.js
        Note the current Vercel deployment id as the rollback target.

STEP 1  SET THE SECRET            (Supabase dashboard -> Edge Functions -> Secrets)
        PREMIUM_CODE_HMAC_SECRET = <64-char value in ~/.hermes/.env, mode 600>
        Nothing deployed. No customer impact.
        The value has never been printed to chat and is not in the repo.

STEP 2  APPLY THE MIGRATION
        supabase/migrations/20261117000000_atomic_premium_challenges.sql
        Then VERIFY the real ACLs:
          select proname, prosecdef, proconfig,
                 array_to_string(proacl::text[], ' | ') as acl
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and proname like '%premium_challenge%';
        REQUIRE for all three: prosecdef = true,
          proconfig = {search_path=public, pg_temp},
          acl contains service_role=X and NOT anon / authenticated / bare =X
        Re-run the security advisors; expect no new findings.
        SAFE TO STOP — the functions exist but nothing calls them.

STEP 3  DEPLOY THE WEBSITE FIRST            (merge to main; Vercel ships main)
        The new bundle works against the CURRENT backend, so subscribers are
        unaffected and sign-in continues exactly as today.
        Verify the live bundle hash changed from step 0.
        FULLY REVERSIBLE: roll Vercel back; old bundle + old backend intact.

STEP 4  DEPLOY THE EDGE FUNCTION
        supabase functions deploy make-server-3b84b96c
        npx tsx scripts/verify_release_gates.ts --stage post
        REQUIRE: RPCs present, /verify-premium-code exists, verify-email not
        500, portal and retention 401, checkout still returns a Stripe URL,
        no legacy flag leak, 0 instant_access tokens.
        This is the step that closes the vulnerabilities.

STEP 5  PROVE LEGITIMATE LOGIN WITH A CONTROLLED ACCOUNT
        Using one subscriber account you control:
          a. request a code      -> confirm the email ARRIVES
          b. enter a wrong code  -> 400
          c. enter the real code -> premium restored, plays visible
          d. open the billing portal -> loads
          e. log out, log back in with a fresh code
        Also confirm a NEW customer can complete Stripe checkout.
        DO NOT PROCEED TO STEP 6 UNTIL (a)-(e) PASS.

STEP 6  RECHECK, THEN REVOKE
        npx tsx scripts/revoke_premium_sessions.ts            # recount first
        Confirm the target count is still ~384 and free/expired untouched.
        npx tsx scripts/revoke_premium_sessions.ts --apply
        Then sign in again with the controlled account to prove recovery.
```

**Why this order minimises interruption:** steps 1–3 are invisible to
subscribers. The only behaviour change lands at step 4, and from that instant
the new bundle — already live — handles it correctly. Any subscriber on a
cached old bundle gets a readable instruction to reload rather than a dead end.

---

## 5. Session remediation

`scripts/revoke_premium_sessions.ts` — **dry run by default**, `--apply`
required. Latest dry run (nothing deleted; table still 1,853 afterwards):

```
sessions in table ........... 1853
free (untouched) ............ 1162
premium already expired ..... 307 (untouched)
TARGETED for revocation ..... 384
distinct accounts affected .. 103
of which admin-verified ..... 0
```

Predicate — all three must hold: `key` starts with `auth_session:` AND
`tier === "premium"` AND not expired.

Safety properties:
- Emails and tokens are **never printed**; accounts appear as per-run salted
  SHA-256 digests (not comparable across runs).
- The prefix filter is re-checked in code, not trusted from the query.
- Hard assertions abort before any delete if a target is outside
  `auth_session:` or is not premium.
- A manifest of key **digests** is written before deleting, so an interrupted
  run is auditable and the manifest cannot resurrect a session.
- Deletes go by exact key in batches of 50, then the script re-counts and
  reports remaining live premium sessions **and** the unchanged free count.
- `DELETE` syntax validated against a key that cannot exist (HTTP 204).
- **The count is rechecked at run time**, so a stale 384 is never assumed.

---

## 6. Verification summary

| Check | Result |
|---|---|
| Test suite | **625 pass, 0 fail** (587 at session start) |
| Production build | clean, 1.24s |
| Flow verification | **40/40 checks, 5 flows** |
| Deploy compatibility | **6/6** |
| Concurrency (real Postgres, parallel HTTP) | 1 success of 6; 5 charges of 20 |
| SQL ACLs (pattern, on the live DB) | `service_role=X` only |
| Security advisors | no new findings |
| Committed linux binaries | 0 deletions, 0 modifications |
| Production data after testing | 1,853 sessions / 164 subscribers — unchanged |
| Secrets in repo or chat | none |

---

## 7. Still untested

1. **Actual email delivery to a real inbox.** Resend is confirmed working in
   production (`/auth/admin/request` → 202) and the premium code reuses the
   same `getResendClient()` / `getFromEmail()`, but no premium code has been
   sent. Spam placement unknown. **Step 5a covers this.**
2. **Stripe test-mode end-to-end.** Only one live `STRIPE_SECRET_KEY` is
   configured; creating a test key and customer would itself be a production
   configuration change. Mitigated by one controlled real account at step 5 —
   the largest remaining gap.
3. **The premium RPCs' ACLs after the real migration.** Verified by pattern
   against the identical admin functions; the step-2 gate query confirms the
   actual values.
4. **The deployed function's runtime behaviour.** All endpoint verification so
   far is static, or against the *current, vulnerable* deployment.
5. **Logout and entitlement restoration in a browser.** Covered statically
   (logout clears local state before the network call; the client re-reads the
   session before unlocking) but not clicked through. Step 5c–e.
6. **Concurrency against the production RPCs.** Proven on identical function
   bodies in the same database engine, not against the deployed functions.

---

## 8. GO / NO-GO

**GO**, with the revised order and three conditions.

The vulnerabilities are live: anyone who knows a subscriber's email can take
over that account right now, and `/create-checkout-session` returns a live
`cs_live_` Stripe URL to an unauthenticated caller. Waiting is the larger risk.

Conditions:
1. **Secret before migration before function** (steps 1→2→4).
2. **Website before function** (step 3 before step 4) — reversed from my
   earlier plan, because the old bundle cannot handle the new backend.
3. **Step 5 must pass before step 6.** Do not revoke until a controlled
   account has signed in with a real emailed code.

### Outstanding risks

| Risk | Severity | Mitigation |
|---|---|---|
| No Stripe test-mode E2E | **Medium-high** | One controlled real account at step 5; new-customer checkout verified to still return a Stripe URL at every gate |
| Email deliverability / spam placement | Medium | Resend proven working; step 5a is a real send |
| New sign-in friction | Medium | Expect support contacts. 10-minute expiry, 30s cooldown, 5 attempts |
| 103 subscribers re-authenticate | Medium | Unavoidable (no provenance field). Sequenced last, after sign-in is proven |
| Cached old bundles after step 4 | Low | Now degrade to a readable instruction instead of a dead end |
| `/subscribe` writes on an unproven email | Low | Mints no session, unreachable from the product. Unchanged deliberately |
| No access logs | Low (informational) | Exploitation can be neither proven nor excluded; revocation is the honest response |

### What I have not done

- Not deployed, merged, revoked a session, or modified any subscription.
- Not set the secret in the production environment.
- Not created a Stripe test-mode key.
- Not left any test artefact in the database (`hotfix_verify` schema and both
  temporary probe functions dropped and verified gone).
- `main` remains at `593358d8`.
