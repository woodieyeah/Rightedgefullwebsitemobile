import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const AUTOMATION_FILE = new URL('../google-sheets/rightedge-tuesday-automation.gs', import.meta.url);

function loadAutomation(): Record<string, unknown> {
  const context = vm.createContext({ console });
  vm.runInContext(readFileSync(AUTOMATION_FILE, 'utf8'), context);
  return context as Record<string, unknown>;
}

const TEAM_NAMES = [
  'Brisbane',
  'Canberra',
  'Canterbury',
  'Cronulla',
  'Dolphins',
  'Gold Coast',
  'Manly',
  'Melbourne',
  'Newcastle',
  'North Qld',
  'Parramatta',
  'Penrith',
  'St Geo Illa',
  'Souths',
  'Sydney',
  'Warriors',
  'Wests Tigers',
];

const NRL_TEAM_NAMES = [
  'Brisbane Broncos',
  'Canberra Raiders',
  'Canterbury-Bankstown Bulldogs',
  'Cronulla-Sutherland Sharks',
  'Dolphins',
  'Gold Coast Titans',
  'Manly Warringah Sea Eagles',
  'Melbourne Storm',
  'Newcastle Knights',
  'North Queensland Cowboys',
  'Parramatta Eels',
  'Penrith Panthers',
  'St. George Illawarra Dragons',
  'South Sydney Rabbitohs',
  'Sydney Roosters',
  'Warriors',
  'Wests Tigers',
];

function ladderHtml(): string {
  const rows = TEAM_NAMES.map((team, index) => {
    const cells = [
      `${index + 1}.`, team,
      '11', '8', '3', '-', '300', '200', '100',
      '11', '7', '4', '-', '290', '210', '80',
      '22', '15', '7', '-', '3', '590', '410', '36', '+180', '26.82', '18.64',
    ];
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  }).join('');
  return `<html><body><table>${rows}</table></body></html>`;
}

const CANONICAL_RANGE_SPECS = [
  { key: 'season', sheet: '2026 Data Sheet', startRow: 4, width: 27 },
  { key: 'advanced', sheet: '2026 Advanced Data Sheet', startRow: 2, width: 6 },
  { key: 'fixtures', sheet: 'Match Predictions', startRow: 2, width: 2 },
  { key: 'scorers', sheet: 'Player Prop - Anytime Try Scorer', startRow: 2, width: 6 },
];

function canonicalRanges() {
  return CANONICAL_RANGE_SPECS.map((spec) => ({
    key: spec.key,
    sheet: spec.sheet,
    startRow: spec.startRow,
    startColumn: 1,
    before: [Array(spec.width).fill('')],
    after: [Array(spec.width).fill(spec.key)],
  }));
}

function canonicalPlan(automation: { computeRightEdgePlanId_: (ranges: unknown) => string }) {
  const ranges = canonicalRanges();
  return { id: automation.computeRightEdgePlanId_(ranges), ranges };
}

test('parses the complete Rugby League Project ladder into the 27-column Sheet shape', () => {
  const automation = loadAutomation() as {
    parseRightEdgeRlpLadder_: (html: string) => Array<Array<string | number>>;
  };

  const rows = automation.parseRightEdgeRlpLadder_(ladderHtml());

  assert.equal(rows.length, 17);
  assert.ok(rows.every((row) => row.length === 27));
  assert.deepEqual(Array.from(rows, (row) => String(row[1])), TEAM_NAMES);
  assert.equal(rows[0][0], 1);
  assert.equal(rows[0][25], 26.82);
});

test('parses a complete official NRL team-average payload by canonical team name', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlMetric_: (payload: unknown, title: string) => Record<string, number>;
  };
  const payload = {
    averageStats: {
      title: 'Post Contact Metres',
      leaders: NRL_TEAM_NAMES.map((teamName, index) => ({
        teamName,
        played: 22,
        value: String(500 + index / 10),
      })),
    },
  };

  const values = automation.parseRightEdgeNrlMetric_(payload, 'Post Contact Metres');

  assert.deepEqual(Object.keys(values).sort(), TEAM_NAMES.slice().sort());
  assert.equal(values.Brisbane, 500);
  assert.equal(values['Wests Tigers'], 501.6);
});

test('extracts the official NRL metric payload from an HTML q-data attribute', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlPagePayload_: (html: string) => Record<string, unknown>;
  };
  const payload = {
    averageStats: {
      title: 'Linebreaks',
      leaders: [{ teamName: 'Brisbane Broncos', played: 22, value: '5.4' }],
    },
  };
  const encoded = JSON.stringify(payload).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

  const parsed = automation.parseRightEdgeNrlPagePayload_(`<div q-data="${encoded}"></div>`);

  assert.equal((parsed.averageStats as { title: string }).title, 'Linebreaks');
});

test('selects the NRL stats q-data when unrelated q-data appears first', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlPagePayload_: (html: string) => Record<string, unknown>;
  };
  const statsPayload = JSON.stringify({
    averageStats: { title: 'Linebreaks', leaders: [] },
  }).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const html = [
    '<div q-data="{&quot;navigation&quot;:true}"></div>',
    `<section q-data="${statsPayload}"></section>`,
  ].join('');

  const parsed = automation.parseRightEdgeNrlPagePayload_(html);

  assert.equal((parsed.averageStats as { title: string }).title, 'Linebreaks');
});

test('falls back to an official NRL club stats page when the JSON route is blocked', () => {
  const automation = loadAutomation() as {
    fetchRightEdgeNrlMetric_: (
      season: number,
      spec: { id: number; title: string },
      fetchJson: (url: string) => Record<string, unknown>,
      fetchText: (url: string) => string,
    ) => Record<string, unknown>;
  };
  const payload = {
    averageStats: {
      title: 'Linebreaks',
      leaders: NRL_TEAM_NAMES.map((teamName, index) => ({ teamName, played: 22, value: String(index + 1) })),
    },
  };
  const encoded = JSON.stringify(payload).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const calls: string[] = [];

  const signInHtml = '<html><head><title>Submit This Form</title></head><body>'
    + '<form action="https://www.nrl.com/account/signin-nrl"></form></body></html>';

  const result = automation.fetchRightEdgeNrlMetric_(
    2026,
    { id: 30, title: 'Linebreaks' },
    (url) => { calls.push(url); return signInHtml; },
    (url) => { calls.push(url); return `<div q-data="${encoded}"></div>`; },
  );

  assert.equal((result.averageStats as { title: string }).title, 'Linebreaks');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /nrl\.com\/stats\/teams\/data\?competition=/);
  assert.match(calls[1], /rabbitohs\.com\.au\/stats\/teams/);
});

test('aggregates Champion Data ruck infringements only from a complete match set', () => {
  const automation = loadAutomation() as {
    aggregateRightEdgeRuckAverages_: (
      fixtures: Array<Record<string, unknown>>,
      payloads: Record<string, unknown>,
    ) => Record<string, number>;
  };
  const fixtures = NRL_TEAM_NAMES.map((homeTeam, index) => ({
    matchId: 1000 + index,
    matchStatus: 'complete',
    homeSquadId: 5000 + index,
    homeSquadName: homeTeam,
    awaySquadId: 5000 + ((index + 1) % NRL_TEAM_NAMES.length),
    awaySquadName: NRL_TEAM_NAMES[(index + 1) % NRL_TEAM_NAMES.length],
  }));
  const payloads = Object.fromEntries(fixtures.map((fixture, index) => [
    String(fixture.matchId),
    {
      matchStats: {
        matchInfo: { matchId: fixture.matchId, matchStatus: 'complete' },
        teamStats: {
          team: [
            { squadId: 5000 + index, setRestartsRuck: 2 },
            { squadId: 5000 + ((index + 1) % NRL_TEAM_NAMES.length), setRestartsRuck: 4 },
          ],
        },
      },
    },
  ]));

  const values = automation.aggregateRightEdgeRuckAverages_(fixtures, payloads);

  assert.deepEqual(Object.keys(values).sort(), TEAM_NAMES.slice().sort());
  assert.ok(Object.values(values).every((value) => value === 3));
});

