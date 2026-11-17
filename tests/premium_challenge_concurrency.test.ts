/**
 * Concurrent verification must not defeat the attempt cap.
 *
 * The first implementation was read-modify-write in the edge function:
 *
 *   challenge = await kv.get(key)      // all N requests read attempts = 0
 *   result = verify(challenge, code)
 *   await kv.set(key, {attempts: 1})   // all N write attempts = 1
 *
 * With N parallel requests the cap of 5 becomes 5 x N guesses, and the
 * single-use guarantee breaks too: two requests submitting the SAME correct
 * code both observe a present challenge and both mint a premium session.
 *
 * The admin flow already solved this with an atomic Postgres RPC taking
 * pg_advisory_xact_lock and SELECT ... FOR UPDATE. These tests pin the same
 * guarantees for the premium challenge.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PREMIUM_CODE_MAX_ATTEMPTS,
  buildPremiumChallengeKey,
  issuePremiumChallenge,
  verifyAndConsumePremiumChallenge,
} from "../supabase/functions/server/premium_challenge_store.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/20261117000000_atomic_premium_challenges.sql", import.meta.url),
  "utf8",
);
const serverSource = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);

/**
 * A fake RPC that serialises calls the way Postgres would, so the store's
 * contract can be tested without a live database.
 */
function makeFakeRpc() {
  const rows = new Map<string, any>();
  const calls: string[] = [];
  /** How many times a wrong guess was actually charged to a live challenge. */
  let attemptsCharged = 0;

  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push(name);
    const key = String(args.p_key ?? "");

    if (name === "issue_premium_challenge_f8a832e3") {
      const existing = rows.get(key);
      const now = Number(args.p_now_ms);
      const cooldown = Number(args.p_cooldown_ms);
      if (existing && now - Number(existing.issuedAt) < cooldown) {
        return { data: false, error: null };
      }
      rows.set(key, args.p_challenge);
      return { data: true, error: null };
    }

    if (name === "verify_premium_challenge_f8a832e3") {
      const challenge = rows.get(key);
      if (!challenge) return { data: "invalid", error: null };
      const attempts = Number(challenge.attempts ?? 0);
      const now = Number(args.p_now_ms);
      if (now - Number(challenge.issuedAt) > Number(args.p_ttl_ms)) {
        rows.delete(key);
        return { data: "expired", error: null };
      }
      if (attempts >= Number(args.p_max_attempts)) {
        rows.delete(key);
        return { data: "locked", error: null };
      }
      if (
        challenge.email === args.p_email &&
        challenge.codeHash === args.p_code_hash
      ) {
        rows.delete(key); // single use
        return { data: "success", error: null };
      }
      attemptsCharged++;
      rows.set(key, { ...challenge, attempts: attempts + 1 });
      return { data: "invalid", error: null };
    }

    throw new Error(`unexpected rpc ${name}`);
  };

  return { rpc, rows, calls, charged: () => attemptsCharged };
}

const KEY = buildPremiumChallengeKey("subscriber@example.com");
const CHALLENGE = {
  email: "subscriber@example.com",
  codeHash: "a".repeat(64),
  issuedAt: 1_000_000,
  attempts: 0,
};

test("a correct code succeeds exactly once", async () => {
  const { rpc } = makeFakeRpc();
  await issuePremiumChallenge(rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);

  const first = await verifyAndConsumePremiumChallenge(
    rpc, KEY, CHALLENGE.email, CHALLENGE.codeHash, CHALLENGE.issuedAt + 1_000,
  );
  assert.equal(first, "success");

  // Replaying the same code must fail: the challenge is consumed.
  const second = await verifyAndConsumePremiumChallenge(
    rpc, KEY, CHALLENGE.email, CHALLENGE.codeHash, CHALLENGE.issuedAt + 2_000,
  );
  assert.equal(second, "invalid");
});

test("concurrent submissions of the correct code mint only one success", async () => {
  // This is the race that matters: two tabs, or an attacker firing parallel
  // requests, must not both receive a premium session.
  const { rpc } = makeFakeRpc();
  await issuePremiumChallenge(rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      verifyAndConsumePremiumChallenge(
        rpc, KEY, CHALLENGE.email, CHALLENGE.codeHash, CHALLENGE.issuedAt + 1_000,
      ),
    ),
  );

  assert.equal(results.filter((r) => r === "success").length, 1);
});

