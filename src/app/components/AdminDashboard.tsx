import React, { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Mail, Users, Send, AlertTriangle, CheckCircle, RefreshCw, Eye, Lock, LogIn, Activity, TrendingUp, BarChart3, Clock, Globe, Unlock, CreditCard } from 'lucide-react';

export function AdminDashboard({ data, onNavigateAdStudio }: { data?: any, onNavigateAdStudio?: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  useEffect(() => {
    // Check if previously logged in
    if (localStorage.getItem('rightedge_admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'elliott@woodbry.com' && password === 'Freshjive01@') {
      setIsAuthenticated(true);
      setLoginError('');
      localStorage.setItem('rightedge_admin_auth', 'true');
      window.dispatchEvent(new Event('adminAuthChanged'));
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('rightedge_admin_auth');
    window.dispatchEvent(new Event('adminAuthChanged'));
    window.location.hash = "matches";
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
    setBody(`<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111317; border: 1px solid #1A1D24;">
    
    <!-- HEADER -->
    <div style="text-align: center; padding: 30px; border-bottom: 1px solid #1A1D24;">
      <h1 style="font-size: 28px; font-family: 'Arial Black', Impact, sans-serif; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase; color: #fff;">RIGHTEDGE</h1>
      <div style="color: #00E676; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 5px; text-transform: uppercase; font-family: monospace;">NRL Analytics & Value Betting</div>
    </div>
    
    <!-- HERO/HOOK -->
    <div style="padding: 30px;">
      <h2 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; color: #fff;">Round ${maxRound} Review 📊</h2>
      <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
        The round is over. Here is the fully transparent breakdown of how the model performed against the closing line in Round ${maxRound}.
      </p>
    </div>

    <!-- FEATURED CARD -->
    <div style="background-color: #1A1D24; padding: 30px; border-left: 4px solid #00E676;">
      <h3 style="margin-top: 0; color: #fff; font-family: 'Arial Black', sans-serif; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Performance Recap</h3>
      <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">The model found significant closing line value in ${betsBeatingClv} of ${totalBets} matches, resulting in <strong style="color: #fff;">${profitStr} units of profit</strong>. ${betsBeatingClv}/${valuePlays} value plays beat the CLV.</p>
      
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="https://www.rightedge.com.au/#results" style="display: block; background-color: #00E676; color: #000; padding: 16px 24px; text-decoration: none; font-weight: 900; font-size: 14px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">VIEW FULL LEDGER ➔</a>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- FOOTER -->
    <div style="padding: 30px; text-align: center; border-top: 1px solid #1A1D24;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748B; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">No fluff. Just the edge.</p>
      <p style="margin: 0; font-size: 10px; color: #475569; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">&copy; RightEdge Analytics</p>
    </div>

  </div>
</div>`);
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
      const favTeam = p.modelHomeOdds < p.modelAwayOdds ? p.homeTeam : p.awayTeam;
      
      previewHtml += `
      <div style="background-color: #1A1D24; padding: 15px 20px; border-left: 3px solid #0047FF; margin-bottom: 15px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="70%">
              <div style="font-family: 'Arial Black', Impact, sans-serif; font-size: 16px; color: #fff; text-transform: uppercase; margin-bottom: 4px;">${p.homeTeam} vs ${p.awayTeam}</div>
              <div style="font-family: monospace; font-size: 11px; color: #A1A1AA; letter-spacing: 0.5px;">
                PROJ: ${p.homeTeam} ${p.predictedHomeScore} - ${p.predictedAwayScore} ${p.awayTeam}
              </div>
            </td>
            <td width="30%" align="right">
               <div style="background-color: #111317; padding: 6px 10px; display: inline-block; text-align: left; border: 1px solid rgba(255,255,255,0.05);">
                 <div style="font-family: monospace; font-size: 9px; color: #64748B; text-transform: uppercase; margin-bottom: 2px; font-weight: bold;">WIN PROB</div>
                 <div style="font-family: 'Arial Black', sans-serif; font-size: 12px; color: #00E676;">${favProb.toFixed(1)}% ${favTeam.substring(0,3).toUpperCase()}</div>
               </div>
            </td>
          </tr>
        </table>
      </div>
      `;
    });
    
    setSubject(`RightEdge: Round ${maxRound} Lookahead 🎯`);
    setBody(`<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111317; border: 1px solid #1A1D24;">
    
    <!-- HEADER -->
    <div style="text-align: center; padding: 30px; border-bottom: 1px solid #1A1D24;">
      <h1 style="font-size: 28px; font-family: 'Arial Black', Impact, sans-serif; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase; color: #fff;">RIGHTEDGE</h1>
      <div style="color: #00E676; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 5px; text-transform: uppercase; font-family: monospace;">NRL Analytics & Value Betting</div>
    </div>
    
    <!-- HERO/HOOK -->
    <div style="padding: 30px; padding-bottom: 10px;">
      <h2 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; color: #fff;">Round ${maxRound} Lookahead 🎯</h2>
      <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
        The model has crunched the numbers for this weekend's matchups. We've identified <strong style="color: #fff;">${valuePlaysCount} official plays</strong> across the slate based on strict mathematical edge.
      </p>
    </div>

    <!-- PREDICTIONS PREVIEW LIST -->
    <div style="padding: 20px 30px;">
      <h3 style="color: #fff; font-family: 'Arial Black', sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #1A1D24; padding-bottom: 10px;">Predictions Preview</h3>
      
      ${previewHtml}
      
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px;">
        <tr>
          <td align="center">
            <a href="https://www.rightedge.com.au/#matches" style="display: block; background-color: #111317; border: 2px solid #0047FF; color: #fff; padding: 14px 24px; text-decoration: none; font-weight: 900; font-size: 13px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">VIEW ALL PROJECTIONS ➔</a>
          </td>
        </tr>
      </table>
    </div>

    <!-- BEST BETS LINK -->
    <div style="background-color: #1A1D24; padding: 30px; border-left: 4px solid #FF2E63; margin: 20px 30px 40px 30px;">
      <div style="color: #FF2E63; font-size: 11px; font-family: 'Arial Black', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">🔥 ${valuePlaysCount} MAX-CONFIDENCE PLAYS</div>
      <p style="color: #E2E8F0; font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">The model has locked in official plays for this round based on significant closing line value. Log in to see the exact edge, stakes, and targets.</p>
      
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="https://www.rightedge.com.au/#best-bets" style="display: block; background-color: #00E676; color: #000; padding: 16px 24px; text-decoration: none; font-weight: 900; font-size: 14px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">UNLOCK BEST BETS ➔</a>
          </td>
        </tr>
      </table>
    </div>

    <!-- PERFORMANCE SUMMARY -->
    <div style="padding: 25px 30px; background-color: #0F1219; border-top: 1px solid #1A1D24;">
      <h3 style="color: #64748B; font-family: 'Arial Black', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 0; margin-bottom: 20px; text-align: center;">All-Time Model Performance</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33%" align="center">
            <div style="color: #64748B; font-family: 'Arial Black', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">PROFIT</div>
            <div style="color: ${totalProfit > 0 ? '#00E676' : '#fff'}; font-family: 'Arial Black', Impact, sans-serif; font-size: 18px;">${profitStr}u</div>
          </td>
          <td width="33%" align="center" style="border-left: 1px solid #1A1D24; border-right: 1px solid #1A1D24;">
            <div style="color: #64748B; font-family: 'Arial Black', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">ROI</div>
            <div style="color: ${roi > 0 ? '#00E676' : '#fff'}; font-family: 'Arial Black', Impact, sans-serif; font-size: 18px;">${roiStr}</div>
          </td>
          <td width="33%" align="center">
            <div style="color: #64748B; font-family: 'Arial Black', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">WIN RATE</div>
            <div style="color: #fff; font-family: 'Arial Black', Impact, sans-serif; font-size: 18px;">${winRate.toFixed(1)}%</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="padding: 30px; text-align: center; border-top: 1px solid #1A1D24;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748B; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">No fluff. Just the edge.</p>
      <p style="margin: 0; font-size: 10px; color: #475569; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">&copy; RightEdge Analytics</p>
    </div>

  </div>
</div>`);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch subscribers
      const subRes = await fetch(`/api/admin/subscribers`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (subRes.ok) {
        setSubscribers(await subRes.json());
      }
      
      // Fetch broadcast history
      const broadRes = await fetch(`/api/admin/broadcasts`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (broadRes.ok) {
        setBroadcasts(await broadRes.json());
      }
      
      // Fetch advanced analytics data — server now returns up to 30 days of
      // events with a 10 000-row limit so client-side time filters have a
      // full dataset to work against.
      const analyticsRes = await fetch(`/api/analytics-events`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (analyticsRes.ok) {
        const raw = await analyticsRes.json();
        // Guard: the endpoint may return an error object instead of an array
        if (Array.isArray(raw)) {
          console.log(`[AdminDashboard] Loaded ${raw.length} analytics events (30-day window)`);
          setAnalyticsEvents(raw);
        } else {
          console.error('[AdminDashboard] analytics-events returned non-array:', raw);
          setAnalyticsEvents([]);
        }
      } else {
        console.error('[AdminDashboard] analytics-events request failed:', analyticsRes.status, await analyticsRes.text());
        setAnalyticsEvents([]);
      }

      // ── Full KV namespace scan: reveals ALL key prefixes in the table ──────
      // This answers whether older traffic data lived under a different key
      // pattern (e.g. traffic:, pageview:, visit:) before the analytics:event:
      // system was introduced.
      try {
        const nsRes = await fetch(`/api/kv-namespace-scan`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        if (nsRes.ok) {
          const nsData = await nsRes.json();
          console.log('[AdminDashboard] KV namespace scan:', nsData);
          setKvNamespaceScan(nsData);
        } else {
          console.error('[AdminDashboard] kv-namespace-scan failed:', nsRes.status);
        }
      } catch (nsErr) {
        console.error('[AdminDashboard] kv-namespace-scan error:', nsErr);
      }

      // ── Free Leads ───��──────────────────────────��─────────────────────────
      try {
        const leadsRes = await fetch(`/api/admin/free-access`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          console.log('[AdminDashboard] Free leads:', leadsData);
          setFreeLeads(leadsData);
        } else {
          console.error('[AdminDashboard] free-leads failed:', leadsRes.status);
        }
      } catch (leadsErr) {
        console.error('[AdminDashboard] free-leads error:', leadsErr);
      }

      // ── Checkout Leads ─────────────────────────────────────────────────────
      try {
        const clRes = await fetch(`/api/admin/checkout-leads`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        if (clRes.ok) {
          const clData = await clRes.json();
          console.log('[AdminDashboard] Checkout leads:', clData);
          setCheckoutLeads(clData);
        } else {
          console.error('[AdminDashboard] checkout-leads failed:', clRes.status);
        }
      } catch (clErr) {
        console.error('[AdminDashboard] checkout-leads error:', clErr);
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleSendEmail = async () => {
    if (!subject || !body) return;
    
    if (!confirm(testMode ? "Send test email?" : `DANGER! Send live email to ${subscribers.length} subscribers?`)) {
      return;
    }

    try {
      setSending(true);
      setResult(null);
      const res = await fetch(`/api/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          subject,
          htmlContent: body,
          testMode
        })
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) {
        setSubject('');
        setBody('');
        fetchData();
      }
    } catch (err: any) {
      setResult({ error: err.message || 'Network error' });
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="bg-[#1A1D24] border-2 border-white/10 p-8 max-w-md w-full shadow-[4px_4px_0_0_#00E676]">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#00E676]/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#00E676]" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white text-center uppercase tracking-tighter mb-6">Admin Access</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-[#00E676] font-mono text-sm"
                placeholder="Admin Email"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-[#00E676] font-mono text-sm"
                placeholder="••••••••"
                required
              />
            </div>
            
            {loginError && (
              <div className="text-[#FF3366] text-xs font-bold font-mono">{loginError}</div>
            )}
            
            <button
              type="submit"
              className="w-full bg-[#00E676] text-black py-4 font-black uppercase tracking-widest hover:bg-[#00E676]/90 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <LogIn className="w-5 h-5" />
              Login
            </button>
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
                  disabled={sending || !subject || !body || (!testMode && subscribers.length === 0)}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all ${
                    sending || (!testMode && subscribers.length === 0)
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
