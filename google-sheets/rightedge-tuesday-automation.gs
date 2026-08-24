const RIGHTEDGE_TUESDAY_EXPECTED_TEAMS = [
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

function rightEdgeTuesdayValidationError_(message) {
  return new Error('Needs Check: ' + message);
}

// The single canonical scorer input tab. Snapshot, plan and verification must
// all agree on this, or approval compares a preview against a different sheet.
const RIGHTEDGE_TUESDAY_SCORER_SHEET = 'Player Prop - Anytime Try Scorer';

// Self-contained SHA-256 so plan binding is identical in Apps Script and in
// tests, without depending on the Utilities service being present.
const RIGHTEDGE_SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rightEdgeSha256Hex_(input) {
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  const utf8 = unescape(encodeURIComponent(String(input)));
  const bytes = [];
  for (let i = 0; i < utf8.length; i += 1) bytes.push(utf8.charCodeAt(i) & 0xff);

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i -= 1) {
    bytes.push(Math.floor(bitLength / Math.pow(2, i * 8)) & 0xff);
  }

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i += 1) {
      w[i] = ((bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16)
        | (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + S1 + ch + RIGHTEDGE_SHA256_K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  return h.map(function (value) { return ('00000000' + value.toString(16)).slice(-8); }).join('');
}

function decodeRightEdgeHtml_(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function (_match, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRightEdgeSheetNumber_(value) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-') return cleaned;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) {
    throw rightEdgeTuesdayValidationError_('malformed ladder number: ' + value);
  }
  return Number(cleaned);
}

function parseRightEdgeRlpLadder_(html) {
  const rows = [];
  const rowMatches = String(html || '').match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];

  rowMatches.forEach(function (rowHtml) {
    const cells = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(decodeRightEdgeHtml_(cellMatch[1]));
    }
    if (cells.length !== 27 || !/^\d+\.$/.test(cells[0])) return;

    const parsed = [parseRightEdgeSheetNumber_(cells[0].slice(0, -1)), cells[1]];
    cells.slice(2).forEach(function (cell) {
      parsed.push(parseRightEdgeSheetNumber_(cell));
    });
    rows.push(parsed);
  });

  if (rows.length !== 17) {
    throw rightEdgeTuesdayValidationError_('Rugby League Project ladder must contain exactly 17 teams; found ' + rows.length);
  }

  const teams = rows.map(function (row) { return row[1]; });
  const uniqueTeams = Array.from(new Set(teams)).sort();
  const expectedTeams = RIGHTEDGE_TUESDAY_EXPECTED_TEAMS.slice().sort();
  if (JSON.stringify(uniqueTeams) !== JSON.stringify(expectedTeams)) {
    throw rightEdgeTuesdayValidationError_('Rugby League Project team identities are incomplete or unexpected');
  }

  return rows;
}

function parseRightEdgeNrlPagePayload_(html) {
  const pattern = /\bq-data=(['"])([\s\S]*?)\1/gi;
  let match;
  let foundAttribute = false;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    foundAttribute = true;
    const json = match[2]
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, function (_entity, code) {
        return String.fromCharCode(Number(code));
      })
      .replace(/&amp;/gi, '&');
    try {
      const payload = JSON.parse(json);
      if (payload && payload.averageStats) return payload;
    } catch (error) {
      // Keep scanning because unrelated q-data attributes may be malformed.
    }
  }
  throw rightEdgeTuesdayValidationError_(foundAttribute
    ? 'official NRL stats q-data is malformed'
    : 'official NRL stats page is missing q-data');
}

function normalizeRightEdgeNrlTeam_(value) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = [
    [['brisbane', 'brisbane broncos', 'broncos', 'bri'], 'Brisbane'],
    [['canberra', 'canberra raiders', 'raiders', 'can'], 'Canberra'],
    [['canterbury', 'canterbury bankstown bulldogs', 'canterbury bulldogs', 'bulldogs', 'cby'], 'Canterbury'],
    [['cronulla', 'cronulla sutherland sharks', 'cronulla sharks', 'sharks', 'cro'], 'Cronulla'],
    [['dolphins', 'the dolphins', 'redcliffe dolphins', 'dol'], 'Dolphins'],
    [['gold coast', 'gold coast titans', 'titans', 'gld'], 'Gold Coast'],
    [['manly', 'manly warringah sea eagles', 'manly sea eagles', 'sea eagles', 'man'], 'Manly'],
    [['melbourne', 'melbourne storm', 'storm', 'mel'], 'Melbourne'],
    [['newcastle', 'newcastle knights', 'knights', 'new'], 'Newcastle'],
    [['north qld', 'north queensland', 'north queensland cowboys', 'cowboys', 'nql'], 'North Qld'],
    [['parramatta', 'parramatta eels', 'eels', 'par'], 'Parramatta'],
    [['penrith', 'penrith panthers', 'panthers', 'pen'], 'Penrith'],
    [['st geo illa', 'st george illawarra', 'st george illawarra dragons', 'st george', 'dragons', 'sgi'], 'St Geo Illa'],
    [['souths', 'south sydney', 'south sydney rabbitohs', 'rabbitohs', 'sou'], 'Souths'],
    [['sydney', 'sydney roosters', 'roosters', 'syd'], 'Sydney'],
    [['warriors', 'new zealand warriors', 'nz warriors', 'war'], 'Warriors'],
    [['wests tigers', 'wests', 'tigers', 'wst'], 'Wests Tigers'],
  ];

  for (let index = 0; index < aliases.length; index += 1) {
    const names = aliases[index][0];
    if (names.indexOf(text) !== -1) {
      return aliases[index][1];
    }
  }
  throw rightEdgeTuesdayValidationError_('unknown NRL team identity: ' + value);
}

