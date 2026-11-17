/**
 * SESSION_DEPENDENT must not rot.
 *
 * The native shell cannot carry the session cookie (HttpOnly + SameSite=Lax +
 * wildcard CORS with no allow-credentials), so `requiresSessionCredentials`
 * tells it which endpoints to refuse rather than fail one request at a time.
 *
 * A hand-written list is a snapshot. It went stale the moment the security
 * work added /verify-premium-code -- the actual login endpoint -- and nothing
 * caught it, because the list cannot know the backend changed.
 *
 * So derive the expectation FROM the edge function: any route whose handler
 * reads a session, demands verified identity, enforces admin, or writes the
 * session cookie is session-dependent and must be listed. This test fails when
 * the backend grows a new gated route, which is exactly when it matters.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { requiresSessionCredentials } from "../src/app/api-base.ts";

const server = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);

/** Every route declared in the edge function, with its handler body. */
function routes(): { path: string; body: string }[] {
  const re = /app\.(post|get|put|delete)\("([^"]+)"/g;
  const found: { path: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(server))) found.push({ path: m[2], start: m.index });
  return found.map((r, i) => ({
    path: r.path,
    body: server.slice(r.start, found[i + 1]?.start ?? server.length),
  }));
}

/** Does this handler depend on, or establish, a session? */
function isGated(body: string): boolean {
  return (
    /getAuthSessionFromRequest/.test(body) ||
    /identityVerified !== true/.test(body) ||
    /requireAdmin|isVerifiedAdminSession/.test(body) ||
    /writeAuthSessionCookie|clearAuthSession/.test(body)
  );
}

test("every session-gated backend route is declared session-dependent", () => {
  const missing: string[] = [];
  for (const r of routes()) {
    if (!isGated(r.body)) continue;
    // The middleware covers /admin/* wholesale; the helper special-cases it.
    if (r.path.startsWith("/admin/")) continue;
    if (!requiresSessionCredentials(`/api${r.path}`)) missing.push(r.path);
  }
  assert.deepEqual(
    missing,
    [],
    `session-gated routes missing from SESSION_DEPENDENT: ${missing.join(", ")}`,
  );
});

test("the admin namespace is covered without enumerating each route", () => {
  const adminRoutes = routes().filter((r) => r.path.startsWith("/admin/"));
  assert.ok(adminRoutes.length > 0, "no /admin/* routes found in the function");
  for (const r of adminRoutes) {
    assert.equal(
      requiresSessionCredentials(`/api${r.path}`),
      true,
      `${r.path} is not treated as session-dependent`,
    );
  }
});

test("the login endpoint that the security work added is covered", () => {
  // Regression: this is the endpoint the stale list missed.
  assert.equal(requiresSessionCredentials("/api/verify-premium-code"), true);
  assert.equal(requiresSessionCredentials("/api/register-free-access"), true);
});

test("public endpoints are NOT marked session-dependent", () => {
  // Over-marking would make the native shell refuse content it can serve.
  for (const path of ["/api/scores", "/api/health", "/api/round-results"]) {
    assert.equal(
      requiresSessionCredentials(path),
      false,
      `${path} is wrongly treated as session-dependent`,
    );
  }
});

test("query strings and fragments do not defeat the check", () => {
  assert.equal(requiresSessionCredentials("/api/auth/session?x=1"), true);
  assert.equal(requiresSessionCredentials("/api/admin/subscribers?page=2"), true);
  assert.equal(requiresSessionCredentials("/api/scores?round=27"), false);
});
