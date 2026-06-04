import posthog from "posthog-js";

const POSTHOG_PROJECT_TOKEN = "phc_sz2MWWnBEkdy8iW5zKEEgXTzhJLnNdRo2puiQjPBfmKy";

const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || POSTHOG_PROJECT_TOKEN;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

export function isPostHogEnabled() {
  return Boolean(posthogToken);
}

export function initPostHog() {
  if (!isPostHogEnabled()) return;

  posthog.init(posthogToken, {
    api_host: posthogHost,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    debug: import.meta.env.DEV,
  });
}

export function capturePostHogEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (!isPostHogEnabled()) return;
  posthog.capture(eventName, properties);
}

export function identifyPostHogUser(email: string, properties: Record<string, unknown> = {}) {
  if (!isPostHogEnabled() || !email) return;
  posthog.identify(email, {
    email,
    ...properties,
  });
}

export { posthog };
