/**
 * Les textes voisins d’un document.
 *
 * Un complément de service ne se lit pas sans le texte global qu’il complète,
 * et le texte global doit dire quels compléments existent — sinon personne ne
 * les trouve. Ces liens sont dérivés du registre partagé, pas écrits à la
 * main : un document ajouté apparaît partout où il doit apparaître.
 */

import { LEGAL_DOCS, type LegalDoc, type LegalKind } from '@idem/shared-footer';

import { pick, type LegalLocale, type T } from './content.model';

export interface RelatedLink {
  readonly label: string;
  readonly href: string;
  readonly note?: string;
}

const NOTE_BY_KIND: Record<LegalKind, T> = {
  privacy: {
    fr: 'ce que ce service ajoute en matière de données',
    en: 'what this service adds on the data side',
  },
  terms: {
    fr: 'les règles propres à ce service',
    en: 'the rules specific to this service',
  },
  cookies: {
    fr: 'le détail de ce qui est déposé sur votre appareil',
    en: 'the detail of what is stored on your device',
  },
  processors: {
    fr: 'la liste exhaustive des tiers concernés',
    en: 'the exhaustive list of third parties involved',
  },
  account: { fr: 'la marche à suivre, étape par étape', en: 'the procedure, step by step' },
};

const GLOBAL_NOTE: Record<LegalKind, T> = {
  privacy: {
    fr: 'le texte global, qui s’applique à tous les services',
    en: 'the global text, which applies to every service',
  },
  terms: { fr: 'le contrat général', en: 'the general contract' },
  cookies: NOTE_BY_KIND.cookies,
  processors: NOTE_BY_KIND.processors,
  account: NOTE_BY_KIND.account,
};

function toLink(doc: LegalDoc, locale: LegalLocale, note: T): RelatedLink {
  return { label: doc.label[locale], href: doc.path, note: pick(note, locale) };
}

/**
 * Pour un document donné : son pendant global s’il est un complément, ou la
 * liste de ses compléments s’il est global.
 */
export function relatedLinks(id: string, locale: LegalLocale): RelatedLink[] {
  const doc = LEGAL_DOCS.find((candidate) => candidate.id === id);
  if (!doc) return [];

  if (doc.scope !== 'global') {
    // Un complément renvoie au texte global de même nature, et au second
    // complément du même service (confidentialité ↔ règles d'utilisation).
    return LEGAL_DOCS.filter(
      (candidate) =>
        (candidate.scope === 'global' && candidate.kind === doc.kind) ||
        (candidate.scope === doc.scope && candidate.id !== doc.id),
    ).map((candidate) =>
      toLink(
        candidate,
        locale,
        candidate.scope === 'global' ? GLOBAL_NOTE[candidate.kind] : NOTE_BY_KIND[candidate.kind],
      ),
    );
  }

  // Un texte global renvoie aux autres textes globaux, puis à tous les
  // compléments de même nature : c'est là que le lecteur doit pouvoir sauter.
  return [
    ...LEGAL_DOCS.filter(
      (candidate) =>
        candidate.scope === 'global' && candidate.id !== doc.id && candidate.addendum !== true,
    ).map((candidate) => toLink(candidate, locale, GLOBAL_NOTE[candidate.kind])),
    ...LEGAL_DOCS.filter(
      (candidate) => candidate.scope !== 'global' && candidate.kind === doc.kind,
    ).map((candidate) => toLink(candidate, locale, NOTE_BY_KIND[candidate.kind])),
  ];
}
