import type { SectionContent, SectionSpec } from '@idem/graphic-engine';
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
  /**
   * La page telle que le moteur graphique l'a écrite : son contenu (textes, chiffres, médias) et son code. Elle permet
   * une nouvelle mise en page SANS réécrire le contenu, et des retouches de mots sans modèle d'écriture. Absente sur
   * les sections d'avant octobre 2026, ou modifiées à la main.
   */
  composition?: SectionComposition;
  /**
   * La recherche web qui a nourri la section (sources + synthèse). Une régénération la relit : elle change la
   * forme, jamais les faits, et ne refait pas d'appel web.
   */
  research?: { sources: Array<SectionSource & { snippet?: string; retrievedAt: string }>; digest: string };
  updatedAt?: Date;
}

export interface SectionComposition {
  engine: 'graphic-engine';
  content: SectionContent;
  spec?: SectionSpec;
  /** Le cran qui a écrit la page. */
  level?: string;
}
