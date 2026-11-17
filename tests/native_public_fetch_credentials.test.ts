/**
 * Public /api/ reads must not send credentials in the native shell.
 *
 * THE BUG, caught on the simulator
 * The MATCHES dashboard opened natively (the public-access fix worked) but
 * showed no match cards. The redacted network overlay explained why: every
 * call to /round-results and /round-snapshots returned NETWORK_FAIL with no
 * status -- eight of them, ~305ms each.
 *
 * ROOT CAUSE
 * Both call sites pass `credentials: "include"`. The edge function replies
 * `Access-Control-Allow-Origin: *` with NO `Access-Control-Allow-Credentials`,
 * and a browser refuses a credentialed cross-origin request against a wildcard
 * origin -- the fetch rejects before any response exists, which is exactly the
 * statusless NETWORK_FAIL we saw. On the website the request is same-origin
 * (the /api/* Vercel rewrite), so CORS never applies and the flag is harmless;
 * natively the origin is capacitor://localhost, so it is fatal.
 *
 * Verified against production with no cookie:
 *   GET /round-results?round=31    -> 200
 *   GET /round-snapshots?round=31  -> 200
 * Both are public reads, so the credentials flag was never needed. Dropping it
 * natively is not a security change: nothing is being authorised, and the web
 * path is left exactly as it was.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { nativeSafeCredentials } from "../src/app/api-base.ts";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

test("a public path drops credentials only in the native shell", () => {
  // Under test isNativeShell() is false, so the web behaviour must be intact.
  assert.equal(nativeSafeCredentials("/api/round-results"), "include");
  assert.equal(nativeSafeCredentials("/api/round-snapshots"), "include");
});

test("session-dependent paths always keep credentials", () => {
  // These must never be weakened, on any platform.
  for (const p of [
    "/api/auth/session",
    "/api/verify-premium-code",
    "/api/create-customer-portal",
    "/api/admin/anything",
  ]) {
    assert.equal(nativeSafeCredentials(p), "include", `${p} lost its credentials`);
  }
});

test("the round endpoints route through the helper, not a bare literal", () => {
  for (const ep of ["round-results", "round-snapshots"]) {
    const i = app.indexOf(`/api/${ep}?round=`);
    assert.ok(i !== -1, `${ep} call site not found`);
    const call = app.slice(i, i + 420);
    assert.match(
      call,
      /credentials: nativeSafeCredentials\(/,
      `${ep} still hardcodes credentials and will NETWORK_FAIL natively`,
    );
  }
});

test("no public /api/ call site hardcodes credentials: \"include\"", () => {
  // A new call site added later must not reintroduce the failure.
  const publicPaths = ["round-results", "round-snapshots"];
  for (const p of publicPaths) {
    const idx = app.indexOf(`/api/${p}?round=`);
    const call = app.slice(idx, idx + 420);
    assert.doesNotMatch(call, /credentials:\s*"include"/);
  }
});
