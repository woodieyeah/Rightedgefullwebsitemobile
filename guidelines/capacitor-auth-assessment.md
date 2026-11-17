# Capacitor iOS authentication assessment

Status: **assessment only — no backend change implemented.**
Branch: `feature/capacitor-api-compat`. Nothing deployed, no database or payment change.

## What was measured, not assumed

| Fact | Evidence |
|---|---|
| The session is read **only** from a cookie | `getAuthSessionFromRequest` → `parseCookieHeader(c.req.header("cookie"))`, `index.tsx:341`. The same pattern at `:429` for logout. No route reads `Authorization` for a user session. |
| The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` on https | `writeAuthSessionCookie`, `index.tsx:295-315` |
| CORS is a wildcard with **no** credentials allowance | `cors({ origin: "*" })` at `:513`; a live request returned `access-control-allow-origin: *` and **zero** `access-control-allow-credentials` headers |
| The edge function is reachable and answers the app's routes | `GET <edge>/auth/session` → `200 {"authenticated":false,...}` |
| The server honours a `Cookie` header when one is sent | `curl` with a deliberately invalid token returned `200 authenticated:false` — a completed round trip, correctly rejecting the token |
| The session token is a 256-bit random hex string, KV-keyed by token alone | `createAuthSessionToken` `:220`, `buildAuthSessionKey` `:57` |
| Session lifetime is 180 days | `AUTH_SESSION_MAX_AGE_SECONDS = 15_552_000` |
| Tiers are `free` / `premium`, carried on the session record | `AuthSessionTier` `:44`, entitlement resolved at `:611` |

## Why Phase 1 alone does not log anyone in

Phase 1 points native requests at the edge function. That is necessary and sufficient for the **11 public endpoints**. It is *not* sufficient for the other 18, for two independent reasons:

1. **`SameSite=Lax` blocks the cookie.** The native origin is `capacitor://localhost`; the cookie belongs to `.rightedge.com.au`. A Lax cookie is never attached to a cross-site request.
2. **Wildcard CORS forbids credentials.** Even with `credentials: "include"`, a browser refuses to attach cookies when the response says `Access-Control-Allow-Origin: *` and omits `Access-Control-Allow-Credentials: true`.

So a URL-only native build would show the marketing page, then fail every login, session check, checkout and admin call. `requiresSessionCredentials()` in `src/app/api-base.ts` names those 18 endpoints so the shell can refuse honestly instead of failing one request at a time.

## Rejected options, and why

**Set `Access-Control-Allow-Origin: capacitor://localhost` + `Allow-Credentials: true`.**
Rejected. It still fails — `SameSite=Lax` blocks it regardless of CORS — and reflecting an origin while allowing credentials widens the attack surface for the website that is currently protected by the wildcard's own refusal to carry cookies.

**Switch the cookie to `SameSite=None; Secure`.**
Rejected. This weakens CSRF protection for **existing paying web subscribers** to serve a build that does not yet exist. It is the insecure workaround the brief rules out.

**Set Capacitor's `iosScheme: 'https'`.**
Rejected. The origin becomes `https://localhost`, which collides with real web origins, and makes a broken proxy look usable. `isNativeOrigin()` deliberately classifies `https://localhost` as **web** for this reason, with a test pinning it.

**Store the session token in `localStorage` and send it as a bearer.**
Rejected as the primary design. It moves a 180-day credential into JavaScript-readable storage, which is strictly worse than `HttpOnly` and would be a regression if ever reused on the web.

## Recommended solution

**Add a native-only bearer path alongside the cookie — never replacing it.**

The backend change is small because the KV store is already keyed by the token alone:

```ts
// getAuthSessionFromRequest — additive
const cookies = parseCookieHeader(c.req.header("cookie"));
let token = cookies[AUTH_SESSION_COOKIE];

// Native clients cannot send a SameSite=Lax cookie cross-origin. Accept the
// same opaque token via a DEDICATED header, never the generic Authorization
// header (which already carries the Supabase anon key on these routes).
if (!token) token = c.req.header("x-rightedge-session") ?? "";
```

Then, for native clients only:

- Login responses additionally return the token in the JSON body **when the request identifies as native**, so the website's behaviour is untouched and no token is ever exposed to a browser that did not previously receive one.
- The iOS app stores it in the **iOS Keychain** (`@capacitor-community/sqlite` is not needed; `@capacitor/preferences` is backed by `UserDefaults` and is **not** appropriate for a credential — Keychain via a secure-storage plugin is).
- Every native request sends `x-rightedge-session: <token>`.
- `Access-Control-Allow-Headers` must add `x-rightedge-session`. The wildcard origin can stay, because a custom header is not a credential in the CORS sense — no `Allow-Credentials` is required.

**Properties preserved:**

- The web cookie path is completely unchanged: same `HttpOnly`, same `SameSite=Lax`, same CSRF posture, same 180-day lifetime. Existing subscribers are unaffected.
- A custom header cannot be attached by a cross-site form or image, so this does not reintroduce CSRF.
- Revocation already works — `clearAuthSession` deletes the KV record by token, so logout invalidates a native session identically.
- Admin routes keep `requireAdmin`; the email-code challenge is unchanged.

**Stripe needs separate handling.** `create-checkout-session` builds `returnUrl` from `window.location.origin` (`App.tsx:4501-4502`), which becomes `capacitor://localhost/...` and will not return the user to the app. The fix is an explicit https return URL plus `@capacitor/browser`, so checkout opens in a real browser with an address bar. **Apple also takes 30% on digital subscriptions sold in-app**, so premium sign-up almost certainly must stay on the website and the app should read entitlements only — that is a commercial decision, not a technical one.

## Verifiable without Xcode

- `resolveApiUrl` is an identity function on every web origin, asserted for all 29 endpoints across 5 realistic origins.
- Native origins route to the verified edge function with query strings and fragments preserved.
- No `/api` call site bypasses the resolver (asserted by scanning the source).
- The built bundle still contains the relative paths, and contains no service-role key.
- The edge function answers `/auth/session` and accepts a `Cookie` header.

## Requires a simulator

- That the app paints at all in WKWebView (a build that compiles can still render nothing).
- That `capacitor://localhost` is the actual runtime origin.
- That the 11 public endpoints return data in the shell.
- That the 18 session endpoints fail as predicted rather than in some other way.
- Keychain persistence across app restarts, once the bearer path exists.
