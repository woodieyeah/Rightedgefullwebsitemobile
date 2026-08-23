import assert from "node:assert/strict";
import test from "node:test";

import { isVerifiedAdminSession } from "../src/app/auth-session.ts";

test("admin access requires the server verified admin flag", () => {
  assert.equal(
    isVerifiedAdminSession({
      authenticated: true,
      email: "elliott@rightedge.com.au",
      admin: false,
    }),
    false,
  );
  assert.equal(isVerifiedAdminSession({ authenticated: true, admin: true }), true);
  assert.equal(isVerifiedAdminSession({ authenticated: false, admin: true }), false);
});