test('parses exactly 17 verified Stats Insider scorer probabilities for each team', () => {
  const automation = loadAutomation() as {
    parseRightEdgeStatsInsiderMatch_: (
      payload: unknown,
      matchId: string,
      positions: Record<string, string>,
    ) => { fixture: string[]; scorerRows: Array<Array<string | number>> };
  };
  const home = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Home',
    last_name: `Player ${index + 1}`,
    unique_name: `H. Player ${index + 1}`,
    anytimeTry: (index + 1) / 100,
  }));
  const away = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Away',
    last_name: `Player ${index + 1}`,
    unique_name: `A. Player ${index + 1}`,
    anytimeTry: (index + 1) / 100,
  }));
  const positions = Object.fromEntries([
    ...home.map((player) => [`Brisbane|${player.first_name} ${player.last_name}`.toLowerCase(), 'Wing']),
    ...away.map((player) => [`Melbourne|${player.first_name} ${player.last_name}`.toLowerCase(), 'Centre']),
  ]);
  const payload = {
    MatchData: {
      SIMatchID: 'NRL_2026_26_BRI_MEL',
      Season: 2026,
      RoundNumber: 26,
      HomeTeam: { Market: 'Brisbane', DisplayName: 'Broncos' },
      AwayTeam: { Market: 'Melbourne', DisplayName: 'Storm' },
    },
    PreData: { playerPropsData: { home, away } },
  };

  const parsed = automation.parseRightEdgeStatsInsiderMatch_(
    payload,
    'NRL_2026_26_BRI_MEL',
    positions,
  );

  assert.deepEqual(Array.from(parsed.fixture), ['Brisbane', 'Melbourne']);
  assert.equal(parsed.scorerRows.length, 34);
  assert.deepEqual(Array.from(parsed.scorerRows[0]), [
    26, 'Brisbane v Melbourne', 'Home Player 1', 'Brisbane', 'Wing', 0.01,
  ]);
  assert.deepEqual(Array.from(parsed.scorerRows[33]), [
    26, 'Brisbane v Melbourne', 'Away Player 17', 'Melbourne', 'Centre', 0.17,
  ]);
});

test('discovers exactly eight unique Stats Insider matches for the requested round', () => {
  const automation = loadAutomation() as {
    parseRightEdgeStatsInsiderSchedule_: (
      html: string,
      season: number,
      round: number,
      expectedMatches: number,
    ) => string[];
  };
  const matchIds = [
    'NRL_2026_26_BRI_MEL',
    'NRL_2026_26_MAN_SGI',
    'NRL_2026_26_WAR_NEW',
    'NRL_2026_26_PEN_CBY',
    'NRL_2026_26_SYD_DOL',
    'NRL_2026_26_NQL_WST',
    'NRL_2026_26_PAR_CRO',
    'NRL_2026_26_GLD_SOU',
  ];
  const html = matchIds.map((matchId) => {
    const slug = matchId.toLowerCase().replace('nrl_', '');
    return `<a href="/sport-hub/nrl/schedule/${slug}">Match</a>`;
  }).join('');

  const parsed = automation.parseRightEdgeStatsInsiderSchedule_(html, 2026, 26, 8);

  assert.deepEqual(Array.from(parsed), matchIds);
});

test('uses the authoritative round fixture count instead of assuming eight matches', () => {
  const automation = loadAutomation() as {
    parseRightEdgeStatsInsiderSchedule_: (
      html: string,
      season: number,
      round: number,
      expectedMatches: number,
    ) => string[];
  };
  const links = ['BRI_MEL', 'MAN_SGI', 'WAR_NEW', 'PEN_CBY', 'SYD_DOL', 'NQL_WST', 'PAR_CRO']
    .map((teams) => `<a href="/sport-hub/nrl/schedule/2026_27_${teams.toLowerCase()}">Match</a>`)
    .join('');

  const parsed = automation.parseRightEdgeStatsInsiderSchedule_(links, 2026, 27, 7);

  assert.equal(parsed.length, 7);
});

test('builds advanced data rows in the existing Sheet team order with all five metrics', () => {
  const automation = loadAutomation() as {
    buildRightEdgeAdvancedRows_: (
      teams: string[],
      metrics: Record<string, Record<string, number>>,
    ) => Array<Array<string | number>>;
  };
  const teamOrder = TEAM_NAMES.slice().reverse();
  const metric = (offset: number) => Object.fromEntries(
    TEAM_NAMES.map((team, index) => [team, offset + index]),
  );

  const rows = automation.buildRightEdgeAdvancedRows_(teamOrder, {
    postContactMetres: metric(500),
    lineBreaks: metric(5),
    tackleBreaks: metric(30),
    missedTackles: metric(25),
    ruckInfringements: metric(3),
  });

  assert.equal(rows.length, 17);
  assert.deepEqual(Array.from(rows[0]), ['Wests Tigers', 516, 21, 46, 41, 19]);
  assert.deepEqual(Array.from(rows[16]), ['Brisbane', 500, 5, 30, 25, 3]);
});

test('lists every proposed changed cell with its exact before and after value', () => {
  const automation = loadAutomation() as {
    buildRightEdgeDiffRows_: (
      sheet: string,
      row: number,
      column: number,
      before: unknown[][],
      after: unknown[][],
    ) => unknown[][];
  };

  const changes = automation.buildRightEdgeDiffRows_(
    '2026 Data Sheet',
    4,
    1,
    [[1, 'Brisbane'], [2, 'Canberra']],
    [[1, 'Brisbane'], [3, 'Canterbury']],
  );

  assert.deepEqual(Array.from(changes, (row) => Array.from(row)), [
    ['2026 Data Sheet', 'A5', 2, 3],
    ['2026 Data Sheet', 'B5', 'Canberra', 'Canterbury'],
  ]);
});

test('applies inputs then runs the canonical model chain exactly once before verification', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
  };
  const calls: string[] = [];
  const plan = canonicalPlan(automation);
  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    writeRange: (range: { key: string }) => calls.push(`write:${range.key}`),
    syncMatchOdds: () => calls.push('sync:match-pinnacle-predictions'),
    syncTryScorerOdds: () => calls.push('sync:scorers'),
    markMatchModelRun: () => calls.push('mark-match-model'),
    markScorerOddsRun: () => calls.push('mark-scorer-odds'),
    verify: () => calls.push('verify'),
    markApplied: () => calls.push('mark-applied'),
  };

  const result = automation.applyRightEdgeTuesdayPlan_(plan, services);

  assert.equal(result.skipped, false);
  assert.deepEqual(calls, [
    'write:season',
    'write:advanced',
    'write:fixtures',
    'write:scorers',
    'sync:match-pinnacle-predictions',
    'mark-match-model',
    'sync:scorers',
    'mark-scorer-odds',
    'verify',
    'mark-applied',
  ]);
});

test('skips an already applied plan without any writes or model calls', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
  };
  const calls: string[] = [];
  const plan = {
    id: 'plan-26',
    ranges: [
      { key: 'season', sheet: 'A', startRow: 1, startColumn: 1, after: [[1]] },
      { key: 'advanced', sheet: 'B', startRow: 1, startColumn: 1, after: [[1]] },
      { key: 'fixtures', sheet: 'C', startRow: 1, startColumn: 1, after: [[1]] },
      { key: 'scorers', sheet: 'D', startRow: 1, startColumn: 1, after: [[1]] },
    ],
  };
  const services = {
    hasApplied: () => { calls.push('has-applied'); return true; },
    writeRange: () => calls.push('write'),
    syncMatchOdds: () => calls.push('sync-match'),
    syncTryScorerOdds: () => calls.push('sync-scorers'),
    verify: () => calls.push('verify'),
    markApplied: () => calls.push('mark-applied'),
  };

  const result = automation.applyRightEdgeTuesdayPlan_(plan, services);

  assert.equal(result.skipped, true);
  assert.deepEqual(calls, ['has-applied']);
});

test('does not rerun the model chain when only post-run verification previously failed', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
  };
  const plan = canonicalPlan(automation);
  let matchModelRan = false;
  let scorerOddsRan = false;
  let verificationAttempts = 0;
  let matchRuns = 0;
  let scorerRuns = 0;
  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => matchModelRan,
    markMatchModelRun: () => { matchModelRan = true; },
    hasScorerOddsRun: () => scorerOddsRan,
    markScorerOddsRun: () => { scorerOddsRan = true; },
    writeRange: () => undefined,
    syncMatchOdds: () => { matchRuns += 1; },
    syncTryScorerOdds: () => { scorerRuns += 1; },
    verify: () => {
      verificationAttempts += 1;
      if (verificationAttempts === 1) throw new Error('verification read failed');
    },
    markApplied: () => undefined,
  };

  assert.throws(
    () => automation.applyRightEdgeTuesdayPlan_(plan, services),
    /verification read failed/,
  );
  const result = automation.applyRightEdgeTuesdayPlan_(plan, services);

  assert.equal(result.skipped, false);
  assert.equal(matchRuns, 1);
  assert.equal(scorerRuns, 1);
  assert.equal(verificationAttempts, 2);
});

test('does not rerun match predictions when only scorer-odds sync previously failed', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
  };
  const plan = canonicalPlan(automation);
  let matchModelRan = false;
  let scorerOddsRan = false;
  let matchRuns = 0;
  let scorerRuns = 0;
  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => matchModelRan,
    markMatchModelRun: () => { matchModelRan = true; },
    hasScorerOddsRun: () => scorerOddsRan,
    markScorerOddsRun: () => { scorerOddsRan = true; },
    writeRange: () => undefined,
    syncMatchOdds: () => { matchRuns += 1; },
    syncTryScorerOdds: () => {
      scorerRuns += 1;
      if (scorerRuns === 1) throw new Error('scorer odds unavailable');
    },
    verify: () => undefined,
    markApplied: () => undefined,
  };

  assert.throws(
    () => automation.applyRightEdgeTuesdayPlan_(plan, services),
    /scorer odds unavailable/,
  );
  automation.applyRightEdgeTuesdayPlan_(plan, services);

  assert.equal(matchRuns, 1);
  assert.equal(scorerRuns, 2);
});

