/**
 * @openapi
 * components:
 *   schemas:
 *     SectionModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The unique identifier for the section.
 *           nullable: true
 *         name:
 *           type: string
 *           description: The name of the section.
 *         type:
 *           type: string
 *           description: The type of the section (e.g., 'market-analysis', 'financial-projections').
 *         data:
 *           type: object
 *           description: The content or data of the section. Structure can vary.
 *           additionalProperties: true
 *         summary:
 *           type: string
 *           description: A summary of the section's content.
 *       required:
 *         - name
 *         - type
 *         - data
 *         - summary
 */
/** Source réelle citée dans une section (issue du grounding web). */
export interface SectionSource {
  id: string;
  title: string;
  url: string;
  domain?: string;
}

/** Résumé du contrôle anti-invention appliqué à la section. */
export interface SectionVerification {
  passed: boolean;
  citedClaims: number;
  uncitedClaims: number;
}

export interface SectionModel {
  id?: string;
  name: string;
  type: string;
  data: any;
  summary: string;
  /** Sources web réelles utilisées pour cette section (citations [sN]). */
  sources?: SectionSource[];
  /** Verdict du vérificateur (présent pour les sections issues de recherche). */
  verification?: SectionVerification;
  updatedAt?: Date;
}
