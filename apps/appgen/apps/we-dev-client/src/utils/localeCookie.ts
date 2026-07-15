/**
 * Cross-application locale cookie helper (shared contract across all Idem apps).
 *
 * Single source of truth for the UI language: the `idem_lang` cookie. In production
 * every app lives under `*.idem.africa`, so the cookie is written with
 * `domain=.idem.africa` (shared across sub-domains). In dev everything runs on
 * `localhost` (different ports), where cookies are not isolated by port — a host-only
 * cookie is therefore already shared across the dev apps.
 *
 * Keep this contract identical to the other Idem apps; any divergence breaks sync.
 */
export const LOCALE_COOKIE_NAME = "idem_lang";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const ONE_YEAR_SECONDS = 31536000;

export function isSupportedLocale(
  value: string | null | undefined
): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Read the shared locale cookie. Returns null when absent/unsupported. */
export function readLocaleCookie(): SupportedLocale | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)idem_lang=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return isSupportedLocale(value) ? value : null;
}

/** Write the shared locale cookie with the correct domain scope for the current host. */
export function writeLocaleCookie(lang: SupportedLocale): void {
  if (typeof document === "undefined") {
    return;
  }
  const host = typeof location !== "undefined" ? location.hostname : "";
  const onIdem = host.endsWith("idem.africa");
  const scope = onIdem ? "; domain=.idem.africa; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${lang}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${scope}`;
}

/**
 * Resolve the initial UI language: shared cookie > browser language > 'en'.
 */
export function resolveInitialLocale(): SupportedLocale {
  const fromCookie = readLocaleCookie();
  if (fromCookie) {
    return fromCookie;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
  }
  return "en";
}