function sanitizeRightEdgeSheetText_(value) {
  const text = String(value === null || value === undefined ? '' : value);
  // Sheets trims leading whitespace before deciding a cell is a formula, so the
  // guard must look past any leading whitespace (including newlines and NBSP)
  // rather than only at the very first character.
  if (/^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function parseRightEdgeNrlPayload_(body) {
  const text = String(body || '').trim();
  if (!text) {
    throw rightEdgeTuesdayValidationError_('official NRL response was empty');
  }
  // NRL serves a sign-in interstitial with HTTP 200 when a route is gated.
  // Treat any login redirect as missing data, never as a parseable payload.
  if (/signin-nrl|login_required|Submit This Form/i.test(text)) {
    throw rightEdgeTuesdayValidationError_('official NRL source returned a sign-in page instead of statistics');
  }
  if (text.charAt(0) === '{' || text.charAt(0) === '[') {
    try {
      const payload = JSON.parse(text);
      if (payload && payload.averageStats) return payload;
    } catch (error) {
      throw rightEdgeTuesdayValidationError_('official NRL JSON payload is malformed');
    }
    throw rightEdgeTuesdayValidationError_('official NRL JSON payload is missing averageStats');
  }
  return parseRightEdgeNrlPagePayload_(text);
}

function parseRightEdgeStrictNumber_(value, label) {
  if (value === null || value === undefined || value === '') {
    throw rightEdgeTuesdayValidationError_('missing ' + label);
  }
  if (typeof value === 'boolean') {
    throw rightEdgeTuesdayValidationError_('malformed ' + label);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw rightEdgeTuesdayValidationError_('malformed ' + label);
  }
  return numeric;
}

function assertRightEdgeFixtureIntegrity_(fixtures) {
  const seenTeams = {};
  (fixtures || []).forEach(function (fixture) {
    const home = fixture && fixture[0];
    const away = fixture && fixture[1];
    if (!home || !away) {
      throw rightEdgeTuesdayValidationError_('fixture is missing a team identity');
    }
    if (home === away) {
      throw rightEdgeTuesdayValidationError_('fixture lists the same team on both sides: ' + home);
    }
    [home, away].forEach(function (team) {
      if (seenTeams[team]) {
        throw rightEdgeTuesdayValidationError_('team appears in more than one fixture this round: ' + team);
      }
      seenTeams[team] = true;
    });
  });
}

function parseRightEdgeNrlMetric_(payload, expectedTitle) {
  const averageStats = payload && payload.averageStats;
  const leaders = averageStats && averageStats.leaders;
  if (!averageStats || averageStats.title !== expectedTitle || !Array.isArray(leaders) || leaders.length !== 17) {
    throw rightEdgeTuesdayValidationError_(expectedTitle + ' must contain exactly 17 official NRL team averages');
  }

  const values = {};
  leaders.forEach(function (leader) {
    const team = normalizeRightEdgeNrlTeam_(leader && leader.teamName);
    const value = parseRightEdgeStrictNumber_(leader && leader.value, expectedTitle + ' value for ' + team);
    const played = parseRightEdgeStrictNumber_(leader && leader.played, expectedTitle + ' games played for ' + team);
    if (!Number.isInteger(played) || played <= 0 || values[team] !== undefined) {
      throw rightEdgeTuesdayValidationError_('malformed or duplicate ' + expectedTitle + ' value for ' + team);
    }
    values[team] = value;
  });

  if (Object.keys(values).length !== 17) {
    throw rightEdgeTuesdayValidationError_(expectedTitle + ' team identities are incomplete');
  }
  return values;
}

function aggregateRightEdgeRuckAverages_(fixtures, payloads) {
  const completeFixtures = (fixtures || []).filter(function (fixture) {
    return fixture && fixture.matchStatus === 'complete';
  });
  if (!completeFixtures.length) {
    throw rightEdgeTuesdayValidationError_('Champion Data has no completed matches to aggregate');
  }

  const teamBySquadId = {};
  const sums = {};
  const games = {};

  completeFixtures.forEach(function (fixture) {
    const matchId = String(fixture.matchId);
    const payload = payloads && payloads[matchId];
    const matchStats = payload && payload.matchStats;
    const matchInfo = matchStats && matchStats.matchInfo;
    const teamStats = matchStats && matchStats.teamStats && matchStats.teamStats.team;
    if (!matchInfo || Number(matchInfo.matchId) !== Number(fixture.matchId) ||
        matchInfo.matchStatus !== 'complete' || !Array.isArray(teamStats) || teamStats.length !== 2) {
      throw rightEdgeTuesdayValidationError_('missing or malformed Champion Data match payload: ' + matchId);
    }

    teamBySquadId[String(fixture.homeSquadId)] = normalizeRightEdgeNrlTeam_(fixture.homeSquadName);
    teamBySquadId[String(fixture.awaySquadId)] = normalizeRightEdgeNrlTeam_(fixture.awaySquadName);
    const expectedSquads = [String(fixture.homeSquadId), String(fixture.awaySquadId)].sort();
    const actualSquads = teamStats.map(function (team) { return String(team.squadId); }).sort();
    if (JSON.stringify(actualSquads) !== JSON.stringify(expectedSquads)) {
      throw rightEdgeTuesdayValidationError_('Champion Data team identity mismatch for match ' + matchId);
    }

    teamStats.forEach(function (teamStatsRow) {
      const squadId = String(teamStatsRow.squadId);
      const team = teamBySquadId[squadId];
      if (!team) {
        throw rightEdgeTuesdayValidationError_('unmapped Champion Data squad for match ' + matchId);
      }
      const value = parseRightEdgeStrictNumber_(teamStatsRow.setRestartsRuck, 'ruck infringement value for match ' + matchId);
      if (value < 0) {
        throw rightEdgeTuesdayValidationError_('malformed ruck infringement value for match ' + matchId);
      }
      sums[team] = (sums[team] || 0) + value;
      games[team] = (games[team] || 0) + 1;
    });
  });

  if (Object.keys(games).length !== 17) {
    throw rightEdgeTuesdayValidationError_('Champion Data ruck aggregation must contain all 17 teams');
  }

  const averages = {};
  Object.keys(games).forEach(function (team) {
    averages[team] = Math.round((sums[team] / games[team]) * 100) / 100;
  });
  return averages;
}

function rightEdgePositionKey_(team, player) {
  return (String(team || '') + '|' + String(player || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildRightEdgePositionLookup_(fixtures, payloads, sheetRows) {
  const positions = {};
  (sheetRows || []).slice().sort(function (left, right) {
    return Number(left && left[0] || 0) - Number(right && right[0] || 0);
  }).forEach(function (row) {
    const player = String(row && row[2] || '').trim();
    const position = String(row && row[4] || '').trim();
    if (!player || !position) return;
    const team = normalizeRightEdgeNrlTeam_(row[3]);
    positions[rightEdgePositionKey_(team, player)] = position;
  });

  (fixtures || []).filter(function (fixture) {
    return fixture && fixture.matchStatus === 'complete';
  }).slice().sort(function (left, right) {
    return Number(left.roundNumber || 0) - Number(right.roundNumber || 0) ||
      Number(left.matchId || 0) - Number(right.matchId || 0);
  }).forEach(function (fixture) {
    const payload = payloads && payloads[String(fixture.matchId)];
    const matchStats = payload && payload.matchStats;
    const rawInfo = matchStats && matchStats.playerInfo && matchStats.playerInfo.player;
    const rawStats = matchStats && matchStats.playerStats && matchStats.playerStats.player;
    const playerInfo = Array.isArray(rawInfo) ? rawInfo : (rawInfo ? [rawInfo] : []);
    const playerStats = Array.isArray(rawStats) ? rawStats : (rawStats ? [rawStats] : []);
    const infoById = {};
    playerInfo.forEach(function (player) { infoById[String(player.playerId)] = player; });
    const teamBySquad = {};
    teamBySquad[String(fixture.homeSquadId)] = normalizeRightEdgeNrlTeam_(fixture.homeSquadName);
    teamBySquad[String(fixture.awaySquadId)] = normalizeRightEdgeNrlTeam_(fixture.awaySquadName);

    playerStats.forEach(function (stats) {
      const info = infoById[String(stats.playerId)];
      const team = teamBySquad[String(stats.squadId)];
      const player = info && (String(info.firstname || '').trim() + ' ' + String(info.surname || '').trim()).trim();
      const position = String(stats.position || '').trim();
      if (team && player && position) {
        positions[rightEdgePositionKey_(team, player)] = position;
      }
    });
  });

  return positions;
}

function parseRightEdgeStatsInsiderMatch_(payload, expectedMatchId, positionLookup) {
  const match = payload && payload.MatchData;
  const idParts = /^NRL_(\d{4})_(\d+)_([A-Z]{3})_([A-Z]{3})$/.exec(String(expectedMatchId || ''));
  if (!match || !idParts || match.SIMatchID !== expectedMatchId ||
      Number(match.Season) !== Number(idParts[1]) || Number(match.RoundNumber) !== Number(idParts[2])) {
    throw rightEdgeTuesdayValidationError_('Stats Insider match identity mismatch: ' + expectedMatchId);
  }

  const home = normalizeRightEdgeNrlTeam_(match.HomeTeam && (match.HomeTeam.Market || match.HomeTeam.DisplayName));
  const away = normalizeRightEdgeNrlTeam_(match.AwayTeam && (match.AwayTeam.Market || match.AwayTeam.DisplayName));
  if (home === away) {
    throw rightEdgeTuesdayValidationError_('Stats Insider fixture has duplicate teams: ' + expectedMatchId);
  }

  const playerProps = payload.PreData && payload.PreData.playerPropsData;
  const homePlayers = playerProps && playerProps.home;
  const awayPlayers = playerProps && playerProps.away;
  if (!Array.isArray(homePlayers) || homePlayers.length !== 17 ||
      !Array.isArray(awayPlayers) || awayPlayers.length !== 17) {
    throw rightEdgeTuesdayValidationError_('Stats Insider match must contain exactly 17 home and 17 away players: ' + expectedMatchId);
  }

  const seenPlayers = {};
  const scorerRows = [];
  const matchLabel = home + ' v ' + away;
  [[home, homePlayers], [away, awayPlayers]].forEach(function (teamAndPlayers) {
    const team = teamAndPlayers[0];
    teamAndPlayers[1].forEach(function (player) {
      const firstName = String(player && player.first_name || '').trim();
      const lastName = String(player && player.last_name || '').trim();
      const fullName = (firstName + ' ' + lastName).replace(/\s+/g, ' ').trim();
      const probability = Number(player && player.anytimeTry);
      const lookupKey = rightEdgePositionKey_(team, fullName);
      const position = String(positionLookup && positionLookup[lookupKey] || '').trim();
      if (!firstName || !lastName || !Number.isFinite(probability) || probability <= 0 || probability >= 1 ||
          seenPlayers[lookupKey] || !position) {
        throw rightEdgeTuesdayValidationError_('malformed, duplicate, or unmapped Stats Insider player: ' + team + ' / ' + fullName);
      }
      seenPlayers[lookupKey] = true;
      scorerRows.push([
        Number(match.RoundNumber),
        sanitizeRightEdgeSheetText_(matchLabel),
        sanitizeRightEdgeSheetText_(fullName),
        sanitizeRightEdgeSheetText_(team),
        sanitizeRightEdgeSheetText_(position),
        probability,
      ]);
    });
  });

  return { fixture: [home, away], scorerRows: scorerRows };
}

function parseRightEdgeStatsInsiderSchedule_(html, season, roundNumber, expectedMatchCount) {
  const expected = Number(expectedMatchCount);
  if (!Number.isInteger(expected) || expected < 1 || expected > 8) {
    throw rightEdgeTuesdayValidationError_('authoritative round match count must be between 1 and 8');
  }
  const pattern = new RegExp(
    '/sport-hub/nrl/schedule/(' + Number(season) + '_' + Number(roundNumber) + '_[a-z]{3}_[a-z]{3})',
    'gi'
  );
  const matchIds = [];
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const matchId = 'NRL_' + match[1].toUpperCase();
    if (matchIds.indexOf(matchId) === -1) matchIds.push(matchId);
  }
  if (matchIds.length !== expected) {
    throw rightEdgeTuesdayValidationError_(
      'Stats Insider round ' + roundNumber + ' must contain exactly ' + expected + ' matches; found ' + matchIds.length
    );
  }
  return matchIds;
}

function validateRightEdgeUpcomingFixtures_(fixtures, statsMatches) {
  if (!Array.isArray(fixtures) || !fixtures.length || !Array.isArray(statsMatches) ||
      fixtures.length !== statsMatches.length) {
    throw rightEdgeTuesdayValidationError_('upcoming fixture counts disagree');
  }
  const fixtureRows = fixtures.map(function (fixture) {
    return [
      normalizeRightEdgeNrlTeam_(fixture && fixture.homeSquadName),
      normalizeRightEdgeNrlTeam_(fixture && fixture.awaySquadName),
    ];
  });
  const championKeys = fixtureRows.map(function (fixture) { return fixture.join('|'); }).sort();
  const statsKeys = statsMatches.map(function (match) {
    if (!match || !Array.isArray(match.fixture) || match.fixture.length !== 2) {
      throw rightEdgeTuesdayValidationError_('Stats Insider fixture is malformed');
    }
    return [normalizeRightEdgeNrlTeam_(match.fixture[0]), normalizeRightEdgeNrlTeam_(match.fixture[1])].join('|');
  }).sort();
  if (new Set(championKeys).size !== championKeys.length || new Set(statsKeys).size !== statsKeys.length ||
      JSON.stringify(championKeys) !== JSON.stringify(statsKeys)) {
    throw rightEdgeTuesdayValidationError_('Stats Insider fixtures disagree with the authoritative round draw');
  }
  return fixtureRows;
}

function buildRightEdgeAdvancedRows_(teamOrder, metrics) {
  const teams = (teamOrder || []).map(function (team) { return normalizeRightEdgeNrlTeam_(team); });
  const uniqueTeams = Array.from(new Set(teams)).sort();
  const expectedTeams = RIGHTEDGE_TUESDAY_EXPECTED_TEAMS.slice().sort();
  if (teams.length !== 17 || JSON.stringify(uniqueTeams) !== JSON.stringify(expectedTeams)) {
    throw rightEdgeTuesdayValidationError_('advanced data Sheet must contain each of the 17 teams exactly once');
  }

  const metricNames = [
    'postContactMetres',
    'lineBreaks',
    'tackleBreaks',
    'missedTackles',
    'ruckInfringements',
  ];
  return teams.map(function (team) {
    const row = [team];
    metricNames.forEach(function (metricName) {
      const metric = metrics && metrics[metricName];
      const value = metric && metric[team];
      if (!metric || Object.keys(metric).length !== 17 || !Number.isFinite(value)) {
        throw rightEdgeTuesdayValidationError_('missing or malformed ' + metricName + ' value for ' + team);
      }
      row.push(value);
    });
    return row;
  });
}

function validateRightEdgeSourceAlignment_(ladderRows, fixtures, metricPayloads) {
  if (!Array.isArray(ladderRows) || ladderRows.length !== 17 ||
      !Array.isArray(metricPayloads) || metricPayloads.length !== 4) {
    throw rightEdgeTuesdayValidationError_('source alignment inputs are incomplete');
  }

  const ladderGames = {};
  ladderRows.forEach(function (row) {
    const team = normalizeRightEdgeNrlTeam_(row && row[1]);
    const played = Number(row && row[16]);
    if (!Number.isInteger(played) || played < 0 || ladderGames[team] !== undefined) {
      throw rightEdgeTuesdayValidationError_('malformed ladder games played for ' + team);
    }
    ladderGames[team] = played;
  });

  const fixtureGames = {};
  (fixtures || []).filter(function (fixture) {
    return fixture && fixture.matchStatus === 'complete';
  }).forEach(function (fixture) {
    [fixture.homeSquadName, fixture.awaySquadName].forEach(function (teamName) {
      const team = normalizeRightEdgeNrlTeam_(teamName);
      fixtureGames[team] = (fixtureGames[team] || 0) + 1;
    });
  });

  RIGHTEDGE_TUESDAY_EXPECTED_TEAMS.forEach(function (team) {
    if (fixtureGames[team] !== ladderGames[team]) {
      throw rightEdgeTuesdayValidationError_('games played disagree for ' + team);
    }
  });

  metricPayloads.forEach(function (payload) {
    const averageStats = payload && payload.averageStats;
    const leaders = averageStats && averageStats.leaders;
    if (!Array.isArray(leaders) || leaders.length !== 17) {
      throw rightEdgeTuesdayValidationError_('official NRL metric is incomplete');
    }
    const seen = {};
    leaders.forEach(function (leader) {
      const team = normalizeRightEdgeNrlTeam_(leader && leader.teamName);
      const played = Number(leader && leader.played);
      if (!Number.isInteger(played) || played !== ladderGames[team] || seen[team]) {
        throw rightEdgeTuesdayValidationError_('official NRL metric games played disagree for ' + team);
      }
      seen[team] = true;
    });
  });
}

function rightEdgeColumnLabel_(column) {
  let value = Number(column);
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function buildRightEdgeDiffRows_(sheetName, startRow, startColumn, before, after) {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
    throw rightEdgeTuesdayValidationError_('preview ranges must have equal row counts');
  }
  const changes = [];
  after.forEach(function (afterRow, rowOffset) {
    const beforeRow = before[rowOffset];
    if (!Array.isArray(beforeRow) || !Array.isArray(afterRow) || beforeRow.length !== afterRow.length) {
      throw rightEdgeTuesdayValidationError_('preview ranges must have equal column counts');
    }
    afterRow.forEach(function (afterValue, columnOffset) {
      const beforeValue = beforeRow[columnOffset];
      if (Object.is(beforeValue, afterValue)) return;
      changes.push([
        sheetName,
        rightEdgeColumnLabel_(Number(startColumn) + columnOffset) + (Number(startRow) + rowOffset),
        beforeValue,
        afterValue,
      ]);
    });
  });
  return changes;
}

function normalizeRightEdgePlanRange_(key, range) {
  if (!range || !range.sheet || !Number.isInteger(range.startRow) || !Number.isInteger(range.startColumn) ||
      !Array.isArray(range.before) || !Array.isArray(range.after)) {
    throw rightEdgeTuesdayValidationError_('malformed ' + key + ' plan range');
  }
  const rowCount = Math.max(range.before.length, range.after.length);
  const firstRow = range.before[0] || range.after[0];
  const columnCount = firstRow && firstRow.length;
  if (!rowCount || !columnCount) {
    throw rightEdgeTuesdayValidationError_('empty ' + key + ' plan range');
  }
  function padRows(rows) {
    const result = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      if (row.length && row.length !== columnCount) {
        throw rightEdgeTuesdayValidationError_('inconsistent ' + key + ' plan range width');
      }
      const padded = [];
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        padded.push(row[columnIndex] === undefined ? '' : row[columnIndex]);
      }
      result.push(padded);
    }
    return result;
  }
  return {
    key: key,
    sheet: range.sheet,
    startRow: range.startRow,
    startColumn: range.startColumn,
    before: padRows(range.before),
    after: padRows(range.after),
  };
}

function buildRightEdgeTuesdayPlan_(input) {
  if (!input || !Number.isInteger(input.season) || !Number.isInteger(input.roundNumber) ||
      !String(input.sourceHash || '').trim() || !String(input.createdAt || '').trim()) {
    throw rightEdgeTuesdayValidationError_('plan identity metadata is incomplete');
  }
  const ranges = [
    normalizeRightEdgePlanRange_('season', input.seasonRange),
    normalizeRightEdgePlanRange_('advanced', input.advancedRange),
    normalizeRightEdgePlanRange_('fixtures', input.fixtureRange),
    normalizeRightEdgePlanRange_('scorers', input.scorerRange),
  ];
  const changes = [];
  ranges.forEach(function (range) {
    Array.prototype.push.apply(changes, buildRightEdgeDiffRows_(
      range.sheet,
      range.startRow,
      range.startColumn,
      range.before,
      range.after
    ));
  });
  const plan = {
    id: computeRightEdgePlanId_(ranges),
    season: input.season,
    roundNumber: input.roundNumber,
    sourceHash: input.sourceHash,
    createdAt: input.createdAt,
    ranges: ranges,
    changes: changes,
  };
  assertRightEdgePlanShape_(plan);
  assertRightEdgePlanIntegrity_(plan);
  return plan;
}

function collectRightEdgeTuesdayPlan_(services) {
  const bundle = services.getSourceBundle();
  const season = Number(bundle && bundle.season);
  if (!Number.isInteger(season)) {
    throw rightEdgeTuesdayValidationError_('source season is missing');
  }

  const ladderRows = parseRightEdgeRlpLadder_(bundle.rlpHtml);
  const metricPayloads = bundle.metricPayloads;
  const championFixtures = bundle.championFixtures;
  const championMatchPayloads = bundle.championMatchPayloads;
  validateRightEdgeSourceAlignment_(ladderRows, championFixtures, metricPayloads);

  const completeRounds = championFixtures.filter(function (fixture) {
    return fixture && fixture.matchStatus === 'complete';
  }).map(function (fixture) { return Number(fixture.roundNumber); });
  const roundNumber = Math.max.apply(null, completeRounds) + 1;
  if (!Number.isInteger(roundNumber)) {
    throw rightEdgeTuesdayValidationError_('unable to determine the next NRL round');
  }
  const upcomingFixtures = championFixtures.filter(function (fixture) {
    return Number(fixture && fixture.roundNumber) === roundNumber;
  });
  if (!upcomingFixtures.length || upcomingFixtures.length > 8) {
    throw rightEdgeTuesdayValidationError_('authoritative upcoming round fixture is missing or malformed');
  }

  const statsMatchIds = parseRightEdgeStatsInsiderSchedule_(
    bundle.statsScheduleHtml,
    season,
    roundNumber,
    upcomingFixtures.length
  );
  const snapshot = services.getSheetSnapshot({
    season: season,
    roundNumber: roundNumber,
    fixtureCount: upcomingFixtures.length,
    statsMatchCount: statsMatchIds.length,
  });
  const positions = buildRightEdgePositionLookup_(
    championFixtures,
    championMatchPayloads,
    snapshot.scorerHistory
  );
  const statsMatches = statsMatchIds.map(function (matchId) {
    return parseRightEdgeStatsInsiderMatch_(bundle.statsMatchPayloads[matchId], matchId, positions);
  });
  const fixtureRows = validateRightEdgeUpcomingFixtures_(upcomingFixtures, statsMatches);
  assertRightEdgeFixtureIntegrity_(fixtureRows);
  const scorerRows = [];
  statsMatches.forEach(function (match) {
    Array.prototype.push.apply(scorerRows, match.scorerRows);
  });

  const metrics = {
    postContactMetres: parseRightEdgeNrlMetric_(metricPayloads[0], 'Post Contact Metres'),
    lineBreaks: parseRightEdgeNrlMetric_(metricPayloads[1], 'Linebreaks'),
    tackleBreaks: parseRightEdgeNrlMetric_(metricPayloads[2], 'Tackle Breaks'),
    missedTackles: parseRightEdgeNrlMetric_(metricPayloads[3], 'Missed Tackles'),
    ruckInfringements: aggregateRightEdgeRuckAverages_(championFixtures, championMatchPayloads),
  };
  const advancedRows = buildRightEdgeAdvancedRows_(snapshot.advancedTeamOrder, metrics);
  const sourceHash = services.computeHash({
    season: season,
    roundNumber: roundNumber,
    ladderRows: ladderRows,
    advancedRows: advancedRows,
    fixtureRows: fixtureRows,
    scorerRows: scorerRows,
  });

  return buildRightEdgeTuesdayPlan_({
    season: season,
    roundNumber: roundNumber,
    sourceHash: sourceHash,
    createdAt: services.nowIso(),
    seasonRange: {
      sheet: season + ' Data Sheet', startRow: 4, startColumn: 1,
      before: snapshot.seasonBefore, after: ladderRows,
    },
    advancedRange: {
      sheet: season + ' Advanced Data Sheet', startRow: 2, startColumn: 1,
      before: snapshot.advancedBefore, after: advancedRows,
    },
    fixtureRange: {
      sheet: 'Match Predictions', startRow: 2, startColumn: 1,
      before: snapshot.fixtureBefore, after: fixtureRows,
    },
    scorerRange: {
      sheet: RIGHTEDGE_TUESDAY_SCORER_SHEET, startRow: snapshot.scorerStartRow, startColumn: 1,
      before: snapshot.scorerBefore, after: scorerRows,
    },
  });
}

function runRightEdgeTuesdayWorkflow_(services) {
  const plan = services.collectPlan();
  services.savePreview(plan);
  if (Number(services.approvedRuns()) < 2) {
    return { status: 'Awaiting Approval', planId: plan.id };
  }
  const result = services.applyPlan(plan);
  return { status: result && result.skipped ? 'Already Applied' : 'Applied', planId: plan.id };
}

function assertRightEdgePlanBeforeUnchanged_(plan, readRange) {
  if (!plan || !Array.isArray(plan.ranges)) {
    throw rightEdgeTuesdayValidationError_('pending plan is malformed');
  }
  plan.ranges.forEach(function (range) {
    const current = readRange(range);
    if (JSON.stringify(current) !== JSON.stringify(range.before)) {
      throw rightEdgeTuesdayValidationError_('live input cells changed after preview for ' + range.key);
    }
  });
}

function assertRightEdgeCanonicalSyncResult_(result) {
  if (!result || !result.pinnacleResult || result.pinnacleResult.skipped) {
    const reason = result && result.pinnacleResult && result.pinnacleResult.reason;
    throw rightEdgeTuesdayValidationError_('Pinnacle odds did not complete' + (reason ? ': ' + reason : ''));
  }
}

const RIGHTEDGE_TUESDAY_CANONICAL_RANGES = [
  { key: 'season', sheet: '2026 Data Sheet', startRow: 4, startColumn: 1, width: 27 },
  { key: 'advanced', sheet: '2026 Advanced Data Sheet', startRow: 2, startColumn: 1, width: 6 },
  { key: 'fixtures', sheet: 'Match Predictions', startRow: 2, startColumn: 1, width: 2 },
  // The scorer block appends beneath previous rounds, so its start row is
  // validated as "row 2 or below" rather than pinned to a fixed row.
  { key: 'scorers', sheet: RIGHTEDGE_TUESDAY_SCORER_SHEET, startRow: null, startColumn: 1, width: 6 },
];

function assertRightEdgePlanShape_(plan) {
  if (!plan || !Array.isArray(plan.ranges) || plan.ranges.length !== RIGHTEDGE_TUESDAY_CANONICAL_RANGES.length) {
    throw rightEdgeTuesdayValidationError_('automation plan ranges are incomplete or out of order');
  }
  RIGHTEDGE_TUESDAY_CANONICAL_RANGES.forEach(function (expected, index) {
    const range = plan.ranges[index];
    if (!range || range.key !== expected.key || range.sheet !== expected.sheet ||
        range.startColumn !== expected.startColumn) {
      throw rightEdgeTuesdayValidationError_('automation plan does not match the canonical ' + expected.key + ' destination');
    }
    if (expected.startRow === null
      ? !Number.isInteger(range.startRow) || range.startRow < 2
      : range.startRow !== expected.startRow) {
      throw rightEdgeTuesdayValidationError_('automation plan does not match the canonical ' + expected.key + ' destination');
    }
    if (!Array.isArray(range.after) || !range.after.length || !Array.isArray(range.before) ||
        range.before.length !== range.after.length) {
      throw rightEdgeTuesdayValidationError_('automation plan contains a malformed ' + expected.key + ' range');
    }
    range.after.forEach(function (row) {
      if (!Array.isArray(row) || row.length !== expected.width) {
        throw rightEdgeTuesdayValidationError_('automation plan ' + expected.key + ' width must be exactly ' + expected.width);
      }
    });
    range.before.forEach(function (row) {
      if (!Array.isArray(row) || row.length !== expected.width) {
        throw rightEdgeTuesdayValidationError_('automation plan ' + expected.key + ' width must be exactly ' + expected.width);
      }
    });
  });
}

function computeRightEdgePlanId_(ranges) {
  // Cryptographic binding: a tampered plan cannot be brute-forced back onto its
  // approved id the way a 32-bit fold allowed.
  return 'plan-' + rightEdgeSha256Hex_(JSON.stringify(ranges));
}

function assertRightEdgePlanIntegrity_(plan) {
  if (!plan || !plan.id || !Array.isArray(plan.ranges)) {
    throw rightEdgeTuesdayValidationError_('pending plan is malformed');
  }
  if (plan.id !== computeRightEdgePlanId_(plan.ranges)) {
    throw rightEdgeTuesdayValidationError_('pending plan contents no longer match its approved plan ID');
  }
}

function applyRightEdgeTuesdayPlan_(plan, services) {
  if (!plan || !plan.id || !Array.isArray(plan.ranges)) {
    throw rightEdgeTuesdayValidationError_('automation plan is malformed');
  }
  if (services.hasApplied(plan.id)) {
    return { skipped: true };
  }
  assertRightEdgePlanShape_(plan);
  assertRightEdgePlanIntegrity_(plan);

  const written = [];
  try {
    plan.ranges.forEach(function (range) {
      // Record the range BEFORE attempting the write. writeRange mutates the
      // block before it verifies, so a range that fails part-way through must
      // still be rolled back.
      written.push(range);
      services.writeRange(range);
    });
  } catch (error) {
    // Roll every already-written range back to its exact previewed before-values
    // so a mid-write failure cannot leave a half-updated Sheet.
    // Every range is attempted even if one rollback fails, so a single bad
    // range cannot strand the others in a half-written state.
    const rollbackFailures = [];
    written.reverse().forEach(function (range) {
      try {
        services.writeRange({
          key: range.key,
          sheet: range.sheet,
          startRow: range.startRow,
          startColumn: range.startColumn,
          before: range.after,
          after: range.before,
        });
      } catch (rollbackError) {
        rollbackFailures.push(range.key + ' (' + rollbackError.message + ')');
      }
    });
    if (rollbackFailures.length) {
      throw rightEdgeTuesdayValidationError_(
        'write failed and rollback could not restore: ' + rollbackFailures.join('; ')
          + ' — original error: ' + error.message
      );
    }
    throw error;
  }
  if (!services.hasMatchModelRun(plan.id)) {
    services.syncMatchOdds();
    services.markMatchModelRun(plan.id);
  }
  if (!services.hasScorerOddsRun(plan.id)) {
    services.syncTryScorerOdds();
    services.markScorerOddsRun(plan.id);
  }
  services.verify(plan);
  services.markApplied(plan.id);
  return { skipped: false };
}

const RIGHTEDGE_TUESDAY_SEASON = 2026;
const RIGHTEDGE_TUESDAY_COMPETITION_ID = 12999;
const RIGHTEDGE_TUESDAY_TIMEZONE = 'Australia/Sydney';
const RIGHTEDGE_TUESDAY_PREVIEW_SHEET = 'Tuesday Automation Preview';
const RIGHTEDGE_TUESDAY_PENDING_SHEET = 'Tuesday Automation Pending';
const RIGHTEDGE_TUESDAY_APPROVED_RUNS_KEY = 'RIGHTEDGE_TUESDAY_APPROVED_RUNS';
const RIGHTEDGE_TUESDAY_LAST_PLAN_KEY = 'RIGHTEDGE_TUESDAY_LAST_APPLIED_PLAN';
const RIGHTEDGE_TUESDAY_MATCH_MODEL_PLAN_KEY = 'RIGHTEDGE_TUESDAY_MATCH_MODEL_COMPLETED_PLAN';
const RIGHTEDGE_TUESDAY_SCORER_ODDS_PLAN_KEY = 'RIGHTEDGE_TUESDAY_SCORER_ODDS_COMPLETED_PLAN';
const RIGHTEDGE_TUESDAY_LAST_VERIFICATION_KEY = 'RIGHTEDGE_TUESDAY_LAST_VERIFICATION';

function fetchRightEdgeText_(url) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Accept: 'text/html,application/json' },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw rightEdgeTuesdayValidationError_('source request failed (' + code + '): ' + url);
  }
  return response.getContentText();
}