test('accepts a canonical odds sync that ran without Pinnacle, falling back to raw ratings', () => {
  // The prediction model is explicitly designed to blend against Pinnacle when
  // available and fall back to raw ratings otherwise (Main Script.gs header).
  // Requiring Pinnacle here would block a run the model can complete on its own.
  const automation = loadAutomation() as {
    assertRightEdgeCanonicalSyncResult_: (result: Record<string, unknown>) => void;
  };

  assert.doesNotThrow(() => automation.assertRightEdgeCanonicalSyncResult_({
    updatedCount: 8,
    pinnacleResult: { skipped: true, reason: 'Pinnacle unavailable' },
  }));
});

test('rejects a canonical odds sync where match odds themselves never matched', () => {
  // Missing Pinnacle is a documented fallback. Missing MATCH odds entirely
  // means the whole feed failed, which must still stop the run.
  const automation = loadAutomation() as {
    assertRightEdgeCanonicalSyncResult_: (result: Record<string, unknown>) => void;
  };

  assert.throws(
    () => automation.assertRightEdgeCanonicalSyncResult_({
      updatedCount: 0,
      pinnacleResult: { skipped: true, reason: 'Pinnacle unavailable' },
    }),
    /Needs Check/,
  );
  assert.throws(
    () => automation.assertRightEdgeCanonicalSyncResult_(null),
    /Needs Check/,
  );
});

test('builds player positions from verified Sheet history and latest Champion Data matches', () => {
  const automation = loadAutomation() as {
    buildRightEdgePositionLookup_: (
      fixtures: Array<Record<string, unknown>>,
      payloads: Record<string, unknown>,
      sheetRows: unknown[][],
    ) => Record<string, string>;
  };
  const sheetRows = [
    [10, 'Brisbane v Melbourne', 'Alex Example', 'Brisbane', 'Wing'],
    [10, 'Brisbane v Melbourne', 'Casey Existing', 'Melbourne', 'Centre'],
  ];
  const fixtures = [{
    matchId: 1001,
    matchStatus: 'complete',
    roundNumber: 25,
    homeSquadId: 5001,
    homeSquadName: 'Brisbane Broncos',
    awaySquadId: 5002,
    awaySquadName: 'Melbourne Storm',
  }];
  const payloads = {
    '1001': {
      matchStats: {
        playerInfo: { player: [{ playerId: 7, firstname: 'Alex', surname: 'Example' }] },
        playerStats: { player: [{ playerId: 7, squadId: 5001, position: 'Fullback' }] },
      },
    },
  };

  const positions = automation.buildRightEdgePositionLookup_(fixtures, payloads, sheetRows);

  assert.equal(positions['brisbane|alex example'], 'Fullback');
  assert.equal(positions['melbourne|casey existing'], 'Centre');
});

test('reads all five live scorer-history columns for verified positions', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(
    automationSource,
    /scorerSheet\.getRange\(2, 1, scorerLastRow - 1, 5\)\.getValues\(\)/,
  );
});

test('rejects a stale NRL metric when its games played disagree with the ladder and fixtures', () => {
  const automation = loadAutomation() as {
    validateRightEdgeSourceAlignment_: (
      ladderRows: unknown[][],
      fixtures: Array<Record<string, unknown>>,
      metricPayloads: unknown[],
    ) => void;
  };
  const ladderRows = TEAM_NAMES.map((team, index) => {
    const row = Array(27).fill(0);
    row[0] = index + 1;
    row[1] = team;
    row[16] = 2;
    return row;
  });
  const fixtures = NRL_TEAM_NAMES.map((homeTeam, index) => ({
    matchId: 2000 + index,
    matchStatus: 'complete',
    homeSquadId: 6000 + index,
    homeSquadName: homeTeam,
    awaySquadId: 6000 + ((index + 1) % NRL_TEAM_NAMES.length),
    awaySquadName: NRL_TEAM_NAMES[(index + 1) % NRL_TEAM_NAMES.length],
  }));
  const metricPayloads = ['A', 'B', 'C', 'D'].map((title, metricIndex) => ({
    averageStats: {
      title,
      leaders: NRL_TEAM_NAMES.map((teamName, teamIndex) => ({
        teamName,
        played: metricIndex === 3 && teamIndex === 0 ? 1 : 2,
        value: '1.0',
      })),
    },
  }));

  assert.throws(
    () => automation.validateRightEdgeSourceAlignment_(ladderRows, fixtures, metricPayloads),
    /Needs Check/,
  );
});

test('builds an immutable four-range plan with exact cell changes and stale fixture clearing', () => {
  const automation = loadAutomation() as {
    buildRightEdgeTuesdayPlan_: (input: Record<string, unknown>) => {
      id: string;
      ranges: Array<{ key: string; before: unknown[][]; after: unknown[][] }>;
      changes: unknown[][];
    };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const wide = (fill: unknown, width: number) => Array(width).fill(fill);
  const plan = automation.buildRightEdgeTuesdayPlan_({
    season: 2026,
    roundNumber: 27,
    sourceHash: 'abc123',
    createdAt: '2026-08-25T08:00:00.000Z',
    seasonRange: {
      sheet: '2026 Data Sheet', startRow: 4, startColumn: 1,
      before: [wide(1, 27)], after: [wide(2, 27)],
    },
    advancedRange: {
      sheet: '2026 Advanced Data Sheet', startRow: 2, startColumn: 1,
      before: [wide(3, 6)], after: [wide(4, 6)],
    },
    fixtureRange: {
      sheet: 'Match Predictions',
      startRow: 2,
      startColumn: 1,
      before: [['A', 'B'], ['Old', 'Fixture']],
      after: [['C', 'D']],
    },
    scorerRange: {
      sheet: 'Player Prop - Anytime Try Scorer',
      startRow: 2,
      startColumn: 1,
      before: [['', '', '', '', '', '']],
      after: [[27, 'Brisbane v Melbourne', 'Player', 'Brisbane', 'Wing', 0.2]],
    },
  });

  assert.equal(plan.id, automation.computeRightEdgePlanId_(plan.ranges));
  assert.deepEqual(Array.from(plan.ranges, (range) => range.key), ['season', 'advanced', 'fixtures', 'scorers']);
  assert.deepEqual(Array.from(plan.ranges[2].after, (row) => Array.from(row)), [['C', 'D'], ['', '']]);
  assert.ok(plan.changes.some((row) => row[0] === 'Match Predictions' && row[1] === 'A3' && row[3] === ''));
});

test('rejects a Stats Insider fixture that disagrees with the authoritative round draw', () => {
  const automation = loadAutomation() as {
    validateRightEdgeUpcomingFixtures_: (
      fixtures: Array<Record<string, unknown>>,
      statsMatches: Array<{ fixture: string[] }>,
    ) => string[][];
  };
  const fixtures = [{
    homeSquadName: 'Brisbane Broncos',
    awaySquadName: 'Melbourne Storm',
  }];
  const statsMatches = [{ fixture: ['Brisbane', 'Penrith'] }];

  assert.throws(
    () => automation.validateRightEdgeUpcomingFixtures_(fixtures, statsMatches),
    /Needs Check/,
  );
});

test('collects aligned source data into one read-only approval plan', () => {
  const automation = loadAutomation() as {
    collectRightEdgeTuesdayPlan_: (services: Record<string, unknown>) => {
      id: string;
      roundNumber: number;
      ranges: Array<{ key: string; after: unknown[][] }>;
    };
  };
  const ladderRows = TEAM_NAMES.map((team, index) => {
    const row = Array(27).fill(0);
    row[0] = index + 1;
    row[1] = team;
    row[16] = 2;
    return row;
  });
  const completeFixtures = NRL_TEAM_NAMES.map((homeTeam, index) => ({
    matchId: 3000 + index,
    matchStatus: 'complete',
    roundNumber: 25,
    homeSquadId: 7000 + index,
    homeSquadName: homeTeam,
    awaySquadId: 7000 + ((index + 1) % NRL_TEAM_NAMES.length),
    awaySquadName: NRL_TEAM_NAMES[(index + 1) % NRL_TEAM_NAMES.length],
  }));
  const upcomingFixture = {
    matchId: 4001,
    matchStatus: 'scheduled',
    roundNumber: 26,
    homeSquadId: 7000,
    homeSquadName: 'Brisbane Broncos',
    awaySquadId: 7007,
    awaySquadName: 'Melbourne Storm',
  };
  const championMatchPayloads = Object.fromEntries(completeFixtures.map((fixture) => [
    String(fixture.matchId),
    {
      matchStats: {
        matchInfo: { matchId: fixture.matchId, matchStatus: 'complete' },
        teamStats: {
          team: [
            { squadId: fixture.homeSquadId, setRestartsRuck: 2 },
            { squadId: fixture.awaySquadId, setRestartsRuck: 4 },
          ],
        },
        playerInfo: { player: [] },
        playerStats: { player: [] },
      },
    },
  ]));
  const metricPayloads = [
    ['Post Contact Metres', 500],
    ['Linebreaks', 5],
    ['Tackle Breaks', 30],
    ['Missed Tackles', 25],
  ].map(([title, value]) => ({
    averageStats: {
      title,
      leaders: NRL_TEAM_NAMES.map((teamName) => ({ teamName, played: 2, value: String(value) })),
    },
  }));
  const homePlayers = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Home', last_name: `Player ${index + 1}`, anytimeTry: (index + 1) / 100,
  }));
  const awayPlayers = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Away', last_name: `Player ${index + 1}`, anytimeTry: (index + 1) / 100,
  }));
  const scorerHistory = [
    ...homePlayers.map((player) => [
      25, 'Brisbane v Melbourne', `${player.first_name} ${player.last_name}`, 'Brisbane', 'Wing',
    ]),
    ...awayPlayers.map((player) => [
      25, 'Brisbane v Melbourne', `${player.first_name} ${player.last_name}`, 'Melbourne', 'Centre',
    ]),
  ];
  const statsPayload = {
    MatchData: {
      SIMatchID: 'NRL_2026_26_BRI_MEL', Season: 2026, RoundNumber: 26,
      HomeTeam: { Market: 'Brisbane' }, AwayTeam: { Market: 'Melbourne' },
    },
    PreData: { playerPropsData: { home: homePlayers, away: awayPlayers } },
  };
  const services = {
    getSourceBundle: () => ({
      season: 2026,
      rlpHtml: ladderHtml().replace(/>22</g, '>2<'),
      metricPayloads,
      championFixtures: [...completeFixtures, upcomingFixture],
      championMatchPayloads,
      statsScheduleHtml: '<a href="/sport-hub/nrl/schedule/2026_26_bri_mel">Match</a>',
      statsMatchPayloads: { NRL_2026_26_BRI_MEL: statsPayload },
    }),
    getSheetSnapshot: () => ({
      seasonBefore: ladderRows.map((row) => row.slice()),
      advancedTeamOrder: TEAM_NAMES.slice(),
      advancedBefore: TEAM_NAMES.map((team) => [team, 0, 0, 0, 0, 0]),
      fixtureBefore: Array.from({ length: 8 }, () => ['', '']),
      scorerHistory,
      scorerStartRow: 100,
      scorerBefore: Array.from({ length: 34 }, () => ['', '', '', '', '', '']),
    }),
    computeHash: () => 'hash123',
    nowIso: () => '2026-08-25T08:00:00.000Z',
  };

  const plan = automation.collectRightEdgeTuesdayPlan_(services);

  assert.equal(plan.id, automation.computeRightEdgePlanId_(plan.ranges));
  assert.equal(plan.roundNumber, 26);
  assert.deepEqual(Array.from(plan.ranges, (range) => range.key), ['season', 'advanced', 'fixtures', 'scorers']);
  assert.equal(plan.ranges[3].after.length, 34);
});

