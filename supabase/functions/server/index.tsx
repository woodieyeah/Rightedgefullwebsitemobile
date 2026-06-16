import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { Resend } from "npm:resend";
import Stripe from "npm:stripe";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
const app = new Hono().basePath('/make-server-3b84b96c');
const MATCH_ODDS_CACHE_MS = 12 * 60 * 60 * 1000;
const NRL_EVENTS_CACHE_MS = 6 * 60 * 60 * 1000;
const TRY_SCORER_ODDS_CACHE_MS = 24 * 60 * 60 * 1000;
const PREMATCH_ODDS_LOCK_PREFIX = "prematch_odds_lock";
const BLUEBET_API_BASE_URL = "https://affiliate-api.bluebet.com.au";
const BLUEBET_AFFILIATE_USER_AGENT =
  Deno.env.get("BLUEBET_AFFILIATE_USER_AGENT") || "rightedge.com.au";
const AUTH_SESSION_COOKIE = "rightedge_session";
const AUTH_SESSION_MAX_AGE_SECONDS = 7_776_000;
const STRIPE_PREMIUM_EXPECTED_PRODUCT_ID = "prod_UhpquzY3WK2YXs";
const STRIPE_PREMIUM_WEEKLY_AMOUNT_CENTS = 1400;
const STRIPE_CHECKOUT_VERSION = "2026-06-05-current-premium-product";
const STRIPE_RETENTION_COUPON_KV_KEY = "stripe_retention_coupon_id";
const STRIPE_RETENTION_OFFER_INVOICES = 2;

type AuthSessionTier = "free" | "premium";
type PremiumCheckoutPlan = "weekly" | "monthly";
type StoredAuthSession = {
  token: string;
  email: string;
  tier: AuthSessionTier;
  createdAt: string;
  expiresAt: string;
};

const PREMIUM_ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

function buildAuthSessionKey(token: string) {
  return `auth_session:${token}`;
}

function parseKvValue<T = any>(value: any): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function getStripeClient() {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(stripeKey, { apiVersion: "2023-10-16" });
}

async function resolveRetentionCouponId(stripe: Stripe) {
  const configuredCouponId = Deno.env.get("STRIPE_RETENTION_COUPON_ID")?.trim();
  if (configuredCouponId) return configuredCouponId;

  const storedCouponId = String((await kv.get(STRIPE_RETENTION_COUPON_KV_KEY)) || "").trim();
  if (storedCouponId) {
    try {
      const coupon = await stripe.coupons.retrieve(storedCouponId);
      if (!coupon.deleted && coupon.valid !== false) return storedCouponId;
    } catch (err: any) {
      console.warn("[Stripe] Stored retention coupon could not be retrieved:", err?.message || err);
    }
  }

  const coupon = await stripe.coupons.create({
    percent_off: 50,
    duration: "forever",
    name: "RightEdge 50% off",
    metadata: {
      rightedge_offer: "cancel_retention",
      invoices_to_apply: String(STRIPE_RETENTION_OFFER_INVOICES),
    },
  });

  await kv.set(STRIPE_RETENTION_COUPON_KV_KEY, coupon.id);
  return coupon.id;
}

function normalizePremiumCheckoutPlan(plan: unknown): PremiumCheckoutPlan {
  return String(plan || "").trim().toLowerCase() === "monthly" ? "monthly" : "weekly";
}

function getConfiguredPremiumStripePriceId(plan: PremiumCheckoutPlan = "weekly") {
  return plan === "monthly"
    ? Deno.env.get("STRIPE_PREMIUM_MONTHLY_PRICE_ID")?.trim() || ""
    : Deno.env.get("STRIPE_PREMIUM_WEEKLY_PRICE_ID")?.trim() || "";
}

async function getPremiumProductDefaultPriceId(stripe: Stripe) {
  const product = await stripe.products.retrieve(STRIPE_PREMIUM_EXPECTED_PRODUCT_ID, {
    expand: ["default_price"],
  });

  if (product.deleted || product.active === false) {
    throw new Error(`Premium product ${STRIPE_PREMIUM_EXPECTED_PRODUCT_ID} is not active.`);
  }

  const defaultPrice = product.default_price;
  if (!defaultPrice) {
    throw new Error(`Premium product ${STRIPE_PREMIUM_EXPECTED_PRODUCT_ID} has no default price.`);
  }

  return typeof defaultPrice === "string" ? defaultPrice : defaultPrice.id;
}

function getStripePriceProductId(price: any) {
  const product = price?.product;
  return typeof product === "string" ? product : product?.id || "";
}

async function resolvePremiumStripePriceId(stripe: Stripe, plan: PremiumCheckoutPlan = "weekly") {
  const configuredPriceId = getConfiguredPremiumStripePriceId(plan);
  const validatePrice = (price: any, priceId: string) => {
    const productId = getStripePriceProductId(price);

    if (price.active === false || productId !== STRIPE_PREMIUM_EXPECTED_PRODUCT_ID) {
      throw new Error(
        `${plan} price ${priceId} is not usable for expected product ${STRIPE_PREMIUM_EXPECTED_PRODUCT_ID}.`
      );
    }

    if (plan === "weekly") {
      const interval = String(price?.recurring?.interval || "").toLowerCase();
      const unitAmount = Number(price?.unit_amount);
      if (interval !== "week" || unitAmount !== STRIPE_PREMIUM_WEEKLY_AMOUNT_CENTS) {
        throw new Error(
          `Weekly price ${priceId} must be ${STRIPE_PREMIUM_WEEKLY_AMOUNT_CENTS} cents per week.`
        );
      }
    }
  };

  if (configuredPriceId) {
    try {
      const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
      validatePrice(configuredPrice, configuredPriceId);
      return configuredPriceId;
    } catch (err: any) {
      console.warn(`[Stripe] Could not validate configured ${plan} price ${configuredPriceId}:`, err?.message || err);
    }
  }

  if (plan === "weekly") {
    const productDefaultPriceId = await getPremiumProductDefaultPriceId(stripe);
    const productDefaultPrice = await stripe.prices.retrieve(productDefaultPriceId);
    validatePrice(productDefaultPrice, productDefaultPriceId);
    return productDefaultPriceId;
  }

  throw new Error(`No valid ${plan} premium Stripe price is configured.`);
}

function normalizeStripeSubscriptionStatus(status: unknown) {
  return String(status || "").trim().toLowerCase();
}

function isPremiumStripeStatus(status: unknown) {
  return PREMIUM_ACTIVE_STRIPE_STATUSES.has(normalizeStripeSubscriptionStatus(status));
}

async function getSubscriberByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return parseKvValue<any>(await kv.get(`subscriber:${normalizedEmail}`));
}

async function getSubscriberByStripeIds(opts: { subscriptionId?: string; customerId?: string }) {
  const subscriptionId = String(opts.subscriptionId || "").trim();
  const customerId = String(opts.customerId || "").trim();
  if (!subscriptionId && !customerId) return null;

  const subscribers = await kv.getByPrefix("subscriber:") || [];
  for (const entry of subscribers) {
    const record = parseKvValue<any>(entry);
    if (!record?.email) continue;
    if (subscriptionId && record.stripeSubscriptionId === subscriptionId) return record;
    if (customerId && record.stripeCustomerId === customerId) return record;
  }

  return null;
}

async function isPremiumSubscriberActive(email: string) {
  const subscriber = await getSubscriberByEmail(email);
  if (!subscriber) return false;

  const status = normalizeStripeSubscriptionStatus(subscriber.stripeSubscriptionStatus);
  if (!status) return true;

  return isPremiumStripeStatus(status);
}

function createAuthSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseCookieHeader(cookieHeader?: string | null) {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join("=") || "");
    return acc;
  }, {});
}

function shouldUseSecureCookie(requestUrl: string, host?: string | null, forwardedProto?: string | null) {
  if ((forwardedProto || "").toLowerCase() === "https") return true;

  const url = new URL(requestUrl);
  if (url.protocol === "https:") return true;

  const hostname = (host || url.hostname || "").split(":")[0].toLowerCase();
  return !["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function serializeCookie(name: string, value: string, options: {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}

async function createAuthSession(email: string, tier: AuthSessionTier) {
  const token = createAuthSessionToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);

  const session: StoredAuthSession = {
    token,
    email: email.trim().toLowerCase(),
    tier,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await kv.set(buildAuthSessionKey(token), JSON.stringify(session));
  return session;
}

function writeAuthSessionCookie(c: any, token: string) {
  const secure = shouldUseSecureCookie(
    c.req.url,
    c.req.header("host"),
    c.req.header("x-forwarded-proto"),
  );

  c.header(
    "Set-Cookie",
    serializeCookie(AUTH_SESSION_COOKIE, token, {
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    }),
  );
}

function clearAuthSessionCookie(c: any) {
  const secure = shouldUseSecureCookie(
    c.req.url,
    c.req.header("host"),
    c.req.header("x-forwarded-proto"),
  );

  c.header(
    "Set-Cookie",
    serializeCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    }),
  );
}

async function getAuthSessionFromRequest(c: any): Promise<StoredAuthSession | null> {
  try {
    const cookies = parseCookieHeader(c.req.header("cookie"));
    const token = cookies[AUTH_SESSION_COOKIE];
    if (!token) return null;

    const stored = await kv.get(buildAuthSessionKey(token));
    if (!stored) return null;

    const session: StoredAuthSession =
      typeof stored === "string" ? JSON.parse(stored) : stored;

    if (!session?.email || !session?.tier || !session?.expiresAt) {
      await kv.del(buildAuthSessionKey(token));
      clearAuthSessionCookie(c);
      return null;
    }

    if (Date.now() >= new Date(session.expiresAt).getTime()) {
      await kv.del(buildAuthSessionKey(token));
      clearAuthSessionCookie(c);
      return null;
    }

    return session;
  } catch (error) {
    console.error("[auth/session] Failed to read session:", error);
    return null;
  }
}

async function clearAuthSession(c: any) {
  const cookies = parseCookieHeader(c.req.header("cookie"));
  const token = cookies[AUTH_SESSION_COOKIE];
  if (token) {
    await kv.del(buildAuthSessionKey(token));
  }
  clearAuthSessionCookie(c);
}

// Mirrors the frontend ADMIN_EMAILS list (App.tsx). Server-side guard for
// admin-only write endpoints (results entry).
const ADMIN_EMAILS = [
  "elliott@woodbry.com",
  "ewoodbry@gmail.com",
  "elliott@rightedge.com.au",
];

// Returns the session only if the logged-in user is an admin, else null.
async function requireAdmin(c: any): Promise<StoredAuthSession | null> {
  const session = await getAuthSessionFromRequest(c);
  if (!session?.email) return null;
  if (!ADMIN_EMAILS.includes(session.email.toLowerCase())) return null;
  return session;
}

// Normalize a free-text match label into a stable key. Mirrors the frontend
// getMatchPairKeyFromLabel (sorted, normalized team pair) so client + server
// agree even if the client forgets to send a pre-normalized matchKey.
function normalizeServerMatchKey(match: string): string {
  const raw = String(match || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+v\s+/i);
  const normalizeTeam = (team: string) =>
    String(team || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  if (parts.length === 2) {
    return [normalizeTeam(parts[0]), normalizeTeam(parts[1])]
      .sort((a, b) => a.localeCompare(b))
      .join("__");
  }
  return raw.toLowerCase();
}

function buildPlaySnapshotKey(round: number, matchKey: string) {
  return `play_snapshot:${round}:${matchKey}`;
}

function buildRoundResultKey(round: number, matchKey: string) {
  return `round_result:${round}:${matchKey}`;
}

// Enable logger
app.use('*', logger(console.log));

// Inject Round 2 Review into DB once
(async () => {
  try {
    await kv.set(`broadcast:round-2-review-test`, JSON.stringify({
      subject: "RightEdge: Round 2 Ledger Review 📊",
      htmlContent: `<div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #111317; color: #fff;">
        <h1 style="color: #00E676; text-transform: uppercase;">ROUND 2 LEDGER REVIEW</h1>
        <p>The round is over. Here is the fully transparent breakdown of how the model performed against the closing line in Round 2.</p>
        <div style="background-color: rgba(255,255,255,0.05); padding: 15px; border-left: 4px solid #00E676; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #fff;">Round 2 Recap</h3>
          <p style="color: #ccc; font-size: 14px;">The model found significant closing line value in 5 of 8 matches, resulting in +3.2 units of profit.</p>
          <a href="https://rightedge.app" style="display: inline-block; background-color: #00E676; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; margin-top: 10px;">VIEW RESULTS</a>
        </div>
        <br/>
        <p style="color: #00E676; font-weight: bold;">- The RightEdge Team</p>
      </div>`,
      sentAt: new Date().toISOString(),
      recipients: 15,
      source: 'manual_round2_trigger'
    }));
    console.log("[INIT] Inserted Round 2 Review into DB");
  } catch (e) {
    console.error("Failed to insert round 2 review", e);
  }
})();

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.options("/*", (c) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Max-Age", "600");
  return c.body(null, 204);
});

app.get("/og-image.svg",async (c) => {
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#111317"/>
    <rect x="50" y="50" width="1100" height="530" fill="none" stroke="#00E676" stroke-width="8" />
    <text x="600" y="320" font-family="Arial, sans-serif" font-size="140" font-weight="900" fill="#FFFFFF" text-anchor="middle" alignment-baseline="middle" letter-spacing="-5">RIGHTEDGE</text>
    <text x="600" y="440" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#00E676" text-anchor="middle" letter-spacing="10">NRL ANALYTICS</text>
  </svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000",
    },
  });
});

app.post("/track-event", async (c) => {
  try {
    const body = await c.req.json();
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: body.type || 'pageview',
      path: body.path || 'unknown',
      url: body.url || '',
      referrer: body.referrer || '',
      utm_source: body.utm_source || '',
      utm_medium: body.utm_medium || '',
      utm_campaign: body.utm_campaign || '',
      visitor_id: body.visitor_id || '',
      session_id: body.session_id || '',
      device: body.device || 'unknown',
      user_agent: body.user_agent || '',
      is_internal: body.is_internal || false,
      is_subscriber: body.is_subscriber || false,
      cta_source: body.cta_source || '',
      // visitor_email is only populated after the user logs in — it links the
      // stable anonymous visitor_id to a known identity without requiring email
      // entry for earlier events in the same session.
      visitor_email: body.visitor_email || ''
    };

    // Store in KV using timestamp for time-series queries
    const key = `analytics:event:${event.timestamp}:${event.id}`;
    await kv.set(key, JSON.stringify(event));

    return c.json({ success: true, event });
  } catch(e) {
    console.error("Failed to track event", e);
    return c.json({ error: "Failed" }, 500);
  }
});

app.get("/auth/session", async (c) => {
  const session = await getAuthSessionFromRequest(c);

  if (!session) {
    clearAuthSessionCookie(c);
    return c.json({
      authenticated: false,
      email: null,
      tier: "none",
      free: false,
      premium: false,
    });
  }

  const premium = session.tier === "premium"
    ? await isPremiumSubscriberActive(session.email)
    : false;

  if (session.tier === "premium" && !premium) {
    return c.json({
      authenticated: true,
      email: session.email,
      tier: "free",
      free: true,
      premium: false,
      expiresAt: session.expiresAt,
    });
  }

  return c.json({
    authenticated: true,
    email: session.email,
    tier: session.tier,
    free: true,
    premium,
    expiresAt: session.expiresAt,
  });
});

app.post("/auth/logout", async (c) => {
  await clearAuthSession(c);
  return c.json({ success: true });
});



function getFromEmail() {
  const envFrom = Deno.env.get("RESEND_FROM_EMAIL");
  if (envFrom && envFrom.includes("@")) return envFrom;
  return "RightEdge <elliott@rightedge.com.au>";
}

function getResendClient() {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
  return new Resend(resendApiKey);
}


type ResendLifecycleStage = "free" | "lead" | "premium";

const RESEND_SEGMENT_NAMES = {
  free: "Free",
  lead: "Checkout Leads",
  premium: "Premium",
} as const;

const NRL_TEAMS = new Set([
  "Brisbane Broncos",
  "Canberra Raiders",
  "Canterbury Bulldogs",
  "Cronulla Sharks",
  "Dolphins",
  "Gold Coast Titans",
  "Manly Sea Eagles",
  "Melbourne Storm",
  "Newcastle Knights",
  "North Queensland Cowboys",
  "Parramatta Eels",
  "Penrith Panthers",
  "South Sydney Rabbitohs",
  "St George Illawarra Dragons",
  "Sydney Roosters",
  "Warriors",
  "Wests Tigers",
]);

const resendSegmentCache = new Map<string, string>();

async function getOrCreateResendSegmentId(name: string) {
  if (resendSegmentCache.has(name)) return resendSegmentCache.get(name)!;

  const resend = getResendClient();
  const listResult = await resend.segments.list();
  if (listResult.error) {
    throw new Error(`Failed listing Resend segments: ${JSON.stringify(listResult.error)}`);
  }

  const existing = listResult.data?.data?.find((segment: any) =>
    (segment?.name || "").toLowerCase() === name.toLowerCase()
  );

  if (existing?.id) {
    resendSegmentCache.set(name, existing.id);
    return existing.id;
  }

  const createResult = await resend.segments.create({ name });
  if (createResult.error || !createResult.data?.id) {
    throw new Error(`Failed creating Resend segment ${name}: ${JSON.stringify(createResult.error)}`);
  }

  resendSegmentCache.set(name, createResult.data.id);
  return createResult.data.id;
}

async function ensureResendContact(email: string) {
  const resend = getResendClient();
  const cleanEmail = email.trim().toLowerCase();

  const createResult = await resend.contacts.create({
    email: cleanEmail,
    unsubscribed: false,
  });

  if (!createResult.error) {
    console.log(`[ResendContact] Created contact ${cleanEmail}`);
    return true;
  }

  const updateResult = await resend.contacts.update({
    email: cleanEmail,
    unsubscribed: false,
  });

  if (updateResult.error) {
    console.error(`[ResendContact] Failed to create/update contact ${cleanEmail}`, {
      createError: createResult.error,
      updateError: updateResult.error,
    });
    return false;
  }

  console.log(`[ResendContact] Updated contact ${cleanEmail}`);
  return true;
}

async function addContactToSegment(email: string, segmentId: string, segmentName: string) {
  const resend = getResendClient();
  const result = await resend.contacts.segments.add({
    email: email.trim().toLowerCase(),
    segmentId,
  });

  if (result.error) {
    console.error(`[ResendContact] Failed adding ${email} to segment ${segmentName}`, result.error);
  } else {
    console.log(`[ResendContact] Added ${email} to segment ${segmentName}`);
  }
}

async function removeContactFromSegment(email: string, segmentId: string, segmentName: string) {
  const resend = getResendClient();
  const result = await resend.contacts.segments.remove({
    email: email.trim().toLowerCase(),
    segmentId,
  });

  if (result.error) {
    console.warn(`[ResendContact] Could not remove ${email} from segment ${segmentName}`, result.error);
  } else {
    console.log(`[ResendContact] Removed ${email} from segment ${segmentName}`);
  }
}

async function syncResendLifecycle(email: string, stage: ResendLifecycleStage) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const ok = await ensureResendContact(cleanEmail);
    if (!ok) return;

    const freeSegmentId = await getOrCreateResendSegmentId(RESEND_SEGMENT_NAMES.free);
    const leadSegmentId = await getOrCreateResendSegmentId(RESEND_SEGMENT_NAMES.lead);
    const premiumSegmentId = await getOrCreateResendSegmentId(RESEND_SEGMENT_NAMES.premium);

    if (stage === "free") {
      await addContactToSegment(cleanEmail, freeSegmentId, RESEND_SEGMENT_NAMES.free);
      await removeContactFromSegment(cleanEmail, premiumSegmentId, RESEND_SEGMENT_NAMES.premium);
      await removeContactFromSegment(cleanEmail, leadSegmentId, RESEND_SEGMENT_NAMES.lead);
      return;
    }

    if (stage === "lead") {
      await addContactToSegment(cleanEmail, leadSegmentId, RESEND_SEGMENT_NAMES.lead);
      return;
    }

    if (stage === "premium") {
      await addContactToSegment(cleanEmail, premiumSegmentId, RESEND_SEGMENT_NAMES.premium);
      await removeContactFromSegment(cleanEmail, freeSegmentId, RESEND_SEGMENT_NAMES.free);
      await removeContactFromSegment(cleanEmail, leadSegmentId, RESEND_SEGMENT_NAMES.lead);
    }
  } catch (err) {
    console.error(`[ResendContact] Unexpected error syncing ${email} as ${stage}`, err);
  }
}