function fetchRightEdgeJson_(url) {
  const text = fetchRightEdgeText_(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw rightEdgeTuesdayValidationError_('source returned malformed JSON: ' + url);
  }
}

function fetchRightEdgeNrlJsonText_(url) {
  // NRL's data route answers with a sign-in interstitial whenever the request
  // advertises text/html. Ask for JSON only so the stats payload is returned.
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw rightEdgeTuesdayValidationError_('official NRL request failed (' + code + '): ' + url);
  }
  return response.getContentText();
}

function fetchRightEdgeNrlMetric_(season, spec, fetchJsonText, fetchText) {
  const jsonUrl = 'https://www.nrl.com/stats/teams/data?competition=111&season=' + season + '&stat=' + spec.id;
  try {
    const payload = parseRightEdgeNrlPayload_(fetchJsonText(jsonUrl));
    parseRightEdgeNrlMetric_(payload, spec.title);
    return payload;
  } catch (primaryError) {
    const pageUrl = 'https://www.rabbitohs.com.au/stats/teams/?competition=111&season=' + season + '&stat=' + spec.id;
    try {
      const payload = parseRightEdgeNrlPayload_(fetchText(pageUrl));
      parseRightEdgeNrlMetric_(payload, spec.title);
      return payload;
    } catch (fallbackError) {
      throw rightEdgeTuesdayValidationError_(
        'official NRL metric is unavailable: ' + spec.title + ' (' + primaryError.message + ')'
      );
    }
  }
}