test('saves a preview and performs no apply during the first two approved Tuesdays', () => {
  const automation = loadAutomation() as {
    runRightEdgeTuesdayWorkflow_: (
      services: Record<string, unknown>,
    ) => { status: string; planId: string };
  };
  const calls: string[] = [];
  const services = {
    collectPlan: () => ({ id: 'plan-26' }),
    approvedRuns: () => 1,
    savePreview: () => calls.push('save-preview'),
    applyPlan: () => calls.push('apply'),
  };

  const result = automation.runRightEdgeTuesdayWorkflow_(services);

  assert.equal(result.status, 'Awaiting Approval');
  assert.equal(result.planId, 'plan-26');
  assert.deepEqual(calls, ['save-preview']);
});

test('applies automatically after two approved Tuesday runs', () => {
  const automation = loadAutomation() as {
    runRightEdgeTuesdayWorkflow_: (
      services: Record<string, unknown>,
    ) => { status: string; planId: string };
  };
  const calls: string[] = [];
  const services = {
    collectPlan: () => ({ id: 'plan-28' }),
    approvedRuns: () => 2,
    savePreview: () => calls.push('save-preview'),
    applyPlan: () => { calls.push('apply'); return { skipped: false }; },
  };

  const result = automation.runRightEdgeTuesdayWorkflow_(services);

  assert.equal(result.status, 'Applied');
  assert.equal(result.planId, 'plan-28');
  assert.deepEqual(calls, ['save-preview', 'apply']);
});

test('rejects approval when a live input cell changed after the preview', () => {
  const automation = loadAutomation() as {
    assertRightEdgePlanBeforeUnchanged_: (
      plan: Record<string, unknown>,
      readRange: (range: Record<string, unknown>) => unknown[][],
    ) => void;
  };
  const plan = {
    ranges: [{
      key: 'season', sheet: '2026 Data Sheet', startRow: 4, startColumn: 1,
      before: [[1, 'Brisbane']], after: [[2, 'Brisbane']],
    }],
  };

  assert.throws(
    () => automation.assertRightEdgePlanBeforeUnchanged_(plan, () => [[99, 'Brisbane']]),
    /Needs Check/,
  );
});

test('exposes Tuesday preview, approval, and trigger installation in the Sheet menu', () => {
  const menuSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  assert.match(menuSource, /addItem\('Preview Tuesday Automation', 'runRightEdgeTuesdayAutomation'\)/);
  assert.match(menuSource, /addItem\('Approve Tuesday Preview', 'approveRightEdgeTuesdayAutomation'\)/);
  assert.match(menuSource, /addItem\('Install Tuesday 6pm Automation', 'installRightEdgeTuesdayAutomation'\)/);
});

test('exposes a Tuesday-only removal action that leaves other odds triggers alone', () => {
  const menuSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(menuSource, /addItem\('Remove Tuesday Automation', 'removeRightEdgeTuesdayAutomation'\)/);
  assert.match(
    automationSource,
    /function removeRightEdgeTuesdayAutomation\(\)[\s\S]*?removeRightEdgeTuesdayTriggers_\('runRightEdgeTuesdayAutomation'\)[\s\S]*?removeRightEdgeTuesdayTriggers_\('retryRightEdgeTuesdayAutomation'\)/,
  );
});

test('canonical match sync exposes whether the Pinnacle stage completed', () => {
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  assert.match(syncSource, /return \{\s*updatedCount:\s*updatedCount,\s*pinnacleResult:\s*pinnacleResult\s*\};/);
});

test('Tuesday runtime validates the canonical match odds result before continuing', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  // Pinnacle is intentionally NOT required here: the prediction model falls
  // back to raw ratings when Pinnacle is absent (Main Script.gs), so requiring
  // it in the automation would block a run the model can complete without it.
  assert.match(
    automationSource,
    /const result = syncRightEdgeMatchOdds\(\{ requireMatchOdds: true \}\);\s*assertRightEdgeCanonicalSyncResult_\(result\);/,
  );
  assert.doesNotMatch(automationSource, /syncRightEdgeMatchOdds\([^)]*requirePinnacle/);
});

test('Tuesday strict mode still stops before predictions when match odds themselves are unavailable', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  assert.match(automationSource, /syncRightEdgeMatchOdds\(\{ requireMatchOdds: true \}\)/);
  assert.match(
    syncSource,
    /if \(options && options\.requireMatchOdds && !updatedCount\)[\s\S]*?throw new Error[\s\S]*?if \(typeof updatePredictions === 'function'\)/,
  );
});

test('a missing Pinnacle stage no longer blocks the canonical sync result', () => {
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );
  // requirePinnacle may still exist as an option for manual/other callers, but
  // the Tuesday automation must not pass it, and a skipped Pinnacle result on
  // its own must not throw when requirePinnacle is not set.
  assert.doesNotMatch(
    syncSource,
    /if \(options && pinnacleResult\.skipped\)[\s\S]*?throw new Error/,
  );
});

test('Tuesday scorer sync fails before stage completion when no prices are available', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  assert.match(automationSource, /syncRightEdgeTryScorerOdds\(\{ requirePrices: true \}\)/);
  assert.match(syncSource, /function syncRightEdgeTryScorerOdds\(options\)/);
  assert.match(
    syncSource,
    /if \(!oddsRows\.length\)[\s\S]*?if \(options && options\.requirePrices\)[\s\S]*?throw new Error/,
  );
});

