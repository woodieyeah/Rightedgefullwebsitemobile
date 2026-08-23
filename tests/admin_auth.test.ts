import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  canIssueAdminChallenge,
  createAdminChallenge,
  generateAdminCode,
  getAdminCodeHash,
  getAdminSessionAbsoluteExpiry,
  getAdminSessionRemainingMaxAge,
  isAllowedAdminEmail,
  isVerifiedAdminSession,
  normalizeAdminCode,
  requireAdminCodeHmacSecret,
  verifyAdminChallenge,
} from "../supabase/functions/server/admin_auth.ts";

const TEST_HMAC_SECRET = "test-only-admin-code-hmac-secret-with-32-bytes";
const adminAuthSource = readFileSync(
  new URL("../supabase/functions/server/admin_auth.ts", import.meta.url),
  "utf8",
);

test("admin sessions expire after eight hours", () => {
  assert.equal(ADMIN_SESSION_MAX_AGE_SECONDS, 8 * 60 * 60);
  assert.equal(
    getAdminSessionAbsoluteExpiry(1_000),
    1_000 + 8 * 60 * 60 * 1000,
  );
});

test("admin session renewal is capped by immutable creation time", () => {
  assert.equal(getAdminSessionRemainingMaxAge(1_000, 2_000), 28_799);
  assert.equal(getAdminSessionRemainingMaxAge(1_000, 1_000 + 8 * 60 * 60 * 1000), 0);
  assert.equal(getAdminSessionRemainingMaxAge(Number.NaN, 2_000), 0);
});

test("admin code hashing matches the hash stored in a challenge", async () => {
  const challenge = await createAdminChallenge("elliott@rightedge.com.au", "ABCD2345", 1_000, TEST_HMAC_SECRET);
  assert.equal(
    await getAdminCodeHash("elliott@rightedge.com.au", "ABCD2345", TEST_HMAC_SECRET),
    challenge.codeHash,
  );
  assert.notEqual(
    await getAdminCodeHash(
      "elliott@rightedge.com.au",
      "ABCD2345",
      "different-test-secret-with-32-bytes",
    ),
    challenge.codeHash,
  );
});

test("admin code hashing fails closed without the server secret", async () => {
  await assert.rejects(
    getAdminCodeHash("elliott@rightedge.com.au", "ABCD2345", ""),
    /HMAC secret is not configured/,
  );
});

test("admin code HMAC secret must contain at least 32 bytes", () => {
  assert.throws(() => requireAdminCodeHmacSecret("too-short"), /at least 32 bytes/);
  assert.equal(
    requireAdminCodeHmacSecret("a-secure-admin-code-secret-with-32-bytes"),
    "a-secure-admin-code-secret-with-32-bytes",
  );
});

test("admin codes use eight unambiguous high-entropy characters", () => {
  const codes = Array.from({ length: 100 }, () => generateAdminCode());
  assert.ok(codes.every((code) => /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code)));
  assert.ok(new Set(codes).size > 1);
  assert.match(adminAuthSource, /value\s*<\s*248/);
});

test("admin codes normalize case and reject ambiguous or malformed input", () => {
  assert.equal(normalizeAdminCode(" abcd-2345 "), "ABCD2345");
  assert.equal(normalizeAdminCode("ABCO2345"), null);
  assert.equal(normalizeAdminCode("ABCL2345"), null);
  assert.equal(normalizeAdminCode("ABC2345"), null);
});

test("admin allowlist normalizes email and rejects non-admin addresses", () => {
  assert.equal(isAllowedAdminEmail("  ELLIOTT@RIGHTEDGE.COM.AU "), true);
  assert.equal(isAllowedAdminEmail("customer@example.com"), false);
  assert.equal(isAllowedAdminEmail(""), false);
});

