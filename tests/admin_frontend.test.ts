import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  failClosedAuthState,
  normalizeAdminCodeInput,
} from "../src/app/auth-session.ts";

const appSource = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(
  new URL("../src/app/components/AdminDashboard.tsx", import.meta.url),
  "utf8",
);

test("session refresh failures clear administrator privilege", () => {
  assert.deepEqual(
    failClosedAuthState({ checked: true, email: "admin@example.com", tier: "premium", admin: true }),
    { checked: true, email: null, tier: "none", admin: false },
  );
  assert.match(appSource, /const nextState = failClosedAuthState\(runtimeAuthState\)/);
  assert.match(appSource, /applyAuthState\(nextState\)/);
});

test("administrator code input uses the server's unambiguous alphabet", () => {
  assert.equal(normalizeAdminCodeInput("abci-lo29"), "ABC29");
  assert.equal(normalizeAdminCodeInput("ab-cd-23-xy"), "ABCD23XY");
  assert.match(dashboardSource, /normalizeAdminCodeInput\(e\.target\.value\)/);
  assert.match(dashboardSource, /pattern="\[ABCDEFGHJKMNPQRSTUVWXYZ23456789\]\{8\}"/);
});

test("protected dashboard requests fail closed on unauthorized responses", () => {
  assert.match(dashboardSource, /const adminFetch = async/);
  assert.match(dashboardSource, /response\.status === 401/);
  assert.doesNotMatch(dashboardSource, /fetch\(`?\/api\/admin/);
});

test("round snapshot writes use the protected administrator route", () => {
  assert.doesNotMatch(appSource, /fetch\(`\/api\/round-snapshot`/);
  assert.match(appSource, /protectedAdminFetch\(`\/api\/admin\/round-snapshot`/);
  assert.match(appSource, /if \(response\.status === 401\)[\s\S]*new Event\('adminAuthCleared'\)/);
  assert.match(appSource, /postRoundSnapshot\(b, snapshotController\.signal\)/);
  assert.match(appSource, /enableFreeze: isAdmin && !selectedArchive/);
  assert.match(appSource, /postingKeysRef/);
  assert.match(appSource, /if \(snapshot\) postedKeysRef\.current\.add\(toPost\[index\]\.matchKey\)/);
});

test("logout always clears local administrator state and cached data", () => {
  const logoutSource = dashboardSource.slice(
    dashboardSource.indexOf('const handleLogout'),
    dashboardSource.indexOf('const generateReviewEmail'),
  );
  assert.ok(logoutSource.indexOf('clearAdminAccess();') < logoutSource.indexOf("fetch('/api/auth/logout'"));
  assert.match(logoutSource, /AbortController/);
  assert.match(logoutSource, /setTimeout\([^,]+, 10_000\)/s);
  assert.match(dashboardSource, /logoutPending/);
  assert.match(dashboardSource, /disabled={[^}]*logoutPending/);
  assert.match(dashboardSource, /new Event\('adminAuthCleared'\)/);
  assert.match(appSource, /addEventListener\('adminAuthCleared'/);
});

test("logout invalidates stale dashboard and application requests", () => {
  assert.match(dashboardSource, /adminGenerationRef = useRef\(0\)/);
  assert.match(dashboardSource, /adminRequestControllerRef = useRef\(new AbortController\(\)\)/);
  assert.match(dashboardSource, /generation !== adminGenerationRef\.current/);
  assert.match(appSource, /authSessionGenerationRef = useRef\(0\)/);
  assert.match(appSource, /const generation = \+\+authSessionGenerationRef\.current/);
  assert.match(appSource, /generation !== authSessionGenerationRef\.current/);
  assert.match(appSource, /authSessionGenerationRef\.current \+= 1/);
});

test("reset access uses the same bounded fail-closed logout behavior", () => {
  assert.match(appSource, /const handleResetAccess = async \(\) =>/);
  assert.match(appSource, /applyAuthState\(failClosedAuthState\(runtimeAuthState\)\)/);
  assert.match(appSource, /resetController\.abort\(\), 10_000/);
  assert.match(appSource, /if \(!response\.ok\)/);
  assert.doesNotMatch(appSource, /title="Debug: Reset Email Access"/);
});

test("administrator login route is reachable without existing member access", () => {
  const checkHashSource = appSource.slice(
    appSource.indexOf("const checkHash = () =>"),
    appSource.indexOf("const confirmStripeSuccess"),
  );
  const adminRoute = checkHashSource.indexOf('if (hash === "admin")');
  const memberAccessGate = checkHashSource.indexOf("if (appHashes.includes(hash))");

  assert.ok(adminRoute >= 0, "admin must have an explicit public login route");
  assert.ok(adminRoute < memberAccessGate, "admin login must be handled before the member access gate");
  assert.match(
    checkHashSource.slice(adminRoute, memberAccessGate),
    /setSitePage\("admin"\)/,
  );
});
