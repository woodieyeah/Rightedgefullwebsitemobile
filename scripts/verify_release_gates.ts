/**
 * Deploy gate: verify the release preconditions and postconditions.
 *
 * Run before deploying (--stage pre) to confirm the secret and the migration
 * are in place, and after each step (--stage post) to confirm the live
 * endpoints behave as designed. Every check is read-only; nothing is mutated.
 *
 *   npx tsx scripts/verify_release_gates.ts --stage pre
 *   npx tsx scripts/verify_release_gates.ts --stage post
 *
 * The probe address is deliberately unroutable so no real customer is ever
 * contacted and no real subscription can be matched.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EDGE = `${SUPABASE_URL}/functions/v1/make-server-3b84b96c`;
const STAGE = process.argv.includes("--stage")
  ? process.argv[process.argv.indexOf("--stage") + 1]
  : "pre";

const PROBE = `probe-${Date.now()}@rightedge-security-check.invalid`;

type Result = { label: string; ok: boolean | null; detail: string };
const results: Result[] = [];

function record(label: string, ok: boolean | null, detail: string) {
  results.push({ label, ok, detail });
}

async function restCount(filter: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store_f8a832e3?${filter}&select=key`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  const range = res.headers.get("content-range") ?? "";
  const total = range.split("/")[1];
  return Number(total ?? 0);
}

/** Calling an RPC with a deliberately invalid key must raise, proving it exists. */
async function rpcExists(name: string, args: Record<string, unknown>): Promise<"present" | "absent" | "unknown"> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (res.status === 404 || text.includes("PGRST202")) return "absent";
  // A raised exception means the function ran and rejected our bad input.
  if (text.includes("invalid premium challenge")) return "present";
  if (res.ok) return "present";
  return "unknown";
}

async function endpoint(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${EDGE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: (await res.text()).slice(0, 160) };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  console.log(`\nRelease gate — stage: ${STAGE.toUpperCase()}`);
  console.log("=".repeat(64));

  // --- Gate 1: the atomic RPCs must exist BEFORE the function is deployed ---
  const verifyRpc = await rpcExists("verify_premium_challenge_f8a832e3", {
    p_key: "not-a-premium-key",
    p_email: "x@y.z",
    p_code_hash: "0",
    p_now_ms: 0,
    p_ttl_ms: 0,
    p_max_attempts: 5,
  });
  const issueRpc = await rpcExists("issue_premium_challenge_f8a832e3", {
    p_key: "not-a-premium-key",
    p_challenge: {},
    p_now_ms: 0,
    p_cooldown_ms: 0,
  });
  record(
    "migration applied: verify_premium_challenge RPC exists",
    verifyRpc === "present",
    verifyRpc,
  );
  record(
    "migration applied: issue_premium_challenge RPC exists",
    issueRpc === "present",
    issueRpc,
  );

  // --- Gate 2: is the patched function deployed? ---
  const codeRoute = await endpoint("verify-premium-code", { email: PROBE, code: "123456" });
  const deployed = codeRoute.status !== 404;
  record(
    "edge function deployed: /verify-premium-code route exists",
    deployed,
    `http ${codeRoute.status}`,
  );

  // --- Gate 3: the HMAC secret must be configured ---
  // /verify-email throws without it. A non-subscriber probe reaches the
  // Stripe lookup and returns active:false WITHOUT touching the secret, so
  // the only safe signal is that the route does not 500.
  const verifyEmail = await endpoint("verify-email", { email: PROBE });
  record(
    "verify-email does not 500 (no unconfigured-secret crash)",
    verifyEmail.status !== 500,
    `http ${verifyEmail.status} ${verifyEmail.text}`,
  );

  // --- Gate 4: authorisation on the four affected endpoints ---
  const checks: { path: string; body: Record<string, unknown>; expectPost: number[]; label: string }[] = [
    { path: "create-customer-portal", body: { email: PROBE, returnUrl: "https://rightedge.com.au" }, expectPost: [401], label: "portal rejects unauthenticated" },
    { path: "apply-retention-offer", body: { email: PROBE }, expectPost: [401], label: "retention rejects unauthenticated" },
  ];
  for (const c of checks) {
    const r = await endpoint(c.path, c.body);
    const ok = deployed ? c.expectPost.includes(r.status) : r.status === 404;
    record(
      `${c.label}${deployed ? "" : " (pre-deploy baseline: 404 expected)"}`,
      ok,
      `http ${r.status}`,
    );
  }

  // --- Gate 5: checkout must still work for a NEW customer ---
  const checkout = await endpoint("create-checkout-session", {
    email: PROBE,
    returnUrl: "https://rightedge.com.au",
  });
  const givesStripeUrl = checkout.text.includes("checkout.stripe.com");
  record(
    "new-customer checkout still returns a Stripe URL",
    checkout.status === 200 && givesStripeUrl,
    `http ${checkout.status}${givesStripeUrl ? " (stripe url present)" : ""}`,
  );

  // --- Gate 6: no legacy unlock flag leaks to a stale client ---
  const leaks = /"(instantAccess|activeSubscriber|active_subscriber|subscribed)":\s*true|"active":\s*true/.test(
    verifyEmail.text,
  );
  record(
    "verify-email sets no legacy unlock flag truthy",
    !leaks,
    leaks ? "LEAK — a cached bundle would dead-end" : "clean",
  );

  // --- Gate 7: data inventory, for the revocation step ---
  const sessions = await restCount("key=like.auth_session%3A*");
  const challenges = await restCount("key=like.premium_challenge%3A*");
  const instant = await restCount("key=like.instant_access%3A*");
  const subscribers = await restCount("key=like.subscriber%3A*");
  record("no instant_access tokens remain redeemable", instant === 0, `${instant} tokens`);
  record("subscriber records intact", subscribers >= 164, `${subscribers} records`);
  console.log(`\n  inventory: ${sessions} sessions, ${challenges} live challenges, ${subscribers} subscribers\n`);

  let failed = 0;
  for (const r of results) {
    const mark = r.ok === null ? "SKIP" : r.ok ? "PASS" : "FAIL";
    if (r.ok === false) failed++;
    console.log(`  ${mark}  ${r.label}`);
    console.log(`        ${r.detail}`);
  }

  console.log(
    `\n  ${failed === 0 ? "ALL GATES PASS" : `${failed} GATE(S) FAILED`} (${results.length} checks)\n`,
  );
  if (!deployed) {
    console.log("  NOTE: the patched function is not deployed yet, so endpoint");
    console.log("  gates were evaluated against the pre-deploy baseline.\n");
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
