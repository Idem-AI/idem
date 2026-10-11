/**
 * LE KIT GRAPHIQUE DANS UNE PAGE — business plan, charte graphique, pitch deck, carte de visite.
 *
 * Les affiches se mesurent en pixels ; une page de document et une carte de visite se mesurent en
 * MILLIMÈTRES, et leur HTML n'emporte pas la feuille de style du moteur d'affiches. Ce module est
 * le pont : il prend la boîte telle que la page l'écrit (`10mm`, `40%`, `120px`), en déduit une
 * géométrie en pixels pour le tracé, et rend une forme autonome (styles en ligne).
 *
 * C'est la même logique que pour les visuels : l'agent NOMME une forme en une ligne, le code la
 * dessine aux couleurs du document. Un décor nommé coûte ~25 jetons ; le SVG qu'il remplace en
 * coûte des centaines, et l'IA le dessine mal.
 */
import { GFX_CATALOG } from './catalog';
import { clamp } from './math';
import { gfxContext, gfxHtml, paramsFrom, type GfxCssBox } from './render';
import type { GfxBox, GfxParams } from './types';

/** 96 dpi : l'unité de longueur CSS, celle de Chromium à l'impression. */
const PX_PER_MM = 96 / 25.4;

/** Une longueur de page (`12mm`, `40%`, `120px`, `0`) en pixels, pour le tracé. */
export function lengthToPx(value: string | number | undefined, basisPx: number, fallbackPx = 0): number {
  if (value === undefined || value === null || value === '') return fallbackPx;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallbackPx;
  const m = String(value).trim().match(/^(-?[\d.]+)\s*(mm|cm|in|pt|px|%)?$/i);
  if (!m) return fallbackPx;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallbackPx;
  switch ((m[2] || 'px').toLowerCase()) {
    case 'mm':
      return n * PX_PER_MM;
    case 'cm':
      return n * PX_PER_MM * 10;
    case 'in':
      return n * 96;
    case 'pt':
      return (n * 96) / 72;
    case '%':
      return (n / 100) * basisPx;
    default:
      return n;
  }
}

export interface PageGfxSurface {
  /** Dimensions de la page, telles qu'elle les écrit (`210mm`, `1080px`…). */
  width: string;
  height: string;
  /** Les couleurs utilisables, par nom : celles de la charte du document. */
  tokens: Record<string, string>;
  /** Fond de la page et son encre : ce sur quoi la forme est posée. */
  surface: string;
  ink: string;
  primary: string;
  secondary?: string;
}

export interface PageGfx {
  /** Dessine une forme, placée dans l'unité de la page. */
  draw: (params: GfxParams, place: GfxCssBox, elId: string) => { html: string; issues: string[] };
  /** Remplace les balises `<x-gfx …>` d'un HTML de page par leurs dessins. */
  expand: (html: string, opts?: { max?: number }) => { html: string; issues: string[]; count: number };
  widthPx: number;
  heightPx: number;
}

/** Le kit, prêt pour une page donnée (document ou carte). */
export function pageGfx(surface: PageGfxSurface): PageGfx {
  const widthPx = lengthToPx(surface.width, 0, 794);
  const heightPx = lengthToPx(surface.height, 0, 1123);
  const ctx = gfxContext({
    width: widthPx,
    height: heightPx,
    u: Math.min(widthPx, heightPx) / 100,
    tokens: surface.tokens,
    primary: surface.primary,
    secondary: surface.secondary || surface.primary,
    bg: surface.surface,
    ink: surface.ink,
  });

  const draw = (params: GfxParams, place: GfxCssBox, elId: string) => {
    const box: GfxBox = {
      x: lengthToPx(place.left, widthPx),
      y: lengthToPx(place.top, heightPx),
      w: lengthToPx(place.width, widthPx, widthPx),
      h: lengthToPx(place.height, heightPx, heightPx),
    };
    const res = gfxHtml(params, box, ctx, elId, place);
    return { html: res.html, issues: res.issues };
  };

  const expand = (html: string, opts: { max?: number } = {}) => {
    const max = opts.max ?? 4;
    const issues: string[] = [];
    let count = 0;
    let grain = 0;
    const out = html.replace(/<x-gfx\b([^>]*?)\/?>(?:\s*<\/x-gfx\s*>)?/gi, (_m, attrText: string) => {
      const a: Record<string, string> = {};
      for (const p of String(attrText).matchAll(/([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[p[1].toLowerCase()] = p[2] ?? p[3] ?? '';
      const params = paramsFrom(a);
      if (!GFX_CATALOG.some((e) => e.kind === params.kind)) {
        issues.push(`<x-gfx> has an unknown kind "${a.kind || ''}": choose one from the graphic kinds list`);
        return '';
      }
      // Le grain couvre la page entière ; une seule fois.
      if (params.kind === 'grain') {
        if (++grain > 1) {
          issues.push('only one grain overlay per page');
          return '';
        }
        const res = draw(params, { left: '0', top: '0', width: '100%', height: '100%' }, `g-grain`);
        issues.push(...res.issues);
        return res.html;
      }
      if (++count > max) {
        issues.push(`too many graphics on this page (max ${max}): keep only the ones that structure it`);
        return '';
      }
      const place: GfxCssBox = { left: a.x || '0', top: a.y || '0', width: a.w || '', height: a.h || '' };
      if (!place.width || !place.height) {
        issues.push(`<x-gfx kind="${params.kind}"> needs x, y, w and h (page units, e.g. x="0" y="180mm" w="210mm" h="60mm")`);
        return '';
      }
      const res = draw(params, place, a.id || `g-${params.kind}-${count}`);
      issues.push(...res.issues);
      return res.html;
    });
    return { html: out, issues, count: count + grain };
  };

  return { draw, expand, widthPx, heightPx };
}

/**
 * Le manifeste des formes pour le compositeur de page : court à dessein, c'est ce qui remplace
 * des centaines de jetons de SVG écrit à la main. Les documents se lisent : le décor y est plus
 * discret que sur une affiche (il structure ou il n'est pas là).
 */
export function pageKitManifest(opts: { page: { width: string; height: string }; max?: number } = { page: { width: '210mm', height: '297mm' } }): string[] {
  const max = clamp(opts.max ?? 3, 1, 6);
  return [
    `- Decorative graphics (optional, at most ${max} per page plus one grain): the code draws them, you only name them — <x-gfx kind="contours" x="0" y="210mm" w="210mm" h="87mm" color="primary" opacity="0.1"></x-gfx>. Coordinates in the page's own units (${opts.page.width} × ${opts.page.height}), colours by token name. NEVER hand-write an <svg> for decoration.`,
    `  kinds: ${GFX_CATALOG.filter((e) => e.kind !== 'icon').map((e) => `${e.kind} [${e.variants.join('|')}]`).join(', ')}.`,
    '  A document is read before it is looked at: a graphic either structures the page (a band along an edge, a corner mark, a tonal field behind a quote) or it does not belong. Keep it under 15% opacity behind any text, and never over a chart, a table or a specimen.',
  ];
}
