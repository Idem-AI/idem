import { LegalFormCode, LegalJurisdiction } from '../../models/legalDocs.model';

/**
 * Formes juridiques proposées à l'utilisateur.
 *
 * Une entreprise n'a qu'UNE forme : c'est elle qui détermine les statuts
 * rédigés. Chaque fiche dit ce que la forme représente concrètement et pour
 * quel type de projet elle convient, en langage courant (pas de jargon).
 */
export interface LegalFormEntry {
  code: LegalFormCode;
  /** Sigle affiché (SARL, SAS, Ltd…) */
  acronym: string;
  nameFr: string;
  nameEn: string;
  /** Une phrase : ce que c'est, concrètement */
  summaryFr: string;
  summaryEn: string;
  /** Pour quel type de projet elle est faite */
  idealForFr: string;
  idealForEn: string;
  prosFr: string[];
  prosEn: string[];
  consFr: string[];
  consEn: string[];
  /** Faits clés, déjà formulés pour l'affichage */
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
  /** Nombre d'associés : `single` = un seul, `multi` = au moins deux, `any` = libre */
  partners: 'single' | 'multi' | 'any';
  /** Faux pour l'entreprise individuelle : pas de statuts à rédiger */
  hasStatutes: boolean;
  jurisdictions: LegalJurisdiction[];
}

const CIVIL: LegalJurisdiction[] = ['ohada', 'civil_other'];

