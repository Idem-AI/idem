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

export interface LegalDocumentCatalogEntry {
  type: LegalDocumentType;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  requiredFields: string[];
  group: 'company' | 'customers' | 'internal' | 'contracts';
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
}

export interface LegalDocsModel {
  context?: LegalDocsContext;
  documents: LegalDocumentModel[];
  updatedAt?: Date;
}
