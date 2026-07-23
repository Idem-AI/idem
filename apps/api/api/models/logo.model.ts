/**
 * @openapi
 * components:
 *   schemas:
 *     LogoVariationSet:
 *       type: object
 *       properties:
 *         lightBackground:
 *           type: string
 *           format: svg
 *           description: SVG content optimized for light backgrounds.
 *           nullable: true
 *         darkBackground:
 *           type: string
 *           format: svg
 *           description: SVG content optimized for dark backgrounds.
 *           nullable: true
 *         monochrome:
 *           type: string
 *           format: svg
 *           description: Monochrome version (black or white).
 *           nullable: true
 *     LogoVariations:
 *       type: object
 *       properties:
 *         withText:
 *           $ref: '#/components/schemas/LogoVariationSet'
 *           description: Logo variations including text elements.
 *           nullable: true
 *         iconOnly:
 *           $ref: '#/components/schemas/LogoVariationSet'
 *           description: Icon-only variations without text elements.
 *           nullable: true
 *     LogoModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         svg:
 *           type: string
 *           format: svg
 *           description: Main SVG logo content (full version with text).
 *         iconSvg:
 *           type: string
 *           format: svg
 *           description: Icon-only SVG content (without text elements).
 *           nullable: true
 *         concept:
 *           type: string
 *           description: Branding story or meaning behind the logo.
 *         colors:
 *           type: array
 *           items:
 *             type: string
 *             format: hex-color
 *           description: Array of HEX color codes used in the logo.
 *         fonts:
 *           type: array
 *           items:
 *             type: string
 *           description: Fonts used in the logo (if any).
 *         variations:
 *           $ref: '#/components/schemas/LogoVariations'
 *           nullable: true
 *         assetUrls:
 *           $ref: '#/components/schemas/LogoAssetUrls'
 *           description: >-
 *             Public URLs of the rasterized (PNG) logo assets uploaded to object
 *             storage. The vector SVG source stays inline in svg/iconSvg/variations;
 *             these URLs are what gets injected into generation contexts.
 *           nullable: true
 *       required:
 *         - id
 *         - name
 *         - svg
 *         - concept
 *         - colors
 *         - fonts
 *     LogoAssetUrlSet:
 *       type: object
 *       properties:
 *         lightBackground:
 *           type: string
 *           format: uri
 *           description: URL of the PNG rendered for light backgrounds.
 *           nullable: true
 *         darkBackground:
 *           type: string
 *           format: uri
 *           description: URL of the PNG rendered for dark backgrounds.
 *           nullable: true
 *         monochrome:
 *           type: string
 *           format: uri
 *           description: URL of the monochrome PNG.
 *           nullable: true
 *     LogoAssetUrls:
 *       type: object
 *       properties:
 *         primary:
 *           type: string
 *           format: uri
 *           description: URL of the primary (full) logo PNG.
 *           nullable: true
 *         icon:
 *           type: string
 *           format: uri
 *           description: URL of the icon-only logo PNG.
 *           nullable: true
 *         withText:
 *           $ref: '#/components/schemas/LogoAssetUrlSet'
 *           nullable: true
 *         iconOnly:
 *           $ref: '#/components/schemas/LogoAssetUrlSet'
 *           nullable: true
 */
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
 * Distinct from {@link LogoVariationSet}, whose values are inline SVG markup.
 */
export interface LogoAssetUrlSet {
  lightBackground?: string; // URL of the PNG rendered for light backgrounds
  darkBackground?: string; // URL of the PNG rendered for dark backgrounds
  monochrome?: string; // URL of the monochrome PNG
}

/**
 * URLs of the rasterized (PNG) logo assets uploaded to object storage (MinIO).
 *
 * The vector source of truth (SVG) stays inline in `svg` / `iconSvg` /
 * `variations`; these PNG URLs are what we inject into generation contexts
 * (pitch deck, flyers, brand book) as `<img src="…">` — lighter than an inline
 * SVG data URI and renderable everywhere.
 */
export interface LogoAssetUrls {
  primary?: string; // URL of the primary (full) logo PNG
  icon?: string; // URL of the icon-only logo PNG
  withText?: LogoAssetUrlSet; // PNG URLs of the with-text variations
  iconOnly?: LogoAssetUrlSet; // PNG URLs of the icon-only variations
}

export type LogoType = 'icon' | 'name' | 'initial';

export interface LogoPreferences {
  type: LogoType;
  useAIGeneration: boolean;
  customDescription?: string;
}

export interface LogoModel {
  id: string;
  name: string;
  svg: string; // Main SVG logo (default full version)
  iconSvg?: string; // Icon-only SVG content (without text elements)
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