export const LEGAL_FORMS: LegalFormEntry[] = [
  {
    code: 'ei',
    acronym: 'EI',
    nameFr: 'Entreprise individuelle',
    nameEn: 'Sole proprietorship',
    summaryFr: 'Vous exercez en votre nom propre, sans créer de société.',
    summaryEn: 'You trade under your own name, without creating a company.',
    idealForFr: 'Un petit commerce ou une activité de service que vous lancez seul, pour tester le marché.',
    idealForEn: 'A small shop or service activity you start alone to test the market.',
    prosFr: ['Création rapide et peu coûteuse', 'Aucun capital, aucun statut à rédiger'],
    prosEn: ['Fast and cheap to set up', 'No capital, no articles to draft'],
    consFr: ['Vos biens personnels répondent des dettes', 'Impossible de faire entrer un associé ou un investisseur'],
    consEn: ['Your personal assets cover the debts', 'No way to bring in a partner or investor'],
    facts: {
      partnersFr: 'Vous seul',
      partnersEn: 'Just you',
      capitalFr: 'Aucun',
      capitalEn: 'None',
      liabilityFr: 'Illimitée (biens personnels engagés)',
      liabilityEn: 'Unlimited (personal assets at stake)',
      leaderFr: "L'entrepreneur",
      leaderEn: 'The owner',
    },
    partners: 'single',
    hasStatutes: false,
    jurisdictions: CIVIL,
  },
  {
    code: 'sarlu',
    acronym: 'SARLU',
    nameFr: 'SARL unipersonnelle',
    nameEn: 'Single-member LLC (SARLU)',
    summaryFr: 'Une SARL avec un seul associé : vous seul, mais votre patrimoine personnel est protégé.',
    summaryEn: 'An LLC with a single member: just you, with your personal assets protected.',
    idealForFr: "Un entrepreneur seul qui veut une vraie société, simple à gérer, pour une activité stable.",
    idealForEn: 'A solo founder who wants a real company, simple to run, for a steady business.',
    prosFr: ['Responsabilité limitée à vos apports', 'Cadre connu des banques et administrations', 'Peut devenir une SARL si un associé vous rejoint'],
    prosEn: ['Liability limited to your contribution', 'Well known by banks and administrations', 'Turns into a regular SARL when a partner joins'],
    consFr: ['Peu adaptée à une levée de fonds', 'Règles de fonctionnement fixées par la loi, peu de souplesse'],
    consEn: ['Not suited to fundraising', 'Rules set by law, little flexibility'],
    facts: {
      partnersFr: '1 seul associé',
      partnersEn: '1 member only',
      capitalFr: 'Faible, fixé par la loi du pays',
      capitalEn: 'Low, set by national law',
      liabilityFr: 'Limitée aux apports',
      liabilityEn: 'Limited to contributions',
      leaderFr: 'Un gérant (souvent vous)',
      leaderEn: 'A manager (usually you)',
    },
    partners: 'single',
    hasStatutes: true,
    jurisdictions: CIVIL,
  },
  {
    code: 'sarl',
    acronym: 'SARL',
    nameFr: 'Société à responsabilité limitée',
    nameEn: 'Limited liability company (SARL)',
    summaryFr: 'La société la plus répandue en Afrique francophone : quelques associés, des règles claires, chacun protégé.',
    summaryEn: "The most common company in French-speaking Africa: a few partners, clear rules, everyone protected.",
    idealForFr: 'Une PME, un commerce ou un cabinet porté par 2 à 5 associés qui se connaissent bien.',
    idealForEn: 'An SME, shop or firm run by 2 to 5 partners who know each other well.',
    prosFr: ['Responsabilité limitée aux apports', 'Entrée de nouveaux associés contrôlée', 'Forme rassurante pour les banques'],
    prosEn: ['Liability limited to contributions', 'New partners admitted under control', 'Reassuring for banks'],
    consFr: ["Céder des parts demande l'accord des associés", 'Peu adaptée aux investisseurs'],
    consEn: ['Selling shares needs the partners’ approval', 'Not investor-friendly'],
    facts: {
      partnersFr: '2 à 100 associés',
      partnersEn: '2 to 100 partners',
      capitalFr: 'Faible, fixé par la loi du pays',
      capitalEn: 'Low, set by national law',
      liabilityFr: 'Limitée aux apports',
      liabilityEn: 'Limited to contributions',
      leaderFr: 'Un ou plusieurs gérants',
      leaderEn: 'One or more managers',
    },
    partners: 'multi',
    hasStatutes: true,
    jurisdictions: CIVIL,
  },
  {
    code: 'sasu',
    acronym: 'SASU',
    nameFr: 'SAS unipersonnelle',
    nameEn: 'Single-shareholder SAS (SASU)',
    summaryFr: 'Une SAS avec un seul actionnaire : la souplesse de la SAS, en solo.',
    summaryEn: 'An SAS with a single shareholder: SAS flexibility, solo.',
    idealForFr: 'Un fondateur seul qui lance un projet à fort potentiel et prévoit d’accueillir des investisseurs.',
    idealForEn: 'A solo founder launching a high-potential project who plans to welcome investors.',
    prosFr: ['Règles libres, écrites dans les statuts', 'Faire entrer un investisseur est simple', 'Responsabilité limitée aux apports'],
    prosEn: ['Free rules, written in the articles', 'Easy to bring in an investor', 'Liability limited to contributions'],
    consFr: ['Statuts à rédiger avec soin', 'Moins connue que la SARL dans certains pays'],
    consEn: ['Articles must be drafted carefully', 'Less known than the SARL in some countries'],
    facts: {
      partnersFr: '1 seul actionnaire',
      partnersEn: '1 shareholder only',
      capitalFr: 'Libre, fixé dans les statuts',
      capitalEn: 'Free, set in the articles',
      liabilityFr: 'Limitée aux apports',
      liabilityEn: 'Limited to contributions',
      leaderFr: 'Un président',
      leaderEn: 'A president',
    },
    partners: 'single',
    hasStatutes: true,
    jurisdictions: CIVIL,
  },
  {
    code: 'sas',
    acronym: 'SAS',
    nameFr: 'Société par actions simplifiée',
    nameEn: 'Simplified joint-stock company (SAS)',
    summaryFr: 'La forme des startups : vous écrivez vos propres règles et vous pouvez accueillir des investisseurs facilement.',
    summaryEn: 'The startup form: you write your own rules and can welcome investors easily.',
    idealForFr: 'Une startup ou un projet tech qui vise la croissance et une future levée de fonds.',
    idealForEn: 'A startup or tech project aiming for growth and a future fundraise.',
    prosFr: ['Entrée et sortie des investisseurs simples', 'Gouvernance sur mesure', 'Responsabilité limitée aux apports'],
    prosEn: ['Investors come in and out easily', 'Tailor-made governance', 'Liability limited to contributions'],
    consFr: ['Statuts plus longs à rédiger', "Un pacte d'associés est fortement conseillé"],
    consEn: ['Longer articles to draft', 'A shareholders’ agreement is strongly advised'],
    facts: {
      partnersFr: '2 actionnaires ou plus',
      partnersEn: '2 or more shareholders',
      capitalFr: 'Libre, fixé dans les statuts',
      capitalEn: 'Free, set in the articles',
      liabilityFr: 'Limitée aux apports',
      liabilityEn: 'Limited to contributions',
      leaderFr: 'Un président',
      leaderEn: 'A president',
    },
    partners: 'multi',
    hasStatutes: true,
    jurisdictions: CIVIL,
  },
  {
    code: 'sa',
    acronym: 'SA',
    nameFr: 'Société anonyme',
    nameEn: 'Public limited company (SA)',
    summaryFr: 'La forme des grandes entreprises : capital élevé, conseil d’administration et contrôle des comptes.',
    summaryEn: 'The form of large companies: high capital, a board and audited accounts.',
    idealForFr: 'Un projet d’envergure (banque, assurance, industrie) ou une entreprise qui vise la bourse.',
    idealForEn: 'A large-scale project (bank, insurance, industry) or a company heading for the stock market.',
    prosFr: ['Crédibilité maximale', 'Peut faire appel public à l’épargne', 'Actions librement cessibles'],
    prosEn: ['Maximum credibility', 'Can raise money from the public', 'Freely transferable shares'],
    consFr: ['Capital minimum élevé (10 000 000 FCFA en zone OHADA)', 'Commissaire aux comptes obligatoire', 'Fonctionnement lourd'],
    consEn: ['High minimum capital (10,000,000 FCFA in the OHADA zone)', 'Mandatory statutory auditor', 'Heavy to run'],
    facts: {
      partnersFr: '1 actionnaire ou plus',
      partnersEn: '1 or more shareholders',
      capitalFr: '10 000 000 FCFA minimum (OHADA)',
      capitalEn: '10,000,000 FCFA minimum (OHADA)',
      liabilityFr: 'Limitée aux apports',
      liabilityEn: 'Limited to contributions',
      leaderFr: "Conseil d'administration ou administrateur général",
      leaderEn: 'Board of directors or general administrator',
    },
    partners: 'any',
    hasStatutes: true,
    jurisdictions: CIVIL,
  },
  {
    code: 'sole_trader',
    acronym: 'Sole trader',
    nameFr: 'Entreprise individuelle (sole trader)',
    nameEn: 'Sole trader',
    summaryFr: 'Vous exercez en votre nom propre, sans créer de société.',
    summaryEn: 'You trade under your own name, without creating a company.',
    idealForFr: 'Une petite activité que vous lancez seul pour tester le marché.',
    idealForEn: 'A small activity you start alone to test the market.',
    prosFr: ['Enregistrement rapide', 'Aucun document constitutif'],
    prosEn: ['Quick registration', 'No constitutional documents'],
    consFr: ['Vos biens personnels répondent des dettes', 'Impossible d’accueillir un investisseur'],
    consEn: ['Your personal assets cover the debts', 'No way to welcome an investor'],
    facts: {
      partnersFr: 'Vous seul',
      partnersEn: 'Just you',
      capitalFr: 'Aucun',
      capitalEn: 'None',
      liabilityFr: 'Illimitée',
      liabilityEn: 'Unlimited',
      leaderFr: 'Le propriétaire',
      leaderEn: 'The owner',
    },
    partners: 'single',
    hasStatutes: false,
    jurisdictions: ['common_law'],
  },
  {
    code: 'ltd',
    acronym: 'Ltd',
    nameFr: 'Société privée à responsabilité limitée (Ltd)',
    nameEn: 'Private company limited by shares (Ltd)',
    summaryFr: 'La société standard des pays de common law : un ou plusieurs actionnaires, responsabilité limitée.',
    summaryEn: 'The standard company in common-law countries: one or more shareholders, limited liability.',
    idealForFr: 'Presque tous les projets : PME, startup, activité en ligne, seul ou à plusieurs.',
    idealForEn: 'Nearly every project: SME, startup, online business, alone or with partners.',
    prosFr: ['Responsabilité limitée', 'Accueille facilement des investisseurs', 'Forme reconnue partout'],
    prosEn: ['Limited liability', 'Welcomes investors easily', 'Recognised everywhere'],
    consFr: ['Obligations de déclaration annuelles', 'Actions non cotées en bourse'],
    consEn: ['Annual filing duties', 'Shares cannot be listed'],
    facts: {
      partnersFr: '1 actionnaire ou plus',
      partnersEn: '1 or more shareholders',
      capitalFr: 'Faible, fixé par la loi du pays',
      capitalEn: 'Low, set by national law',
      liabilityFr: 'Limitée aux actions',
      liabilityEn: 'Limited by shares',
      leaderFr: 'Un ou plusieurs directors',
      leaderEn: 'One or more directors',
    },
    partners: 'any',
    hasStatutes: true,
    jurisdictions: ['common_law'],
  },
  {
    code: 'plc',
    acronym: 'PLC',
    nameFr: 'Société anonyme publique (PLC)',
    nameEn: 'Public limited company (PLC)',
    summaryFr: 'La forme des grandes entreprises qui peuvent proposer leurs actions au public.',
    summaryEn: 'The form of large companies that can offer shares to the public.',
    idealForFr: 'Une entreprise d’envergure qui vise la bourse ou lève des fonds auprès du public.',
    idealForEn: 'A large company heading for the stock market or raising money from the public.',
    prosFr: ['Peut être cotée en bourse', 'Crédibilité maximale'],
    prosEn: ['Can be listed', 'Maximum credibility'],
    consFr: ['Capital minimum élevé', 'Contrôle et publication des comptes stricts'],
    consEn: ['High minimum capital', 'Strict audit and disclosure'],
    facts: {
      partnersFr: '2 actionnaires ou plus',
      partnersEn: '2 or more shareholders',
      capitalFr: 'Élevé, fixé par la loi du pays',
      capitalEn: 'High, set by national law',
      liabilityFr: 'Limitée aux actions',
      liabilityEn: 'Limited by shares',
      leaderFr: "Conseil d'administration",
      leaderEn: 'Board of directors',
    },
    partners: 'multi',
    hasStatutes: true,
    jurisdictions: ['common_law'],
  },
];

