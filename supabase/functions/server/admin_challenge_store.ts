import type { AdminChallenge } from "./admin_auth.ts";

export type AdminChallengeVerification = "success" | "invalid";
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
    throw new Error(
      `Atomic admin challenge RPC unavailable (${name}): ${error.message || "unknown database error"}`,
    );
  }
  return data as T;
}

export function issueAdminChallenge(
  rpc: SupabaseRpc,
  key: string,
  challenge: AdminChallenge,
  nowMs = Date.now(),
): Promise<boolean> {
  return callAtomicRpc<boolean>(rpc, "issue_admin_challenge_f8a832e3", {
    p_key: key,
    p_challenge: challenge,
    p_now_ms: nowMs,
  });
}

export function verifyAndConsumeAdminChallenge(
  rpc: SupabaseRpc,
  key: string,
  email: string,
  codeHash: string,
  nowMs = Date.now(),
): Promise<AdminChallengeVerification> {
  return callAtomicRpc<AdminChallengeVerification>(rpc, "verify_admin_challenge_f8a832e3", {
    p_key: key,
    p_email: email,
    p_code_hash: codeHash,
    p_now_ms: nowMs,
  });
}

export function cancelAdminChallenge(
  rpc: SupabaseRpc,
  key: string,
  codeHash: string,
): Promise<boolean> {
  return callAtomicRpc<boolean>(rpc, "cancel_admin_challenge_f8a832e3", {
    p_key: key,
    p_code_hash: codeHash,
  });
}
