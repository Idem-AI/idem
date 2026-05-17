import { LegalDocumentType } from '../../models/legalDocs.model';

export interface LegalDocumentCatalogEntry {
  type: LegalDocumentType;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  /** Fields hinted as important for this document */
  requiredFields: Array<
    | 'legalForm'
    | 'country'
    | 'capital'
    | 'currency'
    | 'headOffice'
    | 'founders'
    | 'companyEmail'
    | 'companyPhone'
    | 'website'
    | 'activityDescription'
  >;
  /** UI grouping */
  group: 'company' | 'customers' | 'internal' | 'contracts';
}

export const LEGAL_DOCS_CATALOG: LegalDocumentCatalogEntry[] = [
  {
    type: 'statuts_sarl',
    nameFr: 'Statuts SARL',
    nameEn: 'SARL / LLC Articles of Association',
    descriptionFr: 'Statuts de société à responsabilité limitée (zone OHADA ou équivalent).',
    descriptionEn: 'Articles for a limited liability company (OHADA or equivalent).',
    requiredFields: ['country', 'capital', 'currency', 'headOffice', 'founders', 'activityDescription'],
    group: 'company',
  },
  {
    type: 'statuts_sas',
    nameFr: 'Statuts SAS',
    nameEn: 'SAS / Joint-Stock Articles',
    descriptionFr: 'Statuts d’une société par actions simplifiée.',
    descriptionEn: 'Articles for a simplified joint-stock company.',
    requiredFields: ['country', 'capital', 'currency', 'headOffice', 'founders', 'activityDescription'],
    group: 'company',
  },
  {
    type: 'pacte_associes',
    nameFr: 'Pacte d’associés',
    nameEn: 'Shareholders Agreement',
    descriptionFr: 'Pacte entre associés (clauses de gouvernance, sortie, préemption).',
    descriptionEn: 'Agreement between shareholders (governance, exit, preemption clauses).',
    requiredFields: ['country', 'founders', 'capital'],
    group: 'company',
  },
  {
    type: 'cgu',
    nameFr: 'Conditions Générales d’Utilisation (CGU)',
    nameEn: 'Terms of Use',
    descriptionFr: 'CGU pour plateforme / service en ligne.',
    descriptionEn: 'Terms of use for an online platform or service.',
    requiredFields: ['country', 'companyEmail', 'website', 'activityDescription'],
    group: 'customers',
  },
  {
    type: 'cgv',
    nameFr: 'Conditions Générales de Vente (CGV)',
    nameEn: 'Terms of Sale',
    descriptionFr: 'CGV pour vente de biens ou services.',
    descriptionEn: 'Terms of sale for goods or services.',
    requiredFields: ['country', 'companyEmail', 'currency', 'activityDescription'],
    group: 'customers',
  },
  {
    type: 'privacy_policy',
    nameFr: 'Politique de Confidentialité',
    nameEn: 'Privacy Policy',
    descriptionFr: 'Politique de confidentialité conforme aux réglementations locales (RGPD UE, loi informatique & libertés locales).',
    descriptionEn: 'Privacy policy compliant with local regulations (GDPR + local data protection laws).',
    requiredFields: ['country', 'companyEmail', 'website'],
    group: 'customers',
  },
  {
    type: 'nda',
    nameFr: 'Accord de Confidentialité (NDA)',
    nameEn: 'Non-Disclosure Agreement (NDA)',
    descriptionFr: 'Accord bilatéral de confidentialité.',
    descriptionEn: 'Mutual non-disclosure agreement.',
    requiredFields: ['country'],
    group: 'contracts',
  },
  {
    type: 'employment_contract',
    nameFr: 'Contrat de travail',
    nameEn: 'Employment Contract',
    descriptionFr: 'Contrat de travail (CDI par défaut, adaptable CDD).',
    descriptionEn: 'Employment contract (permanent by default, adaptable to fixed-term).',
    requiredFields: ['country', 'headOffice', 'currency'],
    group: 'contracts',
  },
  {
    type: 'service_contract',
    nameFr: 'Contrat de prestation de services',
    nameEn: 'Service Contract',
    descriptionFr: 'Contrat de prestation B2B.',
    descriptionEn: 'B2B service agreement.',
    requiredFields: ['country', 'currency'],
    group: 'contracts',
  },
  {
    type: 'internal_regulations',
    nameFr: 'Règlement intérieur',
    nameEn: 'Internal Regulations',
    descriptionFr: 'Règlement intérieur de l’entreprise.',
    descriptionEn: 'Company internal regulations.',
    requiredFields: ['country', 'headOffice'],
    group: 'internal',
  },
  {
    type: 'legal_mentions',
    nameFr: 'Mentions légales',
    nameEn: 'Legal Notice',
    descriptionFr: 'Mentions légales du site / service.',
    descriptionEn: 'Legal notice for the website / service.',
    requiredFields: ['companyEmail', 'website', 'headOffice'],
    group: 'customers',
  },
];

export const getCatalogEntry = (type: LegalDocumentType): LegalDocumentCatalogEntry | undefined =>
  LEGAL_DOCS_CATALOG.find((e) => e.type === type);
