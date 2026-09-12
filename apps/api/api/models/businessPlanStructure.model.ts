/**
 * Structure choisie pour le business plan d'un projet.
 *
 * Persistée sur `analysisResultModel.businessPlan.structure`. Elle est lue par
 * la génération (quelles sections produire, dans quel ordre), par le PDF
 * (ordre d'affichage) et par l'UI (complétude, régénération ciblée).
 *
 * Seules les CLÉS du catalogue sont persistées : les noms, briefs et volumes
 * restent dans le code. Un projet généré il y a six mois reste ainsi lisible
 * après une correction de brief, et une structure ne peut pas contenir une
 * section qui n'existe pas.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessPlanStructure:
 *       type: object
 *       properties:
 *         templateId:
 *           type: string
 *           description: Identifiant du modèle choisi, ou "custom".
 *         sectionKeys:
 *           type: array
 *           items:
 *             type: string
 *           description: Clés de sections retenues, dans l'ordre du document.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - templateId
 *         - sectionKeys
 */
export interface BusinessPlanStructure {
  /** Identifiant du modèle retenu, ou `custom` si l'utilisateur l'a composé. */
  templateId: string;
  /** Clés de sections retenues, DANS L'ORDRE de lecture du document. */
  sectionKeys: string[];
  updatedAt?: Date;
}
