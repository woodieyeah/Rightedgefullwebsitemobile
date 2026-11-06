import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRoundResults,
  gradeMatchResult,
  normaliseTeamName,
  resolveTryScorers,
} from '../src/app/round-results-builder.ts';

const NEEDS_CHECK = 'Needs Check';

function championDataMatch(overrides = {}) {
  return {
    matchId: 129992601,
    roundNumber: 26,
    matchStatus: 'complete',
    homeSquadId: 100,
    awaySquadId: 200,
    homeSquadName: 'Brisbane Broncos',
    awaySquadName: 'Melbourne Storm',
    localStartTime: '2026-08-27T19:50:00+10:00',
    venueName: 'Suncorp Stadium',
    ...overrides,
  };
}

function championDataPayload(overrides = {}) {
  return {
    matchStats: {
      matchInfo: {
        matchId: 129992601,
        matchStatus: 'complete',
        venueName: 'Suncorp Stadium',
        localStartTime: '2026-08-27T19:50:00+10:00',
        ...overrides.matchInfo,
      },
      teamStats: {
        team: overrides.team ?? [
          { squadId: 100, score: 24 },
          { squadId: 200, score: 18 },
        ],
      },
      playerInfo: {
        player: overrides.playerInfo ?? [
          { playerId: 1, firstname: 'Selwyn', surname: 'Cobbo' },
          { playerId: 2, firstname: 'Reece', surname: 'Walsh' },
        ],
      },
      playerStats: {
        player: overrides.playerStats ?? [
          { playerId: 1, squadId: 100, tries: 2 },
          { playerId: 2, squadId: 100, tries: 0 },
        ],
      },
    },
  };
}

function espnEvent(overrides = {}) {
  return {
    id: '603450',
    competitions: [
      {
        competitors: [
          { team: { displayName: 'Brisbane Broncos' }, score: overrides.homeScore ?? '24' },
          { team: { displayName: 'Melbourne Storm' }, score: overrides.awayScore ?? '18' },
        ],
      },
    ],
  };
}

test('maps official club names onto the short names the site uses', () => {
  assert.equal(normaliseTeamName('Brisbane Broncos'), 'Broncos');
  assert.equal(normaliseTeamName('Manly-Warringah Sea Eagles'), 'Sea Eagles');
  assert.equal(normaliseTeamName('St George-Illawarra Dragons'), 'Dragons');
  // The site labels this club "Tigers" in round25-results.ts, so generated
  // files must use the identical label or the two would not line up.
  assert.equal(normaliseTeamName('Wests Tigers'), 'Tigers');
  assert.equal(normaliseTeamName('Tigers'), 'Tigers');
  assert.equal(normaliseTeamName('Dolphins'), 'Dolphins');
});

test('accepts the short club names the independent source already uses', () => {
  // ESPN publishes "Storm"/"Panthers" rather than the full club names.
  assert.equal(normaliseTeamName('Storm'), 'Storm');
  assert.equal(normaliseTeamName('Panthers'), 'Panthers');
  assert.equal(normaliseTeamName('Sea Eagles'), 'Sea Eagles');
  assert.equal(normaliseTeamName('Dragons'), 'Dragons');
  assert.equal(normaliseTeamName('Rabbitohs'), 'Rabbitohs');

  // Both spellings must land on the identical short name, or the two sources
  // could never be compared.
  assert.equal(normaliseTeamName('Melbourne Storm'), normaliseTeamName('Storm'));
  assert.equal(
    normaliseTeamName('St George-Illawarra Dragons'),
    normaliseTeamName('Dragons'),
  );
});

test('refuses to invent a short name for an unknown club', () => {
  assert.throws(() => normaliseTeamName('North Sydney Bears'), /Needs Check/);
  assert.throws(() => normaliseTeamName(''), /Needs Check/);
});

test('grades a match only when both independent sources agree', () => {
  const graded = gradeMatchResult(championDataMatch(), championDataPayload(), espnEvent());

  assert.equal(graded.finalHome, 24);
  assert.equal(graded.finalAway, 18);
  assert.equal(graded.sourcesAgree, true);
  assert.equal(graded.espnEventId, 603450);
  assert.equal(graded.homeTeam, 'Broncos');
  assert.equal(graded.awayTeam, 'Storm');
});

test('fails closed when the two sources disagree on the score', () => {
  assert.throws(
    () => gradeMatchResult(championDataMatch(), championDataPayload(), espnEvent({ homeScore: '25' })),
    /Needs Check/,
  );
});

test('fails closed when the independent source is missing entirely', () => {
  assert.throws(
    () => gradeMatchResult(championDataMatch(), championDataPayload(), null),
    /Needs Check/,
  );
});

test('fails closed when a match is not actually complete', () => {
  assert.throws(
    () => gradeMatchResult(
      championDataMatch({ matchStatus: 'scheduled' }),
      championDataPayload({ matchInfo: { matchStatus: 'scheduled' } }),
      espnEvent(),
    ),
    /Needs Check/,
  );
});

test('fails closed when a score is missing rather than treating it as nil', () => {
  assert.throws(
    () => gradeMatchResult(
      championDataMatch(),
      championDataPayload({ team: [{ squadId: 100, score: null }, { squadId: 200, score: 18 }] }),
      espnEvent(),
    ),
    /Needs Check/,
  );
});

test('records real try counts including a verified zero', () => {
  const scorers = resolveTryScorers(championDataMatch(), championDataPayload());

  assert.equal(scorers['Selwyn Cobbo'], 2);
  assert.equal(scorers['Reece Walsh'], 0, 'a player who played and did not score is a verified 0');
});

test('fails closed when player stats reference an unknown player', () => {
  assert.throws(
    () => resolveTryScorers(
      championDataMatch(),
      championDataPayload({ playerStats: [{ playerId: 999, squadId: 100, tries: 1 }] }),
    ),
    /Needs Check/,
  );
});

test('builds a complete round only when every match is verified', () => {
  const built = buildRoundResults({
    round: 26,
    matches: [championDataMatch()],
    payloads: { 129992601: championDataPayload() },
    espnEvents: [espnEvent()],
  });

  assert.equal(built.round, 26);
  assert.equal(built.results.length, 1);
  assert.equal(built.results[0].match, 'Broncos v Storm');
});

test('refuses to emit a partial round', () => {
  assert.throws(
    () => buildRoundResults({
      round: 26,
      matches: [championDataMatch(), championDataMatch({ matchId: 129992602 })],
      payloads: { 129992601: championDataPayload() },
      espnEvents: [espnEvent()],
    }),
    /Needs Check/,
  );
});

test('generated TypeScript is valid and carries provenance', () => {
  const built = buildRoundResults({
    round: 26,
    matches: [championDataMatch()],
    payloads: { 129992601: championDataPayload() },
    espnEvents: [espnEvent()],
  });

  assert.match(built.source, /ROUND_26_VERIFIED_RESULTS/);
  assert.match(built.source, /championDataMatchId: 129992601/);
  assert.match(built.source, /espnEventId: 603450/);
  assert.match(built.source, /sourcesAgree: true/);
  // Provenance comment so a reviewer can see where the numbers came from.
  assert.match(built.source, /Champion Data/);
  assert.match(built.source, /ESPN/);
});
