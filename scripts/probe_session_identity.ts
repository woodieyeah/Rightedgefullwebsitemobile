/**
 * Integration probe: an unverified free session must not reach billing.
 *
 * Runs against a LIVE Edge Function (default: production) using unroutable
 * probe addresses, plus optionally one account you control via
 * PROBE_SUBSCRIBER_EMAIL. It is read-only with respect to customer data: it
 * registers free-access records for @rightedge-security-check.invalid
 * addresses and never initiates a payment or modifies a subscription.
 *
 *   SUPABASE_URL=... npx tsx scripts/probe_session_identity.ts
 *   PROBE_SUBSCRIBER_EMAIL=you@example.com npx tsx scripts/probe_session_identity.ts
 *
 * Exit code 0 = all assertions held. Non-zero = an exploit path is open.
 */
const BASE =
  process.env.PROBE_EDGE_BASE ??
  `${process.env.SUPABASE_URL ?? ""}/functions/v1/make-server-3b84b96c`;
const CONTROLLED = process.env.PROBE_SUBSCRIBER_EMAIL ?? "";
const STAMP = Date.now();
const PROBE_A = `probe-a-${STAMP}@rightedge-security-check.invalid`;
const PROBE_B = `probe-b-${STAMP}@rightedge-security-check.invalid`;

type Res = { status: number; body: any; cookie: string | null };

async function call(
  path: string,
  init: { body?: unknown; cookie?: string | null; method?: string } = {},
): Promise<Res> {
  const res = await fetch(`${BASE}/${path}`, {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.cookie ? { Cookie: `rightedge_session=${init.cookie}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const raw = await res.text();
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw.slice(0, 160);
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/rightedge_session=([^;]+)/);
  return { status: res.status, body, cookie: match ? match[1] : null };
}

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

async function main() {
  if (!BASE.startsWith("http")) {
    console.error("Set SUPABASE_URL or PROBE_EDGE_BASE.");
    process.exit(1);
  }
  console.log(`\nSession identity probe -> ${BASE}`);
  console.log("=".repeat(64));

  // 1. Free registration must issue a session that is NOT identity-verified.
  const reg = await call("register-free-access", {
    body: { email: PROBE_A, source: "security_probe" },
  });
  check(
    "free registration still works (experience preserved)",
    reg.status === 200,
    `http ${reg.status} ${JSON.stringify(reg.body)}`,
  );
  check(
    "free registration issues a session cookie",
    Boolean(reg.cookie),
    reg.cookie ? "cookie issued" : "no cookie",
  );

  // 2. That session must not reach the billing portal for its OWN email.
  const ownBilling = await call("create-customer-portal", {
    body: { email: PROBE_A, returnUrl: "https://rightedge.com.au" },
    cookie: reg.cookie,
  });
  check(
    "unverified session cannot open the billing portal (own email)",
    ownBilling.status === 403,
    `http ${ownBilling.status} — 404 would mean it reached Stripe`,
  );

  // 3. Nor the retention offer.
  const ownRetention = await call("apply-retention-offer", {
    body: { email: PROBE_A },
    cookie: reg.cookie,
  });
  check(
    "unverified session cannot change a subscription",
    ownRetention.status === 403,
    `http ${ownRetention.status}`,
  );

  // 4. THE EXPLOIT: register as someone else, then open their billing.
  if (CONTROLLED) {
    const impersonate = await call("register-free-access", {
      body: { email: CONTROLLED, source: "security_probe" },
    });
    const victimBilling = await call("create-customer-portal", {
      body: { email: CONTROLLED, returnUrl: "https://rightedge.com.au" },
      cookie: impersonate.cookie,
    });
    const leaked = victimBilling.status === 200 && typeof victimBilling.body?.url === "string";
    check(
      "registering as a subscriber does NOT grant their billing portal",
      !leaked && victimBilling.status === 403,
      leaked
        ? "*** EXPLOITABLE: a billing portal URL was issued ***"
        : `http ${victimBilling.status}`,
    );
  } else {
    check(
      "impersonation probe (set PROBE_SUBSCRIBER_EMAIL to run)",
      true,
      "skipped — needs an account you control",
    );
  }

  // 5. Premium must not propagate to an unrelated email.
  //    Uses the free session from step 1; a premium one would need a code.
  const propagate = await call("register-free-access", {
    body: { email: PROBE_B, source: "security_probe" },
    cookie: reg.cookie,
  });
  const after = await call("auth/session", { method: "GET", cookie: propagate.cookie });
  check(
    "a new registration does not inherit premium",
    after.body?.premium !== true,
    `tier=${after.body?.tier} premium=${after.body?.premium}`,
  );

  // 6. An unauthenticated caller is refused with 401, not 404.
  const anon = await call("create-customer-portal", {
    body: { email: PROBE_A, returnUrl: "https://rightedge.com.au" },
  });
  check(
    "no session is refused before Stripe is queried",
    anon.status === 401,
    `http ${anon.status} — 404 would mean Stripe was queried`,
  );

  // 7. The sign-in path still works for a real subscriber.
  if (CONTROLLED) {
    const verify = await call("verify-email", { body: { email: CONTROLLED } });
    check(
      "legitimate premium sign-in still issues a code",
      verify.status === 200 && verify.body?.verificationRequired === true,
      `http ${verify.status} ${JSON.stringify(verify.body)}`,
    );
    check(
      "verify-email leaks no legacy unlock flag",
      verify.body?.active !== true && verify.body?.instantAccess !== true,
      `active=${verify.body?.active}`,
    );
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`\n  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
    console.log(`        ${r.detail}`);
  }
  console.log(
    `\n  ${failed === 0 ? "ALL PROBES PASS" : `${failed} PROBE(S) FAILED`} (${results.length} checks)\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nPROBE ERROR:", err.message);
  process.exit(1);
});
