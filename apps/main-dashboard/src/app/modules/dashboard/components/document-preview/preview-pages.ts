import {
  SectionCompletionItem,
  SectionCompletionStatus,
} from '../../models/generation-completeness';
import { EditableSection } from '../../pages/document-editor/models/editor.types';

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
 * Illustrations au trait (AGENTS.md § 4) : `currentColor` pour le trait, la
 * primaire (`.idem-ph-accent`) pour le seul détail qui compte. Aucun aplat.
 */

/** Pages prêtes en pile, la page attendue en pointillés : elle n'existe pas encore. */
const MISSING_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="18" y="16" width="44" height="60" rx="4"/>
  <path d="M26 28h28M26 36h22M26 44h26"/>
  <rect x="50" y="10" width="50" height="70" rx="4" stroke-dasharray="5 4"/>
  <g class="idem-ph-accent" stroke-width="2.4">
    <circle cx="75" cy="45" r="11"/>
    <path d="M75 39.5v11M69.5 45h11"/>
  </g>
</svg>`;

/** Page aux lignes esquissées, signe d'alerte : le contenu reçu est inutilisable. */
const ERROR_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="30" y="10" width="54" height="72" rx="4"/>
  <path d="M40 24h32M40 32h24M40 40h28M40 48h14" opacity=".7"/>
  <g class="idem-ph-accent" stroke-width="2.4">
    <circle cx="82" cy="64" r="13"/>
    <path d="M82 57v8"/>
    <path d="M82 70.5v.5"/>
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
