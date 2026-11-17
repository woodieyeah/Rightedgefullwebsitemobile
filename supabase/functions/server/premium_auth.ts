/**
 * Proof that a caller owns the email address they claim.
 *
 * WHY THIS EXISTS
 * Four endpoints acted on a body-supplied email with no proof of ownership.
 * `/verify-email` minted a 180-day PREMIUM session for any address that
 * happened to have an active Stripe subscription, so knowing a subscriber's
 * email was enough to become them. `/create-customer-portal` and
 * `/apply-retention-offer` reached Stripe on the same unproven email, the
 * latter modifying a live subscription.
 *
 * This mirrors the admin challenge in admin_auth.ts, which was already built
 * correctly: a short numeric code, emailed to the address being claimed,
 * stored only as an HMAC, single-purpose, expiring, attempt-capped and bound
 * to the email it was issued for.
 *
 * DESIGN NOTES
 * - The code is never stored or logged in plaintext, so a dump of the KV
 *   store does not yield working codes.
 * - Comparison is constant-time: a timing oracle on a 6-digit code would
 *   reduce the search space dramatically.
 * - The challenge carries its own email. Verification re-derives the HMAC
 *   from that email, so moving a challenge record onto another account
 *   invalidates it rather than unlocking it.
 * - Attempts are capped. 6 digits is only 10^6, which is brute-forceable in
 *   minutes against an uncapped endpoint.
 */

/** A code is valid for ten minutes. Long enough for email, short enough. */
export const PREMIUM_CODE_TTL_SECONDS = 10 * 60;

/** Wrong guesses allowed before the challenge is dead. */
export const PREMIUM_CODE_MAX_ATTEMPTS = 5;

/** Minimum gap between issuing codes for one address, in milliseconds. */
export const PREMIUM_CODE_REISSUE_COOLDOWN_MS = 30_000;

export type PremiumChallenge = {
  email: string;
  codeHash: string;
  issuedAt: number;
  attempts: number;
};

export type PremiumVerification =
  | { status: "success" }
  | { status: "invalid"; challenge: PremiumChallenge }
  | { status: "expired" }
  | { status: "locked" };

export function buildPremiumChallengeKey(email: string): string {
  return `premium_challenge:${String(email ?? "").trim().toLowerCase()}`;
}

/**
 * A six-digit code from a CSPRNG.
 *
 * Math.random() is not acceptable for a credential: its output is predictable
 * from observed values.
 */
export function generatePremiumCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  // Rejection-free modulo bias is negligible at 10^6 against 2^32.
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export function normalizePremiumCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

export function normalizePremiumEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare: a short-circuit here leaks the code one char at a time. */
function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * The stored hash binds the code to its email.
 *
 * Including the email in the signed payload is what makes a challenge
 * non-transferable: the same code under a different address will not verify.
 */
export async function getPremiumCodeHash(
  email: string,
  code: string,
  secret: string,
): Promise<string> {
  return hmacSha256(`${normalizePremiumEmail(email)}:${code}`, secret);
}

export async function createPremiumChallenge(
  email: string,
  code: string,
  secret: string,
  issuedAt: number,
): Promise<PremiumChallenge> {
  return {
    email: normalizePremiumEmail(email),
    codeHash: await getPremiumCodeHash(email, code, secret),
    issuedAt,
    attempts: 0,
  };
}

/** Rate limit reissue so the endpoint cannot be used to spam an inbox. */
export function canIssuePremiumChallenge(
  existing: PremiumChallenge | null | undefined,
  now: number,
): boolean {
  if (!existing) return true;
  return now - existing.issuedAt >= PREMIUM_CODE_REISSUE_COOLDOWN_MS;
}

export async function verifyPremiumChallenge(
  challenge: PremiumChallenge,
  submittedCode: string,
  secret: string,
  now: number,
): Promise<PremiumVerification> {
  if (challenge.attempts >= PREMIUM_CODE_MAX_ATTEMPTS) return { status: "locked" };
  if (now - challenge.issuedAt > PREMIUM_CODE_TTL_SECONDS * 1000) return { status: "expired" };

  const expected = await getPremiumCodeHash(challenge.email, submittedCode, secret);
  if (constantTimeEqual(expected, challenge.codeHash)) return { status: "success" };

  const attempts = challenge.attempts + 1;
  if (attempts >= PREMIUM_CODE_MAX_ATTEMPTS) {
    return { status: "invalid", challenge: { ...challenge, attempts } };
  }
  return { status: "invalid", challenge: { ...challenge, attempts } };
}

/**
 * The HMAC secret must be configured; there is no safe default.
 *
 * Falling back to a constant would make every code forgeable by anyone who
 * read the source.
 */
export function requirePremiumCodeHmacSecret(value: unknown): string {
  const secret = typeof value === "string" ? value.trim() : "";
  if (secret.length < 32) {
    throw new Error(
      "PREMIUM_CODE_HMAC_SECRET must be set to at least 32 characters",
    );
  }
  return secret;
}
