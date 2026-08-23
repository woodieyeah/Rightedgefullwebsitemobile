import React, { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Mail, Users, Send, AlertTriangle, CheckCircle, RefreshCw, Eye, Lock, LogIn, Activity, TrendingUp, BarChart3, Clock, Globe, Unlock, CreditCard } from 'lucide-react';
import { normalizeAdminCodeInput } from '../auth-session';

const NRL_TEAMS = [
  'Brisbane Broncos',
  'Canberra Raiders',
  'Canterbury Bulldogs',
  'Cronulla Sharks',
  'Dolphins',
  'Gold Coast Titans',
  'Manly Sea Eagles',
  'Melbourne Storm',
  'Newcastle Knights',
  'North Queensland Cowboys',
  'Parramatta Eels',
  'Penrith Panthers',
  'South Sydney Rabbitohs',
  'St George Illawarra Dragons',
  'Sydney Roosters',
  'Warriors',
  'Wests Tigers',
];

const BETR_AFFILIATE_URL = 'https://record.betraffiliates.com.au/_Bk4P0TFHeOiYNevImT-MDGNd7ZgqdRLk/1/';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const RESPONSIBLE_GAMBLING_EMAIL_TAGLINES = [
  "Chances are you're about to lose.",
  "Think. Is this a bet you really want to place?",
  "What's gambling really costing you?",
  "What are you prepared to lose today? Set a deposit limit.",
  "Imagine what you could be buying instead.",
  "What are you really gambling with?",
];

function getResponsibleGamblingEmailTagline() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return RESPONSIBLE_GAMBLING_EMAIL_TAGLINES[
    Math.abs(dayOfYear) % RESPONSIBLE_GAMBLING_EMAIL_TAGLINES.length
  ];
}

function adminResponsibleGamblingEmailFooterHtml() {
  const tagline = escapeHtml(getResponsibleGamblingEmailTagline().toUpperCase());
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;background:#ffffff;border:1px solid #05070b;">
      <tr>
        <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;color:#05070b;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.3;color:#05070b;font-weight:700;text-transform:uppercase;">${tagline}</div>
          <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#05070b;font-weight:700;">
            For free and confidential support call <a href="tel:1800858858" style="color:#05070b;text-decoration:underline;font-weight:900;">1800 858 858</a> or visit <a href="https://www.gamblinghelponline.org.au/" target="_blank" rel="noopener noreferrer" style="color:#05070b;text-decoration:underline;font-weight:900;">gamblinghelponline.org.au</a>.
          </div>
          <div style="margin-top:10px;font-size:11px;line-height:1.2;color:#05070b;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">18+ only</div>
        </td>
      </tr>
    </table>`;
}

function adminEmailHeaderHtml(label = '') {
  return `
    <div style="padding:22px 0 18px 0;border-bottom:1px solid #1E1E2E;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="left" style="vertical-align:middle;">
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:22px;line-height:1.2;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">RightEdge</div>
          </td>
          ${label ? `<td align="right" style="vertical-align:middle;"><span style="display:inline-block;border:1px solid #1E1E2E;color:#9CA3AF;font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;padding:8px 10px;">${label}</span></td>` : ''}
        </tr>
      </table>
    </div>`;
}

function adminEmailCtaHtml(href: string, label: string, variant: 'primary' | 'secondary' = 'primary') {
  const isPrimary = variant === 'primary';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:${isPrimary ? '#ffffff' : 'transparent'};border:1px solid ${isPrimary ? '#ffffff' : '#1E1E2E'};">
          <a href="${href}" style="display:inline-block;padding:14px 18px;color:${isPrimary ? '#0A0A0F' : '#ffffff'};text-decoration:none;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.2;font-weight:600;letter-spacing:-0.01em;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function adminMetricCardHtml(label: string, value: string, tone: 'default' | 'positive' | 'negative' = 'default') {
  const color = tone === 'positive' ? '#00E676' : tone === 'negative' ? '#F87171' : '#ffffff';
  return `
    <td width="33.33%" style="padding:0 6px 12px 6px;vertical-align:top;">
      <div style="background:#16161D;border:1px solid #1E1E2E;padding:18px 16px;">
        <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">${label}</div>
        <div style="margin-top:10px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:22px;line-height:1.1;color:${color};font-weight:600;letter-spacing:-0.02em;">${value}</div>
      </div>
    </td>`;
}

function adminEmailShell(preheader: string, label: string, innerHtml: string) {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
  <head>
    <meta content="width=device-width" name="viewport" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
  </head>
  <body style="margin:0;padding:0;background:#0A0A0F;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <div style="background:#0A0A0F;padding:28px 14px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:680px;margin:0 auto;">
        ${adminEmailHeaderHtml(label)}
        ${innerHtml}
        ${adminResponsibleGamblingEmailFooterHtml()}
        <div style="margin-top:22px;text-align:center;font-family:Inter,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#6B7280;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">Backed by data, not guesswork.</div>
      </div>
    </div>
  </body>
</html>`;
}

function slugifyPayload(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRoundLabel(value: unknown) {
  const label = String(value || 'Live').trim();
  if (!label || label.toLowerCase() === 'live') return 'Live';
  return /^round\b/i.test(label) ? label : `Round ${label}`;
}

function teamAliases(team: string) {
  const teamName = String(team || '');
  const aliases: Record<string, string[]> = {
    'Brisbane Broncos': ['brisbane', 'broncos'],
    'Canberra Raiders': ['canberra', 'raiders'],
    'Canterbury Bulldogs': ['canterbury', 'bulldogs'],
    'Cronulla Sharks': ['cronulla', 'sharks'],
    'Dolphins': ['dolphins'],
    'Gold Coast Titans': ['gold coast', 'titans'],
    'Manly Sea Eagles': ['manly', 'sea eagles'],
    'Melbourne Storm': ['melbourne', 'storm'],
    'Newcastle Knights': ['newcastle', 'knights'],
    'North Queensland Cowboys': ['north qld', 'north queensland', 'cowboys'],
    'Parramatta Eels': ['parramatta', 'eels'],
    'Penrith Panthers': ['penrith', 'panthers'],
    'South Sydney Rabbitohs': ['souths', 'south sydney', 'rabbitohs'],
    'St George Illawarra Dragons': ['st geo illa', 'st george', 'dragons'],
    'Sydney Roosters': ['sydney', 'roosters'],
    'Warriors': ['warriors', 'new zealand'],
    'Wests Tigers': ['wests tigers', 'tigers'],
  };
  return aliases[teamName] || [teamName.toLowerCase()];
}

function teamMatchesName(selectedTeam: string, candidate: string) {
  const normalizedCandidate = String(candidate || '').toLowerCase();
  return teamAliases(selectedTeam).some((alias) => normalizedCandidate.includes(alias));
}

function formatMoneyOdds(value: unknown) {
  const odds = Number(value);
  return Number.isFinite(odds) && odds > 0 ? `$${odds.toFixed(2)}` : '';
}

function getImpliedPctFromOdds(odds: unknown) {
  const numericOdds = Number(odds);
  return Number.isFinite(numericOdds) && numericOdds > 1 ? (1 / numericOdds) * 100 : 0;
}

function probabilityFromEdge(edge: number, scale = 7.5) {
  return Math.max(1, Math.min(99, (1 / (1 + Math.exp(-(edge / scale)))) * 100));
}

function formatLinePoint(point: number) {
  return point > 0 ? `+${point}` : String(point);
}

function normalizeBookmakerName(name: string) {
  const key = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key || key.includes('multiple')) return '';
  if (key.includes('pointsbet')) return 'pointsbet';
  if (key.includes('betright')) return 'betright';
  if (key === 'betr' || key.startsWith('betr') || key.includes('betrapp')) return 'betr';
  if (key.includes('betfair')) return 'betfair';
  if (key.includes('ladbrokes')) return 'ladbrokes';
  if (key.includes('sportsbet')) return 'sportsbet';
  if (key.includes('bet365')) return 'bet365';
  if (key.includes('dabble')) return 'dabble';
  if (key.includes('neds')) return 'neds';
  if (key.includes('tabtouch')) return 'tab';
  if (key.includes('tab')) return 'tab';
  return key;
}

function isBetrBookmaker(bookmaker: any) {
  return normalizeBookmakerName(bookmaker?.title || bookmaker?.key || bookmaker || '') === 'betr';
}

async function fetchAdminLiveOdds() {
  const cacheKey = 'rightedge_odds_cache_v5_no_betfair';
  const cacheDuration = 30 * 60 * 1000;

  try {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < cacheDuration) return cached.data;
    }
  } catch {
    // Keep the email generator usable even if the cache is malformed.
  }

  const res = await fetch('/api/live-odds', {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!res.ok) throw new Error('Could not load live odds');
  const rawOdds = await res.json();
  if (!Array.isArray(rawOdds)) throw new Error('Invalid live odds payload');

  localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: rawOdds }));
  return rawOdds;
}