function fetchRightEdgeJsonMap_(entries) {
  const result = {};
  for (let offset = 0; offset < entries.length; offset += 50) {
    const chunk = entries.slice(offset, offset + 50);
    const responses = UrlFetchApp.fetchAll(chunk.map(function (entry) {
      return {
        url: entry.url,
        method: 'get',
        headers: { Accept: 'application/json' },
        muteHttpExceptions: true,
      };
    }));
    responses.forEach(function (response, index) {
      const entry = chunk[index];
      const code = response.getResponseCode();
      if (code < 200 || code >= 300) {
        throw rightEdgeTuesdayValidationError_('source request failed (' + code + '): ' + entry.url);
      }
      try {
        result[entry.key] = JSON.parse(response.getContentText());
      } catch (error) {
        throw rightEdgeTuesdayValidationError_('source returned malformed JSON: ' + entry.url);
      }
    });
  }
  return result;
}

function getRightEdgeSourceBundle_() {
  const season = RIGHTEDGE_TUESDAY_SEASON;
  const rlpUrl = 'https://www.rugbyleagueproject.org/seasons/nrl-' + season + '/summary.html';
  const metricSpecs = [
    { id: 1000112, title: 'Post Contact Metres' },
    { id: 30, title: 'Linebreaks' },
    { id: 29, title: 'Tackle Breaks' },
    { id: 4, title: 'Missed Tackles' },
  ];
  const metricPayloads = metricSpecs.map(function (spec) {
    return fetchRightEdgeNrlMetric_(season, spec, fetchRightEdgeNrlJsonText_, fetchRightEdgeText_);
  });
  const championBase = 'https://mc.championdata.com/data/' + RIGHTEDGE_TUESDAY_COMPETITION_ID;
  const championFixturePayload = fetchRightEdgeJson_(championBase + '/fixture.json');
  const championFixtures = championFixturePayload && championFixturePayload.fixture && championFixturePayload.fixture.match;
  if (!Array.isArray(championFixtures)) {
    throw rightEdgeTuesdayValidationError_('Champion Data fixture is missing');
  }
  const completeFixtures = championFixtures.filter(function (fixture) {
    return fixture && fixture.matchStatus === 'complete';
  });
  const championMatchPayloads = fetchRightEdgeJsonMap_(completeFixtures.map(function (fixture) {
    return { key: String(fixture.matchId), url: championBase + '/' + fixture.matchId + '.json' };
  }));
  const completeRounds = completeFixtures.map(function (fixture) { return Number(fixture.roundNumber); });
  const roundNumber = Math.max.apply(null, completeRounds) + 1;
  const upcomingFixtures = championFixtures.filter(function (fixture) {
    return Number(fixture && fixture.roundNumber) === roundNumber;
  });
  if (!upcomingFixtures.length || upcomingFixtures.length > 8) {
    throw rightEdgeTuesdayValidationError_('authoritative upcoming round fixture is missing or malformed');
  }

  const statsScheduleUrl = 'https://www.statsinsider.com.au/sport-hub/nrl/schedule';
  const statsScheduleHtml = fetchRightEdgeText_(statsScheduleUrl);
  const statsMatchIds = parseRightEdgeStatsInsiderSchedule_(
    statsScheduleHtml,
    season,
    roundNumber,
    upcomingFixtures.length
  );
  const statsMatchPayloads = fetchRightEdgeJsonMap_(statsMatchIds.map(function (matchId) {
    return { key: matchId, url: 'https://levy-edge.statsinsider.com.au/pre/' + matchId };
  }));

  return {
    season: season,
    rlpHtml: fetchRightEdgeText_(rlpUrl),
    metricPayloads: metricPayloads,
    championFixtures: championFixtures,
    championMatchPayloads: championMatchPayloads,
    statsScheduleHtml: statsScheduleHtml,
    statsMatchPayloads: statsMatchPayloads,
  };
}

function getRequiredRightEdgeSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw rightEdgeTuesdayValidationError_('required Sheet tab is missing: ' + name);
  return sheet;
}

function blankRightEdgeRows_(rowCount, columnCount) {
  return Array.from({ length: rowCount }, function () {
    return Array.from({ length: columnCount }, function () { return ''; });
  });
}

function getRightEdgeSheetSnapshot_(context) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const seasonSheet = getRequiredRightEdgeSheet_(spreadsheet, context.season + ' Data Sheet');
  const advancedSheet = getRequiredRightEdgeSheet_(spreadsheet, context.season + ' Advanced Data Sheet');
  const predictionSheet = getRequiredRightEdgeSheet_(spreadsheet, 'Match Predictions');
  // Must be the same tab the plan writes to, otherwise the approval-time
  // before-values check compares against a completely different sheet.
  const scorerSheet = getRequiredRightEdgeSheet_(spreadsheet, RIGHTEDGE_TUESDAY_SCORER_SHEET);

  const seasonBefore = seasonSheet.getRange(4, 1, 17, 27).getValues();
  const advancedBefore = advancedSheet.getRange(2, 1, 17, 6).getValues();
  const advancedTeamOrder = advancedBefore.map(function (row) { return row[0]; });
  const fixtureRowCount = Math.max(context.fixtureCount, Math.max(1, predictionSheet.getLastRow() - 1));
  const fixtureBefore = predictionSheet.getRange(2, 1, fixtureRowCount, 2).getValues();

  const scorerLastRow = Math.max(1, scorerSheet.getLastRow());
  const scorerHistory = scorerLastRow > 1
    ? scorerSheet.getRange(2, 1, scorerLastRow - 1, 5).getValues()
    : [];
  const targetIndexes = [];
  scorerHistory.forEach(function (row, index) {
    if (Number(row[0]) === Number(context.roundNumber)) targetIndexes.push(index);
  });
  const expectedScorerRows = context.statsMatchCount * 34;
  let scorerStartRow;
  let scorerBefore;
  if (targetIndexes.length) {
    const contiguous = targetIndexes.every(function (index, position) {
      return index === targetIndexes[0] + position;
    });
    if (!contiguous || targetIndexes.length !== expectedScorerRows) {
      throw rightEdgeTuesdayValidationError_('existing target-round scorer rows are partial or non-contiguous');
    }
    scorerStartRow = targetIndexes[0] + 2;
    scorerBefore = scorerSheet.getRange(scorerStartRow, 1, expectedScorerRows, 6).getValues();
  } else {
    scorerStartRow = scorerLastRow + 1;
    scorerBefore = blankRightEdgeRows_(expectedScorerRows, 6);
  }

  return {
    seasonBefore: seasonBefore,
    advancedTeamOrder: advancedTeamOrder,
    advancedBefore: advancedBefore,
    fixtureBefore: fixtureBefore,
    scorerHistory: scorerHistory,
    scorerStartRow: scorerStartRow,
    scorerBefore: scorerBefore,
  };
}

