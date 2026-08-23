export const ADMIN_EMAILS = new Set([
  "elliott@woodbry.com",
  "ewoodbry@gmail.com",
  "elliott@rightedge.com.au",
]);

export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const ADMIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function getAdminSessionAbsoluteExpiry(createdAtMs: number): number {
  return createdAtMs + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
}

export function getAdminSessionRemainingMaxAge(
  createdAtMs: number,
  nowMs = Date.now(),
): number {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((getAdminSessionAbsoluteExpiry(createdAtMs) - nowMs) / 1000));
}

export function generateAdminCode(): string {
  let code = "";
  while (code.length < 8) {
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    for (const value of random) {
      // 248 is the largest multiple of 31 below 256, preventing modulo bias.
      if (value < 248) code += ADMIN_CODE_ALPHABET[value % ADMIN_CODE_ALPHABET.length];
      if (code.length === 8) break;
    }
  }
  return code;
}

export function normalizeAdminCode(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase().replace(/-/g, "");
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code) ? code : null;
}

export function normalizeAdminEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isAllowedAdminEmail(value: unknown): boolean {
  return ADMIN_EMAILS.has(normalizeAdminEmail(value));
}

export function isVerifiedAdminSession(
  session: { email?: unknown; adminVerified?: unknown } | null | undefined,
): boolean {
  return session?.adminVerified === true && isAllowedAdminEmail(session.email);
}

export type AdminChallenge = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attemptsRemaining: number;
};

export function requireAdminCodeHmacSecret(value: unknown): string {
  const secret = String(value ?? "");
  if (!secret) {
    throw new Error("Admin code HMAC secret is not configured");
  }
  if (new TextEncoder().encode(secret).length < 32) {
    throw new Error("Admin code HMAC secret must contain at least 32 bytes");
  }
  return secret;
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  requireAdminCodeHmacSecret(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function getAdminCodeHash(
  email: unknown,
  code: string,
  secret: string,
): Promise<string> {
  return hmacSha256(`${normalizeAdminEmail(email)}:${code}`, secret);
}

export async function createAdminChallenge(
  email: unknown,
  code: string,
  nowMs = Date.now(),
  secret = "",
): Promise<AdminChallenge> {
  const normalizedEmail = normalizeAdminEmail(email);
  return {
    email: normalizedEmail,
    codeHash: await getAdminCodeHash(normalizedEmail, code, secret),
    expiresAt: nowMs + 10 * 60 * 1000,
    attemptsRemaining: 5,
  };
}

export function canIssueAdminChallenge(
  challenge: AdminChallenge | null,
  nowMs = Date.now(),
): boolean {
  return !challenge || nowMs >= challenge.expiresAt;
}

export async function verifyAdminChallenge(
  challenge: AdminChallenge,
  email: unknown,
  code: string,
  nowMs = Date.now(),
  secret = "",
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalizedEmail = normalizeAdminEmail(email);
  const candidateHash = await getAdminCodeHash(normalizedEmail, code, secret);
  if (
    challenge.email !== normalizedEmail ||
    challenge.expiresAt <= nowMs ||
    challenge.attemptsRemaining <= 0 ||
    !constantTimeEqual(challenge.codeHash, candidateHash)
  ) {
    return { ok: false, reason: "invalid_or_expired" };
  }
  return { ok: true };
}
