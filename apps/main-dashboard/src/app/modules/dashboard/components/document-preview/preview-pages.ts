import {
  SectionCompletionItem,
  SectionCompletionStatus,
} from '../../models/generation-completeness';
import { EditableSection } from '@idem/shared-document-editor/angular';

/** Nature d'une page de l'aperçu. */
export type PreviewPageKind = 'content' | 'missing' | 'error';

/** Ce qui mérite d'être signalé sur une page (pied de page, liste des pages). */
export type PreviewPageIssue = 'missing' | 'error' | 'underfilled';

export interface PreviewPage {
  /** Id rendu dans l'iframe : id de section, ou id de la page de remplacement. */
  id: string;
  /** Nom canonique de la section — la clé de régénération côté API. */
  name: string;
  /** Nom affiché (traduit). */
  label: string;
  kind: PreviewPageKind;
  /** Statut de génération connu ; null pour une section hors de la liste attendue. */
  status: SectionCompletionStatus | null;
  issue: PreviewPageIssue | null;
}

/**
 * Pages de l'aperçu, dans l'ordre du document :
 *  - chaque section chargée, à sa place (l'ordre réel du document est gardé) ;
 *    une section « vide » (génération en échec) devient une page d'erreur ;
 *  - chaque section attendue mais absente devient une page manquante, insérée
 *    après la dernière page qui la précède dans l'ordre attendu.
 */
export function composePages(
  sections: readonly EditableSection[],
  outline: readonly SectionCompletionItem[],
  label: (name: string) => string,
): PreviewPage[] {
  const statusByName = new Map(outline.map((item) => [item.name, item.status]));
  const orderByName = new Map(outline.map((item, index) => [item.name, index]));

  const pages: PreviewPage[] = sections.map((section) => {
    const status = statusByName.get(section.name) ?? null;
    const failed = status === 'empty';
    return {
      id: failed ? `__error__${section.id}` : section.id,
      name: section.name,
      label: label(section.name),
      kind: failed ? 'error' : 'content',
      status,
      issue: failed ? 'error' : status === 'underfilled' ? 'underfilled' : null,
    };
  });

  const present = new Set(sections.map((section) => section.name));
  outline.forEach((item, order) => {
    if (present.has(item.name) || (item.status !== 'missing' && item.status !== 'empty')) return;
    let at = 0;
    pages.forEach((page, i) => {
      const pageOrder = orderByName.get(page.name);
      if (pageOrder !== undefined && pageOrder < order) at = i + 1;
    });
    const failed = item.status === 'empty';
    pages.splice(at, 0, {
      id: `__${failed ? 'error' : 'missing'}__${item.name}`,
      name: item.name,
      label: label(item.name),
      kind: failed ? 'error' : 'missing',
      status: item.status,
      issue: failed ? 'error' : 'missing',
    });
  });

  return pages;
}

/** Textes d'une page de remplacement, déjà traduits. */
export interface PlaceholderCopy {
  section: string;
  title: string;
  message: string;
  action: string;
  /** « 18 pages sur 20 sont prêtes » : ce qui est déjà là. */
  progress?: string;
  /** Part des pages prêtes, 0–1, pour la jauge. */
  ratio?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/*
 * Illustrations au trait (AGENTS.md § 4), un objet de la culture africaine
 * chacune : `currentColor` pour le trait, la primaire (`.idem-ph-accent`)
 * pour le seul détail qui compte. Aucun aplat.
 */

/** Calebasse vide, son ouverture en pointillés : la page attendue n'existe pas encore. */
const MISSING_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g transform="translate(0 4)">
    <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" stroke-width="2"/>
    <ellipse cx="60" cy="36" rx="34" ry="8" stroke-width="2"/>
    <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
    <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
    <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" stroke-width="3"/>
    <g class="idem-ph-accent">
      <ellipse cx="60" cy="36" rx="28" ry="5" stroke-dasharray="3 4"/>
    </g>
  </g>
</svg>`;

/** Calebasse fêlée : le contenu reçu est inutilisable. */
const ERROR_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g transform="translate(0 4)">
    <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" stroke-width="2"/>
    <ellipse cx="60" cy="36" rx="34" ry="8" stroke-width="2"/>
    <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
    <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
    <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" stroke-width="3"/>
    <ellipse cx="60" cy="36" rx="30" ry="5.5" opacity=".5"/>
    <g class="idem-ph-accent" stroke-width="2">
      <path d="M68 28.5 L64 38 L70 46 L63 56 L67 64 L64 75"/>
      <path d="M70 46 L76 49"/>
    </g>
  </g>
</svg>`;

const REFRESH_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
</svg>`;

/**
 * HTML d'une page de remplacement, rendu DANS le document de l'aperçu (styles :
 * `previewPageStyles` d'editor-iframe.ts). Son bouton porte `data-idem-action`,
 * que le runtime de l'iframe remonte à l'hôte.
 */
export function buildPlaceholderHtml(
  kind: 'missing' | 'error',
  sectionName: string,
  copy: PlaceholderCopy,
): string {
  const ratio = Math.max(0, Math.min(1, copy.ratio ?? 0));
  const progress = copy.progress
    ? `<p class="idem-ph-progress"><span class="idem-ph-bar"><span style="width:${Math.round(ratio * 100)}%"></span></span><span>${escapeHtml(copy.progress)}</span></p>`
    : '';
  return `<div class="idem-ph idem-ph-${kind}">
  ${kind === 'error' ? ERROR_ART : MISSING_ART}
  <p class="idem-ph-section">${escapeHtml(copy.section)}</p>
  <h2 class="idem-ph-title">${escapeHtml(copy.title)}</h2>
  <p class="idem-ph-text">${escapeHtml(copy.message)}</p>
  ${progress}
  <button type="button" class="idem-ph-btn" data-idem-action="regenerate" data-idem-name="${escapeHtml(sectionName)}">
    ${REFRESH_ICON}<span>${escapeHtml(copy.action)}</span>
  </button>
</div>`;
}