function computeRightEdgeHash_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(value),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function saveRightEdgePendingPlan_(spreadsheet, plan) {
  let sheet = spreadsheet.getSheetByName(RIGHTEDGE_TUESDAY_PENDING_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RIGHTEDGE_TUESDAY_PENDING_SHEET);
  sheet.clearContents();
  const json = JSON.stringify(plan);
  const chunks = [];
  for (let offset = 0; offset < json.length; offset += 45000) chunks.push([json.slice(offset, offset + 45000)]);
  sheet.getRange(1, 1).setValue(plan.id);
  sheet.getRange(2, 1, chunks.length, 1).setValues(chunks);
  sheet.hideSheet();
}

function loadRightEdgePendingPlan_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getRequiredRightEdgeSheet_(spreadsheet, RIGHTEDGE_TUESDAY_PENDING_SHEET);
  if (sheet.getLastRow() < 2) throw rightEdgeTuesdayValidationError_('no pending Tuesday plan exists');
  const json = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (row) { return String(row[0] || ''); }).join('');
  try {
    return JSON.parse(json);
  } catch (error) {
    throw rightEdgeTuesdayValidationError_('pending Tuesday plan is malformed');
  }
}

function saveRightEdgeTuesdayPreview_(plan) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RIGHTEDGE_TUESDAY_PREVIEW_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RIGHTEDGE_TUESDAY_PREVIEW_SHEET);
  sheet.clearContents();
  const metadata = [
    ['Status', 'Awaiting Approval'],
    ['Plan ID', plan.id],
    ['Created', plan.createdAt],
    ['Season', plan.season],
    ['Round', plan.roundNumber],
    ['Changed cells', plan.changes.length],
    ['Sources', 'Rugby League Project; NRL.com; Champion Data; Stats Insider'],
    ['Execution', 'syncRightEdgeMatchOdds once (Match Odds → Pinnacle → updatePredictions), then scorer odds'],
  ];
  sheet.getRange(1, 1, metadata.length, 2).setValues(metadata);
  sheet.getRange(10, 1, 1, 4).setValues([['Sheet', 'Cell', 'Before', 'Proposed']]);
  if (plan.changes.length) sheet.getRange(11, 1, plan.changes.length, 4).setValues(plan.changes);
  sheet.setFrozenRows(10);
  sheet.autoResizeColumns(1, 4);
  saveRightEdgePendingPlan_(spreadsheet, plan);
}

