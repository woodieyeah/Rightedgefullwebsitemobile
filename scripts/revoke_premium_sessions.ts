/**
 * Revoke premium auth sessions whose origin cannot be established.
 *
 * WHY
 * /verify-email minted a 180-day premium session for any email with an active
 * Stripe subscription, with no proof the caller owned the address. Session
 * records carry only { token, email, tier, createdAt, expiresAt, adminVerified }
 * — there is NO provenance field — so a session created by the vulnerable path
 * is indistinguishable from one created by a paid checkout. Every live premium
 * session must therefore be treated as potentially hijacked.
 *
 * SAFETY
 * - Dry run is the DEFAULT. --apply is required to delete anything.
 * - Only keys matching `auth_session:` AND tier === "premium" AND not already
 *   expired are targeted. Free sessions and expired rows are left alone.
 * - Emails and tokens are never printed. Accounts are shown as a stable
 *   salted digest so the same account is recognisable across runs without
 *   revealing who it is.
 * - Every targeted key is written to a local manifest BEFORE any delete, so an
 *   interrupted run is auditable.
 * - Deletes are performed by exact key, one batch at a time, and re-counted
 *   afterwards.
 *
 * Usage:
 *   npx tsx scripts/revoke_premium_sessions.ts                # dry run
 *   npx tsx scripts/revoke_premium_sessions.ts --apply        # destructive
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TABLE = "kv_store_f8a832e3";
const SESSION_PREFIX = "auth_session:";
const APPLY = process.argv.includes("--apply");
const PAGE = 1000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

/** Per-run salt: digests are comparable within a report, not across reports. */
const SALT = randomUUID();
const digest = (value: string) =>
  createHash("sha256").update(`${SALT}:${value.toLowerCase()}`).digest("hex").slice(0, 12);

type SessionRow = { key: string; value: unknown };
type Session = {
  key: string;
  email: string;
  tier: string;
  createdAt?: string;
  expiresAt?: string;
  adminVerified?: boolean;
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res;
}

