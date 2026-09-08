/**
 * Juridiction comptable d'un projet, déduite de son pays.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ──────────────────────────────────────────────
 *
 * Le module financier imposait le SYSCOHADA — exercice obligatoirement calé sur
 * l'année civile — à TOUS les projets. C'est juste au Cameroun, au Sénégal ou
 * en Côte d'Ivoire ; c'est faux au Nigeria, au Kenya, en Afrique du Sud ou en
 * Égypte, où la société CHOISIT sa date de clôture, et où un exercice
 * « 2026-2027 » est la façon normale de nommer un exercice à cheval sur deux
 * années civiles. Le document interdisait donc, au nom de la conformité, la
 * seule écriture correcte dans la moitié du continent.
 *
 * ── CE QUE CE REGISTRE AFFIRME, ET CE QU'IL N'AFFIRME PAS ───────────────────
 *
 * Deux natures d'information cohabitent ici, et elles n'ont pas le même statut :
 *
 *  · le RÉFÉRENTIEL comptable et la RÈGLE D'EXERCICE sont structurels. Ils
 *    changent par traité ou par réforme majeure, à l'échelle de la décennie ;
 *    le code peut s'y appuyer.
 *  · le TAUX D'IMPÔT SUR LES SOCIÉTÉS est indicatif. Il bouge à chaque loi de
 *    finances. Il est daté (`taxAsOf`) et sert de VALEUR PAR DÉFAUT à la
 *    saisie, jamais d'affirmation : le rapport le présente comme un point de
 *    départ à confirmer, et l'utilisateur le remplace.
 *
 * Un pays absent du registre n'est pas une erreur : il retombe sur une
 * juridiction « non déterminée » qui n'impose rien et le dit.
 */

/** Référentiel comptable applicable. */
export type AccountingFramework =
  | 'syscohada'
  | 'ifrs'
  | 'cgnc-maroc'
  | 'sce-tunisie'
  | 'scf-algerie'
  | 'eas-egypte'
  | 'pgc-lusophone'
  | 'unknown';

/**
 * Régime de l'exercice comptable.
 *
 *  · `calendar-mandatory` : l'exercice DOIT courir du 1er janvier au
 *    31 décembre. C'est le cas OHADA (article 7 de l'Acte uniforme).
 *  · `calendar-default`   : l'année civile est la norme, une clôture
 *    différente reste possible sur autorisation ou par exception.
 *  · `free-choice`        : la société arrête librement sa date de clôture.
 *    Un exercice à cheval sur deux années civiles y est normal, et se nomme
 *    alors « 2026-2027 ».
 */
export type FiscalYearRule = 'calendar-mandatory' | 'calendar-default' | 'free-choice';

export interface AccountingJurisdiction {
  /** Code interne stable. */
  id: string;
  /** Pays, en français. */
  country: string;
  iso2: string;
  framework: AccountingFramework;
  /** Nom du référentiel tel qu'il doit être cité dans un document. */
  frameworkLabel: string;
  /** Traité ou texte qui fonde la règle d'exercice, cité tel quel. */
  fiscalYearBasis: string;
  fiscalYearRule: FiscalYearRule;
  /** Devise ISO 4217 par défaut. */
  currency: string;
  /** Taux d'IS INDICATIF, à confirmer. Absent quand il est trop incertain. */
  defaultCorporateTaxRatePct?: number;
  /** Année de référence du taux indicatif. */
  taxAsOf?: number;
  /** Appartenance à l'espace OHADA. */
  ohada: boolean;
}

/** Juridiction de repli : elle n'impose rien, et l'annonce. */
export const UNKNOWN_JURISDICTION: AccountingJurisdiction = {
  id: 'unknown',
  country: 'Non déterminé',
  iso2: '',
  framework: 'unknown',
  frameworkLabel: 'Référentiel comptable local',
  fiscalYearBasis: 'Réglementation comptable locale',
  // Ne rien imposer : l'année civile est le choix le plus courant, mais elle
  // n'est pas prescrite tant que le pays n'est pas connu.
  fiscalYearRule: 'calendar-default',
  currency: 'XAF',
  ohada: false,
};

const OHADA_BASIS =
  "Acte uniforme OHADA relatif au droit comptable et à l'information financière (AUDCIF), article 7";

/** Fabrique un état membre de l'OHADA : le régime y est identique partout. */
const ohada = (
  id: string,
  country: string,
  iso2: string,
  currency: string,
  defaultCorporateTaxRatePct?: number
): AccountingJurisdiction => ({
  id,
  country,
  iso2,
  framework: 'syscohada',
  frameworkLabel: 'SYSCOHADA révisé (Acte uniforme OHADA)',
  fiscalYearBasis: OHADA_BASIS,
  fiscalYearRule: 'calendar-mandatory',
  currency,
  defaultCorporateTaxRatePct,
  taxAsOf: defaultCorporateTaxRatePct ? 2025 : undefined,
  ohada: true,
});