function emailHeaderHtml(label = "") {
  return `
        <div style="padding:22px 0 18px 0;border-bottom:1px solid #1E1E2E;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="left" style="vertical-align:middle;">
                <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:22px;line-height:1.2;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">RightEdge</div>
              </td>
              ${label ? `<td align="right" style="vertical-align:middle;"><span style="display:inline-block;border:1px solid #1E1E2E;color:#9CA3AF;font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;padding:8px 10px;">${label}</span></td>` : ""}
            </tr>
          </table>
        </div>`;
}

function emailCtaHtml(href: string, label: string, variant: "primary" | "secondary" = "primary") {
  const isPrimary = variant === "primary";
  return `
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
            <tr>
              <td style="background:${isPrimary ? "#ffffff" : "transparent"};border:1px solid ${isPrimary ? "#ffffff" : "#1E1E2E"};">
                <a href="${href}" style="display:inline-block;padding:14px 18px;color:${isPrimary ? "#0A0A0F" : "#ffffff"};text-decoration:none;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.2;font-weight:600;letter-spacing:-0.01em;">${label}</a>
              </td>
            </tr>
          </table>`;
}

function metricCardHtml(label: string, value: string, tone: "default" | "positive" | "negative" = "default") {
  const color = tone === "positive" ? "#4ADE80" : tone === "negative" ? "#F87171" : "#ffffff";
  return `
            <td width="33.33%" style="padding:0 6px 12px 6px;vertical-align:top;">
              <div style="background:#16161D;border:1px solid #1E1E2E;padding:18px 16px;">
                <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">${label}</div>
                <div style="margin-top:10px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:22px;line-height:1.1;color:${color};font-weight:600;letter-spacing:-0.02em;">${value}</div>
              </div>
            </td>`;
}

function rightEdgeEmailShell(preheader: string, label: string, innerHtml: string) {
  return `
  <div style="margin:0;padding:0;background:#0A0A0F;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <div style="background:#0A0A0F;padding:28px 14px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:680px;margin:0 auto;">
        ${emailHeaderHtml(label)}
        ${innerHtml}
        ${responsibleGamblingEmailFooterHtml()}
        <div style="margin-top:22px;text-align:center;font-family:Inter,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#6B7280;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">Backed by data, not guesswork.</div>
      </div>
    </div>
  </div>`;
}

function freeWelcomeHtml() {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="width=device-width" name="viewport" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta content="IE=edge" http-equiv="X-UA-Compatible" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta
      content="telephone=no,address=no,email=no,date=no,url=no"
      name="format-detection" />
  </head>
  <body style="background-color:#ffffff">
    <!--$--><!--html--><!--head--><!--body-->
    <table
      border="0"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      align="center">
      <tbody>
        <tr>
          <td style="background-color:#ffffff">
            <table
              align="left"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000">
              <tbody>
                <tr style="width:100%">
                  <td
                    style="padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px">
                    <div
                      style="margin:0;padding:0;display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
                      <p style="margin:0;padding:0">
                        Your free RightEdge model access is ready.
                      </p>
                    </div>
                    <table
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                      style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;background:#E7E7E4">
                      <tbody>
                        <tr style="margin:0;padding:0">
                          <td
                            align="center"
                            data-id="__react-email-column"
                            style="margin:0;padding:0">
                            <table
                              width="100%"
                              border="0"
                              cellpadding="0"
                              cellspacing="0"
                              role="presentation"
                              style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;max-width:640px;background:#E7E7E4;color:#0A0A0A">
                              <tbody>
                                <tr style="margin:0;padding:0">
                                  <td
                                    data-id="__react-email-column"
                                    style="margin:0;padding:28px 24px 18px 24px;border-bottom:1px solid #C7C7C2">
                                    <table
                                      width="100%"
                                      border="0"
                                      cellpadding="0"
                                      cellspacing="0"
                                      role="presentation"
                                      style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0">
                                      <tbody>
                                        <tr style="margin:0;padding:0">
                                          <td
                                            align="left"
                                            data-id="__react-email-column"
                                            style="margin:0;padding:0;font-size:20px;font-weight:900;letter-spacing:-0.04em">
                                            <p style="margin:0;padding:0">
                                              RightEdge
                                            </p>
                                          </td>
                                          <td
                                            align="right"
                                            data-id="__react-email-column"
                                            style="margin:0;padding:0;font-size:11px;color:#6A6A65;text-transform:uppercase;letter-spacing:0.14em;font-weight:900">
                                            <p style="margin:0;padding:0">
                                              Free Access
                                            </p>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                                <tr style="margin:0;padding:0">
                                  <td
                                    data-id="__react-email-column"
                                    style="margin:0;padding:34px 24px 20px 24px">
                                    <div
                                      style="margin:0;padding:30px 26px;background:#F1F1EF;border:1px solid #C7C7C2">
                                      <div
                                        style="margin:0;padding:0;font-size:11px;color:#6A6A65;text-transform:uppercase;letter-spacing:0.16em;font-weight:900;margin-bottom:18px">
                                        <p style="margin:0;padding:0">
                                          Account ready
                                        </p>
                                      </div>
                                      <h1
                                        style="margin:0;padding:0;color:#0A0A0A;font-size:46px;line-height:0.96;font-weight:900;letter-spacing:-0.055em;text-transform:uppercase">
                                        Welcome to<br />RightEdge.
                                      </h1>
                                      <p
                                        style="margin:22px 0 0 0;padding:0;color:#0A0A0A;font-size:18px;line-height:1.45;font-weight:800">
                                        Your free round access is ready.
                                      </p>
                                      <p
                                        style="margin:18px 0 0 0;padding:0;color:#6A6A65;font-size:16px;line-height:1.6">
                                        You now have access to RightEdge’s
                                        standard NRL match simulations,
                                        projected scores and model win
                                        probabilities.
                                      </p>
                                      <p
                                        style="margin:14px 0 0 0;padding:0;color:#6A6A65;font-size:16px;line-height:1.6">
                                        Since you went straight into the
                                        dashboard when you signed up, you should
                                        already be logged in on your current
                                        browser. If you close the tab, log out,
                                        or want to view the model on another
                                        device, use the button below to get back
                                        in.
                                      </p>
                                      <table
                                        border="0"
                                        cellpadding="0"
                                        cellspacing="0"
                                        role="presentation"
                                        style="margin-top:26px;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0">
                                        <tbody>
                                          <tr style="margin:0;padding:0">
                                            <td
                                              data-id="__react-email-column"
                                              style="margin:0;padding:0;background:#0A0A0A;border:1px solid #0A0A0A">
                                              <p style="margin:0;padding:0">
                                                <a
                                                  href="https://www.rightedge.com.au/#matches"
                                                  rel="noopener noreferrer nofollow"
                                                  style="color:#ffffff;text-decoration-line:none;text-decoration:none;display:inline-block;padding:15px 22px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em"
                                                  target="_blank"
                                                  >View Round Predictions →</a
                                                >
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                      <p
                                        style="margin:18px 0 0 0;padding:0;color:#6A6A65;font-size:13px;line-height:1.6">
                                        RightEdge is passwordless. If your
                                        browser session expires, enter your
                                        email on the homepage to jump straight
                                        back into your dashboard.
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                                <tr style="margin:0;padding:0">
                                  <td
                                    data-id="__react-email-column"
                                    style="margin:0;padding:10px 24px 0 24px">
                                    <div
                                      style="margin:0;padding:0;font-size:11px;color:#6A6A65;text-transform:uppercase;letter-spacing:0.16em;font-weight:900;margin-bottom:12px">
                                      <p style="margin:0;padding:0">
                                        How the model works
                                      </p>
                                    </div>
                                    <div
                                      style="margin:0;padding:22px 24px;background:#F6F6F3;border:1px solid #C7C7C2;margin-bottom:12px">
                                      <div
                                        style="margin:0;padding:0;font-size:12px;color:#0A0A0A;font-weight:900;letter-spacing:0.12em;text-transform:uppercase">
                                        <p style="margin:0;padding:0">
                                          01 / Data Simulation
                                        </p>
                                      </div>
                                      <p
                                        style="margin:10px 0 0 0;padding:0;color:#6A6A65;font-size:14px;line-height:1.7">
                                        RightEdge simulates every NRL matchup
                                        thousands of times, processing team
                                        metrics and roster changes to map
                                        projected scores and win probabilities.
                                      </p>
                                    </div>
                                    <div
                                      style="margin:0;padding:22px 24px;background:#F6F6F3;border:1px solid #C7C7C2;margin-bottom:12px">
                                      <div
                                        style="margin:0;padding:0;font-size:12px;color:#0A0A0A;font-weight:900;letter-spacing:0.12em;text-transform:uppercase">
                                        <p style="margin:0;padding:0">
                                          02 / True Price
                                        </p>
                                      </div>
                                      <p
                                        style="margin:10px 0 0 0;padding:0;color:#6A6A65;font-size:14px;line-height:1.7">
                                        The model converts projected
                                        probabilities into model odds, giving
                                        you a cleaner baseline to compare
                                        against the market.
                                      </p>
                                    </div>
                                    <div
                                      style="margin:0;padding:22px 24px;background:#F6F6F3;border:1px solid #C7C7C2">
                                      <div
                                        style="margin:0;padding:0;font-size:12px;color:#0A0A0A;font-weight:900;letter-spacing:0.12em;text-transform:uppercase">
                                        <p style="margin:0;padding:0">
                                          03 / Premium Plays
                                        </p>
                                      </div>
                                      <p
                                        style="margin:10px 0 0 0;padding:0;color:#6A6A65;font-size:14px;line-height:1.7">
                                        Free users see projected scores and win
                                        probabilities. Premium members get H2H,
                                        line, total and try scorer plays before
                                        kickoff.
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                                <tr style="margin:0;padding:0">
                                  <td
                                    data-id="__react-email-column"
                                    style="margin:0;padding:24px 24px 0 24px">
                                    <div
                                      style="margin:0;padding:24px;background:#F1F1EF;border:1px solid #C7C7C2">
                                      <h2
                                        style="margin:0;padding:0;color:#0A0A0A;font-size:30px;line-height:1;font-weight:900;letter-spacing:-0.05em;text-transform:uppercase">
                                        Free sees the projection.<br />Premium
                                        sees the edge.
                                      </h2>
                                      <p
                                        style="margin:16px 0 0 0;padding:0;color:#6A6A65;font-size:15px;line-height:1.6">
                                        The matches dashboard is free to use.
                                        Premium is for users who want the
                                        model’s strongest plays and try scorer
                                        signals before kickoff.
                                      </p>
                                      <table
                                        border="0"
                                        cellpadding="0"
                                        cellspacing="0"
                                        role="presentation"
                                        style="margin-top:22px;margin-right:0;margin-bottom:0;margin-left:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0">
                                        <tbody>
                                          <tr style="margin:0;padding:0">
                                            <td
                                              data-id="__react-email-column"
                                              style="margin:0;padding:0;background:#093AD3;border:1px solid #093AD3">
                                              <p style="margin:0;padding:0">
                                                <a
                                                  href="https://www.rightedge.com.au/#best-bets"
                                                  rel="noopener noreferrer nofollow"
                                                  style="color:#ffffff;text-decoration-line:none;text-decoration:none;display:inline-block;padding:15px 22px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em"
                                                  target="_blank"
                                                  >See Premium →</a
                                                >
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                                <tr style="margin:0;padding:0">
                                  <td
                                    data-id="__react-email-column"
                                    style="margin:0;padding:26px 24px 32px 24px">
                                    <p
                                      style="margin:0 0 10px 0;padding:0;color:#6A6A65;font-size:12px;line-height:1.6">
                                      RightEdge Analytics. Backed by data, not
                                      guesswork.
                                    </p>
                                    <p
                                      style="margin:0 0 10px 0;padding:0;color:#6A6A65;font-size:12px;line-height:1.6">
                                      You are receiving this email because you
                                      created a free account at
                                      rightedge.com.au.
                                    </p>
                                    <div
                                      style="margin:0;padding:16px 18px;margin-top:22px;background:#ffffff;border:1px solid #0A0A0A">
                                      <div
                                        style="margin:0;padding:0;font-size:14px;line-height:1.3;color:#0A0A0A;font-weight:900;text-transform:uppercase">
                                        <p style="margin:0;padding:0">
                                          Imagine what you could be buying
                                          instead.
                                        </p>
                                      </div>
                                      <div
                                        style="margin:0;padding:0;margin-top:8px;font-size:13px;line-height:1.6;color:#0A0A0A;font-weight:700">
                                        <p style="margin:0;padding:0">
                                          For free and confidential support call
                                          <a
                                            href="tel:1800858858"
                                            rel="noopener noreferrer nofollow"
                                            style="color:#0A0A0A;text-decoration-line:none;text-decoration:underline;font-weight:900"
                                            target="_blank"
                                            ><u>1800 858 858</u></a
                                          >
                                          or visit
                                          <a
                                            href="https://www.gamblinghelponline.org.au/"
                                            rel="noopener noreferrer"
                                            style="color:#0A0A0A;text-decoration-line:none;text-decoration:underline;font-weight:900"
                                            target="_blank"
                                            ><u>gamblinghelponline.org.au</u></a
                                          >.
                                        </p>
                                      </div>
                                      <div
                                        style="margin:0;padding:0;margin-top:10px;font-size:11px;line-height:1.2;color:#0A0A0A;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">
                                        <p style="margin:0;padding:0">
                                          18+ only
                                        </p>
                                      </div>
                                    </div>
                                    <p
                                      style="margin:18px 0 0 0;padding:0;color:#6A6A65;font-size:12px;line-height:1.6">
                                      RightEdge provides model-based information
                                      and does not guarantee outcomes. RightEdge
                                      is independent and is not affiliated with,
                                      endorsed by, or licensed by the National
                                      Rugby League or its clubs
                                    </p>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p style="margin:0;padding:0"><br /></p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--/$-->
  </body>
</html>

  `;
}


const RESPONSIBLE_GAMBLING_TAGLINES = [
  "Chances are you're about to lose.",
  "Think. Is this a bet you really want to place?",
  "What's gambling really costing you?",
  "What are you prepared to lose today? Set a deposit limit.",
  "Imagine what you could be buying instead.",
  "What are you really gambling with?",
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResponsibleGamblingTagline(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return RESPONSIBLE_GAMBLING_TAGLINES[
    Math.abs(dayOfYear) % RESPONSIBLE_GAMBLING_TAGLINES.length
  ];
}

function responsibleGamblingEmailFooterHtml() {
  const tagline = escapeHtml(getResponsibleGamblingTagline().toUpperCase());

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


function premiumWelcomeHtml() {
  return rightEdgeEmailShell(
    "Premium is live: best bets, try scorer value and live odds are now unlocked.",
    "Premium",
    `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Premium active</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:34px;line-height:1.05;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">Your action layer is live.</div>
          <div style="margin-top:18px;max-width:560px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#9CA3AF;font-weight:400;">
            You now have access to the filtered RightEdge card: model plays, try scorer value, live market context and the edge the model has identified.
          </div>
          ${emailCtaHtml("https://www.rightedge.com.au/#best-bets", "View Best Bets ->")}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;margin-left:-6px;margin-right:-6px;">
          <tr>
            ${metricCardHtml("Best Bets", "Unlocked", "positive")}
            ${metricCardHtml("Try Scorers", "Unlocked", "positive")}
            ${metricCardHtml("Live Odds", "Betr")}
          </tr>
        </table>

        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:6px;padding:22px 24px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#9CA3AF;">
            Use Premium Login anytime. Enter your subscriber email and RightEdge will take you straight to the full premium card.
          </div>
        </div>`
  );
}

async function sendWelcomeEmail(type: "free" | "premium", email: string) {
  const resend = getResendClient();
  const from = getFromEmail();

  const subject =
    type === "free"
      ? "Your free RightEdge model access is ready"
      : "You’re in — RightEdge Premium is live";

  const html =
    type === "free"
      ? freeWelcomeHtml()
      : premiumWelcomeHtml();

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject,
    html,
  });

  if (error) {
    console.error(`[WelcomeEmail] Failed sending ${type} welcome to ${email}`, error);
  } else {
    console.log(`[WelcomeEmail] Sent ${type} welcome to ${email}`);
  }
}

type SheetRow = Record<string, string>;

const PUBLISHED_SHEET_ID =
  "2PACX-1vTKzRm_dhMcH-2sf_Yf3O6hqQE0_t13TeanTOJF0wwHSTv8Lb8gmR9zlJ1TceW106fM3e6-LHBVCjF8";

const SHEET_GIDS = {
  matchPredictions: "1090622164",
  fixtures2026: "2096464205",
  tryScorers: "222068410",
} as const;

const LEAD_NURTURE_STEPS = [
  { id: "proof-round", minAgeDays: 3 },
  { id: "track-record", minAgeDays: 6 },
  { id: "premium-explainer", minAgeDays: 10 },
  { id: "conversion-window", minAgeDays: 14 },
] as const;

const LEAD_NURTURE_SENDS_APPROVED = false;

type LeadNurtureStepId = typeof LEAD_NURTURE_STEPS[number]["id"];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((value) => value.replace(/\r/g, "").trim());
}

function parseCsv(text: string): SheetRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header, idx) => header || `col_${idx}`);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: SheetRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });
}

async function fetchPublishedSheetRows(gid: string): Promise<SheetRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
  const res = await fetch(url, { headers: { Accept: "text/csv,text/plain,*/*" } });

  if (!res.ok) {
    throw new Error(`Failed to fetch published sheet ${gid}: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  if (!text.trim() || text.trim().startsWith("<")) {
    throw new Error(`Published sheet ${gid} did not return CSV content`);
  }

  return parseCsv(text);
}

