/***********************
 * RIGHTEDGE NRL 2026 - PINNACLE-DRIVEN MODEL BLEND PATCH
 *
 * Replace your existing updatePredictions() function with this version.
 *
 * Expected Match Predictions layout:
 *   A = Home Team
 *   B = Away Team
 *   C = Predicted Winner
 *   D = Predicted Home Score
 *   E = Predicted Away Score
 *   F = Home Implied Odds
 *   G = Away Implied Odds
 *   I = Pin H / Pinnacle Home Odds
 *   J = Pin A / Pinnacle Away Odds
 *   K = Betr H / Best Home Odds
 *   L = Betr A / Best Away Odds
 *   M = Home Overlay %
 *   N = Away Overlay %
 *   O = Best Value Bet
 *   P = Stake
 *
 * Pinnacle drives the model blend.
 * Betr/best odds drive the commercial overlay and staking.
 ************************/

function updatePredictions() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet2026 = ss.getSheetByName('2026 Data Sheet');
  var advSheet      = ss.getSheetByName('2026 Advanced Data Sheet');
  var sh            = ss.getSheetByName('Match Predictions');
  var perfSheet     = ss.getSheetByName('Performance Tracker');

  var avg2026observed  = 47.45;
  var leagueAvgPPG     = avg2026observed / 2;
  var sigmoidK         = 0.08;
  var homeAdvPoints    = 2.5;
  var modelWeight      = 0.50;

  var advMaxAdjustment = 10.0;
  var advWeights = {
    missedTackles:     0.30,
    ruckInfringements: 0.15,
    forwardDominance:  0.25,
    linebreaks:        0.25
  };

  var officialPlayRules = {
    minModelProb: 0.49,
    minProjectedMargin: -2,
    minOverlay: 0,
    minOdds: 1.30,
    maxOdds: 3.75,
    kellyFraction: 0.18,
    maxBankrollPct: 0.025,
    minStake: 25
  };

  function safeAvg(t, p) {
    return p > 0 ? t / p : 0;
  }

  function cap(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function toNumber(value) {
    if (value === '' || value === null || value === undefined) return 0;
    var cleaned = Number(String(value).replace('$', '').replace(/,/g, '').trim());
    return Number.isFinite(cleaned) ? cleaned : 0;
  }

  function normalizeHeader_(header) {
    return String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  }

  function buildHeaderMap_(headers) {
    var map = {};
    headers.forEach(function(header, idx) {
      var key = normalizeHeader_(header);
      if (key) map[key] = idx;
    });
    return map;
  }

  function findHeader_(headerMap, names, fallbackIndex) {
    for (var i = 0; i < names.length; i++) {
      var key = normalizeHeader_(names[i]);
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) return headerMap[key];
    }
    return fallbackIndex;
  }

  function getContextAvg(ctxP, ctxPF, ctxPA, ovP, ovPF, ovPA) {
    var oPF = safeAvg(ovPF, ovP);
    var oPA = safeAvg(ovPA, ovP);
    if (ctxP === 0) return { pf: oPF, pa: oPA };
    var weight = 0.30;
    return {
      pf: (safeAvg(ctxPF, ctxP) * weight) + (oPF * (1 - weight)),
      pa: (safeAvg(ctxPA, ctxP) * weight) + (oPA * (1 - weight))
    };
  }

  function removeVig(hOdds, aOdds) {
    if (!hOdds || !aOdds || hOdds <= 1 || aOdds <= 1) return null;
    var rawH = 1 / hOdds;
    var rawA = 1 / aOdds;
    var total = rawH + rawA;
    return { h: rawH / total, a: rawA / total };
  }

  function kellyStakeFraction(odds, prob) {
    var b = odds - 1;
    if (b <= 0) return 0;
    return Math.max(0, (prob * b - (1 - prob)) / b);
  }

  function getOfficialPlayCandidate(input) {
    var isHomeWinner = input.predictedWinner === input.home;
    var selectedTeam = isHomeWinner ? input.home : input.away;
    var selectedSide = isHomeWinner ? 'Home' : 'Away';
    var selectedProb = isHomeWinner ? input.finalProbH : input.finalProbA;
    var selectedOverlay = isHomeWinner ? input.hOv : input.aOv;
    var selectedOdds = isHomeWinner ? input.hOdds : input.aOdds;

    if (!selectedOdds || selectedOdds <= 1) return { bet: '', stake: '' };
    if (Math.abs(input.projectedMargin) < officialPlayRules.minProjectedMargin) return { bet: '', stake: '' };
    if (selectedProb < officialPlayRules.minModelProb) return { bet: '', stake: '' };
    if (selectedOverlay < officialPlayRules.minOverlay) return { bet: '', stake: '' };
    if (selectedOdds < officialPlayRules.minOdds || selectedOdds > officialPlayRules.maxOdds) return { bet: '', stake: '' };

    var rawStake = Math.min(
      input.bankroll * kellyStakeFraction(selectedOdds, selectedProb) * officialPlayRules.kellyFraction,
      input.bankroll * officialPlayRules.maxBankrollPct
    );

    var roundedStake = rawStake > officialPlayRules.minStake
      ? Math.round(rawStake / 5) * 5
      : '';

    return {
      bet: roundedStake ? selectedTeam + ' (' + selectedSide + ')' : '',
      stake: roundedStake
    };
  }

  function loadAdvancedStats() {
    var lastRow = advSheet.getLastRow();
    if (lastRow < 2) return {};
    var data = advSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    var teams = {};
    var vals = { pcm: [], lb: [], tb: [], mt: [], ri: [] };

    data.forEach(function(r) {
      if (r[0]) {
        vals.pcm.push(r[1]);
        vals.lb.push(r[2]);
        vals.tb.push(r[3]);
        vals.mt.push(r[4]);
        vals.ri.push(r[5]);
      }
    });

    function mean(a) {
      return a.reduce(function(x, y) { return x + y; }, 0) / a.length;
    }

    function sd(a) {
      var m = mean(a);
      return Math.sqrt(a.reduce(function(s, v) { return s + Math.pow(v - m, 2); }, 0) / a.length) || 1;
    }

    var stats = {
      pcm: { m: mean(vals.pcm), s: sd(vals.pcm) },
      tb:  { m: mean(vals.tb),  s: sd(vals.tb)  },
      mt:  { m: mean(vals.mt),  s: sd(vals.mt)  },
      ri:  { m: mean(vals.ri),  s: sd(vals.ri)  },
      lb:  { m: mean(vals.lb),  s: sd(vals.lb)  }
    };

    data.forEach(function(r) {
      var zMT = -((r[4] - stats.mt.m) / stats.mt.s);
      var zRI = -((r[5] - stats.ri.m) / stats.ri.s);
      var zFwd = (
        ((r[1] - stats.pcm.m) / stats.pcm.s) +
        ((r[3] - stats.tb.m) / stats.tb.s)
      ) / 2;

      var composite =
        (zMT * advWeights.missedTackles) +
        (zRI * advWeights.ruckInfringements) +
        (zFwd * advWeights.forwardDominance) +
        (((r[2] - stats.lb.m) / stats.lb.s) * advWeights.linebreaks);

      teams[r[0]] = cap(composite * 3.8, -advMaxAdjustment, advMaxAdjustment);
    });

    return teams;
  }

  var dAdv = loadAdvancedStats();
  var d26 = {};

  dataSheet2026.getRange('B4:AA20').getValues().forEach(function(r) {
    if (r[0]) {
      d26[r[0]] = {
        home:    { p: r[1],  pf: r[5],  pa: r[6]  },
        away:    { p: r[8],  pf: r[12], pa: r[13] },
        overall: { p: r[15], pf: r[20], pa: r[21] }
      };
    }
  });

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = buildHeaderMap_(headers);

  var homeCol = findHeader_(headerMap, ['Home Team', 'Home'], 0);
  var awayCol = findHeader_(headerMap, ['Away Team', 'Away'], 1);
  var pinnacleHomeOddsCol = findHeader_(headerMap, ['Pin H', 'Pinnacle Home Odds', 'Sharp Home Odds'], 8);
  var pinnacleAwayOddsCol = findHeader_(headerMap, ['Pin A', 'Pinnacle Away Odds', 'Sharp Away Odds'], 9);
  var bestHomeOddsCol = findHeader_(headerMap, ['Betr H', 'Best Home Odds', 'Home Market Odds'], 10);
  var bestAwayOddsCol = findHeader_(headerMap, ['Betr A', 'Best Away Odds', 'Away Market Odds'], 11);

  var rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var outCorePredictions = [];
  var outOverlays = [];
  var bankroll = Number(perfSheet.getRange('K2').getValue()) || 5000;

  rows.forEach(function(r) {
    var home = r[homeCol];
    var away = r[awayCol];

    if (home && away) {
      var hD = d26[home] || {};
      var aD = d26[away] || {};
      var hHome = hD.home || {};
      var hOverall = hD.overall || {};
      var aAway = aD.away || {};
      var aOverall = aD.overall || {};

      var hC = getContextAvg(
        hHome.p || 0, hHome.pf || 0, hHome.pa || 0,
        hOverall.p || 0, hOverall.pf || 0, hOverall.pa || 0
      );

      var aC = getContextAvg(
        aAway.p || 0, aAway.pf || 0, aAway.pa || 0,
        aOverall.p || 0, aOverall.pf || 0, aOverall.pa || 0
      );

      var bestHomeOdds = toNumber(r[bestHomeOddsCol]);
      var bestAwayOdds = toNumber(r[bestAwayOddsCol]);
      var pinnacleHomeOdds = toNumber(r[pinnacleHomeOddsCol]);
      var pinnacleAwayOdds = toNumber(r[pinnacleAwayOddsCol]);

      var modelMarketHomeOdds = pinnacleHomeOdds;
      var modelMarketAwayOdds = pinnacleAwayOdds;

      var hRate = { off: hC.pf - leagueAvgPPG, def: hC.pa - leagueAvgPPG };
      var aRate = { off: aC.pf - leagueAvgPPG, def: aC.pa - leagueAvgPPG };

      var baseMargin = ((hRate.off - hRate.def) - (aRate.off - aRate.def)) / 2 + homeAdvPoints;
      var finalMargin = baseMargin + (dAdv[home] || 0) - (dAdv[away] || 0);
      var totalScore = avg2026observed + (hRate.off + aRate.def + aRate.off + hRate.def) * 0.5;

      var rawModelProb = 1 / (1 + Math.exp(-sigmoidK * finalMargin));
      var fairMarket = removeVig(modelMarketHomeOdds, modelMarketAwayOdds);

      var finalProbH = rawModelProb;
      var blendedMargin = finalMargin;

      if (fairMarket) {
        var modelLogit = Math.log(rawModelProb / (1 - rawModelProb));
        var marketLogit = Math.log(fairMarket.h / (1 - fairMarket.h));
        var blendedLogit =
          (modelWeight * modelLogit) + ((1 - modelWeight) * marketLogit);

        finalProbH = 1 / (1 + Math.exp(-blendedLogit));
        blendedMargin = blendedLogit / sigmoidK;
      }

      finalProbH = cap(finalProbH, 0.05, 0.95);
      var finalProbA = 1 - finalProbH;
      var scoreMargin = cap(blendedMargin, finalMargin - 6, finalMargin + 6);

      var hScore = Math.max(0, Math.round((totalScore + scoreMargin) / 2));
      var aScore = Math.max(0, Math.round((totalScore - scoreMargin) / 2));
      var predictedWinner = finalProbH >= finalProbA ? home : away;

      if (hScore === aScore) {
        if (predictedWinner === home) {
          hScore += 1;
        } else {
          aScore += 1;
        }
      }

      var retailMarket = removeVig(bestHomeOdds, bestAwayOdds);
      var hOv = retailMarket ? cap(finalProbH - retailMarket.h, -0.15, 0.15) : '';
      var aOv = retailMarket ? cap(finalProbA - retailMarket.a, -0.15, 0.15) : '';

      var official = retailMarket
        ? getOfficialPlayCandidate({
            home: home,
            away: away,
            predictedWinner: predictedWinner,
            projectedMargin: scoreMargin,
            finalProbH: finalProbH,
            finalProbA: finalProbA,
            hOv: hOv,
            aOv: aOv,
            hOdds: bestHomeOdds,
            aOdds: bestAwayOdds,
            bankroll: bankroll
          })
        : { bet: '', stake: '' };

      outCorePredictions.push([predictedWinner, hScore, aScore, 1 / finalProbH, 1 / finalProbA]);
      outOverlays.push([hOv, aOv, official.bet, official.stake]);
    } else {
      outCorePredictions.push(['', '', '', '', '']);
      outOverlays.push(['', '', '', '']);
    }
  });

  sh.getRange(2, 3, outCorePredictions.length, 5).setValues(outCorePredictions);
  sh.getRange(2, 13, outOverlays.length, 4).setValues(outOverlays);
}