export const getLegalForm = (code?: string): LegalFormEntry | undefined =>
  LEGAL_FORMS.find((f) => f.code === code);

/**
 * Ramène une forme saisie librement (anciens projets : « SARL », « S.A.S. »)
 * à son code. Renvoie `undefined` si rien ne correspond.
 */
export function normalizeLegalForm(value?: string): LegalFormCode | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().replace(/[^a-z_]/g, '');
  return LEGAL_FORMS.find((f) => f.code === v || f.acronym.toLowerCase().replace(/[^a-z_]/g, '') === v)?.code;
}

export const getFormsForJurisdiction = (jurisdiction: LegalJurisdiction): LegalFormEntry[] =>
  LEGAL_FORMS.filter((f) => f.jurisdictions.includes(jurisdiction));

/** Retire accents et casse pour comparer des noms de pays saisis librement. */
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Les 17 États membres de l'OHADA, avec leurs graphies courantes. */
const OHADA_COUNTRIES: Array<{ names: string[]; currency: 'XAF' | 'XOF' | 'KMF' | 'GNF' | 'CDF' }> = [
  { names: ['benin'], currency: 'XOF' },
  { names: ['burkina', 'burkina faso'], currency: 'XOF' },
  { names: ['cote d ivoire', "cote d'ivoire", 'ivory coast', 'cote divoire'], currency: 'XOF' },
  { names: ['guinee-bissau', 'guinee bissau', 'guinea-bissau', 'guinea bissau'], currency: 'XOF' },
  { names: ['mali'], currency: 'XOF' },
  { names: ['niger'], currency: 'XOF' },
  { names: ['senegal'], currency: 'XOF' },
  { names: ['togo'], currency: 'XOF' },
  { names: ['cameroun', 'cameroon'], currency: 'XAF' },
  { names: ['centrafrique', 'republique centrafricaine', 'central african republic'], currency: 'XAF' },
  { names: ['congo', 'congo-brazzaville', 'republique du congo', 'republic of the congo'], currency: 'XAF' },
  { names: ['gabon'], currency: 'XAF' },
  { names: ['guinee equatoriale', 'equatorial guinea'], currency: 'XAF' },
  { names: ['tchad', 'chad'], currency: 'XAF' },
  { names: ['comores', 'comoros'], currency: 'KMF' },
  { names: ['guinee', 'guinea', 'guinee conakry'], currency: 'GNF' },
  { names: ['rdc', 'republique democratique du congo', 'democratic republic of the congo', 'drc', 'congo-kinshasa'], currency: 'CDF' },
];