function setRightEdgePreviewStatus_(status, detail) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RIGHTEDGE_TUESDAY_PREVIEW_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RIGHTEDGE_TUESDAY_PREVIEW_SHEET);
  sheet.getRange(1, 1, 2, 2).setValues([
    ['Status', status],
    ['Detail', String(detail || '')],
  ]);
}

function readRightEdgePlanRange_(range) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getRequiredRightEdgeSheet_(spreadsheet, range.sheet);
  return sheet.getRange(
    range.startRow,
    range.startColumn,
    range.before.length,
    range.before[0].length
  ).getValues();
}

function writeRightEdgePlanRange_(range) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getRequiredRightEdgeSheet_(spreadsheet, range.sheet);
  const rowCount = range.after.length;
  const columnCount = range.after[0].length;
  // Only ever clear the exact previewed block. Clearing wider than the preview
  // would destroy formulas and columns the approver never saw.
  sheet.getRange(range.startRow, range.startColumn, rowCount, columnCount).clearContent();
  const target = sheet.getRange(range.startRow, range.startColumn, rowCount, columnCount);
  target.setValues(range.after);
  if (range.key === 'scorers') {
    sheet.getRange(range.startRow, 5, rowCount, 1).setNumberFormat('0.0000');
    sheet.getRange(range.startRow, 6, rowCount, 1).setNumberFormat('0.00%');
  }
  if (JSON.stringify(target.getValues()) !== JSON.stringify(range.after)) {
    throw rightEdgeTuesdayValidationError_('Sheet write verification failed for ' + range.key);
  }
}

function applyRightEdgeRangeWithRollback_(range, write, rollback) {
  const restore = rollback || write;
  try {
    write(range);
  } catch (error) {
    // Put the exact previewed before-values back so a partial failure never
    // leaves the Sheet in a state nobody reviewed.
    try {
      restore({
        key: range.key,
        sheet: range.sheet,
        startRow: range.startRow,
        startColumn: range.startColumn,
        before: range.after,
        after: range.before,
      });
    } catch (rollbackError) {
      throw rightEdgeTuesdayValidationError_(
        'write failed for ' + range.key + ' and rollback also failed: ' + rollbackError.message
      );
    }
    throw error;
  }
}