test("admin privilege requires both an allowlisted email and verified challenge", () => {
  assert.equal(
    isVerifiedAdminSession({ email: "elliott@rightedge.com.au", adminVerified: false }),
    false,
  );
  assert.equal(
    isVerifiedAdminSession({ email: "customer@example.com", adminVerified: true }),
    false,
  );
  assert.equal(
    isVerifiedAdminSession({ email: "elliott@rightedge.com.au", adminVerified: true }),
    true,
  );
});

test("admin challenge stores only a hash and accepts the correct code", async () => {
  const challenge = await createAdminChallenge(
    "ELLIOTT@RIGHTEDGE.COM.AU",
    "ABCD2345",
    1_000,
    TEST_HMAC_SECRET,
  );

  assert.equal(JSON.stringify(challenge).includes("ABCD2345"), false);
  assert.equal(challenge.email, "elliott@rightedge.com.au");
  assert.deepEqual(
    await verifyAdminChallenge(
      challenge,
      "elliott@rightedge.com.au",
      "ABCD2345",
      1_001,
      TEST_HMAC_SECRET,
    ),
    { ok: true },
  );
});

test("admin challenge rejects the wrong email or code", async () => {
  const challenge = await createAdminChallenge(
    "elliott@rightedge.com.au",
    "ABCD2345",
    1_000,
    TEST_HMAC_SECRET,
  );

  assert.deepEqual(
    await verifyAdminChallenge(challenge, "other@example.com", "ABCD2345", 1_001, TEST_HMAC_SECRET),
    { ok: false, reason: "invalid_or_expired" },
  );
  assert.deepEqual(
    await verifyAdminChallenge(
      challenge,
      "elliott@rightedge.com.au",
      "WXYZ6789",
      1_001,
      TEST_HMAC_SECRET,
    ),
    { ok: false, reason: "invalid_or_expired" },
  );
});

test("admin challenge expires after ten minutes", async () => {
  const challenge = await createAdminChallenge(
    "elliott@rightedge.com.au",
    "ABCD2345",
    1_000,
    TEST_HMAC_SECRET,
  );

  assert.deepEqual(
    await verifyAdminChallenge(
      challenge,
      "elliott@rightedge.com.au",
      "ABCD2345",
      1_000 + 10 * 60 * 1000 + 1,
      TEST_HMAC_SECRET,
    ),
    { ok: false, reason: "invalid_or_expired" },
  );
});

test("admin challenge expires exactly at its ten-minute deadline", async () => {
  const challenge = await createAdminChallenge(
    "elliott@rightedge.com.au",
    "ABCD2345",
    1_000,
    TEST_HMAC_SECRET,
  );

  assert.deepEqual(
    await verifyAdminChallenge(
      challenge,
      "elliott@rightedge.com.au",
      "ABCD2345",
      1_000 + 10 * 60 * 1000,
      TEST_HMAC_SECRET,
    ),
    { ok: false, reason: "invalid_or_expired" },
  );
});

test("admin challenge requests are throttled until the current code expires", async () => {
  const challenge = await createAdminChallenge(
    "elliott@rightedge.com.au",
    "ABCD2345",
    1_000,
    TEST_HMAC_SECRET,
  );

  assert.equal(canIssueAdminChallenge(challenge, 1_000 + 10 * 60 * 1000 - 1), false);
  assert.equal(canIssueAdminChallenge(challenge, 1_000 + 10 * 60 * 1000), true);
  assert.equal(canIssueAdminChallenge(null, 1_000), true);
});

test("admin challenge rejects codes after all attempts are consumed", async () => {
  const challenge = {
    ...(await createAdminChallenge("elliott@rightedge.com.au", "ABCD2345", 1_000, TEST_HMAC_SECRET)),
    attemptsRemaining: 0,
  };

  assert.deepEqual(
    await verifyAdminChallenge(
      challenge,
      "elliott@rightedge.com.au",
      "ABCD2345",
      1_001,
      TEST_HMAC_SECRET,
    ),
    { ok: false, reason: "invalid_or_expired" },
  );
});
