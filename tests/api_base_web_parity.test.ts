/**
 * The production website's API behaviour must be unchanged.
 *
 * resolveApiUrl is now wrapped around every /api/ call site in the app. The
 * risk that matters is a regression on the live site used by paying
 * subscribers, so this asserts the web path is a strict identity: for every
 * endpoint the audit found, on every realistic web origin, the resolved URL
 * is byte-identical to the original relative path.
 *
 * If that holds, the Vercel rewrite keeps serving exactly as before and the
 * only behavioural change is confined to native origins.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolveApiUrl, EDGE_FUNCTION_BASE } from "../src/app/api-base.ts";

/** Every endpoint referenced in the app, read from source. */
function endpointsInSource(): string[] {
  const files = [
    "src/app/App.tsx",
    "src/app/components/AdminDashboard.tsx",
    "src/app/lab/ModelLabPage.tsx",
  ];
  const found = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/["'`](\/api\/[a-z0-9/_-]+)/gi)) found.add(m[1]);
  }
  return [...found].sort();
}

const WEB_ORIGINS = [
  "https://rightedge.com.au",
  "https://www.rightedge.com.au",
  "https://rightedge.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
];

test("every endpoint in the source resolves to itself on the web", () => {
  const endpoints = endpointsInSource();
  assert.ok(endpoints.length >= 25, `expected the full endpoint set, found ${endpoints.length}`);

  for (const path of endpoints) {
    for (const origin of WEB_ORIGINS) {
      assert.equal(
        resolveApiUrl(path, origin),
        path,
        `${path} changed on ${origin} — this would alter production behaviour`,
      );
    }
  }
});

test("every endpoint in the source resolves to the edge function natively", () => {
  for (const path of endpointsInSource()) {
    const resolved = resolveApiUrl(path, "capacitor://localhost");
    assert.ok(
      resolved.startsWith(`${EDGE_FUNCTION_BASE}/`),
      `${path} did not route to the edge function (got ${resolved})`,
    );
    // The path after /api must be preserved exactly.
    assert.equal(resolved, `${EDGE_FUNCTION_BASE}${path.slice("/api".length)}`);
  }
});

test("no /api call site in the app bypasses the resolver", () => {
  const files = [
    "src/app/App.tsx",
    "src/app/components/AdminDashboard.tsx",
    "src/app/lab/ModelLabPage.tsx",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // A bare fetch("/api/...") would work on the web but silently fail in
    // the native shell, which is exactly the class of bug this prevents.
    const bare = [...text.matchAll(/fetch\(\s*["'`]\/api\//g)];
    assert.equal(bare.length, 0, `${file} has ${bare.length} unresolved /api fetch call(s)`);
  }
});

test("the built web bundle still contains the relative API paths", () => {
  // Proof the website is unaffected: the production bundle must still carry
  // "/api/auth/session" as a relative path, because resolveApiUrl returns it
  // unchanged on an http(s) origin.
  const assets = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
  assert.ok(assets.length > 0, "no built bundle found — run npm run build");
  const bundle = assets.map((f) => readFileSync(`dist/assets/${f}`, "utf8")).join("");
  assert.match(bundle, /\/api\/auth\/session/, "the relative API path is missing from the bundle");
  assert.match(bundle, /make-server-3b84b96c/, "the native base URL is missing from the bundle");
});

test("no backend secret is bundled", () => {
  const assets = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
  const bundle = assets.map((f) => readFileSync(`dist/assets/${f}`, "utf8")).join("");
  // A service-role JWT carries this role claim; the anon key does not.
  assert.doesNotMatch(bundle, /service_role/, "a service-role key appears in the client bundle");
  assert.doesNotMatch(bundle, /SUPABASE_SERVICE_ROLE_KEY/, "a service-role env name is bundled");
});