function getSheetValue(row: SheetRow, possibleKeys: string[]) {
  for (const key of possibleKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function toSheetNumber(value: unknown) {
  const cleaned = String(value ?? "").replace(/[$,%]/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function toSheetRound(value: unknown) {
  const text = String(value ?? "").trim();
  const direct = toSheetNumber(text);
  if (direct > 0) return direct;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function toSheetPercent(value: unknown) {
  const number = toSheetNumber(value);
  if (!number) return 0;
  return number > 1 ? number : number * 100;
}

function parseAestKickoffMs(dateISO: string, timeText: string, timezoneText = "AEST") {
  if (!dateISO) return Number.MAX_SAFE_INTEGER;

  const [year, month, day] = dateISO.split("-").map(Number);
  if (!year || !month || !day) return Number.MAX_SAFE_INTEGER;

  let hours = 0;
  let minutes = 0;
  const match = String(timeText || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    hours = Number(match[1]);
    minutes = Number(match[2] || 0);
    const meridian = (match[3] || "").toUpperCase();
    if (meridian === "PM" && hours < 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
  }

  const timezone = String(timezoneText || "").toUpperCase();
  const utcOffsetHours = timezone === "AEDT" ? 11 : 10;
  return Date.UTC(year, month - 1, day, hours - utcOffsetHours, minutes, 0, 0);
}

function getNurtureRoundPhase(firstKickoffMs: number, lastKickoffMs: number) {
  const now = Date.now();
  const twoDaysMs = 48 * 60 * 60 * 1000;
  const postGameBufferMs = 3 * 60 * 60 * 1000;

  if (!Number.isFinite(firstKickoffMs) || firstKickoffMs === Number.MAX_SAFE_INTEGER) {
    return "unknown";
  }

  if (now < firstKickoffMs - twoDaysMs) return "early_week";
  if (now < firstKickoffMs) return "pre_round";
  if (Number.isFinite(lastKickoffMs) && now <= lastKickoffMs + postGameBufferMs) return "in_round";
  return "post_round";
}

async function loadNurtureRoundContext() {
  const [predictionRows, fixtureRows, tryScorerRows] = await Promise.all([
    fetchPublishedSheetRows(SHEET_GIDS.matchPredictions),
    fetchPublishedSheetRows(SHEET_GIDS.fixtures2026),
    fetchPublishedSheetRows(SHEET_GIDS.tryScorers),
  ]);

  const fixtures = fixtureRows
    .map((row) => {
      const round = toSheetRound(getSheetValue(row, ["Round Number", "RoundNumber", "Round"]));
      const homeTeam = shortNrlTeamName(getSheetValue(row, ["Home Team", "Home"]));
      const awayTeam = shortNrlTeamName(getSheetValue(row, ["Away Team", "Away"]));
      const timeLabel = getSheetValue(row, ["AEST", "AEDT", "Time", "Kickoff"]);
      const timezoneLabel = getSheetValue(row, ["TZ", "Timezone", "Time Zone"]) || "AEST";
      const kickoffMs = parseAestKickoffMs(
        getSheetValue(row, ["Date ISO", "DateISO"]),
        timeLabel,
        timezoneLabel,
      );

      return {
        round,
        homeTeam,
        awayTeam,
        match: homeTeam && awayTeam ? `${homeTeam} v ${awayTeam}` : "",
        displayMatch: homeTeam && awayTeam ? `${publicNrlTeamName(homeTeam)} v ${publicNrlTeamName(awayTeam)}` : "",
        day: getSheetValue(row, ["Day"]),
        dateLabel: getSheetValue(row, ["Date"]),
        timeLabel,
        timezoneLabel,
        stadium: getSheetValue(row, ["Stadium", "Venue"]),
        kickoffMs,
      };
    })
    .filter((row) => row.round && row.match)
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  const now = Date.now();
  const upcomingFixture = fixtures.find((fixture) => fixture.kickoffMs >= now);
  const currentRound = upcomingFixture?.round || fixtures[fixtures.length - 1]?.round || 0;
  const roundFixtures = fixtures.filter((fixture) => fixture.round === currentRound);
  const nextFixture = roundFixtures.find((fixture) => fixture.kickoffMs >= now) || roundFixtures[0] || null;
  const firstKickoffMs = roundFixtures[0]?.kickoffMs || Number.MAX_SAFE_INTEGER;
  const lastKickoffMs = roundFixtures[roundFixtures.length - 1]?.kickoffMs || Number.MAX_SAFE_INTEGER;

  const predictions = predictionRows
    .map((row) => {
      const homeTeam = shortNrlTeamName(getSheetValue(row, ["Home Team", "Home"]));
      const awayTeam = shortNrlTeamName(getSheetValue(row, ["Away Team", "Away"]));
      const sheetPredictedWinner = shortNrlTeamName(getSheetValue(row, ["Predicted Winner", "Winner", "Projected Winner"]));
      const homeScore = toSheetNumber(getSheetValue(row, ["Predicted Home Score", "Home Score", "Projected Home Score"]));
      const awayScore = toSheetNumber(getSheetValue(row, ["Predicted Away Score", "Away Score", "Projected Away Score"]));
      const predictedWinner = homeScore > awayScore
        ? homeTeam
        : awayScore > homeScore
          ? awayTeam
          : sheetPredictedWinner;
      const homeModelOdds = toSheetNumber(getSheetValue(row, ["Home Implied Odds", "Home Model Odds", "Model Home Odds"]));
      const awayModelOdds = toSheetNumber(getSheetValue(row, ["Away Implied Odds", "Away Model Odds", "Model Away Odds"]));
      const winnerModelOdds = predictedWinner === homeTeam ? homeModelOdds : awayModelOdds;
      const winnerModelPct = winnerModelOdds > 1 ? (1 / winnerModelOdds) * 100 : 0;
      const margin = Math.abs(homeScore - awayScore);

      return {
        homeTeam,
        awayTeam,
        match: homeTeam && awayTeam ? `${homeTeam} v ${awayTeam}` : "",
        predictedWinner,
        projectedScore: homeScore && awayScore ? `${homeScore}-${awayScore}` : "",
        winnerModelPct,
        margin,
      };
    })
    .filter((row) => row.match && row.predictedWinner);

  const roundMatchSet = new Set(roundFixtures.map((fixture) => fixture.match.toLowerCase()));
  const roundPredictions = predictions.filter((prediction) =>
    !roundMatchSet.size || roundMatchSet.has(prediction.match.toLowerCase())
  );

  const topModelReads = [...roundPredictions]
    .sort((a, b) => (b.winnerModelPct - a.winnerModelPct) || (b.margin - a.margin))
    .slice(0, 3);

  const tryScorers = tryScorerRows
    .map((row) => ({
      round: toSheetRound(getSheetValue(row, ["Round", "Round Number", "RoundNumber", "NRL Round"])),
      player: getSheetValue(row, ["Player"]),
      match: getSheetValue(row, ["Match"]),
      bookmaker: getSheetValue(row, ["Bookmaker", "Best Bookmaker"]),
      modelPct: toSheetPercent(getSheetValue(row, ["StatsInsider %", "Stats Insider %", "Model %"])),
      edgePct: toSheetPercent(getSheetValue(row, ["Edge %"])),
    }))
    .filter((row) => row.round === currentRound && row.player && row.match);

  const premiumScorerCount = tryScorers.filter((row) =>
    row.modelPct >= 42 || row.edgePct >= 3
  ).length;
  const bookmakers = [...new Set(tryScorers.map((row) => row.bookmaker).filter(Boolean))]
    .slice(0, 4)
    .join(", ");
  const requiredPredictionCount = Math.min(2, roundFixtures.length || 2);
  const dataReady = topModelReads.length >= requiredPredictionCount;

  return {
    round: currentRound,
    matchCount: roundFixtures.length || roundPredictions.length,
    roundPhase: getNurtureRoundPhase(firstKickoffMs, lastKickoffMs),
    dataReady,
    predictionCount: roundPredictions.length,
    nextFixture,
    topModelReads,
    premiumScorerCount,
    bookmakers,
  };
}

function getLeadNurtureHoldReason(
  stepId: LeadNurtureStepId,
  ctx: Awaited<ReturnType<typeof loadNurtureRoundContext>>,
) {
  if (!ctx.dataReady) {
    return `latest_round_data_not_ready:${ctx.predictionCount}/${ctx.matchCount || "unknown"}`;
  }

  if (stepId === "conversion-window" && ctx.roundPhase !== "pre_round") {
    return `conversion_window_waiting_for_pre_round:${ctx.roundPhase}`;
  }

  return "";
}

function formatNurtureKickoffTime(ctx: Awaited<ReturnType<typeof loadNurtureRoundContext>>) {
  if (!ctx.nextFixture) return "coming up";
  const parts = [
    ctx.nextFixture.day,
    ctx.nextFixture.dateLabel,
    ctx.nextFixture.timeLabel ? `${ctx.nextFixture.timeLabel} ${ctx.nextFixture.timezoneLabel || "AEST"}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function nurtureModelReadList(ctx: Awaited<ReturnType<typeof loadNurtureRoundContext>>) {
  if (!ctx.topModelReads.length) {
    return "The model is waiting on the latest round data to publish this week's strongest reads.";
  }

  return ctx.topModelReads
    .map((row) => `${row.match}: ${row.predictedWinner} ${row.projectedScore ? `(${row.projectedScore})` : ""}`)
    .join("<br/>");
}

function buildNurtureEmail(stepId: LeadNurtureStepId, ctx: Awaited<ReturnType<typeof loadNurtureRoundContext>>) {
  const nextKickoffTime = formatNurtureKickoffTime(ctx);
  const modelReads = nurtureModelReadList(ctx);
  const tryScorerCount = ctx.premiumScorerCount || 0;
  const nextKickoffDay = ctx.nextFixture
    ? [
      ctx.nextFixture.day,
      ctx.nextFixture.timeLabel ? `${ctx.nextFixture.timeLabel} ${ctx.nextFixture.timezoneLabel || "AEST"}` : "",
    ].filter(Boolean).join(" ")
    : "soon";
  const nextMatch = ctx.nextFixture?.displayMatch || ctx.nextFixture?.match || "the next NRL match";

  const copy: Record<LeadNurtureStepId, { subject: string; eyebrow: string; headline: string; body: string; cta: string; href: string; secondaryCta?: string; secondaryHref?: string }> = {
    "proof-round": {
      subject: "How to actually read the RightEdge model",
      eyebrow: "Day 3 - Model Read",
      headline: `The model is already reading Round ${ctx.round}.`,
      body: `Most people look at NRL odds and ask "who's going to win?"<br/><br/>The model asks a different question: where is the market mispricing the probability?<br/><br/>Here's how to read what you already have access to for free:<br/><br/><strong>Projected score</strong> — this is the model's expected scoreline based on team form, travel, rest days, and recent defensive shape. It's not a tip. It's a probability estimate.<br/><br/><strong>Model probability</strong> — the percentage chance the model assigns to each team winning. If the market has a team at 60% implied probability and the model has them at 72%, that's where the edge lives.<br/><br/><strong>Current round reads:</strong><br/>${modelReads}<br/><br/>You don't need Premium to read these. Start here.`,
      cta: `View Round ${ctx.round} Predictions`,
      href: "https://www.rightedge.com.au/#matches",
    },
    "track-record": {
      subject: "Round 8 returned 40% ROI. Here's how.",
      eyebrow: "DAY 6 - PROOF OF CONCEPT",
      headline: "THE MODEL FOUND AN EDGE IN ROUND 8.",
      body: `Round 8 was a good example of what the model is actually for.<br/><br/>Not every game. Not a tip on every match. Just the rounds where the model identified a meaningful gap between its probability estimate and the market price — and acted on it.<br/><br/>Round 8 produced a 40% ROI across the model plays.<br/><br/>We wrote up exactly how it happened — which matches qualified, what the model saw that the market hadn't priced in, and what the final result looked like.`,
      cta: "Read the Round 8 Breakdown",
      href: "https://articles.rightedge.com.au/nrl-round-8-2026-results/",
      secondaryCta: "View Current Round Predictions",
      secondaryHref: "https://www.rightedge.com.au",
    },
    "premium-explainer": {
      subject: "Free shows the read. Premium shows the play.",
      eyebrow: "DAY 10 - PREMIUM LAYER",
      headline: "FREE SHOWS YOU THE READ. PREMIUM SHOWS YOU THE PLAY.",
      body: `There's a reason the free predictions don't include a "play this" recommendation.<br/><br/>Not every match with a model edge is worth acting on. The line might have already moved. The market might have already priced it in. The edge might be too small to be meaningful at current odds.<br/><br/>Premium exists to filter that down.<br/><br/>Each round, Premium members see:<br/><br/>— <strong>Model plays</strong> — matches where the model edge exceeds the threshold and the market hasn't closed the gap<br/><br/>— <strong>Try scorer value</strong> — player props where our probability estimate beats the best available market price by a meaningful margin<br/><br/>— <strong>Live odds context</strong> — so you know if the price has shifted since the model ran<br/><br/>It's the difference between knowing the model's read and knowing which reads are actually worth something.<br/><br/>Round ${ctx.round} has ${tryScorerCount} try scorer signals that qualify.`,
      cta: "See what Premium includes",
      href: "https://www.rightedge.com.au",
    },
    "conversion-window": {
      subject: `Round ${ctx.round} starts ${nextKickoffDay} — premium view is live`,
      eyebrow: "Day 14 - Before Kickoff",
      headline: `The premium view for Round ${ctx.round} is live.`,
      body: `First game is <strong>${nextMatch}</strong> — ${nextKickoffTime}.<br/><br/>If you want the full model read before kickoff — the plays, the try scorer value, the filtered signals — this is the window.<br/><br/>After the first game starts, the round's already underway and some prices will have moved.<br/><br/>The model has identified ${tryScorerCount} try scorer signals for Round ${ctx.round}.<br/><br/>One week access is $14. No lock-in.`,
      cta: `Unlock Round ${ctx.round} Access`,
      href: "https://www.rightedge.com.au/#best-bets",
    },
  };

  const selected = copy[stepId];

  return {
    subject: selected.subject,
    html: rightEdgeEmailShell(
      selected.subject,
      selected.eyebrow,
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">${selected.eyebrow}</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">${selected.headline}</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">${selected.body}</div>
          ${emailCtaHtml(selected.href, `${selected.cta} ->`)}
          ${selected.secondaryCta && selected.secondaryHref ? `<div style="margin-top:16px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;font-weight:600;"><a href="${selected.secondaryHref}" style="color:#ffffff;text-decoration:none;">${selected.secondaryCta} -></a></div>` : ""}
        </div>`
    ),
  };
}

async function ensureLeadNurtureState(email: string, source = "free_access") {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return;

  const key = `lead_nurture:${cleanEmail}`;
  const existing = await kv.get(key);
  if (existing) return;

  await kv.set(key, JSON.stringify({
    email: cleanEmail,
    source,
    startedAt: new Date().toISOString(),
    sentSteps: [],
    completed: false,
  }));
}

async function sendLeadNurtureEmail(email: string, stepId: LeadNurtureStepId, ctx: Awaited<ReturnType<typeof loadNurtureRoundContext>>) {
  const resend = getResendClient();
  const from = getFromEmail();
  const emailContent = buildNurtureEmail(stepId, ctx);

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (error) throw new Error(`Resend failed for ${email}: ${JSON.stringify(error)}`);
  return emailContent.subject;
}

async function sendLeadNurtureTestEmails(toEmail: string) {
  const cleanEmail = toEmail.trim().toLowerCase();
  if (cleanEmail !== "elliott@woodbry.com") {
    throw new Error("Lead nurture test emails are locked to elliott@woodbry.com only.");
  }

  const resend = getResendClient();
  const from = getFromEmail();
  const ctx = await loadNurtureRoundContext();
  const labels: Record<LeadNurtureStepId, string> = {
    "proof-round": "TEST - Day 3 - Model proof",
    "track-record": "TEST - Day 6 - Track record",
    "premium-explainer": "TEST - Day 10 - Premium explainer",
    "conversion-window": "TEST - Day 14 - Conversion window",
  };
  const sent: Array<{ step: LeadNurtureStepId; subject: string }> = [];

  for (const step of LEAD_NURTURE_STEPS) {
    const emailContent = buildNurtureEmail(step.id, ctx);
    const subject = `[${labels[step.id]}] ${emailContent.subject}`;
    const html = emailContent.html.replace(
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">',
      `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${labels[step.id]} preview. `,
    );

    const { error } = await resend.emails.send({
      from,
      to: [cleanEmail],
      subject,
      html,
    });

    if (error) throw new Error(`Resend test failed for ${step.id}: ${JSON.stringify(error)}`);
    sent.push({ step: step.id, subject });
  }

  return {
    to: cleanEmail,
    round: ctx.round,
    roundPhase: ctx.roundPhase,
    dataReady: ctx.dataReady,
    sent,
  };
}

async function runLeadNurture({ dryRun = false, limit = 250 } = {}) {
  if (!LEAD_NURTURE_SENDS_APPROVED) {
    dryRun = true;
  }

  const [freeRegistrationsRaw, checkoutLeadsRaw] = await Promise.all([
    kv.getByPrefix("free_access:"),
    kv.getByPrefix("checkout_lead:"),
  ]);
  const freeRegistrations = freeRegistrationsRaw || [];
  const checkoutLeads = checkoutLeadsRaw || [];

  for (const rawLead of [...freeRegistrations, ...checkoutLeads]) {
    try {
      const lead: any = typeof rawLead === "string" ? JSON.parse(rawLead) : rawLead;
      const email = String(lead?.email || "").trim().toLowerCase();
      if (!email || lead?.completed_subscription) continue;
      await ensureLeadNurtureState(email, lead?.source || "existing_lead_backfill");
    } catch {
      // Ignore malformed legacy lead records.
    }
  }

  const states = (await kv.getByPrefix("lead_nurture:")) || [];
  const now = Date.now();
  const ctx = await loadNurtureRoundContext();
  const results: any[] = [];

  for (const rawState of states.slice(0, limit)) {
    let state: any;
    try {
      state = typeof rawState === "string" ? JSON.parse(rawState) : rawState;
    } catch {
      continue;
    }

    const email = String(state?.email || "").trim().toLowerCase();
    if (!email || state.completed) continue;

    const premium = await kv.get(`subscriber:${email}`);
    if (premium) {
      state.completed = true;
      state.completedReason = "premium";
      state.completedAt = new Date().toISOString();
      if (!dryRun) await kv.set(`lead_nurture:${email}`, JSON.stringify(state));
      results.push({ email, skipped: true, reason: "premium" });
      continue;
    }

    const startedAtMs = Date.parse(state.startedAt || state.registeredAt || "");
    const ageDays = Number.isFinite(startedAtMs)
      ? Math.floor((now - startedAtMs) / (24 * 60 * 60 * 1000))
      : 0;
    const sentSteps: string[] = Array.isArray(state.sentSteps) ? state.sentSteps : [];
    const nextStep = LEAD_NURTURE_STEPS.find((step) =>
      ageDays >= step.minAgeDays && !sentSteps.includes(step.id)
    );

    if (!nextStep) {
      results.push({ email, skipped: true, reason: "not_due", ageDays });
      continue;
    }

    const holdReason = getLeadNurtureHoldReason(nextStep.id, ctx);
    if (holdReason) {
      results.push({ email, skipped: true, reason: holdReason, step: nextStep.id, ageDays });
      continue;
    }

    if (dryRun) {
      results.push({ email, step: nextStep.id, dryRun: true, ageDays });
      continue;
    }

    try {
      const subject = await sendLeadNurtureEmail(email, nextStep.id, ctx);
      state.sentSteps = [...sentSteps, nextStep.id];
      state.lastSentAt = new Date().toISOString();
      state.lastSubject = subject;
      if (state.sentSteps.length >= LEAD_NURTURE_STEPS.length) {
        state.completed = true;
        state.completedReason = "sequence_complete";
        state.completedAt = new Date().toISOString();
      }
      await kv.set(`lead_nurture:${email}`, JSON.stringify(state));
      results.push({ email, step: nextStep.id, subject, sent: true });
    } catch (err: any) {
      console.error(`[LeadNurture] Failed for ${email}`, err);
      results.push({ email, step: nextStep.id, error: err?.message || "send_failed" });
    }
  }

  await kv.set(`lead_nurture_run:${Date.now()}`, JSON.stringify({
    ranAt: new Date().toISOString(),
    dryRun,
    round: ctx.round,
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results: results.slice(0, 100),
  }));

  return {
    dryRun,
    round: ctx.round,
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results,
  };
}


// Register a free featured-match email (no payment, just collects the address)
app.post("/register-free-access", async (c) => {
  try {
    const body = await c.req.json();
    const email = (body.email || '').trim().toLowerCase();
    const source = body.source || 'featured_match_free';
    const favoriteTeam = String(body.favoriteTeam || '').trim();

    if (!email || !email.includes('@')) {
      return c.json({ error: 'Invalid email' }, 400);
    }
    if (favoriteTeam && !NRL_TEAMS.has(favoriteTeam)) {
      return c.json({ error: 'Select a valid NRL team' }, 400);
    }

    const key = `free_access:${email}`;
    const existing = await kv.get(key);
    const isNewFreeRegistration = !existing;
    const now = new Date().toISOString();

    let existingRecord: Record<string, unknown> = {};
    if (existing) {
      try {
        existingRecord = JSON.parse(existing);
      } catch {
        existingRecord = {};
      }
    }

    await kv.set(key, JSON.stringify({
      ...existingRecord,
      email,
      source,
      favoriteTeam: favoriteTeam || String(existingRecord.favoriteTeam || ""),
      registeredAt: existingRecord.registeredAt || now,
      updatedAt: now,
    }));

    if (isNewFreeRegistration) {
      console.log(`[register-free-access] New free registration: ${email} via ${source} (${favoriteTeam})`);
    } else {
      console.log(`[register-free-access] Updated free registration: ${email} via ${source} (${favoriteTeam})`);
    }

    await syncResendLifecycle(email, "free");
    await ensureLeadNurtureState(email, source);

    if (isNewFreeRegistration) {
      try {
        await sendWelcomeEmail("free", email);
      } catch (emailErr) {
        console.error("[register-free-access] Welcome email failed:", emailErr);
      }
    }

    const existingSession = await getAuthSessionFromRequest(c);
    const sessionTier: AuthSessionTier = existingSession?.tier === "premium" ? "premium" : "free";
    const authSession = await createAuthSession(email, sessionTier);
    writeAuthSessionCookie(c, authSession.token);

    return c.json({ success: true });
  } catch (e) {
    console.error('Failed to register free access', e);
    return c.json({ error: 'Failed' }, 500);
  }
});

// Register a checkout-start lead — saved before Stripe redirect so the email
// is captured even if the user never completes payment.
app.post("/register-checkout-lead", async (c) => {
  try {
    const body = await c.req.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      return c.json({ error: 'Invalid email' }, 400);
    }

    const key = `checkout_lead:${email}`;
    const existing = await kv.get(key);

    let record: any;
    if (existing) {
      // Already a lead — update last_seen_at and increment attempt counter
      // but never overwrite completed_subscription if it's already true
      try { record = typeof existing === 'string' ? JSON.parse(existing) : existing; } catch { record = {}; }
      record.last_seen_at = new Date().toISOString();
      record.attempt_count = (record.attempt_count || 1) + 1;
    } else {
      record = {
        email,
        visitor_id:   body.visitor_id   || '',
        session_id:   body.session_id   || '',
        utm_source:   body.utm_source   || '',
        utm_medium:   body.utm_medium   || '',
        utm_campaign: body.utm_campaign || '',
        source:       body.source       || 'checkout_start',
        created_at:   new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        completed_subscription: false,
        attempt_count: 1,
      };
    }

    await kv.set(key, JSON.stringify(record));
    console.log(`[register-checkout-lead] Lead saved: ${email} (attempt ${record.attempt_count})`);

    await syncResendLifecycle(email, "lead");
    await ensureLeadNurtureState(email, "checkout_lead");

    return c.json({ success: true });
  } catch (e) {
    console.error('[register-checkout-lead] Error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
});

app.get("/analytics-events", async (c) => {
  try {
    // Build a Supabase client with service role key so we can bypass PostgREST
    // row-limit defaults and apply a proper 30-day date-range filter directly
    // against the KV store table.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase    = createClient(supabaseUrl, serviceKey);

    // Events are keyed as  analytics:event:{ISO-timestamp}:{uuid}
    // ISO timestamps sort lexicographically, so a gte-filter on the key
    // gives us an efficient 30-day window without scanning every row.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cutoffKey      = `analytics:event:${thirtyDaysAgo.toISOString()}`;

    const { data, error } = await supabase
      .from("kv_store_f8a832e3")
      .select("key, value")
      .like("key", "analytics:event:%")
      .gte("key", cutoffKey)
      .limit(10000)          // well above any realistic daily volume
      .order("key", { ascending: true });

    if (error) {
      console.log("[analytics-events] Supabase query error:", error.message);
      return c.json({ error: "DB query failed", details: error.message }, 500);
    }

    // Each stored value is a JSON.stringify'd string – parse it back to an object.
    const events = (data ?? []).map((row: any) => {
      try {
        const val = row.value;
        return typeof val === "string" ? JSON.parse(val) : val;
      } catch {
        return null;
      }
    }).filter(Boolean);

    console.log(`[analytics-events] Returning ${events.length} events (last 30 days)`);
    return c.json(events);
  } catch (e: any) {
    console.log("[analytics-events] Unexpected error:", e?.message ?? e);
    return c.json({ error: "Failed", details: e?.message }, 500);
  }
});

// ── Diagnostic endpoint: full storage scan, no date filter ──────────────────
// Returns metadata about every analytics event in the KV table so the admin
// dashboard can distinguish "no older data in storage" from "older data was
// fetched but filtered away".
app.get("/analytics-debug", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase    = createClient(supabaseUrl, serviceKey);

    // Fetch ALL analytics keys — no gte/lte filter — using the key column only
    // first so we can count and inspect without loading full payloads.
    const { data: keyRows, error: keyErr } = await supabase
      .from("kv_store_f8a832e3")
      .select("key")
      .like("key", "analytics:event:%")
      .order("key", { ascending: true })
      .limit(50000);

    if (keyErr) {
      console.log("[analytics-debug] key scan error:", keyErr.message);
      return c.json({ error: keyErr.message }, 500);
    }

    const totalInStorage = (keyRows ?? []).length;

    // Extract ISO timestamps embedded in keys (analytics:event:{ISO}:{uuid})
    // and group by calendar date (YYYY-MM-DD).
    const byDate: Record<string, number> = {};
    let oldestKey = "";
    let newestKey = "";

    for (const row of (keyRows ?? [])) {
      const key: string = row.key;
      // Key format:  analytics:event:2026-03-25T10:30:00.000Z:some-uuid
      const parts = key.split(":");
      // Rejoin parts 2-4 which form the ISO timestamp (it contains colons)
      // Typical format splits to: ["analytics","event","2026-03-25T10","30","00.000Z","uuid"]
      // Safer: strip the fixed prefix and uuid suffix
      const withoutPrefix = key.replace("analytics:event:", "");
      // UUID is the last 36 characters (with hyphens), preceded by a colon
      const isoTimestamp = withoutPrefix.slice(0, withoutPrefix.length - 37); // 36 uuid + 1 colon

      if (!oldestKey) oldestKey = isoTimestamp;
      newestKey = isoTimestamp;

      // Group by date
      const dateStr = isoTimestamp.slice(0, 10); // YYYY-MM-DD
      byDate[dateStr] = (byDate[dateStr] ?? 0) + 1;
    }

    // Also fetch the 30-day cutoff count to show what the main endpoint returns
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cutoffKey = `analytics:event:${thirtyDaysAgo.toISOString()}`;
    const { data: last30Rows, error: last30Err } = await supabase
      .from("kv_store_f8a832e3")
      .select("key")
      .like("key", "analytics:event:%")
      .gte("key", cutoffKey)
      .limit(50000);

    const countInLast30Days = last30Err ? null : (last30Rows ?? []).length;

    const result = {
      totalInStorage,
      oldestKeyTimestamp: oldestKey || null,
      newestKeyTimestamp: newestKey || null,
      countInLast30Days,
      byDate,
    };

    console.log("[analytics-debug]", JSON.stringify({ totalInStorage, countInLast30Days, oldestKeyTimestamp: oldestKey }));
    return c.json(result);
  } catch (e: any) {
    console.log("[analytics-debug] error:", e?.message);
    return c.json({ error: e?.message }, 500);
  }
});

// ── Full KV namespace scan ─────────────────────────────────────────────────
// Reads ALL keys in the table (no prefix filter) and groups them by their
// leading namespace (everything before the first colon).
// This answers: "is older traffic stored under a different key name?"
app.get("/kv-namespace-scan", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase    = createClient(supabaseUrl, serviceKey);

    // Fetch every key in the table — values not needed for this scan.
    const { data, error } = await supabase
      .from("kv_store_f8a832e3")
      .select("key")
      .order("key", { ascending: true })
      .limit(100000);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const rows = data ?? [];
    const totalRows = rows.length;

    // Group by namespace (prefix before first colon) and collect sample keys
    const namespaces: Record<string, { count: number; samples: string[] }> = {};

    for (const row of rows) {
      const key: string = row.key;
      const ns = key.includes(":") ? key.split(":")[0] : "__no_prefix__";
      if (!namespaces[ns]) namespaces[ns] = { count: 0, samples: [] };
      namespaces[ns].count++;
      if (namespaces[ns].samples.length < 3) {
        namespaces[ns].samples.push(key);
      }
    }

    // For analytics:event specifically, also return the full date breakdown
    // using the key-embedded timestamp so we can compare with the other scan.
    const analyticsKeys = rows
      .filter(r => r.key.startsWith("analytics:event:"))
      .map(r => r.key);

    const analyticsDateBreakdown: Record<string, number> = {};
    for (const key of analyticsKeys) {
      const withoutPrefix = key.replace("analytics:event:", "");
      const isoTimestamp = withoutPrefix.slice(0, withoutPrefix.length - 37);
      const dateStr = isoTimestamp.slice(0, 10);
      analyticsDateBreakdown[dateStr] = (analyticsDateBreakdown[dateStr] ?? 0) + 1;
    }

    const result = {
      totalRows,
      namespaces,
      analyticsDateBreakdown,
    };

    console.log("[kv-namespace-scan]", JSON.stringify({ totalRows, namespaceKeys: Object.keys(namespaces) }));
    return c.json(result);
  } catch (e: any) {
    console.log("[kv-namespace-scan] error:", e?.message);
    return c.json({ error: e?.message }, 500);
  }
});

function normalizeNrlTeamName(team: string) {
  const t = String(team || "").toLowerCase();
  if (t.includes("new south wales") || /\bnsw\b/.test(t) || t.includes("blues")) return "New South Wales Blues";
  if (t.includes("queensland maroons") || /\bqld\b/.test(t) || t.includes("maroons")) return "Queensland Maroons";
  if (t.includes("bronco") || t.includes("brisbane")) return "Brisbane Broncos";
  if (t.includes("rabbitoh") || t.includes("south")) return "South Sydney Rabbitohs";
  if (t.includes("rooster") || t.includes("sydney")) return "Sydney Roosters";
  if (t.includes("storm") || t.includes("melbourne")) return "Melbourne Storm";
  if (t.includes("panther") || t.includes("penrith")) return "Penrith Panthers";
  if (t.includes("eel") || t.includes("parramatta")) return "Parramatta Eels";
  if (t.includes("shark") || t.includes("cronulla")) return "Cronulla Sharks";
  if (t.includes("cowboy") || t.includes("north queensland") || t.includes("north qld")) return "North Queensland Cowboys";
  if (t.includes("sea eagle") || t.includes("manly")) return "Manly Sea Eagles";
  if (t.includes("knight") || t.includes("newcastle")) return "Newcastle Knights";
  if (t.includes("dragon") || t.includes("st george")) return "St George Illawarra Dragons";
  if (t.includes("titan") || t.includes("gold coast")) return "Gold Coast Titans";
  if (t.includes("bulldog") || t.includes("canterbury")) return "Canterbury Bulldogs";
  if (t.includes("warrior") || t.includes("new zealand")) return "New Zealand Warriors";
  if (t.includes("raider") || t.includes("canberra")) return "Canberra Raiders";
  if (t.includes("tiger") || t.includes("wests")) return "Wests Tigers";
  if (t.includes("dolphin")) return "Dolphins";
  return String(team || "").trim();
}

function shortNrlTeamName(team: string) {
  const normalized = normalizeNrlTeamName(team);
  const shortNames: Record<string, string> = {
    "Brisbane Broncos": "Brisbane",
    "Sydney Roosters": "Sydney",
    "Melbourne Storm": "Melbourne",
    "Penrith Panthers": "Penrith",
    "South Sydney Rabbitohs": "Souths",
    "Parramatta Eels": "Parramatta",
    "Cronulla Sharks": "Cronulla",
    "North Queensland Cowboys": "North Qld",
    "Manly Sea Eagles": "Manly",
    "Newcastle Knights": "Newcastle",
    "St George Illawarra Dragons": "St Geo Illa",
    "Gold Coast Titans": "Gold Coast",
    "Canterbury Bulldogs": "Canterbury",
    "New Zealand Warriors": "Warriors",
    "Canberra Raiders": "Canberra",
    "Wests Tigers": "Wests Tigers",
    "Dolphins": "Dolphins",
  };
  return shortNames[normalized] || normalized;
}

function publicNrlTeamName(team: string) {
  const normalized = normalizeNrlTeamName(team);
  const publicNames: Record<string, string> = {
    "Brisbane Broncos": "Broncos",
    "Sydney Roosters": "Roosters",
    "Melbourne Storm": "Storm",
    "Penrith Panthers": "Panthers",
    "South Sydney Rabbitohs": "Rabbitohs",
    "Parramatta Eels": "Eels",
    "Cronulla Sharks": "Sharks",
    "North Queensland Cowboys": "Cowboys",
    "Manly Sea Eagles": "Sea Eagles",
    "Newcastle Knights": "Knights",
    "St George Illawarra Dragons": "Dragons",
    "Gold Coast Titans": "Titans",
    "Canterbury Bulldogs": "Bulldogs",
    "New Zealand Warriors": "Warriors",
    "Canberra Raiders": "Raiders",
    "Wests Tigers": "Wests Tigers",
    "Dolphins": "Dolphins",
  };
  return publicNames[normalized] || shortNrlTeamName(team);
}

function buildOddsMatchKey(home: string, away: string) {
  return `${normalizeNrlTeamName(home)} v ${normalizeNrlTeamName(away)}`.toLowerCase();
}

function getOddsEventLockKey(event: any, market = "match") {
  const id = String(event?.id || "").trim();
  if (id) return `${PREMATCH_ODDS_LOCK_PREFIX}:${market}:event:${id}`;

  const homeTeam = normalizeNrlTeamName(event?.home_team || event?.homeTeam || "");
  const awayTeam = normalizeNrlTeamName(event?.away_team || event?.awayTeam || "");
  return `${PREMATCH_ODDS_LOCK_PREFIX}:${market}:match:${buildOddsMatchKey(homeTeam, awayTeam)}:${event?.commence_time || event?.commenceTime || ""}`;
}

function getEventCommenceMs(event: any) {
  const raw = event?.commence_time || event?.commenceTime || "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function hasEventCommenced(event: any, now = Date.now()) {
  const commenceMs = getEventCommenceMs(event);
  return commenceMs > 0 && commenceMs <= now;
}

async function getLockedOddsSnapshot(event: any, market = "match") {
  const key = getOddsEventLockKey(event, market);
  const locked = await kv.get(key);
  if (!locked) return null;

  try {
    const parsed = typeof locked === "string" ? JSON.parse(locked) : locked;
    return parsed?.snapshot || parsed;
  } catch {
    return locked;
  }
}

async function lockOddsSnapshot(event: any, source: string, market = "match") {
  const existing = await getLockedOddsSnapshot(event, market);
  if (existing) return existing;

  const snapshot = {
    ...event,
    preKickoffLocked: true,
    lockedAt: new Date().toISOString(),
  };

  await kv.set(getOddsEventLockKey(event, market), JSON.stringify({
    snapshot,
    lockedAt: snapshot.lockedAt,
    source,
    commenceTime: event?.commence_time || event?.commenceTime || "",
  }));

  console.log(`[OddsLock] Locked ${market} pre-match odds for ${event?.home_team || ""} v ${event?.away_team || ""} from ${source}`);
  return snapshot;
}

async function applyPrematchOddsLocks(rawOdds: any[], source: string) {
  const now = Date.now();
  const rows = Array.isArray(rawOdds) ? rawOdds : [];

  return Promise.all(rows.map(async (event) => {
    if (!hasEventCommenced(event, now)) return event;
    const existing = await getLockedOddsSnapshot(event, "match");
    if (existing) return existing;

    // Only lock from already cached data. Fresh post-kickoff API responses can
    // contain in-play prices, so they must never become the saved pre-game line.
    if (source === "cache") return lockOddsSnapshot(event, source, "match");

    return {
      ...event,
      bookmakers: [],
      oddsLockedUnavailable: true,
    };
  }));
}

function isExcludedMatchOddsBookmaker(bookmaker: any) {
  const label = `${bookmaker?.key || ""} ${bookmaker?.title || ""}`.toLowerCase();
  return label.includes("betfair");
}

function removeExcludedMatchOddsBookmakers(rawOdds: any) {
  if (!Array.isArray(rawOdds)) return rawOdds;
  return rawOdds.map((event: any) => ({
    ...event,
    bookmakers: (event.bookmakers || []).filter(
      (bookmaker: any) => !isExcludedMatchOddsBookmaker(bookmaker),
    ),
  }));
}

function normalizeBookmakerFilter(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function filterMatchOddsBookmakers(rawOdds: any, bookmakerFilter: string) {
  const normalizedFilter = normalizeBookmakerFilter(bookmakerFilter);
  if (!normalizedFilter || !Array.isArray(rawOdds)) return rawOdds;

  return rawOdds.map((event: any) => ({
    ...event,
    bookmakers: (event.bookmakers || []).filter((bookmaker: any) => {
      const key = normalizeBookmakerFilter(bookmaker?.key || "");
      const title = normalizeBookmakerFilter(bookmaker?.title || "");
      if (normalizedFilter === "betr") {
        return (
          (key.startsWith("betr") && !key.startsWith("betright")) ||
          (title.startsWith("betr") && !title.startsWith("betright"))
        );
      }
      return key.includes(normalizedFilter) || title.includes(normalizedFilter);
    }),
  }));
}

function asBlueBetArray(value: any) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

async function fetchBlueBetJson(path: string) {
  const response = await fetch(`${BLUEBET_API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": BLUEBET_AFFILIATE_USER_AGENT,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BlueBet affiliate API failed ${response.status}: ${text}`);
  }

  return response.json();
}

function normalizeBlueBetGenericTeamName(team: string) {
  return String(team || "").replace(/\s+/g, " ").trim();
}

function parseBlueBetTeams(matchName: string, normalizeTeam = normalizeNrlTeamName) {
  const [home, away] = String(matchName || "").split(/\s+v\s+/i);
  return {
    homeTeam: normalizeTeam(home),
    awayTeam: normalizeTeam(away),
  };
}

function parseBlueBetDate(value: any) {
  const raw = String(value || "");
  const dotNetDate = raw.match(/\/Date\((\d+)/);
  if (dotNetDate) return new Date(Number(dotNetDate[1])).toISOString();

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function parseBlueBetTotalOutcome(name: string) {
  const match = String(name || "").trim().match(/^(Over|Under)\s+(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;

  return {
    side: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(),
    point: Number(match[2]),
  };
}

function normalizeBlueBetOutcomeTeam(
  name: string,
  homeTeam: string,
  awayTeam: string,
  normalizeTeam = normalizeNrlTeamName,
) {
  const team = normalizeTeam(name);
  if (team === homeTeam) return homeTeam;
  if (team === awayTeam) return awayTeam;
  return "";
}

function selectBlueBetPrimaryTotalOutcomes(outcomes: any[]) {
  const pairs = new Map<number, { over?: any; under?: any }>();

  for (const outcome of outcomes) {
    const point = Number(outcome?.point);
    if (!Number.isFinite(point)) continue;

    const pair = pairs.get(point) || {};
    if (outcome.name === "Over") pair.over = outcome;
    if (outcome.name === "Under") pair.under = outcome;
    pairs.set(point, pair);
  }

  const primary = [...pairs.entries()]
    .map(([point, pair]) => {
      if (!pair.over || !pair.under) return null;

      return {
        point,
        pair,
        priceGap: Math.abs(Number(pair.over.price) - Number(pair.under.price)),
        marketDistance: Math.abs(((Number(pair.over.price) + Number(pair.under.price)) / 2) - 1.9),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) =>
      (a.priceGap - b.priceGap) ||
      (a.marketDistance - b.marketDistance) ||
      Math.abs(a.point) - Math.abs(b.point)
    )[0];

  return primary ? [primary.pair.over, primary.pair.under] : [];
}

function normalizeBlueBetTryScorerPlayerName(outcomeName: string) {
  return String(outcomeName || "")
    .replace(/\b(anytime|any time)\s+try\s*scorer\b/gi, "")
    .replace(/\btry\s*scorer\b/gi, "")
    .replace(/\bto\s+score\s+a\s+try\b/gi, "")
    .replace(/\bscore\s+a\s+try\b/gi, "")
    .replace(/\b(yes|no)\b/gi, "")
    .replace(/\s*[-–:]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBlueBetEventOdds(payload: any, options: {
  sportKey?: string;
  sportTitle?: string;
  normalizeTeam?: (team: string) => string;
  includeSpreads?: boolean;
  includeTotals?: boolean;
  includeTryScorer?: boolean;
} = {}) {
  const normalizeTeam = options.normalizeTeam || normalizeNrlTeamName;
  const includeSpreads = options.includeSpreads !== false;
  const includeTotals = options.includeTotals !== false;
  const includeTryScorer = options.includeTryScorer !== false;
  const masterEvent = payload?.MasterEvent || {};
  const masterEventName = masterEvent.MasterEventName || "";
  const { homeTeam, awayTeam } = parseBlueBetTeams(masterEventName, normalizeTeam);
  if (!homeTeam || !awayTeam || homeTeam === awayTeam) return null;

  const h2hOutcomes: any[] = [];
  const spreadOutcomes: any[] = [];
  const totalOutcomes: any[] = [];
  const tryScorerOutcomes: any[] = [];
  const seen = new Set<string>();

  for (const event of asBlueBetArray(payload?.Events)) {
    const eventName = String(event?.EventName || "");
    const eventClass = String(event?.EventClass || "");
    const eventText = `${eventName} ${eventClass}`.toLowerCase();
    const isTotalsEvent = includeTotals && eventText.includes("total points over/under");
    const isTryScorerEvent =
      includeTryScorer && (
      eventText.includes("try scorer") ||
      eventText.includes("tryscorer") ||
      eventText.includes("anytime try") ||
      eventText.includes("any time try") ||
      eventText.includes("score a try")
      );

    for (const outcome of asBlueBetArray(event?.Outcomes)) {
      const price = Number(outcome?.Price);
      if (!Number.isFinite(price) || price <= 1) continue;

      const outcomeName = String(outcome?.OutcomeName || "");
      const betDetailTypeCode = String(outcome?.BetDetailTypeCode || "").toUpperCase();
      const marketTypeCode = String(outcome?.MarketTypeCode || "").toUpperCase();

      if (isTotalsEvent) {
        const total = parseBlueBetTotalOutcome(outcomeName);
        if (!total || !Number.isFinite(total.point)) continue;

        const key = `totals:${total.side}:${total.point}`;
        if (seen.has(key)) continue;
        seen.add(key);
        totalOutcomes.push({
          name: total.side,
          price,
          point: total.point,
        });
        continue;
      }

      if (isTryScorerEvent) {
        const player =
          normalizeBlueBetTryScorerPlayerName(
            String(
              outcome?.PlayerName ||
              outcome?.ParticipantName ||
              outcome?.RunnerName ||
              outcomeName ||
              "",
            ),
          );
        const playerKey = normalizeOddsPlayerName(player);
        if (!player || !playerKey || ["over", "under"].includes(playerKey)) continue;

        const key = `try-scorer:${playerKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tryScorerOutcomes.push({
          name: "Yes",
          description: player,
          price,
        });
        continue;
      }

      const team = normalizeBlueBetOutcomeTeam(outcomeName, homeTeam, awayTeam, normalizeTeam);
      if (!team) continue;

      if (betDetailTypeCode === "WIN" && marketTypeCode === "WIN") {
        const key = `h2h:${team}`;
        if (seen.has(key)) continue;
        seen.add(key);
        h2hOutcomes.push({
          name: team,
          price,
        });
        continue;
      }

      if (includeSpreads && betDetailTypeCode === "HC" && marketTypeCode === "HCWEST") {
        const point = Number(outcome?.Points);
        if (!Number.isFinite(point)) continue;

        const key = `spreads:${team}:${point}`;
        if (seen.has(key)) continue;
        seen.add(key);
        spreadOutcomes.push({
          name: team,
          price,
          point,
        });
      }
    }
  }

  const markets = [
    h2hOutcomes.length ? { key: "h2h", outcomes: h2hOutcomes } : null,
    includeSpreads && spreadOutcomes.length ? { key: "spreads", outcomes: spreadOutcomes } : null,
    includeTotals && totalOutcomes.length ? { key: "totals", outcomes: selectBlueBetPrimaryTotalOutcomes(totalOutcomes) } : null,
    includeTryScorer && tryScorerOutcomes.length ? { key: "player_try_scorer_anytime", outcomes: tryScorerOutcomes } : null,
  ].filter(Boolean);

  return {
    id: String(masterEvent.MasterEventId || masterEventName),
    sport_key: options.sportKey || "rugbyleague_nrl",
    sport_title: options.sportTitle || "NRL",
    commence_time: parseBlueBetDate(
      masterEvent.MinAdvertisedStartTime || masterEvent.MaxAdvertisedStartTime,
    ),
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers: markets.length
      ? [
          {
            key: "betr",
            title: "Betr",
            last_update: new Date().toISOString(),
            markets,
          },
        ]
      : [],
    source: "bluebet_affiliate_api",
  };
}

async function fetchBlueBetNrlOddsRaw() {
  const hierarchy = await fetchBlueBetJson(
    "/MasterCategory?EventTypeId=102&WithLevelledMarkets=true&Format=json",
  );
  const nrlMasterCategory = asBlueBetArray(hierarchy?.MasterCategories).find((category: any) =>
    String(category?.MasterCategory || category?.MasterCategoryName || "").toLowerCase() === "nrl"
  );
  const targetCategories = asBlueBetArray(nrlMasterCategory?.Categories).filter((category: any) => {
    const categoryName = String(category?.CategoryName || "").toLowerCase();
    return categoryName === "nrl matches" || categoryName.includes("state of origin");
  });
  const masterEvents = targetCategories
    .flatMap((category: any) => asBlueBetArray(category?.MasterEvents))
    .filter((event: any) => String(event?.MasterEventName || "").match(/\s+v\s+/i));

  const eventPayloads = await Promise.all(
    masterEvents.map((event: any) =>
      fetchBlueBetJson(`/MasterEvent?MasterEventId=${encodeURIComponent(event.MasterEventId)}&format=json`),
    ),
  );

  return eventPayloads
    .map(buildBlueBetEventOdds)
    .filter((event: any) => event && event.bookmakers?.length);
}

async function fetchBlueBetCricketOddsRaw() {
  const hierarchy = await fetchBlueBetJson(
    "/MasterCategory?EventTypeId=109&WithLevelledMarkets=true&Format=json",
  );

  const masterEvents = asBlueBetArray(hierarchy?.MasterCategories)
    .flatMap((masterCategory: any) => asBlueBetArray(masterCategory?.Categories))
    .flatMap((category: any) => asBlueBetArray(category?.MasterEvents))
    .filter((event: any) => String(event?.MasterEventName || "").match(/\s+v\s+/i));

  const eventPayloads = await Promise.all(
    masterEvents.map((event: any) =>
      fetchBlueBetJson(`/MasterEvent?MasterEventId=${encodeURIComponent(event.MasterEventId)}&format=json`),
    ),
  );

  return eventPayloads
    .map((payload) => {
      const categoryName = String(payload?.MasterEvent?.CategoryName || "").toLowerCase();
      const isInternationalT20 = categoryName.includes("t20 international");
      return buildBlueBetEventOdds(payload, {
        sportKey: isInternationalT20 ? "cricket_international_t20" : "cricket",
        sportTitle: isInternationalT20 ? "International T20" : "Cricket",
        normalizeTeam: normalizeBlueBetGenericTeamName,
        includeSpreads: false,
        includeTotals: false,
        includeTryScorer: false,
      });
    })
    .filter((event: any) => event && event.bookmakers?.length);
}

const NRL_SPORT_KEY = "rugbyleague_nrl";
const ORIGIN_SPORT_KEY = "rugbyleague_nrl_state_of_origin";

async function fetchLiveOddsRaw(force = false, region = "au", bookmaker = "", sportKey = NRL_SPORT_KEY) {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY environment variable. Add your The Odds API key.");
  }

  const normalizedSportKey = sportKey === ORIGIN_SPORT_KEY ? ORIGIN_SPORT_KEY : NRL_SPORT_KEY;
  const sportSuffix = normalizedSportKey === ORIGIN_SPORT_KEY ? "_origin" : "";
  const normalizedRegion = String(region || "au").toLowerCase().replace(/[^a-z]/g, "") || "au";
  const normalizedBookmaker = normalizeBookmakerFilter(bookmaker);
  const cacheSuffix = `${sportSuffix}${normalizedBookmaker
    ? `_bookmaker_${normalizedBookmaker}`
    : (normalizedRegion === "au" ? "" : `_${normalizedRegion}`)}`;
  const cacheKey = `live_odds_cache${cacheSuffix}`;
  const cacheTimeKey = `live_odds_cache_time${cacheSuffix}`;
  const cachedOdds = await kv.get(cacheKey);
  const cacheTime = await kv.get(cacheTimeKey);
  const now = Date.now();
  const parsedCachedOdds = cachedOdds
    ? (typeof cachedOdds === "string" ? JSON.parse(cachedOdds) : cachedOdds)
    : null;
  const sanitizedCachedOdds = removeExcludedMatchOddsBookmakers(parsedCachedOdds);

  if (sanitizedCachedOdds) {
    const lockedCachedOdds = await applyPrematchOddsLocks(sanitizedCachedOdds, "cache");
    await kv.set(cacheKey, JSON.stringify(lockedCachedOdds));

    if (!force && cacheTime && (now - Number(cacheTime)) < MATCH_ODDS_CACHE_MS) {
      return lockedCachedOdds;
    }
  }

  const oddsApiParams = new URLSearchParams({
    apiKey,
    markets: "h2h,spreads,totals",
    oddsFormat: "decimal",
  });
  if (normalizedBookmaker) {
    oddsApiParams.set("bookmakers", normalizedBookmaker);
  } else {
    oddsApiParams.set("regions", normalizedRegion);
  }

  const response = await fetch(`https://api.the-odds-api.com/v4/sports/${normalizedSportKey}/odds/?${oddsApiParams.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    if (sanitizedCachedOdds) {
      console.warn(`[OddsAPI] Returning cached match odds after API error: ${text}`);
      return await applyPrematchOddsLocks(sanitizedCachedOdds, "cache");
    }
    throw new Error(`Failed to fetch from The Odds API: ${text}`);
  }

  const data = await response.json();

  const lockedData = Array.isArray(data)
    ? removeExcludedMatchOddsBookmakers(await applyPrematchOddsLocks(data, "fresh-api"))
    : data;

  if (Array.isArray(lockedData)) {
    await kv.set(cacheKey, JSON.stringify(lockedData));
    await kv.set(cacheTimeKey, now.toString());
  }

  return lockedData;
}

function buildBestMatchOdds(rawOdds: any[]) {
  const updatedAt = new Date().toISOString();

  return (rawOdds || []).map((event: any) => {
    const homeTeam = normalizeNrlTeamName(event.home_team);
    const awayTeam = normalizeNrlTeamName(event.away_team);
    let bestHomeOdds = 0;
    let bestAwayOdds = 0;
    let bestHomeBookmaker = "";
    let bestAwayBookmaker = "";

    for (const bookmaker of event.bookmakers || []) {
      if (isExcludedMatchOddsBookmaker(bookmaker)) continue;

      const h2hMarket = (bookmaker.markets || []).find((market: any) => market.key === "h2h");
      if (!h2hMarket) continue;

      for (const outcome of h2hMarket.outcomes || []) {
        const outcomeTeam = normalizeNrlTeamName(outcome.name);
        const price = Number(outcome.price) || 0;
        if (outcomeTeam === homeTeam && price > bestHomeOdds) {
          bestHomeOdds = price;
          bestHomeBookmaker = bookmaker.title || bookmaker.key || "";
        }
        if (outcomeTeam === awayTeam && price > bestAwayOdds) {
          bestAwayOdds = price;
          bestAwayBookmaker = bookmaker.title || bookmaker.key || "";
        }
      }
    }

    return {
      id: event.id || "",
      commenceTime: event.commence_time || "",
      homeTeam,
      awayTeam,
      sheetHomeTeam: shortNrlTeamName(homeTeam),
      sheetAwayTeam: shortNrlTeamName(awayTeam),
      matchKey: buildOddsMatchKey(homeTeam, awayTeam),
      bestHomeOdds,
      bestAwayOdds,
      bestHomeBookmaker,
      bestAwayBookmaker,
      lastUpdated: updatedAt,
    };
  }).filter((row: any) => row.homeTeam && row.awayTeam && row.bestHomeOdds && row.bestAwayOdds);
}

async function refreshBestMatchOdds(force = false) {
  const rawOdds = await fetchLiveOddsRaw(force);
  const odds = buildBestMatchOdds(rawOdds);
  const payload = {
    updatedAt: new Date().toISOString(),
    sport: "rugbyleague_nrl",
    market: "h2h",
    odds,
  };
  await kv.set("best_match_odds_cache", JSON.stringify(payload));
  await kv.set("best_match_odds_cache_time", Date.now().toString());
  return payload;
}

function normalizeOddsPlayerName(name: string) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDecimalOdds(price: any) {
  const numericPrice = Number(price) || 0;
  if (!numericPrice) return 0;

  // Some player prop books can return American-style prices even when decimal
  // odds are requested. Convert obvious American prices back to decimal.
  if (numericPrice >= 100) return 1 + (numericPrice / 100);
  if (numericPrice <= -100) return 1 + (100 / Math.abs(numericPrice));

  return numericPrice;
}

async function fetchNrlEventsRaw(force = false) {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY environment variable. Add your The Odds API key.");
  }

  const cachedEvents = await kv.get("nrl_events_cache");
  const cacheTime = await kv.get("nrl_events_cache_time");
  const now = Date.now();

  // Events do not count against The Odds API quota, but this keeps the edge
  // function fast and avoids needless network calls.
  if (!force && cachedEvents && cacheTime && (now - Number(cacheTime)) < NRL_EVENTS_CACHE_MS) {
    return typeof cachedEvents === "string" ? JSON.parse(cachedEvents) : cachedEvents;
  }

  const response = await fetch(`https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/events?apiKey=${apiKey}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch NRL events from The Odds API: ${text}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    await kv.set("nrl_events_cache", JSON.stringify(data));
    await kv.set("nrl_events_cache_time", now.toString());
  }

  return data;
}

async function fetchTryScorerEventOdds(event: any, force = false) {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY environment variable. Add your The Odds API key.");
  }

  const eventId = event?.id || "";
  if (!eventId) return null;

  const cacheKey = `try_scorer_event_odds:${eventId}`;
  const cacheTimeKey = `try_scorer_event_odds_time:${eventId}`;
  const cachedOdds = await kv.get(cacheKey);
  const cacheTime = await kv.get(cacheTimeKey);
  const now = Date.now();
  const parsedCachedOdds = cachedOdds
    ? (typeof cachedOdds === "string" ? JSON.parse(cachedOdds) : cachedOdds)
    : null;

  if (hasEventCommenced(event, now)) {
    const locked = await getLockedOddsSnapshot(event, "try-scorer");
    if (locked) return locked;

    if (parsedCachedOdds) {
      const lockedFromCache = await lockOddsSnapshot(parsedCachedOdds, "try-scorer-cache", "try-scorer");
      await kv.set(cacheKey, JSON.stringify(lockedFromCache));
      return lockedFromCache;
    }

    console.warn(`[TryScorerOdds] Event ${eventId} has commenced and no pre-match odds snapshot exists.`);
    return {
      id: eventId,
      home_team: event.home_team || "",
      away_team: event.away_team || "",
      commence_time: event.commence_time || "",
      bookmakers: [],
      oddsLockedUnavailable: true,
    };
  }

  // Player props are fetched event-by-event and are expensive on the free plan.
  // Keep them aligned with the main odds cache unless explicitly refreshed.
  if (!force && parsedCachedOdds && cacheTime && (now - Number(cacheTime)) < TRY_SCORER_ODDS_CACHE_MS) {
    return parsedCachedOdds;
  }

  const url = `https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/events/${eventId}/odds?apiKey=${apiKey}&regions=au&markets=player_try_scorer_anytime&oddsFormat=decimal`;
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    if (parsedCachedOdds) {
      console.warn(`[TryScorerOdds] Returning cached event ${eventId} after API error: ${text}`);
      return parsedCachedOdds;
    }
    console.warn(`[TryScorerOdds] Failed event ${eventId}: ${text}`);
    return {
      id: eventId,
      home_team: event.home_team || "",
      away_team: event.away_team || "",
      commence_time: event.commence_time || "",
      bookmakers: [],
      error: text,
    };
  }

  const data = await response.json();
  await kv.set(cacheKey, JSON.stringify(data));
  await kv.set(cacheTimeKey, now.toString());
  return data;
}

function buildBestTryScorerOdds(eventOddsList: any[]) {
  const updatedAt = new Date().toISOString();
  const bestByPlayerAndMatch = new Map<string, any>();

  for (const eventOdds of eventOddsList || []) {
    if (!eventOdds) continue;

    const homeTeam = normalizeNrlTeamName(eventOdds.home_team);
    const awayTeam = normalizeNrlTeamName(eventOdds.away_team);
    const sheetMatch = `${shortNrlTeamName(homeTeam)} v ${shortNrlTeamName(awayTeam)}`;
    const matchKey = buildOddsMatchKey(homeTeam, awayTeam);

    for (const bookmaker of eventOdds.bookmakers || []) {
      const tryScorerMarket = (bookmaker.markets || []).find((market: any) =>
        market.key === "player_try_scorer_anytime"
      );
      if (!tryScorerMarket) continue;

      for (const outcome of tryScorerMarket.outcomes || []) {
        const outcomeName = String(outcome.name || "").trim();
        const outcomeType = outcomeName.toLowerCase();
        const player = String(outcome.description || outcome.name || "").trim();
        const price = toDecimalOdds(outcome.price);
        const playerKey = normalizeOddsPlayerName(player);

        if (outcome.description && !["yes", "over"].includes(outcomeType)) continue;
        if (!player || !playerKey || price <= 1) continue;

        const key = `${matchKey}|${playerKey}`;
        const existing = bestByPlayerAndMatch.get(key);
        if (!existing || price > existing.bestOdds) {
          bestByPlayerAndMatch.set(key, {
            eventId: eventOdds.id || "",
            commenceTime: eventOdds.commence_time || "",
            homeTeam,
            awayTeam,
            sheetHomeTeam: shortNrlTeamName(homeTeam),
            sheetAwayTeam: shortNrlTeamName(awayTeam),
            sheetMatch,
            matchKey,
            player,
            normalizedPlayer: playerKey,
            bestOdds: price,
            bookmaker: bookmaker.title || bookmaker.key || "",
            lastUpdated: updatedAt,
          });
        }
      }
    }
  }

  return Array.from(bestByPlayerAndMatch.values()).sort((a: any, b: any) =>
    `${a.sheetMatch}${a.player}`.localeCompare(`${b.sheetMatch}${b.player}`)
  );
}

async function refreshBestTryScorerOdds(force = false) {
  const events = await fetchNrlEventsRaw(force);
  const eventOddsList = [];

  for (const event of events || []) {
    const eventOdds = await fetchTryScorerEventOdds(event, force);
    if (eventOdds) eventOddsList.push(eventOdds);
  }

  const odds = buildBestTryScorerOdds(eventOddsList);
  const payload = {
    updatedAt: new Date().toISOString(),
    sport: "rugbyleague_nrl",
    market: "player_try_scorer_anytime",
    eventCount: (events || []).length,
    odds,
  };
  await kv.set("best_try_scorer_odds_cache", JSON.stringify(payload));
  await kv.set("best_try_scorer_odds_cache_time", Date.now().toString());
  return payload;
}

function allowOddsForceRefresh(c: any) {
  if (c.req.query("force") !== "true") return false;

  const configuredToken = Deno.env.get("ODDS_REFRESH_TOKEN");
  if (!configuredToken) {
    console.warn("[OddsAPI] Ignoring force=true because ODDS_REFRESH_TOKEN is not configured.");
    return false;
  }

  const requestToken =
    c.req.header("x-rightedge-odds-refresh-token") ||
    c.req.query("refreshToken") ||
    "";

  if (requestToken !== configuredToken) {
    console.warn("[OddsAPI] Ignoring force=true because refresh token did not match.");
    return false;
  }

  return true;
}

app.get("/live-odds", async (c) => {
  try {
    const force = allowOddsForceRefresh(c);
    const bookmaker = c.req.query("bookmaker") || "";
    const sportKey = String(c.req.query("sport") || "").toLowerCase() === "origin"
      ? ORIGIN_SPORT_KEY
      : NRL_SPORT_KEY;
    if (sportKey === NRL_SPORT_KEY && normalizeBookmakerFilter(bookmaker) === "betr") {
      c.header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
      return c.json(await fetchBlueBetNrlOddsRaw());
    }

    const data = await fetchLiveOddsRaw(force, "au", "", sportKey);
    return c.json(filterMatchOddsBookmakers(data, bookmaker));
  } catch (err: any) {
    console.error("Server error fetching live odds:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.get("/cricket-live-odds", async (c) => {
  try {
    const bookmaker = normalizeBookmakerFilter(c.req.query("bookmaker") || "betr");
    c.header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");

    if (bookmaker && bookmaker !== "betr") {
      return c.json([]);
    }

    const home = normalizeBlueBetGenericTeamName(c.req.query("home") || "");
    const away = normalizeBlueBetGenericTeamName(c.req.query("away") || "");
    const events = await fetchBlueBetCricketOddsRaw();

    if (home || away) {
      return c.json(events.filter((event: any) => {
        const eventHome = normalizeBlueBetGenericTeamName(event?.home_team || "");
        const eventAway = normalizeBlueBetGenericTeamName(event?.away_team || "");
        return (!home || eventHome.toLowerCase() === home.toLowerCase()) &&
          (!away || eventAway.toLowerCase() === away.toLowerCase());
      }));
    }

    return c.json(events);
  } catch (err: any) {
    console.error("Server error fetching cricket live odds:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.get("/best-match-odds", async (c) => {
  try {
    const force = allowOddsForceRefresh(c);
    const format = c.req.query("format") || "json";
    const bookmaker = c.req.query("bookmaker") || "";
    const normalizedBookmaker = normalizeBookmakerFilter(bookmaker);
    const payload = normalizedBookmaker
      ? {
          updatedAt: new Date().toISOString(),
          sport: "rugbyleague_nrl",
          market: "h2h",
          odds: buildBestMatchOdds(
            filterMatchOddsBookmakers(
              await fetchLiveOddsRaw(force, "au", normalizedBookmaker),
              normalizedBookmaker,
            ),
          ),
        }
      : await refreshBestMatchOdds(force);

    if (format === "sheets") {
      return c.json({
        ...payload,
        rows: payload.odds.map((row: any) => [
          row.sheetHomeTeam,
          row.sheetAwayTeam,
          row.bestHomeOdds,
          row.bestAwayOdds,
          row.bestHomeBookmaker,
          row.bestAwayBookmaker,
          row.commenceTime,
          row.lastUpdated,
        ]),
      });
    }

    return c.json(payload);
  } catch (err: any) {
    console.error("Server error building best match odds:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.get("/best-try-scorer-odds", async (c) => {
  try {
    const force = allowOddsForceRefresh(c);
    const format = c.req.query("format") || "json";
    const bookmaker = c.req.query("bookmaker") || "";
    const normalizedBookmaker = normalizeBookmakerFilter(bookmaker);
    const payload =
      normalizedBookmaker === "betr"
        ? {
            updatedAt: new Date().toISOString(),
            sport: "rugbyleague_nrl",
            market: "player_try_scorer_anytime",
            eventCount: 0,
            odds: buildBestTryScorerOdds(await fetchBlueBetNrlOddsRaw()),
          }
        : await refreshBestTryScorerOdds(force);

    if (normalizedBookmaker === "betr") {
      c.header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
      payload.eventCount = new Set(payload.odds.map((row: any) => row.matchKey)).size;
    }

    if (format === "sheets") {
      return c.json({
        ...payload,
        rows: payload.odds.map((row: any) => [
          row.sheetMatch,
          row.sheetHomeTeam,
          row.sheetAwayTeam,
          row.player,
          row.normalizedPlayer,
          row.bestOdds,
          row.bookmaker,
          row.commenceTime,
          row.lastUpdated,
        ]),
      });
    }

    return c.json(payload);
  } catch (err: any) {
    console.error("Server error building best try scorer odds:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.post("/verify-email", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();
    
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return c.json({ error: "Stripe not configured" }, 500);
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const { activeSubscription, customerId } = await findActiveStripeSubscription(stripe, email);
    
    if (!activeSubscription) {
      return c.json({ active: false });
    }

    await saveVerifiedSubscriber(email, "stripe_login_verified", {
      customerId,
      subscriptionId: activeSubscription.id,
      subscriptionStatus: activeSubscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(activeSubscription),
      cancelAtPeriodEnd: Boolean(activeSubscription.cancel_at_period_end),
    });
    await syncResendLifecycle(email, "premium");
    const authSession = await createAuthSession(email, "premium");
    writeAuthSessionCookie(c, authSession.token);

    // Keep compatibility with the currently deployed frontend, which sends
    // users with active=true into the old OTP screen. Returning active=false
    // lets it continue to create-checkout-session, where existing subscribers
    // are bounced straight back into confirmed access without paying again.
    return c.json({
      active: false,
      instantAccess: true,
      email,
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      message: "Active subscription verified.",
    });
  } catch (err: any) {
    console.error("[Verify Email] Error:", err);
    return c.json({ error: "Failed to verify email" }, 500);
  }
});

async function findActiveStripeSubscription(stripe: Stripe, email: string) {
  const customers = await stripe.customers.list({ email, limit: 10 });
  let activeSubscription: any = null;
  let customerId = "";

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });

    activeSubscription = subscriptions.data.find((subscription: any) =>
      ["active", "trialing"].includes(subscription.status)
    );

    if (activeSubscription) {
      customerId = customer.id;
      break;
    }
  }

  return { activeSubscription, customerId };
}

async function createInstantAccessUrl(email: string, returnUrl: string, returnHash: string, customerId: string, subscription: any) {
  const token = crypto.randomUUID();
  await kv.set(`instant_access:${token}`, JSON.stringify({
    email,
    returnHash,
    customerId,
    subscriptionId: subscription?.id || "",
    subscriptionStatus: subscription?.status || "",
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    createdAt: new Date().toISOString(),
  }));

  return `${returnUrl}?success=true&session_id=cs_rightedge_${token}&return_hash=${encodeURIComponent(returnHash)}#${returnHash}`;
}

app.post("/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();
    const code = body?.code?.trim();
    
    if (!email || !code) return c.json({ error: "Missing email or code" }, 400);
    
    const storedOtp = await kv.get(`otp:${email}`);
    if (storedOtp && storedOtp === code) {
      await kv.del(`otp:${email}`);
      return c.json({ success: true });
    } else {
      return c.json({ error: "Invalid or expired code" }, 400);
    }
  } catch (err: any) {
    return c.json({ error: "Verification failed" }, 500);
  }
});

app.post("/create-customer-portal", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();
    const returnUrl = body?.returnUrl || "http://localhost:5173";
    
    if (!email) return c.json({ error: "Email required" }, 400);
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return c.json({ error: "Stripe not configured" }, 500);
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (customers.data.length === 0) {
      return c.json({ error: "No active subscription found for this email." }, 404);
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: returnUrl,
    });
    
    return c.json({ url: session.url });
  } catch (err: any) {
    console.error("[Stripe] Error creating portal session:", err);
    return c.json({ error: "Failed to create portal session" }, 500);
  }
});

app.post("/apply-retention-offer", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email) return c.json({ error: "Email required" }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return c.json({ error: "Stripe not configured" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const { activeSubscription } = await findActiveStripeSubscription(stripe, email);

    if (!activeSubscription) {
      return c.json({ error: "No active subscription found for this email." }, 404);
    }

    const couponId = await resolveRetentionCouponId(stripe);
    const updatedSubscription = await stripe.subscriptions.update(activeSubscription.id, {
      coupon: couponId,
      cancel_at_period_end: false,
      metadata: {
        ...(activeSubscription.metadata || {}),
        rightedgeRetentionOfferActive: "true",
        rightedgeRetentionOfferCouponId: couponId,
        rightedgeRetentionOfferInvoicesRemaining: String(STRIPE_RETENTION_OFFER_INVOICES),
        rightedgeRetentionOfferAppliedAt: new Date().toISOString(),
      },
    } as any);

    await syncStripeSubscriptionStatus(stripe, updatedSubscription, "retention_offer_applied");

    return c.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      invoicesRemaining: STRIPE_RETENTION_OFFER_INVOICES,
      message: "50% off has been applied for your next 2 rounds.",
    });
  } catch (err: any) {
    const message = err?.message || "Failed to apply retention offer";
    console.error("[Stripe] Error applying retention offer:", message, err);
    return c.json({ error: message }, 500);
  }
});

app.post("/stripe-webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return c.text("Webhook signature or configuration missing", 400);
  }

  let event: any;

  try {
    const stripe = getStripeClient();
    const rawBody = await c.req.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err?.message || err);
    return c.text(`Webhook Error: ${err?.message || "Invalid signature"}`, 400);
  }

  try {
    const stripe = getStripeClient();

    switch (event.type) {
      case "checkout.session.completed":
        await syncStripeCheckoutSession(stripe, event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncStripeSubscriptionStatus(stripe, event.data.object, event.type);
        break;

      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        await syncStripeInvoiceSubscription(stripe, event.data.object, event.type);
        break;

      default:
        console.log(`[Stripe Webhook] Ignored event ${event.type}`);
        break;
    }

    await kv.set(`stripe_webhook:${event.id}`, JSON.stringify({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    }));

    return c.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook] Handler failed:", err?.message || err, err?.stack);
    return c.text(`Webhook handler failed: ${err?.message || "unknown error"}`, 500);
  }
});

app.post("/create-checkout-session", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();
    const returnUrl = body?.returnUrl || "http://localhost:5173";
    const returnHash = ["matches", "origin", "best-bets", "try-scorers", "sgm-builder"].includes(body?.returnHash)
      ? body.returnHash
      : "best-bets";
    const cancelUrl = body?.cancelUrl || `${returnUrl}#${returnHash}`;
    const plan = normalizePremiumCheckoutPlan(body?.plan || body?.billingPlan || body?.interval);

    if (!email || !email.includes('@') || !email.includes('.')) {
      return c.json({ error: "Please enter a valid email address." }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[Stripe] Missing STRIPE_SECRET_KEY");
      return c.json({ error: "Payment system not configured properly." }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const { activeSubscription, customerId } = await findActiveStripeSubscription(stripe, email);

    if (activeSubscription) {
      const url = await createInstantAccessUrl(email, returnUrl, returnHash, customerId, activeSubscription);
      console.log(`[Stripe] Existing subscriber ${email} given instant premium access for #${returnHash}`);
      return c.json({
        url,
        instantAccess: true,
        subscriptionId: activeSubscription.id,
      });
    }

    const premiumPriceId = await resolvePremiumStripePriceId(stripe, plan);

    await kv.set(`checkout_lead:${email}`, JSON.stringify({
      email,
      returnHash,
      plan,
      source: body?.source || `premium_${returnHash}`,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      completed_subscription: false,
      attempt_count: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: email,
      metadata: {
        email,
        returnHash,
        plan,
        priceId: premiumPriceId,
        checkoutVersion: STRIPE_CHECKOUT_VERSION,
        expectedProductId: STRIPE_PREMIUM_EXPECTED_PRODUCT_ID,
        source: body?.source || `premium_${returnHash}`,
      },
      subscription_data: {
        metadata: {
          email,
          returnHash,
          plan,
          priceId: premiumPriceId,
          checkoutVersion: STRIPE_CHECKOUT_VERSION,
          expectedProductId: STRIPE_PREMIUM_EXPECTED_PRODUCT_ID,
          source: body?.source || `premium_${returnHash}`,
        },
      },
      line_items: [{
        price: premiumPriceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}&return_hash=${encodeURIComponent(returnHash)}#${returnHash}`,
      cancel_url: `${returnUrl}?canceled=true&return_hash=${encodeURIComponent(returnHash)}#${returnHash}`,
    });

    console.log(`[Stripe] Created ${plan} checkout session ${session.id} using ${premiumPriceId} for ${email} returning to #${returnHash}`);
    return c.json({
      url: session.url,
      sessionId: session.id,
      plan,
      priceId: premiumPriceId,
      checkoutVersion: STRIPE_CHECKOUT_VERSION,
    });
  } catch (err: any) {
    console.error("[Stripe] Error creating checkout session:", err);
    return c.json({ error: "Failed to create checkout session." }, 500);
  }
});

async function saveVerifiedSubscriber(email: string, source = 'stripe_verified', stripeData: any = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `subscriber:${normalizedEmail}`;
  const existingSubscriber = await kv.get(key);
  const isNewSubscriber = !existingSubscriber;
  const existingSubscriberRecord = parseKvValue<any>(existingSubscriber) || {};
  let favoriteTeam = "";

  try {
    const freeAccess = await kv.get(`free_access:${normalizedEmail}`);
    if (freeAccess) {
      const parsedFreeAccess = typeof freeAccess === "string" ? JSON.parse(freeAccess) : freeAccess;
      favoriteTeam = String(parsedFreeAccess?.favoriteTeam || "").trim();
    }
  } catch (teamErr) {
    console.error("[saveVerifiedSubscriber] Failed to load free_access team:", teamErr);
  }

  const payload = {
    ...existingSubscriberRecord,
    email: normalizedEmail,
    subscribedAt: existingSubscriberRecord.subscribedAt || new Date().toISOString(),
    source,
    favoriteTeam,
    stripeCustomerId: stripeData.customerId || existingSubscriberRecord.stripeCustomerId || '',
    stripeSubscriptionId: stripeData.subscriptionId || existingSubscriberRecord.stripeSubscriptionId || '',
    stripeCheckoutSessionId: stripeData.checkoutSessionId || existingSubscriberRecord.stripeCheckoutSessionId || '',
    stripeSubscriptionStatus: normalizeStripeSubscriptionStatus(
      stripeData.subscriptionStatus || existingSubscriberRecord.stripeSubscriptionStatus || "active"
    ),
    stripeCurrentPeriodEnd: stripeData.currentPeriodEnd || existingSubscriberRecord.stripeCurrentPeriodEnd || '',
    stripeCancelAtPeriodEnd:
      typeof stripeData.cancelAtPeriodEnd === "boolean"
        ? stripeData.cancelAtPeriodEnd
        : Boolean(existingSubscriberRecord.stripeCancelAtPeriodEnd),
    stripeStatusUpdatedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
  };

  await kv.set(key, JSON.stringify(payload));

  try {
    const leadKey = `checkout_lead:${normalizedEmail}`;
    const existingLead = await kv.get(leadKey);
    if (existingLead) {
      const lead: any = typeof existingLead === 'string' ? JSON.parse(existingLead) : existingLead;
      lead.completed_subscription = true;
      lead.subscribed_at = new Date().toISOString();
      lead.stripe_checkout_session_id = stripeData.checkoutSessionId || '';
      lead.stripe_customer_id = stripeData.customerId || '';
      lead.stripe_subscription_id = stripeData.subscriptionId || '';
      await kv.set(leadKey, JSON.stringify(lead));
    }
  } catch (leadErr) {
    console.error('[saveVerifiedSubscriber] Failed to update checkout_lead:', leadErr);
  }

  return { payload, isNewSubscriber };
}

function getStripeCustomerIdFromSubscription(subscription: any) {
  return typeof subscription?.customer === "string"
    ? subscription.customer
    : subscription?.customer?.id || "";
}

function getStripeCurrentPeriodEnd(subscription: any) {
  const currentPeriodEnd = Number(subscription?.current_period_end || 0);
  return currentPeriodEnd > 0
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : "";
}

async function resolveSubscriptionEmail(stripe: Stripe, subscription: any) {
  const metadataEmail = String(subscription?.metadata?.email || "").trim().toLowerCase();
  if (metadataEmail.includes("@")) return metadataEmail;

  const customerId = getStripeCustomerIdFromSubscription(subscription);
  const linkedSubscriber = await getSubscriberByStripeIds({
    subscriptionId: subscription?.id,
    customerId,
  });
  if (linkedSubscriber?.email) return String(linkedSubscriber.email).trim().toLowerCase();

  if (customerId) {
    try {
      const customer: any = await stripe.customers.retrieve(customerId);
      const customerEmail = String(customer?.email || "").trim().toLowerCase();
      if (customerEmail.includes("@")) return customerEmail;
    } catch (customerErr) {
      console.error("[Stripe Webhook] Failed to resolve customer email:", customerErr);
    }
  }

  return "";
}

async function syncStripeSubscriptionStatus(stripe: Stripe, subscription: any, source: string) {
  const email = await resolveSubscriptionEmail(stripe, subscription);
  if (!email || !email.includes("@")) {
    console.warn("[Stripe Webhook] Subscription event skipped: no email could be resolved.", {
      subscriptionId: subscription?.id,
      status: subscription?.status,
    });
    return null;
  }

  const customerId = getStripeCustomerIdFromSubscription(subscription);
  const status = normalizeStripeSubscriptionStatus(subscription?.status);

  const result = await saveVerifiedSubscriber(email, source, {
    customerId,
    subscriptionId: subscription?.id || "",
    subscriptionStatus: status,
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
  });

  if (isPremiumStripeStatus(status)) {
    await syncResendLifecycle(email, "premium");
  }

  await kv.set(`stripe_subscription:${subscription?.id}`, JSON.stringify({
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription?.id || "",
    stripeSubscriptionStatus: status,
    stripeCurrentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    stripeCancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    source,
    updatedAt: new Date().toISOString(),
  }));

  console.log(`[Stripe Webhook] Synced ${subscription?.id} (${status}) for ${email}`);
  return result;
}

function getSubscriptionIdFromInvoice(invoice: any) {
  const directSubscription =
    typeof invoice?.subscription === "string"
      ? invoice.subscription
      : invoice?.subscription?.id || "";

  if (directSubscription) return directSubscription;

  const parentSubscription =
    typeof invoice?.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice?.parent?.subscription_details?.subscription?.id || "";

  if (parentSubscription) return parentSubscription;

  const lineSubscription = invoice?.lines?.data
    ?.map((line: any) => line?.parent?.subscription_item_details?.subscription)
    ?.find(Boolean);

  return typeof lineSubscription === "string" ? lineSubscription : lineSubscription?.id || "";
}

async function syncStripeInvoiceSubscription(stripe: Stripe, invoice: any, source: string) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    console.warn("[Stripe Webhook] Invoice event skipped: no subscription id.");
    return null;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await updateRetentionOfferUsage(stripe, subscription, invoice, source);
  return syncStripeSubscriptionStatus(stripe, subscription, source);
}

async function updateRetentionOfferUsage(stripe: Stripe, subscription: any, invoice: any, source: string) {
  if (source !== "invoice.payment_succeeded") return;

  const metadata = subscription?.metadata || {};
  if (metadata.rightedgeRetentionOfferActive !== "true") return;

  const invoiceId = String(invoice?.id || "");
  if (invoiceId && metadata.rightedgeRetentionOfferLastInvoiceId === invoiceId) return;

  const remaining = Math.max(
    0,
    Number.parseInt(String(metadata.rightedgeRetentionOfferInvoicesRemaining || "0"), 10) || 0,
  );

  if (remaining <= 0) return;

  const nextRemaining = remaining - 1;
  const nextMetadata = {
    ...metadata,
    rightedgeRetentionOfferInvoicesRemaining: String(nextRemaining),
    rightedgeRetentionOfferLastInvoiceId: invoiceId,
    rightedgeRetentionOfferLastInvoiceAt: new Date().toISOString(),
  };

  if (nextRemaining <= 0) {
    try {
      await (stripe.subscriptions as any).deleteDiscount(subscription.id);
    } catch (err: any) {
      console.warn("[Stripe] Could not remove retention discount:", err?.message || err);
    }

    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...nextMetadata,
        rightedgeRetentionOfferActive: "false",
        rightedgeRetentionOfferCompletedAt: new Date().toISOString(),
      },
    });
    return;
  }

  await stripe.subscriptions.update(subscription.id, {
    metadata: nextMetadata,
  });
}

async function syncStripeCheckoutSession(stripe: Stripe, session: any) {
  if (session?.mode !== "subscription") return null;

  const subscriptionId =
    typeof session?.subscription === "string"
      ? session.subscription
      : session?.subscription?.id || "";

  const email =
    String(session?.customer_details?.email || "").trim().toLowerCase() ||
    String(session?.customer_email || "").trim().toLowerCase() ||
    String(session?.metadata?.email || "").trim().toLowerCase();

  if (!subscriptionId) {
    console.warn("[Stripe Webhook] Checkout completed skipped: no subscription id.");
    return null;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const synced = await syncStripeSubscriptionStatus(stripe, subscription, "stripe_checkout_completed_webhook");

  if (email.includes("@")) {
    const customerId =
      typeof session?.customer === "string"
        ? session.customer
        : session?.customer?.id || getStripeCustomerIdFromSubscription(subscription);

    await saveVerifiedSubscriber(email, "stripe_checkout_completed_webhook", {
      customerId,
      subscriptionId,
      checkoutSessionId: session?.id || "",
      subscriptionStatus: subscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
      cancelAtPeriodEnd: Boolean((subscription as any)?.cancel_at_period_end),
    });
    await syncResendLifecycle(email, "premium");
  }

  return synced;
}

type BroadcastAudience = "premium" | "free" | "all";

function normalizeBroadcastAudience(value: unknown): BroadcastAudience {
  const audience = String(value || "").trim().toLowerCase();
  if (audience === "free" || audience === "all") return audience;
  return "premium";
}

function normalizeTeamFilter(team: unknown) {
  return String(team || "").trim();
}

function normalizeRecipientEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((email) => String(email || "").trim().toLowerCase())
    .filter((email) => email.includes("@"))
  )];
}

function normalizeExpectedRecipientCount(value: unknown) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

async function loadFreeAccessLookup() {
  const entries = await kv.getByPrefix("free_access:") || [];
  const lookup = new Map<string, any>();

  for (const entry of entries) {
    try {
      const parsed = typeof entry === "string" ? JSON.parse(entry) : entry;
      const email = String(parsed?.email || "").trim().toLowerCase();
      if (!email) continue;
      lookup.set(email, parsed);
    } catch {
      continue;
    }
  }

  return lookup;
}

async function loadBroadcastRecipients(opts: { audience?: BroadcastAudience; team?: string }) {
  const audience = normalizeBroadcastAudience(opts.audience);
  const teamFilter = normalizeTeamFilter(opts.team);
  const freeAccessLookup = await loadFreeAccessLookup();

  const recipientMap = new Map<string, { email: string; favoriteTeam?: string; source: string; segment: "premium" | "free" }>();
  const matchesTeam = (favoriteTeam: string) => {
    if (!teamFilter) return true;
    return String(favoriteTeam || "").trim().toLowerCase() === teamFilter.toLowerCase();
  };

  if (audience === "free" || audience === "all") {
    for (const record of freeAccessLookup.values()) {
      try {
        const email = String(record?.email || "").trim().toLowerCase();
        if (!email) continue;
        const favoriteTeam = String(record?.favoriteTeam || "").trim();
        if (!matchesTeam(favoriteTeam)) continue;

        recipientMap.set(email, {
          email,
          favoriteTeam,
          source: String(record?.source || "free_access"),
          segment: "free",
        });
      } catch {
        continue;
      }
    }
  }

  if (audience === "premium" || audience === "all") {
    const subscribers = await kv.getByPrefix("subscriber:") || [];
    for (const entry of subscribers) {
      try {
        const record = typeof entry === "string" ? JSON.parse(entry) : entry;
        const email = String(record?.email || "").trim().toLowerCase();
        if (!email) continue;
        const subscriptionStatus = normalizeStripeSubscriptionStatus(record?.stripeSubscriptionStatus);
        if (subscriptionStatus && !isPremiumStripeStatus(subscriptionStatus)) continue;

        const linkedFreeAccess = freeAccessLookup.get(email);
        const favoriteTeam = String(record?.favoriteTeam || linkedFreeAccess?.favoriteTeam || "").trim();
        if (!matchesTeam(favoriteTeam)) continue;

        recipientMap.set(email, {
          email,
          favoriteTeam,
          source: String(record?.source || "subscriber"),
          segment: "premium",
        });
      } catch {
        continue;
      }
    }
  }

  return { audience, teamFilter, recipients: [...recipientMap.values()] };
}

async function resolveGuardedBroadcastRecipients(body: any) {
  const audience = normalizeBroadcastAudience(body?.audience);
  const team = normalizeTeamFilter(body?.team);
  const expectedRecipientCount = normalizeExpectedRecipientCount(body?.expectedRecipientCount);
  const requestedRecipientEmails = normalizeRecipientEmails(body?.recipientEmails);
  const { recipients } = await loadBroadcastRecipients({ audience, team });
  let liveRecipients = recipients || [];

  if (requestedRecipientEmails.length > 0) {
    const eligibleByEmail = new Map(liveRecipients.map((recipient) => [recipient.email, recipient]));
    const ineligibleEmails = requestedRecipientEmails.filter((email) => !eligibleByEmail.has(email));

    if (ineligibleEmails.length > 0) {
      return {
        ok: false,
        status: 400,
        error: "Recipient list contains emails outside the selected audience/team filter",
        details: { ineligibleCount: ineligibleEmails.length, audience, team },
        audience,
        team,
        recipients: [],
      };
    }

    liveRecipients = requestedRecipientEmails
      .map((email) => eligibleByEmail.get(email))
      .filter(Boolean) as typeof recipients;
  }

  if (expectedRecipientCount !== null && liveRecipients.length !== expectedRecipientCount) {
    return {
      ok: false,
      status: 409,
      error: `Recipient count mismatch: admin expected ${expectedRecipientCount}, server matched ${liveRecipients.length}. Nothing was sent.`,
      details: { expectedRecipientCount, matchedRecipientCount: liveRecipients.length, audience, team },
      audience,
      team,
      recipients: [],
    };
  }

  return {
    ok: true,
    status: 200,
    audience,
    team,
    expectedRecipientCount,
    matchedRecipientCount: liveRecipients.length,
    recipients: liveRecipients,
  };
}

type PremiumBestBetAlertPlay = {
  round: number;
  match: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  side: "Home" | "Away" | "";
  stake: number;
  modelPct: number;
  edgePct: number;
  marketOdds: number;
  projectedScore: string;
};

type PremiumBestBetAlertContext = {
  round: number;
  plays: PremiumBestBetAlertPlay[];
};

const PREMIUM_BEST_BET_ALERT_LOCK_KEY = "premium_best_bets_alert:last";

function cleanBestBetSelection(value: string) {
  return normalizeNrlTeamName(
    String(value || "")
      .replace(/\s+\(Home\)/i, "")
      .replace(/\s+\(Away\)/i, "")
      .trim(),
  );
}

function getPredictionSide(bestBetCell: string, selection: string, homeTeam: string, awayTeam: string): "Home" | "Away" | "" {
  if (/\(Home\)/i.test(bestBetCell)) return "Home";
  if (/\(Away\)/i.test(bestBetCell)) return "Away";
  if (selection === normalizeNrlTeamName(homeTeam)) return "Home";
  if (selection === normalizeNrlTeamName(awayTeam)) return "Away";
  return "";
}

function isValidBestBetSelection(selection: string) {
  const cleaned = String(selection || "").trim();
  return Boolean(cleaned && cleaned !== "-" && cleaned !== "—");
}

async function loadPremiumBestBetAlertContext(): Promise<PremiumBestBetAlertContext> {
  const [predictionRows, fixtureRows] = await Promise.all([
    fetchPublishedSheetRows(SHEET_GIDS.matchPredictions),
    fetchPublishedSheetRows(SHEET_GIDS.fixtures2026),
  ]);

  const fixtures = fixtureRows
    .map((row) => {
      const round = toSheetRound(getSheetValue(row, ["Round Number", "RoundNumber", "Round"]));
      const kickoffMs = parseAestKickoffMs(
        getSheetValue(row, ["Date ISO", "DateISO"]),
        getSheetValue(row, ["AEST", "AEDT", "Time", "Kickoff"]),
        getSheetValue(row, ["TZ", "Timezone", "Time Zone"]) || "AEST",
      );
      return { round, kickoffMs };
    })
    .filter((fixture) => fixture.round)
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  const now = Date.now();
  const upcomingRound = fixtures.find((fixture) => fixture.kickoffMs >= now)?.round;

  const parsedPredictions = predictionRows
    .map((row) => {
      const homeTeam = shortNrlTeamName(getSheetValue(row, ["Home Team", "Home"]));
      const awayTeam = shortNrlTeamName(getSheetValue(row, ["Away Team", "Away"]));
      const round = toSheetRound(getSheetValue(row, ["Round", "Round Number", "RoundNumber", "NRL Round"]));
      const predictedHomeScore = toSheetNumber(getSheetValue(row, ["Predicted Home Score", "Home Score", "Projected Home Score"]));
      const predictedAwayScore = toSheetNumber(getSheetValue(row, ["Predicted Away Score", "Away Score", "Projected Away Score"]));
      const bestBetCell = getSheetValue(row, ["Best Value Bet", "Best Bet", "BestValueBet"]);
      const selection = cleanBestBetSelection(bestBetCell);
      const side = getPredictionSide(bestBetCell, selection, homeTeam, awayTeam);
      const modelHomeOdds = toSheetNumber(getSheetValue(row, ["Home Implied Odds", "Home Model Odds", "Model Home Odds"]));
      const modelAwayOdds = toSheetNumber(getSheetValue(row, ["Away Implied Odds", "Away Model Odds", "Model Away Odds"]));
      const marketHomeOdds = toSheetNumber(getSheetValue(row, ["Best Home Odds", "Tab Home Odds", "Actual Home Odds (Market)", "Home Market Odds"]));
      const marketAwayOdds = toSheetNumber(getSheetValue(row, ["Best Away Odds", "Tab Away Odds", "Actual Away Odds (Market)", "Away Market Odds"]));
      const homeOverlay = toSheetPercent(getSheetValue(row, ["Home Overlay %", "Home Overlay"]));
      const awayOverlay = toSheetPercent(getSheetValue(row, ["Away Overlay %", "Away Overlay"]));
      const stake = toSheetNumber(getSheetValue(row, ["Stake"]));
      const modelOdds = side === "Home" ? modelHomeOdds : side === "Away" ? modelAwayOdds : 0;

      return {
        round,
        match: homeTeam && awayTeam ? `${homeTeam} v ${awayTeam}` : "",
        homeTeam,
        awayTeam,
        selection,
        side,
        stake,
        modelPct: modelOdds > 1 ? (1 / modelOdds) * 100 : 0,
        edgePct: side === "Home" ? homeOverlay : side === "Away" ? awayOverlay : 0,
        marketOdds: side === "Home" ? marketHomeOdds : side === "Away" ? marketAwayOdds : 0,
        projectedScore: predictedHomeScore || predictedAwayScore
          ? `${Math.round(predictedHomeScore)}-${Math.round(predictedAwayScore)}`
          : "",
      };
    })
    .filter((row) => row.match && isValidBestBetSelection(row.selection) && row.stake > 0);

  const latestPredictionRound = Math.max(0, ...parsedPredictions.map((row) => row.round || 0));
  const targetRound = upcomingRound || latestPredictionRound;
  const roundPlays = targetRound
    ? parsedPredictions.filter((row) => row.round === targetRound)
    : parsedPredictions;
  const plays = (roundPlays.length ? roundPlays : parsedPredictions)
    .sort((a, b) =>
      (b.stake - a.stake) ||
      (b.edgePct - a.edgePct) ||
      (b.modelPct - a.modelPct)
    );

  return {
    round: targetRound || latestPredictionRound || 0,
    plays,
  };
}

function buildPremiumBestBetAlertFingerprint(ctx: PremiumBestBetAlertContext) {
  return [
    `round:${ctx.round}`,
    ...ctx.plays.map((play) => [
      play.match,
      play.selection,
      play.side,
      play.stake,
      play.marketOdds.toFixed(3),
      play.modelPct.toFixed(3),
      play.edgePct.toFixed(3),
    ].join("|")),
  ].join("::");
}

function formatAlertPercent(value: number, decimals = 1) {
  return Number.isFinite(value) ? `${value.toFixed(decimals)}%` : "—";
}

function formatAlertOdds(value: number) {
  return value > 1 ? `$${value.toFixed(2)}` : "Live price";
}

function buildPremiumBestBetAlertHtml(ctx: PremiumBestBetAlertContext) {
  const playCards = ctx.plays.map((play) => `
        <div style="background:#16161D;border:1px solid #1E1E2E;margin-top:12px;padding:18px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:top;padding-right:14px;">
                <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(play.match)}</div>
                <div style="margin-top:8px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:20px;line-height:1.18;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(publicNrlTeamName(play.selection))}</div>
                <div style="margin-top:8px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#9CA3AF;">Projected score ${escapeHtml(play.projectedScore || "TBC")} · stake ${play.stake.toFixed(1)}u</div>
              </td>
              <td style="vertical-align:top;text-align:right;width:150px;">
                <div style="display:inline-block;background:#111116;border:1px solid #1E1E2E;padding:10px 12px;text-align:left;">
                  <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:9px;line-height:1;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Model</div>
                  <div style="margin-top:6px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:18px;line-height:1;color:#4ADE80;font-weight:600;">${formatAlertPercent(play.modelPct)}</div>
                </div>
                <div style="margin-top:8px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#ffffff;font-weight:600;">${formatAlertOdds(play.marketOdds)}</div>
                <div style="margin-top:3px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;">Edge ${formatAlertPercent(play.edgePct, 2)}</div>
              </td>
            </tr>
          </table>
        </div>`).join("");

  return rightEdgeEmailShell(
    `${ctx.plays.length} premium best bet${ctx.plays.length === 1 ? "" : "s"} are live for Round ${ctx.round}.`,
    "Premium Alert",
    `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Round ${ctx.round} premium card</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">Best bets are live.</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            The model has ${ctx.plays.length} qualifying premium play${ctx.plays.length === 1 ? "" : "s"} on the current card. Check live prices before acting, because markets can move quickly.
          </div>
          ${emailCtaHtml("https://www.rightedge.com.au/#best-bets", "Open Premium Plays ->")}
        </div>
        ${playCards}
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:16px;padding:18px 20px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#9CA3AF;">This alert only sends when the premium card changes, so subscribers do not receive duplicate emails for the same set of plays.</div>
        </div>`
  );
}

async function runPremiumBestBetAlerts(opts: { dryRun?: boolean; force?: boolean; limit?: number; testMode?: boolean; testEmail?: string } = {}) {
  const dryRun = opts.dryRun !== false;
  const force = opts.force === true;
  const testMode = opts.testMode !== false;
  const testEmail = String(opts.testEmail || "elliott@woodbry.com").trim().toLowerCase();
  const limit = Number.isInteger(opts.limit) && opts.limit! > 0 ? Math.min(opts.limit!, 1000) : null;
  const ctx = await loadPremiumBestBetAlertContext();
  const fingerprint = buildPremiumBestBetAlertFingerprint(ctx);
  const lastAlert = parseKvValue<any>(await kv.get(PREMIUM_BEST_BET_ALERT_LOCK_KEY));

  if (!ctx.plays.length) {
    return {
      success: true,
      dryRun,
      testMode,
      skipped: true,
      reason: "no_qualifying_premium_plays",
      round: ctx.round,
      playCount: 0,
      recipientCount: 0,
    };
  }

  if (!testMode && !force && lastAlert?.fingerprint === fingerprint) {
    return {
      success: true,
      dryRun,
      testMode,
      skipped: true,
      reason: "duplicate_card",
      round: ctx.round,
      playCount: ctx.plays.length,
      recipientCount: Number(lastAlert?.recipientCount || 0),
      lastSentAt: lastAlert?.sentAt || "",
    };
  }

  const { recipients } = await loadBroadcastRecipients({ audience: "premium" });
  const livePremiumEmails = [...new Set(recipients.map((recipient) => recipient.email).filter(Boolean))]
    .slice(0, limit || undefined);
  const emailsToSend = testMode
    ? [testEmail].filter((email) => email.includes("@"))
    : livePremiumEmails;
  const subject = `RightEdge Premium: ${ctx.plays.length} best bet${ctx.plays.length === 1 ? "" : "s"} live for Round ${ctx.round}`;
  const htmlContent = buildPremiumBestBetAlertHtml(ctx);

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      testMode,
      skipped: false,
      round: ctx.round,
      playCount: ctx.plays.length,
      recipientCount: testMode ? 1 : livePremiumEmails.length,
      testRecipient: testMode ? testEmail : "",
      subject,
      fingerprint,
      plays: ctx.plays,
    };
  }

  if (!emailsToSend.length) {
    return {
      success: true,
      dryRun: false,
      testMode,
      skipped: true,
      reason: testMode ? "no_test_recipient" : "no_premium_recipients",
      round: ctx.round,
      playCount: ctx.plays.length,
      recipientCount: 0,
    };
  }

  const resend = getResendClient();
  const fromEmail = getFromEmail();
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
    const batch = emailsToSend.slice(i, i + BATCH_SIZE);
    const emailBatch = batch.map((email) => ({
      from: fromEmail,
      to: [email],
      subject,
      html: htmlContent,
    }));

    const { data, error } = await resend.batch.send(emailBatch);
    if (error) {
      throw new Error(`Premium best bet alert batch failed: ${JSON.stringify(error)}`);
    }
    results.push(data);
  }

  const sentAt = new Date().toISOString();
  if (!testMode) {
    await kv.set(PREMIUM_BEST_BET_ALERT_LOCK_KEY, JSON.stringify({
      fingerprint,
      round: ctx.round,
      playCount: ctx.plays.length,
      recipientCount: emailsToSend.length,
      sentAt,
      subject,
      testMode,
    }));
    await kv.set(`broadcast:${Date.now()}`, JSON.stringify({
      subject,
      htmlContent,
      sentAt,
      recipients: emailsToSend.length,
      source: "auto:premium-best-bets",
      audience: "premium",
      team: "",
    }));
  }

  return {
    success: true,
    dryRun: false,
    testMode,
    skipped: false,
    round: ctx.round,
    playCount: ctx.plays.length,
    recipientCount: emailsToSend.length,
    subject,
    fingerprint,
    results,
  };
}