test('rejects unknown team identities instead of guessing from a substring', () => {
  const automation = loadAutomation() as {
    normalizeRightEdgeNrlTeam_: (value: unknown) => string;
  };

  assert.equal(automation.normalizeRightEdgeNrlTeam_('Brisbane Broncos'), 'Brisbane');
  assert.equal(automation.normalizeRightEdgeNrlTeam_('Sydney Roosters'), 'Sydney');
  assert.throws(() => automation.normalizeRightEdgeNrlTeam_('North Sydney Bears'), /Needs Check/);
  assert.throws(() => automation.normalizeRightEdgeNrlTeam_('Brisbane Reserves'), /Needs Check/);
});

test('treats a missing NRL metric value as Needs Check instead of zero', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlMetric_: (payload: unknown, title: string) => Record<string, number>;
  };
  const payload = {
    averageStats: {
      title: 'Linebreaks',
      leaders: NRL_TEAM_NAMES.map((teamName, index) => ({
        teamName,
        value: index === 3 ? null : 4,
        played: 24,
      })),
    },
  };

  assert.throws(() => automation.parseRightEdgeNrlMetric_(payload, 'Linebreaks'), /Needs Check/);
});

test('treats a missing Champion Data ruck value as Needs Check instead of zero', () => {
  const automation = loadAutomation() as {
    aggregateRightEdgeRuckAverages_: (
      fixtures: Array<Record<string, unknown>>,
      payloads: Record<string, unknown>,
    ) => Record<string, number>;
  };
  const fixtures = NRL_TEAM_NAMES.map((homeTeam, index) => ({
    matchId: 1000 + index,
    matchStatus: 'complete',
    homeSquadId: 5000 + index,
    homeSquadName: homeTeam,
    awaySquadId: 5000 + ((index + 1) % NRL_TEAM_NAMES.length),
    awaySquadName: NRL_TEAM_NAMES[(index + 1) % NRL_TEAM_NAMES.length],
  }));
  const payloads = Object.fromEntries(fixtures.map((fixture, index) => [
    String(fixture.matchId),
    {
      matchStats: {
        matchInfo: { matchId: fixture.matchId, matchStatus: 'complete' },
        teamStats: {
          team: [
            { squadId: 5000 + index, setRestartsRuck: index === 2 ? null : 2 },
            { squadId: 5000 + ((index + 1) % NRL_TEAM_NAMES.length), setRestartsRuck: 4 },
          ],
        },
      },
    },
  ]));

  assert.throws(() => automation.aggregateRightEdgeRuckAverages_(fixtures, payloads), /Needs Check/);
});

test('neutralizes formula-leading characters in externally sourced text', () => {
  const automation = loadAutomation() as {
    sanitizeRightEdgeSheetText_: (value: unknown) => string;
  };

  assert.equal(automation.sanitizeRightEdgeSheetText_('Alex Johnston'), 'Alex Johnston');
  assert.equal(automation.sanitizeRightEdgeSheetText_('=HYPERLINK("evil")'), "'=HYPERLINK(\"evil\")");
  assert.equal(automation.sanitizeRightEdgeSheetText_('+1+1'), "'+1+1");
  assert.equal(automation.sanitizeRightEdgeSheetText_('@import'), "'@import");
  assert.equal(automation.sanitizeRightEdgeSheetText_('-lead'), "'-lead");
});

test('sanitizes Stats Insider player names before they reach the Sheet', () => {
  const automation = loadAutomation() as {
    parseRightEdgeStatsInsiderMatch_: (
      payload: unknown,
      matchId: string,
      positions: Record<string, string>,
    ) => { scorerRows: Array<Array<string | number>> };
  };
  const home = Array.from({ length: 17 }, (_, index) => ({
    first_name: index === 0 ? '=cmd' : 'Home',
    last_name: `Player ${index + 1}`,
    anytimeTry: (index + 1) / 100,
  }));
  const away = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Away',
    last_name: `Player ${index + 1}`,
    anytimeTry: (index + 1) / 100,
  }));
  const positions = Object.fromEntries([
    ...home.map((player) => [`Brisbane|${player.first_name} ${player.last_name}`.toLowerCase(), 'Wing']),
    ...away.map((player) => [`Melbourne|${player.first_name} ${player.last_name}`.toLowerCase(), 'Centre']),
  ]);
  const payload = {
    MatchData: {
      SIMatchID: 'NRL_2026_26_BRI_MEL',
      Season: 2026,
      RoundNumber: 26,
      HomeTeam: { Market: 'Brisbane' },
      AwayTeam: { Market: 'Melbourne' },
    },
    PreData: { playerPropsData: { home, away } },
  };

  const parsed = automation.parseRightEdgeStatsInsiderMatch_(payload, 'NRL_2026_26_BRI_MEL', positions);

  assert.equal(parsed.scorerRows[0][2], "'=cmd Player 1");
});

test('rejects a fixture whose home and away teams are identical', () => {
  const automation = loadAutomation() as {
    assertRightEdgeFixtureIntegrity_: (fixtures: string[][]) => void;
  };

  assert.throws(
    () => automation.assertRightEdgeFixtureIntegrity_([['Brisbane', 'Brisbane']]),
    /Needs Check/,
  );
});

test('rejects a round where one team appears in more than one fixture', () => {
  const automation = loadAutomation() as {
    assertRightEdgeFixtureIntegrity_: (fixtures: string[][]) => void;
  };

  assert.throws(
    () => automation.assertRightEdgeFixtureIntegrity_([
      ['Brisbane', 'Melbourne'],
      ['Brisbane', 'Penrith'],
    ]),
    /Needs Check/,
  );
  assert.doesNotThrow(() => automation.assertRightEdgeFixtureIntegrity_([
    ['Brisbane', 'Melbourne'],
    ['Souths', 'Penrith'],
  ]));
});

test('binds each plan range to its canonical sheet, coordinates, and width', () => {
  const automation = loadAutomation() as {
    assertRightEdgePlanShape_: (plan: Record<string, unknown>) => void;
  };
  const validRange = (key: string, sheet: string, startRow: number, width: number) => ({
    key,
    sheet,
    startRow,
    startColumn: 1,
    before: [Array(width).fill('')],
    after: [Array(width).fill(1)],
  });
  const plan = {
    id: 'plan-1',
    ranges: [
      validRange('season', '2026 Data Sheet', 4, 27),
      validRange('advanced', '2026 Advanced Data Sheet', 2, 6),
      validRange('fixtures', 'Match Predictions', 2, 2),
      validRange('scorers', 'Player Prop - Anytime Try Scorer', 2, 6),
    ],
  };

  assert.doesNotThrow(() => automation.assertRightEdgePlanShape_(plan));

  const tampered = JSON.parse(JSON.stringify(plan));
  tampered.ranges[0].sheet = 'Subscribers';
  assert.throws(() => automation.assertRightEdgePlanShape_(tampered), /Needs Check/);

  const movedRange = JSON.parse(JSON.stringify(plan));
  movedRange.ranges[1].startRow = 40;
  assert.throws(() => automation.assertRightEdgePlanShape_(movedRange), /Needs Check/);

  const widened = JSON.parse(JSON.stringify(plan));
  widened.ranges[2].after = [Array(9).fill(1)];
  assert.throws(() => automation.assertRightEdgePlanShape_(widened), /Needs Check/);
});

test('rejects an approved plan whose id no longer matches its contents', () => {
  const automation = loadAutomation() as {
    computeRightEdgePlanId_: (ranges: unknown) => string;
    assertRightEdgePlanIntegrity_: (plan: Record<string, unknown>) => void;
  };
  const ranges = [{ key: 'season', after: [[1, 2]] }];
  const plan = { id: automation.computeRightEdgePlanId_(ranges), ranges };

  assert.doesNotThrow(() => automation.assertRightEdgePlanIntegrity_(plan));

  const tampered = { id: plan.id, ranges: [{ key: 'season', after: [[9, 9]] }] };
  assert.throws(() => automation.assertRightEdgePlanIntegrity_(tampered), /Needs Check/);
});

test('applying a plan enforces canonical shape and integrity before any write', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(
    automationSource,
    /function applyRightEdgeTuesdayPlan_[\s\S]*?assertRightEdgePlanShape_\(plan\);[\s\S]*?assertRightEdgePlanIntegrity_\(plan\);[\s\S]*?services\.writeRange/,
  );
});

test('strict Pinnacle mode rejects an empty or unmatched successful feed', () => {
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  assert.match(
    syncSource,
    /if \(options && options\.requirePinnacle && !pinnacleResult\.updatedCount\)[\s\S]*?throw new Error/,
  );
});

test('clears only the previewed columns so unpreviewed data is never destroyed', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.doesNotMatch(automationSource, /clearContent\(\)[\s\S]{0,80}sheet\.getLastColumn\(\)/);
  assert.match(
    automationSource,
    /function writeRightEdgePlanRange_[\s\S]*?sheet\.getRange\(range\.startRow, range\.startColumn, rowCount, columnCount\)\.clearContent\(\)/,
  );
});

