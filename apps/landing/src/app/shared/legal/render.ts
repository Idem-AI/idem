/**
 * Du contenu bilingue vers ce que le gabarit sait afficher.
 *
 * La numérotation des sections est posée ici, par le code : une section qui
 * porte « 7. » dans son titre finit par mentir dès qu'on en insère une
 * sixième, et c'est arrivé. Le sommaire est dérivé des mêmes sections, donc il
 * ne peut pas en oublier une.
 */

import type {
  LegalNavItem,
  LegalSection,
} from '../components/legal-document-template/legal-document-template';
import {
  pick,
  type ContentSection,
  type ContentTable,
  type LegalDocContent,
  type LegalLocale,
  type T,
} from './content.model';

/** Les intitulés fixes de l'en-tête d'un texte. */
const LABELS = {
  version: { fr: 'Version', en: 'Version' } satisfies T,
  related: { fr: 'À lire avec ce texte', en: 'Read alongside this text' } satisfies T,
};

export interface RenderedLegalDoc {
  readonly title: string;
  readonly subtitle: string;
  readonly effectiveDate: string;
  readonly version: string;
  readonly versionLabel: string;
  readonly relatedTitle: string;
  readonly sections: LegalSection[];
  readonly navigation: LegalNavItem[];
}

function renderTable(table: ContentTable, locale: LegalLocale) {
  return {
    caption: table.caption ? pick(table.caption, locale) : undefined,
    headers: table.headers.map((header) => pick(header, locale)),
    rows: table.rows.map((row) => row.map((cell) => pick(cell, locale))),
  };
}

function renderSection(section: ContentSection, index: number, locale: LegalLocale): LegalSection {
  const number = index + 1;
  const paragraphs = (section.paragraphs ?? []).map((p) => pick(p, locale));

  return {
    id: section.id,
    // Le numéro vient du rang réel dans la liste, jamais du texte du titre.
    title: `${number}. ${pick(section.title, locale).toUpperCase()}`,
    titleI18n: '',
    content: paragraphs[0],
    contentI18n: '',
    paragraphs: paragraphs.slice(1),
    list: section.list?.map((item) => ({
      text: pick(item.text, locale),
      textI18n: '',
      strong: item.strong ? pick(item.strong, locale) : undefined,
      strongI18n: '',
      link: item.link ? { label: pick(item.link.label, locale), href: item.link.href } : undefined,
    })),
    table: section.table ? renderTable(section.table, locale) : undefined,
    warning: section.warning
      ? {
          type: section.warning.type,
          title: pick(section.warning.title, locale),
          titleI18n: '',
          content: pick(section.warning.content, locale),
          contentI18n: '',
          icon: section.warning.icon,
        }
      : undefined,
    subsections: section.subsections?.map((subsection, subIndex) => {
      const subParagraphs = subsection.paragraphs.map((p) => pick(p, locale));
      return {
        title: `${number}.${subIndex + 1} ${pick(subsection.title, locale)}`,
        titleI18n: '',
        content: subParagraphs[0] ?? '',
        contentI18n: '',
        paragraphs: subParagraphs.slice(1),
        list: subsection.list?.map((item) => ({
          text: pick(item.text, locale),
          textI18n: '',
          strong: item.strong ? pick(item.strong, locale) : undefined,
          strongI18n: '',
          link: item.link
            ? { label: pick(item.link.label, locale), href: item.link.href }
            : undefined,
        })),
        table: subsection.table ? renderTable(subsection.table, locale) : undefined,
      };
    }),
  };
}

/** Le sommaire, dérivé des sections : il ne peut pas en manquer une. */
function renderNavigation(content: LegalDocContent, locale: LegalLocale): LegalNavItem[] {
  return content.sections.map((section, index) => ({
    id: section.id,
    title: `${index + 1}. ${pick(section.title, locale)}`,
    titleI18n: '',
    children: section.subsections
      ?.filter((subsection) => subsection.id !== undefined)
      .map((subsection) => ({
        id: subsection.id as string,
        title: pick(subsection.title, locale),
        titleI18n: '',
      })),
  }));
}

export function renderLegalDoc(content: LegalDocContent, locale: LegalLocale): RenderedLegalDoc {
  return {
    title: pick(content.title, locale),
    subtitle: pick(content.subtitle, locale),
    effectiveDate: pick(content.effectiveDate, locale),
    version: content.version,
    versionLabel: pick(LABELS.version, locale),
    relatedTitle: pick(LABELS.related, locale),
    sections: content.sections.map((section, index) => renderSection(section, index, locale)),
    navigation: renderNavigation(content, locale),
  };
}
