import type { LogoModel } from '@/api/persistence/models/logo.model';

/**
 * Makes a logo value displayable inside an `<img src>`. A stored logo value can be:
 *  - a hosted URL (MinIO bucket) — the nominal case since assets are externalized,
 *  - an already-encoded data-URI,
 *  - raw inline SVG markup — projects created before the externalization.
 *
 * An `<img>` cannot render raw markup: without the data-URI conversion the image
 * silently stays blank, which is why the navbar and the generation-launch screen
 * showed no logo at all.
 */
export function toLogoSrc(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('<')) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  return raw; // hosted URL, asset path or data-URI
}

/**
 * Best available source for the small, square rendition of a project logo
 * (navbar chip, workspace header avatar).
 *
 * Hosted PNGs (`assetUrls`) come first — they are the resolved, rasterized
 * assets — then the SVG variations, then the full logo as a last resort so a
 * project keeps a visual even when only the primary logo was produced.
 * Light-background renditions are preferred because the chips displaying them
 * are light in both themes.
 */
export function resolveProjectLogoIconSrc(logo?: LogoModel | null): string {
  if (!logo) return '';

  const candidates = [
    logo.assetUrls?.iconOnly?.lightBackground,
    logo.variations?.iconOnly?.lightBackground,
    logo.assetUrls?.icon,
    logo.iconSvg,
    logo.assetUrls?.withText?.lightBackground,
    logo.variations?.withText?.lightBackground,
    logo.assetUrls?.primary,
    logo.svg,
  ];

  for (const candidate of candidates) {
    const src = toLogoSrc(candidate);
    if (src) return src;
  }
  return '';
}
