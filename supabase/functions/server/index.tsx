import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { Resend } from "npm:resend";
import Stripe from "npm:stripe";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
const app = new Hono().basePath('/make-server-3b84b96c');

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



function getFromEmail() {
  const envFrom = Deno.env.get("RESEND_FROM_EMAIL");
  if (envFrom && envFrom.includes("@")) return envFrom;
  return "RightEdge Support <elliott@rightedge.com.au>";
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

function freeWelcomeHtml() {
  return `
  <div style="margin:0;padding:0;background:#05070b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Most punters bet teams. Sharp punters bet price.
    </div>
    <div style="background:#05070b;padding:28px 14px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:680px;margin:0 auto;">
        <div style="background:#0a0d14;border:2px solid #f5f7fb;box-shadow:6px 6px 0 #0a4dff;padding:22px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="left">
                <div style="font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:30px;line-height:1;color:#ffffff;font-weight:900;letter-spacing:-1px;text-transform:uppercase;">RIGHTEDGE</div>
                <div style="margin-top:8px;font-size:12px;line-height:1.2;color:#00f0a8;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">NRL Analytics and Value Insights</div>
              </td>
              <td align="right" style="vertical-align:top;">
                <span style="display:inline-block;background:#ffe600;color:#05070b;font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:10px 14px;border:2px solid #ffe600;">Free Access Live</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="margin-top:24px;background:linear-gradient(90deg, rgba(255,51,133,0.16) 0%, rgba(5,7,11,0) 72%), #0a0d14;border-left:4px solid #ff2f7d;padding:30px 28px;">
          <div style="display:inline-block;background:#ff2f7d;color:#ffffff;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:8px 10px;">Value Betting Intelligence</div>
          <div style="margin-top:18px;font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:42px;line-height:0.98;color:#ffffff;font-weight:900;letter-spacing:-1.5px;text-transform:uppercase;">Most punters bet teams.<br/>Sharp punters bet price.</div>
          <div style="margin-top:18px;max-width:560px;font-size:18px;line-height:1.65;color:#c9cfdb;">
            Welcome to RightEdge. You already have the free model view for the round — but the real edge comes from knowing when the market price is wrong, not just who the model thinks wins.
          </div>
          <div style="margin-top:16px;max-width:560px;font-size:17px;line-height:1.7;color:#c9cfdb;">
            Premium turns the model into action: Best Bets, Try Scorer value, live bookmaker odds, edge % and suggested stakes — the exact layer built to help you stop guessing and start betting numbers properly.
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
            <tr>
              <td style="padding:0 0 12px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#ffe600;border:2px solid #ffe600;box-shadow:4px 4px 0 #0a4dff;">
                      <a href="https://www.rightedge.com.au/#best-bets" style="display:inline-block;padding:16px 22px;color:#05070b;text-decoration:none;font-size:16px;font-weight:900;letter-spacing:0.3px;text-transform:uppercase;">Unlock Premium →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <div style="font-size:14px;line-height:1.7;color:#9aa7bd;">
          <span style="color:#ffffff;font-weight:800;">$9/Week</span> — Limited Offer.
          </div>
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
          <tr>
            <td width="33.33%" style="padding-right:10px;padding-bottom:10px;vertical-align:top;">
              <div style="background:#0a0d14;border-top:4px solid #0a4dff;padding:22px 18px;height:100%;">
                <div style="font-size:13px;color:#0a4dff;font-weight:900;text-transform:uppercase;letter-spacing:0.7px;">01</div>
                <div style="margin-top:10px;font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:19px;line-height:1.1;color:#ffffff;text-transform:uppercase;">Model Probability</div>
                <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#c9cfdb;">Each matchup is assigned a model-based probability and converted into fair odds.</div>
              </div>
            </td>
            <td width="33.33%" style="padding:0 5px 10px 5px;vertical-align:top;">
              <div style="background:#0a0d14;border-top:4px solid #ffe600;padding:22px 18px;height:100%;">
                <div style="font-size:13px;color:#ffe600;font-weight:900;text-transform:uppercase;letter-spacing:0.7px;">02</div>
                <div style="margin-top:10px;font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:19px;line-height:1.1;color:#ffffff;text-transform:uppercase;">Market Comparison</div>
                <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#c9cfdb;">Market prices are pulled alongside model odds so edges can be evaluated in real time.</div>
              </div>
            </td>
            <td width="33.33%" style="padding-left:10px;padding-bottom:10px;vertical-align:top;">
              <div style="background:#0a0d14;border-top:4px solid #ff2f7d;padding:22px 18px;height:100%;">
                <div style="font-size:13px;color:#ff2f7d;font-weight:900;text-transform:uppercase;letter-spacing:0.7px;">03</div>
                <div style="margin-top:10px;font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:19px;line-height:1.1;color:#ffffff;text-transform:uppercase;">Value Detection</div>
                <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#c9cfdb;">Premium shows you what to bet so you get the edge on the bookies.</div>
              </div>
            </td>
          </tr>
        </table>


        <div style="margin-top:24px;text-align:center;font-size:12px;color:#6f7f99;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Backed by data, not guesswork.</div>
      </div>
    </div>`;
}


function premiumWelcomeHtml() {
  return `
  <div style="margin:0;padding:0;background:#05070b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Premium is live — best bets, try scorer value and live odds are now unlocked.
    </div>
    <div style="background:#05070b;padding:32px 16px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:680px;margin:0 auto;">
        <div style="background:#0a0d14;border:2px solid #f5f7fb;box-shadow:6px 6px 0 #0a4dff;padding:22px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="left">
                <div style="font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:30px;line-height:1;color:#ffffff;font-weight:900;letter-spacing:-1px;text-transform:uppercase;">RIGHTEDGE</div>
                <div style="margin-top:8px;font-size:12px;line-height:1.2;color:#00f0a8;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">NRL Analytics and Value Insights</div>
              </td>
              <td align="right" style="vertical-align:top;">
                <span style="display:inline-block;background:#ffe600;color:#05070b;font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:10px 14px;border:2px solid #ffe600;">Premium</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="margin-top:26px;background:linear-gradient(90deg, rgba(10,77,255,0.18) 0%, rgba(5,7,11,0) 74%), #0a0d14;border-left:4px solid #0a4dff;padding:28px 28px 30px 28px;">
          <div style="display:inline-block;background:#16d977;color:#05100a;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:8px 10px;">Premium Active</div>
          <div style="margin-top:18px;font-family:Arial Black,Impact,Helvetica,sans-serif;font-size:44px;line-height:0.98;color:#ffffff;font-weight:900;letter-spacing:-1.5px;text-transform:uppercase;">Premium is live.</div>
          <div style="margin-top:18px;max-width:560px;font-size:18px;line-height:1.6;color:#c9cfdb;">
            You now have access to the full RightEdge action layer — the actual bets, live market pricing and the edge the model has identified.
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
            <tr>
              <td width="25%" style="padding-right:8px;padding-bottom:10px;">
                <div style="background:#0f1714;border-top:4px solid #16d977;padding:18px 14px;">
                  <div style="font-size:11px;color:#16d977;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Best Bets</div>
                </div>
              </td>
              <td width="25%" style="padding:0 6px 10px 6px;">
                <div style="background:#0a0d14;border-top:4px solid #ff2f7d;padding:18px 14px;">
                  <div style="font-size:11px;color:#ff2f7d;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Try Scorers</div>
                </div>
              </td>
              <td width="25%" style="padding:0 6px 10px 6px;">
                <div style="background:#0a0d14;border-top:4px solid #ffe600;padding:18px 14px;">
                  <div style="font-size:11px;color:#ffe600;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Live Odds</div>
                </div>
              </td>
              <td width="25%" style="padding-left:8px;padding-bottom:10px;">
                <div style="background:#0a0d14;border-top:4px solid #0a4dff;padding:18px 14px;">
                  <div style="font-size:11px;color:#0a4dff;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Edge %</div>
                </div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
            <tr>
              <td style="padding:0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#0a4dff;border:2px solid #0a4dff;box-shadow:4px 4px 0 #ff2f7d;">
                      <a href="https://www.rightedge.com.au/#best-bets" style="display:inline-block;padding:16px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:900;letter-spacing:0.3px;text-transform:uppercase;">View Best Bets →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <div style="margin-top:18px;background:#11151f;padding:18px 22px;border-left:4px solid #ffe600;">
          <div style="font-size:12px;color:#ffe600;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;">How premium works</div>
          <div style="margin-top:8px;font-size:15px;line-height:1.7;color:#d4dae5;">Use the Premium Login button anytime. Enter your subscriber email and RightEdge will take you straight to the full premium card — no code needed.</div>
        </div>

        <div style="margin-top:24px;text-align:center;font-size:12px;color:#6f7f99;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Backed by data, not guesswork.</div>
      </div>
    </div>`;
}

async function sendWelcomeEmail(type: "free" | "premium", email: string) {
  const resend = getResendClient();
  const from = getFromEmail();

  const subject =
    type === "free"
      ? "Welcome to RightEdge — here’s what sharp punters do differently"
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


// Register a free featured-match email (no payment, just collects the address)
app.post("/register-free-access", async (c) => {
  try {
    const body = await c.req.json();
    const email = (body.email || '').trim().toLowerCase();
    const source = body.source || 'featured_match_free';

    if (!email || !email.includes('@')) {
      return c.json({ error: 'Invalid email' }, 400);
    }

    const key = `free_access:${email}`;
    const existing = await kv.get(key);
    const isNewFreeRegistration = !existing;

    if (!existing) {
      await kv.set(key, JSON.stringify({
        email,
        source,
        registeredAt: new Date().toISOString(),
      }));
      console.log(`[register-free-access] New free registration: ${email} via ${source}`);
    }

    await syncResendLifecycle(email, "free");

    if (isNewFreeRegistration) {
      try {
        await sendWelcomeEmail("free", email);
      } catch (emailErr) {
        console.error("[register-free-access] Welcome email failed:", emailErr);
      }
    }

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
  if (t.includes("bronco") || t.includes("brisbane")) return "Brisbane Broncos";
  if (t.includes("rooster") || t.includes("sydney")) return "Sydney Roosters";
  if (t.includes("storm") || t.includes("melbourne")) return "Melbourne Storm";
  if (t.includes("panther") || t.includes("penrith")) return "Penrith Panthers";
  if (t.includes("rabbitoh") || t.includes("south")) return "South Sydney Rabbitohs";
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

function buildOddsMatchKey(home: string, away: string) {
  return `${normalizeNrlTeamName(home)} v ${normalizeNrlTeamName(away)}`.toLowerCase();
}

async function fetchLiveOddsRaw(force = false) {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY environment variable. Add your The Odds API key.");
  }

  const cachedOdds = await kv.get("live_odds_cache");
  const cacheTime = await kv.get("live_odds_cache_time");
  const now = Date.now();

  if (!force && cachedOdds && cacheTime && (now - Number(cacheTime)) < 120000) {
    return typeof cachedOdds === "string" ? JSON.parse(cachedOdds) : cachedOdds;
  }

  const response = await fetch(`https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/odds/?apiKey=${apiKey}&regions=au&markets=h2h&oddsFormat=decimal`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch from The Odds API: ${text}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    await kv.set("live_odds_cache", JSON.stringify(data));
    await kv.set("live_odds_cache_time", now.toString());
  }

  return data;
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

app.get("/live-odds", async (c) => {
  try {
    const force = c.req.query("force") === "true";
    const data = await fetchLiveOddsRaw(force);
    return c.json(data);
  } catch (err: any) {
    console.error("Server error fetching live odds:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
  }
});

app.get("/best-match-odds", async (c) => {
  try {
    const force = c.req.query("force") === "true";
    const format = c.req.query("format") || "json";
    const cached = await kv.get("best_match_odds_cache");
    const cacheTime = await kv.get("best_match_odds_cache_time");
    const now = Date.now();

    let payload =
      !force && cached && cacheTime && (now - Number(cacheTime)) < 120000
        ? (typeof cached === "string" ? JSON.parse(cached) : cached)
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
    });
    await syncResendLifecycle(email, "premium");

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

async function createInstantAccessUrl(email: string, returnUrl: string, returnHash: string, customerId: string, subscriptionId: string) {
  const token = crypto.randomUUID();
  await kv.set(`instant_access:${token}`, JSON.stringify({
    email,
    returnHash,
    customerId,
    subscriptionId,
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

app.post("/create-checkout-session", async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim()?.toLowerCase();
    const returnUrl = body?.returnUrl || "http://localhost:5173";
    const returnHash = ["best-bets", "try-scorers"].includes(body?.returnHash)
      ? body.returnHash
      : "best-bets";
    const cancelUrl = body?.cancelUrl || `${returnUrl}#${returnHash}`;

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
      const url = await createInstantAccessUrl(email, returnUrl, returnHash, customerId, activeSubscription.id);
      console.log(`[Stripe] Existing subscriber ${email} given instant premium access for #${returnHash}`);
      return c.json({
        url,
        instantAccess: true,
        subscriptionId: activeSubscription.id,
      });
    }

    await kv.set(`checkout_lead:${email}`, JSON.stringify({
      email,
      returnHash,
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
        source: body?.source || `premium_${returnHash}`,
      },
      subscription_data: {
        metadata: {
          email,
          returnHash,
          source: body?.source || `premium_${returnHash}`,
        },
      },
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'RightEdge Premium — Full Round Card',
            description: `Best Bets, Try Scorer value plays, staking guidance and model edges`,
          },
          unit_amount: 900, // $9.00 AUD
          recurring: { interval: 'week' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}&return_hash=${encodeURIComponent(returnHash)}#${returnHash}`,
      cancel_url: `${returnUrl}?canceled=true&return_hash=${encodeURIComponent(returnHash)}#${returnHash}`,
    });

    console.log(`[Stripe] Created checkout session for ${email} returning to #${returnHash}`);
    return c.json({ url: session.url, sessionId: session.id });
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

  const payload = {
    email: normalizedEmail,
    subscribedAt: existingSubscriber
      ? (() => { try { return JSON.parse(String(existingSubscriber)).subscribedAt; } catch { return new Date().toISOString(); } })()
      : new Date().toISOString(),
    source,
    stripeCustomerId: stripeData.customerId || '',
    stripeSubscriptionId: stripeData.subscriptionId || '',
    stripeCheckoutSessionId: stripeData.checkoutSessionId || '',
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

      const returnHash = ["best-bets", "try-scorers"].includes(data.returnHash)
        ? data.returnHash
        : "best-bets";

      await saveVerifiedSubscriber(email, "stripe_existing_subscriber_instant_access", {
        customerId: data.customerId || "",
        subscriptionId: data.subscriptionId || "",
      });
      await syncResendLifecycle(email, "premium");
      await kv.del(`instant_access:${token}`);

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

    const returnHash = ["best-bets", "try-scorers"].includes(session.metadata?.returnHash || "")
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
    });

    await syncResendLifecycle(email, "premium");

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
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        activeSubscription = subscriptions.data[0];
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
      fromEmail = 'RightEdge Support <elliott@rightedge.com.au>';
    }
    if (!resendApiKey) {
      return c.json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    // Get all subscribers
    const subscribers = await kv.getByPrefix('subscriber:') || [];
    if (!testMode && (!subscribers || subscribers.length === 0)) {
       return c.json({ error: "No subscribers found" }, 400);
    }

    const resend = new Resend(resendApiKey);
    
    // In test mode, only send to a dummy address or first subscriber
    const emailsToSend = testMode 
      ? ['elliott@woodbry.com'] // Replace with your actual email to test
      : subscribers.map(s => {
          try { 
            return typeof s === 'string' ? JSON.parse(s).email : s.email; 
          } catch(e) { return null; }
        }).filter(Boolean);

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
        source: 'manual'
      }));
    }

    return c.json({ success: true, sentCount: emailsToSend.length, results, testMode });

  } catch (err: any) {
    console.error("[AdminEmail] Server error:", err);
    return c.json({ error: "Internal server error", message: err.message }, 500);
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
    const entries = await kv.getByPrefix('free_access:');
    const parsed = entries.map(e => {
      try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) =>
      new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    );
    return c.json(parsed);
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
  Deno.cron("Thursday Lookahead Plays", "0 4 * * 4", async () => {
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
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #111317; border: 1px solid #1A1D24;">
          
          <div style="text-align: center; padding: 30px; border-bottom: 1px solid #1A1D24;">
            <h1 style="font-size: 28px; font-family: 'Arial Black', Impact, sans-serif; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase; color: #fff;">RIGHTEDGE</h1>
            <div style="color: #00E676; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 5px; text-transform: uppercase; font-family: monospace;">NRL Analytics & Value Betting</div>
          </div>
          
          <div style="padding: 30px; padding-bottom: 10px;">
            <h2 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; color: #fff;">Round Lookahead 🎯</h2>
            <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
              The model has crunched the numbers for this weekend's matchups. We've identified new <strong style="color: #fff;">official plays</strong> across the slate based on strict mathematical edge.
            </p>
          </div>

          <!-- PREDICTIONS PREVIEW LINK -->
          <div style="padding: 20px 30px;">
            <h3 style="color: #fff; font-family: 'Arial Black', sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #1A1D24; padding-bottom: 10px;">Predictions Preview</h3>
            
            <p style="color: #E2E8F0; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">Check the dashboard for live projected scores, true win probabilities, and market edge percentages for every matchup this round.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://www.rightedge.com.au/#matches" style="display: block; background-color: #111317; border: 2px solid #0047FF; color: #fff; padding: 14px 24px; text-decoration: none; font-weight: 900; font-size: 13px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">VIEW ALL PROJECTIONS ➔</a>
                </td>
              </tr>
            </table>
          </div>

          <!-- BEST BETS LINK -->
          <div style="background-color: #1A1D24; padding: 30px; border-left: 4px solid #FF2E63; margin: 20px 30px 40px 30px;">
            <div style="color: #FF2E63; font-size: 11px; font-family: 'Arial Black', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">🔥 MAX-CONFIDENCE PLAYS</div>
            <p style="color: #E2E8F0; font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">The model has locked in official plays for this round based on significant closing line value. Log in to see the exact edge, stakes, and targets.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://www.rightedge.com.au/#best-bets" style="display: block; background-color: #00E676; color: #000; padding: 16px 24px; text-decoration: none; font-weight: 900; font-size: 14px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">UNLOCK BEST BETS ➔</a>
                </td>
              </tr>
            </table>
          </div>

          <!-- FOOTER -->
          <div style="padding: 30px; text-align: center; border-top: 1px solid #1A1D24;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748B; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Backed by Data, Not Guesswork.</p>
</div>

        </div>
      </div>
    `;

    // Resend batch sending (max 100 per batch)
    const BATCH_SIZE = 100;
    
    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!fromEmail || !fromEmail.includes("@")) {
      fromEmail = 'RightEdge Support <elliott@rightedge.com.au>';
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
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0B0E14; padding: 40px 20px; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #111317; border: 1px solid #1A1D24;">
          
          <div style="text-align: center; padding: 30px; border-bottom: 1px solid #1A1D24;">
            <h1 style="font-size: 28px; font-family: 'Arial Black', Impact, sans-serif; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase; color: #fff;">RIGHTEDGE</h1>
            <div style="color: #00E676; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 5px; text-transform: uppercase; font-family: monospace;">NRL Analytics & Value Betting</div>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 22px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; color: #fff;">Ledger Review 📊</h2>
            <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
              The round is over. Here is the fully transparent breakdown of how the model performed against the closing line.
            </p>
          </div>

          <div style="background-color: #1A1D24; padding: 30px; border-left: 4px solid #00E676;">
            <h3 style="margin-top: 0; color: #fff; font-family: 'Arial Black', sans-serif; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Performance Recap</h3>
            <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">Check the Performance tab on the dashboard for detailed historical ledgers and ROI tracking.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://www.rightedge.com.au/#performance" style="display: block; background-color: #00E676; color: #000; padding: 16px 24px; text-decoration: none; font-weight: 900; font-size: 14px; font-family: 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 1px;">VIEW FULL LEDGER ➔</a>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding: 30px; text-align: center; border-top: 1px solid #1A1D24;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748B; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Backed by Data, Not Guesswork.</p>
</div>

        </div>
      </div>
    `;

    // Resend batch sending (max 100 per batch)
    const BATCH_SIZE = 100;
    
    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!fromEmail || !fromEmail.includes("@")) {
      fromEmail = 'RightEdge Support <elliott@rightedge.com.au>';
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

Deno.serve(app.fetch);