/**
 * Les dix-sept États parties à l'OHADA.
 *
 * Devises : XOF pour l'UEMOA, XAF pour la CEMAC, monnaie nationale ailleurs.
 */
const OHADA_STATES: AccountingJurisdiction[] = [
  ohada('bj', 'Bénin', 'BJ', 'XOF', 30),
  ohada('bf', 'Burkina Faso', 'BF', 'XOF', 27.5),
  ohada('cm', 'Cameroun', 'CM', 'XAF', 33),
  ohada('cf', 'République centrafricaine', 'CF', 'XAF', 30),
  ohada('km', 'Comores', 'KM', 'KMF'),
  ohada('cg', 'Congo', 'CG', 'XAF', 28),
  ohada('ci', "Côte d'Ivoire", 'CI', 'XOF', 25),
  ohada('ga', 'Gabon', 'GA', 'XAF', 30),
  ohada('gn', 'Guinée', 'GN', 'GNF', 25),
  ohada('gw', 'Guinée-Bissau', 'GW', 'XOF', 25),
  ohada('gq', 'Guinée équatoriale', 'GQ', 'XAF', 35),
  ohada('ml', 'Mali', 'ML', 'XOF', 30),
  ohada('ne', 'Niger', 'NE', 'XOF', 30),
  ohada('cd', 'République démocratique du Congo', 'CD', 'CDF', 30),
  ohada('sn', 'Sénégal', 'SN', 'XOF', 30),
  ohada('td', 'Tchad', 'TD', 'XAF', 35),
  ohada('tg', 'Togo', 'TG', 'XOF', 27),
];

/**
 * Pays africains hors OHADA.
 *
 * La distinction qui compte ici n'est pas le référentiel — beaucoup appliquent
 * les IFRS — mais la RÈGLE D'EXERCICE : c'est elle qui décide si un document
 * peut nommer un exercice « 2026-2027 », et c'est elle que le module financier
 * imposait à tort.
 */
