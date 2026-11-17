/**
 * Native shell behaviour: lifecycle, external links, and what the native app
 * must NOT pretend about authentication.
 *
 * Every export is a no-op on the website. `Capacitor.isNativePlatform()` is
 * false in every browser, so each function returns early and the production
 * site behaves exactly as it does today. That is deliberate: this module ships
 * in the same bundle the website serves.
 */
import { Capacitor } from "@capacitor/core";

/** True only inside the Capacitor native shell, never in a browser. */
export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    // Capacitor is absent or failed to initialise: treat as web, which is the
    // status quo and cannot break the site.
    return false;
  }
}

/**
 * iOS suspends JavaScript timers when an app is backgrounded.
 *
 * A `setInterval` poll silently stops, so a user who reopens the app sees
 * whatever was on screen when they left -- stale scores and stale odds, with
 * no indication they are stale. Re-running the fetch on resume is the fix.
 *
 * Returns an unsubscribe function. On the web it returns a no-op immediately
 * and never registers a listener.
 */
export function onNativeResume(refresh: () => void): () => void {
  if (!isNativeShell()) return () => {};

  let cancelled = false;
  let remove: (() => void) | null = null;

  // Imported lazily so the web bundle never evaluates the plugin.
  import("@capacitor/app")
    .then(({ App }) => {
      if (cancelled) return;
      const handle = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) refresh();
      });
      // The handle is a promise in Capacitor 8.
      Promise.resolve(handle)
        .then((h) => {
          if (cancelled) {
            h.remove();
            return;
          }
          remove = () => h.remove();
        })
        .catch(() => {});
    })
    .catch(() => {
      // A missing plugin must not break the app; polling simply stays as-is.
    });

  return () => {
    cancelled = true;
    if (remove) remove();
  };
}

/**
 * Open a URL outside the webview.
 *
 * `target="_blank"` has nowhere to go inside a Capacitor WKWebView: the tap
 * either does nothing or replaces the app's own page with no way back. The
 * system browser also carries the user's existing cookies, which is what makes
 * website Premium login work while the native app itself stays signed out.
 *
 * On the web this returns false and the caller's normal link behaviour runs.
 */
export async function openExternal(url: string): Promise<boolean> {
  if (!isNativeShell()) return false;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
    return true;
  } catch {
    return false;
  }
}

/**
 * The absolute website URL for a path, for use with openExternal.
 *
 * Inside the shell `window.location.origin` is `capacitor://localhost`, which
 * is meaningless to the outside world, so the public origin is explicit.
 */
export const WEBSITE_ORIGIN = "https://rightedge.com.au";

export function websiteUrl(path = "/"): string {
  return `${WEBSITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The website route that opens Premium.
 *
 * Verified against the app's own routing: checkHash() treats `best-bets` as a
 * premium hash and opens the paywall for it. There is NO `?premium=1` handler
 * -- a query parameter would be silently ignored and the user would land on
 * the plain home page. Note that any path returns HTTP 200 because index.html
 * is served for everything, so a status code cannot validate a route here;
 * only the client-side hash handling can.
 */
export const PREMIUM_WEBSITE_PATH = "/#best-bets";

/**
 * Why Premium login leaves the app.
 *
 * The backend reads its session from an HttpOnly, SameSite=Lax cookie and
 * replies with `Access-Control-Allow-Origin: *` and no allow-credentials, so a
 * WKWebView on `capacitor://localhost` cannot hold or send that cookie. Signing
 * in on the website therefore does NOT authenticate this app, and the UI must
 * say so rather than appear to log the user in and then fail.
 */
export const NATIVE_PREMIUM_NOTICE =
  "Premium opens in your browser. Signing in there does not sign in this app yet — native sign-in is coming.";

/**
 * Service workers must not be registered in the native shell.
 *
 * A service worker would intercept requests for the app's own bundled assets,
 * which are served from the binary rather than the network, and can leave a
 * blank screen after an update. This repository registers none today; the
 * guard exists so adding one later cannot silently break iOS.
 */
export function shouldRegisterServiceWorker(): boolean {
  return !isNativeShell();
}
