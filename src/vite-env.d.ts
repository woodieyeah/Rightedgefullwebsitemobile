/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_PROJECT_TOKEN?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_LINKEDIN_PARTNER_ID?: string;
  readonly VITE_LINKEDIN_UNLOCK_CLICK_CONVERSION_ID?: string;
  readonly VITE_LINKEDIN_PAYWALL_OPEN_CONVERSION_ID?: string;
  readonly VITE_LINKEDIN_CHECKOUT_START_CONVERSION_ID?: string;
  readonly VITE_LINKEDIN_CHECKOUT_CONFIRMED_CONVERSION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