const OTHER_JURISDICTIONS: AccountingJurisdiction[] = [
  {
    id: 'ng', country: 'Nigeria', iso2: 'NG', framework: 'ifrs',
    frameworkLabel: 'IFRS (Financial Reporting Council of Nigeria)',
    fiscalYearBasis: 'Companies and Allied Matters Act — la société arrête sa date de clôture',
    fiscalYearRule: 'free-choice', currency: 'NGN',
    defaultCorporateTaxRatePct: 30, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'gh', country: 'Ghana', iso2: 'GH', framework: 'ifrs',
    frameworkLabel: 'IFRS (Institute of Chartered Accountants, Ghana)',
    fiscalYearBasis: "Companies Act — date de clôture choisie par la société",
    fiscalYearRule: 'free-choice', currency: 'GHS',
    defaultCorporateTaxRatePct: 25, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'ke', country: 'Kenya', iso2: 'KE', framework: 'ifrs',
    frameworkLabel: 'IFRS (ICPAK)',
    fiscalYearBasis: 'Companies Act — période comptable de douze mois librement arrêtée',
    fiscalYearRule: 'free-choice', currency: 'KES',
    defaultCorporateTaxRatePct: 30, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'za', country: 'Afrique du Sud', iso2: 'ZA', framework: 'ifrs',
    frameworkLabel: 'IFRS / IFRS for SMEs',
    fiscalYearBasis: 'Companies Act — fin d’exercice choisie par la société',
    fiscalYearRule: 'free-choice', currency: 'ZAR',
    defaultCorporateTaxRatePct: 27, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'tz', country: 'Tanzanie', iso2: 'TZ', framework: 'ifrs',
    frameworkLabel: 'IFRS (NBAA)',
    fiscalYearBasis: 'Companies Act — période comptable librement arrêtée',
    fiscalYearRule: 'free-choice', currency: 'TZS',
    defaultCorporateTaxRatePct: 30, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'ug', country: 'Ouganda', iso2: 'UG', framework: 'ifrs',
    frameworkLabel: 'IFRS (ICPAU)',
    fiscalYearBasis: 'Income Tax Act — exercice fiscal par défaut clos le 30 juin',
    fiscalYearRule: 'free-choice', currency: 'UGX',
    defaultCorporateTaxRatePct: 30, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'rw', country: 'Rwanda', iso2: 'RW', framework: 'ifrs',
    frameworkLabel: 'IFRS (ICPAR)',
    fiscalYearBasis: 'Loi sur l’impôt — année civile, dérogation possible sur autorisation',
    fiscalYearRule: 'calendar-default', currency: 'RWF',
    defaultCorporateTaxRatePct: 28, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'et', country: 'Éthiopie', iso2: 'ET', framework: 'ifrs',
    frameworkLabel: 'IFRS (AABE)',
    fiscalYearBasis: 'Exercice fiscal éthiopien : du 8 juillet au 7 juillet',
    fiscalYearRule: 'free-choice', currency: 'ETB',
    defaultCorporateTaxRatePct: 30, taxAsOf: 2025, ohada: false,
  },
  {
    id: 'ma', country: 'Maroc', iso2: 'MA', framework: 'cgnc-maroc',
    frameworkLabel: 'CGNC — Code général de normalisation comptable',
    fiscalYearBasis: 'Exercice de douze mois, année civile par défaut',
    fiscalYearRule: 'calendar-default', currency: 'MAD', ohada: false,
  },
  {
    id: 'tn', country: 'Tunisie', iso2: 'TN', framework: 'sce-tunisie',
    frameworkLabel: 'Système comptable des entreprises',
    fiscalYearBasis: 'Exercice de douze mois, année civile par défaut',
    fiscalYearRule: 'calendar-default', currency: 'TND', ohada: false,
  },
  {
    id: 'dz', country: 'Algérie', iso2: 'DZ', framework: 'scf-algerie',
    frameworkLabel: 'SCF — Système comptable financier',
    fiscalYearBasis: 'Exercice calé sur l’année civile',
    fiscalYearRule: 'calendar-mandatory', currency: 'DZD', ohada: false,
  },
  {
    id: 'eg', country: 'Égypte', iso2: 'EG', framework: 'eas-egypte',
    frameworkLabel: 'Egyptian Accounting Standards',
    fiscalYearBasis: 'Date de clôture arrêtée par les statuts',
    fiscalYearRule: 'free-choice', currency: 'EGP', ohada: false,
  },
  {
    id: 'ao', country: 'Angola', iso2: 'AO', framework: 'pgc-lusophone',
    frameworkLabel: 'PGC — Plano Geral de Contabilidade',
    fiscalYearBasis: 'Exercice calé sur l’année civile',
    fiscalYearRule: 'calendar-mandatory', currency: 'AOA', ohada: false,
  },
  {
    id: 'mz', country: 'Mozambique', iso2: 'MZ', framework: 'pgc-lusophone',
    frameworkLabel: 'PGC-NIRF',
    fiscalYearBasis: 'Exercice calé sur l’année civile',
    fiscalYearRule: 'calendar-mandatory', currency: 'MZN', ohada: false,
  },
];

export const JURISDICTIONS: AccountingJurisdiction[] = [...OHADA_STATES, ...OTHER_JURISDICTIONS];

/**
 * Alias de saisie. Le pays arrive d'un champ libre : il peut être écrit en
 * français, en anglais, avec ou sans accents, ou sous forme de code ISO.
 */
const ALIASES: Record<string, string> = {
  // OHADA
  benin: 'bj',
  'burkina faso': 'bf', burkina: 'bf',
  cameroun: 'cm', cameroon: 'cm',
  'republique centrafricaine': 'cf', centrafrique: 'cf', 'central african republic': 'cf', rca: 'cf',
  comores: 'km', comoros: 'km',
  congo: 'cg', 'republique du congo': 'cg', 'congo brazzaville': 'cg',
  "cote d'ivoire": 'ci', 'cote divoire': 'ci', 'ivory coast': 'ci',
  gabon: 'ga',
  guinee: 'gn', guinea: 'gn', 'guinee conakry': 'gn',
  'guinee bissau': 'gw', 'guinea bissau': 'gw',
  'guinee equatoriale': 'gq', 'equatorial guinea': 'gq',
  mali: 'ml',
  niger: 'ne',
  'republique democratique du congo': 'cd', rdc: 'cd', 'congo kinshasa': 'cd', 'dr congo': 'cd', 'drc': 'cd',
  senegal: 'sn',
  tchad: 'td', chad: 'td',
  togo: 'tg',
  // Hors OHADA
  nigeria: 'ng',
  ghana: 'gh',
  kenya: 'ke',
  'afrique du sud': 'za', 'south africa': 'za',
  tanzanie: 'tz', tanzania: 'tz',
  ouganda: 'ug', uganda: 'ug',
  rwanda: 'rw',
  ethiopie: 'et', ethiopia: 'et',
  maroc: 'ma', morocco: 'ma',
  tunisie: 'tn', tunisia: 'tn',
  algerie: 'dz', algeria: 'dz',
  egypte: 'eg', egypt: 'eg',
  angola: 'ao',
  mozambique: 'mz',
};

