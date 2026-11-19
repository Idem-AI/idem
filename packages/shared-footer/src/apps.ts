/**
 * Ce que chaque pied de page contient.
 *
 * Le pied de page de la landing est la référence : brand + promesse + réseaux
 * d'un côté, trois colonnes de liens de l'autre, puis une ligne de signature
 * qui porte les textes juridiques. Les autres applications ont le même, avec
 * leurs colonnes — pas un pied de page différent.
 *
 * Les adresses inter-applications viennent du `services` que l'hôte passe (son
 * `environment`), pour que le pied de page marche aussi en développement. Ce
 * qu'il ne passe pas retombe sur l'adresse de production : un lien absent est
 * pire qu'un lien qui sort du local.
 */

// La définition d'IDEM vient de la source unique de la marque. Le pied de page
// la lit, il ne la recopie pas : les copies ont vieilli séparément une fois
// déjà (« la première plateforme d'IA souveraine et open source d'Afrique »).
import { DEFINITION } from '@idem/shared-seo/ecosystem';

import {
  footerLegalDocs,
  legalUrl,
  type Bilingual,
  type FooterLocale,
  type LegalDoc,
  type LegalScope,
} from './legal';

/** Les applications qui ont un pied de page. */
export type FooterApp = 'idem' | 'icode' | 'ideploy' | 'ivision' | 'idomain' | 'isimulator';

/** Les adresses des services IDEM, telles que les `environment` les portent. */
export interface FooterServices {
  landing?: string;
  dashboard?: string;
  icode?: string;
  ideploy?: string;
  ivision?: string;
  idomain?: string;
  simulator?: string;
}

/** Les adresses de production, servies quand l'hôte n'en donne pas. */
export const DEFAULT_SERVICES: Required<FooterServices> = {
  landing: 'https://idem.africa',
  dashboard: 'https://console.idem.africa',
  icode: 'https://appgen.idem.africa',
  ideploy: 'https://ideploy.idem.africa',
  ivision: 'https://ivision.idem.africa',
  idomain: 'https://idomain.idem.africa',
  simulator: 'https://simulator.idem.africa',
};

/** Le dépôt public, cité par la licence et la colonne « Ressources ». */
export const GITHUB_ORG_URL = 'https://github.com/Idem-AI';
export const LICENSE_URL = 'https://github.com/Idem-AI/idem/blob/main/LICENSE';

/** Un lien résolu, prêt à être rendu. */
export interface ResolvedLink {
  readonly label: string;
  readonly href: string;
  /** Vrai quand le lien quitte l'application : le rendu l'ouvre dans un onglet. */
  readonly external: boolean;
}

/** Une colonne du pied de page. */
export interface ResolvedColumn {
  readonly id: string;
  readonly title: string;
  readonly links: readonly ResolvedLink[];
}

/** Un réseau social, avec la classe d'icône PrimeIcons que les apps chargent. */
export interface SocialLink {
  readonly id: string;
  readonly url: string;
  readonly icon: string;
  readonly label: string;
}

/** Tout ce dont un rendu a besoin. Aucune logique ne reste dans la vue. */
export interface ResolvedFooter {
  readonly app: FooterApp;
  readonly locale: FooterLocale;
  readonly tagline: string;
  readonly claim: string;
  readonly columns: readonly ResolvedColumn[];
  readonly legal: readonly ResolvedLink[];
  readonly social: readonly SocialLink[];
  readonly licenseLabel: string;
  readonly licenseUrl: string;
  readonly year: number;
}

// ── Les textes du pied de page ──────────────────────────────────────────────

const SOCIAL: readonly { id: string; url: string; icon: string }[] = [
  { id: 'github', url: GITHUB_ORG_URL, icon: 'pi pi-github' },
  { id: 'linkedin', url: 'https://www.linkedin.com/company/idemafrica', icon: 'pi pi-linkedin' },
  { id: 'x', url: 'https://x.com/idem_ai', icon: 'pi pi-twitter' },
  { id: 'instagram', url: 'https://www.instagram.com/idemafrica/', icon: 'pi pi-instagram' },
  {
    id: 'facebook',
    url: 'https://www.facebook.com/profile.php?id=61580303204333',
    icon: 'pi pi-facebook',
  },
];

