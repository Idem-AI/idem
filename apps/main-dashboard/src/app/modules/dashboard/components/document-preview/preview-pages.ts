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
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pages empilées, la dernière en pointillés : la page attendue n'existe pas encore. */
const MISSING_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" aria-hidden="true">
  <rect x="26" y="10" width="54" height="72" rx="6" fill="#e2e8f0"/>
  <rect x="40" y="16" width="54" height="72" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <circle cx="67" cy="52" r="14" fill="#1447e6" fill-opacity=".1"/>
  <path d="M67 45v14M60 52h14" stroke="#1447e6" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M104 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#1447e6" fill-opacity=".55"/>
  <circle cx="16" cy="30" r="2.5" fill="#94a3b8"/>
</svg>`;

/** Page aux lignes à peine esquissées, pastille d'alerte : le contenu reçu est inutilisable. */
const ERROR_ART = `
<svg class="idem-ph-art" viewBox="0 0 120 96" aria-hidden="true">
  <rect x="30" y="10" width="56" height="74" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M41 27h34M41 37h26M41 47h30M41 57h16" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
  <circle cx="84" cy="66" r="16" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/>
  <path d="M84 58v9" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
  <circle cx="84" cy="73" r="1.9" fill="#b45309"/>
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
  return `<div class="idem-ph idem-ph-${kind}">
  ${kind === 'error' ? ERROR_ART : MISSING_ART}
  <p class="idem-ph-section">${escapeHtml(copy.section)}</p>
  <h2 class="idem-ph-title">${escapeHtml(copy.title)}</h2>
  <p class="idem-ph-text">${escapeHtml(copy.message)}</p>
  <button type="button" class="idem-ph-btn" data-idem-action="regenerate" data-idem-name="${escapeHtml(sectionName)}">
    ${REFRESH_ICON}<span>${escapeHtml(copy.action)}</span>
  </button>
</div>`;
}
