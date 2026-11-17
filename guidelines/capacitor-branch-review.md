# Capacitor branch review against the patched authentication architecture

Reviewed: `feature/capacitor-api-compat` @ `553937e4`
Against: `main` @ `9f2e2070` (Edge Function v199, identity verification live)
Date: 2026-11-17

## Verdict

**The branch is still valid and does not conflict with the security work.** It
changes no backend file, so nothing in it weakens or re-opens the patched
authentication. Merge analysis is clean. Two corrections are needed before the
simulator milestone, both client-side.

## 1. Does the branch touch production authentication?

**No.** `git diff main...feature/capacitor-api-compat` shows **0** files under
`supabase/functions/`. The branch is confined to:

- `src/app/api-base.ts` (new), its tests, and 21 call sites rewritten to use it
- `ios/` scaffolding, `capacitor.config.json`, `package.json`
- `scripts/audit_api_native_compat.ts`, `guidelines/capacitor-auth-assessment.md`

`resolveApiUrl` is an identity function on every http(s) origin, so the website
is provably unchanged. This satisfies the standing constraint: **no production
authentication change to accommodate the native app.**

## 2. Merge state

| | |
|---|---|
| Merge base | `593358d8` |
| Branch is behind main by | **15 commits** |
| `git merge-tree` result | **clean, exit 0** |
| Files modified by BOTH branches | **`src/app/App.tsx`** only |

`App.tsx` is the one real integration point: the security work added the
premium code modal and `credentials: "include"` there, while the branch
rewrote its `/api/` call sites. Git merges them without conflict because the
edits are in different regions, but the result must be re-tested, not assumed.

## 3. Correction required — `SESSION_DEPENDENT` is stale

The branch classified endpoints before the identity patch existed. Current
reality on `main`:

```
/auth/session               session=Y  admin=Y
/auth/logout                           admin=Y
/auth/admin/verify                              setsCookie=Y
/register-free-access       session=Y           setsCookie=Y
/verify-premium-code                            setsCookie=Y   <-- MISSING
/create-customer-portal     session=Y  identity=Y
/apply-retention-offer      session=Y  identity=Y
/confirm-checkout-session                       setsCookie=Y
/admin/round-results                   admin=Y
```

Missing from the branch's list:

- **`/api/verify-premium-code`** — did not exist when the branch was written.
  It is now *the* login endpoint and sets the session cookie.
- **`/api/register-free-access`** — now reads a session (for same-address tier
  carry-over) and sets a cookie.
- **`/api/verify-email`** — issues the emailed challenge; needs no session, but
  belongs in the native login path.

`/api/create-checkout-session` and `/api/round-snapshot` are listed but no
longer read a session; harmless (the flag only triggers a warning) but
inaccurate.

## 4. The native authentication problem is now sharper, not harder

The identity patch makes the native requirement **clearer**:

- Billing endpoints demand `identityVerified === true`, set only by a redeemed
  emailed code or the admin challenge.
- The flag lives on the server-side session record, keyed by token alone.

So a native client that can present a valid session token gets the correct
entitlement automatically — **no backend change is needed for native login to
behave correctly**, once the token can travel. The blocker is unchanged and is
transport, not authorisation:

1. The session is read only from an `HttpOnly` cookie (`parseCookieHeader`).
2. The function replies `Access-Control-Allow-Origin: *` with **no**
   `Access-Control-Allow-Credentials`.
3. `SameSite=Lax` blocks cross-site attachment regardless.

WKWebView will not attach that cookie from `capacitor://localhost`. Two
independent blockers, neither fixable by changing a URL.

**Still rejected** (unchanged from the earlier assessment): `SameSite=None`
weakens security for existing subscribers; `iosScheme: 'https'` collides with
real web origins; and exposing the 180-day web token on a client-supplied
`native` flag is unsafe because any web caller could claim to be native.

**Still required** for Phase 2, when it is authorised: separate, scoped native
credentials — short-lived access token (~1h) plus a Keychain refresh token,
independently revocable, never accepted on web routes, issued **only** after
the verified emailed-code flow. That is a backend change and is explicitly
**out of scope** for the simulator milestone below.

## 5. Next milestone — "RightEdge renders in the iPhone simulator"

Deliberately scoped to **public, unauthenticated** content so it needs no
backend change and no Phase 2 decision.

### Definition of done

The app launches in an iPhone simulator and **paints real fixtures and picks**
fetched from the live edge function, verified by screenshot — not by
`BUILD SUCCEEDED`.

### Steps

1. **Merge `main` into the branch** and re-run the full suite. Expect the
   `App.tsx` auto-merge to need review, specifically that the premium modal's
   fetches went through `resolveApiUrl` and kept `credentials: "include"`.
2. **Refresh `SESSION_DEPENDENT`** per section 3, and add a test that every
   route the edge function gates (`identityVerified !== true`, `requireAdmin`,
   or `getAuthSessionFromRequest`) appears in the list — so the list cannot
   silently rot again. This is the durable fix, not a one-off edit.
3. **Gate the premium UI natively.** With no cookie transport, the native shell
   must present the free experience and route sign-in out to the website via
   `@capacitor/browser` rather than showing a login that cannot work.
4. **Service worker + resume refresh.** Skip SW registration when
   `Capacitor.isNativePlatform()`, and add an `appStateChange` listener so
   backgrounded timers resume (matters for live scores).
5. **Build, install, launch, screenshot.** Confirm fixtures actually render.
6. **Prove reachability** with a deliberately invalid request and read the
   status off-screen: a real `400`/`401` body proves a completed round trip.

### Blocker: disk space

```
/  228Gi total, 380Mi free (97% used)
```

Xcode needs **~17 GB** (plus ~7 GB for the iOS 26 simulator runtime, which
Xcode 26 no longer bundles). A worktree checkout failed mid-operation during
this review with `No space left on device` — the repo was verified intact
afterwards, but this is now actively breaking tooling, not merely blocking
Xcode. **Free space before any native work.**

Note: `node_modules` is tracked in this repo (75,258 files) and its committed
linux binaries are load-bearing for the Vercel build, so it cannot simply be
deleted. Reclaim elsewhere.

### Not in this milestone

Native authenticated sessions, push notifications, App Store submission,
`SameSite` changes, and any edge-function modification.
