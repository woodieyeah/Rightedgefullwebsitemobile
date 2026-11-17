# RightEdge iOS: from prototype to commercial product

Written 2026-11-17, against `feature/capacitor-api-compat` @ `3189e3a4`.

Everything below is grounded in what is actually in this repo today. Where a
figure is Apple's published policy it is marked as such and should be
re-checked before you commit money to it — Apple changes these terms and I
cannot verify them from here.

## Where the prototype actually is

| Capability | State |
|---|---|
| Builds for iOS | Yes — Xcode 26.2 on GitHub Actions, no local Xcode, no Apple ID |
| Renders live data | Yes — published Sheets CSV + Supabase REST, verified 200s in-simulator |
| Free predictions reachable | Yes — no email gate natively |
| Safe areas | Yes — notch and home indicator handled |
| Premium content | Correctly withheld; opens the website externally |
| Native sign-in | **Does not exist** |
| Payments in-app | **Do not exist** |
| Push notifications | **Do not exist** |
| App Store presence | **None** — never submitted, no developer account |

The blocker for all four missing items is the same: the backend session lives
in an `HttpOnly; SameSite=Lax` cookie, and the edge function answers
`Access-Control-Allow-Origin: *` with no `Allow-Credentials`. A WKWebView on
`capacitor://localhost` can neither hold nor send that cookie.

---

## Phase 1 — Native Premium login

**The problem.** Entitlement is keyed to the session token, so nothing is
wrong with the authorisation model; the transport is what fails. Do not fix
this by relaxing CORS or switching to `SameSite=None` — that widens the
website's attack surface to solve an app problem, and it would undo part of
the identity-verification work.

**The design.** Issue a *separate*, scoped native credential:

- Short-lived **access token** (~15 min) in memory only, sent as a bearer
  header — never a cookie, so CORS/credentials never enter the picture.
- Long-lived **refresh token** in the iOS **Keychain** (`@capacitor/preferences`
  is NOT sufficient — it is UserDefaults, readable from a backup).
- Independently revocable, and **rejected on web routes**. A native token must
  never be accepted as a website session, or you have rebuilt the vulnerability
  class that was just closed.
- Issued **only** after the existing verified email-code flow, so
  `identityVerified` keeps its meaning.

**Work:** new `/api/native/token` + `/api/native/refresh` endpoints, a
`native_sessions` KV namespace separate from `kv_store_f8a832e3`, Keychain
plugin, token refresh on resume, and revocation plumbed into the existing
logout.

**Effort:** 3–5 days. **Risk:** high — it touches auth. Build it behind a flag,
test against a staging function, and never deploy it the same day as a release.

---

## Phase 2 — Apple subscriptions (the expensive one)

**This is the part that changes your economics, and it is not optional.**

Apple's App Store Review Guideline **3.1.1** requires in-app purchase for
digital content consumed in the app. A tips/analytics subscription is digital
content. You currently charge **$14/week via Stripe**. You cannot keep taking
that payment inside the app, and you cannot link out to your own checkout to
avoid the fee (Guideline 3.1.3's reader-app exception does not cover this, and
the US "link-out" entitlement is jurisdiction-specific — verify current terms
before relying on it).

### The subscriber numbers, corrected

An earlier draft of this document used "164 subscribers" and arithmetic that
was wrong twice over. Both errors are corrected here.

**164 is a row count, not a customer count.** Breaking down
`stripeSubscriptionStatus` across all 164 `subscriber:*` records:

| status | records |
|---|---|
| canceled | 126 |
| **active** | **24** |
| (none recorded) | 7 |
| trialing | 3 |
| incomplete_expired | 2 |
| past_due | 1 |
| paused | 1 |

Also: **96 records carry `cancelAtPeriodEnd`**, and only **26** have a current
period ending in the future.

So the realistic paying base is **24 active (+3 trialing)**, not 164 — roughly
a seventh of what the first draft assumed.

**Caveat on even these figures:** this is the app's own cached mirror of Stripe
state in `kv_store_f8a832e3`, not Stripe itself. A webhook that failed, or any
change made directly in the Stripe dashboard, would leave it stale. **Before
making any financial decision, pull the real count from the Stripe API**
(`GET /v1/subscriptions?status=active`) and reconcile.

### What that means for commission

Published Apple commission is **30%**, or **15%** under the Small Business
Program. The reduced rate is **not automatic** — it requires enrolling in the
programme, meeting Apple's eligibility criteria, and being approved; assume
30% until you hold an approval.

Illustrative only, on 24 active × $14/week = **$336/week gross**:

- at 30%: about **$101/week** commission
- at 15% (if approved): about **$50/week**

That is small enough that the commission is *not* the deciding factor. The real
costs of Phase 2 are engineering time and billing-correctness risk.

**Decisions you must make:**

1. **Price parity or markup?** Many apps raise the in-app price to absorb the
   fee. Apple permits different prices; it forbids *steering* users to the
   cheaper web price from inside the app.
2. **Migrating existing subscribers.** Your existing Stripe subscribers must
   not be double-charged. The usual answer: keep Stripe for existing web
   subscribers, use IAP only for new in-app purchases, and reconcile
   entitlement server-side so one account resolves to one entitlement
   regardless of payment rail.
