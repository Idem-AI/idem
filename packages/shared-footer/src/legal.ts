/**
 * Le registre des textes juridiques d'IDEM.
 *
 * Une seule liste, pour deux usages qui dérivaient jusqu'ici l'un de l'autre :
 *
 *  - la **landing** y lit ses routes (`apps/landing/src/app/app.routes.ts`) et
 *    le contenu de chaque page (`apps/landing/src/app/shared/legal/`) ;
 *  - **chaque application** y lit les liens de son pied de page.
 *
 * Les textes sont servis par la landing, à une seule adresse. Une application
 * qui les recopierait aurait sa propre version du jour où la politique change :
 * c'est exactement ce qu'un texte juridique ne supporte pas. `npm run
 * check:footer` échoue si un document déclaré ici n'a pas de route, ou si une
 * route juridique de la landing n'est pas déclarée ici.
 */

/** Le service auquel un texte s'applique. `global` = tout IDEM. */
export type LegalScope =
  | 'global'
  | 'idem'
  | 'icode'
  | 'ideploy'
  | 'ivision'
  | 'idomain'
  | 'isimulator'
  | 'builders';

/** La nature du texte, qui décide de la colonne où il apparaît. */
export type LegalKind = 'privacy' | 'terms' | 'cookies' | 'processors' | 'account';

/** Les deux langues servies par la landing. */
export type FooterLocale = 'fr' | 'en';

/** Un libellé dans les deux langues. */
export interface Bilingual {
  readonly fr: string;
  readonly en: string;
}

export interface LegalDoc {
  /** Identifiant stable, utilisé comme clé de contenu et de route. */
  readonly id: string;
  /** Chemin servi par la landing, sans préfixe de langue, avec la barre de tête. */
  readonly path: string;
  readonly scope: LegalScope;
  readonly kind: LegalKind;
  /** Titre tel qu'il apparaît dans un pied de page. */
  readonly label: Bilingual;
  /**
   * `true` quand le document est propre à un service et s'ajoute au texte
   * global sans le remplacer : le pied de page le dit (« complément »).
   */
  readonly addendum?: boolean;
}

/**
 * Tous les textes juridiques publiés.
 *
 * L'ordre compte : il est repris tel quel dans la colonne « Légal » du pied de
 * page, le texte global d'abord, le complément du service ensuite.
 */