test('rolls the range back to its previewed before-values when a write fails verification', () => {
  const automation = loadAutomation() as {
    applyRightEdgeRangeWithRollback_: (
      range: Record<string, unknown>,
      write: (range: unknown) => void,
    ) => void;
  };
  const range = {
    key: 'season',
    sheet: '2026 Data Sheet',
    startRow: 4,
    startColumn: 1,
    before: [['old']],
    after: [['new']],
  };
  const restored: unknown[] = [];

  assert.throws(
    () => automation.applyRightEdgeRangeWithRollback_(range, (target: { key: string }) => {
      if (target.key === 'season') throw new Error('write verification failed');
    }, (rollback: unknown) => restored.push(rollback)),
    /write verification failed/,
  );
  assert.equal(restored.length, 1);
  assert.deepEqual((restored[0] as { after: unknown[][] }).after, [['old']]);
});

test('bounds Stats Insider retries so a broken feed cannot loop forever', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(automationSource, /RIGHTEDGE_TUESDAY_MAX_RETRIES\s*=\s*\d+/);
  assert.match(
    automationSource,
    /attempt\s*>=\s*RIGHTEDGE_TUESDAY_MAX_RETRIES[\s\S]{0,400}?Needs Check/,
  );
});

test('fetches official NRL metrics from the JSON data endpoint, not the login-gated HTML page', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(automationSource, /nrl\.com\/stats\/teams\/data\?competition=/);
  assert.doesNotMatch(automationSource, /nrl\.com\/stats\/teams\/\?competition=/);
});

test('rejects an NRL sign-in interstitial instead of treating it as data', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlPayload_: (body: string) => Record<string, unknown>;
  };
  const signInHtml = '<html><head><title>Submit This Form</title></head><body>'
    + '<form method="post" action="https://www.nrl.com/account/signin-nrl">'
    + '<input type="hidden" name="error" value="login_required"/></form></body></html>';

  // Must be identified specifically as a sign-in wall. A generic parse failure
  // would hide the fact that the source is gated rather than merely malformed.
  assert.throws(
    () => automation.parseRightEdgeNrlPayload_(signInHtml),
    /Needs Check: official NRL source returned a sign-in page/,
  );

  // The same guard must hold when the interstitial arrives on the JSON route.
  const signInJsonRoute = '{"redirect":"https://www.nrl.com/account/signin-nrl"}';
  assert.throws(
    () => automation.parseRightEdgeNrlPayload_(signInJsonRoute),
    /Needs Check: official NRL source returned a sign-in page/,
  );
});

test('parses the NRL JSON data payload directly', () => {
  const automation = loadAutomation() as {
    parseRightEdgeNrlPayload_: (body: string) => { averageStats: { title: string } };
  };
  const body = JSON.stringify({
    averageStats: {
      title: 'Tackle Breaks',
      leaders: NRL_TEAM_NAMES.map((teamName) => ({ teamName, value: '30.1', played: 22 })),
    },
  });

  assert.equal(automation.parseRightEdgeNrlPayload_(body).averageStats.title, 'Tackle Breaks');
});

test('requests the NRL data route as JSON only, because text/html triggers the sign-in wall', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  assert.match(
    automationSource,
    /function fetchRightEdgeNrlJsonText_[\s\S]{0,400}?headers:\s*\{\s*Accept:\s*'application\/json'\s*\}/,
  );
  assert.match(
    automationSource,
    /function fetchRightEdgeNrlMetric_[\s\S]{0,400}?fetchJsonText\(jsonUrl\)/,
  );
});

test('rolls every already-written range back when a later range fails mid-apply', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const plan = canonicalPlan(automation);
  // Simulate a live Sheet: each range starts at its previewed before-values.
  const sheetState: Record<string, unknown[][]> = {};
  plan.ranges.forEach((range) => { sheetState[range.key] = range.before; });

  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    markMatchModelRun: () => undefined,
    markScorerOddsRun: () => undefined,
    writeRange: (range: { key: string; after: unknown[][] }) => {
      // The third range is where the real failure happens. The rollback pass
      // re-writes the same key with the before-values, which must succeed.
      if (range.key === 'fixtures' && range.after[0][0] === 'fixtures') {
        throw new Error('sheet write failed');
      }
      sheetState[range.key] = range.after;
    },
    syncMatchOdds: () => { throw new Error('model must not run after a failed write'); },
    syncTryScorerOdds: () => { throw new Error('scorers must not run after a failed write'); },
    verify: () => { throw new Error('verify must not run after a failed write'); },
    markApplied: () => { throw new Error('must not mark applied after a failed write'); },
  };

  assert.throws(() => automation.applyRightEdgeTuesdayPlan_(plan, services), /sheet write failed/);

  // Every range must be back exactly at its previewed before-values.
  plan.ranges.forEach((range) => {
    assert.deepEqual(sheetState[range.key], range.before, `${range.key} was not rolled back`);
  });
});

test('a tampered pending plan cannot redirect a write to another sheet', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const plan = canonicalPlan(automation);
  const written: string[] = [];
  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    markMatchModelRun: () => undefined,
    markScorerOddsRun: () => undefined,
    writeRange: (range: { sheet: string }) => written.push(range.sheet),
    syncMatchOdds: () => undefined,
    syncTryScorerOdds: () => undefined,
    verify: () => undefined,
    markApplied: () => undefined,
  };

  // Repoint the season range at an unrelated sheet, keeping the approved id.
  const tampered = JSON.parse(JSON.stringify(plan));
  tampered.ranges[0].sheet = 'Subscribers';

  assert.throws(() => automation.applyRightEdgeTuesdayPlan_(tampered, services), /Needs Check/);
  assert.deepEqual(written, [], 'no write may occur when the plan was tampered with');
});

test('a plan whose values were altered after approval is rejected before any write', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const plan = canonicalPlan(automation);
  const written: string[] = [];
  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    markMatchModelRun: () => undefined,
    markScorerOddsRun: () => undefined,
    writeRange: (range: { key: string }) => written.push(range.key),
    syncMatchOdds: () => undefined,
    syncTryScorerOdds: () => undefined,
    verify: () => undefined,
    markApplied: () => undefined,
  };

  // Same canonical destinations, but the payload was swapped after approval.
  const tampered = JSON.parse(JSON.stringify(plan));
  tampered.ranges[1].after[0][1] = 999999;

  assert.throws(() => automation.applyRightEdgeTuesdayPlan_(tampered, services), /Needs Check/);
  assert.deepEqual(written, [], 'no write may occur when approved values were altered');
});

test('manual odds syncs stay non-strict so the existing menu behaviour is unchanged', () => {
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );
  const context: Record<string, unknown> = { console };
  vm.createContext(context);
  vm.runInContext(syncSource, context);

  const strictGuards = [
    'options && options.requirePinnacle && pinnacleResult.skipped',
    'options && options.requirePinnacle && !pinnacleResult.updatedCount',
    'options && options.requireMatchOdds && !updatedCount',
    'options && options.requirePrices',
  ];
  // Every strict branch must be gated behind an explicit caller-supplied option,
  // so a menu click (which passes no options) can never trip strict mode.
  strictGuards.forEach((guard) => {
    assert.ok(syncSource.includes(guard), `missing explicit option guard: ${guard}`);
  });
  assert.doesNotMatch(syncSource, /requirePinnacle\s*=\s*true/);
  assert.doesNotMatch(syncSource, /requirePrices\s*=\s*true/);
});