/** Normalise une saisie libre : minuscules, sans accents, espaces réduits. */
function normalize(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Table d'alias passée par le MÊME normaliseur que la saisie.
 *
 * Écrire les clés déjà normalisées à la main était une source d'écart
 * silencieux : « cote d'ivoire » normalise en « cote d ivoire » (l'apostrophe
 * devient une espace), alors que la clé écrite à la main disait
 * « cote divoire ». La saisie la plus naturelle du pays ne se résolvait donc
 * pas, sans que rien ne le signale. Le normaliseur est désormais la seule
 * autorité, des deux côtés de la comparaison.
 */
const NORMALIZED_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(ALIASES).map(([alias, id]) => [normalize(alias), id])
);

/**
 * Juridiction comptable d'un pays.
 *
 * Ne devine JAMAIS : un pays non reconnu renvoie la juridiction de repli, qui
 * n'impose aucune règle et le déclare. Inventer une conformité est le seul
 * échec que ce module doit rendre impossible.
 */
export function resolveJurisdiction(country: string | undefined | null): AccountingJurisdiction {
  const key = normalize(country || '');
  if (!key) return UNKNOWN_JURISDICTION;

  const byIso = JURISDICTIONS.find((j) => j.iso2.toLowerCase() === key);
  if (byIso) return byIso;

  const aliased = NORMALIZED_ALIASES[key];
  if (aliased) {
    const found = JURISDICTIONS.find((j) => j.id === aliased);
    if (found) return found;
  }

  // Saisie du type « Douala, Cameroun » ou « Republic of Kenya » : on cherche
  // un alias contenu dans la chaîne, en privilégiant le plus long pour que
  // « guinee equatoriale » ne se résolve pas en « guinee ».
  const contained = Object.keys(NORMALIZED_ALIASES)
    .filter((alias) => key.includes(alias))
    .sort((a, b) => b.length - a.length)[0];
  if (contained) {
    const found = JURISDICTIONS.find((j) => j.id === NORMALIZED_ALIASES[contained]);
    if (found) return found;
  }

  return UNKNOWN_JURISDICTION;
}

/** L'exercice doit-il être calé sur l'année civile ? */
export function requiresCalendarYear(jurisdiction: AccountingJurisdiction): boolean {
  return jurisdiction.fiscalYearRule === 'calendar-mandatory';
}

/**
 * Phrase de conformité à imprimer dans un document.
 *
 * C'est le seul endroit qui rédige cette règle : la dupliquer, c'est accepter
 * qu'une des copies survive à une réforme que l'autre a intégrée.
 */
export function fiscalYearStatement(
  jurisdiction: AccountingJurisdiction,
  endMonth: number
): string {
  const MONTHS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const endIndex = Math.min(11, Math.max(0, endMonth - 1));
  const end = `${LAST_DAY[endIndex]} ${MONTHS[endIndex]}`;
  const startMonth = MONTHS[endMonth % 12];

  switch (jurisdiction.fiscalYearRule) {
    case 'calendar-mandatory':
      return (
        `L'exercice court obligatoirement du 1ᵉʳ janvier au 31 décembre ` +
        `(${jurisdiction.frameworkLabel} — ${jurisdiction.fiscalYearBasis}), ` +
        `quelle que soit la date de démarrage effectif de l'activité.`
      );
    case 'calendar-default':
      // ⚠️ La phrase doit décrire l'exercice RÉELLEMENT retenu.
      //
      // Elle annonçait l'année civile quel que soit le mois de clôture saisi :
      // un projet marocain clôturant au 30 juin recevait donc un rapport dont
      // les tableaux disaient « 2026-2027 » et dont la note de conformité
      // disait « du 1er janvier au 31 décembre ». Une contradiction interne sur
      // la page qui établit la conformité est le pire endroit possible.
      return endMonth === 12
        ? `L'exercice est calé sur l'année civile, du 1ᵉʳ janvier au 31 décembre ` +
          `(${jurisdiction.frameworkLabel}), ce qui est la norme dans cette juridiction.`
        : `L'exercice court du 1ᵉʳ ${startMonth} au ${end} ` +
          `(${jurisdiction.frameworkLabel}). La norme locale étant l'année civile, ` +
          `cette date de clôture est dérogatoire et doit être justifiée.`;
    case 'free-choice':
    default:
      return endMonth === 12
        ? `L'exercice est arrêté au 31 décembre. ${jurisdiction.frameworkLabel} — ` +
          `${jurisdiction.fiscalYearBasis} : une autre date de clôture est admise.`
        : `L'exercice court du 1ᵉʳ ${startMonth} au ${end} ` +
          `(${jurisdiction.frameworkLabel} — ${jurisdiction.fiscalYearBasis}).`;
  }
}
