/**
 * LE RENDU DU KIT — d'une forme demandée (une ligne) à son HTML/SVG, et retour.
 *
 *  - `gfxHtml` dessine UNE forme dans sa boîte : couleurs de la charte, fluo refusé en grande
 *    surface, identifiant stable (`data-el`), paramètres gardés dans le HTML (`data-gfx`) pour
 *    pouvoir la REDESSINER seule plus tard (autre graine, autre couleur) sans recomposer le visuel ;
 *  - `expandGfxMacros` remplace les balises `<x-gfx>` écrites par l'agent Ultra par ces dessins ;
 *  - `regenerateGfx` relit les paramètres d'une forme et la redessine ;
 *  - les effets de photo (bichromie vraie par filtre SVG).
 */
import { hexToOklch } from '../../../design/color';
import { iconSvg } from '../../../video/video.icons';
import { DEFAULT_LOOK, DEFAULT_STROKE, GFX_BY_KIND, ICON_CONCEPTS_LIST } from './catalog';
import { clamp, hashSeed, HEX6, mixHex, n1, rng } from './math';
import { SHAPES, type G } from './shapes';
import type { GfxBlend, GfxBox, GfxContext, GfxKind, GfxParams } from './types';

const BLENDS: GfxBlend[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];

/** Un fluo (très saturé et clair) : un filet ou un petit accent, jamais une surface. */
export const isNeonHex = (hex: string): boolean => {
  const o = hexToOklch(hex);
  return !!o && o.c > 0.2 && o.l > 0.7;
};

export interface GfxContextInput {
  width: number;
  height: number;
  u: number;
  /** Jetons de la charte : id → #hex. */
  tokens: Record<string, string>;
  primary: string;
  secondary?: string;
  bg: string;
  ink: string;
}