test("concurrent wrong guesses cannot exceed the attempt cap", async () => {
  const fake = makeFakeRpc();
  await issuePremiumChallenge(fake.rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);

  // Fire far more parallel guesses than the cap allows.
  await Promise.all(
    Array.from({ length: 40 }, () =>
      verifyAndConsumePremiumChallenge(
        fake.rpc, KEY, CHALLENGE.email, "f".repeat(64), CHALLENGE.issuedAt + 1_000,
      ),
    ),
  );

  // Count attempts actually charged to a live challenge, not response strings:
  // once the challenge is locked and deleted, further calls answer "invalid"
  // because no challenge exists, which is not a consumed guess.
  assert.ok(
    fake.charged() <= PREMIUM_CODE_MAX_ATTEMPTS,
    `${fake.charged()} guesses were charged against a cap of ${PREMIUM_CODE_MAX_ATTEMPTS}`,
  );

  // And the correct code must not succeed afterwards.
  const afterLock = await verifyAndConsumePremiumChallenge(
    fake.rpc, KEY, CHALLENGE.email, CHALLENGE.codeHash, CHALLENGE.issuedAt + 2_000,
  );
  assert.notEqual(afterLock, "success");
});

test("a code for one email cannot verify another account", async () => {
  const { rpc } = makeFakeRpc();
  await issuePremiumChallenge(rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);

  const result = await verifyAndConsumePremiumChallenge(
    rpc, KEY, "attacker@example.com", CHALLENGE.codeHash, CHALLENGE.issuedAt + 1_000,
  );
  assert.notEqual(result, "success");
});

test("the reissue cooldown is enforced by the database, not the caller", async () => {
  const { rpc } = makeFakeRpc();
  const issued = await issuePremiumChallenge(rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);
  assert.equal(issued, true);

  // A second issue inside the cooldown must be refused atomically, so
  // parallel requests cannot each send a fresh code.
  const tooSoon = await issuePremiumChallenge(
    rpc, KEY, { ...CHALLENGE, issuedAt: CHALLENGE.issuedAt + 1_000 }, CHALLENGE.issuedAt + 1_000,
  );
  assert.equal(tooSoon, false);

  const later = await issuePremiumChallenge(
    rpc, KEY, { ...CHALLENGE, issuedAt: CHALLENGE.issuedAt + 60_000 }, CHALLENGE.issuedAt + 60_000,
  );
  assert.equal(later, true);
});

test("an expired challenge is refused", async () => {
  const { rpc } = makeFakeRpc();
  await issuePremiumChallenge(rpc, KEY, CHALLENGE, CHALLENGE.issuedAt);
  const result = await verifyAndConsumePremiumChallenge(
    rpc, KEY, CHALLENGE.email, CHALLENGE.codeHash, CHALLENGE.issuedAt + 11 * 60 * 1000,
  );
  assert.equal(result, "expired");
});

// ---------------------------------------------------------------------------
// The migration itself must provide the atomicity
// ---------------------------------------------------------------------------

test("the verify function locks the row before reading it", () => {
  // Without both the advisory lock and FOR UPDATE, two transactions read the
  // same attempt count and the cap is per-request rather than per-challenge.
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/i);
  assert.match(migration, /create or replace function public\.verify_premium_challenge_f8a832e3/);
  assert.match(migration, /create or replace function public\.issue_premium_challenge_f8a832e3/);
});

test("the premium RPCs are not callable by anon", () => {
  // These functions bypass RLS (security definer), so exposing them to anon
  // would hand an attacker direct challenge control.
  assert.match(migration, /revoke all on function public\.verify_premium_challenge_f8a832e3[^;]*from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.issue_premium_challenge_f8a832e3[^;]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.verify_premium_challenge_f8a832e3[^;]*to service_role/);
});

test("the key namespace is enforced inside the function", () => {
  // A caller must not be able to point the RPC at an arbitrary KV row, such
  // as an auth_session record.
  assert.match(migration, /premium_challenge:%/);
  assert.match(migration, /raise exception/i);
});

test("the edge function uses the atomic store, not read-modify-write", () => {
  const start = serverSource.indexOf('app.post("/verify-premium-code"');
  assert.ok(start !== -1);
  const body = serverSource.slice(start, start + 2_600);

  assert.match(body, /verifyAndConsumePremiumChallenge/);
  // The old non-atomic pattern must be gone from this route.
  assert.doesNotMatch(body, /kv\.set\(\s*challengeKey/);
  assert.doesNotMatch(body, /verifyPremiumChallenge\(/);
});