test('scorer snapshot, plan and verification all target the same canonical scorer sheet', () => {
  const automation = loadAutomation() as {
    assertRightEdgePlanShape_: (plan: Record<string, unknown>) => void;
  };
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  // Behavioural: the canonical scorer destination is the real Sheet's input tab.
  const ranges = canonicalRanges();
  assert.equal(ranges[3].sheet, 'Player Prop - Anytime Try Scorer');
  assert.doesNotThrow(() => automation.assertRightEdgePlanShape_({ id: 'x', ranges }));

  const wrongTab = canonicalRanges();
  wrongTab[3].sheet = 'Try Scorer Value Plays';
  assert.throws(() => automation.assertRightEdgePlanShape_({ id: 'x', ranges: wrongTab }), /Needs Check/);

  // Snapshot, canonical range and verification must all resolve via that constant,
  // otherwise approval compares a preview against a different sheet.
  assert.match(
    automationSource,
    /const scorerSheet = getRequiredRightEdgeSheet_\(spreadsheet, RIGHTEDGE_TUESDAY_SCORER_SHEET\)/,
  );
  assert.match(
    automationSource,
    /key: 'scorers', sheet: RIGHTEDGE_TUESDAY_SCORER_SHEET/,
  );
  assert.match(
    automationSource,
    /getRequiredRightEdgeSheet_\(spreadsheet, RIGHTEDGE_TUESDAY_SCORER_SHEET\)\s*\n?\s*\.getRange\(scorerRange\.startRow/,
  );

  // 'Try Scorer Value Plays' is a downstream output tab, never a scorer input.
  assert.doesNotMatch(automationSource, /getRequiredRightEdgeSheet_\(spreadsheet, 'Try Scorer Value Plays'\)/);
});

test('the scorer plan appends at the snapshot row instead of always overwriting row 2', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  // The computed append offset must actually be consumed by the plan.
  assert.match(automationSource, /startRow:\s*snapshot\.scorerStartRow/);
  assert.doesNotMatch(
    automationSource,
    /scorerRange:\s*\{[\s\S]{0,160}?startRow:\s*2\s*,/,
  );
});

test('the scorer range is validated by shape without pinning it to a fixed start row', () => {
  const automation = loadAutomation() as {
    assertRightEdgePlanShape_: (plan: Record<string, unknown>) => void;
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const ranges = canonicalRanges();
  // A later round legitimately appends further down the scorer sheet.
  ranges[3].startRow = 342;

  assert.doesNotThrow(() => automation.assertRightEdgePlanShape_({ id: 'x', ranges }));

  // The other three ranges remain pinned to their fixed positions.
  const moved = canonicalRanges();
  moved[0].startRow = 99;
  assert.throws(() => automation.assertRightEdgePlanShape_({ id: 'x', ranges: moved }), /Needs Check/);
});

test('rolls back the range that itself failed part-way through its own write', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const plan = canonicalPlan(automation);
  const sheetState: Record<string, unknown[][]> = {};
  plan.ranges.forEach((range) => { sheetState[range.key] = range.before; });

  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    markMatchModelRun: () => undefined,
    markScorerOddsRun: () => undefined,
    writeRange: (range: { key: string; after: unknown[][] }) => {
      // Mirrors the real writer: the block is mutated BEFORE verification,
      // so a verification failure leaves the range already clobbered.
      sheetState[range.key] = range.after;
      if (range.key === 'fixtures' && range.after[0][0] === 'fixtures') {
        throw new Error('write verification failed');
      }
    },
    syncMatchOdds: () => { throw new Error('model must not run'); },
    syncTryScorerOdds: () => { throw new Error('scorers must not run'); },
    verify: () => { throw new Error('verify must not run'); },
    markApplied: () => { throw new Error('must not mark applied'); },
  };

  assert.throws(() => automation.applyRightEdgeTuesdayPlan_(plan, services), /write verification failed/);

  // Including the range that failed mid-write.
  plan.ranges.forEach((range) => {
    assert.deepEqual(sheetState[range.key], range.before, `${range.key} was left clobbered`);
  });
});

test('binds the plan id with SHA-256 rather than a forgeable 32-bit hash', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  // A 32-bit non-cryptographic fold is brute-forceable, so a tampered plan
  // could be made to collide with its approved id.
  assert.doesNotMatch(automationSource, /hash\s*<<\s*5\)\s*-\s*hash/);
  assert.match(
    automationSource,
    /function computeRightEdgePlanId_[\s\S]{0,300}?rightEdgeSha256Hex_/,
  );
});

test('the SHA-256 implementation matches known NIST vectors and Node crypto', () => {
  const automation = loadAutomation() as { rightEdgeSha256Hex_: (input: string) => string };

  // Published NIST/FIPS-180 test vectors.
  assert.equal(
    automation.rightEdgeSha256Hex_(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  assert.equal(
    automation.rightEdgeSha256Hex_('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    automation.rightEdgeSha256Hex_('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );

  // Cross-check against Node's crypto over realistic plan-shaped payloads,
  // including multi-byte characters and inputs that straddle block boundaries.
  const samples = [
    'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(57), 'a'.repeat(63),
    'a'.repeat(64), 'a'.repeat(65), 'a'.repeat(200),
    JSON.stringify(canonicalRanges()),
    'Sé Geo Illa — Māori • 12345',
  ];
  samples.forEach((sample) => {
    assert.equal(
      automation.rightEdgeSha256Hex_(sample),
      createHash('sha256').update(sample, 'utf8').digest('hex'),
      `SHA-256 mismatch for sample of length ${sample.length}`,
    );
  });
});

test('a one-character change to a plan produces a completely different plan id', () => {
  const automation = loadAutomation() as { computeRightEdgePlanId_: (ranges: unknown) => string };
  const ranges = canonicalRanges();
  const before = automation.computeRightEdgePlanId_(ranges);

  const tweaked = JSON.parse(JSON.stringify(ranges));
  tweaked[1].after[0][1] = 'X';

  assert.notEqual(automation.computeRightEdgePlanId_(tweaked), before);
  assert.match(before, /^plan-[0-9a-f]{64}$/);
});

test('a failed rollback still restores every other range and reports what could not be restored', () => {
  const automation = loadAutomation() as {
    applyRightEdgeTuesdayPlan_: (
      plan: Record<string, unknown>,
      services: Record<string, unknown>,
    ) => { skipped: boolean };
    computeRightEdgePlanId_: (ranges: unknown) => string;
  };
  const plan = canonicalPlan(automation);
  const sheetState: Record<string, unknown[][]> = {};
  plan.ranges.forEach((range) => { sheetState[range.key] = range.before; });

  const services = {
    hasApplied: () => false,
    hasMatchModelRun: () => false,
    hasScorerOddsRun: () => false,
    markMatchModelRun: () => undefined,
    markScorerOddsRun: () => undefined,
    writeRange: (range: { key: string; after: unknown[][] }) => {
      sheetState[range.key] = range.after;
      // 'fixtures' fails on the forward write, and 'advanced' additionally
      // refuses to roll back — the remaining ranges must still be restored.
      if (range.key === 'fixtures' && range.after[0][0] === 'fixtures') {
        throw new Error('sheet write failed');
      }
      if (range.key === 'advanced' && range.after[0][0] === '') {
        throw new Error('rollback refused');
      }
    },
    syncMatchOdds: () => { throw new Error('model must not run'); },
    syncTryScorerOdds: () => { throw new Error('scorers must not run'); },
    verify: () => { throw new Error('verify must not run'); },
    markApplied: () => { throw new Error('must not mark applied'); },
  };

  // The operator is told exactly which range could not be restored.
  assert.throws(
    () => automation.applyRightEdgeTuesdayPlan_(plan, services),
    /rollback could not restore: advanced/,
  );

  // Everything that could be rolled back was rolled back.
  assert.deepEqual(sheetState.season, plan.ranges[0].before);
  assert.deepEqual(sheetState.fixtures, plan.ranges[2].before);
});

test('strict odds mode validates the feed before touching the odds columns', () => {
  const syncSource = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );

  const strictMatchGuard = syncSource.indexOf('options.requireMatchOdds && !updatedCount');
  const firstOddsWrite = syncSource.indexOf('writeRightEdgeOddsColumns_(sh, {');
  assert.ok(strictMatchGuard > -1, 'strict match-odds guard is missing');
  assert.ok(firstOddsWrite > -1, 'odds write is missing');

  // In strict mode an empty/unmatched feed must abort BEFORE any column is
  // cleared, because that write lies outside the Tuesday plan rollback.
  assert.ok(
    strictMatchGuard < firstOddsWrite,
    'strict match-odds validation must precede the first odds column write',
  );

  // Pinnacle must likewise be attempted and validated before the sheet is touched.
  const pinnacleAttempt = syncSource.indexOf('syncRightEdgePinnacleMatchOdds_(ss, sh, matches, lastRow)');
  const pinnacleGuard = syncSource.indexOf('options.requirePinnacle && !pinnacleResult.updatedCount');
  assert.ok(pinnacleAttempt < firstOddsWrite, 'Pinnacle must be attempted before the odds write');
  assert.ok(pinnacleGuard < firstOddsWrite, 'Pinnacle validation must precede the odds write');
});

test('sanitization cannot be bypassed with leading whitespace or newlines', () => {
  const automation = loadAutomation() as { sanitizeRightEdgeSheetText_: (value: unknown) => string };

  // Google Sheets trims leading whitespace before deciding a cell is a formula,
  // so the guard must look past any leading whitespace.
  const attacks = [
    ' =HYPERLINK("http://evil","x")',
    '  =1+1',
    '\t=1+1',
    '\n=1+1',
    '\r=1+1',
    ' \t \n =IMPORTXML("http://evil","//x")',
    ' +1+1',
    ' -1',
    ' @import',
    '=1+1',
  ];
  attacks.forEach((attack) => {
    assert.ok(
      automation.sanitizeRightEdgeSheetText_(attack).startsWith("'"),
      `formula bypass not neutralized: ${JSON.stringify(attack)}`,
    );
  });

  // Ordinary values must not be mangled.
  ['Alex Johnston', 'Brisbane v Melbourne', 'St Geo Illa', 'Wing', '', 'A. Johnston']
    .forEach((safe) => {
      assert.equal(automation.sanitizeRightEdgeSheetText_(safe), safe);
    });
});

test('every externally-sourced text column reaching the Sheet is sanitized', () => {
  const automation = loadAutomation() as {
    buildRightEdgeAdvancedRows_: (teamOrder: unknown[], metrics: Record<string, unknown>) => unknown[][];
    parseRightEdgeStatsInsiderMatch_: (
      payload: unknown,
      matchId: string,
      positions: Record<string, string>,
    ) => { fixture: string[]; scorerRows: Array<Array<string | number>> };
  };

  // A hostile position value arriving from Champion Data history.
  const home = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Home', last_name: `Player ${index + 1}`, anytimeTry: (index + 1) / 100,
  }));
  const away = Array.from({ length: 17 }, (_, index) => ({
    first_name: 'Away', last_name: `Player ${index + 1}`, anytimeTry: (index + 1) / 100,
  }));
  const positions = Object.fromEntries([
    ...home.map((p, i) => [
      `Brisbane|${p.first_name} ${p.last_name}`.toLowerCase(),
      i === 0 ? ' =cmd|calc' : 'Wing',
    ]),
    ...away.map((p) => [`Melbourne|${p.first_name} ${p.last_name}`.toLowerCase(), 'Centre']),
  ]);
  const parsed = automation.parseRightEdgeStatsInsiderMatch_(
    {
      MatchData: {
        SIMatchID: 'NRL_2026_26_BRI_MEL', Season: 2026, RoundNumber: 26,
        HomeTeam: { Market: 'Brisbane' }, AwayTeam: { Market: 'Melbourne' },
      },
      PreData: { playerPropsData: { home, away } },
    },
    'NRL_2026_26_BRI_MEL',
    positions,
  );

  // Position column (index 4) must be escaped, not passed through.
  assert.ok(
    String(parsed.scorerRows[0][4]).startsWith("'"),
    'hostile position value was not sanitized',
  );

  // Every text column of every scorer row must be formula-safe.
  parsed.scorerRows.forEach((row, rowIndex) => {
    [1, 2, 3, 4].forEach((col) => {
      const value = String(row[col]);
      const trimmed = value.replace(/^'/, '').replace(/^[\s\u00a0]+/, '');
      assert.ok(
        !/^[=+\-@]/.test(trimmed) || value.startsWith("'"),
        `unsanitized formula reached scorer row ${rowIndex} column ${col}`,
      );
    });
  });
});

