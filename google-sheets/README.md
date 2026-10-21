# RightEdge Google Sheets automation

Source-controlled copy of the Apps Script attached to the RightEdge NRL Google Sheet.

| File | Purpose |
|---|---|
| `rightedge-match-odds-sync.gs` | Existing odds sync + the Sheet menu |
| `rightedge-tuesday-automation.gs` | Tuesday NRL data collection, preview, approval and apply |

## What the Tuesday automation does

Every Tuesday at **6:00pm Australia/Sydney** it collects the week's source data,
validates it, and writes a **preview** of every proposed cell change. It only
touches the real input tabs after the change has been approved.

Order of operations is identical to the manual routine you run today:

1. Write the validated inputs (season data, advanced data, fixtures, try scorers)
2. Update Match Odds — which internally runs Pinnacle odds and `updatePredictions()`
3. Sync try-scorer odds
4. Verify the Match Predictions and Try Scorer Value Plays output

The canonical chain runs **exactly once** per plan. If a later step fails, the
already-completed steps are remembered so a retry never double-runs the model.

## Data sources

| Sheet destination | Source | Notes |
|---|---|---|
| `2026 Data Sheet` | Rugby League Project season summary | All 17 ladder rows, 27 columns |
| `2026 Advanced Data Sheet` — Post Contact Metres, Line Breaks, Tackle Breaks, Missed Tackles | NRL.com `/stats/teams/data` JSON | Requested with `Accept: application/json` |
| `2026 Advanced Data Sheet` — Ruck Infringements | Champion Data `setRestartsRuck` | Averaged over completed matches only |
| `Match Predictions` A:B | Champion Data fixture | Authoritative round draw |
| `Player Prop - Anytime Try Scorer` A:F | Stats Insider `anytimeTry` | Published after Tuesday team lists |

**NRL.com quirk:** the same URL returns a sign-in interstitial with HTTP 200 if
the request advertises `text/html`. `fetchRightEdgeNrlJsonText_` therefore asks
for JSON only, and `parseRightEdgeNrlPayload_` rejects any sign-in page rather
than treating it as data. A club-domain HTML page is kept as a fallback.

## Fail-closed guarantees

Nothing is ever guessed. The run stops with a `Needs Check` status when:

- the ladder is not exactly 17 recognised teams
- any metric is missing, `null`, blank, or non-numeric (never coerced to zero)
- a team identity is not an exact known alias (no substring guessing)
- games-played disagrees across the ladder, fixtures, and NRL metrics
- a fixture repeats a team or lists the same team on both sides
- the Stats Insider round does not match the authoritative draw, or any match
  lacks a full 17 home and 17 away players with mapped positions
- an input cell changed between the preview and the approval
- the plan's contents no longer hash to its approved plan ID
- a plan range points anywhere other than its canonical sheet/coordinates/width

Text arriving from an external source that starts with `=`, `+`, `-`, or `@` is
prefixed with `'` so it can never execute as a spreadsheet formula.
Whitespace-prefixed variants (` =HYPERLINK(...)`, newlines, non-breaking
spaces) are caught too, because Sheets trims leading whitespace before deciding
a cell is a formula.

## Safety behaviour

- **First two Tuesdays:** preview only, no writes. Approve from the menu.
- **Afterwards:** applies automatically, still writing the preview first.
- **Writes only the previewed block.** Nothing outside the reviewed range is cleared.
- **Rollback:** if any range fails mid-write — including the range that failed
  part-way through its own write — every affected range is restored to its
  previewed before-values. If a restore itself fails, the remaining ranges are
  still rolled back and the error names exactly what could not be restored.
- **Strict odds mode validates before writing.** In the Tuesday run, an empty or
  unmatched odds feed aborts before any odds column is touched, because those
  columns sit outside the plan's rollback.
- **Tamper-proof approval:** the plan ID is a SHA-256 over the plan's ranges, so
  editing the hidden pending-plan sheet invalidates it. Destination sheet,
  coordinates and width are pinned independently.
- **Scorer rows append.** Each round is written beneath the previous round's
  block, preserving the history that position mapping depends on.
- **Bounded retries:** if Stats Insider has not published, it retries every 10
  minutes up to `RIGHTEDGE_TUESDAY_MAX_RETRIES` (12 ≈ 2 hours), then stops and
  reports `Needs Check` rather than looping forever.
- **Locking:** a document lock prevents two runs overlapping.

## Menu

Under **RightEdge Odds**:

- `Preview Tuesday Automation` — collect, validate, and write the preview
- `Approve Tuesday Preview` — apply the previewed plan
- `Install Tuesday 6pm Automation` — create the weekly trigger
- `Remove Tuesday Automation` — remove only the Tuesday triggers

`Remove All Auto Syncs` is unchanged and still removes the older odds triggers.

## Preview tabs

- `Tuesday Automation Preview` — status plus every proposed cell change
  (sheet, cell, before, after)
- `Tuesday Automation Pending` — the serialized plan awaiting approval

## Tests

```bash
npm run test
```

Covers parsing, validation, fail-closed paths, plan integrity, exactly-once
model execution, rollback, retry bounds, and menu wiring.

The suite is mutation-tested: deliberately breaking any one of the 17 safety
guarantees (sanitization, strict numbers, exact team matching, fixture
integrity, sign-in detection, retry cap, clear width, stale-preview check,
exactly-once execution, strict odds modes, both plan guards, scorer sheet and
append offset, failing-range rollback, SHA-256 plan binding, and write-ordering)
causes at least one test to fail.