app.post("/confirm-checkout-session", async (c) => {
  try {
    const body = await c.req.json();
    const sessionId = body?.session_id || body?.sessionId;

    if (!sessionId || !String(sessionId).startsWith("cs_")) {
      return c.json({ error: "Valid Stripe checkout session_id is required." }, 400);
    }

    if (String(sessionId).startsWith("cs_rightedge_")) {
      const token = String(sessionId).replace("cs_rightedge_", "");
      const instantAccess = await kv.get(`instant_access:${token}`);

      if (!instantAccess) {
        return c.json({ error: "Instant access session expired." }, 404);
      }

      const data: any = typeof instantAccess === "string" ? JSON.parse(instantAccess) : instantAccess;
      const email = data?.email?.trim()?.toLowerCase();
      if (!email || !email.includes("@")) {
        return c.json({ error: "Invalid instant access session." }, 400);
      }

      const returnHash = ["matches", "origin", "best-bets", "try-scorers", "sgm-builder"].includes(data.returnHash)
        ? data.returnHash
        : "best-bets";

      await saveVerifiedSubscriber(email, "stripe_existing_subscriber_instant_access", {
        customerId: data.customerId || "",
        subscriptionId: data.subscriptionId || "",
        subscriptionStatus: data.subscriptionStatus || "active",
        currentPeriodEnd: data.currentPeriodEnd || "",
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      });
      await syncResendLifecycle(email, "premium");
      await kv.del(`instant_access:${token}`);
      const authSession = await createAuthSession(email, "premium");
      writeAuthSessionCookie(c, authSession.token);

      console.log(`[Stripe] Confirmed instant premium access for existing subscriber ${email}`);
      return c.json({
        success: true,
        email,
        returnHash,
        customerId: data.customerId || "",
        subscriptionId: data.subscriptionId || "",
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[Stripe] Missing STRIPE_SECRET_KEY");
      return c.json({ error: "Payment system not configured properly." }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const paymentPaid = session.payment_status === "paid";
    const subscription: any = session.subscription;
    const subscriptionActive =
      typeof subscription === "object" &&
      ["active", "trialing"].includes(subscription.status);

    if (session.mode !== "subscription" || (!paymentPaid && !subscriptionActive)) {
      console.warn(`[Stripe] Checkout confirmation rejected for ${sessionId}:`, {
        mode: session.mode,
        payment_status: session.payment_status,
        subscription_status: typeof subscription === "object" ? subscription.status : null,
      });
      return c.json({ error: "Stripe session is not a paid active subscription." }, 402);
    }

    const email =
      session.customer_details?.email?.trim()?.toLowerCase() ||
      session.customer_email?.trim()?.toLowerCase() ||
      session.metadata?.email?.trim()?.toLowerCase();

    if (!email || !email.includes("@")) {
      return c.json({ error: "Could not determine subscriber email from Stripe session." }, 400);
    }

    const returnHash = ["matches", "origin", "best-bets", "try-scorers", "sgm-builder"].includes(session.metadata?.returnHash || "")
      ? session.metadata?.returnHash
      : "best-bets";

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer as any)?.id || "";

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as any)?.id || "";

    const { isNewSubscriber } = await saveVerifiedSubscriber(email, "stripe_checkout_confirmed", {
      customerId,
      subscriptionId,
      checkoutSessionId: session.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });

    await syncResendLifecycle(email, "premium");
    const authSession = await createAuthSession(email, "premium");
    writeAuthSessionCookie(c, authSession.token);

    if (isNewSubscriber) {
      try {
        await sendWelcomeEmail("premium", email);
      } catch (emailErr) {
        console.error("[confirm-checkout-session] Premium welcome email failed:", emailErr);
      }
    }

    await kv.set(`analytics:conversion:${new Date().toISOString()}:${crypto.randomUUID()}`, JSON.stringify({
      type: "premium_checkout_confirmed",
      email,
      returnHash,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeCheckoutSessionId: session.id,
      timestamp: new Date().toISOString(),
    }));

    console.log(`[Stripe] Confirmed paid subscription for ${email}`);
    return c.json({
      success: true,
      email,
      returnHash,
      customerId,
      subscriptionId,
    });
  } catch (err: any) {
    console.error("[Stripe] Error confirming checkout session:", err);
    return c.json({ error: "Failed to confirm checkout session." }, 500);
  }
});

app.post("/subscribe", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      return c.json({ error: "Please enter a valid email address." }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return c.json({ error: "Payment system not configured properly." }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email, limit: 10 });

    let activeSubscription: any = null;
    let customerId = "";

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });

      activeSubscription = subscriptions.data.find((subscription: any) =>
        isPremiumStripeStatus(subscription.status)
      );

      if (activeSubscription) {
        customerId = customer.id;
        break;
      }
    }

    if (!activeSubscription) {
      console.warn(`[Subscribe] Rejected unverified subscriber write for ${email}`);
      return c.json({ error: "No active Stripe subscription found for this email." }, 402);
    }

    const { isNewSubscriber } = await saveVerifiedSubscriber(email, body?.source || "stripe_active_verified", {
      customerId,
      subscriptionId: activeSubscription.id,
      subscriptionStatus: activeSubscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(activeSubscription),
      cancelAtPeriodEnd: Boolean(activeSubscription.cancel_at_period_end),
    });

    await syncResendLifecycle(email, "premium");

    if (isNewSubscriber) {
      try {
        await sendWelcomeEmail("premium", email);
      } catch (emailErr) {
        console.error("[subscribe] Premium welcome email failed:", emailErr);
      }
    }

    return c.json({ success: true, message: "You're in!", isNew: isNewSubscriber });
  } catch (err: any) {
    console.error("[Subscribe] ERROR verifying subscriber:", err?.message, err?.stack);
    return c.json({ error: "Something went wrong. Please try again.", message: err.message }, 500);
  }
});


