import { SectionModel } from './section.model';
import { BusinessPlanStructure } from './businessPlanStructure.model';

/** Qualité de mise en page PDF d'une section (remplissage de page). */
export interface SectionPdfQuality {
  /** Nom canonique de la section (ex : "Company Summary"). */
  sectionName: string;
  /** Ratio de remplissage le plus faible parmi les pages produites (0..1). */
  worstFill: number;
  /** Nombre de pages A4 produites pour cette section. */
  pages: number;
}

/** Résultat de la dernière génération PDF du business plan. */
export interface BusinessPlanPdfQuality {
  /** Horodatage de la dernière génération PDF. */
  generatedAt: Date;
  /** Sections dont au moins une page est remplie à moins de 60 %. */
  underFilledSections: SectionPdfQuality[];
}

/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessPlanModel:
 *       type: object
 *       properties:
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *       required:
 *         - sections
 */
export interface BusinessPlanModel {
  sections: SectionModel[];
  /**
   * Structure retenue pour ce plan (modèle bancaire, investisseur, composition
   * libre…). Absente sur les plans générés avant l'introduction des structures :
   * `resolveStructure` retombe alors sur le modèle par défaut, qui EST la
   * structure historique en neuf sections.
   */
  structure?: BusinessPlanStructure;
  /**
   * Qualité PDF de la dernière génération : sections sous-remplies.
   * Absent si le PDF n'a pas encore été généré ou si toutes les pages sont bien remplies.
   */
  pdfQuality?: BusinessPlanPdfQuality;
}
