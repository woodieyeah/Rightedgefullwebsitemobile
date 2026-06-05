declare global {
  interface Window {
    _linkedin_data_partner_ids?: string[];
    lintrk?: (command: "track", payload?: { conversion_id?: number }) => void;
  }
}

const LINKEDIN_PARTNER_ID = "9485236";

const linkedInPartnerId = import.meta.env.VITE_LINKEDIN_PARTNER_ID || LINKEDIN_PARTNER_ID;

const conversionIds: Record<string, number | undefined> = {
  unlock_click: parseConversionId(import.meta.env.VITE_LINKEDIN_UNLOCK_CLICK_CONVERSION_ID),
  premium_paywall_open: parseConversionId(import.meta.env.VITE_LINKEDIN_PAYWALL_OPEN_CONVERSION_ID),
  premium_checkout_start: parseConversionId(import.meta.env.VITE_LINKEDIN_CHECKOUT_START_CONVERSION_ID),
  premium_checkout_confirmed: parseConversionId(import.meta.env.VITE_LINKEDIN_CHECKOUT_CONFIRMED_CONVERSION_ID),
};

function parseConversionId(value?: string) {
  if (!value) return undefined;
  const conversionId = Number(value);
  return Number.isFinite(conversionId) ? conversionId : undefined;
}

export function isLinkedInInsightEnabled() {
  return Boolean(linkedInPartnerId);
}

export function initLinkedInInsight() {
  if (!isLinkedInInsightEnabled()) return;

  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  if (!window._linkedin_data_partner_ids.includes(linkedInPartnerId)) {
    window._linkedin_data_partner_ids.push(linkedInPartnerId);
  }

  if (document.querySelector('script[data-rightedge-linkedin-insight="true"]')) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  script.dataset.rightedgeLinkedinInsight = "true";
  document.head.appendChild(script);
}

export function trackLinkedInConversion(eventName: string) {
  if (!isLinkedInInsightEnabled()) return;

  const conversionId = conversionIds[eventName];
  if (!conversionId || typeof window.lintrk !== "function") return;

  window.lintrk("track", { conversion_id: conversionId });
}
