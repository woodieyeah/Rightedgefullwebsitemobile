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

Published Apple commission: **30%**, or **15%** under the Small Business
Program (businesses under US$1M/year — you would qualify). At 164 subscribers
× $14/week that is roughly **$1,790/week gross**; a 15% cut is about
**$268/week**. Those are my arithmetic on your real subscriber count, not a
forecast.

**Decisions you must make:**

1. **Price parity or markup?** Many apps raise the in-app price to absorb the
   fee. Apple permits different prices; it forbids *steering* users to the
   cheaper web price from inside the app.
2. **Migrating existing subscribers.** Your 164 Stripe subscribers must not be
   double-charged. The usual answer: keep Stripe for existing web subscribers,
   use IAP only for new in-app purchases, and reconcile entitlement server-side
   so one account resolves to one entitlement regardless of payment rail.

**Work:** StoreKit 2 via a Capacitor plugin, App Store Connect products,
**server-side receipt validation** (never trust the client), App Store Server
Notifications v2 for renewals/cancellations/refunds, and an entitlement
resolver that merges Stripe and Apple state.

**Effort:** 2–3 weeks. **Risk:** high — billing correctness, and the most
common rejection cause after Guideline 4.2.

---

## Phase 3 — Push notifications

Worth doing early, because it is also your **Guideline 4.2 defence**: a pure
webview wrapper gets rejected as a "repackaged website", and push is the
conventional native capability that answers it.

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
2. **Organisation enrolment, not individual.** Guideline **5.1.1(ix)**:
   regulated content (gambling-adjacent) must be submitted by a legal entity.
   That needs a **D-U-N-S number** (typically 1–5 business days, free) and then
   organisation enrolment (often 1–2 weeks). **Start this first** — it is pure
   waiting.
3. **Guideline 4.2 — minimum functionality.** Push plus genuine native
   behaviour (offline cache, Keychain sign-in, widgets) is the answer.
4. **Guideline 5.3.4 — gambling.** You are an analytics/tipping product, not a
   real-money operator, which is a materially easier position. But affiliate
   links to bookmakers invite scrutiny: expect to justify them, carry the
   18+ rating, keep the gambling-help messaging already in the UI, and expect
   a geo-restriction question.
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
