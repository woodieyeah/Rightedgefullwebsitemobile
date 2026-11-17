/**
 * Where an /api/* request should actually go.
 *
 * THE WEBSITE IS THE DEFAULT AND MUST NOT CHANGE.
 * On any http(s) origin every path is returned exactly as given, so the
 * existing Vercel rewrite in vercel.json keeps serving it. Production
 * behaviour is identical with this module in place.
 *
 * THE NATIVE SHELL IS THE EXCEPTION.
 * Capacitor serves the bundle from `capacitor://localhost`. vercel.json does
 * not exist inside the binary, so a relative "/api/..." resolves to
 * capacitor://localhost/api/... and fails. Native builds therefore address
 * the edge function directly.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * It does not try to make authenticated calls work. The backend reads the
 * session only from an HttpOnly, SameSite=Lax cookie
 * (getAuthSessionFromRequest -> parseCookieHeader), and the function replies
 * with `Access-Control-Allow-Origin: *` and no `Access-Control-Allow-
 * Credentials`. A browser will not attach cookies to a wildcard origin
 * cross-origin, and SameSite=Lax would block them anyway. Rewriting the URL
 * alone would turn "logged in" into a silent 401 wall.
 *
 * `requiresSessionCredentials` names those endpoints so the native build can
 * refuse to pretend, rather than failing one request at a time. Resolving
 * that properly is a backend decision — see
 * guidelines/capacitor-auth-assessment.md.
 *
 * Nothing secret belongs here: this file ships in the client bundle. The base
 * URL is public, exactly as the anon key already is.
 */

/** The verified edge function base (confirmed answering /auth/session 200). */
export const EDGE_FUNCTION_BASE =
  "https://spahmuawycgohcznathc.supabase.co/functions/v1/make-server-3b84b96c";

/**
 * Non-http(s) schemes used by the native shells.
 *
 * `https://localhost` is NOT in this list: it is a legitimate web origin, and
 * treating it as native would route a real browser down the cross-origin
 * path. That is also why Capacitor's `iosScheme: 'https'` option is avoided.
 */
const NATIVE_SCHEMES = ["capacitor:", "ionic:", "file:"];

/**
 * Is this origin a native shell?
 *
 * Anything unreadable or malformed is treated as WEB. Defaulting to native
 * would send the production website cross-origin and break every
 * authenticated request, so the safe default is the status quo.
 */
export function isNativeOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  const value = String(origin).trim().toLowerCase();
  if (!value) return false;
  return NATIVE_SCHEMES.some((scheme) => value.startsWith(scheme));
}

/** The current origin, or "" when there is no DOM (tests, SSR, scripts). */
function currentOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.origin ?? "";
  } catch {
    return "";
  }
}

/**
 * Resolve an API path for the platform it is running on.
 *
 * Returns relative paths unchanged on the web. Only a path beginning
 * "/api/" is ever rewritten; asset paths and absolute URLs pass through on
 * every platform. Query strings and hash fragments are preserved verbatim.
 */
export function resolveApiUrl(path: string, origin: string = currentOrigin()): string {
  if (typeof path !== "string" || !path.startsWith("/api/")) return path;
  if (!isNativeOrigin(origin)) return path;

  // "/api/round-results?round=27" -> "<base>/round-results?round=27"
  return `${EDGE_FUNCTION_BASE}${path.slice("/api".length)}`;
}

/**
 * Endpoints whose handler reads the session cookie, requires verified
 * identity, or establishes a session server-side.
 *
 * Derived from the edge function: every /admin/* route passes through
 * requireAdmin, and these named routes call getAuthSessionFromRequest,
 * clearAuthSession, writeAuthSessionCookie, demand identityVerified, or build
 * a Stripe session for the signed-in customer. A URL rewrite is not sufficient
 * for any of them.
 *
 * DO NOT hand-maintain this list from memory. tests/api_base_session_coverage
 * .test.ts re-derives it from the backend and fails when a newly gated route
 * is missing -- which is how /verify-premium-code (the actual login endpoint,
 * added by the premium-auth security work) was caught after this file was
 * first written.
 */
const SESSION_DEPENDENT = new Set([
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/admin/request",
  "/api/auth/admin/verify",
  "/api/round-snapshot",
  "/api/apply-retention-offer",
  "/api/create-checkout-session",
  "/api/create-customer-portal",
  "/api/confirm-checkout-session",
  // Added by the identity-verification hotfix: redeeming an emailed code is
  // what mints a verified session, and free registration both reads a
  // presented session (same-address tier carry-over) and writes a cookie.
  "/api/verify-premium-code",
  "/api/register-free-access",
]);

export function requiresSessionCredentials(path: string): boolean {
  if (typeof path !== "string") return false;
  const clean = path.split("?")[0].split("#")[0];
  if (clean.startsWith("/api/admin/")) return true;
  return SESSION_DEPENDENT.has(clean);
}

/**
 * fetch() with the platform-correct URL.
 *
 * A drop-in replacement for `fetch` at an /api/ call site: identical
 * signature, identical return value, no added error handling so existing
 * per-call-site handling keeps working unchanged.
 *
 * `credentials: "include"` is preserved when a caller already sets it. On the
 * web that is what keeps the session working today. Natively it has no
 * effect against a wildcard-CORS origin, which is why Phase 2 exists rather
 * than this function papering over it.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(resolveApiUrl(path), init);
}
