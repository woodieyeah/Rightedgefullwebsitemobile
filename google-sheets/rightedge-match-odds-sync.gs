/**
 * RIGHTEDGE — PHASE 1 MATCH ODDS SYNC
 *
 * Paste this file into Apps Script for the RightEdge Google Sheet.
 * It updates Match Predictions columns:
 *   I = Best Home Odds
 *   J = Best Away Odds
 *
 * Data source:
 *   Supabase Edge Function -> The Odds API -> normalized NRL best h2h prices.
 */

const RIGHTEDGE_MATCH_ODDS_URL =
  'https://spahmuawycgohcznathc.supabase.co/functions/v1/make-server-3b84b96c/best-match-odds?format=sheets&force=true';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RightEdge Odds')
    .addItem('Sync Match Odds Now', 'syncRightEdgeMatchOdds')
    .addItem('Create 15 Minute Auto Sync', 'createRightEdgeMatchOddsTrigger')
    .addItem('Remove Auto Sync', 'removeRightEdgeMatchOddsTriggers')
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
    oddsByMatch[home + ' v ' + away] = {
      homeOdds: Number(row[2]) || '',
      awayOdds: Number(row[3]) || '',
      homeBookmaker: row[4] || '',
      awayBookmaker: row[5] || '',
      updatedAt: row[7] || payload.updatedAt || '',
    };
  });

  const matches = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  const currentOdds = sh.getRange(2, 9, lastRow - 1, 2).getValues();
  const nextOdds = [];
  let updatedCount = 0;

  matches.forEach((row, idx) => {
    const home = normalizeRightEdgeSheetTeam(row[0]);
    const away = normalizeRightEdgeSheetTeam(row[1]);
    const matchOdds = oddsByMatch[home + ' v ' + away];

    if (matchOdds) {
      nextOdds.push([matchOdds.homeOdds, matchOdds.awayOdds]);
      updatedCount++;
    } else {
      nextOdds.push(currentOdds[idx]);
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
  ss.toast(`Updated ${updatedCount} match odds from RightEdge. Last sync: ${stamp}`, 'RightEdge Odds', 8);
}

function createRightEdgeMatchOddsTrigger() {
  removeRightEdgeMatchOddsTriggers();
  ScriptApp.newTrigger('syncRightEdgeMatchOdds')
    .timeBased()
    .everyMinutes(15)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Match odds will sync every 15 minutes.', 'RightEdge Odds', 8);
}

function removeRightEdgeMatchOddsTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncRightEdgeMatchOdds') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function normalizeRightEdgeSheetTeam(team) {
  const t = String(team || '').toLowerCase().trim();
  if (t.includes('bronco') || t.includes('brisbane')) return 'Brisbane';
  if (t.includes('rooster') || t.includes('sydney')) return 'Sydney';
  if (t.includes('storm') || t.includes('melbourne')) return 'Melbourne';
  if (t.includes('panther') || t.includes('penrith')) return 'Penrith';
  if (t.includes('rabbitoh') || t === 'souths' || t.includes('south sydney')) return 'Souths';
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