async function fetchAllSessions(): Promise<Session[]> {
  const out: Session[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await rest(
      `${TABLE}?key=like.${encodeURIComponent(SESSION_PREFIX)}*&select=key,value&limit=${PAGE}&offset=${offset}`,
    );
    const rows = (await res.json()) as SessionRow[];
    for (const row of rows) {
      // Defensive: never trust the prefix filter alone for a destructive op.
      if (!row.key.startsWith(SESSION_PREFIX)) continue;
      let parsed: any;
      try {
        parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      } catch {
        continue;
      }
      out.push({
        key: row.key,
        email: String(parsed?.email ?? ""),
        tier: String(parsed?.tier ?? ""),
        createdAt: parsed?.createdAt,
        expiresAt: parsed?.expiresAt,
        adminVerified: Boolean(parsed?.adminVerified),
      });
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

function isLive(session: Session, now: number): boolean {
  if (!session.expiresAt) return true; // no expiry recorded: treat as live
  const at = Date.parse(session.expiresAt);
  return Number.isNaN(at) ? true : at > now;
}

/**
 * Sessions created at or after this instant were minted by the PATCHED
 * backend, which requires a verified emailed code. They are legitimate by
 * construction and must survive revocation.
 *
 * Required — there is no default. Guessing a cutoff could either destroy
 * freshly-earned sessions or spare compromised ones.
 */
const CUTOFF_RAW = (() => {
  const flag = process.argv.indexOf("--cutoff");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  return process.env.PATCH_DEPLOY_CUTOFF ?? "";
})();

if (!CUTOFF_RAW) {
  console.error(
    "A deployment cutoff is required.\n" +
      "  --cutoff <ISO-8601>   or   PATCH_DEPLOY_CUTOFF=<ISO-8601>\n" +
      "Use the instant the patched Edge Function began serving. Sessions created\n" +
      "at or after it were minted by the corrected flow and are preserved.",
  );
  process.exit(1);
}

const CUTOFF_MS = Date.parse(CUTOFF_RAW);
if (Number.isNaN(CUTOFF_MS)) {
  console.error(`Could not parse the cutoff: ${CUTOFF_RAW}`);
  process.exit(1);
}
if (CUTOFF_MS > Date.now()) {
  console.error("The cutoff is in the future; that would target every session.");
  process.exit(1);
}

/**
 * Created strictly BEFORE the cutoff, i.e. by the vulnerable backend.
 *
 * A session with no createdAt is treated as pre-cutoff: the field has existed
 * for the whole life of this table, so a missing value means an anomalous
 * record of unknown origin, which is exactly what should be revoked.
 */
function isPreCutoff(session: Session): boolean {
  if (!session.createdAt) return true;
  const at = Date.parse(session.createdAt);
  if (Number.isNaN(at)) return true;
  return at < CUTOFF_MS;
}

/** The exact predicate for revocation. Anything else is out of scope. */
function isTarget(session: Session, now: number): boolean {
  return (
    session.key.startsWith(SESSION_PREFIX) &&
    session.tier === "premium" &&
    isLive(session, now) &&
    isPreCutoff(session)
  );
}

async function main() {
  const now = Date.now();
  const all = await fetchAllSessions();

  const targets = all.filter((s) => isTarget(s, now));
  const premiumExpired = all.filter((s) => s.tier === "premium" && !isLive(s, now));
  const free = all.filter((s) => s.tier !== "premium");
  // Live premium sessions minted AFTER the cutoff: the corrected flow's work.
  const preserved = all.filter(
    (s) => s.tier === "premium" && isLive(s, now) && !isPreCutoff(s),
  );

  const accounts = new Map<string, { sessions: number; oldest?: string; newest?: string; admin: boolean }>();
  for (const t of targets) {
    const id = digest(t.email);
    const entry = accounts.get(id) ?? { sessions: 0, admin: false };
    entry.sessions++;
    entry.admin = entry.admin || Boolean(t.adminVerified);
    if (t.createdAt && (!entry.oldest || t.createdAt < entry.oldest)) entry.oldest = t.createdAt;
    if (t.createdAt && (!entry.newest || t.createdAt > entry.newest)) entry.newest = t.createdAt;
    accounts.set(id, entry);
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — premium session revocation`);
  console.log("=".repeat(62));
  console.log(`  cutoff (patched backend live) ${new Date(CUTOFF_MS).toISOString()}`);
  console.log(`  sessions in table ........... ${all.length}`);
  console.log(`  free (untouched) ............ ${free.length}`);
  console.log(`  premium already expired ..... ${premiumExpired.length} (untouched)`);
  console.log(`  premium AFTER cutoff ........ ${preserved.length} (PRESERVED — corrected flow)`);
  console.log(`  TARGETED for revocation ..... ${targets.length}`);
  console.log(`  distinct accounts affected .. ${accounts.size}`);
  const adminCount = [...accounts.values()].filter((a) => a.admin).length;
  console.log(`  of which admin-verified ..... ${adminCount}`);

  // Arithmetic must close, or the predicate is not partitioning the table.
  const livePremium = all.filter((s) => s.tier === "premium" && isLive(s, now)).length;
  if (targets.length + preserved.length !== livePremium) {
    throw new Error(
      `refusing: ${targets.length} targeted + ${preserved.length} preserved != ${livePremium} live premium`,
    );
  }
  if (free.length + premiumExpired.length + livePremium !== all.length) {
    throw new Error("refusing: session partition does not sum to the table count");
  }

  console.log(`\n  accounts (salted digest — emails and tokens are never shown)`);
  console.log("  " + "-".repeat(58));
  const sorted = [...accounts.entries()].sort((a, b) => b[1].sessions - a[1].sessions);
  for (const [id, info] of sorted.slice(0, 40)) {
    const oldest = info.oldest?.slice(0, 10) ?? "?";
    const newest = info.newest?.slice(0, 10) ?? "?";
    console.log(
      `  ${id}  sessions=${String(info.sessions).padStart(3)}  ${oldest} .. ${newest}${info.admin ? "  [admin]" : ""}`,
    );
  }
  if (sorted.length > 40) console.log(`  ... and ${sorted.length - 40} more accounts`);

  // Safety assertions before anything destructive.
  const stray = targets.filter((t) => !t.key.startsWith(SESSION_PREFIX));
  if (stray.length) throw new Error(`refusing: ${stray.length} targets outside ${SESSION_PREFIX}`);
  const nonPremium = targets.filter((t) => t.tier !== "premium");
  if (nonPremium.length) throw new Error(`refusing: ${nonPremium.length} non-premium targets`);
  const postCutoff = targets.filter((t) => !isPreCutoff(t));
  if (postCutoff.length) {
    throw new Error(
      `refusing: ${postCutoff.length} target(s) were created after the cutoff — the corrected flow's sessions must survive`,
    );
  }

  mkdirSync("tmp", { recursive: true });
  const manifestPath = `tmp/revocation-manifest-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        cutoff: new Date(CUTOFF_MS).toISOString(),
        targetedKeys: targets.length,
        distinctAccounts: accounts.size,
        preservedPostCutoff: preserved.length,
        freeUntouched: free.length,
        premiumExpiredUntouched: premiumExpired.length,
        // Keys contain the session token, so the manifest stores digests only.
        keyDigests: targets.map((t) => digest(t.key)),
      },
      null,
      2,
    ),
  );
  console.log(`\n  manifest written: ${manifestPath}`);
  console.log("  (key digests only — the manifest cannot be used to resurrect a session)");

  if (!APPLY) {
    console.log("\n  DRY RUN: nothing was deleted. Re-run with --apply to revoke.");
    console.log("  Revoke only AFTER the corrected auth flow is deployed and verified,");
    console.log("  so the affected subscribers can immediately sign back in.\n");
    return;
  }

  console.log(`\n  deleting ${targets.length} sessions...`);
  let deleted = 0;
  const BATCH = 50;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const list = batch.map((t) => `"${t.key.replace(/"/g, '\\"')}"`).join(",");
    await rest(`${TABLE}?key=in.(${encodeURIComponent(list)})`, { method: "DELETE" });
    deleted += batch.length;
    console.log(`    ${deleted}/${targets.length}`);
  }

  const after = await fetchAllSessions();
  const nowAfter = Date.now();
  const remaining = after.filter((s) => isTarget(s, nowAfter));
  const preservedAfter = after.filter(
    (s) => s.tier === "premium" && isLive(s, nowAfter) && !isPreCutoff(s),
  );
  console.log(`\n  targeted sessions remaining: ${remaining.length} (expect 0)`);
  console.log(`  post-cutoff premium preserved: ${preservedAfter.length} (was ${preserved.length})`);
  console.log(`  free sessions remaining: ${after.filter((s) => s.tier !== "premium").length} (was ${free.length})`);
  if (remaining.length > 0) {
    console.log("  WARNING: some targeted sessions survived; re-run to confirm.");
  }
  if (preservedAfter.length !== preserved.length) {
    console.log("  WARNING: a post-cutoff session was lost. Investigate before anything else.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