export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    id: 'privacy-policy',
    path: '/privacy-policy',
    scope: 'global',
    kind: 'privacy',
    label: { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
  },
  {
    id: 'terms-of-service',
    path: '/terms-of-service',
    scope: 'global',
    kind: 'terms',
    label: { fr: "Conditions d'utilisation", en: 'Terms of Service' },
  },
  {
    id: 'cookie-policy',
    path: '/cookie-policy',
    scope: 'global',
    kind: 'cookies',
    label: { fr: 'Cookies et traceurs', en: 'Cookies and trackers' },
  },
  {
    id: 'subprocessors',
    path: '/subprocessors',
    scope: 'global',
    kind: 'processors',
    label: { fr: 'Sous-traitants', en: 'Sub-processors' },
  },
  {
    id: 'delete-account',
    path: '/delete-account',
    scope: 'global',
    kind: 'account',
    label: { fr: 'Supprimer mon compte', en: 'Delete my account' },
  },

  // ── Compléments par service ───────────────────────────────────────────────
  {
    id: 'icode-privacy',
    path: '/privacy/icode',
    scope: 'icode',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité iCode', en: 'iCode privacy' },
  },
  {
    id: 'icode-terms',
    path: '/terms/icode',
    scope: 'icode',
    kind: 'terms',
    addendum: true,
    label: { fr: "Règles d'utilisation iCode", en: 'iCode usage rules' },
  },
  {
    id: 'ideploy-privacy',
    path: '/privacy/ideploy',
    scope: 'ideploy',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité iDeploy', en: 'iDeploy privacy' },
  },
  {
    id: 'ideploy-terms',
    path: '/terms/ideploy',
    scope: 'ideploy',
    kind: 'terms',
    addendum: true,
    label: { fr: "Règles d'hébergement iDeploy", en: 'iDeploy hosting rules' },
  },
  {
    id: 'ivision-privacy',
    path: '/privacy/ivision',
    scope: 'ivision',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité iVision', en: 'iVision privacy' },
  },
  {
    id: 'ivision-terms',
    path: '/terms/ivision',
    scope: 'ivision',
    kind: 'terms',
    addendum: true,
    label: { fr: "Règles d'utilisation iVision", en: 'iVision usage rules' },
  },
  {
    id: 'idomain-privacy',
    path: '/privacy/idomain',
    scope: 'idomain',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité iDomain', en: 'iDomain privacy' },
  },
  {
    id: 'idomain-terms',
    path: '/terms/idomain',
    scope: 'idomain',
    kind: 'terms',
    addendum: true,
    label: { fr: "Règles d'enregistrement iDomain", en: 'iDomain registration rules' },
  },
  {
    id: 'isimulator-privacy',
    path: '/privacy/simulator',
    scope: 'isimulator',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité du simulateur', en: 'Simulator privacy' },
  },
  {
    id: 'simulation-terms',
    path: '/simulation-terms',
    scope: 'isimulator',
    kind: 'terms',
    addendum: true,
    label: { fr: 'Conditions de la simulation', en: 'Simulation terms' },
  },
  {
    id: 'builders-privacy',
    path: '/builders-privacy',
    scope: 'builders',
    kind: 'privacy',
    addendum: true,
    label: { fr: 'Confidentialité Idem Builders', en: 'Idem Builders privacy' },
  },
  {
    id: 'builders-terms',
    path: '/builders-terms',
    scope: 'builders',
    kind: 'terms',
    addendum: true,
    label: { fr: 'Conditions Idem Builders', en: 'Idem Builders terms' },
  },
  {
    id: 'beta-policy',
    path: '/beta-policy',
    scope: 'global',
    kind: 'terms',
    addendum: true,
    label: { fr: 'Programme bêta', en: 'Beta programme' },
  },
];

/** Index par identifiant, pour une lecture directe. */
export const LEGAL_DOC_BY_ID: Readonly<Record<string, LegalDoc>> = Object.freeze(
  Object.fromEntries(LEGAL_DOCS.map((doc) => [doc.id, doc]))
);

/**
 * Les textes qu'un service affiche : les textes globaux, puis les siens.
 *
 * `beta-policy`, `builders-*` et `delete-account` ne tiennent pas dans un pied
 * de page de service — ils y sont donc exclus, et restent atteignables depuis
 * la landing et le compte.
 */
const FOOTER_EXCLUDED = new Set(['beta-policy', 'builders-privacy', 'builders-terms']);

export function footerLegalDocs(scope: LegalScope): LegalDoc[] {
  const relevant = LEGAL_DOCS.filter(
    (doc) => !FOOTER_EXCLUDED.has(doc.id) && (doc.scope === 'global' || doc.scope === scope)
  );
  // Les textes globaux d'abord : c'est la hiérarchie réelle, un complément ne
  // se lit pas sans le texte qu'il complète.
  return [
    ...relevant.filter((doc) => doc.scope === 'global'),
    ...relevant.filter((doc) => doc.scope !== 'global'),
  ];
}

/** Les documents propres à un service (ses compléments), dans l'ordre. */
export function addendumDocs(scope: LegalScope): LegalDoc[] {
  return LEGAL_DOCS.filter((doc) => doc.scope === scope && doc.addendum === true);
}

/**
 * L'adresse publique d'un texte.
 *
 * Sans `landingUrl`, le chemin est rendu tel quel : c'est le cas de la landing
 * elle-même, qui sert déjà ses pages sous le préfixe de langue de sa base. Avec
 * `landingUrl`, l'adresse est absolue et porte la langue, parce qu'une autre
 * application n'a aucun moyen de la deviner.
 */
export function legalUrl(
  doc: LegalDoc,
  options: { landingUrl?: string; locale?: FooterLocale } = {}
): string {
  const { landingUrl, locale = 'fr' } = options;
  if (!landingUrl) return doc.path;
  return `${landingUrl.replace(/\/+$/, '')}/${locale}${doc.path}`;
}
