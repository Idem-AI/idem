/**
 * Structure d'un business plan : le sommaire que le document suivra.
 *
 * Certaines banques et certains fonds imposent leur table des matières — un
 * dossier qui ne la suit pas est renvoyé avant d'être lu. L'utilisateur choisit
 * donc un modèle, ou compose le sien, mais uniquement à partir d'un catalogue
 * fermé servi par l'API : une section hors catalogue n'a ni brief de contenu ni
 * volume, et serait générée sans filet.
 *
 * Les libellés ne viennent PAS de l'API : elle renvoie des identifiants, et
 * l'i18n les résout côté client comme partout ailleurs dans l'application.
 */

/** Public visé par un modèle — sert au filtrage dans le sélecteur. */
export type BusinessPlanAudience = 'bank' | 'investor' | 'grant' | 'internal' | 'general';

/** Famille d'une section — sert au regroupement dans le composeur. */
export type BusinessPlanSectionCategory =
  | 'opening'
  | 'company'
  | 'market'
  | 'offer'
  | 'strategy'
  | 'operations'
  | 'finance'
  | 'impact'
  | 'closing';

export interface BusinessPlanTemplate {
  id: string;
  audience: BusinessPlanAudience;
  /** Origine de la structure (SBA, guide bancaire…), affichée telle quelle. */
  source?: string;
  /** Fourchette de pages A4 attendue, ex: "20-30". */
  estimatedPages: string;
  isDefault: boolean;
  /** Clés de sections, DANS L'ORDRE de lecture du document. */
  sectionKeys: string[];
}

export interface BusinessPlanCatalogSection {
  key: string;
  /** Nom canonique backend — c'est la clé i18n du libellé. */
  name: string;
  category: BusinessPlanSectionCategory;
  /** La section déclenche une phase de recherche web sourcée. */
  needsResearch: boolean;
  /** Section non retirable (la page de couverture). */
  required: boolean;
}

export interface BusinessPlanStructureCatalog {
  defaultTemplateId: string;
  customTemplateId: string;
  limits: { min: number; max: number };
  templates: BusinessPlanTemplate[];
  sections: BusinessPlanCatalogSection[];
}

export interface BusinessPlanStructure {
  templateId: string;
  sectionKeys: string[];
  updatedAt?: string;
}

/**
 * Ce que le sélecteur rend à l'écran de génération : la structure enregistrée,
 * et les noms canoniques des sections dans l'ordre.
 *
 * Les NOMS accompagnent les clés parce que la console de génération et le
 * panneau de complétude raisonnent sur les noms émis par le backend : les
 * recalculer plus loin obligerait à recharger le catalogue au même instant.
 */
export interface BusinessPlanStructureSelection {
  structure: BusinessPlanStructure;
  sectionNames: string[];
}

/** Ordre d'affichage des familles dans le composeur. */
export const SECTION_CATEGORY_ORDER: BusinessPlanSectionCategory[] = [
  'opening',
  'company',
  'market',
  'offer',
  'strategy',
  'operations',
  'finance',
  'impact',
  'closing',
];