export function gfxContext(i: GfxContextInput): GfxContext {
  const tokens = Object.fromEntries(Object.entries(i.tokens).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    u: i.u,
    canvas: { w: i.width, h: i.height },
    color: (id) => {
      if (!id) return undefined;
      const raw = String(id).trim().toLowerCase();
      if (HEX6.test(raw)) return raw;
      return tokens[raw.replace(/^var\(--|\)$/g, '')];
    },
    primary: i.primary,
    secondary: i.secondary || i.primary,
    bg: i.bg,
    ink: i.ink,
    neon: isNeonHex,
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');

export interface GfxResult {
  html: string;
  issues: string[];
  /** Les paramètres tels que gardés dans le HTML (couleurs résolues). */
  params: GfxParams;
}

/** Dessine une forme dans sa boîte (px). Les défauts de demande sont renvoyés en `issues`, la forme est quand même dessinée. */
export function gfxHtml(input: GfxParams, box: GfxBox, ctx: GfxContext, elId: string): GfxResult {
  const issues: string[] = [];
  const entry = GFX_BY_KIND.get(input.kind);
  if (!entry || (input.kind !== 'icon' && !SHAPES[input.kind])) return { html: '', issues: [`unknown graphic kind "${input.kind}"`], params: input };

  // Boîte : le grain recouvre toute la toile ; les autres restent à une taille raisonnable.
  const W = ctx.canvas.w;
  const H = ctx.canvas.h;
  const b: GfxBox = input.kind === 'grain' ? { x: 0, y: 0, w: W, h: H } : { x: box.x, y: box.y, w: clamp(box.w, 8, W * 3), h: clamp(box.h, 8, H * 3) };

  const color = (id: string | undefined, fallback: string, label: string): string => {
    if (!id) return fallback;
    const c = ctx.color(id);
    if (!c) {
      issues.push(`${input.kind}: unknown ${label} "${id}" — use a colour token`);
      return fallback;
    }
    return c;
  };
  let c1 = color(input.color, ctx.primary, 'colour');
  const c2 = color(input.color2, ctx.secondary !== c1 ? ctx.secondary : ctx.ink, 'colour2');
  // Le fluo : un trait fin, pas une surface.
  const area = (b.w * b.h) / (W * H);
  if (ctx.neon(c1) && entry.paint !== 'texture' && (entry.paint === 'fill' || entry.paint === 'both') && area > 0.03) {
    issues.push(`${input.kind}: a neon colour cannot fill ${Math.round(area * 100)}% of the canvas — use it only on thin line kinds`);
    c1 = ctx.primary;
  }
  let c2f = c2;
  if (ctx.neon(c2f) && (entry.paint === 'fill' || entry.paint === 'both') && area > 0.03) {
    issues.push(`${input.kind}: colour2 is a neon colour — it cannot fill a large area`);
    c2f = ctx.secondary !== c1 && !ctx.neon(ctx.secondary) ? ctx.secondary : mixHex(c1, ctx.bg, 0.55);
  }

  let variant = input.variant;
  if (variant && !entry.variants.includes(variant)) {
    issues.push(`${input.kind}: unknown variant "${variant}" (${entry.variants.join(', ')})`);
    variant = undefined;
  }
  const seed = Math.floor(Math.abs(input.seed ?? hashSeed(`${elId}:${input.kind}`))) % 1000003;
  const density = clamp(Math.round(input.density ?? 3), 1, 5);
  const look = DEFAULT_LOOK[input.kind];
  const opacity = clamp(input.opacity ?? look?.opacity ?? 1, 0.02, 1);
  const blend = input.blend && BLENDS.includes(input.blend) ? input.blend : look?.blend ?? 'normal';
  const strokeU = clamp(input.stroke ?? DEFAULT_STROKE[input.kind] ?? 0.4, 0.05, 3);

  const params: GfxParams = {
    kind: input.kind,
    seed,
    ...(variant ? { variant } : {}),
    color: c1,
    color2: c2f,
    ...(opacity !== 1 ? { opacity: Math.round(opacity * 100) / 100 } : {}),
    ...(blend !== 'normal' ? { blend } : {}),
    ...(input.stroke !== undefined ? { stroke: strokeU } : {}),
    density,
    ...(input.angle !== undefined ? { angle: input.angle } : {}),
    ...(input.concept ? { concept: input.concept } : {}),
  };

  let inner: string;
  let colorStyle = '';
  if (input.kind === 'icon') {
    const concept = input.concept && ICON_CONCEPTS_LIST.includes(input.concept) ? input.concept : undefined;
    if (!concept) issues.push(`icon: unknown concept "${input.concept || ''}" — choose one from the list`);
    inner = iconSvg('tabler', concept || 'check') || '';
    colorStyle = `color:${c1};`;
  } else {
    const g: G = {
      w: b.w,
      h: b.h,
      p: { ...input, variant },
      c1,
      c2: c2f,
      ink: ctx.ink,
      bg: ctx.bg,
      u: ctx.u,
      rnd: rng(seed),
      seed,
      uid: (suffix) => `gfx-${slug(elId)}-${suffix}`,
      sw: strokeU * ctx.u,
      density,
    };
    inner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n1(b.w)} ${n1(b.h)}" width="${n1(b.w)}" height="${n1(b.h)}" preserveAspectRatio="none" aria-hidden="true">${SHAPES[input.kind]!(g)}</svg>`;
  }
  const html = `<div class="gfx" data-el="${slug(elId)}" data-kind="${input.kind}" data-gfx='${esc(JSON.stringify(params))}' style="left:${Math.round(b.x)}px;top:${Math.round(b.y)}px;width:${Math.round(b.w)}px;height:${Math.round(b.h)}px;${colorStyle}${opacity !== 1 ? `opacity:${Math.round(opacity * 100) / 100};` : ''}${blend !== 'normal' ? `mix-blend-mode:${blend};` : ''}">${inner}</div>`;
  return { html, issues, params };
}

// ─── Les balises <x-gfx> (cran Ultra) ───────────────────────────────────────

const ATTR = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const MACRO = /<x-gfx\b([^>]*?)\/?>(?:\s*<\/x-gfx\s*>)?/gi;

function attrsOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(ATTR)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  return out;
}

