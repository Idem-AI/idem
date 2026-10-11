/**
 * LE REGISTRE DES CAPACITÉS DOCUMENTAIRES — ce que l'agent peut demander, et rien d'autre.
 *
 * Le pendant, pour les documents, de ce que `video.layouts.ts` est aux vidéos et de ce que le kit
 * graphique est aux visuels : l'agent ne lit jamais une documentation, il lit un MENU — un
 * identifiant, une ligne de description, des paramètres bornés — et le code dessine.
 *
 *   menu      `uiMenu('business plan')` → les composants qui ont du sens pour ce livrable
 *   contrat   `uiManifest(...)` → les quelques lignes qui partent dans le prompt
 *   rendu     `renderUi(id, data, tokens)` → le HTML, ou la raison du refus, mot pour mot
 *   balise    `expandUiMacros(html, tokens)` → `<x-ui kind="…" data='…'>` dessiné dans une page
 *
 * Le refus est aussi important que le rendu : une donnée manquante revient à l'agent sous la
 * forme d'une phrase qu'il peut corriger (« "columns" needs at least 2 items »), jamais sous la
 * forme d'un bloc à moitié dessiné.
 */
import logger from '../../runtime/logger';
import { UI_COMPONENTS } from './components';
import { UiDataError, type UiComponent, type UiDeliverable, type UiTokens } from './types';

export { UI_COMPONENTS } from './components';
export { UiDataError } from './types';
export type { UiComponent, UiDeliverable, UiTokens } from './types';

export const UI_BY_ID = new Map<string, UiComponent>(UI_COMPONENTS.map((c) => [c.id, c]));

/** Les composants qui ont du sens pour ce livrable, les plus structurants d'abord. */
export function uiMenu(deliverable: UiDeliverable): UiComponent[] {
  return UI_COMPONENTS.filter((c) => c.deliverables.includes(deliverable)).sort((a, b) => b.weight - a.weight);
}

/** Les jetons d'un composant, tirés du design system du document (jamais une couleur libre). */
export function uiTokensOf(ds: {
  colors: { primary: string; secondary: string; accent: string; surface: string; surfaceRaised: string; ink: string; inkMuted: string; rule: string; onAccent: string; brand?: Record<string, string> };
  fonts: { display: string; body: string };
  typeScale: Record<string, number>;
  spacing: number;
  radius: number;
}): UiTokens {
  const s = ds.typeScale;
  return {
    colors: ds.colors,
    fonts: ds.fonts,
    typeScale: { xs: s.xs, sm: s.sm, base: s.base, lg: s.lg, xl: s.xl, '2xl': s['2xl'], '3xl': s['3xl'] },
    spacing: ds.spacing,
    radius: ds.radius,
  };
}

export interface UiRenderResult {
  html: string | null;
  /** La raison du refus, formulée pour que l'agent la corrige au tour suivant. */
  error?: string;
}

/** Dessine un composant. Une donnée qui manque ne produit JAMAIS un bloc à moitié rempli. */
export function renderUi(id: string, data: Record<string, unknown>, tokens: UiTokens): UiRenderResult {
  const component = UI_BY_ID.get(id) || UI_BY_ID.get(`ui.${id}`);
  if (!component) return { html: null, error: `unknown component "${id}": choose one from the list` };
  try {
    return { html: component.render(data, tokens) };
  } catch (error) {
    if (error instanceof UiDataError) return { html: null, error: `${component.id}: ${error.message}` };
    logger.warn('[UiKit] composant en échec', { id, error: (error as Error)?.message });
    return { html: null, error: `${component.id} could not be drawn` };
  }
}

/**
 * Le contrat qui part dans le prompt : court à dessein. C'est ce qui remplace, pour l'agent, des
 * kilo-octets de HTML à écrire — et ce qui garantit que deux documents de la même marque se
 * composent avec le même vocabulaire.
 */
export function uiManifest(deliverable: UiDeliverable, format: 'block' | 'macro'): string[] {
  const menu = uiMenu(deliverable);
  if (!menu.length) return [];
  const syntax =
    format === 'macro'
      ? `- Rich blocks (the code draws them, you only name them and give their data): <x-ui kind="comparison-matrix" data='{"columns":["Nous","Import"],"criteria":["Prix","Délai"],"rows":[["yes","no"],["48 h","3 semaines"]]}'></x-ui>. The data is JSON in a single-quoted attribute, and every value comes from the content — never invent one.`
      : `- Rich blocks: ask for one with {"kind":"ui","component":"comparison-matrix","data":{…}} instead of writing its HTML. Every value in "data" comes from the validated content — never invent one.`;
  return [
    syntax,
    ...menu.map((c) => `  ${c.id.replace(/^ui\./, '')} — ${c.summary}. Data: ${Object.entries(c.params).map(([k, p]) => `${k}${p.required ? '*' : ''} (${p.summary})`).join('; ')}`),
    '  A rich block replaces a paragraph that would have described the same thing; never both.',
  ];
}

// ─── Les balises `<x-ui>` (cran Ultra) ──────────────────────────────────────

const MACRO = /<x-ui\b([^>]*?)\/?>(?:\s*<\/x-ui\s*>)?/gi;
const ATTR = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const unescapeAttr = (v: string) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export interface UiExpandResult {
  html: string;
  issues: string[];
  count: number;
}

/** Remplace chaque `<x-ui …>` par le bloc dessiné. Un refus repart à l'agent, la balise disparaît. */
export function expandUiMacros(html: string, tokens: UiTokens, opts: { max?: number } = {}): UiExpandResult {
  const max = opts.max ?? 3;
  const issues: string[] = [];
  let count = 0;
  const out = html.replace(MACRO, (_m, attrText: string) => {
    const attrs: Record<string, string> = {};
    for (const m of String(attrText).matchAll(ATTR)) attrs[m[1].toLowerCase()] = unescapeAttr(m[2] ?? m[3] ?? '');
    const id = (attrs.kind || attrs.component || '').trim();
    if (++count > max) {
      issues.push(`too many rich blocks on this page (max ${max}): keep the one that carries the page`);
      return '';
    }
    let data: Record<string, unknown> = {};
    if (attrs.data) {
      try {
        data = JSON.parse(attrs.data);
      } catch {
        issues.push(`<x-ui kind="${id}">: its data is not valid JSON`);
        return '';
      }
    }
    const res = renderUi(id, data, tokens);
    if (!res.html) {
      issues.push(res.error || `<x-ui kind="${id}"> could not be drawn`);
      return '';
    }
    return res.html;
  });
  return { html: out, issues, count };
}
