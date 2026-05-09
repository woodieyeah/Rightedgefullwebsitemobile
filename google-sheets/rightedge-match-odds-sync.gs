/**
 * RIGHTEDGE — MATCH + TRY SCORER ODDS SYNC
 *
 * Paste this file into Apps Script for the RightEdge Google Sheet.
 * It updates Match Predictions columns:
 *   I = Best Home Odds
 *   J = Best Away Odds
 * It also updates the Try Scorers sheet by header name:
 *   Best Odds, Bookmaker, Market Implied %, Edge %
 *
 * Data source:
 *   Supabase Edge Function -> The Odds API -> normalized NRL best prices.
 */

const RIGHTEDGE_MATCH_ODDS_URL =
  'https://spahmuawycgohcznathc.supabase.co/functions/v1/make-server-3b84b96c/best-match-odds?format=sheets';
const RIGHTEDGE_TRY_SCORER_ODDS_URL =
  'https://spahmuawycgohcznathc.supabase.co/functions/v1/make-server-3b84b96c/best-try-scorer-odds?format=sheets';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RightEdge Odds')
    .addItem('Sync Match Odds Now', 'syncRightEdgeMatchOdds')
    .addItem('Sync Try Scorer Odds Now', 'syncRightEdgeTryScorerOdds')
    .addSeparator()
    .addItem('Create 15 Minute Match Auto Sync', 'createRightEdgeMatchOddsTrigger')
    .addItem('Create 15 Minute Try Scorer Auto Sync', 'createRightEdgeTryScorerOddsTrigger')
    .addItem('Remove All Auto Syncs', 'removeRightEdgeOddsTriggers')
    .addToUi();
}

function syncRightEdgeMatchOdds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Match Predictions');
  if (!sh) throw new Error('Match Predictions sheet not found.');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const response = UrlFetchApp.fetch(RIGHTEDGE_MATCH_ODDS_URL, {
    method: 'get',
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('RightEdge odds sync failed: ' + status + ' ' + text);
  }

  const payload = JSON.parse(text);
  const oddsRows = payload.rows || [];
  const oddsByMatch = {};

  oddsRows.forEach(row => {
    const home = normalizeRightEdgeSheetTeam(row[0]);
    const away = normalizeRightEdgeSheetTeam(row[1]);
    const exactKey = home + ' v ' + away;
    const reverseKey = away + ' v ' + home;

    oddsByMatch[exactKey] = {
      homeOdds: Number(row[2]) || '',
      awayOdds: Number(row[3]) || '',
      homeBookmaker: row[4] || '',
      awayBookmaker: row[5] || '',
      updatedAt: row[7] || payload.updatedAt || '',
    };

    // If the sheet has the teams reversed, still match the fixture but swap
    // the prices. If the sheet has the wrong opponent, it will remain unmatched.
    oddsByMatch[reverseKey] = {
      homeOdds: Number(row[3]) || '',
      awayOdds: Number(row[2]) || '',
      homeBookmaker: row[5] || '',
      awayBookmaker: row[4] || '',
      updatedAt: row[7] || payload.updatedAt || '',
    };
  });

  const matches = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  const currentOdds = sh.getRange(2, 9, lastRow - 1, 2).getValues();
  const nextOdds = [];
  let updatedCount = 0;
  let clearedCount = 0;
  const unmatchedMatches = [];

  matches.forEach((row, idx) => {
    const home = normalizeRightEdgeSheetTeam(row[0]);
    const away = normalizeRightEdgeSheetTeam(row[1]);
    const matchOdds = oddsByMatch[home + ' v ' + away];

    if (matchOdds) {
      nextOdds.push([matchOdds.homeOdds, matchOdds.awayOdds]);
      updatedCount++;
    } else {
      // Clear stale prices for fixtures that no longer exist in the API feed.
      // Keeping old odds here can make the sheet look like it synced the wrong game.
      nextOdds.push(['', '']);
      if (currentOdds[idx][0] || currentOdds[idx][1]) clearedCount++;
      unmatchedMatches.push(home + ' v ' + away);
    }
  });

  sh.getRange(2, 9, nextOdds.length, 2).setValues(nextOdds);

  // Rerun the existing prediction engine after I/J odds update.
  if (typeof updatePredictions === 'function') {
    updatePredictions();
  }

  const stamp = payload.updatedAt
    ? new Date(payload.updatedAt).toLocaleString()
    : new Date().toLocaleString();
  const unmatchedNote = unmatchedMatches.length
    ? ` Cleared ${clearedCount} stale unmatched row(s): ${unmatchedMatches.slice(0, 3).join(', ')}${unmatchedMatches.length > 3 ? '...' : ''}`
    : '';
  ss.toast(`Updated ${updatedCount} match odds from RightEdge.${unmatchedNote} Last sync: ${stamp}`, 'RightEdge Odds', 12);
}

