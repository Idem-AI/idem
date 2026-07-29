import { LogoModel } from '../models/logo.model';

/**
 * Helpers to reference a logo inside AI generation contexts by URL rather than
 * by inline SVG markup.
 *
 * Since SVGs are now hosted on MinIO (as `.svg` URLs in `logo.svg` /
 * `logo.iconSvg` / `logo.variations`), these helpers simply pick the best URL
 * for prompt injection. For legacy projects with inline SVG, the helpers filter
 * out raw markup (which would bloat prompts) and prefer the hosted PNG URLs
 * from `logo.assetUrls` instead.
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
