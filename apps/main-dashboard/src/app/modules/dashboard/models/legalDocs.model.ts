export type LegalDocumentType =
  | 'statuts'
  /** @deprecated anciens statuts, encore présents dans des projets */
  | 'statuts_sarl'
  /** @deprecated anciens statuts, encore présents dans des projets */
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

export interface LegalDocumentCatalogEntry {
  type: LegalDocumentType;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  requiredFields: string[];
  group: 'company' | 'customers' | 'internal' | 'contracts';
}

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

export type LegalJurisdiction = 'ohada' | 'common_law' | 'civil_other';

export type LegalDocPriority = 'essential' | 'recommended' | 'optional' | 'not_applicable';

export interface LegalReason {
  fr: string;
  en: string;
}

export interface LegalFormEntry {
  code: LegalFormCode;
  acronym: string;
  nameFr: string;
  nameEn: string;
  summaryFr: string;
  summaryEn: string;
  idealForFr: string;
  idealForEn: string;
  prosFr: string[];
  prosEn: string[];
  consFr: string[];
  consEn: string[];
  facts: {
    partnersFr: string;
    partnersEn: string;
    capitalFr: string;
    capitalEn: string;
    liabilityFr: string;
    liabilityEn: string;
    leaderFr: string;
    leaderEn: string;
  };
  partners: 'single' | 'multi' | 'any';
  hasStatutes: boolean;
  jurisdictions: LegalJurisdiction[];
}

export interface LegalFormRecommendation {
  code: LegalFormCode;
  reasons: LegalReason[];
  alternative?: { code: LegalFormCode; reason: LegalReason };
}

export interface LegalDocRecommendation {
  type: LegalDocumentType;
  priority: LegalDocPriority;
  reason: LegalReason;
}

export interface LegalRecommendations {
  jurisdiction: LegalJurisdiction;
  form: LegalFormRecommendation;
  documents: LegalDocRecommendation[];
  prefill: LegalDocsContext;
}

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

export interface LegalDocumentModel {
  id?: string;
  type: LegalDocumentType;
  name: string;
  data: string;
  summary: string;
  generatedAt: Date;
  legalForm?: LegalFormCode;
}

export interface LegalDocsModel {
  context?: LegalDocsContext;
  documents: LegalDocumentModel[];
  updatedAt?: Date;
}
