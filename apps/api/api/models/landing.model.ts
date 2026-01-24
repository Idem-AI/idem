/**
 * @openapi
 * components:
 *   schemas:
 *     LandingSelectedOptions:
 *       type: object
 *       properties:
 *         stack:
 *           type: string
 *           description: The technology stack selected for the landing page.
 *         seoEnabled:
 *           type: boolean
 *           description: Whether SEO features are enabled.
 *         contactFormEnabled:
 *           type: boolean
 *           description: Whether a contact form is enabled.
 *         analyticsEnabled:
 *           type: boolean
 *           description: Whether analytics integration is enabled.
 *         i18nEnabled:
 *           type: boolean
 *           description: Whether internationalization (i18n) is enabled.
 *         performanceOptimized:
 *           type: boolean
 *           description: Whether performance optimizations are applied.
 *       required:
 *         - stack
 *         - seoEnabled
 *         - contactFormEnabled
 *         - analyticsEnabled
 *         - i18nEnabled
 *         - performanceOptimized
 *     LandingModel:
 *       type: object
 *       properties:
 *         selectedOptions:
 *           $ref: '#/components/schemas/LandingSelectedOptions'
 *       required:
 *         - selectedOptions
 */
export interface LandingModel {
  selectedOptions: {
    stack: string;
    seoEnabled: boolean;
    contactFormEnabled: boolean;
    analyticsEnabled: boolean;
    i18nEnabled: boolean;
    performanceOptimized: boolean;
  };
}
