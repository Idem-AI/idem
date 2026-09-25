import { LegalDocumentType, LegalFormCode } from '../../models/legalDocs.model';

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
    type: 'statuts',
    nameFr: 'Statuts de la société',
    nameEn: 'Articles of association',
    descriptionFr: "L'acte de naissance de l'entreprise : forme, capital, associés et règles de fonctionnement.",
    descriptionEn: "The company's birth certificate: legal form, capital, partners and operating rules.",
    requiredFields: ['legalForm', 'country', 'capital', 'currency', 'headOffice', 'founders', 'activityDescription'],
    group: 'company',
  },
  {
    type: 'pacte_associes',
    nameFr: 'Pacte d’associés',
    nameEn: 'Shareholders Agreement',
    descriptionFr: 'Les règles entre associés que les statuts ne disent pas : décisions, entrée et sortie, départ d’un fondateur.',
    descriptionEn: 'Rules between partners that the articles leave out: decisions, entry and exit, a founder leaving.',
    requiredFields: ['country', 'founders', 'capital'],
    group: 'company',
  },
  {
    type: 'cgu',
    nameFr: 'Conditions Générales d’Utilisation (CGU)',
    nameEn: 'Terms of Use',
    descriptionFr: 'Les règles d’utilisation de votre site ou application, acceptées par chaque utilisateur.',
    descriptionEn: 'The rules every user accepts to use your website or app.',
    requiredFields: ['country', 'companyEmail', 'website', 'activityDescription'],
    group: 'customers',
  },
  {
    type: 'cgv',
    nameFr: 'Conditions Générales de Vente (CGV)',
    nameEn: 'Terms of Sale',
    descriptionFr: 'Prix, paiement, livraison, retours : le cadre de chaque vente à vos clients.',
    descriptionEn: 'Prices, payment, delivery, returns: the frame of every sale.',
    requiredFields: ['country', 'companyEmail', 'currency', 'activityDescription'],
    group: 'customers',
  },
  {
    type: 'privacy_policy',
    nameFr: 'Politique de Confidentialité',
    nameEn: 'Privacy Policy',
    descriptionFr: 'Ce que vous faites des données personnelles de vos utilisateurs, conformément à la loi.',
    descriptionEn: 'What you do with your users’ personal data, as the law requires.',
    requiredFields: ['country', 'companyEmail', 'website'],
    group: 'customers',
  },
  {
    type: 'nda',
    nameFr: 'Accord de Confidentialité (NDA)',
    nameEn: 'Non-Disclosure Agreement (NDA)',
    descriptionFr: 'Protège vos idées et informations quand vous les partagez avec un partenaire.',
    descriptionEn: 'Protects your ideas and information when you share them with a partner.',
    requiredFields: ['country'],
    group: 'contracts',
  },
  {
    type: 'employment_contract',
    nameFr: 'Contrat de travail',
    nameEn: 'Employment Contract',
    descriptionFr: 'Pour embaucher : poste, salaire, durée, obligations de chacun.',
    descriptionEn: 'To hire: role, salary, term and each party’s duties.',
    requiredFields: ['country', 'headOffice', 'currency'],
    group: 'contracts',
  },
  {
    type: 'service_contract',
    nameFr: 'Contrat de prestation de services',
    nameEn: 'Service Contract',
    descriptionFr: 'Encadre une mission réalisée pour une entreprise cliente : livrables, prix, délais.',
    descriptionEn: 'Frames a job done for a business client: deliverables, price, deadlines.',
    requiredFields: ['country', 'currency'],
    group: 'contracts',
  },
  {
    type: 'internal_regulations',
    nameFr: 'Règlement intérieur',
    nameEn: 'Internal Regulations',
    descriptionFr: 'Horaires, discipline, sécurité : les règles de vie communes à toute l’équipe.',
    descriptionEn: 'Hours, discipline, safety: the shared rules for the whole team.',
    requiredFields: ['country', 'headOffice'],
    group: 'internal',
  },
  {
    type: 'legal_mentions',
    nameFr: 'Mentions légales',
    nameEn: 'Legal Notice',
    descriptionFr: 'Qui édite et héberge votre site : une obligation pour tout site professionnel.',
    descriptionEn: 'Who publishes and hosts your website: required for any business site.',
    requiredFields: ['companyEmail', 'website', 'headOffice'],
    group: 'customers',
  },
];

/** Anciens types de statuts : plus proposés, mais encore présents dans des projets. */
const LEGACY_STATUTES: Record<string, LegalFormCode> = { statuts_sarl: 'sarl', statuts_sas: 'sas' };

/** Forme juridique implicite d'un ancien type de statuts (`statuts_sarl` → `sarl`). */
export const legacyStatutesForm = (type: string): LegalFormCode | undefined => LEGACY_STATUTES[type];

export const isStatutesType = (type: string): boolean => type === 'statuts' || type in LEGACY_STATUTES;

export const getCatalogEntry = (type: LegalDocumentType): LegalDocumentCatalogEntry | undefined =>
  LEGAL_DOCS_CATALOG.find((e) => e.type === (isStatutesType(type) ? 'statuts' : type));