const COMMON_LAW_COUNTRIES: Array<{ names: string[]; currency: string }> = [
  { names: ['nigeria'], currency: 'NGN' },
  { names: ['ghana'], currency: 'GHS' },
  { names: ['kenya'], currency: 'KES' },
  { names: ['south africa', 'afrique du sud'], currency: 'ZAR' },
  { names: ['uganda', 'ouganda'], currency: 'UGX' },
  { names: ['tanzania', 'tanzanie'], currency: 'TZS' },
  { names: ['rwanda'], currency: 'RWF' },
  { names: ['zambia', 'zambie'], currency: 'ZMW' },
  { names: ['sierra leone'], currency: 'SLE' },
  { names: ['liberia'], currency: 'LRD' },
  { names: ['gambia', 'gambie'], currency: 'GMD' },
  { names: ['botswana'], currency: 'BWP' },
  { names: ['malawi'], currency: 'MWK' },
  { names: ['zimbabwe'], currency: 'USD' },
  { names: ['united kingdom', 'royaume-uni', 'uk'], currency: 'GBP' },
  { names: ['united states', 'etats-unis', 'usa'], currency: 'USD' },
];

export interface JurisdictionInfo {
  jurisdiction: LegalJurisdiction;
  /** Devise usuelle du pays, si connue */
  currency?: string;
}

/**
 * Déduit le cadre juridique d'un pays saisi librement. Sans pays connu, on
 * retient l'OHADA : c'est le marché principal d'IDEM.
 */
export function detectJurisdiction(country?: string): JurisdictionInfo {
  if (!country || !country.trim()) return { jurisdiction: 'ohada' };
  const c = normalize(country);
  const candidates = [
    ...OHADA_COUNTRIES.map((e) => ({ ...e, jurisdiction: 'ohada' as const })),
    ...COMMON_LAW_COUNTRIES.map((e) => ({ ...e, jurisdiction: 'common_law' as const })),
  ].flatMap((e) => e.names.map((name) => ({ name, jurisdiction: e.jurisdiction, currency: e.currency })));
  // Mots entiers seulement (« niger » ne doit pas capter « nigeria »), et le nom
  // le plus long d'abord (« guinee equatoriale » avant « guinee »).
  candidates.sort((a, b) => b.name.length - a.name.length);
  const hit = candidates.find(({ name }) =>
    new RegExp(`(^|[^a-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(c)
  );
  if (hit) return { jurisdiction: hit.jurisdiction, currency: hit.currency };
  return { jurisdiction: 'civil_other' };
}