function verifyRightEdgeTuesdayOutputs_(plan) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const fixtureRange = plan.ranges.filter(function (range) { return range.key === 'fixtures'; })[0];
  const scorerRange = plan.ranges.filter(function (range) { return range.key === 'scorers'; })[0];
  const fixtures = fixtureRange.after.filter(function (row) { return row[0] && row[1]; });
  const predictions = getRequiredRightEdgeSheet_(spreadsheet, 'Match Predictions')
    .getRange(2, 1, fixtures.length, 5).getValues();
  predictions.forEach(function (row, index) {
    if (row[0] !== fixtures[index][0] || row[1] !== fixtures[index][1] || !String(row[2] || '').trim() ||
        !Number.isFinite(Number(row[3])) || !Number.isFinite(Number(row[4]))) {
      throw rightEdgeTuesdayValidationError_('prediction output verification failed at fixture row ' + (index + 2));
    }
  });

  const scorerOutput = getRequiredRightEdgeSheet_(spreadsheet, RIGHTEDGE_TUESDAY_SCORER_SHEET)
    .getRange(scorerRange.startRow, 1, scorerRange.after.length, 10).getValues();
  let pricedRows = 0;
  let valueRows = 0;
  scorerOutput.forEach(function (row, index) {
    if (JSON.stringify(row.slice(0, 6)) !== JSON.stringify(scorerRange.after[index])) {
      throw rightEdgeTuesdayValidationError_('scorer input verification failed at row ' + (scorerRange.startRow + index));
    }
    const hasOdds = row[6] !== '' || row[7] !== '';
    if (!hasOdds) return;
    if (!Number.isFinite(Number(row[6])) || Number(row[6]) <= 1 || !String(row[7] || '').trim() ||
        !Number.isFinite(Number(row[8])) || typeof row[9] !== 'boolean') {
      throw rightEdgeTuesdayValidationError_('scorer value-play output is malformed at row ' + (scorerRange.startRow + index));
    }
    pricedRows += 1;
    if (row[9] === true) valueRows += 1;
  });
  if (!pricedRows) throw rightEdgeTuesdayValidationError_('scorer odds sync returned no priced players');
  PropertiesService.getDocumentProperties().setProperty(
    RIGHTEDGE_TUESDAY_LAST_VERIFICATION_KEY,
    JSON.stringify({ planId: plan.id, fixtures: fixtures.length, pricedRows: pricedRows, valueRows: valueRows })
  );
}

function createRightEdgeTuesdayRuntime_() {
  const properties = PropertiesService.getDocumentProperties();
  const collectionServices = {
    getSourceBundle: getRightEdgeSourceBundle_,
    getSheetSnapshot: getRightEdgeSheetSnapshot_,
    computeHash: computeRightEdgeHash_,
    nowIso: function () { return new Date().toISOString(); },
  };
  const applyServices = {
    hasApplied: function (planId) {
      return properties.getProperty(RIGHTEDGE_TUESDAY_LAST_PLAN_KEY) === planId;
    },
    hasMatchModelRun: function (planId) {
      return properties.getProperty(RIGHTEDGE_TUESDAY_MATCH_MODEL_PLAN_KEY) === planId;
    },
    hasScorerOddsRun: function (planId) {
      return properties.getProperty(RIGHTEDGE_TUESDAY_SCORER_ODDS_PLAN_KEY) === planId;
    },
    writeRange: writeRightEdgePlanRange_,
    syncMatchOdds: function () {
      if (typeof syncRightEdgeMatchOdds !== 'function') {
        throw rightEdgeTuesdayValidationError_('syncRightEdgeMatchOdds is not installed');
      }
      const result = syncRightEdgeMatchOdds({ requirePinnacle: true, requireMatchOdds: true });
      assertRightEdgeCanonicalSyncResult_(result);
    },
    syncTryScorerOdds: function () {
      if (typeof syncRightEdgeTryScorerOdds !== 'function') {
        throw rightEdgeTuesdayValidationError_('syncRightEdgeTryScorerOdds is not installed');
      }
      syncRightEdgeTryScorerOdds({ requirePrices: true });
    },
    markMatchModelRun: function (planId) {
      properties.setProperty(RIGHTEDGE_TUESDAY_MATCH_MODEL_PLAN_KEY, planId);
    },
    markScorerOddsRun: function (planId) {
      properties.setProperty(RIGHTEDGE_TUESDAY_SCORER_ODDS_PLAN_KEY, planId);
    },
    verify: verifyRightEdgeTuesdayOutputs_,
    markApplied: function (planId) {
      properties.setProperty(RIGHTEDGE_TUESDAY_LAST_PLAN_KEY, planId);
      const approvedRuns = Number(properties.getProperty(RIGHTEDGE_TUESDAY_APPROVED_RUNS_KEY) || 0);
      if (approvedRuns < 2) properties.setProperty(RIGHTEDGE_TUESDAY_APPROVED_RUNS_KEY, String(approvedRuns + 1));
    },
  };
  return {
    collectPlan: function () { return collectRightEdgeTuesdayPlan_(collectionServices); },
    approvedRuns: function () {
      return Number(properties.getProperty(RIGHTEDGE_TUESDAY_APPROVED_RUNS_KEY) || 0);
    },
    savePreview: saveRightEdgeTuesdayPreview_,
    applyPlan: function (plan) {
      assertRightEdgePlanBeforeUnchanged_(plan, readRightEdgePlanRange_);
      return applyRightEdgeTuesdayPlan_(plan, applyServices);
    },
  };
}

function removeRightEdgeTuesdayTriggers_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(trigger);
  });
}

const RIGHTEDGE_TUESDAY_MAX_RETRIES = 12;
const RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY = 'RIGHTEDGE_TUESDAY_RETRY_COUNT';

function scheduleRightEdgeTuesdayRetry_() {
  const properties = PropertiesService.getDocumentProperties();
  const attempt = Number(properties.getProperty(RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY) || 0);
  if (attempt >= RIGHTEDGE_TUESDAY_MAX_RETRIES) {
    setRightEdgePreviewStatus_(
      'Needs Check',
      'Stats Insider did not publish complete data after ' + RIGHTEDGE_TUESDAY_MAX_RETRIES +
        ' retries. Automatic retries stopped; run the preview manually once the source is live.'
    );
    removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
    return;
  }
  properties.setProperty(RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY, String(attempt + 1));
  removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
  ScriptApp.newTrigger('retryRightEdgeTuesdayAutomation').timeBased().after(10 * 60 * 1000).create();
}

function runRightEdgeTuesdayAutomation() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw rightEdgeTuesdayValidationError_('another Tuesday automation run is active');
  try {
    const result = runRightEdgeTuesdayWorkflow_(createRightEdgeTuesdayRuntime_());
    setRightEdgePreviewStatus_(result.status, result.planId);
    removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
    PropertiesService.getDocumentProperties().deleteProperty(RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY);
    return result;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    setRightEdgePreviewStatus_('Needs Check', message);
    if (message.indexOf('Stats Insider') !== -1) scheduleRightEdgeTuesdayRetry_();
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function retryRightEdgeTuesdayAutomation() {
  return runRightEdgeTuesdayAutomation();
}

function approveRightEdgeTuesdayAutomation() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw rightEdgeTuesdayValidationError_('another Tuesday automation run is active');
  try {
    const plan = loadRightEdgePendingPlan_();
    const runtime = createRightEdgeTuesdayRuntime_();
    const result = runtime.applyPlan(plan);
    setRightEdgePreviewStatus_(result.skipped ? 'Already Applied' : 'Applied', plan.id);
    removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
    return result;
  } finally {
    lock.releaseLock();
  }
}

function installRightEdgeTuesdayAutomation() {
  removeRightEdgeTuesdayTriggers_('runRightEdgeTuesdayAutomation');
  removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
  ScriptApp.newTrigger('runRightEdgeTuesdayAutomation')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(18)
    .nearMinute(0)
    .inTimezone(RIGHTEDGE_TUESDAY_TIMEZONE)
    .create();
  return 'Installed Tuesday 6:00pm Australia/Sydney automation with first-two-run approval previews.';
}

function removeRightEdgeTuesdayAutomation() {
  removeRightEdgeTuesdayTriggers_('runRightEdgeTuesdayAutomation');
  removeRightEdgeTuesdayTriggers_('retryRightEdgeTuesdayAutomation');
  PropertiesService.getDocumentProperties().deleteProperty(RIGHTEDGE_TUESDAY_RETRY_COUNT_KEY);
}
