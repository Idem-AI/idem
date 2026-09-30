/**
 * L'écosystème IDEM, tel que les moteurs de recherche doivent le comprendre.
 *
 * IDEM n'est pas une suite d'outils sans lien : c'est UN produit — créer et
 * lancer un business rentable — dont chaque service tient une étape. Chaque
 * service vit sur son propre domaine et peut servir seul, mais tous
 * appartiennent au même parcours. Ce fichier est l'unique endroit où ce
 * rapport est écrit ; le landing, les en-têtes des applications, les graphes
 * JSON-LD et les images de partage le lisent tous ici.
 *
 * Changer un nom, une adresse ou une phrase de positionnement : ici, puis
 * `npm run seo:sync` à la racine pour réécrire les en-têtes des applications.
 */

export type SeoLocale = 'fr' | 'en';

/** Les langues servies. L'anglais est la langue par défaut (`x-default`). */
export const SEO_LOCALES: readonly SeoLocale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: SeoLocale = 'en';

/** Le code Open Graph de chaque langue. */
export const OG_LOCALE: Record<SeoLocale, string> = { fr: 'fr_FR', en: 'en_US' };

export type Localized = Record<SeoLocale, string>;

/** L'organisation. Les profils sont ceux du pied de page du landing. */
export const IDEM = {
  name: 'IDEM',
  legalName: 'IDEM',
  url: 'https://idem.africa',
  /** Logo carré sur fond de marque : lisible sur le fond blanc de Google. */
  logo: 'https://idem.africa/assets/icons/idem-mark-512.png',
  foundingDate: '2024',
  foundingCountry: 'CM',
  email: 'contact@idem.africa',
  twitter: '@idem_ai',
  sameAs: [
    'https://www.linkedin.com/company/idemafrica',
    'https://x.com/idem_ai',
    'https://www.instagram.com/idemafrica/',
    'https://www.facebook.com/profile.php?id=61580303204333',
    'https://github.com/Idem-AI',
  ],
  /** Couleur de marque (`--color-primary-500`) : barre d'adresse mobile, tuiles. */
  themeColor: '#1447e6',
} as const;

/**
 * La promesse. C'est le message principal d'IDEM, partout : on ne vend pas
 * un outil pour créer une entreprise, on aide à créer et lancer un business
 * qui rapporte.
 */
export const PROMISE: Localized = {
  fr: 'Créer et lancer un business rentable',
  en: 'Build and launch a profitable business',
};

/** La promesse développée, pour les descriptions longues. */
export const PROMISE_LONG: Localized = {
  fr:
    "IDEM vous aide à créer et lancer un business rentable : business plan et prévisions financières, " +
    'test de viabilité avant d’investir, marque, papiers, application et mise en ligne. ' +
    'Chaque service marche seul ; ensemble, ils mènent de l’idée aux premiers clients.',
  en:
    'IDEM helps you build and launch a profitable business: business plan and financial forecasts, ' +
    'a viability test before you invest, brand, legal papers, app and go-live. ' +
    'Each service works on its own; together they take you from idea to first customers.',
};

export type ServiceId = 'business' | 'simulator' | 'icode' | 'ideploy';

export interface EcosystemService {
  id: ServiceId;
  /** Nom commercial, identique dans toutes les langues. */
  name: string;
  /** Racine publique de l'application. */
  url: string;
  /** Page de présentation sur le landing (chemin sans langue), `''` = accueil. */
  landingPath: string;
  /** Rang dans le parcours IDEM (1 = première étape). */
  step: number;
  /** Catégorie schema.org. */
  category: 'BusinessApplication' | 'DeveloperApplication';
  /** Ce que fait le service, en trois ou quatre mots : l'étape du parcours. */
  role: Localized;
  /** Titre de page (`<title>`), sans le suffixe de marque. */
  title: Localized;
  /** Méta-description : 140–160 caractères, la promesse du service. */
  description: Localized;
  /** Ce que le service apporte au business, pour le JSON-LD. */
  features: Record<SeoLocale, readonly string[]>;
}

/**
 * Les services, dans l'ordre du parcours : on construit le business, on le
 * teste, on bâtit son application, on la met en ligne.
 */
