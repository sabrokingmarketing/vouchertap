import { isIOSDevice, isStandalone } from "@/lib/push";

/**
 * Add-to-home-screen support.
 *
 * Two completely different worlds:
 *  - Chromium (Android, desktop) fires `beforeinstallprompt`, which we catch in
 *    an inline script in __root.tsx before hydration and stash on `window`.
 *    That stashed event is the only way to open the native install sheet, and
 *    it is single-use.
 *  - iOS has no API at all. Safari can only add to the home screen through its
 *    own Share sheet, so all we can do there is show the steps — and iOS Chrome
 *    or Firefox can't do it at all, so those users need sending to Safari.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __slkInstall?: { event: BeforeInstallPromptEvent | null };
  }
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Fires when the stashed prompt arrives after the page has already rendered. */
export const INSTALL_AVAILABLE_EVENT = "slk:install-available";
/** Fires once the browser confirms the app was installed. */
export const INSTALLED_EVENT = "slk:installed";

const SEEN_KEY = "slk.install_seen_v1";

/** True when the browser has given us a prompt we can still open. */
export function canPromptInstall(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.__slkInstall?.event;
}

/**
 * Opens the native install sheet. The event is spent either way, so it is
 * cleared afterwards — a second call would throw.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const stash = typeof window === "undefined" ? undefined : window.__slkInstall;
  const event = stash?.event;
  if (!event || !stash) return "unavailable";
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  } finally {
    stash.event = null;
  }
}

/** iOS Chrome/Firefox can't add to the home screen — only Safari can. */
export function iosNeedsSafari(): boolean {
  if (typeof navigator === "undefined" || !isIOSDevice()) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
}

/**
 * Samsung Internet builds its own APK for installed web apps, which Google
 * Play Protect blocks on current Android ("built for an older version of
 * Android"). Members on it are sent to Chrome to install instead — see the
 * manifest guard in __root.tsx.
 */
export function isSamsungInternet(): boolean {
  if (typeof navigator === "undefined") return false;
  return /SamsungBrowser/i.test(navigator.userAgent);
}

/**
 * An Android intent link that opens the current page in Chrome. If Chrome
 * isn't installed, Android falls back to its Play Store page.
 */
export function openInChromeUrl(): string {
  const { host, pathname, search } = window.location;
  const fallback = encodeURIComponent(
    "https://play.google.com/store/apps/details?id=com.android.chrome",
  );
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/**
 * Whether the entry flow has already offered the install page on this device.
 * Visiting /install directly always shows it — this only gates the automatic
 * hand-off, so members aren't nagged on every cold start.
 */
export function hasSeenInstallPage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private mode with storage blocked: treat as seen so nobody gets stuck in
    // a loop between the entry route and the install page.
    return true;
  }
}

export function markInstallPageSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Where the entry route should send someone: the offer, or straight on. */
export function shouldOfferInstall(): boolean {
  return !isStandalone() && !hasSeenInstallPage();
}

export { isIOSDevice, isStandalone };
