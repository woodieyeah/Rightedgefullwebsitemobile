/**
 * API URL resolution across the website and the native iOS shell.
 *
 * On the website every call stays a relative "/api/..." path so the existing
 * Vercel rewrite keeps serving it — production behaviour must not change.
 *
 * In the Capacitor shell the origin is "capacitor://localhost" and there is
 * no Vercel rewrite inside the binary, so a relative path resolves to
 * capacitor://localhost/api/... and fails. Native builds must target the
 * verified edge function directly.
 *
 * The resolver only rewrites the URL. It deliberately does NOT attempt to
 * carry the session: the backend reads it exclusively from an HttpOnly
 * SameSite=Lax cookie and the function answers with Access-Control-Allow-
 * Origin: * and no Allow-Credentials, so a browser will not attach cookies
 * cross-origin. That is Phase 2 and needs a backend decision.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveApiUrl,
  isNativeOrigin,
  EDGE_FUNCTION_BASE,
  requiresSessionCredentials,
} from "../src/app/api-base.ts";

test("the website keeps relative paths untouched", () => {
  for (const origin of ["https://rightedge.com.au", "http://localhost:5173"]) {
    assert.equal(resolveApiUrl("/api/auth/session", origin), "/api/auth/session");
    assert.equal(resolveApiUrl("/api/live-odds", origin), "/api/live-odds");
  }
});

test("a capacitor origin targets the edge function", () => {
  assert.equal(
    resolveApiUrl("/api/auth/session", "capacitor://localhost"),
    `${EDGE_FUNCTION_BASE}/auth/session`,
  );
});

test("query strings survive the rewrite", () => {
  assert.equal(
    resolveApiUrl("/api/round-results?round=27", "capacitor://localhost"),
    `${EDGE_FUNCTION_BASE}/round-results?round=27`,
  );
  assert.equal(
    resolveApiUrl("/api/cricket-live-odds?a=1&b=2", "capacitor://localhost"),
    `${EDGE_FUNCTION_BASE}/cricket-live-odds?a=1&b=2`,
  );
});

test("nested admin paths keep their full shape", () => {
  assert.equal(
    resolveApiUrl("/api/admin/broadcast/validate-recipients", "capacitor://localhost"),
    `${EDGE_FUNCTION_BASE}/admin/broadcast/validate-recipients`,
  );
});

test("a hash fragment is preserved", () => {
  assert.equal(
    resolveApiUrl("/api/x#frag", "capacitor://localhost"),
    `${EDGE_FUNCTION_BASE}/x#frag`,
  );
});

test("a non-/api path is returned unchanged on every platform", () => {
  for (const origin of ["https://rightedge.com.au", "capacitor://localhost"]) {
    assert.equal(resolveApiUrl("/assets/app.js", origin), "/assets/app.js");
    assert.equal(resolveApiUrl("https://example.com/x", origin), "https://example.com/x");
  }
});

test("the ionic scheme counts as native too", () => {
  assert.equal(isNativeOrigin("ionic://localhost"), true);
  assert.equal(isNativeOrigin("capacitor://localhost"), true);
  assert.equal(isNativeOrigin("file://"), true);
});

test("http and https origins are never native", () => {
  assert.equal(isNativeOrigin("https://rightedge.com.au"), false);
  assert.equal(isNativeOrigin("http://localhost:5173"), false);
  // https://localhost is a real web origin: treating it as native would
  // silently route a browser through the cross-origin path.
  assert.equal(isNativeOrigin("https://localhost"), false);
});

test("a missing or malformed origin is treated as web, not native", () => {
  // Defaulting to native would break the production website if the origin
  // could not be read. Web is the safe default.
  assert.equal(isNativeOrigin(""), false);
  assert.equal(isNativeOrigin(undefined), false);
  assert.equal(isNativeOrigin("not an origin"), false);
});

test("the edge function base is the verified endpoint and carries no secret", () => {
  assert.match(
    EDGE_FUNCTION_BASE,
    /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/make-server-3b84b96c$/,
  );
  // A service-role key is a JWT; the base URL must never contain one.
  assert.doesNotMatch(EDGE_FUNCTION_BASE, /eyJ/);
  assert.doesNotMatch(EDGE_FUNCTION_BASE, /service_role|apikey|secret/i);
});

test("session-dependent endpoints are flagged for Phase 2", () => {
  // These read the HttpOnly cookie server-side, so a URL swap is not enough.
  for (const path of [
    "/api/auth/session",
    "/api/auth/logout",
    "/api/admin/subscribers",
    "/api/create-checkout-session",
    "/api/round-snapshot",
  ]) {
    assert.equal(requiresSessionCredentials(path), true, path);
  }
});

test("public endpoints are not flagged", () => {
  for (const path of ["/api/live-odds", "/api/scores", "/api/track-event", "/api/verify-email"]) {
    assert.equal(requiresSessionCredentials(path), false, path);
  }
});
