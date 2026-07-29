export interface LogoVariationSet {
  lightBackground?: string; // SVG optimized for light backgrounds
  darkBackground?: string; // SVG optimized for dark backgrounds
  monochrome?: string; // Monochrome version (black or white)
}

export interface LogoVariations {
  withText?: LogoVariationSet; // Logo variations including text elements
  iconOnly?: LogoVariationSet; // Icon-only variations without text elements
}

/**
 * A set of hosted PNG asset URLs (one per background variant).
 * Distinct from LogoVariationSet, whose values are inline SVG markup.
 */
export interface LogoAssetUrlSet {
  lightBackground?: string; // URL of the PNG rendered for light backgrounds
  darkBackground?: string; // URL of the PNG rendered for dark backgrounds
  monochrome?: string; // URL of the monochrome PNG
}

/**
 * URLs of the rasterized (PNG) logo assets uploaded to object storage.
 * The vector SVG source stays inline in svg/iconSvg/variations; these URLs are
 * what gets injected into generation contexts as <img src>.
 */
export interface LogoAssetUrls {
  primary?: string; // URL of the primary (full) logo PNG
  icon?: string; // URL of the icon-only logo PNG
  withText?: LogoAssetUrlSet; // PNG URLs of the with-text variations
  iconOnly?: LogoAssetUrlSet; // PNG URLs of the icon-only variations
}

export interface LogoModel {
  id: string;
  name: string;
  svg: string; // Main SVG logo (full version with text)
  iconSvg?: string; // Icon-only SVG content (without text elements)
  concept: string; // Branding story or meaning behind the logo
  colors: string[]; // Array of HEX color codes used in the logo
  fonts: string[]; // Fonts used in the logo (if any)

  variations?: LogoVariations; // Enhanced variations with text/icon separation (inline SVG)
  assetUrls?: LogoAssetUrls; // Hosted PNG asset URLs (SVG stays the source of truth)
}
