import { LogoModel } from '../models/logo.model';

/**
 * Helpers to reference a logo inside AI generation contexts by URL rather than
 * by inline SVG markup.
 *
 * The SVG stays the vector source of truth in `logo.svg` / `logo.iconSvg` /
 * `logo.variations`, but dumping that markup into a prompt is expensive (an SVG
 * easily runs thousands of tokens, ×N variations, ×N steps). These helpers emit
 * the hosted PNG URLs (`logo.assetUrls`) instead — and deliberately DROP any
 * value that is still inline SVG, so raw markup never leaks into a prompt.
 */

type LogoLike = Pick<LogoModel, 'svg' | 'iconSvg' | 'name' | 'concept' | 'colors' | 'fonts'> &
  Partial<Pick<LogoModel, 'variations' | 'assetUrls'>>;

/**
 * Returns a usable URL for prompts: the hosted asset URL when present, else the
 * legacy field if it already holds a URL/data-URI. Inline SVG markup yields
 * `undefined` (callers must not embed it in a prompt).
 */
function pickLogoUrl(hosted?: string, legacy?: string): string | undefined {
  const h = (hosted || '').trim();
  if (h) return h;
  const l = (legacy || '').trim();
  if (l.startsWith('http://') || l.startsWith('https://') || l.startsWith('data:')) return l;
  return undefined;
}

/**
 * Best single logo URL for a prompt (primary/full logo). Returns '' when no
 * hosted URL is available (a fresh project whose PNG upload hasn't run yet).
 */
export function resolveLogoUrl(logo?: LogoLike | null): string {
  if (!logo) return '';
  return pickLogoUrl(logo.assetUrls?.primary, logo.svg) || '';
}

/** Compact, prompt-safe view of a logo: metadata + hosted URLs, never raw SVG. */
export interface LogoPromptSummary {
  name?: string;
  concept?: string;
  colors?: string[];
  fonts?: string[];
  urls: {
    primary?: string;
    icon?: string;
    withText?: { lightBackground?: string; darkBackground?: string; monochrome?: string };
    iconOnly?: { lightBackground?: string; darkBackground?: string; monochrome?: string };
  };
}

/** Drops keys whose value is undefined; returns undefined if the set is empty. */
function compact<T extends Record<string, string | undefined>>(obj: T): Partial<T> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? (out as Partial<T>) : undefined;
}

/**
 * Builds a token-lean logo summary for injection into prompts: brand metadata
 * plus the hosted PNG URLs for the primary logo, the icon, and each variation.
 * Raw SVG is intentionally excluded.
 */
export function summarizeLogoForPrompt(logo?: LogoLike | null): LogoPromptSummary | null {
  if (!logo) return null;

  const a = logo.assetUrls;
  const v = logo.variations;

  return {
    name: logo.name,
    concept: logo.concept,
    colors: logo.colors,
    fonts: logo.fonts,
    urls: {
      primary: pickLogoUrl(a?.primary, logo.svg),
      icon: pickLogoUrl(a?.icon, logo.iconSvg),
      withText: compact({
        lightBackground: pickLogoUrl(a?.withText?.lightBackground, v?.withText?.lightBackground),
        darkBackground: pickLogoUrl(a?.withText?.darkBackground, v?.withText?.darkBackground),
        monochrome: pickLogoUrl(a?.withText?.monochrome, v?.withText?.monochrome),
      }),
      iconOnly: compact({
        lightBackground: pickLogoUrl(a?.iconOnly?.lightBackground, v?.iconOnly?.lightBackground),
        darkBackground: pickLogoUrl(a?.iconOnly?.darkBackground, v?.iconOnly?.darkBackground),
        monochrome: pickLogoUrl(a?.iconOnly?.monochrome, v?.iconOnly?.monochrome),
      }),
    },
  };
}
