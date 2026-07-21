/**
 * Cross-application theme cookie helper (shared contract across all Idem apps).
 *
 * Single source of truth for the UI theme: the `idem_theme` cookie. Same domain
 * logic as the `idem_lang` cookie (localeCookie.ts): `domain=.idem.africa` in
 * production, host-only on localhost.
 *
 * Values: "light" | "dark" | "system". Absent cookie => "system" => the browser's
 * prefers-color-scheme decides.
 */
export const THEME_COOKIE_NAME = "idem_theme";

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const ONE_YEAR_SECONDS = 31536000;

export function isThemeMode(
  value: string | null | undefined
): value is ThemeMode {
  return !!value && (THEME_MODES as readonly string[]).includes(value);
}

/** Read the shared theme cookie. Returns null when absent/invalid. */
export function readThemeCookie(): ThemeMode | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)idem_theme=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return isThemeMode(value) ? value : null;
}

/** Write the shared theme cookie with the correct domain scope for the current host. */
export function writeThemeCookie(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  const host = typeof location !== "undefined" ? location.hostname : "";
  const onIdem = host.endsWith("idem.africa");
  const scope = onIdem ? "; domain=.idem.africa; Secure" : "";
  document.cookie = `${THEME_COOKIE_NAME}=${mode}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${scope}`;
}

/** Resolve a mode to concrete dark/light ("system" -> prefers-color-scheme). */
export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") {
    return true;
  }
  if (mode === "light") {
    return false;
  }
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