function findLiveOddsEvent(rawOdds: any[], row: any) {
  return (rawOdds || []).find((event: any) => {
    const home = event.home_team || '';
    const away = event.away_team || '';
    return (
      (teamMatchesName(row.homeTeam, home) && teamMatchesName(row.awayTeam, away)) ||
      (teamMatchesName(row.homeTeam, away) && teamMatchesName(row.awayTeam, home))
    );
  });
}

function getBestBetrPlayForTeam(row: any, selectedTeam: string, rawOdds: any[]) {
  const event = findLiveOddsEvent(rawOdds, row);
  const betrBookmaker = (event?.bookmakers || []).find((bookmaker: any) => isBetrBookmaker(bookmaker));
  if (!betrBookmaker) return null;

  const candidates: any[] = [];
  const projectedTotal = Number(row.predictedHomeScore || 0) + Number(row.predictedAwayScore || 0);
  const projectedHomeMargin = Number(row.predictedHomeScore || 0) - Number(row.predictedAwayScore || 0);
  const selectedIsHome = teamMatchesName(selectedTeam, row.homeTeam);
  const selectedProjectedMargin = selectedIsHome ? projectedHomeMargin : -projectedHomeMargin;
  const selectedModelPct = selectedIsHome ? getImpliedPctFromOdds(row.modelHomeOdds) : getImpliedPctFromOdds(row.modelAwayOdds);
  const bookmakerName = 'Betr';
  const h2hMarket = (betrBookmaker.markets || []).find((market: any) => market.key === 'h2h');
  const spreadMarket = (betrBookmaker.markets || []).find((market: any) => market.key === 'spreads');
  const totalsMarket = (betrBookmaker.markets || []).find((market: any) => market.key === 'totals');

  for (const outcome of spreadMarket?.outcomes || []) {
    const odds = Number(outcome.price) || 0;
    const point = Number(outcome.point);
    if (!teamMatchesName(selectedTeam, outcome.name || '') || odds < 1.55 || !Number.isFinite(point)) continue;

    const coverEdge = selectedProjectedMargin + point;
    const modelPct = probabilityFromEdge(coverEdge, 7.5);
    if (modelPct < 53) continue;

    candidates.push({
      type: 'Line',
      label: `${selectedTeam} ${formatLinePoint(point)}`,
      bookmaker: bookmakerName,
      odds,
      modelPct,
      modelEdge: coverEdge,
      detail: `Model margin ${selectedProjectedMargin > 0 ? '+' : ''}${Math.round(selectedProjectedMargin)} vs Betr line ${formatLinePoint(point)}`,
      typeRank: 3,
    });
  }

  for (const outcome of totalsMarket?.outcomes || []) {
    const odds = Number(outcome.price) || 0;
    const point = Number(outcome.point);
    const side = String(outcome.name || '');
    if (!['Over', 'Under'].includes(side) || odds < 1.55 || !Number.isFinite(point) || !projectedTotal) continue;

    const edge = side === 'Over' ? projectedTotal - point : point - projectedTotal;
    const modelPct = probabilityFromEdge(edge, 8);
    if (modelPct < 53) continue;

    candidates.push({
      type: 'Total',
      label: `${side} ${point}`,
      bookmaker: bookmakerName,
      odds,
      modelPct,
      modelEdge: edge,
      detail: `Model total ${Math.round(projectedTotal)} vs Betr total ${point}`,
      typeRank: 2,
    });
  }

  for (const outcome of h2hMarket?.outcomes || []) {
    const odds = Number(outcome.price) || 0;
    if (!teamMatchesName(selectedTeam, outcome.name || '') || odds < 1.25) continue;

    candidates.push({
      type: 'Head 2 Head',
      label: `${selectedTeam} head-to-head`,
      bookmaker: bookmakerName,
      odds,
      modelPct: selectedModelPct,
      modelEdge: selectedModelPct - getImpliedPctFromOdds(odds),
      detail: `Model win probability ${selectedModelPct.toFixed(1)}% vs Betr market ${getImpliedPctFromOdds(odds).toFixed(1)}%`,
      typeRank: teamMatchesName(selectedTeam, row.predictedWinner || '') ? 1 : 0,
    });
  }

  if (!candidates.length) return null;

  return candidates.sort((a, b) => {
    const aScore = a.modelPct + Math.min(8, Math.max(0, (a.odds - 1.8) * 6)) + a.typeRank;
    const bScore = b.modelPct + Math.min(8, Math.max(0, (b.odds - 1.8) * 6)) + b.typeRank;
    return bScore - aScore;
  })[0];
}

