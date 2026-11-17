# What the iOS simulator test actually proves — and what it does not

Written 2026-11-17. Read this before trusting a green run.

## What the smoke test IS

**DOM interaction testing inside a WKWebView.** A probe injected into
`dist/index.html` (CI only, never shipped) finds the real tab elements by their
text, dispatches a synthetic
`pointerdown → mousedown → pointerup → mouseup → click` sequence, waits two
animation frames plus 600ms for React to commit, then asserts on
`document.body.innerText`.

That genuinely exercises: the React event handlers, `handlePageChange`, the
hash router and `checkHash`, the native/web branches, data fetching, and
rendering.

## What it is NOT

**It is not a tap test.** A synthetic `click` bypasses the entire native input
path. It proves nothing about:

- whether the control is **hit-testable by a finger** — a transparent view, a
  mis-set `pointer-events`, or a parent with `overflow: hidden` can swallow a
  real tap while `dispatchEvent` still fires the handler
- **UIKit gesture recognisers** competing with the webview
- the control being **within the safe area** and not under the home indicator
- **scroll position** — the element may be off-screen; `dispatchEvent` does not
  care, a finger does
- real **touch latency** or multi-touch

Anything that claims a tab "works" on this evidence is overstating it. The
honest claim is: *the tab's handler, routing and rendering work.*

## The real fix, when it matters

**XCUITest** drives the actual UI with real touch events through the
accessibility layer:

```swift
let app = XCUIApplication()
app.launch()
app.webViews.buttons["Plays"].tap()   // genuine synthesised touch
XCTAssert(app.webViews.staticTexts["Plays is a Premium feature"].waitForExistence(timeout: 5))
```

Why it is not in place yet:

1. It needs a **test target** in the Xcode project. Capacitor's generated
   project has none, and adding one means editing `project.pbxproj` — which is
   the sort of change that is painful to get right without Xcode locally.
2. WKWebView content is only reachable from XCUITest when elements carry
   accessibility identifiers. React renders divs and buttons; they surface as
   `staticTexts`/`buttons` only when labelled, so parts of the app would need
   `aria-label`/`accessibilityIdentifier` work first.
3. It roughly doubles CI runtime.

**Recommendation:** do this once, before App Store submission, as part of
release-candidate testing — not as ongoing prototype scaffolding. The DOM test
catches logic regressions cheaply and that is what it is for.

## Getting results out of the webview

**`console.log` does NOT reach `simctl spawn log show`.** Proven: a run that
recorded 15 network requests produced **zero** `[NETLOG]` lines in the native
log. Any assertion that greps `app.log` for webview output is dead code that
silently reports success.

Two channels actually work:

1. **DOM overlay → screenshot.** Human-readable, but needs eyes or OCR.
2. **`localStorage` → app container → sqlite.** Machine-readable, and what the
   assertions now use:

```bash
CONTAINER=$(xcrun simctl get_app_container "$UDID" au.com.rightedge.app data)
DB=$(find "$CONTAINER" -name 'localstorage.sqlite3' | head -1)
sqlite3 "$DB" "SELECT value FROM ItemTable WHERE key='hermes_navlog';" | tr -d '\000'
```

The value is UTF-16, hence `tr -d '\000'`.

**Fail closed:** if no navlog is recovered, the job must FAIL, not pass with a
warning. "No failures found" and "no results found" are different outcomes and
must never produce the same verdict.

## Screenshot hashes are weak evidence

Comparing adjacent screenshots catches a completely dead interaction, but it is
easily fooled: any diagnostic banner whose text changes per phase makes two
shots differ while the page underneath is identical. Assert on **content**
(`innerText` contains the expected markers) and keep diagnostics hidden until
the final frame.

## Timing

Never fire a step on a fixed timer and hope the app is ready. Poll for the
expected content with a timeout, and record an explicit failure when the
timeout wins:

```js
whenReady(matchesOpen, 25000, onReady, onTimeout);
```

A fixed `setTimeout(…, 14000)` silently tests the wrong screen when the network
is slow.

## Runner flakiness is real

A run can fail with no code change at all. One run timed out after 12 minutes
having printed `using iPhone 17 Pro` and **nothing else** — `simctl boot` hung
with zero output, where a working run prints ~90 seconds of boot-status lines.
Re-run before investigating code.

Also: `concurrency: cancel-in-progress: true` means a second push **cancels the
first run**. Batch code and docs into one push, or the run you are waiting on
dies.