const SOCIAL_LABEL: Bilingual = { fr: 'IDEM sur', en: 'IDEM on' };

const COLUMN_TITLES: Record<string, Bilingual> = {
  product: { fr: 'Produit', en: 'Product' },
  service: { fr: 'Le service', en: 'The service' },
  platform: { fr: 'La plateforme IDEM', en: 'The IDEM platform' },
  resources: { fr: 'Ressources', en: 'Resources' },
  company: { fr: 'Entreprise', en: 'Company' },
};

const LABELS: Record<string, Bilingual> = {
  icode: { fr: 'iCode', en: 'iCode' },
  ideploy: { fr: 'iDeploy', en: 'iDeploy' },
  ivision: { fr: 'iVision', en: 'iVision' },
  idomain: { fr: 'iDomain', en: 'iDomain' },
  simulator: { fr: 'Simulateur IDEM', en: 'IDEM Simulator' },
  pricing: { fr: 'Tarifs', en: 'Pricing' },
  console: { fr: 'Tableau de bord', en: 'Dashboard' },
  signup: { fr: 'Créer un compte', en: 'Create an account' },
  login: { fr: 'Se connecter', en: 'Sign in' },
  blog: { fr: 'Blog', en: 'Blog' },
  openSource: { fr: 'Open source', en: 'Open source' },
  builders: { fr: 'Idem Builders', en: 'Idem Builders' },
  github: { fr: 'Le code sur GitHub', en: 'Code on GitHub' },
  beta: { fr: 'Programme bêta', en: 'Beta programme' },
  about: { fr: 'À propos', en: 'About' },
  market: { fr: 'Marché africain', en: 'African market' },
  contact: { fr: 'Contact', en: 'Contact' },
  idemAfrica: { fr: 'idem.africa', en: 'idem.africa' },
};

/**
 * La phrase sous le logo : ce que fait l'application, puis ce qu'est IDEM.
 *
 * La seconde moitié n'est jamais écrite ici : elle vient de `DEFINITION`.
 */
const SERVICE_LINE: Record<Exclude<FooterApp, 'idem'>, Bilingual> = {
  icode: {
    fr: 'iCode écrit le site ou l’application de votre projet, puis le met en ligne.',
    en: 'iCode writes your project’s website or app, then puts it online.',
  },
  ideploy: {
    fr: 'iDeploy héberge vos applications et vos bases de données, sur une infrastructure que nous opérons.',
    en: 'iDeploy hosts your applications and databases on infrastructure we operate.',
  },
  ivision: {
    fr: 'iVision transforme une phrase en vidéo, en visuel et en site.',
    en: 'iVision turns a sentence into a video, a visual and a site.',
  },
  idomain: {
    fr: 'iDomain achète et renouvelle vos noms de domaine, payables en mobile money.',
    en: 'iDomain buys and renews your domain names, payable by mobile money.',
  },
  isimulator: {
    fr: 'Le simulateur IDEM éprouve un business plan avant que le marché ne s’en charge.',
    en: 'The IDEM simulator stress-tests a business plan before the market does.',
  },
};

/** Ce qui suit la phrase du service : « Un service d'IDEM, <définition>. » */
const BY_IDEM: Bilingual = {
  fr: 'Un service d’IDEM,',
  en: 'A service of IDEM,',
};

/**
 * La phrase complète d'une application.
 *
 * Pour IDEM, c'est la définition seule — avec le pays, parce que le pied de
 * page est le seul endroit de la page qui dise où l'entreprise est établie.
 */
