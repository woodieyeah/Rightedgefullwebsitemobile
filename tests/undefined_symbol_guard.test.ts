/**
 * The build cannot catch an undefined symbol, so a test must.
 *
 * `vite build` uses esbuild, which strips TypeScript types without type
 * checking, and TypeScript itself is not installed. A branch once carried
 * three `resolveApiUrl(...)` calls with no import: the build passed, the
 * bundle shipped a bare reference, and premium code verification, retention
 * offers and the billing portal would all have thrown
 * `ReferenceError: resolveApiUrl is not defined` at runtime.
 *
 * These tests pin the specific failure mode (a helper used without being
 * imported) for the modules that carry authentication and billing calls.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const APP_FILES = [
  "../src/app/App.tsx",
  "../src/app/components/AdminDashboard.tsx",
];

/** Helpers that live in another module and must be imported to be used. */
const IMPORTED_HELPERS = [
  "resolveApiUrl",
  "requiresSessionCredentials",
  "isNativeOrigin",
];

function readIfPresent(relative: string): string | null {
  try {
    return readFileSync(new URL(relative, import.meta.url), "utf8");
  } catch {
    return null;
  }
}

for (const relative of APP_FILES) {
  const name = relative.split("/").pop();

  test(`${name} imports every cross-module helper it calls`, () => {
    const source = readIfPresent(relative);
    if (source === null) return; // not present on this branch

    for (const helper of IMPORTED_HELPERS) {
      if (!new RegExp(`\\b${helper}\\s*\\(`).test(source)) continue;
      const imported = new RegExp(
        `import\\s*\\{[^}]*\\b${helper}\\b[^}]*\\}\\s*from`,
        "s",
      ).test(source);
      assert.ok(
        imported,
        `${name} calls ${helper}() without importing it — this throws ReferenceError at runtime and the build will not catch it`,
      );
    }
  });
}

test("the built bundle defines every helper it references", () => {
  // A bare reference in the output is the actual shipped failure, so assert
  // against the bundle rather than only the source.
  let assets: string[];
  try {
    assets = readdirSync(new URL("../dist/assets/", import.meta.url));
  } catch {
    return; // not built in this environment
  }

  for (const bundle of assets.filter((f) => /^index-.*\.js$/.test(f))) {
    const code = readFileSync(
      new URL(`../dist/assets/${bundle}`, import.meta.url),
      "utf8",
    );
    for (const helper of IMPORTED_HELPERS) {
      if (!code.includes(`${helper}(`)) continue;
      const defined =
        new RegExp(`(function|const|let|var)\\s+${helper}\\b`).test(code) ||
        new RegExp(`\\b${helper}\\s*=[^=]`).test(code);
      assert.ok(
        defined,
        `${bundle} calls ${helper}() but never defines it — shipping a ReferenceError`,
      );
    }
  }
});