function createRightEdgeMatchOddsTrigger() {
  removeRightEdgeMatchOddsTrigger();
  ScriptApp.newTrigger('syncRightEdgeMatchOdds')
    .timeBased()
    .everyMinutes(15)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Match odds will sync every 15 minutes.', 'RightEdge Odds', 8);
}

function createRightEdgeTryScorerOddsTrigger() {
  removeRightEdgeTryScorerOddsTrigger();
  ScriptApp.newTrigger('syncRightEdgeTryScorerOdds')
    .timeBased()
    .everyMinutes(15)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Try scorer odds will sync every 15 minutes.', 'RightEdge Odds', 8);
}

function removeRightEdgeOddsTriggers() {
  removeRightEdgeMatchOddsTrigger();
  removeRightEdgeTryScorerOddsTrigger();
  SpreadsheetApp.getActiveSpreadsheet().toast('All RightEdge odds auto syncs removed.', 'RightEdge Odds', 8);
}

function removeRightEdgeMatchOddsTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncRightEdgeMatchOdds') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function removeRightEdgeMatchOddsTriggers() {
  removeRightEdgeMatchOddsTrigger();
}

function removeRightEdgeTryScorerOddsTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncRightEdgeTryScorerOdds') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function syncRightEdgeTryScorerOdds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = findRightEdgeTryScorerSheet_(ss);
  if (!sh) {
    throw new Error('Try Scorers sheet not found. Expected a sheet named Try Scorers, Try Scorer Value Plays, Try Scorer Predictions, or Anytime Try Scorers.');
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerMap = buildRightEdgeHeaderMap_(headers);
  const matchCol = findRightEdgeHeader_(headerMap, ['Match']);
  const playerCol = findRightEdgeHeader_(headerMap, ['Player']);
  const bestOddsCol = findRightEdgeHeader_(headerMap, ['Best Odds']);
  const bookmakerCol = findRightEdgeHeader_(headerMap, ['Bookmaker']);
  const statsPctCol = findRightEdgeHeader_(headerMap, ['StatsInsider %', 'Stats Insider %', 'Model %']);
  const marketPctCol = findRightEdgeHeader_(headerMap, ['Market Implied %', 'Market %']);
  const edgePctCol = findRightEdgeHeader_(headerMap, ['Edge %', 'Overlay %']);

  if (matchCol === -1 || playerCol === -1 || bestOddsCol === -1) {
    throw new Error('Try scorer sync needs at least Match, Player, and Best Odds headers.');
  }

  const response = UrlFetchApp.fetch(RIGHTEDGE_TRY_SCORER_ODDS_URL, {
    method: 'get',
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('RightEdge try scorer odds sync failed: ' + status + ' ' + text);
  }

  const payload = JSON.parse(text);
  const oddsRows = payload.rows || [];
  const oddsByMatchAndPlayer = {};

  if (!oddsRows.length) {
    ss.toast('No try scorer prices came back from RightEdge. Check the Supabase function deployment and The Odds API market availability.', 'RightEdge Odds', 12);
    return;
  }

  oddsRows.forEach(row => {
    const matchKey = normalizeRightEdgeMatch(row[0]);
    const playerKey = normalizeRightEdgePlayer(row[3]);
    if (!matchKey || !playerKey) return;
    oddsByMatchAndPlayer[matchKey + '|' + playerKey] = {
      bestOdds: Number(row[5]) || '',
      bookmaker: row[6] || '',
      updatedAt: row[8] || payload.updatedAt || '',
    };
  });

  const dataRange = sh.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  let updatedCount = 0;
  let unmatchedCount = 0;

  values.forEach(row => {
    const matchKey = normalizeRightEdgeMatch(row[matchCol]);
    const playerKey = normalizeRightEdgePlayer(row[playerCol]);
    if (!matchKey || !playerKey) return;

    const odds = oddsByMatchAndPlayer[matchKey + '|' + playerKey];
    if (!odds || !odds.bestOdds) {
      unmatchedCount++;
      return;
    }

    row[bestOddsCol] = odds.bestOdds;
    if (bookmakerCol !== -1) row[bookmakerCol] = odds.bookmaker;

    const marketImplied = 1 / odds.bestOdds;
    if (marketPctCol !== -1) row[marketPctCol] = marketImplied;

    if (edgePctCol !== -1 && statsPctCol !== -1) {
      const modelPct = readRightEdgePercent_(row[statsPctCol]);
      if (modelPct !== '') row[edgePctCol] = modelPct - marketImplied;
    }

    updatedCount++;
  });

  dataRange.setValues(values);

  if (marketPctCol !== -1) {
    sh.getRange(2, marketPctCol + 1, lastRow - 1, 1).setNumberFormat('0.00%');
  }
  if (edgePctCol !== -1) {
    sh.getRange(2, edgePctCol + 1, lastRow - 1, 1).setNumberFormat('0.00%');
  }

  const stamp = payload.updatedAt
    ? new Date(payload.updatedAt).toLocaleString()
    : new Date().toLocaleString();
  ss.toast(`Updated ${updatedCount} try scorer odds from ${oddsRows.length} API prices. ${unmatchedCount} rows left unchanged. Last sync: ${stamp}`, 'RightEdge Odds', 10);
}

function normalizeRightEdgeSheetTeam(team) {
  const t = String(team || '').toLowerCase().trim();
  if (t.includes('bronco') || t.includes('brisbane')) return 'Brisbane';
  if (t.includes('rabbitoh') || t === 'souths' || t.includes('south sydney')) return 'Souths';
  if (t.includes('rooster') || t.includes('sydney')) return 'Sydney';
  if (t.includes('storm') || t.includes('melbourne')) return 'Melbourne';
  if (t.includes('panther') || t.includes('penrith')) return 'Penrith';
  if (t.includes('eel') || t.includes('parramatta')) return 'Parramatta';
  if (t.includes('shark') || t.includes('cronulla')) return 'Cronulla';
  if (t.includes('cowboy') || t.includes('north queensland') || t.includes('north qld')) return 'North Qld';
  if (t.includes('sea eagle') || t.includes('manly')) return 'Manly';
  if (t.includes('knight') || t.includes('newcastle')) return 'Newcastle';
  if (t.includes('dragon') || t.includes('st geo') || t.includes('st george')) return 'St Geo Illa';
  if (t.includes('titan') || t.includes('gold coast')) return 'Gold Coast';
  if (t.includes('bulldog') || t.includes('canterbury')) return 'Canterbury';
  if (t.includes('warrior') || t.includes('new zealand')) return 'Warriors';
  if (t.includes('raider') || t.includes('canberra')) return 'Canberra';
  if (t.includes('tiger') || t.includes('wests')) return 'Wests Tigers';
  if (t.includes('dolphin')) return 'Dolphins';
  return String(team || '').trim();
}

function normalizeRightEdgeMatch(match) {
  const raw = String(match || '').trim();
  if (!raw) return '';

  const parts = raw.split(/\s+(?:v|vs|versus|@)\s+/i);
  if (parts.length >= 2) {
    return normalizeRightEdgeSheetTeam(parts[0]) + ' v ' + normalizeRightEdgeSheetTeam(parts[1]);
  }

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRightEdgePlayer(player) {
  return String(player || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findRightEdgeTryScorerSheet_(ss) {
  const names = ['Try Scorers', 'Try Scorer Value Plays', 'Try Scorer Predictions', 'Anytime Try Scorers'];
  for (const name of names) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return null;
}

function buildRightEdgeHeaderMap_(headers) {
  const map = {};
  headers.forEach((header, idx) => {
    const key = normalizeRightEdgeHeader_(header);
    if (key) map[key] = idx;
  });
  return map;
}

function findRightEdgeHeader_(headerMap, names) {
  for (const name of names) {
    const key = normalizeRightEdgeHeader_(name);
    if (Object.prototype.hasOwnProperty.call(headerMap, key)) return headerMap[key];
  }
  return -1;
}

function normalizeRightEdgeHeader_(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function readRightEdgePercent_(value) {
  if (value === '' || value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return value > 1 ? value / 100 : value;
  }

  const text = String(value).trim();
  if (!text) return '';

  const cleaned = Number(text.replace('%', '').replace(/,/g, ''));
  if (Number.isNaN(cleaned)) return '';

  return text.includes('%') || cleaned > 1 ? cleaned / 100 : cleaned;
}
