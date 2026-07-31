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
 *         lockup:
 *           $ref: '#/components/schemas/LogoLockupSpec'
 *           description: >-
 *             Composition recipe of the "icon + brand name" lockup (icon type only).
 *             The wordmark is typeset server-side from the real font metrics, so this
 *             recipe is what allows recomposing it identically for every declination.
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
 *     LogoLockupSpec:
 *       type: object
 *       properties:
 *         brandName:
 *           type: string
 *         fontFamily:
 *           type: string
 *         fontWeight:
 *           type: number
 *         letterSpacing:
 *           type: number
 *           description: Letter-spacing in em.
 *         wordmarkColor:
 *           type: string
 *           format: hex-color
 *         arrangement:
 *           type: string
 *           enum: [horizontal, stacked]
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
  lightBackground?: string; // MinIO URL of SVG optimized for light backgrounds
  darkBackground?: string; // MinIO URL of SVG optimized for dark backgrounds
  monochrome?: string; // MinIO URL of monochrome SVG version
}

export interface LogoVariations {
  withText?: LogoVariationSet; // Logo variation URLs including text elements
  iconOnly?: LogoVariationSet; // Icon-only variation URLs without text elements
}

/**
 * A set of hosted PNG asset URLs (one per background variant).
 * Distinct from {@link LogoVariationSet}, whose values are hosted SVG URLs.
 */
export interface LogoAssetUrlSet {
  lightBackground?: string; // URL of the PNG rendered for light backgrounds
  darkBackground?: string; // URL of the PNG rendered for dark backgrounds
  monochrome?: string; // URL of the monochrome PNG
}

/**
 * URLs of the rasterized (PNG) logo assets uploaded to object storage (MinIO).
 *
 * The vector SVG source is also hosted in MinIO (see `svg` / `iconSvg` /
 * `variations`). These PNG URLs are what we inject into generation contexts
 * (pitch deck, flyers, brand book) as `<img src="…">`.
 */
export interface LogoAssetUrls {
  primary?: string; // URL of the primary (full) logo PNG
  icon?: string; // URL of the icon-only logo PNG
  withText?: LogoAssetUrlSet; // PNG URLs of the with-text variations
  iconOnly?: LogoAssetUrlSet; // PNG URLs of the icon-only variations
}

export type LogoType = 'icon' | 'name' | 'initial';

export type LogoLockupArrangement = 'horizontal' | 'stacked';

/**
 * Recette de composition du lockup « icône + nom » (type `icon`).
 *
 * Le nom n'est pas dessiné par l'IA mais posé par le serveur à partir des
 * métriques réelles de la police. Conserver cette recette permet de recomposer
 * le lockup à l'identique (déclinaisons claires/sombres/monochromes) sans
 * nouvel appel au modèle, donc sans dérive d'alignement ni de typographie.
 */
export interface LogoLockupSpec {
  brandName: string;
  fontFamily: string;
  fontWeight: number;
  /** Interlettrage en em. */
  letterSpacing: number;
  wordmarkColor: string;
  arrangement: LogoLockupArrangement;
}

export interface LogoPreferences {
  type: LogoType;
  useAIGeneration: boolean;
  customDescription?: string;
}

export interface LogoModel {
  id: string;
  name: string;
  svg: string; // MinIO URL of the main SVG logo (legacy: may be inline SVG — use resolveSvgContent())
  iconSvg?: string; // MinIO URL of the icon-only SVG (legacy: may be inline SVG)
  concept: string; // Branding story or meaning behind the logo
  colors: string[]; // Array of HEX color codes used in the logo
  fonts: string[]; // Fonts used in the logo (if any)
  type?: LogoType; // Type of logo (icon, name, initial)
  customDescription?: string; // User-provided custom description

  // Recette de composition du lockup (type `icon` uniquement) : permet de
  // recomposer icône + nom sans repasser par l'IA.
  lockup?: LogoLockupSpec;

  variations?: LogoVariations; // Variation SVG URLs (legacy: may be inline SVG)

  // Hosted PNG asset URLs (object storage) for generation contexts.
  assetUrls?: LogoAssetUrls;
}
