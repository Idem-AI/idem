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
 *       required:
 *         - id
 *         - name
 *         - svg
 *         - concept
 *         - colors
 *         - fonts
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

  variations?: LogoVariations; // Enhanced variations with text/icon separation
}
