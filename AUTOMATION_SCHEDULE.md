# RightEdge Automation Schedule

_Last updated: 2026-08-27. All times below are AEST (Sydney, UTC+10) — matched to what you'll actually see once you're back in Australia. Bots post to your Discord DM with RightEdgeAnalyst._

⚠️ **Daylight saving note:** these times are fixed against the underlying server clock (UTC+7) with a +3 hour offset baked in for AEST. Sydney moves to AEDT (UTC+11) in October when daylight saving starts — at that point everything below will land **1 hour later** than shown until I adjust it. I'll flag this again closer to the DST switchover so we can shift the schedule together.

## Data Bot

Marketing Bot has been removed (2026-08-27) — the operator didn't like its drafts. Email content is now entirely manual; Data Bot still surfaces the real numbers and timing/content patterns worth knowing, but no bot drafts copy anymore.

| Day | Time (AEST) | What it does |
|---|---|---|
| Tuesday | 6:00–8:50pm, every 10 min | **Live watch.** Messages you on every single check while the 6pm automation runs and retries — not just when something changes, so you always know it's actively working. Progress ("down to 1 of 8"), a repeat/heartbeat ping if nothing's moved, or a flag if the failure reason itself changes (e.g. a player issue became a team-name issue). |
| Tuesday | 7:00pm | **Confirms the round's data automation.** If applied, posts a full Match Predictions snapshot (scores, implied odds, Pinnacle odds, best odds) for all 8 matches. If still pending your approval, tells you to click "Approve Tuesday Preview" in the Sheet. If still waiting on a data source (e.g. Stats Insider), says so plainly. |
| Wednesday | 7:00am | Follow-up check — confirms what happened overnight if Tuesday night's run was still retrying, and states which round is now live. |
| Thursday | 7:00am | Reports today's live fixtures only (matches actually kicking off today), with predicted scores and the odds currently in the Sheet. Never re-syncs odds itself. |
| Friday | 7:00am | Same as Thursday, for Friday's fixtures. |
| Saturday | 7:00am | Same as Thursday, for Saturday's fixtures. |
| Sunday | 7:00am | Same as Thursday, for Sunday's fixtures. |
| Sunday | 5:00pm | **Full round results**, once every game is finished — final scores, Core Plays Hit/Miss, Same Game Multis Hit/Miss. Only reports if the round's verified results file has actually been built; says plainly if it hasn't (never guesses a result). |
| Thu/Fri/Sat | 8:00am | **Opportunity scan.** Three checks, treated differently: (1) standout round momentum (e.g. 3+ SGMs Hit) — reported directly to you as a real content opportunity, no auto-handoff; (2) a strong upcoming odds edge — reported as information; (3) a traffic-up-conversions-flat mismatch (real PostHog + Stripe numbers) — reported as a business signal for you to weigh. Silent almost every run. |
| Monday | 7:00am | **Weekly email CONVERSION + design diagnosis.** The primary metric is real Stripe conversions per broadcast, not clicks. For every broadcast sent that week, pulls the real Stripe subscription-created timestamps and matches each new paying customer back to whichever broadcast they clicked shortly before converting (using Resend's real click data + timing, not assumed attribution). Ranks broadcasts by real conversions, not opens or clicks. Also reads subject lines, full HTML structure, and actual Hit/Miss results across every broadcast that week — Free vs Free, Premium vs Premium, never cross-compared — to find concrete content/timing patterns that correlate with conversions specifically (not just clicks). Only claims a pattern with 2+ real examples; checks it week over week via continuity. Feeds its findings to the daily send-recommendation job below. |
| Daily | 6:00pm | **Daily send recommendation.** Reads the weekly diagnosis's real conversion findings, checks tomorrow's actual fixtures and what's genuinely new, and gives ONE short recommendation: what angle to lead with, which segment, and the best-performing send-time window — ranked by real conversions where that data exists, falling back to clicks only when conversion data is too thin, and saying so explicitly. Always cites the real number behind the call. **Thursday always sends** (fixed rule: the round's first match always kicks off Thursday, so it's always "the round has started" news regardless of that match's overlay) — every other day, silent if there's nothing new. This is a recommendation for YOU to act on manually — no bot drafts or sends anything. |

## Resend, Stripe, and PostHog — what each actually tells us

Resend has real, direct email engagement data — open rate, click rate, and exactly which links got clicked per broadcast (confirmed: ~49% open rate, ~2.4% click rate across recent sends). **Important:** Resend's API returns timestamps in raw UTC — the diagnosis jobs are built to explicitly convert to AEST before reasoning about "what day"/"what time" something was sent (a real bug where a Wednesday 1pm AEST send was misreported as "Tuesday 3am" has been fixed).

Stripe is now the PRIMARY signal for the weekly diagnosis, not a secondary one — it has real subscription-created timestamps for every paying customer, which the weekly job cross-references against Resend's click timing to find which broadcasts actually converted, not just which got opened. A broadcast with fewer clicks but a same-day new subscriber matters more than one with more clicks and zero.

PostHog separately tracks real website traffic (people actually browsing rightedge.com.au) — useful background, not a conversion-attribution input on its own. Real 60-day data by day of week (AEST): Wednesday and Friday get the most traffic, Thursday is mid-pack — but Thursday still always gets a dedicated send regardless, since it's the round's kickoff day, not a traffic-optimization day.

A real spot-check done manually (2026-08-27) cross-referencing 5 historical Thursday Free sends against real Stripe conversion timestamps found: 9:30-10am and 3:30-4pm sends both reliably produced same-day conversions; a 4:43pm send produced zero. Small sample — the weekly job above will build this out properly over time instead of it being a one-off manual check.

## Where these live

Managed as Hermes scheduled jobs. To pause, adjust, or check on one directly, you can message the bot in your Discord DM (e.g. "pause Data Bot — Sunday Round Results") or ask me here.

## Job IDs (for reference — you shouldn't need these day to day)

| Job | ID |
|---|---|
| Data Bot — Tuesday Applied Confirmation + Snapshot | `e96339b5cbca` |
| Data Bot — Wednesday Follow-up | `31ada636225b` |
| Data Bot — Daily Plays (Thu/Fri/Sat/Sun) | `75457baa4da7` |
| Data Bot — Sunday Round Results | `8b55706c72e2` |
| Data Bot — Opportunity Scan (Mid-Week) | `62215eca9043` |
| Data Bot — Weekly Email Conversion + Design Diagnosis | `326098dba61f` |
| Data Bot — Daily Send Recommendation | `f26c2ad75bfc` |