// --- Behavioural harness for rightedge-match-odds-sync.gs -------------------
// The odds sync was previously only ever regex-matched as a string. This loads
// it into a real vm with stubbed Apps Script services so its strict-mode guards
// are actually executed.
function loadOddsSync(options: {
  matchRows?: unknown[][];
  pinnacleRows?: unknown[][];
  scorerRows?: unknown[][];
  sheetMatches?: unknown[][];
} = {}) {
  const source = readFileSync(
    new URL('../google-sheets/rightedge-match-odds-sync.gs', import.meta.url),
    'utf8',
  );
  const calls: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  const sheetMatches = options.sheetMatches ?? [['Brisbane', 'Melbourne']];

  // Superset of both sheets' headers so the same stub serves match-odds and
  // try-scorer syncs (each looks up only the columns it needs, by name).
  const headers = [
    'Match', 'Player', 'Team', 'Position', 'StatsInsider %', 'Bookmaker',
    'Market Implied %', 'Edge %',
    'Pinnacle Home Odds', 'Pinnacle Away Odds', 'Best Home Odds', 'Best Away Odds',
    'Best Odds',
  ];
  const makeRange = () => ({
    getValues: () => [headers],
    setValues: () => undefined,
    setNumberFormat: () => undefined,
    clearContent: () => undefined,
  });
  const sheet = {
    getLastRow: () => sheetMatches.length + 1,
    getLastColumn: () => headers.length,
    getRange: (row: number, col: number, numRows?: number, numCols?: number) => {
      if (row === 1) return makeRange();
      if (col === 1 && numCols === 2) {
        return { ...makeRange(), getValues: () => sheetMatches };
      }
      return {
        ...makeRange(),
        getValues: () => Array.from({ length: numRows ?? 1 }, () => Array(numCols ?? 1).fill('')),
        setValues: (values: unknown[][]) => { writes.push({ row, col, values }); },
      };
    },
  };

  const context: Record<string, unknown> = {
    console,
    JSON,
    Number,
    String,
    Array,
    Object,
    Math,
    RegExp,
    Error,
    Date,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => sheet,
        toast: (message: string) => calls.push(`toast:${message.slice(0, 40)}`),
      }),
      getUi: () => { throw new Error('UI not available in tests'); },
    },
    UrlFetchApp: {
      fetch: (url: string) => {
        calls.push(`fetch:${url.includes('pinnacle') ? 'pinnacle' : url.includes('try-scorer') ? 'scorer' : 'match'}`);
        const rows = url.includes('pinnacle')
          ? options.pinnacleRows ?? []
          : url.includes('try-scorer')
            ? options.scorerRows ?? []
            : options.matchRows ?? [];
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ rows, updatedAt: '2026-08-25T08:00:00.000Z' }),
        };
      },
    },
    updatePredictions: () => calls.push('updatePredictions'),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls, writes };
}

test('strict mode throws and writes nothing when the match feed matches no fixtures', () => {
  const { context, calls, writes } = loadOddsSync({ matchRows: [] });

  assert.throws(
    () => (context.syncRightEdgeMatchOdds as (o: unknown) => void)({
      requirePinnacle: true,
      requireMatchOdds: true,
    }),
    /no odds were written/,
  );

  // Critically: the model never ran and no cell was written.
  assert.ok(!calls.includes('updatePredictions'), 'prediction model must not run');
  assert.deepEqual(writes, [], 'no odds columns may be written in strict failure');
});

test('strict mode throws and writes nothing when Pinnacle matches no fixtures', () => {
  const { context, calls, writes } = loadOddsSync({
    matchRows: [['Brisbane', 'Melbourne', 1.8, 2.1, 'BookA', 'BookB', '', '2026-08-25']],
    pinnacleRows: [],
  });

  assert.throws(
    () => (context.syncRightEdgeMatchOdds as (o: unknown) => void)({
      requirePinnacle: true,
      requireMatchOdds: true,
    }),
    /Pinnacle odds returned no matching fixtures/,
  );

  assert.ok(!calls.includes('updatePredictions'), 'prediction model must not run');
  assert.deepEqual(writes, [], 'no odds columns may be written in strict failure');
});

test('a manual (non-strict) sync still writes and runs the model on a thin feed', () => {
  const { context, calls, writes } = loadOddsSync({ matchRows: [], pinnacleRows: [] });

  // No options object at all — exactly what a menu click passes.
  (context.syncRightEdgeMatchOdds as () => void)();

  assert.ok(calls.includes('updatePredictions'), 'manual behaviour must be unchanged');
  assert.ok(writes.length > 0, 'manual sync still writes its odds columns');
});

test('strict scorer sync throws on an empty price feed, manual sync does not', () => {
  const strict = loadOddsSync({ scorerRows: [] });
  assert.throws(
    () => (strict.context.syncRightEdgeTryScorerOdds as (o: unknown) => void)({ requirePrices: true }),
    /No try scorer prices/,
  );

  const manual = loadOddsSync({ scorerRows: [] });
  assert.doesNotThrow(() => (manual.context.syncRightEdgeTryScorerOdds as () => void)());
});

test('each fresh Tuesday run starts with a full retry budget', () => {
  const automationSource = readFileSync(AUTOMATION_FILE, 'utf8');

  // A run that ends in Needs Check leaves the retry counter set. If the next
  // scheduled Tuesday inherited that counter it would begin with zero retries,
  // so the entry point must clear it before starting.
  assert.match(
    automationSource,
    /function runRightEdgeTuesdayAutomation\(\)[\s\S]{0,600}?resetRightEdgeTuesdayRetries_\([\s\S]{0,200}?runRightEdgeTuesdayWorkflow_/,
  );

  // The retry entry point must NOT reset it, or retries would loop forever.
  const retryFn = automationSource.slice(
    automationSource.indexOf('function retryRightEdgeTuesdayAutomation'),
  ).split('\n}')[0];
  assert.doesNotMatch(retryFn, /deleteProperty\(RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY\)/);
});

test('a stale retry counter cannot silently disable next week\'s retries', () => {
  const automation = loadAutomation() as {
    resetRightEdgeTuesdayRetries_: (properties: Record<string, unknown>) => void;
  };
  const store: Record<string, string> = { RIGHTEDGE_TUESDAY_RETRY_COUNT: '12' };
  const properties = {
    getProperty: (k: string) => store[k] ?? null,
    setProperty: (k: string, v: string) => { store[k] = v; },
    deleteProperty: (k: string) => { delete store[k]; },
  };

  automation.resetRightEdgeTuesdayRetries_(properties);

  assert.equal(store.RIGHTEDGE_TUESDAY_RETRY_COUNT, undefined, 'exhausted counter must be cleared');
});