app.post("/admin/broadcast/validate-recipients", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
       return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const resolved = await resolveGuardedBroadcastRecipients(body);

    if (!resolved.ok) {
      return c.json({
        error: resolved.error,
        guardVersion: 1,
        ...(resolved.details || {}),
      }, resolved.status);
    }

    return c.json({
      success: true,
      guardVersion: 1,
      audience: resolved.audience,
      team: resolved.team,
      matchedRecipientCount: resolved.matchedRecipientCount,
      expectedRecipientCount: resolved.expectedRecipientCount,
    });
  } catch (err: any) {
    console.error("[AdminEmail] Recipient validation error:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

// Admin endpoint to send mass emails
app.post("/admin/broadcast", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    // Basic protection - should use proper auth in production
    if (!authHeader) {
       return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { subject, htmlContent, testMode = true } = body;

    if (!subject || !htmlContent) {
      return c.json({ error: "Missing subject or htmlContent" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!fromEmail || !fromEmail.includes("@")) {
      fromEmail = 'RightEdge <elliott@rightedge.com.au>';
    }
    if (!resendApiKey) {
      return c.json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const resolved = await resolveGuardedBroadcastRecipients(body);
    if (!testMode && !resolved.ok) {
      return c.json({
        error: resolved.error,
        guardVersion: 1,
        ...(resolved.details || {}),
      }, resolved.status);
    }
    const audience = resolved.audience;
    const team = resolved.team;
    const liveRecipients = resolved.ok ? resolved.recipients : [];

    if (!testMode && (!liveRecipients || liveRecipients.length === 0)) {
       return c.json({ error: "No matching recipients found" }, 400);
    }

    const resend = new Resend(resendApiKey);
    
    // In test mode, only send to a dummy address or first subscriber
    const emailsToSend = testMode 
      ? ['elliott@woodbry.com'] // Replace with your actual email to test
      : liveRecipients.map((recipient) => recipient.email).filter(Boolean);

    console.log(`[AdminEmail] Sending to ${emailsToSend.length} recipients...`);

    // Resend batch sending (max 100 per batch)
    const BATCH_SIZE = 100;
    const results = [];
    
    for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
      const batch = emailsToSend.slice(i, i + BATCH_SIZE);
      const emailBatch = batch.map(email => ({
        from: fromEmail,
        to: [email],
        subject: subject,
        html: htmlContent,
      }));
      
      try {
        const { data, error } = await resend.batch.send(emailBatch);
        if (error) throw error;
        results.push(data);
      } catch (err: any) {
        console.error(`[AdminEmail] Batch ${i/BATCH_SIZE} failed:`, err);
        return c.json({ error: err.message || "Failed to send batch via Resend" }, 500);
      }
    }

    // Save the broadcast record to the KV database
    if (!testMode) {
      const broadcastKey = `broadcast:${Date.now()}`;
      await kv.set(broadcastKey, JSON.stringify({
        subject,
        htmlContent,
        sentAt: new Date().toISOString(),
        recipients: emailsToSend.length,
        source: 'manual',
        audience,
        team: team || "",
      }));
    }

    return c.json({ success: true, sentCount: emailsToSend.length, results, testMode, audience, team, matchedRecipientCount: liveRecipients.length });

  } catch (err: any) {
    console.error("[AdminEmail] Server error:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.post("/admin/premium-best-bet-alerts", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const testMode = body?.testMode !== false;
    const liveEnabled = Deno.env.get("PREMIUM_BEST_BET_ALERTS_LIVE_ENABLED") === "true";

    if (!testMode && (!liveEnabled || body?.confirm !== "SEND_PREMIUM_BEST_BET_ALERTS_LIVE")) {
      return c.json({
        error: "Live premium best-bet alerts are disabled. Use testMode:true for private testing.",
        liveEnabled,
      }, 403);
    }

    const result = await runPremiumBestBetAlerts({
      dryRun,
      testMode,
      force: body?.force === true,
      limit: Number(body?.limit) || undefined,
      testEmail: body?.testEmail || "elliott@woodbry.com",
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[admin/premium-best-bet-alerts] error:", err);
    return c.json({ error: "Internal server error", message: err?.message || "unknown" }, 500);
  }
});

// Admin endpoint to list subscribers
app.get("/admin/subscribers", async (c) => {
  try {
    const subs = await kv.getByPrefix('subscriber:');
    const parsed = subs.map(s => {
      try { 
        return typeof s === 'string' ? JSON.parse(s) : s; 
      } catch(e) { return null; }
    }).filter(Boolean);
    return c.json(parsed);
  } catch (err: any) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Admin endpoint to list free-access registrations (entered email on featured match gate)
app.get("/admin/free-access", async (c) => {
  try {
    const team = normalizeTeamFilter(c.req.query("team"));
    const entries = await kv.getByPrefix('free_access:');
    const parsed = entries.map(e => {
      try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) =>
      new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    );
    const filtered = team
      ? parsed.filter((entry: any) => String(entry?.favoriteTeam || "").trim().toLowerCase() === team.toLowerCase())
      : parsed;
    return c.json(filtered);
  } catch (err: any) {
    console.error('[admin/free-access] error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin endpoint to list checkout leads (emails captured before Stripe redirect)
app.get("/admin/checkout-leads", async (c) => {
  try {
    const entries = await kv.getByPrefix('checkout_lead:');
    const parsed = entries.map(e => {
      try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    return c.json(parsed);
  } catch (err: any) {
    console.error('[admin/checkout-leads] error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin endpoint to list email broadcasts
app.get("/admin/broadcasts", async (c) => {
  try {
    const broadcasts = await kv.getByPrefix('broadcast:');
    const parsed = broadcasts.map(b => {
      try { return typeof b === 'string' ? JSON.parse(b) : b; } catch(e) { return null; }
    }).filter(Boolean).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return c.json(parsed);
  } catch (err: any) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/admin/run-lead-nurture", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const limit = Math.max(1, Math.min(Number(body?.limit) || 250, 1000));
    const result = await runLeadNurture({ dryRun, limit });
    return c.json(result);
  } catch (err: any) {
    console.error("[admin/run-lead-nurture] error:", err);
    return c.json({ error: "Internal server error", message: err?.message }, 500);
  }
});

app.post("/admin/send-lead-nurture-tests", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    if (body?.confirm !== "SEND_NURTURE_TESTS_TO_ELLIOTT_ONLY") {
      return c.json({ error: "Confirmation phrase required." }, 400);
    }

    const email = String(body?.email || "elliott@woodbry.com").trim().toLowerCase();
    const result = await sendLeadNurtureTestEmails(email);
    return c.json(result);
  } catch (err: any) {
    console.error("[admin/send-lead-nurture-tests] error:", err);
    return c.json({ error: "Internal server error", message: err?.message }, 500);
  }
});

// Debug endpoint: test KV write and read
app.get("/test-kv", async (c) => {
  try {
    const testKey = "subscriber:test@debug.com";
    const testVal = { email: "test@debug.com", subscribedAt: new Date().toISOString(), source: "debug_test" };
    console.log("[TestKV] Writing test entry...");
    await kv.set(testKey, JSON.stringify(testVal));
    
    // Specifically save Round 2 Review into DB based on user request
    await kv.set(`broadcast:${Date.now()}`, JSON.stringify({
      subject: "RightEdge: Round 2 Ledger Review 📊",
      htmlContent: `<div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #111317; color: #fff;">
        <h1 style="color: #00E676; text-transform: uppercase;">ROUND 2 LEDGER REVIEW</h1>
        <p>The round is over. Here is the fully transparent breakdown of how the model performed against the closing line in Round 2.</p>
        <div style="background-color: rgba(255,255,255,0.05); padding: 15px; border-left: 4px solid #00E676; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #fff;">Round 2 Recap</h3>
          <p style="color: #ccc; font-size: 14px;">The model found significant closing line value in 5 of 8 matches, resulting in +3.2 units of profit.</p>
          <a href="https://rightedge.app" style="display: inline-block; background-color: #00E676; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; margin-top: 10px;">VIEW RESULTS</a>
        </div>
        <br/>
        <p style="color: #00E676; font-weight: bold;">- The RightEdge Team</p>
      </div>`,
      sentAt: new Date().toISOString(),
      recipients: 15,
      source: 'manual_round2_trigger'
    }));

    console.log("[TestKV] Reading back...");
    const readBack = await kv.get(testKey);
    console.log("[TestKV] Read result:", readBack);
    // Clean up
    await kv.del(testKey);
    return c.json({ success: true, message: "Round 2 review saved to database!" });
  } catch (err: any) {
    console.error("[TestKV] ERROR:", err?.message);
    return c.json({ error: err.message }, 500);
  }
});

// Health check endpoint
app.get("/health", async (c) => {  return c.json({ status: "ok" });
});

// Configure Cron Jobs for automated emails
if (typeof Deno.cron === "function") {
  Deno.cron("Daily Lead Nurture", "0 22 * * *", async () => {
    console.log("[CRON] Daily Lead Nurture is paused pending approval.");

    try {
      const result = await runLeadNurture({ dryRun: true, limit: 500 });
      console.log(`[CRON] Daily Lead Nurture dry run complete. Would send ${result.results.filter((item: any) => item.dryRun).length}/${result.processed} for Round ${result.round}.`);
    } catch (error) {
      console.error("[CRON] Daily Lead Nurture Error:", error);
    }
  });
}

if (typeof Deno.cron === "function") {
  Deno.cron("Thursday Lookahead Plays", "0 4 * * 4", async () => {
  console.log("[CRON] Thursday Lookahead Plays paused pending approval.");
  return;

  console.log("[CRON] Executing Thursday Lookahead Plays...");
  
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("[CRON] RESEND_API_KEY not configured. Cannot send automated emails.");
    return;
  }

  try {
    const subscribers = await kv.getByPrefix('subscriber:');
    if (!subscribers || subscribers.length === 0) {
       console.log("[CRON] No subscribers found. Skipping.");
       return;
    }

    const emailsToSend = subscribers.map(s => {
      try { return typeof s === 'string' ? JSON.parse(s).email : s.email; } catch(e) { return null; }
    }).filter(Boolean);

    console.log(`[CRON] Thursday Lookahead: Sending to ${emailsToSend.length} recipients...`);
    const resend = new Resend(resendApiKey);

    const subject = "RightEdge: Thursday Lookahead Plays 🎯";
    const htmlContent = rightEdgeEmailShell(
      subject,
      "Lookahead",
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Round lookahead</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">The next round card is ready.</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            Check the dashboard for live projected scores, true win probabilities and market edge percentages for every matchup this round.
          </div>
          ${emailCtaHtml("https://www.rightedge.com.au/#matches", "View Free Round Predictions ->")}
        </div>
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:16px;padding:22px 24px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Premium card</div>
          <div style="margin-top:10px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#9CA3AF;">Log in to see the filtered plays, try scorer signals and live market context.</div>
          ${emailCtaHtml("https://www.rightedge.com.au/#best-bets", "View Premium Plays ->", "secondary")}
        </div>`
    );

    // Resend batch sending (max 100 per batch)
    const BATCH_SIZE = 100;
    
    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!fromEmail || !fromEmail.includes("@")) {
      fromEmail = 'RightEdge <elliott@rightedge.com.au>';
    }
    
    for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
      const batch = emailsToSend.slice(i, i + BATCH_SIZE);
      const emailBatch = batch.map(email => ({
        from: fromEmail,
        to: [email],
        subject: subject,
        html: htmlContent,
      }));
      
      try {
        await resend.batch.send(emailBatch);
        console.log(`[CRON] Thursday Lookahead: Batch ${i/BATCH_SIZE} sent successfully.`);
      } catch (err) {
        console.error(`[CRON] Thursday Lookahead: Batch ${i/BATCH_SIZE} failed:`, err);
      }
    }

    // Save to database ledger
    await kv.set(`broadcast:${Date.now()}`, JSON.stringify({
      subject,
      htmlContent,
      sentAt: new Date().toISOString(),
      recipients: emailsToSend.length,
      source: 'cron:thursday'
    }));

  } catch (error) {
    console.error("[CRON] Thursday Lookahead Error:", error);
  }
});
}

if (typeof Deno.cron === "function") {
Deno.cron("Sunday Ledger Review", "0 8 * * 0", async () => {
  console.log("[CRON] Sunday Ledger Review paused pending approval.");
  return;

  console.log("[CRON] Executing Sunday Ledger Review...");
  
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("[CRON] RESEND_API_KEY not configured. Cannot send automated emails.");
    return;
  }

  try {
    const subscribers = await kv.getByPrefix('subscriber:');
    if (!subscribers || subscribers.length === 0) {
       console.log("[CRON] No subscribers found. Skipping.");
       return;
    }

    const emailsToSend = subscribers.map(s => {
      try { return typeof s === 'string' ? JSON.parse(s).email : s.email; } catch(e) { return null; }
    }).filter(Boolean);

    console.log(`[CRON] Sunday Ledger Review: Sending to ${emailsToSend.length} recipients...`);
    const resend = new Resend(resendApiKey);

    const subject = "RightEdge: Sunday Ledger Review 📊";
    const htmlContent = rightEdgeEmailShell(
      subject,
      "Ledger",
      `
        <div style="background:#111116;border:1px solid #1E1E2E;margin-top:24px;padding:28px 26px;">
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;color:#9CA3AF;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">Ledger review</div>
          <div style="margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;color:#ffffff;font-weight:600;letter-spacing:-0.02em;">The round is complete.</div>
          <div style="margin-top:18px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#9CA3AF;font-weight:400;">
            Review how the model performed against the closing line, with detailed historical ledger and ROI tracking.
          </div>
          ${emailCtaHtml("https://www.rightedge.com.au/#performance", "View Full Ledger ->")}
        </div>`
    );

    // Resend batch sending (max 100 per batch)
    const BATCH_SIZE = 100;
    
    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!fromEmail || !fromEmail.includes("@")) {
      fromEmail = 'RightEdge <elliott@rightedge.com.au>';
    }
    
    for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
      const batch = emailsToSend.slice(i, i + BATCH_SIZE);
      const emailBatch = batch.map(email => ({
        from: fromEmail,
        to: [email],
        subject: subject,
        html: htmlContent,
      }));
      
      try {
        await resend.batch.send(emailBatch);
        console.log(`[CRON] Sunday Ledger Review: Batch ${i/BATCH_SIZE} sent successfully.`);
      } catch (err) {
        console.error(`[CRON] Sunday Ledger Review: Batch ${i/BATCH_SIZE} failed:`, err);
      }
    }

    // Save to database ledger
    await kv.set(`broadcast:${Date.now()}`, JSON.stringify({
      subject,
      htmlContent,
      sentAt: new Date().toISOString(),
      recipients: emailsToSend.length,
      source: 'cron:sunday'
    }));

  } catch (error) {
    console.error("[CRON] Sunday Ledger Review Error:", error);
  }
});
}

// ---------------------------------------------------------------------------
// Premium Plays freeze-at-kickoff + results entry
// ---------------------------------------------------------------------------

// First-write-wins snapshot of a match's premium play + try scorer signals at
// kickoff so the card keeps its kickoff values after the odds feed stops.
// Public + idempotent: once a snapshot exists it is never overwritten.
app.post("/round-snapshot", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid body" }, 400);
    }
    const round = Number(body.round);
    const match = typeof body.match === "string" ? body.match : "";
    if (!Number.isFinite(round) || round <= 0) {
      return c.json({ error: "Invalid round" }, 400);
    }
    if (!match.trim() && !String(body.matchKey || "").trim()) {
      return c.json({ error: "Invalid match" }, 400);
    }
    if (body.payload == null || typeof body.payload !== "object") {
      return c.json({ error: "Invalid payload" }, 400);
    }

    const matchKey = String(body.matchKey || "").trim() || normalizeServerMatchKey(match);
    if (!matchKey) return c.json({ error: "Invalid matchKey" }, 400);

    const key = buildPlaySnapshotKey(round, matchKey);
    const existing = await kv.get(key);
    if (existing) {
      const parsed = parseKvValue(existing);
      return c.json({ ok: true, frozen: true, snapshot: parsed });
    }

    const snapshot = {
      round,
      match: match || matchKey,
      matchKey,
      payload: body.payload,
      frozenAt: new Date().toISOString(),
    };
    await kv.set(key, snapshot);
    return c.json({ ok: true, frozen: true, snapshot });
  } catch (error: any) {
    console.error("[round-snapshot] error:", error);
    return c.json({ error: "Internal server error", message: error?.message }, 500);
  }
});

// Public read of all frozen snapshots for a round (used after kickoff to render
// the locked-in play values).
app.get("/round-snapshots", async (c) => {
  try {
    const round = Number(c.req.query("round"));
    if (!Number.isFinite(round) || round <= 0) {
      return c.json({ error: "Invalid round" }, 400);
    }
    const rows = await kv.getByPrefix(`play_snapshot:${round}:`);
    const snapshots = (rows || [])
      .map((row: any) => parseKvValue(row))
      .filter(Boolean);
    return c.json({ round, snapshots });
  } catch (error: any) {
    console.error("[round-snapshots] error:", error);
    return c.json({ error: "Internal server error", message: error?.message }, 500);
  }
});

// Admin-only: save (upsert) the settled result for a match. Admin can re-mark.
app.post("/admin/round-results", async (c) => {
  try {
    const session = await requireAdmin(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid body" }, 400);
    }
    const round = Number(body.round);
    const match = typeof body.match === "string" ? body.match : "";
    if (!Number.isFinite(round) || round <= 0) {
      return c.json({ error: "Invalid round" }, 400);
    }
    const matchKey = String(body.matchKey || "").trim() || normalizeServerMatchKey(match);
    if (!matchKey) return c.json({ error: "Invalid match" }, 400);

    const playResult =
      body.playResult === "HIT" || body.playResult === "MISS" || body.playResult === "PUSH"
        ? body.playResult
        : null;

    const finalHome =
      body.finalHome == null || body.finalHome === "" ? null : Number(body.finalHome);
    const finalAway =
      body.finalAway == null || body.finalAway === "" ? null : Number(body.finalAway);

    const tryScorerHits: Record<string, boolean> = {};
    if (body.tryScorerHits && typeof body.tryScorerHits === "object") {
      for (const [k, v] of Object.entries(body.tryScorerHits)) {
        tryScorerHits[k] = Boolean(v);
      }
    }

    const result = {
      round,
      match: match || matchKey,
      matchKey,
      finalHome: Number.isFinite(finalHome as number) ? finalHome : null,
      finalAway: Number.isFinite(finalAway as number) ? finalAway : null,
      playResult,
      tryScorerHits,
      updatedAt: new Date().toISOString(),
      updatedBy: session.email,
    };
    await kv.set(buildRoundResultKey(round, matchKey), result);
    return c.json({ ok: true, result });
  } catch (error: any) {
    console.error("[admin/round-results] error:", error);
    return c.json({ error: "Internal server error", message: error?.message }, 500);
  }
});

// Public read of all saved results for a round (results are shown publicly once
// an admin has entered them).
app.get("/round-results", async (c) => {
  try {
    const round = Number(c.req.query("round"));
    if (!Number.isFinite(round) || round <= 0) {
      return c.json({ error: "Invalid round" }, 400);
    }
    const rows = await kv.getByPrefix(`round_result:${round}:`);
    const results = (rows || [])
      .map((row: any) => parseKvValue(row))
      .filter(Boolean);
    return c.json({ round, results });
  } catch (error: any) {
    console.error("[round-results] error:", error);
    return c.json({ error: "Internal server error", message: error?.message }, 500);
  }
});

Deno.serve(app.fetch);