const num = (v: string | undefined): number | undefined => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Les paramètres d'une forme lus dans des attributs (balise Ultra) ou un objet (élément Max). */
export function paramsFrom(a: Record<string, unknown>): GfxParams {
  const s = (k: string) => (a[k] === undefined || a[k] === null || a[k] === '' ? undefined : String(a[k]));
  const n = (k: string) => num(s(k));
  return {
    kind: String(s('kind') || '').toLowerCase() as GfxKind,
    seed: n('seed'),
    color: s('color'),
    color2: s('color2'),
    opacity: n('opacity'),
    variant: s('variant')?.toLowerCase(),
    angle: n('angle'),
    blend: s('blend') as GfxBlend | undefined,
    stroke: n('stroke'),
    density: n('density'),
    concept: s('concept')?.toLowerCase(),
  };
}

export interface ExpandResult {
  html: string;
  issues: string[];
  count: number;
}

/** Remplace chaque `<x-gfx …>` par son dessin. `max` formes au plus (le reste est refusé). */
export function expandGfxMacros(html: string, ctx: GfxContext, opts: { max?: number } = {}): ExpandResult {
  const issues: string[] = [];
  const max = opts.max ?? 8;
  let count = 0;
  let grain = 0;
  const out = html.replace(MACRO, (_m, attrText: string) => {
    const a = attrsOf(attrText);
    const params = paramsFrom(a);
    if (!GFX_BY_KIND.has(params.kind)) {
      issues.push(`<x-gfx> has an unknown kind "${a.kind || ''}": choose from the graphic kinds list`);
      return '';
    }
    if (params.kind === 'grain') {
      if (++grain > 1) {
        issues.push('only one grain overlay');
        return '';
      }
    } else if (++count > max) {
      issues.push(`too many graphics (max ${max}): keep the strongest`);
      return '';
    }
    const box: GfxBox = { x: num(a.x) ?? 0, y: num(a.y) ?? 0, w: num(a.w) ?? 0, h: num(a.h) ?? 0 };
    if (params.kind !== 'grain' && (box.w < 8 || box.h < 8)) {
      issues.push(`<x-gfx kind="${params.kind}"> needs x, y, w, h in px`);
      return '';
    }
    const res = gfxHtml(params, box, ctx, a.id || `g-${params.kind}-${count + grain}`);
    issues.push(...res.issues);
    return res.html;
  });
  return { html: out, issues, count: count + grain };
}

/** Les paramètres relus d'une forme déjà dessinée (attribut `data-gfx`). */
export function readGfxParams(attrValue: string): GfxParams | null {
  try {
    const o = JSON.parse(attrValue);
    return o && GFX_BY_KIND.has(o.kind) ? (o as GfxParams) : null;
  } catch {
    return null;
  }
}

/** Redessine une forme avec des paramètres modifiés (autre graine, autre couleur…) : mêmes position et taille. */
export function regenerateGfx(current: GfxParams, patch: Partial<GfxParams>, box: GfxBox, ctx: GfxContext, elId: string): GfxResult {
  return gfxHtml({ ...current, ...patch }, box, ctx, elId);
}

// ─── Effets de photo ────────────────────────────────────────────────────────

const channels = (hex: string) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));

/**
 * Une VRAIE bichromie : la photo passe en niveaux de gris puis chaque ton est remplacé par un
 * dégradé entre l'ombre et la lumière (filtre SVG). Mieux que deux calques multiply/screen :
 * les noirs et les blancs prennent exactement les deux couleurs de la marque.
 */
export function duotoneFilter(id: string, tint: string): { defs: string; css: string } {
  const dark = mixHex(tint, '#0a0a0f', 0.6);
  const light = mixHex(tint, '#ffffff', 0.88);
  const [dr, dg, db] = channels(dark);
  const [lr, lg, lb] = channels(light);
  const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues="${dr} ${lr}"/><feFuncG type="table" tableValues="${dg} ${lg}"/><feFuncB type="table" tableValues="${db} ${lb}"/></feComponentTransfer></filter></svg>`;
  return { defs, css: `filter:url(#${id}) contrast(1.14);` };
}
