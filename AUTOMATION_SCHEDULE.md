# RightEdge Automation Schedule

_Last updated: 2026-08-25. All times below are AEST (Sydney, UTC+10) — matched to what you'll actually see once you're back in Australia. Bots post to your Discord DM with RightEdgeAnalyst._

⚠️ **Daylight saving note:** these times are fixed against the underlying server clock (UTC+7) with a +3 hour offset baked in for AEST. Sydney moves to AEDT (UTC+11) in October when daylight saving starts — at that point everything below will land **1 hour later** than shown until I adjust it. I'll flag this again closer to the DST switchover so we can shift the schedule together.

## Data Bot

| Day | Time (AEST) | What it does |
|---|---|---|
| Tuesday | 6:00–8:50pm, every 10 min | **Live watch.** Messages you on every single check while the 6pm automation runs and retries — not just when something changes, so you always know it's actively working. Progress ("down to 1 of 8"), a repeat/heartbeat ping if nothing's moved, or a flag if the failure reason itself changes (e.g. a player issue became a team-name issue). |
| Tuesday | 7:00pm | **Confirms the round's data automation.** If applied, posts a full Match Predictions snapshot (scores, implied odds, Pinnacle odds, best odds) for all 8 matches. If still pending your approval, tells you to click "Approve Tuesday Preview" in the Sheet. If still waiting on a data source (e.g. Stats Insider), says so plainly. |
| Wednesday | 7:00am | Follow-up check — confirms what happened overnight if Tuesday night's run was still retrying, and states which round is now live. |
| Tuesday | 7:30pm | Marketing Bot drafts the "Round is live" free-tier email — see below. |
| Thursday | 7:00am | Reports today's live fixtures only (matches actually kicking off today), with predicted scores and the odds currently in the Sheet. Never re-syncs odds itself. |
| Friday | 7:00am | Same as Thursday, for Friday's fixtures. |
| Saturday | 7:00am | Same as Thursday, for Saturday's fixtures. |
| Sunday | 7:00am | Same as Thursday, for Sunday's fixtures. |
| Sunday | 5:00pm | **Full round results**, once every game is finished — final scores, Core Plays Hit/Miss, Same Game Multis Hit/Miss. Only reports if the round's verified results file has actually been built; says plainly if it hasn't (never guesses a result). |
| Thu/Fri/Sat | 8:00am | **Opportunity scan.** Three checks, treated differently: (1) standout round momentum (e.g. 3+ SGMs Hit) — a real content trigger, hands off to Marketing Bot; (2) a strong upcoming odds edge — reported as information, not an automatic content instruction; (3) a traffic-up-conversions-flat mismatch (real PostHog + Stripe numbers) — reported as a business signal for you to weigh, not a copy prompt. Silent almost every run. |
| Monday | 7:00am | **Weekly email design + click diagnosis.** Reads real subject lines, full HTML structure, and actual Hit/Miss results (from the real round results files) across every broadcast sent that week — Free vs Free, Premium vs Premium, never cross-compared. Finds concrete patterns (e.g. "withheld-result subjects outperform revealed-result ones"), only claims one with 2+ real examples, checks its own pattern week over week via continuity. Feeds its findings to the daily send-recommendation job below. Never drafts content. |
| Daily | 6:00pm | **Daily send recommendation.** Reads the weekly diagnosis's real findings, checks tomorrow's actual fixtures and what's genuinely new, and gives ONE short recommendation: what angle to lead with, which segment, and the best-performing send-time window — always citing the real number behind the call. **Thursday always sends** (fixed rule: the round's first match always kicks off Thursday, so it's always "the round has started" news regardless of that match's overlay) — every other day, silent if there's nothing new. This is a recommendation only — Marketing Bot still drafts and asks for approval separately. |

## Marketing Bot

Marketing Bot no longer freelances a design each week. It reuses a FIXED, PROVEN template — `email-templates/round-live-winner-template.html` — the actual HTML of the real broadcast that got 30 real unique clicks, the best-performing send confirmed so far. It fills in that week's real numbers (round number, kickoff time, last round's real settled Hit/Miss record, this round's real strongest overlay) without changing the layout, block order, or design. See `email-templates/README.md` for what each placeholder needs and where its real value comes from.

| Day | Time (AEST) | What it does |
|---|---|---|
| Thursday | 4:00pm | Drafts the "Round is live" email using the fixed template above, reading real numbers from the Sheet + results files, and using the week's real content hook + best send-time window already computed by Data Bot's diagnosis/recommendation jobs (chained via context). Posts the filled HTML + a plain summary of what changed, ends with an explicit yes/no. Never sends. |
| Sunday | 5:30pm | Same real-narrative approach for the Premium results recap — the real story of the round (a clean sweep, a big-priced SGM landing, a narrow Miss that still proved the read). Same real-Resend-data send-time, same draft-only rule. |
| As triggered | When Data Bot flags standout round momentum | Proposes a sharp email or Instagram-post angle in Discord — not a template. Email ideas get drafted properly; Instagram ideas are described only (you write/post those yourself). |

## What "draft-only" means

Neither bot can create, schedule, or send anything in Resend. Every email path ends the same way: a draft + a plain-English summary + an explicit yes/no request in Discord. Nothing goes out without you saying so.

## Resend and PostHog — what each actually tells us

Resend has real, direct email engagement data — open rate, click rate, and exactly which links got clicked per broadcast (confirmed: ~49% open rate, ~2.4% click rate across recent sends). That's the primary signal for the weekly click diagnosis above. **Important:** Resend's API returns timestamps in raw UTC — both diagnosis jobs are built to explicitly convert to AEST before reasoning about "what day"/"what time" something was sent (a real bug where a Wednesday 1pm AEST send was misreported as "Tuesday 3am" has been fixed). PostHog separately tracks real website traffic (people actually browsing rightedge.com.au) — useful background, not a click-diagnosis input. Real 60-day data by day of week (AEST): Wednesday and Friday get the most traffic, Thursday is mid-pack — but Thursday still always gets a dedicated send regardless, since it's the round's kickoff day, not a traffic-optimization day.

## Where these live

Managed as Hermes scheduled jobs. To pause, adjust, or check on one directly, you can message the bot in your Discord DM (e.g. "pause Data Bot — Sunday Round Results") or ask me here.

## Job IDs (for reference — you shouldn't need these day to day)

| Job | ID |
|---|---|
| Data Bot — Tuesday Applied Confirmation + Snapshot | `e96339b5cbca` |
| Data Bot — Wednesday Follow-up | `31ada636225b` |
| Data Bot — Daily Plays (Thu/Fri/Sat/Sun) | `75457baa4da7` |
| Data Bot — Sunday Round Results | `8b55706c72e2` |
| Marketing Bot — Thursday Round-Live Email Draft | `a1126ab1194a` |
| Marketing Bot — Premium Results Email Draft | `282d9fe98474` |
| Data Bot — Opportunity Scan (Mid-Week) | `62215eca9043` |
| Data Bot — Weekly Email Click Diagnosis | `326098dba61f` |
| Data Bot — Daily Send Recommendation | `f26c2ad75bfc` |