function taglineOf(app: FooterApp, locale: FooterLocale): string {
  if (app === 'idem') {
    return locale === 'fr'
      ? `${DEFINITION.fr}. Conçue au Cameroun, pour toute l’Afrique.`
      : `${DEFINITION.en}. Built in Cameroon, for the whole of Africa.`;
  }
  const definition = locale === 'fr' ? DEFINITION.fr : DEFINITION.en;
  // La définition est une phrase à elle : en apposition, elle commence en
  // minuscule, sinon la ligne porte deux majuscules au milieu.
  const lowered = definition.charAt(0).toLowerCase() + definition.slice(1);
  return `${SERVICE_LINE[app][locale]} ${BY_IDEM[locale]} ${lowered}.`;
}

const CLAIM: Bilingual = {
  fr: 'Africain, toi aussi tu peux construire',
  en: 'African, you too can build',
};

const LICENSE_LABEL: Bilingual = {
  fr: 'Licence Apache 2.0 (Commons Clause)',
  en: 'Apache 2.0 licence (Commons Clause)',
};

// ── La structure, par application ───────────────────────────────────────────

/**
 * Une colonne décrite : les liens pointent un service et un chemin, parce que
 * l'adresse dépend de l'hôte, jamais de la colonne.
 */
interface ColumnSpec {
  readonly id: keyof typeof COLUMN_TITLES;
  readonly links: readonly {
    readonly label: keyof typeof LABELS;
    readonly service: keyof FooterServices;
    readonly path?: string;
    /** `true` quand le chemin est servi par l'application hôte elle-même. */
    readonly self?: boolean;
    readonly raw?: string;
  }[];
}

/** La landing, et les trois colonnes dont les autres héritent la forme. */
const IDEM_COLUMNS: readonly ColumnSpec[] = [
  {
    id: 'product',
    links: [
      { label: 'icode', service: 'landing', path: '/idev', self: true },
      { label: 'ideploy', service: 'landing', path: '/ideploy', self: true },
      { label: 'ivision', service: 'ivision' },
      { label: 'idomain', service: 'idomain' },
      { label: 'simulator', service: 'landing', path: '/simulator', self: true },
      { label: 'pricing', service: 'landing', path: '/pricing', self: true },
    ],
  },
  {
    id: 'resources',
    links: [
      { label: 'blog', service: 'landing', path: '/blog', self: true },
      { label: 'openSource', service: 'landing', path: '/open-source', self: true },
      { label: 'builders', service: 'landing', path: '/builders', self: true },
      { label: 'github', service: 'landing', raw: GITHUB_ORG_URL },
      { label: 'beta', service: 'landing', path: '/premium-beta', self: true },
    ],
  },
  {
    id: 'company',
    links: [
      { label: 'about', service: 'landing', path: '/about', self: true },
      { label: 'market', service: 'landing', path: '/african-market', self: true },
      { label: 'contact', service: 'landing', path: '/contact', self: true },
    ],
  },
];

/** Les colonnes d'un service : le service, la plateforme, puis l'entreprise. */
function serviceColumns(app: Exclude<FooterApp, 'idem'>, pricingPath: string): ColumnSpec[] {
  const siblings: Record<string, { label: keyof typeof LABELS; service: keyof FooterServices }[]> =
    {
      icode: [
        { label: 'ideploy', service: 'ideploy' },
        { label: 'ivision', service: 'ivision' },
        { label: 'idomain', service: 'idomain' },
      ],
      ideploy: [
        { label: 'icode', service: 'icode' },
        { label: 'idomain', service: 'idomain' },
        { label: 'ivision', service: 'ivision' },
      ],
      ivision: [
        { label: 'icode', service: 'icode' },
        { label: 'ideploy', service: 'ideploy' },
        { label: 'idomain', service: 'idomain' },
      ],
      idomain: [
        { label: 'ideploy', service: 'ideploy' },
        { label: 'icode', service: 'icode' },
        { label: 'ivision', service: 'ivision' },
      ],
      isimulator: [
        { label: 'icode', service: 'icode' },
        { label: 'ivision', service: 'ivision' },
        { label: 'ideploy', service: 'ideploy' },
      ],
    };

  return [
    {
      id: 'service',
      links: [
        { label: 'pricing', service: 'landing', path: pricingPath, self: true },
        { label: 'signup', service: 'dashboard', path: '/register' },
        { label: 'login', service: 'dashboard', path: '/login' },
        { label: 'console', service: 'dashboard' },
      ],
    },
    {
      id: 'platform',
      links: [
        { label: 'idemAfrica', service: 'landing' },
        ...siblings[app],
        { label: 'simulator', service: 'simulator' },
      ],
    },
    {
      id: 'company',
      links: [
        { label: 'about', service: 'landing', path: '/about' },
        { label: 'blog', service: 'landing', path: '/blog' },
        { label: 'github', service: 'landing', raw: GITHUB_ORG_URL },
        { label: 'contact', service: 'landing', path: '/contact' },
      ],
    },
  ];
}

