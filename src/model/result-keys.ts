/**
 * Round-aware keys for mapping feed results onto fixtures.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * The settler matched a pick to a feed result using the fixture's team names
 * alone: `${home}__${away}`. The grand final is Australia v New Zealand, the
 * same pairing as the Round 1 opener, so both fixtures collapse to one key.
 *
 * Settling round 5 is safe by luck — Round 1's picks are already settled and
 * skipped. But running `--round 1` again after the final is published would
 * grade the FINAL's pending picks against the OPENER's 2026-10-15 scoreline
 * and write the result. Two fixtures must never share a key.
 */

export function resultKey(home: string, away: string, round: number): string {
  if (!Number.isFinite(round)) {
    throw new Error("a result key needs a round number; without it a repeated pairing collides");
  }
  const norm = (team: string) =>
    String(team ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");

  const h = norm(home);
  const a = norm(away);
  if (!h || !a) throw new Error("a result key needs both team names");

  return `r${round}__${h}__${a}`;
}
