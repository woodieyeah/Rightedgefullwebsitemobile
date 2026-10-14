/**
 * Match-card play label and edge visibility.
 *
 * The matches card's PLAY box must name the actual selection and price, the
 * same way the try-scorer box names its players. Rendering the placeholder
 * "Premium match play" beside a populated try-scorer box tells a subscriber
 * nothing and looks broken.
 *
 * Edge is hidden on editorially published plays. Those picks are selected for
 * win probability rather than measurable edge — the published brief is
 * explicitly "plays that win" — and no book currently beats the exchange
 * anchor, so the figure is negative by construction. Printing "-2.5%" beside
 * a play we are recommending reads as a warning against our own selection.
 * Genuine positive-edge NRL plays still show it.
 */

export interface MatchCardPlaySource {
  selection: string;
  odds: number;
  type?: "Line" | "Total" | "Head 2 Head";
}

const PLACEHOLDER = "Premium match play";

/** Name the selection and its price for the matches card's PLAY box. */
export function buildMatchCardPlayLabel(play: MatchCardPlaySource | null): string {
  if (!play) return PLACEHOLDER;

  const selection = play.selection?.replace(/\bhead-to-head\b/i, "H2H").trim();
  if (!selection) return PLACEHOLDER;

  if (!Number.isFinite(play.odds) || play.odds <= 0) return selection;
  return `${selection} @ $${play.odds.toFixed(2)}`;
}

/**
 * Whether to render the Edge figure.
 *
 * Hidden for published picks, and hidden whenever the edge is not a positive
 * number — an absent or negative edge is not a selling point and must not be
 * shown as one.
 */
export function shouldShowEdge(play: {
  isManualApproved?: boolean;
  modelEdge?: number;
}): boolean {
  if (play.isManualApproved) return false;
  if (play.modelEdge === undefined || !Number.isFinite(play.modelEdge)) return false;
  return play.modelEdge > 0;
}
