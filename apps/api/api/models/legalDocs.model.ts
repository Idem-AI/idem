/**
 * Legal document types supported by the generator.
 * Tailored to African SMB reality (OHADA zone + common-law countries).
 */
export type LegalDocumentType =
  /** Statuts de la société : un seul par projet, rédigés pour `context.legalForm` */
  | 'statuts'
  /** @deprecated remplacés par `statuts` + forme juridique ; conservés pour les documents existants */
  | 'statuts_sarl'
  /** @deprecated remplacés par `statuts` + forme juridique ; conservés pour les documents existants */
  | 'statuts_sas'
  | 'pacte_associes'
  | 'cgu'
  | 'cgv'
  | 'privacy_policy'
  | 'nda'
  | 'employment_contract'
  | 'service_contract'
  | 'internal_regulations'
  | 'legal_mentions';

/** Formes juridiques proposées (OHADA / droit civil, puis common law). */
export type LegalFormCode =
  | 'ei'
  | 'sarlu'
  | 'sarl'
  | 'sasu'
  | 'sas'
  | 'sa'
  | 'sole_trader'
  | 'ltd'
  | 'plc';

/** Cadre juridique déduit du pays du projet. */
export type LegalJurisdiction = 'ohada' | 'common_law' | 'civil_other';

/** Niveau de recommandation d'un document pour un projet donné. */
export type LegalDocPriority = 'essential' | 'recommended' | 'optional' | 'not_applicable';

/** Une raison lisible, dans les deux langues de l'interface. */
export interface LegalReason {
  fr: string;
  en: string;
}

export interface LegalFormRecommendation {
  code: LegalFormCode;
  /** Pourquoi cette forme, en 2 à 4 phrases courtes */
  reasons: LegalReason[];
  /** Autre forme sérieuse, pour ne pas enfermer l'utilisateur */
  alternative?: { code: LegalFormCode; reason: LegalReason };
}

export interface LegalDocRecommendation {
  type: LegalDocumentType;
  priority: LegalDocPriority;
  reason: LegalReason;
}

/**
 * Réponse de `GET /legalDocs/:projectId/recommendations` : tout ce dont
 * l'interface a besoin pour guider l'utilisateur, calculé par le code (pas
 * par l'IA) pour rester stable et explicable.
 */
export interface LegalRecommendations {
  jurisdiction: LegalJurisdiction;
  form: LegalFormRecommendation;
  documents: LegalDocRecommendation[];
  /** Contexte pré-rempli depuis le projet (pays, adresse, équipe…) */
  prefill: LegalDocsContext;
}

/**
 * Extra context provided by the user before generation
 * (company form, jurisdiction, capital, etc.).
 */
export interface LegalDocsContext {
  country?: string;
  ohadaZone?: boolean;
  /** Code de forme (`sarl`, `sas`…) ; texte libre accepté pour les anciens projets */
  legalForm?: LegalFormCode | string;
  capital?: string;
  currency?: string;
  headOffice?: string;
  founders?: Array<{
    name: string;
    role?: string;
    shares?: string;
    address?: string;
  }>;
  companyEmail?: string;
  companyPhone?: string;
  website?: string;
  activityDescription?: string;
  additionalClauses?: string;
}

/**
 * A single generated legal document (HTML + Tailwind content,
 * converted to PDF on demand).
 */
export interface LegalDocumentModel {
  id?: string;
  type: LegalDocumentType;
  name: string;
  /** Raw HTML + Tailwind content (single minified block, A4 portrait) */
  data: string;
  summary: string;
  generatedAt: Date;
  /** Forme juridique pour laquelle les statuts ont été rédigés */
  legalForm?: LegalFormCode;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     LegalDocsModel:
 *       type: object
 *       properties:
 *         context:
 *           type: object
 *         documents:
 *           type: array
 *           items:
 *             type: object
 */
export interface LegalDocsModel {
  context?: LegalDocsContext;
  documents: LegalDocumentModel[];
  updatedAt?: Date;
}
