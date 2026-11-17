/**
 * Whether a round is genuinely live, and what to call it when it is not.
 *
 * "Live" is a claim about the present. The dashboard used to render
 * `${liveLabel} Live` with a green dot unconditionally, so during the NRL
 * off-season it announced "Round 31 Live" for a round whose only fixture --
 * Roosters v Knights -- was played on 4 October 2026 and settled. Presenting a
 * settled match as a current opportunity is the thing we must never do.
 *
 * The liveness test is the count of fixtures that have not kicked off, which is
 * the same predicate that governs the featured card. This module is pure so the
 * rule is testable without rendering anything.
 */

export type RoundStatusInput = {
  /** e.g. "Round 31" -- the round's own name, with no status wording. */
  label: string;
  /** Fixtures in this round that have NOT kicked off. */
  upcomingCount: number;
  /** True when the user is browsing a historical round rather than the current one. */
  archiveSelected?: boolean;
};

export type RoundStatus = {
  isLive: boolean;
  /** The label to render, including any status wording. */
  label: string;
  showLiveDot: boolean;
  /** Shown when there is nothing to display, so the screen is never silently blank. */
  emptyMessage: string;
  /** Historical rounds stay reachable even when the season is over. */
  allowArchiveBrowsing: boolean;
};

export function describeRoundStatus({
  label,
  upcomingCount,
  archiveSelected = false,
}: RoundStatusInput): RoundStatus {
  // Fail closed: anything that is not a genuine positive integer count is
  // treated as "not live" rather than optimistically claiming live.
  const count =
    typeof upcomingCount === "number" && Number.isFinite(upcomingCount) && upcomingCount > 0
      ? upcomingCount
      : 0;

  // An archived round is historical by definition, whatever its fixtures say.
  const isLive = !archiveSelected && count > 0;

  return {
    isLive,
    label: isLive ? `${label} Live` : `${label} Complete`,
    showLiveDot: isLive,
    emptyMessage: isLive
      ? ""
      : "No upcoming matches. The season is complete — browse previous rounds for results.",
    // Never gate history behind liveness.
    allowArchiveBrowsing: true,
  };
}

/**
 * Nav targets that require a paid subscription.
 *
 * "best-bets" is the Plays tab in the bottom nav AND a premium hash in
 * checkHash(), which is why a native tap on it used to launch the system
 * browser on contact.
 */
const PREMIUM_NAV_TARGETS = new Set(["best-bets"]);

export function isPremiumNavTarget(pageId: string): boolean {
  return PREMIUM_NAV_TARGETS.has(pageId);
}

export type NavBehaviour = {
  /** navigate = open in-app; paywall = existing web gate; show-premium-notice = native explainer. */
  action: "navigate" | "paywall" | "show-premium-notice";
  /** Whether the system browser opens as a direct result of this tap. */
  opensBrowserImmediately: boolean;
  /** Whether paid content is rendered. Must be false in the native shell. */
  rendersPremiumContent: boolean;
};

/**
 * What a bottom-nav tap should do.
 *
 * In the native shell a premium tab must not render premium content (there is
 * no verified session there, so any premium claim is client-side only and
 * untrustworthy), and must not fling the user into the browser merely for
 * tapping a tab. It shows an in-app explanation with one deliberate button.
 */
export function nativeNavBehaviour(
  pageId: string,
  { isNative, isPremium }: { isNative: boolean; isPremium: boolean },
): NavBehaviour {
  if (!isPremiumNavTarget(pageId)) {
    return { action: "navigate", opensBrowserImmediately: false, rendersPremiumContent: false };
  }
  if (isNative) {
    return {
      action: "show-premium-notice",
      opensBrowserImmediately: false,
      // Hard false regardless of isPremium: entitlement cannot be established
      // in the shell, so it is never honoured there.
      rendersPremiumContent: false,
    };
  }
  return isPremium
    ? { action: "navigate", opensBrowserImmediately: false, rendersPremiumContent: true }
    : { action: "paywall", opensBrowserImmediately: false, rendersPremiumContent: false };
}
