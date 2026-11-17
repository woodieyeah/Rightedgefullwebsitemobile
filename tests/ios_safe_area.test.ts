/**
 * iOS safe-area handling must not change the website.
 *
 * THE BUG
 * In the simulator the RightEdge logo and the Premium Login button render
 * underneath the iPhone status bar and Dynamic Island. The fixed header sits
 * at `top-0` with no top inset, and index.html lacks `viewport-fit=cover`, so
 * `env(safe-area-inset-*)` resolves to 0 on iOS and every inset-based rule is
 * silently dead -- including the one already written for the bottom nav.
 *
 * THE RULE
 * `env(safe-area-inset-*)` is 0 on every desktop browser and on Android, and
 * iOS Safari only makes it non-zero with viewport-fit=cover. So padding built
 * from `max(<existing>, env(safe-area-inset-*))` is a no-op everywhere the
 * site already works, and only adds space where the notch actually is. That
 * is what makes this safe to ship on the shared bundle.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles/theme.css", import.meta.url), "utf8");

test("viewport-fit=cover is set, or every safe-area inset is dead on iOS", () => {
  const viewport = html.match(/<meta[^>]*name="viewport"[^>]*>/);
  assert.ok(viewport, "no viewport meta tag");
  assert.match(
    viewport[0],
    /viewport-fit=cover/,
    "without viewport-fit=cover, env(safe-area-inset-*) is always 0 on iOS",
  );
});

test("the viewport still sets width and initial-scale", () => {
  // Adding viewport-fit must not drop what was already there.
  const viewport = html.match(/<meta[^>]*name="viewport"[^>]*>/)![0];
  assert.match(viewport, /width=device-width/);
  assert.match(viewport, /initial-scale=1/);
});

test("the fixed header carries a top safe-area inset", () => {
  // The header is `fixed left-0 right-0 top-0`; on a notched iPhone its
  // content needs to start below the status bar.
  const header = app.match(/fixed left-0 right-0 top-0[^"`]*/);
  assert.ok(header, "the fixed header was not found");
  assert.match(
    header[0],
    /safe-area-inset-top|pt-safe/,
    "the fixed header has no top inset, so it renders under the status bar",
  );
});

test("the header inset uses max() so the web layout is unchanged", () => {
  // A bare env() would COLLAPSE existing padding to 0 on desktop. max() keeps
  // whatever the site already had and only grows on a notched device.
  const header = app.match(/fixed left-0 right-0 top-0[^"`]*/)![0];
  const insetRule = header.match(/\[padding-top:[^\]]+\]|pt-\[[^\]]+\]/);
  assert.ok(insetRule, "no explicit top padding rule on the header");
  assert.match(
    insetRule[0],
    /max\(/,
    "the inset must be max(existing, env(...)) so desktop spacing is preserved",
  );
});

test("the bottom nav keeps its existing home-indicator inset", () => {
  // This one was already correct in source; it was only ever dead because
  // viewport-fit was missing. It must survive the change.
  assert.match(app, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
});

test("scrollable content clears the home indicator", () => {
  // Content behind the bottom bar is unreachable on a gesture-nav iPhone.
  assert.match(
    css,
    /safe-area-inset-bottom/,
    "no bottom inset in global CSS for scrollable regions",
  );
});

test("no safe-area rule uses a bare env() without a fallback", () => {
  // env() with no second argument yields an empty value in browsers that do
  // not know the variable, which can invalidate the whole declaration.
  const bare = [...app.matchAll(/env\(safe-area-inset-[a-z]+\)/g)];
  for (const m of bare) {
    const around = app.slice(Math.max(0, m.index! - 60), m.index! + 60);
    assert.match(
      around,
      /max\(|,\s*0?px|,\s*0\)/,
      `bare env() with no fallback near: ${m[0]}`,
    );
  }
});
