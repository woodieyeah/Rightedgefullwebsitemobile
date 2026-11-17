/**
 * Atomic premium challenge storage.
 *
 * Mirrors admin_challenge_store.ts. Every mutation goes through a Postgres
 * SECURITY DEFINER function that takes an advisory lock, so the attempt
 * counter and the single-use delete are serialised. Doing this in the Edge
 * Function with kv.get/kv.set would let parallel requests each read the same
 * attempt count — the cap becomes per-request instead of per-challenge, and
 * two requests with the same correct code both mint a session.
 */
import type { PremiumChallenge } from "./premium_auth.ts";
import {
  PREMIUM_CODE_MAX_ATTEMPTS,
  PREMIUM_CODE_REISSUE_COOLDOWN_MS,
  PREMIUM_CODE_TTL_SECONDS,
  buildPremiumChallengeKey,
} from "./premium_auth.ts";

export { PREMIUM_CODE_MAX_ATTEMPTS, buildPremiumChallengeKey };

export type PremiumChallengeVerification =
  | "success"
  | "invalid"
  | "expired"
  | "locked";

export type SupabaseRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

async function callAtomicRpc<T>(
  rpc: SupabaseRpc,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) {
    // Fail closed: a missing or broken RPC must not silently degrade to a
    // non-atomic path.
    throw new Error(
      `Atomic premium challenge RPC unavailable (${name}): ${error.message || "unknown database error"}`,
    );
  }
  return data as T;
}

/** Returns false when a recent challenge still exists (cooldown enforced in SQL). */
export function issuePremiumChallenge(
  rpc: SupabaseRpc,
  key: string,
  challenge: PremiumChallenge,
  nowMs = Date.now(),
): Promise<boolean> {
  return callAtomicRpc<boolean>(rpc, "issue_premium_challenge_f8a832e3", {
    p_key: key,
    p_challenge: challenge,
    p_now_ms: nowMs,
    p_cooldown_ms: PREMIUM_CODE_REISSUE_COOLDOWN_MS,
  });
}

/** Verifies, counts the attempt and consumes the challenge, all in one transaction. */
export function verifyAndConsumePremiumChallenge(
  rpc: SupabaseRpc,
  key: string,
  email: string,
  codeHash: string,
  nowMs = Date.now(),
): Promise<PremiumChallengeVerification> {
  return callAtomicRpc<PremiumChallengeVerification>(
    rpc,
    "verify_premium_challenge_f8a832e3",
    {
      p_key: key,
      p_email: email,
      p_code_hash: codeHash,
      p_now_ms: nowMs,
      p_ttl_ms: PREMIUM_CODE_TTL_SECONDS * 1000,
      p_max_attempts: PREMIUM_CODE_MAX_ATTEMPTS,
    },
  );
}

/** Drops a challenge whose code never reached the user (delivery failure). */
export function cancelPremiumChallenge(
  rpc: SupabaseRpc,
  key: string,
  codeHash: string,
): Promise<boolean> {
  return callAtomicRpc<boolean>(rpc, "cancel_premium_challenge_f8a832e3", {
    p_key: key,
    p_code_hash: codeHash,
  });
}
