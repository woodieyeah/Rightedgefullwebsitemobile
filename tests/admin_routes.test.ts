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
  assert.doesNotMatch(
    serverSource,
    /app\.(?:get|post)\("\/(?:analytics-events|analytics-debug|kv-namespace-scan|test-kv|round-snapshot)"/,
  );
  assert.match(serverSource, /app\.get\("\/admin\/analytics-events"/);
  assert.match(serverSource, /app\.get\("\/admin\/analytics-debug"/);
  assert.match(serverSource, /app\.get\("\/admin\/kv-namespace-scan"/);
  assert.match(serverSource, /app\.post\("\/admin\/round-snapshot"/);
});
