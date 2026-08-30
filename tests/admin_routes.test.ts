import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../supabase/functions/server/index.tsx", import.meta.url),
  "utf8",
);

test("the verified admin middleware is registered before every admin route", () => {
  const middlewareMarker = 'app.use("/admin/*"';
  const middlewareIndex = serverSource.indexOf(middlewareMarker);
  assert.notEqual(middlewareIndex, -1, "missing shared /admin/* middleware");
  assert.match(
    serverSource.slice(middlewareIndex, middlewareIndex + 500),
    /requireAdmin\(c\)/,
  );

  const routePattern = /app\.(?:get|post|put|delete)\("\/admin\//g;
  const routeIndexes = Array.from(serverSource.matchAll(routePattern), (match) => match.index);
  assert.ok(routeIndexes.length > 0, "expected at least one admin route");
  assert.ok(
    routeIndexes.every((routeIndex) => routeIndex > middlewareIndex),
    "every admin route must be registered after the shared middleware",
  );
});

test("admin OTP handlers use only atomic RPCs and exact failed-delivery cancellation", () => {
  const requestHandler = serverSource.slice(
    serverSource.indexOf('app.post("/auth/admin/request"'),
    serverSource.indexOf('app.post("/auth/admin/verify"'),
  );
  const verifyHandler = serverSource.slice(
    serverSource.indexOf('app.post("/auth/admin/verify"'),
    serverSource.indexOf("function getFromEmail"),
  );
  assert.match(requestHandler, /issueAdminChallenge\(rpc, challengeKey, challenge\)/);
  assert.match(requestHandler, /catch \(deliveryError\)[\s\S]*cancelAdminChallenge\(rpc, challengeKey, challenge\.codeHash\)/);
  assert.doesNotMatch(requestHandler, /kv\.(?:get|set|del)\(challengeKey/);
  assert.match(verifyHandler, /verifyAndConsumeAdminChallenge\(/);
  assert.doesNotMatch(verifyHandler, /kv\.(?:get|set|del)\(challengeKey/);
  assert.match(serverSource, /ADMIN_CODE_HMAC_SECRET/);
});

test("admin session renewal preserves the immutable eight-hour deadline", () => {
  assert.match(serverSource, /getAdminSessionAbsoluteExpiry\(createdAtMs\)/);
  assert.match(serverSource, /getAdminSessionRemainingMaxAge\(createdAtMs, nowMs\)/);
  assert.match(serverSource, /writeAuthSessionCookie\(c, renewedSession\.token, maxAgeSeconds\)/);
});

test("sensitive diagnostics and writes are inside the protected admin namespace", () => {
  // NOTE: /round-snapshot is deliberately NOT in this list.
  //
  // The kickoff freeze runs in ordinary visitors' browsers so that a match's
  // plays lock in an hour before kickoff whether or not an administrator has
  // the site open. While it posted to the admin-only route every such write
  // returned 401, so no play was ever frozen and completed matches lost their
  // plays entirely. It now posts to a public write-once route instead.
  //
  // That route is guarded by behaviour rather than authentication, asserted by
  // the "public round-snapshot freeze is write-once and window-bound" test
  // below: first write wins permanently, writes are only accepted inside the
  // server-derived kickoff window, and payloads are size- and shape-checked.
  assert.doesNotMatch(
    serverSource,
    /app\.(?:get|post)\("\/(?:analytics-events|analytics-debug|kv-namespace-scan|test-kv)"/,
  );
  assert.match(serverSource, /app\.get\("\/admin\/analytics-events"/);
  assert.match(serverSource, /app\.get\("\/admin\/analytics-debug"/);
  assert.match(serverSource, /app\.get\("\/admin\/kv-namespace-scan"/);
  // The admin route is retained for administrator-initiated freezes.
  assert.match(serverSource, /app\.post\("\/admin\/round-snapshot"/);
});

test("public round-snapshot freeze is write-once and window-bound", () => {
  const handler = serverSource.slice(
    serverSource.indexOf('app.post("/round-snapshot"'),
    serverSource.indexOf('app.get("/round-snapshots"'),
  );
  assert.ok(handler.length > 0, "public /round-snapshot handler should exist");

  // First write wins permanently: an existing snapshot is returned untouched
  // so a later visitor can never overwrite a frozen play.
  assert.match(handler, /const existing = await kv\.get\(key\)/);
  assert.match(handler, /if \(existing\)[\s\S]*alreadyFrozen: true/);

  // The freeze window is derived from the fixtures sheet on the SERVER, never
  // taken from the request body.
  assert.match(handler, /fetchPublishedSheetRows\(SHEET_GIDS\.fixtures2026\)/);
  assert.match(handler, /PUBLIC_FREEZE_WINDOW_MS/);
  assert.match(handler, /PUBLIC_FREEZE_GRACE_MS/);
  assert.doesNotMatch(handler, /body\.kickoff/);

  // Payloads are bounded and shape-checked before being made permanent.
  assert.match(handler, /Payload too large/);
  assert.match(handler, /Invalid play values/);
  assert.match(handler, /Invalid premiumPlays/);
  assert.match(handler, /Invalid tryScorers/);
});
