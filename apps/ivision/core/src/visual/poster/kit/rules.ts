/**
 * LES RÈGLES DE SUPERPOSITION — ce que le code refuse entre une forme du kit et un texte.
 *
 * La mesure de contraste lit les pixels, mais une trame de points gris sous un titre passe le
 * contraste et reste un fouillis. Ces règles sont les mêmes pour les deux agents qui écrivent des
 * formes (Max : éléments JSON ; Ultra : balises `<x-gfx>`), et chaque refus est une phrase que le
 * designer comprend et applique au tour suivant.
 */
import { GFX_BY_KIND } from './catalog';
import type { GfxBox } from './types';

/** Les textures denses : sous un texte, elles restent discrètes (20 % d'opacité au plus). */
const DENSE = new Set(['dots', 'stripes', 'weave', 'burst', 'arcs']);

export interface StackedGfx {
  kind: string;
  box: GfxBox;
  opacity: number;
  /** Rang dans la pile (un rang plus grand est peint par-dessus). */
  at: number;
}

export interface StackedText {
  name: string;
  box: GfxBox;
  at: number;
}

const overlap = (a: GfxBox, b: GfxBox) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function stackingIssues(gfx: StackedGfx[], texts: StackedText[]): string[] {
  const issues: string[] = [];
  for (const g of gfx) {
    if (g.kind === 'grain') continue;
    const entry = GFX_BY_KIND.get(g.kind as never);
    const solid = !!entry && (entry.paint === 'fill' || entry.paint === 'both');
    for (const t of texts) {
      const share = overlap(g.box, t.box) / Math.max(1, t.box.w * t.box.h);
      if (share < 0.1) continue;
      if (g.at > t.at && (solid || g.opacity > 0.3)) issues.push(`the ${g.kind} graphic is painted OVER the text block (${t.name}): put it before the text in the list or lower its opacity to 0.2`);
      else if (g.at < t.at && DENSE.has(g.kind) && g.opacity > 0.35) issues.push(`the ${g.kind} graphic is a busy texture under the text block (${t.name}): lower its opacity to 0.2 or move it off the text`);
    }
  }
  return [...new Set(issues)];
}

// ─── Lecture d'un HTML d'auteur (Ultra) ─────────────────────────────────────

const px = (style: string, prop: string) => Number(style.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*(-?[\\d.]+)px`))?.[1]);

/** Les colonnes de texte d'un HTML d'auteur : `data-stack` et leur boîte en px. */
export function stackBoxes(html: string): StackedText[] {
  const out: StackedText[] = [];
  for (const m of html.matchAll(/<div\b[^>]*\bdata-stack="([^"]*)"[^>]*\bstyle="([^"]*)"/g)) {
    const [x, y, w, h] = [px(m[2], 'left'), px(m[2], 'top'), px(m[2], 'width'), px(m[2], 'height')];
    if ([x, y, w, h].every(Number.isFinite)) out.push({ name: m[1] || 'text', box: { x, y, w, h }, at: m.index ?? 0 });
  }
  return out;
}

/** Les balises `<x-gfx>` d'un HTML d'auteur : forme, boîte, opacité, rang. */
export function macroLayers(html: string): StackedGfx[] {
  const out: StackedGfx[] = [];
  for (const m of html.matchAll(/<x-gfx\b([^>]*?)\/?>/gi)) {
    const a: Record<string, string> = {};
    for (const p of m[1].matchAll(/([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[p[1].toLowerCase()] = p[2] ?? p[3] ?? '';
    const [x, y, w, h] = [Number(a.x), Number(a.y), Number(a.w), Number(a.h)];
    if ([x, y, w, h].every(Number.isFinite)) out.push({ kind: (a.kind || '').toLowerCase(), box: { x, y, w, h }, opacity: Number.isFinite(Number(a.opacity)) && a.opacity !== '' ? Number(a.opacity) : 1, at: m.index ?? 0 });
  }
  return out;
}