3. **Is it worth launching paid at all yet?** With 24 active subscribers, a
   free-only v1 that proves retention on iPhone may be the better first
   release — it removes the single largest chunk of work and risk from the
   critical path to being in the store.

**Work:** StoreKit 2 via a Capacitor plugin, App Store Connect products,
**server-side receipt validation** (never trust the client), App Store Server
Notifications v2 for renewals/cancellations/refunds, and an entitlement
resolver that merges Stripe and Apple state.

**Effort:** 2–3 weeks. **Risk:** high — billing correctness, and a common
rejection cause.

---

## Phase 3 — Push notifications

Worth doing early. It is the clearest way to add genuine native capability,
which **helps** with Guideline 4.2 ("minimum functionality" — a pure webview
wrapper can be rejected as a repackaged website).

**It does not guarantee approval.** 4.2 is a reviewer judgement about whether
the app feels like an app. Push improves the odds; it is not a checkbox that
settles the question. Other things that help: offline caching of the last
round, Keychain-backed sign-in, a home-screen widget, and native share.

Genuinely useful here: team news, odds movement on a tracked fixture, a Core
Play published, settlement results.

**Work:** APNs key in the Apple Developer account, `@capacitor/push-notifications`,
a device-token table, a send service, and a preferences UI. Start with
**one** notification type done well.

**Effort:** 4–6 days. **Risk:** low-medium. Note you cannot test real APNs on a
simulator — this needs a physical device, which needs the paid developer
account.

---

## Phase 4 — App Store submission

**Blockers specific to RightEdge, in order of lead time:**

1. **Apple Developer Program — US$99/year.** Nothing ships without it. Also
   the only way to test push and real IAP.

2. **Individual vs organisation enrolment — determine this, do not assume it.**
   An earlier draft asserted organisation enrolment was mandatory. That was an
   assumption, not a finding, and it matters because organisation enrolment
   adds weeks (D-U-N-S number, typically 1–5 business days and free, then
   enrolment review).

   What is actually true of this codebase, verified:

   - RightEdge takes **no bets** and holds **no wagering licence**. It sells
     analytics and predictions.
   - It **does** carry a live bookmaker affiliate link:
     `record.betraffiliates.com.au/...` (`BETR_AFFILIATE_BASE_URL`,
     `src/app/App.tsx`), wrapped by a `BetrAffiliateLink` component, plus
     references to Sportsbet, PointsBet, Neds, Ladbrokes and BetRight.
   - The UI already carries Australian gambling-help messaging and an 18+
     notice.

   Guideline **5.1.1(ix)** applies to apps providing regulated services such as
   real-money gaming. A pure analytics app is a materially different case from
   an operator — but **monetised affiliate referrals to licensed bookmakers is
   the fact that could pull you into that bucket**, and it is a judgement call
   reviewers make, not something I can determine from here.

   **Action:** before paying for anything, ask Apple Developer Support directly,
   describing the app honestly (analytics + bookmaker affiliate links, no
   wagering). Their answer decides individual vs organisation, and it is free
   to ask. If the answer is organisation, start the D-U-N-S application that
   day, because it is pure waiting.

   **Option worth weighing:** removing the affiliate links from the iOS build
   only would simplify this classification considerably. It costs affiliate
   revenue on iOS; it may buy a much shorter path to approval. That is a
   commercial decision, not a technical one.

3. **Guideline 4.2 — minimum functionality.** Push plus genuine native
   behaviour (offline cache, Keychain sign-in, widgets) improves your position.
   It is not a guarantee — see Phase 3.

4. **Guideline 5.3.4 — gambling.** Written for real-money gaming, which you are
   not. Expect to justify the affiliate links, carry an 18+ rating, keep the
   gambling-help messaging, and expect a geo-restriction question.

5. **Age rating 18+**, privacy nutrition labels, and a public privacy policy.

**Effort:** 1 week of preparation, plus **2–6 weeks of calendar time** mostly
spent waiting on enrolment and review. Budget for at least one rejection.

---

## Suggested order

```
NOW      D-U-N-S + organisation enrolment   (pure waiting — start today)
Week 1   Apple Developer Program, $99
Week 1-2 Phase 1: native login
Week 2-3 Phase 3: push (unlocks the 4.2 defence, needs a real device)
Week 3-5 Phase 2: StoreKit + receipt validation + entitlement merge
Week 6   Submission prep, privacy labels, screenshots, review
```

Push before payments is deliberate: it is cheaper, lower-risk, and it is what
makes the app defensible as a native product. Payments are the longest and most
fragile piece and benefit from the auth work settling first.

## What I would not do

- **Do not relax the website's CORS or cookie policy to make native auth
  easier.** Separate native credentials, always.
- **Do not ship IAP and native auth in the same release.** If entitlement
  breaks you will not know which one did it.
- **Do not submit from an individual account** and hope 5.1.1(ix) is not
  enforced. It is.
- **Do not rewrite natively "to ship sooner."** The calendar above is dominated
  by Apple's enrolment and review, which is identical either way.

## Verify before acting

Apple's commission rates, the Small Business Program threshold, the reader/
link-out entitlements and the enrolment timelines all change. Every figure in
Phase 2 and Phase 4 should be re-read from Apple's current documentation before
you spend money against it.