const COLUMNS: Record<FooterApp, readonly ColumnSpec[]> = {
  idem: IDEM_COLUMNS,
  icode: serviceColumns('icode', '/pricing'),
  ideploy: serviceColumns('ideploy', '/pricing'),
  ivision: serviceColumns('ivision', '/pricing'),
  idomain: serviceColumns('idomain', '/pricing'),
  isimulator: serviceColumns('isimulator', '/pricing'),
};

/** Le périmètre juridique d'une application : son complément, plus le global. */
const SCOPE: Record<FooterApp, LegalScope> = {
  idem: 'global',
  icode: 'icode',
  ideploy: 'ideploy',
  ivision: 'ivision',
  idomain: 'idomain',
  isimulator: 'isimulator',
};

export interface ResolveFooterOptions {
  readonly locale?: FooterLocale;
  readonly services?: FooterServices;
  /**
   * `true` pour la landing, qui sert elle-même les pages juridiques et les
   * colonnes : les liens restent relatifs, le routeur les prend en charge.
   */
  readonly selfHosted?: boolean;
  /** L'année de la ligne de signature. Injectable pour les tests. */
  readonly year?: number;
}

/**
 * Résout tout le pied de page d'une application.
 *
 * @example
 * ```ts
 * resolveFooter('ideploy', { locale: 'fr', services: environment.services });
 * ```
 */
export function resolveFooter(app: FooterApp, options: ResolveFooterOptions = {}): ResolvedFooter {
  const locale: FooterLocale = options.locale === 'en' ? 'en' : 'fr';
  const services = { ...DEFAULT_SERVICES, ...stripEmpty(options.services) };
  const selfHosted = options.selfHosted === true;
  const landingUrl = selfHosted ? undefined : services.landing;

  const columns = COLUMNS[app].map<ResolvedColumn>((column) => ({
    id: column.id,
    title: COLUMN_TITLES[column.id][locale],
    links: column.links.map<ResolvedLink>((link) => {
      if (link.raw) return { label: LABELS[link.label][locale], href: link.raw, external: true };
      const sameApp = selfHosted && link.self === true;
      const base = sameApp ? '' : trimSlash(services[link.service] ?? DEFAULT_SERVICES.landing);
      return {
        label: LABELS[link.label][locale],
        href: `${base}${link.path ?? (sameApp ? '/' : '')}`,
        external: !sameApp,
      };
    }),
  }));

  const legal = footerLegalDocs(SCOPE[app]).map<ResolvedLink>((doc: LegalDoc) => ({
    label: doc.label[locale],
    href: legalUrl(doc, { landingUrl, locale }),
    external: !selfHosted,
  }));

  return {
    app,
    locale,
    tagline: taglineOf(app, locale),
    claim: CLAIM[locale],
    columns,
    legal,
    social: SOCIAL.map((entry) => ({
      ...entry,
      label: `${SOCIAL_LABEL[locale]} ${entry.id === 'x' ? 'X' : capitalise(entry.id)}`,
    })),
    licenseLabel: LICENSE_LABEL[locale],
    licenseUrl: LICENSE_URL,
    year: options.year ?? new Date().getFullYear(),
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Une adresse vide dans un `environment` ne doit pas masquer la production. */
function stripEmpty(services: FooterServices | undefined): FooterServices {
  if (!services) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(services)) {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out as FooterServices;
}
