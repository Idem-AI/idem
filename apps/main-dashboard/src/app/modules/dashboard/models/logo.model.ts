export interface LogoModel {
  id: string;
  name: string;
  svg: string; // Main SVG logo (default full version)
  iconSvg?: string; // Icon-only SVG (used for variations generation)
  concept: string; // Branding story or meaning behind the logo
  colors: string[]; // Array of HEX color codes used in the logo
  fonts: string[]; // Fonts used in the logo (if any)
  type?: LogoType; // Type of logo (icon, name, initial)
  customDescription?: string; // User-provided custom description

  variations?: LogoVariations; // Enhanced variations with text/icon separation (inline SVG)

  // Hosted PNG asset URLs (object storage). SVG above stays the source of truth;
  // these are used when the logo must be referenced by URL (generation contexts).
  assetUrls?: LogoAssetUrls;
}

export type LogoType = 'icon' | 'name' | 'initial';

export interface LogoPreferencesModel {
  type: LogoType;
  useAIGeneration: boolean;
  customDescription?: string;
}
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
 * used when the logo must be referenced by URL (generation contexts, exports).
 */
export interface LogoAssetUrls {
  primary?: string; // URL of the primary (full) logo PNG
  icon?: string; // URL of the icon-only logo PNG
  withText?: LogoAssetUrlSet; // PNG URLs of the with-text variations
  iconOnly?: LogoAssetUrlSet; // PNG URLs of the icon-only variations
}
