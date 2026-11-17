/**
 * Audit every /api/ call site for native (Capacitor) compatibility.
 *
 * Classifies each endpoint by what it depends on, because a base-URL swap
 * alone does not make all of them work:
 *   - cookie:    the backend reads the session ONLY from the HttpOnly cookie
 *                (getAuthSessionFromRequest -> parseCookieHeader), so these
 *                need a credential mechanism, not just a URL
 *   - admin:     behind the /admin/* middleware, which calls requireAdmin
 *   - stripe:    builds browser redirect URLs from window.location.origin
 *   - redirect:  depends on being inside a browser tab
 *   - public:    no session needed; a URL swap is sufficient
 *
 * Reads the source rather than relying on memory.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const files = [...walk("src"), ...walk("utils")];

/** Endpoints the edge function guards with requireAdmin via /admin/*. */
const isAdmin = (path: string) => path.startsWith("/api/admin/");

/** Routes whose handler calls getAuthSessionFromRequest / clearAuthSession. */
const COOKIE_ROUTES = new Set([
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/admin/request",
  "/api/auth/admin/verify",
  "/api/round-snapshot",
  "/api/apply-retention-offer",
  "/api/create-customer-portal",
  "/api/confirm-checkout-session",
]);

const STRIPE_ROUTES = new Set([
  "/api/create-checkout-session",
  "/api/create-customer-portal",
  "/api/confirm-checkout-session",
  "/api/apply-retention-offer",
]);

interface Hit { path: string; file: string; line: number }
const hits: Hit[] = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/["'`](\/api\/[a-z0-9/_-]+)/gi)) {
      hits.push({ path: m[1], file, line: i + 1 });
    }
  });
}

const byPath = new Map<string, Hit[]>();
for (const h of hits) byPath.set(h.path, [...(byPath.get(h.path) ?? []), h]);

const rows: Array<{ path: string; kind: string; sites: number; note: string }> = [];
for (const [path, list] of byPath) {
  const tags: string[] = [];
  if (isAdmin(path)) tags.push("admin");
  if (COOKIE_ROUTES.has(path)) tags.push("cookie");
  if (STRIPE_ROUTES.has(path)) tags.push("stripe");
  const kind = tags.length ? tags.join("+") : "public";
  const note =
    tags.includes("stripe") ? "browser redirect + session"
    : tags.includes("admin") ? "requireAdmin, cookie only"
    : tags.includes("cookie") ? "session cookie required"
    : "URL swap is sufficient";
  rows.push({ path, kind, sites: list.length, note });
}

rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));

console.log(`  ${rows.length} distinct endpoint(s), ${hits.length} reference(s)\n`);
console.log(`  ${"endpoint".padEnd(42)} ${"depends on".padEnd(16)} refs  note`);
console.log(`  ${"-".repeat(96)}`);
for (const r of rows) {
  console.log(`  ${r.path.padEnd(42)} ${r.kind.padEnd(16)} ${String(r.sites).padStart(3)}   ${r.note}`);
}

const counts = rows.reduce<Record<string, number>>((acc, r) => {
  acc[r.kind] = (acc[r.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`\n  by dependency:`);
for (const [k, v] of Object.entries(counts).sort()) console.log(`    ${k.padEnd(16)} ${v}`);

const publicOnly = rows.filter((r) => r.kind === "public").length;
console.log(`\n  ${publicOnly} endpoint(s) work with a URL swap alone.`);
console.log(`  ${rows.length - publicOnly} need a credential mechanism (Phase 2).`);

// Origin-derived URLs break under capacitor://localhost.
console.log(`\n  window.location.origin uses (break in the native shell):`);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (/location\.(origin|protocol)/.test(line)) {
      console.log(`    ${file}:${i + 1}  ${line.trim().slice(0, 96)}`);
    }
  });
}
