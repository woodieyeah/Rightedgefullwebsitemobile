/**
 * Whether a multi's try-scorer leg may sit on the opposition.
 *
 * Same-team is the normal case and passes silently. Cross-team is a real bet
 * — "New Zealand +8.5 + Reece Walsh" wants New Zealand within 8.5 while an
 * Australian scores, which can happen together — but it is also what a
 * mistake looks like, so it requires an explicit opt-in rather than being
 * accepted by default.
 *
 * A scorer the book lists under no team is always refused: nothing about them
 * can be verified, and a leg whose side is unknown cannot be checked against
 * the core play.
 */

export interface ScorerTeamCheck {
  scorer: string;
  scorerTeam: string;
  anchorTeam: string;
  allowCrossTeam?: boolean;
}

export interface ScorerTeamResult {
  allowed: boolean;
  crossTeam: boolean;
  reason?: string;
}

const norm = (value: string) =>
  String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

export function checkScorerTeam({
  scorer,
  scorerTeam,
  anchorTeam,
  allowCrossTeam = false,
}: ScorerTeamCheck): ScorerTeamResult {
  const team = norm(scorerTeam);
  if (!team) {
    return {
      allowed: false,
      crossTeam: false,
      reason: `${scorer} has no team listed by the book, so the leg cannot be verified`,
    };
  }

  const crossTeam = team !== norm(anchorTeam);
  if (!crossTeam) return { allowed: true, crossTeam: false };

  if (!allowCrossTeam) {
    return {
      allowed: false,
      crossTeam: true,
      reason:
        `${scorer} plays for ${scorerTeam}, the opposition to the ${anchorTeam} line leg. ` +
        `Pass --allow-cross-team if that is intended.`,
    };
  }

  return { allowed: true, crossTeam: true };
}
