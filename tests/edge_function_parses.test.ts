/**
 * The Edge Function must PARSE before it can be deployed.
 *
 * WHY THIS EXISTS
 * A duplicate `const session` in /create-customer-portal shipped to production
 * and the function failed to boot — every /api/* route returned 503 until it
 * was fixed. Nothing in the pipeline had ever parsed index.tsx: `npm run build`
 * only compiles src/ for the browser, and the other tests read the edge
 * function as TEXT with regexes, which cannot detect a scope collision.
 *
 * esbuild is already a dependency (it is what Vite uses) and reports exactly
 * the error the Deno runtime rejected: 'The symbol "session" has already been
 * declared'. Verified by reintroducing the bug: clean parses, duplicate fails.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild") as typeof import("esbuild");

const SERVER_DIR = new URL("../supabase/functions/server/", import.meta.url);

function serverFiles(): string[] {
  return readdirSync(SERVER_DIR).filter((f) => /\.tsx?$/.test(f));
}

test("every edge function file parses", () => {
  const files = serverFiles();
  assert.ok(files.length >= 5, `expected the server files, found ${files.length}`);

  for (const file of files) {
    const source = readFileSync(new URL(file, SERVER_DIR), "utf8");
    try {
      esbuild.transformSync(source, {
        loader: file.endsWith(".tsx") ? "tsx" : "ts",
        // Match the Deno runtime: ES modules, no JSX transform assumptions.
        format: "esm",
      });
    } catch (error: any) {
      const detail =
        error.errors?.map((e: any) => `${e.text} (line ${e.location?.line})`).join("\n") ??
        error.message;
      assert.fail(`${file} does not parse — the function would fail to boot:\n${detail}`);
    }
  }
});

test("the premium modules the function imports all exist", () => {
  // A missing import is the other way the worker fails to boot, and it is
  // invisible to a regex test.
  const index = readFileSync(new URL("index.tsx", SERVER_DIR), "utf8");
  const present = new Set(serverFiles());

  const localImports = [...index.matchAll(/from\s+"\.\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(localImports.length > 0, "no local imports found");

  for (const imported of localImports) {
    assert.ok(
      present.has(imported),
      `index.tsx imports ./${imported}, which is not in the deployed directory`,
    );
  }
});

test("every symbol imported from the premium modules is exported", () => {
  const index = readFileSync(new URL("index.tsx", SERVER_DIR), "utf8");

  for (const module of ["premium_auth.ts", "premium_challenge_store.ts"]) {
    const block = index.match(
      new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*"\\./${module.replace(".", "\\.")}"`),
    );
    if (!block) continue;

    const wanted = block[1]
      .split(",")
      .map((s) => s.replace(/^\s*type\s+/, "").trim())
      .filter(Boolean);

    const source = readFileSync(new URL(module, SERVER_DIR), "utf8");
    for (const symbol of wanted) {
      const exported =
        new RegExp(`export\\s+(async\\s+)?(function|const|type|class)\\s+${symbol}\\b`).test(source) ||
        new RegExp(`export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`).test(source);
      assert.ok(
        exported,
        `index.tsx imports ${symbol} from ./${module}, which does not export it — the worker would fail to boot`,
      );
    }
  }
});
