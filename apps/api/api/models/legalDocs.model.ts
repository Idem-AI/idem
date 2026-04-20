/**
 * Legal document types supported by the generator.
 * Tailored to African SMB reality (OHADA zone + common-law countries).
 */
export type LegalDocumentType =
  | 'statuts_sarl'
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

/**
 * Extra context provided by the user before generation
 * (company form, jurisdiction, capital, etc.).
 */
export interface LegalDocsContext {
  country?: string;
  ohadaZone?: boolean;
  legalForm?: string;
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
