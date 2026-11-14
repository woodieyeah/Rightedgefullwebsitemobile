/**
 * Which fixtures the prediction worker may predict.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * Settlement never changes `fixtures.status`, so every row stays
 * "scheduled" forever and the worker reconsiders the whole table on each run.
 * That was invisible while TAB dropped each finished match's market — a
 * played fixture simply reported "no TAB market".
 *
 * The grand final broke it: the final repeats the Round 1 pairing (Australia
 * v New Zealand), so the long-settled opener matched the FINAL's live market,
 * the worker built a prediction row for it, and the insert violated the
 * (fixture_id, model_version) unique constraint. The whole batch was rejected
 * and the final itself got no projection.
 *
 * Kickoff time is the honest test — it comes from the draw feed and does not
 * depend on anything remembering to update a status column.
 */

export interface PredictionCandidate {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status?: string | null;
}

export function selectPredictionCandidates<T extends PredictionCandidate>(
  fixtures: T[],
  now: Date = new Date(),
): T[] {
  const cutoff = now.getTime();

  return fixtures
    .filter((fixture) => {
      // A fixture the feed already calls final is never a candidate.
      if (fixture.status === "final") return false;

      const kickoff = new Date(fixture.kickoff_at).getTime();
      // An unparseable kickoff cannot be shown to be in the future, so it is
      // excluded rather than predicted on an assumption.
      if (!Number.isFinite(kickoff)) return false;

      return kickoff > cutoff;
    })
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
}