export const SERVICES: Record<ServiceId, EcosystemService> = {
  business: {
    id: 'business',
    name: 'IDEM Business',
    url: 'https://console.idem.africa',
    landingPath: '',
    step: 1,
    category: 'BusinessApplication',
    role: { fr: 'Construire le business', en: 'Build the business' },
    title: {
      fr: 'IDEM Business — Business plan, marque et papiers',
      en: 'IDEM Business — Business plan, brand and legal papers',
    },
    description: {
      fr: 'De l’idée au business rentable : business plan SYSCOHADA, prévisions financières, marque, statuts OHADA et pitch deck, prêts à montrer à une banque.',
      en: 'From idea to profitable business: a bank-ready business plan, financial forecasts, brand identity, legal papers and a pitch deck, built with you.',
    },
    features: {
      fr: [
        'Business plan conforme SYSCOHADA',
        'Prévisions financières sur trois ans',
        'Identité de marque et logo',
        'Statuts et documents juridiques OHADA',
        'Pitch deck investisseur',
        'Stratégie de communication',
      ],
      en: [
        'Bank-ready business plan',
        'Three-year financial forecasts',
        'Brand identity and logo',
        'Legal documents',
        'Investor pitch deck',
        'Communication strategy',
      ],
    },
  },
  simulator: {
    id: 'simulator',
    name: 'IDEM Simulator',
    url: 'https://simulator.idem.africa',
    landingPath: '/simulator',
    step: 2,
    category: 'BusinessApplication',
    role: { fr: 'Tester la rentabilité', en: 'Test profitability' },
    title: {
      fr: 'IDEM Simulator — Testez la rentabilité avant de lancer',
      en: 'IDEM Simulator — Test profitability before you launch',
    },
    description: {
      fr: 'Mettez votre business à l’épreuve avant d’investir : scénarios, stress tests, points de rupture et conditions de rentabilité, dans un rapport clair.',
      en: 'Put your business to the test before you invest: scenarios, stress tests, breaking points and the conditions it needs to be profitable, in one clear report.',
    },
    features: {
      fr: [
        'Recherche des facteurs propres au secteur',
        'Scénarios de base, favorable et défavorable',
        'Stress tests et scénarios extrêmes',
        'Indice de viabilité avec niveau de confiance',
        'Conditions de rentabilité',
        'Recommandations priorisées',
      ],
      en: [
        'Sector-aware factor research',
        'Baseline, favourable and adverse scenarios',
        'Stress tests and extreme scenarios',
        'Viability index with a confidence level',
        'Conditions for profitability',
        'Prioritised recommendations',
      ],
    },
  },
  icode: {
    id: 'icode',
    name: 'iCode',
    url: 'https://appgen.idem.africa',
    landingPath: '/idev',
    step: 3,
    category: 'DeveloperApplication',
    role: { fr: 'Bâtir l’application', en: 'Build the app' },
    title: {
      fr: 'iCode — Le site de votre business, écrit par l’IA',
      en: 'iCode — Your business website, written by AI',
    },
    description: {
      fr: 'Décrivez votre idée, iCode écrit le site ou l’application de votre business : aperçu en direct, édition visuelle, code React propre et mise en ligne avec iDeploy.',
      en: 'Describe your idea and iCode writes your business’s website or app: live preview, visual editing, clean React code and one-step go-live with iDeploy.',
    },
    features: {
      fr: [
        'Génération de code par IA',
        'Aperçu en direct',
        'Édition visuelle',
        'Code React exportable',
        'Mise en ligne avec iDeploy',
      ],
      en: [
        'AI code generation',
        'Live preview',
        'Visual editing',
        'Exportable React code',
        'Go-live with iDeploy',
      ],
    },
  },
  ideploy: {
    id: 'ideploy',
    name: 'iDeploy',
    url: 'https://ideploy.idem.africa',
    landingPath: '/ideploy',
    step: 4,
    category: 'DeveloperApplication',
    role: { fr: 'Mettre en ligne', en: 'Go live' },
    title: {
      fr: 'iDeploy — Votre business en ligne, hébergé en Afrique',
      en: 'iDeploy — Put your business online, hosted in Africa',
    },
    description: {
      fr: 'Mettez votre site ou votre application en ligne en un clic : domaine, certificat de sécurité, suivi et hébergement souverain en Afrique, sans DevOps.',
      en: 'Put your website or app online in one click: domain, security certificate, monitoring and sovereign hosting in Africa, no DevOps required.',
    },
    features: {
      fr: [
        'Mise en ligne en un clic',
        'Domaine personnalisé et certificat SSL',
        'Serveur personnel ou cloud géré',
        'Journaux et métriques en direct',
        'Hébergement souverain en Afrique',
      ],
      en: [
        'One-click deployment',
        'Custom domain and SSL certificate',
        'Your own server or managed cloud',
        'Live logs and metrics',
        'Sovereign hosting in Africa',
      ],
    },
  },
};

/** Les services dans l'ordre du parcours. */
export const WORKFLOW: readonly EcosystemService[] = Object.values(SERVICES).sort(
  (a, b) => a.step - b.step,
);

/** Le titre complet d'une page : « Titre | IDEM », sauf s'il nomme déjà IDEM. */
export function brandedTitle(title: string): string {
  return /\bIDEM\b/.test(title) ? title : `${title} | IDEM`;
}
