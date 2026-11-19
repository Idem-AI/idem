/**
 * Les textes juridiques d'IDEM, écrits une fois, dans les deux langues.
 *
 * ## Pourquoi pas `$localize` ici
 *
 * Le reste de la landing passe par `$localize` : l'anglais vit dans le code,
 * le français dans `src/locale/fr/**`. C'est tenable pour une page produit —
 * quelques dizaines de phrases courtes. Une politique de confidentialité en
 * compte plusieurs centaines, et un texte juridique se relit *en regard* de sa
 * traduction : une phrase française séparée de sa phrase anglaise par deux
 * fichiers, c'est la garantie qu'elles finiront par dire deux choses
 * différentes. Le jour où un juriste relit, il doit voir les deux côte à côte.
 *
 * Les deux langues vivent donc dans le même fichier, et la page choisit selon
 * `LOCALE_ID`. Les pages juridiques sont chargées à la demande : la langue non
 * servie ne coûte rien aux autres pages.
 */

/** Une phrase dans les deux langues. L'ordre français d'abord est délibéré : */
/** l'entreprise est camerounaise et rédige en français. */
export interface T {
  readonly fr: string;
  readonly en: string;
}

export type LegalLocale = 'fr' | 'en';

export interface ContentListItem {
  readonly strong?: T;
  readonly text: T;
  /** Un renvoi vers un autre texte, rendu en fin de puce. */
  readonly link?: { readonly label: T; readonly href: string };
}

export interface ContentTable {
  readonly caption?: T;
  readonly headers: readonly T[];
  readonly rows: readonly (readonly T[])[];
}

export interface ContentWarning {
  readonly type: 'info' | 'warning' | 'error';
  readonly title: T;
  readonly content: T;
  readonly icon?: string;
}

export interface ContentSubsection {
  readonly id?: string;
  readonly title: T;
  readonly paragraphs: readonly T[];
  readonly list?: readonly ContentListItem[];
  readonly table?: ContentTable;
}

export interface ContentSection {
  /** Ancre de la section, reprise dans le sommaire. */
  readonly id: string;
  readonly title: T;
  readonly paragraphs?: readonly T[];
  readonly list?: readonly ContentListItem[];
  readonly table?: ContentTable;
  readonly warning?: ContentWarning;
  readonly subsections?: readonly ContentSubsection[];
}

export interface LegalDocContent {
  /** L'identifiant du registre `@idem/shared-footer` : la route en dérive. */
  readonly id: string;
  readonly title: T;
  readonly subtitle: T;
  /** Date d'entrée en vigueur, écrite en clair dans les deux langues. */
  readonly effectiveDate: T;
  /** Version du texte. Une politique sans version ne se prouve pas. */
  readonly version: string;
  readonly sections: readonly ContentSection[];
}

/** Choisit une langue, avec l'anglais en repli : la landing ne sert que les deux. */
export function pick(text: T, locale: LegalLocale): string {
  return locale === 'en' ? text.en : text.fr;
}

/** La langue d'un `LOCALE_ID` Angular, qui peut valoir `en-US` ou `fr-FR`. */
export function toLegalLocale(localeId: string): LegalLocale {
  return localeId.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
