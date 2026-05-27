/***********************
 * RIGHTEDGE NRL 2026 - PINNACLE-INFLUENCED MODEL PATCH
 *
 * Replace your existing updatePredictions() function with this version.
 *
 * Required if you want Pinnacle to drive the blend:
 * - Add Match Predictions headers named:
 *   Pinnacle Home Odds
 *   Pinnacle Away Odds
 *
 * The model will use:
 * - Pinnacle Home/Away Odds for the market blend and sharp overlay.
 * - Best Home/Away Odds for the actual available price/staking.
 *
 * If Pinnacle columns are missing or blank, it safely falls back to the
 * current I/J odds so the sheet does not break.
 ************************/

function updatePredictions() {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet2026 = ss.getSheetByName('2026 Data Sheet');
  const advSheet      = ss.getSheetByName('2026 Advanced Data Sheet');
  const sh            = ss.getSheetByName('Match Predictions');
  const perfSheet     = ss.getSheetByName('Performance Tracker');

  // Environment and calibration
  const avg2026observed  = 47.45;
  const leagueAvgPPG     = avg2026observed / 2;
  const sigmoidK         = 0.08;
  const homeAdvPoints    = 2.5;
  const modelWeight      = 0.50;

  const advMaxAdjustment = 10.0;
  const advWeights = {
    missedTackles:     0.30,
    ruckInfringements: 0.15,
    forwardDominance:  0.25,
    linebreaks:        0.25
  };

  const officialPlayRules = {
    minModelProb: 0.49,
    minProjectedMargin: -2,
    minOverlay: 0,
    minOdds: 1.30,
    maxOdds: 3.75,
    kellyFraction: 0.18,
    maxBankrollPct: 0.025,
    minStake: 25
  };

  // Helpers
  const safeAvg = (t, p) => (p > 0 ? t / p : 0);
  const cap = (v, min, max) => Math.max(min, Math.min(max, v));
  const toNumber = value => {
    if (value === '' || value === null || value === undefined) return 0;
    const cleaned = Number(String(value).replace('$', '').replace(/,/g, '').trim());
    return Number.isFinite(cleaned) ? cleaned : 0;
  };

  function normalizeHeader_(header) {
    return String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  }

  function buildHeaderMap_(headers) {
    const map = {};
    headers.forEach((header, idx) => {
      const key = normalizeHeader_(header);
      if (key) map[key] = idx;
    });
    return map;
  }

  function findHeader_(headerMap, names, fallbackIndex) {
    for (const name of names) {
      const key = normalizeHeader_(name);
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) return headerMap[key];
    }
    return fallbackIndex;
  }

  function getContextAvg(ctxP, ctxPF, ctxPA, ovP, ovPF, ovPA) {
    const oPF = safeAvg(ovPF, ovP);
    const oPA = safeAvg(ovPA, ovP);
    if (ctxP === 0) return { pf: oPF, pa: oPA };
    const weight = 0.30;
    return {
      pf: (safeAvg(ctxPF, ctxP) * weight) + (oPF * (1 - weight)),
      pa: (safeAvg(ctxPA, ctxP) * weight) + (oPA * (1 - weight))
    };
  }

  function removeVig(hOdds, aOdds) {
    if (!hOdds || !aOdds || hOdds <= 1 || aOdds <= 1) return null;
    const rawH = 1 / hOdds;
    const rawA = 1 / aOdds;
    const total = rawH + rawA;
    return { h: rawH / total, a: rawA / total };
  }

  function kellyStakeFraction(odds, prob) {
    const b = odds - 1;
    if (b <= 0) return 0;
    return Math.max(0, (prob * b - (1 - prob)) / b);
  }

  function getOfficialPlayCandidate({
    home,
    away,
    predictedWinner,
    projectedMargin,
    finalProbH,
    finalProbA,
    hOv,
    aOv,
    hOdds,
    aOdds,
    bankroll
  }) {
    const isHomeWinner = predictedWinner === home;
    const selectedTeam = isHomeWinner ? home : away;
    const selectedSide = isHomeWinner ? 'Home' : 'Away';
    const selectedProb = isHomeWinner ? finalProbH : finalProbA;
    const selectedOverlay = isHomeWinner ? hOv : aOv;
    const selectedOdds = isHomeWinner ? hOdds : aOdds;

    if (!selectedOdds || selectedOdds <= 1) return { bet: '', stake: '' };
    if (Math.abs(projectedMargin) < officialPlayRules.minProjectedMargin) return { bet: '', stake: '' };
    if (selectedProb < officialPlayRules.minModelProb) return { bet: '', stake: '' };
    if (selectedOverlay < officialPlayRules.minOverlay) return { bet: '', stake: '' };
    if (selectedOdds < officialPlayRules.minOdds || selectedOdds > officialPlayRules.maxOdds) return { bet: '', stake: '' };

    const rawStake = Math.min(
      bankroll * kellyStakeFraction(selectedOdds, selectedProb) * officialPlayRules.kellyFraction,
      bankroll * officialPlayRules.maxBankrollPct
    );

    const roundedStake = rawStake > officialPlayRules.minStake
      ? Math.round(rawStake / 5) * 5
      : '';

    return {
      bet: roundedStake ? `${selectedTeam} (${selectedSide})` : '',
      stake: roundedStake
    };
  }

  // Advanced stats loading
  function loadAdvancedStats() {
    const lastRow = advSheet.getLastRow();
    if (lastRow < 2) return {};
    const data = advSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const teams = {};
    const vals = { pcm: [], lb: [], tb: [], mt: [], ri: [] };

    data.forEach(r => {
      if (r[0]) {
        vals.pcm.push(r[1]);
        vals.lb.push(r[2]);
        vals.tb.push(r[3]);
        vals.mt.push(r[4]);
        vals.ri.push(r[5]);
      }
    });

    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = a => Math.sqrt(a.reduce((s, v) => s + Math.pow(v - mean(a), 2), 0) / a.length) || 1;

    const stats = {
      pcm: { m: mean(vals.pcm), s: sd(vals.pcm) },
      tb:  { m: mean(vals.tb),  s: sd(vals.tb)  },
      mt:  { m: mean(vals.mt),  s: sd(vals.mt)  },
      ri:  { m: mean(vals.ri),  s: sd(vals.ri)  },
      lb:  { m: mean(vals.lb),  s: sd(vals.lb)  }
    };

    data.forEach(r => {
      const zMT = -((r[4] - stats.mt.m) / stats.mt.s);
      const zRI = -((r[5] - stats.ri.m) / stats.ri.s);
      const zFwd = (
        ((r[1] - stats.pcm.m) / stats.pcm.s) +
        ((r[3] - stats.tb.m) / stats.tb.s)
      ) / 2;

      const composite =
        (zMT * advWeights.missedTackles) +
        (zRI * advWeights.ruckInfringements) +
        (zFwd * advWeights.forwardDominance) +
        (((r[2] - stats.lb.m) / stats.lb.s) * advWeights.linebreaks);

      teams[r[0]] = cap(composite * 3.8, -advMaxAdjustment, advMaxAdjustment);
    });

    return teams;
  }

  // Prediction execution
  const dAdv = loadAdvancedStats();
  const d26 = {};

  dataSheet2026.getRange('B4:AA20').getValues().forEach(r => {
    if (r[0]) {
      d26[r[0]] = {
        home:    { p: r[1],  pf: r[5],  pa: r[6]  },
        away:    { p: r[8],  pf: r[12], pa: r[13] },
        overall: { p: r[15], pf: r[20], pa: r[21] }
      };
    }
  });

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerMap = buildHeaderMap_(headers);

  const homeCol = findHeader_(headerMap, ['Home Team', 'Home'], 0);
  const awayCol = findHeader_(headerMap, ['Away Team', 'Away'], 1);
  const bestHomeOddsCol = findHeader_(headerMap, ['Best Home Odds', 'Home Market Odds', 'Tab Home Odds'], 8);
  const bestAwayOddsCol = findHeader_(headerMap, ['Best Away Odds', 'Away Market Odds', 'Tab Away Odds'], 9);
  const pinnacleHomeOddsCol = findHeader_(headerMap, ['Pinnacle Home Odds', 'Pinny Home Odds', 'Sharp Home Odds'], -1);
  const pinnacleAwayOddsCol = findHeader_(headerMap, ['Pinnacle Away Odds', 'Pinny Away Odds', 'Sharp Away Odds'], -1);

  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const outPredictions = [];
  const outOverlays = [];

  const bankroll = Number(perfSheet.getRange('K2').getValue()) || 5000;

  rows.forEach(r => {
    const home = r[homeCol];
    const away = r[awayCol];

    if (home && away) {
      const hD = d26[home] || {};
      const aD = d26[away] || {};

      const hC = getContextAvg(
        hD.home?.p || 0, hD.home?.pf || 0, hD.home?.pa || 0,
        hD.overall?.p || 0, hD.overall?.pf || 0, hD.overall?.pa || 0
      );

      const aC = getContextAvg(
        aD.away?.p || 0, aD.away?.pf || 0, aD.away?.pa || 0,
        aD.overall?.p || 0, aD.overall?.pf || 0, aD.overall?.pa || 0
      );

      const bestHomeOdds = toNumber(r[bestHomeOddsCol]);
      const bestAwayOdds = toNumber(r[bestAwayOddsCol]);
      const pinnacleHomeOdds = pinnacleHomeOddsCol === -1 ? 0 : toNumber(r[pinnacleHomeOddsCol]);
      const pinnacleAwayOdds = pinnacleAwayOddsCol === -1 ? 0 : toNumber(r[pinnacleAwayOddsCol]);

      // This is the key change: Pinnacle drives the blend when available.
      // Best odds remain the available price used for official staking.
      const modelMarketHomeOdds = pinnacleHomeOdds || bestHomeOdds;
      const modelMarketAwayOdds = pinnacleAwayOdds || bestAwayOdds;

      const hRate = { off: hC.pf - leagueAvgPPG, def: hC.pa - leagueAvgPPG };
      const aRate = { off: aC.pf - leagueAvgPPG, def: aC.pa - leagueAvgPPG };

      const baseMargin = ((hRate.off - hRate.def) - (aRate.off - aRate.def)) / 2 + homeAdvPoints;
      const finalMargin = baseMargin + (dAdv[home] || 0) - (dAdv[away] || 0);
      const totalScore = avg2026observed + (hRate.off + aRate.def + aRate.off + hRate.def) * 0.5;

      const rawModelProb = 1 / (1 + Math.exp(-sigmoidK * finalMargin));
      const fairMarket = removeVig(modelMarketHomeOdds, modelMarketAwayOdds);

      let finalProbH = rawModelProb;
      let blendedMargin = finalMargin;

      if (fairMarket) {
        const modelLogit = Math.log(rawModelProb / (1 - rawModelProb));
        const marketLogit = Math.log(fairMarket.h / (1 - fairMarket.h));
        const blendedLogit =
          (modelWeight * modelLogit) + ((1 - modelWeight) * marketLogit);

        finalProbH = 1 / (1 + Math.exp(-blendedLogit));
        blendedMargin = blendedLogit / sigmoidK;
      }

      finalProbH = cap(finalProbH, 0.05, 0.95);
      const finalProbA = 1 - finalProbH;

      // Safety cap so market cannot completely hijack the score.
      const scoreMargin = cap(blendedMargin, finalMargin - 6, finalMargin + 6);

      let hScore = Math.max(0, Math.round((totalScore + scoreMargin) / 2));
      let aScore = Math.max(0, Math.round((totalScore - scoreMargin) / 2));

      if (hScore === aScore) {
        if (finalProbH > finalProbA) {
          hScore += 1;
        } else if (finalProbA > finalProbH) {
          aScore += 1;
        }
      }

      const hOv = fairMarket ? cap(finalProbH - fairMarket.h, -0.15, 0.15) : '';
      const aOv = fairMarket ? cap(finalProbA - fairMarket.a, -0.15, 0.15) : '';

      const predictedWinner = finalProbH >= finalProbA ? home : away;
      const official = fairMarket
        ? getOfficialPlayCandidate({
            home,
            away,
            predictedWinner,
            projectedMargin: scoreMargin,
            finalProbH,
            finalProbA,
            hOv,
            aOv,
            hOdds: bestHomeOdds,
            aOdds: bestAwayOdds,
            bankroll
          })
        : { bet: '', stake: '' };

      outPredictions.push([predictedWinner, hScore, aScore, 1 / finalProbH, 1 / finalProbA]);
      outOverlays.push([hOv, aOv, official.bet, official.stake]);
    } else {
      outPredictions.push(['', '', '', '', '']);
      outOverlays.push(['', '', '', '']);
    }
  });

  sh.getRange(2, 3, outPredictions.length, 5).setValues(outPredictions);
  sh.getRange(2, 11, outOverlays.length, 4).setValues(outOverlays);
}
