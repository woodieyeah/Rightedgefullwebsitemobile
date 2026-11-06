# Round-Live Winner Template — usage notes

This is the ACTUAL HTML structure of the best-performing "Round is live" email sent so far
(30 real unique clicks — confirmed the highest of any broadcast checked). The operator was
explicit: **do not redesign this email. Reuse this exact structure every Thursday, swapping
in that week's real numbers.**

## Placeholders — every one MUST be filled with a real, verified value. Never invent a number.

| Placeholder | Real source | Example |
|---|---|---|
| `{{SUBJECT_LINE}}` | Follows the weekly click-diagnosis pattern: state a number/fact that raises a question, never a fully-resolved result. See Data Bot — Weekly Email Design + Click Diagnosis (job `326098dba61f`) for the current best-performing pattern. | "Model finds a 7% market gap Saturday. Round 26 opens tonight." |
| `{{PREVIEW_TEXT}}` | One real sentence, consistent with subject, no result reveal. | "Round 26 is live. See where the model disagrees with the market before kickoff." |
| `{{ROUND_NUMBER}}` | Real round number from the Sheet / Match Predictions tab. | 26 |
| `{{HERO_LINE_1}}` / `{{HERO_LINE_2}}` | Two short, punchy lines. Never reveal a result here — this is the hero, it must stay in "here's what's live" territory. Real kickoff time from the Sheet. | "THE MODEL IS LIVE." / "KICKOFF 7:50PM TONIGHT." |
| `{{LAST_ROUND_RESULT_LINE}}` | The REAL settled Hit/Miss record from that round's results file (settleXxx() functions — sole source of truth, never guessed). | "Round 25: 3 of 4 Core Plays hit. Multis got there too." |
| `{{WHAT_IS_LIVE_NOW_LINE}}` | One real sentence describing what's actually live right now (not invented). | "Before kickoff, see the projected score, win, line and total probabilities — the model's already done the work." |
| `{{LAST_ROUND_SCORE}}` | Real fraction, e.g. Core Plays hit / total. Must match the results file exactly. | "3/4" |
| `{{LAST_ROUND_CAPTION}}` | One real sentence describing that fraction. | "Core Plays hit in Round 25." |
| `{{PERSUASION_HEADLINE}}` | Attitude + real stakes. Can vary slightly week to week but keep the "you're guessing, we're not" spine. | "YOU'RE BETTING BLIND. WE'RE NOT." |
| `{{PERSUASION_BODY}}` | Real numbers from last round + a real reason to check this round. Never generic marketing fluff — always cite the actual Hit rate. | "We ran the numbers — 3 of 4 Core Plays and multiple value try scorers hit last round. Round 26's plays are what's left when you take the guessing out." |

## Rules

1. **Never invent a number.** Every stat in this template must trace back to a real source: the Sheet, a results file, or Resend's own click data. If a real number isn't available yet (e.g. round hasn't settled), say so in the draft and flag it rather than filling in a guess.
2. **The hero and subject line must never reveal a completed result** — that's the #1 finding from the weekly click diagnosis job. Results go in the "LAST ROUND" block, not the hero or subject.
3. **This is the fixed skeleton.** Content updates weekly (new round number, new real stats, new real hook), but the block ORDER and DESIGN do not change without the operator's explicit request — this exact structure is what won.
4. Fill in **every** placeholder before treating a draft as done. Do not silently drop a section (this is precisely what the earlier "trash" version did — it kept the CTA and headline shape but dropped the stat comparison, feature table, and persuasion block that made the original perform).
