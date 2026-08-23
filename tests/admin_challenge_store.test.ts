import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cancelAdminChallenge,
  issueAdminChallenge,
  verifyAndConsumeAdminChallenge,
} from "../supabase/functions/server/admin_challenge_store.ts";

function recordingRpc(result: { data: unknown; error: unknown }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
  };
}

test("challenge store issues through the atomic Postgres RPC", async () => {
  const client = recordingRpc({ data: true, error: null });
  const challenge = {
    email: "elliott@rightedge.com.au",
    codeHash: "abc123",
    expiresAt: 601_000,
    attemptsRemaining: 5,
  };

  assert.equal(await issueAdminChallenge(client.rpc, "admin_auth_challenge:elliott@rightedge.com.au", challenge, 1_000), true);
  assert.deepEqual(client.calls, [{
    name: "issue_admin_challenge_f8a832e3",
    args: {
      p_key: "admin_auth_challenge:elliott@rightedge.com.au",
      p_challenge: challenge,
      p_now_ms: 1_000,
    },
  }]);
});

test("challenge store verifies and consumes through one atomic RPC", async () => {
  const client = recordingRpc({ data: "success", error: null });
  assert.equal(
    await verifyAndConsumeAdminChallenge(
      client.rpc,
      "admin_auth_challenge:elliott@rightedge.com.au",
      "elliott@rightedge.com.au",
      "abc123",
      1_000,
    ),
    "success",
  );
  assert.equal(client.calls[0]?.name, "verify_admin_challenge_f8a832e3");
});

test("challenge store fails closed when the atomic RPC migration is missing", async () => {
  const missing = recordingRpc({ data: null, error: { message: "function does not exist" } });
  await assert.rejects(
    issueAdminChallenge(missing.rpc, "admin_auth_challenge:x", {} as never, 1_000),
    /Atomic admin challenge RPC unavailable/,
  );
});

test("challenge cancellation identifies the exact issued hash", async () => {
  const client = recordingRpc({ data: true, error: null });
  assert.equal(await cancelAdminChallenge(client.rpc, "admin_auth_challenge:x", "exact-hash"), true);
  assert.deepEqual(client.calls[0], {
    name: "cancel_admin_challenge_f8a832e3",
    args: { p_key: "admin_auth_challenge:x", p_code_hash: "exact-hash" },
  });
});

test("migration serializes issue, failed attempts, and successful consumption and is service-role only", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260823000000_atomic_admin_challenges.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /issue_admin_challenge_f8a832e3/);
  assert.match(sql, /verify_admin_challenge_f8a832e3/);
  assert.match(sql, /cancel_admin_challenge_f8a832e3/);
  assert.match(sql, /for update/i);
  assert.match(sql, /attemptsRemaining/);
  assert.match(sql, /delete from public\.kv_store_f8a832e3/i);
  assert.match(
    sql,
    /if attempts = 0 then\s+return 'invalid';[\s\S]*jsonb_set\(challenge, '\{attemptsRemaining\}', to_jsonb\(attempts - 1\)\)/i,
  );
  assert.doesNotMatch(sql, /if attempts = 1 then\s+delete/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/i);
});