export function AdminDashboard({ data, onNavigateAdStudio }: { data?: any, onNavigateAdStudio?: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loginStep, setLoginStep] = useState<'email' | 'code'>('email');
  const [loginError, setLoginError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState<'today'|'7d'|'30d'>('today');
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [kvNamespaceScan, setKvNamespaceScan] = useState<any>(null);
  const [freeLeads, setFreeLeads] = useState<any[]>([]);
  const [checkoutLeads, setCheckoutLeads] = useState<any[]>([]);
  const [broadcastAudience, setBroadcastAudience] = useState<'premium' | 'free' | 'all'>('premium');
  const [broadcastTeam, setBroadcastTeam] = useState('');
  const adminGenerationRef = useRef(0);
  const adminRequestControllerRef = useRef(new AbortController());

  const clearAdminAccess = () => {
    adminGenerationRef.current += 1;
    adminRequestControllerRef.current.abort();
    adminRequestControllerRef.current = new AbortController();
    setIsAuthenticated(false);
    setSubscribers([]);
    setBroadcasts([]);
    setAnalyticsEvents([]);
    setKvNamespaceScan(null);
    setFreeLeads([]);
    setCheckoutLeads([]);
    setResult(null);
    setSubject('');
    setBody('');
    setCode('');
    setSending(false);
    setLoading(false);
    window.dispatchEvent(new Event('adminAuthCleared'));
  };

  const adminFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const generation = adminGenerationRef.current;
    const response = await fetch(input, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? adminRequestControllerRef.current.signal,
    });
    if (generation !== adminGenerationRef.current) {
      throw new Error('Administrator request was invalidated');
    }
    if (response.status === 401) {
      clearAdminAccess();
      setLoginError('Your administrator session has expired. Request a new code to continue.');
      throw new Error('Administrator session expired');
    }
    return response;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        const session = await res.json().catch(() => ({}));
        if (active) setIsAuthenticated(res.ok && session?.admin === true);
      } catch {
        if (active) setIsAuthenticated(false);
      } finally {
        if (active) setAuthChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (logoutPending) return;
    setAuthSubmitting(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/admin/request', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response?.error || 'Could not send login code');
      setLoginStep('code');
    } catch (error: any) {
      setLoginError(error?.message || 'Could not send login code');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (logoutPending) return;
    setAuthSubmitting(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/admin/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok || response?.admin !== true) {
        throw new Error(response?.error || 'Invalid or expired code');
      }
      setIsAuthenticated(true);
      adminGenerationRef.current += 1;
      adminRequestControllerRef.current.abort();
      adminRequestControllerRef.current = new AbortController();
      setCode('');
      window.dispatchEvent(new Event('adminAuthChanged'));
    } catch (error: any) {
      setLoginError(error?.message || 'Invalid or expired code');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    clearAdminAccess();
    const logoutController = new AbortController();
    const logoutTimeout = window.setTimeout(() => logoutController.abort(), 10_000);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        signal: logoutController.signal,
      });
      if (!response.ok) {
        throw new Error('Server logout failed');
      }
      window.location.hash = "matches";
    } catch {
      setLoginError('Could not confirm server logout. Local administrator data was cleared.');
    } finally {
      window.clearTimeout(logoutTimeout);
      setLogoutPending(false);
    }
  };

  const generateReviewEmail = () => {
    if (!data?.betLog || data.betLog.length === 0) {
      alert("No bet log data available");
      return;
    }
    
    const settledBets = data.betLog.filter((b: any) => b.result !== 'P');
    if (settledBets.length === 0) {
      alert("No settled bets available yet");
      return;
    }
    
    const maxRound = Math.max(...settledBets.map((b: any) => b.round));
    const roundBets = settledBets.filter((b: any) => b.round === maxRound);
    
    const totalProfit = roundBets.reduce((sum: number, b: any) => sum + b.profit, 0).toFixed(2);
    const profitStr = Number(totalProfit) > 0 ? `+${totalProfit}` : totalProfit;
    
    const betsBeatingClv = roundBets.filter((b: any) => b.clv > 0).length;
    const totalBets = roundBets.length;
    const valuePlays = roundBets.filter((b: any) => b.overlay > 0).length;
    
    setSubject(`RightEdge: Round ${maxRound} Ledger Review 📊`);
    setBody(adminEmailShell(
      `Round ${maxRound} ledger review is ready.`,
      'Ledger',
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Round ${maxRound} review</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">The round is complete.</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            The model found significant closing line value in ${betsBeatingClv} of ${totalBets} matches, resulting in <strong style="color:#ffffff;">${profitStr} units of profit</strong>. ${betsBeatingClv}/${valuePlays} value plays beat the CLV.
          </div>
          ${adminEmailCtaHtml('https://www.rightedge.com.au/#results', 'View Full Ledger ->')}
        </div>`
    ));
  };

  const generateLookaheadEmail = () => {
    if (!data?.predictions || data.predictions.length === 0) {
      alert("No predictions data available");
      return;
    }
    
    const officialPlays = data.predictions.filter((p: any) => p.bestBet && p.stake > 0);
    const valuePlaysCount = officialPlays.length;
    
    const upcomingMatches = data.predictions.slice(0, 3);
    const maxRound = data.predictions[0]?.fixture?.round || 'Upcoming';
    
    // Performance stats
    const settled = data.betLog?.filter((row: any) => row.result !== 'P') || [];
    const totalProfit = settled.reduce((sum: number, row: any) => sum + row.profit, 0);
    const totalStaked = settled.reduce((sum: number, row: any) => sum + row.stake, 0);
    const roi = totalStaked ? (totalProfit / totalStaked) * 100 : 0;
    const wins = settled.filter((row: any) => row.result === 'W' || row.result === 'HW').length;
    const losses = settled.filter((row: any) => row.result === 'L' || row.result === 'HL').length;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
    
    const profitStr = totalProfit > 0 ? `+${totalProfit.toFixed(1)}` : totalProfit.toFixed(1);
    const roiStr = roi > 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`;

    let previewHtml = '';
    upcomingMatches.forEach((p: any) => {
      const favProb = p.modelHomeOdds < p.modelAwayOdds ? (1/p.modelHomeOdds)*100 : (1/p.modelAwayOdds)*100;
      
      previewHtml += `
      <div style="background:#16161D;border:1px solid #1E1E2E;padding:16px 18px;margin-bottom:12px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="70%">
              <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.3;color:#ffffff;font-weight:600;letter-spacing:-0.01em;margin-bottom:5px;">${escapeHtml(p.homeTeam)} vs ${escapeHtml(p.awayTeam)}</div>
              <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;color:#9CA3AF;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">
                PROJ: ${escapeHtml(p.homeTeam)} ${escapeHtml(p.predictedHomeScore)} - ${escapeHtml(p.predictedAwayScore)} ${escapeHtml(p.awayTeam)}
              </div>
            </td>
            <td width="30%" align="right">
               <div style="background:#111116;border:1px solid #1E1E2E;padding:8px 10px;display:inline-block;text-align:left;">
                 <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:9px;color:#9CA3AF;text-transform:uppercase;margin-bottom:3px;font-weight:500;letter-spacing:0.1em;">Model</div>
                 <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;color:#00E676;font-weight:600;">${favProb.toFixed(1)}%</div>
               </div>
            </td>
          </tr>
        </table>
      </div>
      `;
    });
    
    setSubject(`RightEdge: Round ${maxRound} Lookahead 🎯`);
    setBody(adminEmailShell(
      `Round ${maxRound} lookahead is ready.`,
      'Lookahead',
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Round ${maxRound} lookahead</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">The next card is ready.</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            The model has identified <strong style="color:#ffffff;">${valuePlaysCount} official plays</strong> across the slate based on strict mathematical edge.
          </div>
          ${adminEmailCtaHtml('https://www.rightedge.com.au/#matches', 'View Free Round Predictions ->')}
        </div>

        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:16px;padding:22px 24px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">Predictions preview</div>
          ${previewHtml}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;margin-left:-6px;margin-right:-6px;">
          <tr>
            ${adminMetricCardHtml('Profit', `${profitStr}u`, totalProfit > 0 ? 'positive' : 'default')}
            ${adminMetricCardHtml('ROI', roiStr, roi > 0 ? 'positive' : 'default')}
            ${adminMetricCardHtml('Win Rate', `${winRate.toFixed(1)}%`)}
          </tr>
        </table>

        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:6px;padding:22px 24px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#9CA3AF;">Premium shows the filtered plays, try scorer signals and live market context.</div>
          ${adminEmailCtaHtml('https://www.rightedge.com.au/#best-bets', 'View Premium Plays ->', 'secondary')}
        </div>`
    ));
  };

  const generateTeamPlayEmail = async () => {
    if (!broadcastTeam) {
      alert("Choose a team first.");
      return;
    }
    if (!data?.predictions || data.predictions.length === 0) {
      alert("No predictions data available");
      return;
    }

    const selectedTeam = broadcastTeam;
    const teamPrediction = data.predictions.find((row: any) =>
      teamMatchesName(selectedTeam, row.homeTeam) || teamMatchesName(selectedTeam, row.awayTeam)
    );

    if (!teamPrediction) {
      alert(`No current match found for ${selectedTeam}.`);
      return;
    }

    let premiumPlay: any = null;
    try {
      const rawOdds = await fetchAdminLiveOdds();
      premiumPlay = getBestBetrPlayForTeam(teamPrediction, selectedTeam, rawOdds);
    } catch (err) {
      console.warn('[AdminDashboard] Could not load premium play odds for team email:', err);
    }

    const isHomeTeam = teamMatchesName(selectedTeam, teamPrediction.homeTeam);
    const opponent = isHomeTeam ? teamPrediction.awayTeam : teamPrediction.homeTeam;
    const teamScore = isHomeTeam ? teamPrediction.predictedHomeScore : teamPrediction.predictedAwayScore;
    const opponentScore = isHomeTeam ? teamPrediction.predictedAwayScore : teamPrediction.predictedHomeScore;
    const teamModelOdds = isHomeTeam ? teamPrediction.modelHomeOdds : teamPrediction.modelAwayOdds;
    const teamOverlay = isHomeTeam ? teamPrediction.homeOverlay : teamPrediction.awayOverlay;
    const modelProbability = teamModelOdds > 1 ? (1 / teamModelOdds) * 100 : 0;
    const round = teamPrediction.fixture?.round || data.currentRoundLabel || "Live";
    const roundLabel = normalizeRoundLabel(round);
    const venue = teamPrediction.fixture?.stadium || "NRL";
    const kickoff = [
      teamPrediction.fixture?.day,
      teamPrediction.fixture?.dateLabel,
      teamPrediction.fixture?.aedt ? `@ ${teamPrediction.fixture.aedt} ${teamPrediction.fixture?.tz || "AEST"}` : "",
    ].filter(Boolean).join(" ");

    const teamTryScorers = (data.tryScorers || [])
      .filter((row: any) =>
        teamMatchesName(selectedTeam, row.team) &&
        String(row.match || "").toLowerCase().includes(String(opponent || "").split(" ")[0]?.toLowerCase() || "")
      )
      .sort((a: any, b: any) =>
        (Number(b.statsInsiderPct) || 0) - (Number(a.statsInsiderPct) || 0) ||
        (Number(b.edgePct) || 0) - (Number(a.edgePct) || 0)
      );
    const topScorer = teamTryScorers[0];
    const topScorerHasBetrOdds = topScorer && isBetrBookmaker(topScorer.bookmaker);
    const tryScorerPlay = topScorer
      ? {
          type: "Try Scorer",
          label: `${topScorer.player} anytime try scorer`,
          bookmaker: "Betr",
          odds: topScorerHasBetrOdds ? topScorer.bestOdds : null,
          modelPct: Number(topScorer.statsInsiderPct) || 0,
          detail: topScorerHasBetrOdds
            ? `Model try probability ${Number(topScorer.statsInsiderPct || 0).toFixed(1)}% vs Betr market ${Number(topScorer.marketImpliedPct || 0).toFixed(1)}%`
            : `Model try probability ${Number(topScorer.statsInsiderPct || 0).toFixed(1)}%. Check the live anytime try scorer price at Betr before placing.`,
        }
      : null;

    const payload = [
      "rightedge_teamemail",
      slugifyPayload(roundLabel),
      slugifyPayload(selectedTeam),
      slugifyPayload(opponent),
    ].filter(Boolean).join("_");
    const betrUrl = `${BETR_AFFILIATE_URL}?payload=${payload}`;

    const safeRound = escapeHtml(roundLabel);
    const safeTeam = escapeHtml(selectedTeam);
    const safeOpponent = escapeHtml(opponent);
    const safeVenue = escapeHtml(venue);
    const safeKickoff = escapeHtml(kickoff || "This round");
    const safeScore = escapeHtml(`${teamScore}-${opponentScore}`);
    const selectedPlay = premiumPlay || tryScorerPlay;
    if (!selectedPlay) {
      alert(`No current match or try scorer angle is available for ${selectedTeam}. Try again after the next odds sync.`);
      return;
    }
    const isTryScorerFallback = selectedPlay === tryScorerPlay && !premiumPlay;
    const primaryPlayLabel = selectedPlay.label || `${selectedTeam} head-to-head`;
    const primaryPlayType = selectedPlay.type || "Model Read";
    const primaryPlayOdds = Number(selectedPlay.odds) > 1 ? Number(selectedPlay.odds) : null;
    const primaryPlayBookmaker = selectedPlay.bookmaker || "Betr";
    const primaryModelPct = selectedPlay.modelPct || modelProbability;
    const primaryPriceLine = primaryPlayOdds
      ? `${formatMoneyOdds(primaryPlayOdds)} at ${primaryPlayBookmaker}`
      : "Check the live price at Betr";
    const primaryLivePriceCopy = primaryPlayOdds
      ? `with the live price showing as <strong style="color:#ffffff">${formatMoneyOdds(primaryPlayOdds)}</strong>.`
      : `with the live Betr price to be checked when they click through.`;
    const primarySourceCopy = isTryScorerFallback
      ? `No clean Betr match-market play is currently showing for ${safeTeam}, so this uses the strongest team-specific try scorer angle from the premium model.`
      : `This is pulled from the RightEdge Premium Plays card for ${safeTeam} v ${safeOpponent}.`;
    const primaryDetail = selectedPlay.detail || (
      Number.isFinite(teamOverlay)
        ? `Model edge ${teamOverlay > 0 ? "+" : ""}${Number(teamOverlay).toFixed(2)}% against the current head-to-head price`
        : "Live market check against the current head-to-head price"
    );
    const scorerBlock = topScorer && selectedPlay !== tryScorerPlay
      ? `
          <div style="background:#16161D;border:1px solid #1E1E2E;margin-top:16px;padding:18px 18px;">
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Try scorer signal</div>
            <div style="margin-top:8px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#9CA3AF;">
              <strong style="color:#ffffff;">${escapeHtml(topScorer.player)}</strong> is showing at <strong style="color:#ffffff;">${Number(topScorer.statsInsiderPct || 0).toFixed(1)}%</strong> model probability.
              ${topScorerHasBetrOdds
                ? `Betr is currently showing <strong style="color:#ffffff;">${formatMoneyOdds(topScorer.bestOdds) || "a live market price"}</strong>.`
                : `The anytime scorer market can be checked at Betr when they click through.`}
            </div>
          </div>`
      : "";

    setSubject(`RightEdge: ${selectedTeam} premium play for ${roundLabel}`);
    setBody(adminEmailShell(
      `One ${safeTeam} premium play from this round's card.`,
      safeRound,
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Supporter premium play</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(primaryPlayLabel)}</div>
          <div style="margin-top:8px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:22px;line-height:1.2;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(primaryPriceLine)}</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            ${primarySourceCopy}
            The model has this <strong style="color:#ffffff;">${escapeHtml(primaryPlayType)}</strong>
            at <strong style="color:#ffffff;">${Number(primaryModelPct || 0).toFixed(1)}%</strong>,
            ${primaryLivePriceCopy}
          </div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            ${safeKickoff} at ${safeVenue}. Projected score is ${safeScore}.
            <strong style="color:#ffffff;">${escapeHtml(primaryDetail)}</strong>.
          </div>
          ${scorerBlock}
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
            <tr>
              <td style="background:#093AD3;border:1px solid #093AD3;">
                <a href="${betrUrl}" rel="noopener noreferrer sponsored" target="_blank" style="display:inline-block;padding:14px 18px;color:#ffffff;text-decoration:none;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.2;font-weight:600;letter-spacing:-0.01em;">View ${safeTeam} markets at Betr -></a>
              </td>
            </tr>
          </table>
          <div style="margin-top:10px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#6B7280;">Payload: ${escapeHtml(payload)}</div>
        </div>

        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:16px;padding:22px 24px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#9CA3AF;">Free shows the model read. Premium shows where to act. The full ${safeRound} card is live now.</div>
          ${adminEmailCtaHtml('https://www.rightedge.com.au/#best-bets', 'Unlock Premium - $14/week ->', 'secondary')}
        </div>`
    ));
  };

  const fetchData = async () => {
    const generation = adminGenerationRef.current;
    const commitIfCurrent = (update: () => void) => {
      if (generation !== adminGenerationRef.current) return false;
      update();
      return true;
    };
    try {
      setLoading(true);
      // Fetch subscribers
      const subRes = await adminFetch(`/api/admin/subscribers`, {
        credentials: 'include',
      });
      if (subRes.ok) {
        const data = await subRes.json();
        if (!commitIfCurrent(() => setSubscribers(data))) return;
      }
      
      // Fetch broadcast history
      const broadRes = await adminFetch(`/api/admin/broadcasts`, {
        credentials: 'include',
      });
      if (broadRes.ok) {
        const data = await broadRes.json();
        if (!commitIfCurrent(() => setBroadcasts(data))) return;
      }
      
      // Fetch advanced analytics data — server now returns up to 30 days of
      // events with a 10 000-row limit so client-side time filters have a
      // full dataset to work against.
      const analyticsRes = await adminFetch(`/api/admin/analytics-events`, {
        credentials: 'include',
      });
      if (analyticsRes.ok) {
        const raw = await analyticsRes.json();
        // Guard: the endpoint may return an error object instead of an array
        if (Array.isArray(raw)) {
          console.log(`[AdminDashboard] Loaded ${raw.length} analytics events (30-day window)`);
          if (!commitIfCurrent(() => setAnalyticsEvents(raw))) return;
        } else {
          console.error('[AdminDashboard] analytics-events returned non-array:', raw);
          if (!commitIfCurrent(() => setAnalyticsEvents([]))) return;
        }
      } else {
        console.error('[AdminDashboard] analytics-events request failed:', analyticsRes.status, await analyticsRes.text());
        if (!commitIfCurrent(() => setAnalyticsEvents([]))) return;
      }

      // ── Full KV namespace scan: reveals ALL key prefixes in the table ──────
      // This answers whether older traffic data lived under a different key
      // pattern (e.g. traffic:, pageview:, visit:) before the analytics:event:
      // system was introduced.
      try {
        const nsRes = await adminFetch(`/api/admin/kv-namespace-scan`, {
          credentials: 'include',
        });
        if (nsRes.ok) {
          const nsData = await nsRes.json();
          console.log('[AdminDashboard] KV namespace scan:', nsData);
          if (!commitIfCurrent(() => setKvNamespaceScan(nsData))) return;
        } else {
          console.error('[AdminDashboard] kv-namespace-scan failed:', nsRes.status);
        }
      } catch (nsErr) {
        if (generation !== adminGenerationRef.current) return;
        console.error('[AdminDashboard] kv-namespace-scan error:', nsErr);
      }

      // ── Free Leads ───��──────────────────────────��─────────────────────────
      try {
        const leadsRes = await adminFetch(`/api/admin/free-access`, {
          credentials: 'include',
        });
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          console.log('[AdminDashboard] Free leads:', leadsData);
          if (!commitIfCurrent(() => setFreeLeads(leadsData))) return;
        } else {
          console.error('[AdminDashboard] free-leads failed:', leadsRes.status);
        }
      } catch (leadsErr) {
        if (generation !== adminGenerationRef.current) return;
        console.error('[AdminDashboard] free-leads error:', leadsErr);
      }

      // ── Checkout Leads ─────────────────────────────────────────────────────
      try {
        const clRes = await adminFetch(`/api/admin/checkout-leads`, {
          credentials: 'include',
        });
        if (clRes.ok) {
          const clData = await clRes.json();
          console.log('[AdminDashboard] Checkout leads:', clData);
          if (!commitIfCurrent(() => setCheckoutLeads(clData))) return;
        } else {
          console.error('[AdminDashboard] checkout-leads failed:', clRes.status);
        }
      } catch (clErr) {
        if (generation !== adminGenerationRef.current) return;
        console.error('[AdminDashboard] checkout-leads error:', clErr);
      }
    } catch (err) {
      if (generation !== adminGenerationRef.current) return;
      console.error('Failed to fetch admin data', err);
    } finally {
      if (generation === adminGenerationRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  // ── Client-side time filter ────────────────────────────────────────────────
  // analyticsEvents already contains up to 30 days of raw data fetched on
  // mount.  We slice it down here based on the selected period every render,
  // so switching Today / 7 Days / 30 Days never needs a new network request.

  // ── Step 1: Build a set of visitor_ids that are known-internal ──────────────
  // If ANY event from a visitor has is_internal=true, OR carries a known
  // internal visitor_email, ALL events from that visitor_id are treated as
  // internal. This retroactively catches:
  //   • Historical sessions where the flag wasn't set on the first pageview
  //   • Anonymous sessions that later became identifiable via email login
  const INTERNAL_EMAILS_DASHBOARD = ['elliott@woodbry.com', 'ewoodbry@gmail.com'];

  const internalVisitorIds = new Set<string>(
    analyticsEvents
      .filter(e =>
        e.is_internal === true ||
        (e.visitor_email && INTERNAL_EMAILS_DASHBOARD.includes(e.visitor_email.toLowerCase()))
      )
      .map(e => e.visitor_id)
      .filter(Boolean)
  );

  const isEventInternal = (e: any): boolean =>
    e.is_internal === true ||
    internalVisitorIds.has(e.visitor_id) ||
    (e.visitor_email && INTERNAL_EMAILS_DASHBOARD.includes(e.visitor_email.toLowerCase()));

  // ── Step 2: Apply time window ───────────────────────────────────────────────
  const timeWindowedEvents = analyticsEvents.filter(e => {
    if (!e.timestamp) return false;
    const eventTime = new Date(e.timestamp).getTime();
    if (isNaN(eventTime)) return false;
    const now = Date.now();
    if (timeFilter === 'today') {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (eventTime < todayMidnight.getTime()) return false;
    } else if (timeFilter === '7d') {
      if (eventTime < now - 7 * 24 * 60 * 60 * 1000) return false;
    } else if (timeFilter === '30d') {
      if (eventTime < now - 30 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  // ── Step 3: Split into internal vs external ─────────────────────────────────
  const internalEvents = timeWindowedEvents.filter(e => isEventInternal(e));
  const externalEvents = timeWindowedEvents.filter(e => !isEventInternal(e));

  // The active dataset the rest of the dashboard reads from
  const filteredEvents = excludeInternal ? externalEvents : timeWindowedEvents;

  // ── Debug counts (shown in the debug panel) ─────────────────────────────────
  const debugInternalCount = internalEvents.length;
  const debugExternalCount = externalEvents.length;
  const debugInternalSubs = new Set(
    internalEvents.filter(e => e.type === 'login_success').map(e => e.visitor_id)
  ).size;

  // Calculate Aggregates
  const totalPageviews = filteredEvents.filter(e => e.type.includes('view')).length;
  const uniqueVisitors = new Set(filteredEvents.map(e => e.visitor_id)).size;
  const totalSessions = new Set(filteredEvents.map(e => e.session_id)).size;
  const externalVisitors = new Set(filteredEvents.filter(e => !isEventInternal(e)).map(e => e.visitor_id)).size;

  // Funnel — unique visitors at each step (a visitor counted once per stage max)
  const visitorsWhoClicked = new Set(filteredEvents.filter(e => e.type === 'unlock_click').map(e => e.visitor_id));
  const visitorsWhoReachedPaywall = new Set(filteredEvents.filter(e => e.type === 'paywall_view').map(e => e.visitor_id));
  const visitorsWhoDismissed = new Set(filteredEvents.filter(e => e.type === 'paywall_dismiss').map(e => e.visitor_id));
  const visitorsWhoStartedCheckout = new Set(filteredEvents.filter(e => e.type === 'checkout_start').map(e => e.visitor_id));
  const visitorsWhoConverted = new Set(filteredEvents.filter(e => e.type === 'login_success').map(e => e.visitor_id));

  const unlockClicks = visitorsWhoClicked.size;
  const paywallReached = visitorsWhoReachedPaywall.size;
  const paywallDismissed = visitorsWhoDismissed.size;
  const checkoutStarts = visitorsWhoStartedCheckout.size;
  const conversions = visitorsWhoConverted.size;
  const conversionRate = uniqueVisitors > 0 ? ((conversions / uniqueVisitors) * 100).toFixed(1) : '0.0';

  // ── Period-filtered new subscribers (from KV subscribedAt timestamp) ─────────
  const newSubscribersInPeriod = subscribers.filter((s: any) => {
    if (!s.subscribedAt) return false;
    const t = new Date(s.subscribedAt).getTime();
    if (isNaN(t)) return false;
    if (excludeInternal && s.email && INTERNAL_EMAILS_DASHBOARD.includes(s.email.toLowerCase())) return false;
    const now = Date.now();
    if (timeFilter === 'today') {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      return t >= todayMidnight.getTime();
    } else if (timeFilter === '7d') {
      return t >= now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeFilter === '30d') {
      return t >= now - 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  }).length;

  // ── Checkout lead conversion stats (from KV records, not analytics events) ──
  const totalCheckoutLeads = checkoutLeads.length;
  const completedCheckoutLeads = checkoutLeads.filter(l => l.completed_subscription === true).length;
  const abandonedCheckoutLeads = totalCheckoutLeads - completedCheckoutLeads;
  const checkoutConversionRate = totalCheckoutLeads > 0
    ? ((completedCheckoutLeads / totalCheckoutLeads) * 100).toFixed(1)
    : '0.0';

  // CTA source breakdown — unique visitors per button label
  const ctaSourceStats = filteredEvents
    .filter(e => e.type === 'unlock_click' && e.cta_source)
    .reduce((acc: Record<string, Set<string>>, e) => {
      const src = e.cta_source as string;
      if (!acc[src]) acc[src] = new Set();
      acc[src].add(e.visitor_id);
      return acc;
    }, {});

  const ctaLabels: Record<string, string> = {
    hero_unlock_best_bets: 'Hero — Unlock Best Bets',
    featured_match_card: 'Match Card — Unlock Match',
    featured_view_predictions: 'Match Card — View Predictions',
    methodology_view_predictions: 'How It Works — View Predictions',
    unknown: 'Other / Unknown',
  };

  // Group by Source
  const sourceStats = filteredEvents.reduce((acc: any, e) => {
    const src = e.utm_source || 'unknown';
    if (!acc[src]) acc[src] = { views: 0, visitors: new Set(), conversions: 0 };
    if (e.type.includes('view')) acc[src].views++;
    acc[src].visitors.add(e.visitor_id);
    if (e.type === 'subscription_success') acc[src].conversions++;
    return acc;
  }, {});

  // Group by Landing Page
  const landingStats = filteredEvents.reduce((acc: any, e) => {
    const path = e.path || '/';
    if (!acc[path]) acc[path] = { views: 0, visitors: new Set() };
    if (e.type.includes('view')) acc[path].views++;
    acc[path].visitors.add(e.visitor_id);
    return acc;
  }, {});

  const getBroadcastRecipients = () => {
    const teamMatches = (rowTeam: string) =>
      !broadcastTeam || String(rowTeam || '').toLowerCase() === broadcastTeam.toLowerCase();

    const freeMap = new Map<string, any>(
      freeLeads
        .map((lead: any) => [String(lead.email || '').toLowerCase(), lead] as const)
        .filter(([email]) => Boolean(email))
    );

    const subscriberMap = new Map<string, any>(
      subscribers
        .map((sub: any) => [String(sub.email || '').toLowerCase(), sub] as const)
        .filter(([email]) => Boolean(email))
    );

    if (broadcastAudience === 'free') {
      return [...freeMap.values()].filter((lead: any) => teamMatches(lead.favoriteTeam || ''));
    }

    if (broadcastAudience === 'premium') {
      return [...subscriberMap.values()].filter((sub: any) => teamMatches(sub.favoriteTeam || ''));
    }

    const merged = new Map<string, any>();
    [...freeMap.values(), ...subscriberMap.values()].forEach((row: any) => {
      const email = String(row.email || '').toLowerCase();
      if (!email) return;
      if (!merged.has(email) || String(merged.get(email)?.favoriteTeam || '') === '') {
        merged.set(email, row);
      }
    });

    return [...merged.values()].filter((row: any) => teamMatches(row.favoriteTeam || ''));
  };
  const broadcastRecipients = getBroadcastRecipients();
  const broadcastRecipientCount = broadcastRecipients.length;

  const handleSendEmail = async () => {
    if (!subject || !body) return;
    const generation = adminGenerationRef.current;
    
    const audienceLabel = broadcastAudience === 'premium'
      ? 'premium subscribers'
      : broadcastAudience === 'free'
      ? 'free leads'
      : 'all matching contacts';
    const teamLabel = broadcastTeam ? ` for ${broadcastTeam}` : '';

    if (!confirm(testMode ? "Send test email?" : `DANGER! Send live email to ${broadcastRecipientCount} ${audienceLabel}${teamLabel}?`)) {
      return;
    }

    try {
      setSending(true);
      setResult(null);
      const recipientEmails = broadcastRecipients
        .map((recipient: any) => String(recipient?.email || '').trim().toLowerCase())
        .filter(Boolean);
      const guardedPayload = {
        audience: broadcastAudience,
        team: broadcastTeam,
        expectedRecipientCount: broadcastRecipientCount,
        recipientEmails: testMode ? [] : recipientEmails,
      };

      if (!testMode) {
        const validationRes = await adminFetch(`/api/admin/broadcast/validate-recipients`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(guardedPayload)
        });
        const validationData = await validationRes.json().catch(() => ({}));
        if (generation !== adminGenerationRef.current) return;

        if (!validationRes.ok || validationData?.guardVersion !== 1) {
          setResult({
            error: validationData?.error || 'Recipient safety guard is not deployed yet. Nothing was sent.'
          });
          return;
        }
      }

      const res = await adminFetch(`/api/admin/broadcast`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          htmlContent: body,
          testMode,
          ...guardedPayload,
        })
      });
      const data = await res.json();
      if (generation !== adminGenerationRef.current) return;
      setResult(data);
      if (res.ok) {
        setSubject('');
        setBody('');
        fetchData();
      }
    } catch (err: any) {
      if (generation !== adminGenerationRef.current) return;
      setResult({ error: err.message || 'Network error' });
    } finally {
      if (generation === adminGenerationRef.current) setSending(false);
    }
  };

  if (authChecking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/60">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="bg-[#1A1D24] border-2 border-white/10 p-8 max-w-md w-full shadow-[4px_4px_0_0_#00E676]">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#00E676]/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#00E676]" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white text-center uppercase tracking-tighter mb-2">Admin Access</h2>
          <p className="mb-6 text-center text-xs font-mono text-white/50">
            Sign in with a one-time code sent to an approved admin address.
          </p>

          <form
            onSubmit={loginStep === 'email' ? handleRequestCode : handleVerifyCode}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginStep === 'code' || authSubmitting || logoutPending}
                autoComplete="email"
                className="w-full bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-[#00E676] font-mono text-sm disabled:opacity-60"
                placeholder="Admin Email"
                required
              />
            </div>

            {loginStep === 'code' && (
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Eight-character code</label>
                <input
                  type="text"
                  pattern="[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(normalizeAdminCodeInput(e.target.value))}
                  disabled={authSubmitting || logoutPending}
                  autoComplete="one-time-code"
                  className="w-full bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-[#00E676] font-mono text-lg tracking-[0.35em] disabled:opacity-60"
                  placeholder="AB3D9K7P"
                  required
                  autoFocus
                />
              </div>
            )}

            {loginError && (
              <div className="text-[#FF3366] text-xs font-bold font-mono">{loginError}</div>
            )}

            <button
              type="submit"
              disabled={authSubmitting || logoutPending || (loginStep === 'code' && code.length !== 8)}
              className="w-full bg-[#00E676] text-black py-4 font-black uppercase tracking-widest hover:bg-[#00E676]/90 transition-colors flex items-center justify-center gap-2 mt-4 disabled:cursor-wait disabled:opacity-60"
            >
              {authSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loginStep === 'email' ? 'Send code' : 'Verify code'}
            </button>

            {loginStep === 'code' && (
              <button
                type="button"
                onClick={() => {
                  setLoginStep('email');
                  setCode('');
                  setLoginError('');
                }}
                className="w-full text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white"
              >
                Use another email
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1A1D24] border-2 border-white/10 p-6 gap-4 shadow-[4px_4px_0_0_#00E676]">
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
          <Lock className="w-6 h-6 text-[#00E676]" />
          Admin Control Center
        </h1>
        <div className="flex items-center gap-4">
          {onNavigateAdStudio && (
            <button 
              onClick={onNavigateAdStudio}
              className="bg-white/10 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Manage Ads
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="text-xs font-bold text-white/50 uppercase tracking-widest hover:text-[#FF3366] transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          {/* Paid Subscribers */}
          <div className="bg-[#1A1D24] border-2 border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#00E676] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Paid Subscribers
              </h2>
              <button 
                onClick={fetchData} 
                disabled={loading}
                className="text-white/50 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="text-5xl font-black text-white tracking-tighter mb-2">
              {loading ? '-' : subscribers.length}
            </div>
            <div className="text-xs text-white/50 uppercase tracking-widest">Completed subscriptions</div>

            {subscribers.length > 0 && (
              <div className="mt-4 space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar border-t border-white/10 pt-3">
                {subscribers.map((s: any, i: number) => (
                  <div key={i} className="text-xs font-mono text-white/60 truncate flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0"></span>
                    {s.email || s}
                    {s.subscribedAt && (
                      <span className="text-white/30 ml-auto shrink-0">
                        {new Date(s.subscribedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Leads — emails saved at checkout-start, before Stripe */}
          <div className="bg-[#1A1D24] border-2 border-[#FF9900]/40 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[#FF9900] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Checkout Leads
              </h2>
              <span className="text-2xl font-black text-white">{loading ? '-' : totalCheckoutLeads}</span>
            </div>
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">
              Email captured at checkout start
            </div>

            {/* Conversion rate bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Conversion rate</span>
                <span className={`text-sm font-black ${completedCheckoutLeads > 0 ? 'text-[#00E676]' : 'text-white/40'}`}>
                  {checkoutConversionRate}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 w-full">
                <div
                  className="h-full bg-[#00E676] transition-all"
                  style={{ width: `${Math.min(100, parseFloat(checkoutConversionRate))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-mono">
                <span className="text-[#00E676]">{completedCheckoutLeads} converted</span>
                <span className="text-[#FF2E63]">{abandonedCheckoutLeads} abandoned</span>
              </div>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar border-t border-white/10 pt-3">
              {checkoutLeads.length === 0 ? (
                <div className="text-xs text-white/30 font-mono italic">No checkout leads yet.</div>
              ) : (
                checkoutLeads.map((lead: any, i: number) => (
                  <div key={i} className={`bg-black/40 border-l-2 px-3 py-2 ${lead.completed_subscription ? 'border-[#00E676]/60' : 'border-[#FF9900]/40'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-white truncate">{lead.email}</div>
                      <span className={`text-[9px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 ${lead.completed_subscription ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-[#FF9900]/15 text-[#FF9900]'}`}>
                        {lead.completed_subscription ? 'Paid' : 'Abandoned'}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5 flex gap-2 flex-wrap">
                      <span>{lead.created_at ? new Date(lead.created_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                      {lead.utm_source && <span>· {lead.utm_source}</span>}
                      {(lead.attempt_count || 0) > 1 && <span>· {lead.attempt_count}× attempts</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Free Leads — emails captured via the "Unlock Featured Match" free gate */}
          <div className="bg-[#1A1D24] border-2 border-[#0047FF]/50 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[#0047FF] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                Free Leads
              </h2>
              <span className="text-2xl font-black text-white">{loading ? '-' : freeLeads.length}</span>
            </div>
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-4">
              Unlocked featured match — no payment
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {freeLeads.length === 0 ? (
                <div className="text-xs text-white/30 font-mono italic">No free leads yet.</div>
              ) : (
                freeLeads.map((lead: any, i: number) => (
                  <div key={i} className="bg-black/40 border-l-2 border-[#0047FF]/60 px-3 py-2">
                    <div className="text-xs font-mono text-white truncate">{lead.email}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {lead.registeredAt
                        ? new Date(lead.registeredAt).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                      {lead.source ? ` · ${lead.source}` : ''}
                      {lead.favoriteTeam ? ` · ${lead.favoriteTeam}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#1A1D24] border-2 border-white/10 p-6">
            <h2 className="text-[#00E676] font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-4">
              <RefreshCw className="w-4 h-4" />
              Recent Broadcasts
            </h2>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {broadcasts.length === 0 ? (
                <div className="text-xs text-white/30 font-mono italic">No broadcasts found.</div>
              ) : (
                broadcasts.map((b, i) => (
                  <div key={i} className="bg-black/40 p-3 text-xs font-mono border-l-2 border-[#00E676]">
                    <div className="text-white font-bold mb-1 truncate">{b.subject}</div>
                    <div className="flex justify-between text-white/50 text-[10px]">
                      <span>{b.recipients} recipients</span>
                      <span>{new Date(b.sentAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          {/* Advanced Analytics Panel */}
          <div className="bg-[#1A1D24] border-2 border-[#00E676]/30 p-6 shadow-[4px_4px_0_0_#00E676]/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/10">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-[#00E676]" />
                Traffic Analytics
              </h2>
              
              <div className="flex items-center gap-4 bg-black/40 p-1 border border-white/10">
                <button 
                  onClick={() => setTimeFilter('today')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${timeFilter === 'today' ? 'bg-[#00E676] text-black' : 'text-white/50 hover:text-white'}`}
                >Today</button>
                <button 
                  onClick={() => setTimeFilter('7d')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${timeFilter === '7d' ? 'bg-[#00E676] text-black' : 'text-white/50 hover:text-white'}`}
                >7 Days</button>
                <button 
                  onClick={() => setTimeFilter('30d')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${timeFilter === '30d' ? 'bg-[#00E676] text-black' : 'text-white/50 hover:text-white'}`}
                >30 Days</button>
                <div className="w-px h-4 bg-white/20 mx-1"></div>
                <button
                  onClick={() => setExcludeInternal(!excludeInternal)}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${excludeInternal ? 'text-[#00E676]' : 'text-white/50 hover:text-white'}`}
                  title="Toggle hiding traffic marked as internal (your own traffic)"
                >
                  <Globe className="w-3 h-3" />
                  {excludeInternal ? 'Real Users' : 'All Traffic'}
                </button>
              </div>
            </div>

            {/* Debug Panel */}
            <div className="bg-black/60 border border-[#00E676]/30 p-4 mb-6 text-xs font-mono">
              <div className="text-[#00E676] font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" /> Analytics Data Status
              </div>

              {/* ── Row 1: current filter context (derived from loaded event payloads) ── */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <div className="text-white/40 mb-1">Period</div>
                  <div className="text-white font-bold">{timeFilter}</div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">Fetched (30d)</div>
                  <div className="text-white font-bold">{analyticsEvents.length}</div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">Filtered</div>
                  <div className="text-white font-bold">{filteredEvents.length}</div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">Earliest event</div>
                  <div
                    className="text-white font-bold truncate"
                    title={analyticsEvents.length > 0 ? new Date(Math.min(...analyticsEvents.map(e => new Date(e.timestamp || 0).getTime()))).toLocaleString() : 'N/A'}
                  >
                    {analyticsEvents.length > 0
                      ? new Date(Math.min(...analyticsEvents.map(e => new Date(e.timestamp || 0).getTime()))).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">Latest event</div>
                  <div
                    className="text-white font-bold truncate"
                    title={analyticsEvents.length > 0 ? new Date(Math.max(...analyticsEvents.map(e => new Date(e.timestamp || 0).getTime()))).toLocaleString() : 'N/A'}
                  >
                    {analyticsEvents.length > 0
                      ? new Date(Math.max(...analyticsEvents.map(e => new Date(e.timestamp || 0).getTime()))).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* ── Internal / External split (this time window) ── */}
              <div className="grid grid-cols-3 gap-4 mb-4 pt-3 border-t border-white/10">
                <div>
                  <div className="text-white/40 mb-1">Internal excluded</div>
                  <div className="text-[#FF2E63] font-bold">{debugInternalCount}</div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">Internal subscriptions</div>
                  <div className="text-[#FF2E63] font-bold">{debugInternalSubs}</div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">External included</div>
                  <div className="text-[#00E676] font-bold">{debugExternalCount}</div>
                </div>
              </div>

              {/* ── Row 2: storage-level truth from the full KV scan ── */}
              <div className="pt-4 border-t border-white/10">
                <div className="text-white/40 mb-2 uppercase tracking-widest">Storage (all keys, unfiltered)</div>

                {kvNamespaceScan ? (() => {
                  const dateBreakdown: Record<string, number> = kvNamespaceScan.analyticsDateBreakdown ?? {};
                  const sortedDates = Object.keys(dateBreakdown).sort();
                  const analyticsRowsInDb: number = kvNamespaceScan.namespaces?.['analytics']?.count ?? 0;
                  const onlyOneDay = sortedDates.length === 1;

                  return (
                    <>
                      {/* Summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="text-white/40 mb-1">Total rows (DB)</div>
                          <div className="text-[#00E676] font-bold">{kvNamespaceScan.totalRows ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-white/40 mb-1">analytics:event rows</div>
                          <div className="text-white font-bold">{analyticsRowsInDb || '—'}</div>
                        </div>
                        <div>
                          <div className="text-white/40 mb-1">Oldest date in DB</div>
                          <div className="text-white font-bold">{sortedDates[0] ?? 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-white/40 mb-1">Newest date in DB</div>
                          <div className="text-white font-bold">{sortedDates[sortedDates.length - 1] ?? 'N/A'}</div>
                        </div>
                      </div>

                      {/* Per-date badges */}
                      {sortedDates.length > 0 && (
                        <div className="mb-3">
                          <div className="text-white/40 mb-2">Events by calendar date</div>
                          <div className="flex flex-wrap gap-2">
                            {sortedDates.map(date => (
                              <div key={date} className="bg-white/5 border border-white/10 px-2 py-1 flex items-center gap-2">
                                <span className="text-white/50">{date}</span>
                                <span className="text-[#00E676] font-bold">{String(dateBreakdown[date])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Single-day warning */}
                      {onlyOneDay && (
                        <div className="bg-[#FFEA00]/10 border border-[#FFEA00]/30 px-3 py-2 text-[#FFEA00] text-xs mb-3">
                          <span className="font-bold uppercase tracking-widest">Note — </span>
                          Only one day of analytics data currently exists in storage, so Today / 7 Days / 30 Days will show the same values until more data accumulates.
                        </div>
                      )}

                      {/* Namespace pill row */}
                      {kvNamespaceScan.namespaces && Object.keys(kvNamespaceScan.namespaces).length > 0 && (
                        <div>
                          <div className="text-white/40 mb-2">All KV prefixes</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(kvNamespaceScan.namespaces)
                              .sort(([, a]: any, [, b]: any) => b.count - a.count)
                              .map(([ns, info]: [string, any]) => (
                                <div key={ns} className="bg-white/5 border border-white/10 px-2 py-1 flex items-center gap-1.5">
                                  <span className="text-white/50">{ns}:</span>
                                  <span className="text-white font-bold">{info.count}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="text-white/30 italic">Loading storage scan…</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-black/40 border border-white/5 p-4">
                <div className="text-xs text-white/50 uppercase tracking-widest mb-1 flex items-center gap-2"><Eye className="w-3 h-3" /> Page Views</div>
                <div className="text-3xl font-black text-white">{totalPageviews}</div>
              </div>
              <div className="bg-black/40 border border-white/5 p-4">
                <div className="text-xs text-white/50 uppercase tracking-widest mb-1 flex items-center gap-2"><Users className="w-3 h-3" /> Unique Visitors</div>
                <div className="text-3xl font-black text-white">{uniqueVisitors}</div>
              </div>
              <div className="bg-black/40 border border-white/5 p-4">
                <div className="text-xs text-[#FFEA00] uppercase font-bold tracking-widest mb-1 flex items-center gap-2"><Unlock className="w-3 h-3" /> Paywall Hits</div>
                <div className="text-3xl font-black text-[#FFEA00]">{paywallReached}</div>
                {paywallDismissed > 0 && (
                  <div className="text-[10px] text-[#FF2E63]/70 mt-1 font-mono">{paywallDismissed} dismissed</div>
                )}
              </div>
              <div className="bg-black/40 border border-[#00E676]/20 p-4">
                <div className="text-xs text-[#00E676] uppercase font-bold tracking-widest mb-1 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> New Subscribers</div>
                <div className="text-3xl font-black text-[#00E676]">{newSubscribersInPeriod}</div>
                <div className="text-[10px] text-white/40 mt-1 font-mono">
                  {subscribers.length} total · {timeFilter === 'today' ? 'today' : timeFilter === '7d' ? 'last 7 days' : 'last 30 days'}
                </div>
              </div>
            </div>

            {/* Checkout pipeline summary bar */}
            {totalCheckoutLeads > 0 && (
              <div className="bg-black/40 border border-[#FF9900]/20 p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <CreditCard className="w-4 h-4 text-[#FF9900]" />
                  <span className="text-xs font-black text-[#FF9900] uppercase tracking-widest">Checkout Pipeline</span>
                </div>
                <div className="flex-1 w-full">
                  <div className="flex gap-px h-2 w-full overflow-hidden rounded-sm">
                    <div className="bg-[#00E676] h-full transition-all" style={{ width: `${checkoutConversionRate}%` }} />
                    <div className="bg-[#FF2E63]/60 h-full flex-1" />
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs font-mono shrink-0">
                  <div className="text-center">
                    <div className="text-[#FF9900] font-bold text-lg leading-none">{totalCheckoutLeads}</div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Total leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#00E676] font-bold text-lg leading-none">{completedCheckoutLeads}</div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Converted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#FF2E63] font-bold text-lg leading-none">{abandonedCheckoutLeads}</div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Abandoned</div>
                  </div>
                  <div className="text-center border-l border-white/10 pl-6">
                    <div className={`font-bold text-lg leading-none ${completedCheckoutLeads > 0 ? 'text-[#00E676]' : 'text-white/40'}`}>{checkoutConversionRate}%</div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Conv. rate</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Traffic By Source</h3>
                <div className="space-y-2">
                  {Object.entries(sourceStats).sort((a: any, b: any) => b[1].views - a[1].views).map(([src, stat]: [string, any]) => (
                    <div key={src} className="flex items-center justify-between bg-black/40 p-2 text-sm font-mono border-l-2 border-white/20">
                      <div className="text-white capitalize flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00E676]/50"></span>
                        {src}
                      </div>
                      <div className="flex gap-4 text-right">
                        <span className="text-white/50 w-16" title="Views">{stat.views} <span className="text-[10px]">v</span></span>
                        <span className="text-white/70 w-16 font-bold" title="Uniques">{stat.visitors.size} <span className="text-[10px]">u</span></span>
                        <span className="text-[#00E676] w-8 font-black" title="Conversions">{stat.conversions}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(sourceStats).length === 0 && (
                    <div className="text-white/30 text-xs italic">No traffic data for this period</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Top Landing Pages</h3>
                <div className="space-y-2">
                  {Object.entries(landingStats)
                    .sort((a: any, b: any) => b[1].views - a[1].views)
                    .slice(0, 5)
                    .map(([path, stat]: [string, any]) => (
                    <div key={path} className="flex items-center justify-between bg-black/40 p-2 text-sm font-mono border-l-2 border-white/20">
                      <div className="text-white truncate max-w-[140px]" title={path}>
                        {path}
                      </div>
                      <div className="flex gap-4 text-right">
                        <span className="text-white/50 w-12" title="Views">{stat.views} <span className="text-[10px]">v</span></span>
                        <span className="text-white/70 w-12 font-bold" title="Uniques">{stat.visitors.size} <span className="text-[10px]">u</span></span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(landingStats).length === 0 && (
                    <div className="text-white/30 text-xs italic">No page data for this period</div>
                  )}
                </div>
              </div>

              {/* Conversion Funnel — unique visitors at each step */}
              <div>
                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Paywall Funnel <span className="text-white/30 font-normal normal-case tracking-normal">(unique visitors)</span></h3>
                <div className="space-y-2">
                  {(() => {
                    const steps = [
                      { label: 'Landed on site',     count: uniqueVisitors,    color: 'bg-white/10',        text: 'text-white/70' },
                      { label: 'Clicked unlock CTA', count: unlockClicks,      color: 'bg-[#FFEA00]/15',    text: 'text-[#FFEA00]' },
                      { label: 'Reached paywall',    count: paywallReached,    color: 'bg-[#FF9900]/15',    text: 'text-[#FF9900]' },
                      { label: 'Dismissed paywall',  count: paywallDismissed,  color: 'bg-[#FF2E63]/15',    text: 'text-[#FF2E63]' },
                      { label: 'Started checkout',   count: checkoutStarts,    color: 'bg-[#0047FF]/20',    text: 'text-[#6B9FFF]' },
                      { label: 'Subscribed',         count: conversions,       color: 'bg-[#00E676]/20',    text: 'text-[#00E676]' },
                    ];
                    return steps.map((step, i) => {
                      const pct = uniqueVisitors > 0 ? Math.min(100, (step.count / uniqueVisitors) * 100) : 0;
                      const dropOff = i > 0 && steps[i - 1].count > 0
                        ? Math.round((1 - step.count / steps[i - 1].count) * 100)
                        : null;
                      return (
                        <div key={step.label} className="bg-black/40 px-2 py-1.5 relative overflow-hidden">
                          <div className={`absolute inset-y-0 left-0 ${step.color}`} style={{ width: `${pct}%` }} />
                          <div className="relative z-10 flex justify-between items-center text-xs font-mono">
                            <span className={step.text}>{step.label}</span>
                            <div className="flex items-center gap-2">
                              {dropOff !== null && step.count < steps[i - 1].count && (
                                <span className="text-[#FF2E63]/60 text-[10px]">-{dropOff}%</span>
                              )}
                              <span className="text-white font-bold w-6 text-right">{step.count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* CTA Source Breakdown */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-sm font-black text-white/70 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                Unlock CTA Breakdown <span className="text-white/30 font-normal normal-case tracking-normal">— unique visitors per button</span>
              </h3>
              {Object.keys(ctaSourceStats).length === 0 ? (
                <div className="text-white/30 text-xs italic font-mono">No CTA click data yet — clicks will appear here as visitors interact with unlock buttons.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(ctaSourceStats)
                    .sort(([, a], [, b]) => b.size - a.size)
                    .map(([src, visitors]) => {
                      const label = ctaLabels[src] ?? src;
                      const pct = unlockClicks > 0 ? Math.round((visitors.size / unlockClicks) * 100) : 0;
                      return (
                        <div key={src} className="bg-black/40 px-3 py-2 relative overflow-hidden border-l-2 border-[#FFEA00]/40">
                          <div className="absolute inset-y-0 left-0 bg-[#FFEA00]/8" style={{ width: `${pct}%` }} />
                          <div className="relative z-10 flex justify-between items-center text-xs font-mono">
                            <span className="text-white/70">{label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-white/40">{pct}% of clicks</span>
                              <span className="text-[#FFEA00] font-bold w-6 text-right">{visitors.size}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#1A1D24] border-2 border-white/10 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-[#00E676] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Broadcast Campaign
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={generateReviewEmail}
                  className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-[#00E676]/20 transition-colors"
                >
                  Generate Review
                </button>
                <button 
                  onClick={generateLookaheadEmail}
                  className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-[#00E676]/20 transition-colors"
                >
                  Generate Lookahead
                </button>
                <button
                  onClick={generateTeamPlayEmail}
                  className="bg-[#0A4DFF]/20 text-white border border-[#0A4DFF]/50 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-[#0A4DFF]/35 transition-colors"
                >
                  Generate Team Play
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono focus:border-[#00E676] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-2 flex justify-between">
                  <span>HTML Content</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full h-[300px] bg-black/40 border border-white/10 p-3 text-white/80 font-mono text-xs focus:border-[#00E676] focus:outline-none transition-colors custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Audience</label>
                  <select
                    value={broadcastAudience}
                    onChange={(e) => setBroadcastAudience(e.target.value as 'premium' | 'free' | 'all')}
                    className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono focus:border-[#00E676] focus:outline-none transition-colors"
                  >
                    <option value="premium">Premium Subscribers</option>
                    <option value="free">Free Leads</option>
                    <option value="all">Everyone With Team</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Team Filter</label>
                  <select
                    value={broadcastTeam}
                    onChange={(e) => setBroadcastTeam(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono focus:border-[#00E676] focus:outline-none transition-colors"
                  >
                    <option value="">All teams</option>
                    {NRL_TEAMS.map((team) => (
                      <option key={team} value={team} className="text-black">{team}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-black/20 border border-white/5 px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-widest text-white/40">Estimated recipients</div>
                <div className="text-sm font-black text-white">
                  {testMode ? 'Test only' : broadcastRecipientCount.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-black/20 p-4 border border-white/5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="w-4 h-4 accent-[#00E676] bg-black border-white/20"
                  />
                  <span className="text-sm font-bold uppercase tracking-widest text-white/80">Test Mode (Sends to elliott@woodbry.com)</span>
                </label>
              </div>

              {result && (
                <div className={`p-4 border ${result.error ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-[#00E676]'} text-sm font-mono flex items-start gap-3`}>
                  {result.error ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                  <div className="break-all">
                    {result.error ? result.error : `Success! Sent to ${result.sentCount} recipient(s). ${result.testMode ? '(TEST MODE)' : ''}`}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !subject || !body || (!testMode && broadcastRecipientCount === 0)}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all ${
                    sending || (!testMode && broadcastRecipientCount === 0)
                      ? 'bg-white/10 text-white/30 cursor-not-allowed'
                      : testMode
                      ? 'bg-white text-black hover:bg-white/90'
                      : 'bg-[#00E676] text-black hover:bg-[#00E676]/90 shadow-[0_0_15px_rgba(0,230,118,0.4)]'
                  }`}
                >
                  {sending ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {sending ? 'Sending...' : testMode ? 'Send Test Email' : 'Send Live Broadcast'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
