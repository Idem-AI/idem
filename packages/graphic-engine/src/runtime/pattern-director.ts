/**
 * LE DIRECTEUR DES MOTIFS — les motifs de la charte servent les visuels et les films, quand ils les servent.
 *
 * Aucun gabarit ne posait les motifs déposés avec la charte. Le directeur décide, sans aucun appel de modèle :
 *   1. SI      un motif apporte quelque chose : pas sur une photo chargée, pas sous un texte dense, pas sur une
 *              direction très sobre (minimalisme, suisse, luxe discret : une fois sur trois), et jamais partout ;
 *   2. OÙ      la plus grande zone CALME de la page (bande haute, basse, côté, ou toute la page), le motif ancré
 *              dans le coin le plus libre et fondu vers le texte (masque) : jamais un papier peint uniforme ;
 *   3. QUEL    le motif dont l'encre est la plus lisible sur cette zone, moins couvrant quand le texte est dense ;
 *   4. COMMENT mélangé (`multiply` sur zone claire, `screen` sur zone sombre) à une opacité de 4 à 10 %, calculée
 *              pour que la différence visible reste ≈ 4 % de luminosité : perceptible, jamais voyante.
 * La même logique pure sert les films (`video/rendering/hyperframes/composition.ts`).
 */
import type { Page } from 'puppeteer';
import type { BrandPattern } from '../design-system/tokens';
import type { FormatDef } from '../design-system/formats';
import { stableHash } from '../foundation/hash';
import { hexToRgb } from '../foundation/color';
import { engineHost, log } from '../host';
import { pageDocument, withPage } from './browser';
import { ANALYZE, COLLECT } from './logo-director';
import type { Box, Region } from './logo-director';

// ─── Logique pure ───────────────────────────────────────────────────────────

export interface PatternTile {
  /** L'adresse de la tuile SVG (hébergée, ou fichier du rendu pour un film). */
  src: string;
  tile: number;
  ink: string;
  ground: string;
  kind?: string;
}

export interface PatternPlan {
  tile: PatternTile;
  blend: 'multiply' | 'screen';
  /** 0,04 à 0,10 : le plafond des motifs de la marque. */
  opacity: number;
  /** Différence de luminosité perçue obtenue (0,022 à 0,05). */
  visible: number;
}

export const OPACITY = { min: 0.05, max: 0.14 } as const;
/** Différence perçue visée : un motif qu'on remarque sans qu'il prenne la place du message. */
const TARGET_VISIBLE = 0.065;
const MIN_VISIBLE = 0.03;
const MAX_TINT = 0.04;

/** Luminosité perçue (0–1) d'une couleur hex. */
export function lightnessOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  // `hexToRgb` rend déjà des canaux 0–1.
  const lin = (c: number) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return Math.pow(L, 1 / 2.4);
}

const COVERAGE: Record<string, number> = { dots: 0.12, grid: 0.15, arcs: 0.3, stripes: 0.35, chevron: 0.4, weave: 0.45, checker: 0.5 };

/** Les directions très sobres : le motif y est l'exception. */
export const QUIET_STYLES = new Set(['minimalism', 'swiss', 'quiet-luxury']);

/** Une valeur stable 0–1 pour une graine (le même visuel garde le même choix à la retouche). */
export const unit = (seed: string): number => parseInt(stableHash(seed, 8), 16) / 0xffffffff;

/**
 * Faut-il un motif ? `calmShare` : part de la toile sans image chargée (0–1) ; `textShare` : part couverte par du
 * texte. Un motif ne sert pas une photo, ni une page de texte dense ; une direction sobre l'accepte une fois sur trois.
 */
export function wantsPattern(o: { seed: string; quiet?: boolean; calmShare: number; textShare: number }): boolean {
  // Le CONTENU décide : une zone libre suffisante et un texte qui laisse respirer. Seule une direction sobre ajoute
  // un tirage (une page sur deux), pour que le motif y reste l'exception.
  if (o.calmShare < 0.12 || o.textShare > 0.6) return false;
  return o.quiet ? unit(`${o.seed}|want`) < 0.8 : true;
}

/** Le meilleur motif pour une zone de luminance relative `regionLum` (0–1), ou `null` si aucun ne se verrait. */
export function planPattern(o: { regionLum: number; tiles: PatternTile[]; textShare: number; seed: string }): PatternPlan | null {
  const Pr = Math.pow(Math.max(0, Math.min(1, o.regionLum)), 1 / 2.4);
  const plans: { plan: PatternPlan; rank: number }[] = [];
  for (const tile of o.tiles) {
    const Pi = lightnessOf(tile.ink);
    const Pg = lightnessOf(tile.ground);
    const diff = Math.abs(Pg - Pi);
    for (const blend of ['multiply', 'screen'] as const) {
      const delta = blend === 'multiply' ? Pr * diff : (1 - Pr) * diff;
      if (delta <= 0) continue;
      const opacity = Math.round(Math.min(OPACITY.max, Math.max(OPACITY.min, TARGET_VISIBLE / delta)) * 1000) / 1000;
      const visible = opacity * delta;
      // Le fond de la tuile teinte toute la zone : il ne doit pas se voir.
      const tint = blend === 'multiply' ? opacity * (1 - Pg) * Pr : opacity * Pg * (1 - Pr);
      if (visible < MIN_VISIBLE || tint > MAX_TINT) continue;
      const coverage = COVERAGE[tile.kind ?? ''] ?? 0.3;
      // Plus le texte est dense, plus le motif doit être aéré ; un motif au contraste proche du visé gagne.
      const rank = -Math.abs(visible - TARGET_VISIBLE) * 10 - coverage * o.textShare * 2;
      plans.push({ plan: { tile, blend, opacity, visible: Math.round(visible * 1000) / 1000 }, rank });
    }
  }
  if (!plans.length) return null;
  plans.sort((a, b) => b.rank - a.rank);
  // Les motifs presque aussi bons tournent d'un visuel à l'autre (graine) : la marque garde ses motifs, pas un seul.
  const near = plans.filter((p) => p.rank >= plans[0].rank - 0.12);
  const unique = near.filter((p, i) => near.findIndex((q) => q.plan.tile.src === p.plan.tile.src) === i);
  return unique[Math.floor(unit(`${o.seed}|pick`) * unique.length) % unique.length].plan;
}

/** Les motifs de la charte utilisables (encre et fond connus). */
export function usableTiles(patterns: BrandPattern[] | undefined, resolve: (url: string) => string | undefined = (u) => u): PatternTile[] {
  return (patterns ?? []).flatMap((p) => {
    const src = resolve(p.url);
    return src && p.ink && p.ground ? [{ src, tile: p.tile > 0 ? p.tile : 48, ink: p.ink, ground: p.ground, ...(p.motif ? { kind: p.motif } : {}) }] : [];
  });
}

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const hex6 = (h: string) => (HEX3.test(h) ? h.replace(HEX3, '#$1$1$2$2$3$3') : h).toLowerCase();
const inkCache = new Map<string, { ink: string; ground: string } | null>();

/** L'encre et le fond d'une tuile SVG lus dans son code : le fond est le premier aplat, l'encre la couleur la plus employée après lui. */
export function inkOfSvg(svg: string, ground?: string): { ink: string; ground: string } | null {
  const colours = [...svg.matchAll(/(?:fill|stroke)\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => hex6(m[1])).filter((c) => /^#[0-9a-f]{6}$/.test(c));
  if (!colours.length) return null;
  const g = ground && /^#[0-9a-f]{3,6}$/i.test(ground) ? hex6(ground) : colours[0];
  const count = new Map<string, number>();
  for (const c of colours) if (c !== g) count.set(c, (count.get(c) ?? 0) + 1);
  const ink = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return ink ? { ink, ground: g } : null;
}

/**
 * Les motifs de la charte, tous utilisables : ceux dont l'encre est connue tels quels ; pour les autres (charte
 * enregistrée avant que l'encre soit transmise), l'encre est lue dans la tuile SVG elle-même (une seule fois par adresse).
 */
export async function patternTiles(patterns: BrandPattern[] | undefined): Promise<PatternTile[]> {
  const out = await Promise.all(
    (patterns ?? []).map(async (p): Promise<PatternTile | null> => {
      if (!p.url) return null;
      const tile = p.tile > 0 ? p.tile : 48;
      if (p.ink && p.ground) return { src: p.url, tile, ink: p.ink, ground: p.ground, ...(p.motif ? { kind: p.motif } : {}) };
      if (!inkCache.has(p.url)) {
        let svg = '';
        try {
          if (p.url.startsWith('data:image/svg')) svg = p.url.includes(';base64,') ? Buffer.from(p.url.split(';base64,')[1], 'base64').toString('utf8') : decodeURIComponent(p.url.split(',')[1] ?? '');
          else if (/^https?:\/\//i.test(p.url) && (await (engineHost().browser?.allow?.(p.url) ?? true))) {
            const res = await fetch(p.url, { signal: AbortSignal.timeout(6000) });
            if (res.ok && /svg/.test(res.headers.get('content-type') ?? '')) svg = (await res.text()).slice(0, 200_000);
          }
        } catch {
          svg = '';
        }
        inkCache.set(p.url, svg ? inkOfSvg(svg, p.ground) : null);
      }
      const read = inkCache.get(p.url);
      return read ? { src: p.url, tile, ink: p.ink ?? read.ink, ground: p.ground ?? read.ground, ...(p.motif ? { kind: p.motif } : {}) } : null;
    })
  );
  return out.filter((t): t is PatternTile => !!t);
}

export type Fade = 'full-tl' | 'full-tr' | 'full-bl' | 'full-br' | 'top' | 'bottom' | 'left' | 'right';

/** Le masque : le motif se fond vers le texte ou vers l'intérieur de la page. */
export function maskOf(fade: Fade): string {
  const radial = (at: string) => `radial-gradient(ellipse 85% 85% at ${at}, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)`;
  const linear = (to: string) => `linear-gradient(${to}, #000 0%, rgba(0,0,0,0.7) 40%, transparent 100%)`;
  switch (fade) {
    case 'full-tl': return radial('0% 0%');
    case 'full-tr': return radial('100% 0%');
    case 'full-bl': return radial('0% 100%');
    case 'full-br': return radial('100% 100%');
    case 'top': return linear('to bottom');
    case 'bottom': return linear('to top');
    case 'left': return linear('to right');
    default: return linear('to left');
  }
}

/** Le calque : une image de fond répétée, mélangée, masquée. Aucune classe : le CSS est en ligne (rien à compiler). */
export function patternLayerHtml(plan: PatternPlan, box: Box, fade: Fade, scale: number): string {
  const size = Math.round(Math.max(40, Math.min(280, plan.tile.tile * scale)));
  const mask = maskOf(fade);
  const url = plan.tile.src.replace(/'/g, '%27').replace(/"/g, '%22');
  return `<div aria-hidden="true" data-ge-pattern-layer data-blend="${plan.blend}" style="position:absolute;left:${Math.round(box.x)}px;top:${Math.round(box.y)}px;width:${Math.round(box.w)}px;height:${Math.round(box.h)}px;pointer-events:none;background-image:url('${url}');background-size:${size}px ${size}px;background-repeat:repeat;opacity:${plan.opacity};mix-blend-mode:${plan.blend};-webkit-mask-image:${mask};mask-image:${mask}"></div>`;
}

// ─── La page ────────────────────────────────────────────────────────────────

const GRID = 16;

interface Cell extends Region {
  x: number;
  y: number;
  w: number;
  h: number;
  text: boolean;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

type RegionName = 'full' | 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br';

/** Les zones candidates : toute la page, deux bandes, deux côtés, quatre coins (en cases de la grille). */
function regionsOf(): { name: RegionName; x0: number; y0: number; x1: number; y1: number }[] {
  const b = Math.round(GRID * 0.4);
  const s = Math.round(GRID * 0.45);
  const c = Math.round(GRID * 0.42);
  return [
    { name: 'full', x0: 0, y0: 0, x1: GRID, y1: GRID },
    { name: 'top', x0: 0, y0: 0, x1: GRID, y1: b },
    { name: 'bottom', x0: 0, y0: GRID - b, x1: GRID, y1: GRID },
    { name: 'left', x0: 0, y0: 0, x1: s, y1: GRID },
    { name: 'right', x0: GRID - s, y0: 0, x1: GRID, y1: GRID },
    { name: 'tl', x0: 0, y0: 0, x1: c, y1: c },
    { name: 'tr', x0: GRID - c, y0: 0, x1: GRID, y1: c },
    { name: 'bl', x0: 0, y0: GRID - c, x1: c, y1: GRID },
    { name: 'br', x0: GRID - c, y0: GRID - c, x1: GRID, y1: GRID },
  ];
}

/** Le fondu d'une zone : depuis son bord extérieur (ou son coin) vers l'intérieur de la page. */
function fadeOf(name: RegionName, text: { x: number; y: number }, W: number, H: number): Fade {
  if (name === 'full') return `full-${text.y < H / 2 ? 'b' : 't'}${text.x < W / 2 ? 'r' : 'l'}` as Fade;
  if (name === 'tl' || name === 'tr' || name === 'bl' || name === 'br') return `full-${name}` as Fade;
  return name === 'top' ? 'bottom' : name === 'bottom' ? 'top' : name === 'left' ? 'right' : 'left';
}

export interface DirectedPattern {
  html: string;
  png?: Buffer;
  plan: PatternPlan;
  where: string;
}

/** Pourquoi une page n'a pas de motif (journal) : le réglage se décide sur des faits, pas à l'aveugle. */
function skip(seed: string, reason: string, extra: Record<string, unknown> = {}): null {
  log().info('graphic.pattern', { event: 'graphic.pattern', placed: false, reason, seed: seed.slice(0, 60), ...extra });
  return null;
}

/**
 * Pose (ou non) un motif de la charte sur une page de visuel affichée. `null` : pas de motif — la page est gardée
 * telle quelle. Une seule ouverture de page : mesure, pose et vérification se font dans la même session.
 */
export async function directPattern(o: { html: string; head: string; format: FormatDef; tiles: PatternTile[]; seed: string; quiet?: boolean; lang?: string; shoot?: boolean }): Promise<DirectedPattern | null> {
  if (o.format.kind !== 'fixed') return null;
  if (!o.tiles.length) return skip(o.seed, 'no-usable-pattern');
  // Une direction sobre : le tirage se fait AVANT d'ouvrir le navigateur (rien dans la page ne le renverserait).
  if (o.quiet && unit(`${o.seed}|want`) >= 0.8) return skip(o.seed, 'quiet-direction');
  try {
    return await withPage(pageDocument(o.html, o.head, { lang: o.lang, background: '#ffffff' }), { width: o.format.width, height: o.format.height }, async (page: Page) => {
      if (await page.$('canvas[data-idem-chart]')) return null;
      const collected = (await page.evaluate(COLLECT)) as { w: number; h: number; obstacles: Box[] } | null;
      if (!collected || collected.w < 200 || collected.h < 200) return null;
      const root = await page.$('.ge-page');
      if (!root) return null;
      // Les images (photo, illustration, fond en `url(…)`) se posent PAR-DESSUS le calque : leur zone n'est pas libre.
      const images = (await page.evaluate(IMAGE_RECTS)) as Box[];
      const bare = Buffer.from(await root.screenshot({ type: 'png' }));
      const W = collected.w;
      const H = collected.h;
      const rects: Box[] = [];
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) rects.push({ x: (gx * W) / GRID, y: (gy * H) / GRID, w: W / GRID, h: H / GRID });
      const stats = (await page.evaluate(`${ANALYZE}(${JSON.stringify(`data:image/png;base64,${bare.toString('base64')}`)}, ${JSON.stringify(rects)})`)) as Region[];
      const cells: Cell[] = rects.map((r, i) => ({ ...r, ...stats[i], text: collected.obstacles.some((b) => overlaps(r, b)) }));
      // Deux façons de poser un motif :
      //   SOUS le contenu  sur un fond libre (aplat, panneau, marge) : le texte et les images passent par-dessus ;
      //   SUR une photo    seulement sur une partie calme et sans texte (ciel, mur, fond de studio), en bord ou en coin.
      const underImage = (c: Cell) => images.some((b) => overlaps(c, b));
      // Un texte sur fond libre ne gêne pas : le calque passe SOUS lui (un titre noir sur blanc n'est pas une zone agitée).
      const free = (c: Cell) => !underImage(c) && (c.std < 0.07 || c.text);
      const photoCalm = (c: Cell) => c.std < 0.045 && underImage(c) && !c.text;
      const calmShare = cells.filter((c) => free(c) || photoCalm(c)).length / cells.length;
      const textShare = cells.filter((c) => c.text).length / cells.length;
      if (!wantsPattern({ seed: o.seed, quiet: o.quiet, calmShare, textShare })) return skip(o.seed, calmShare < 0.12 ? 'no-calm-area' : 'text-too-dense', { calmShare: Math.round(calmShare * 100) / 100, textShare: Math.round(textShare * 100) / 100 });

      const textCells = cells.filter((c) => c.text);
      const text = { x: textCells.length ? textCells.reduce((s, c) => s + c.x + c.w / 2, 0) / textCells.length : W / 2, y: textCells.length ? textCells.reduce((s, c) => s + c.y + c.h / 2, 0) / textCells.length : H / 2 };
      let best: { name: RegionName; mode: 'under' | 'over'; score: number; lum: number; box: Box; fade: Fade } | null = null;
      for (const r of regionsOf()) {
        const inside = cells.filter((_, i) => {
          const gx = i % GRID;
          const gy = Math.floor(i / GRID);
          return gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1;
        });
        const area = ((r.x1 - r.x0) * (r.y1 - r.y0)) / (GRID * GRID);
        const box: Box = { x: (r.x0 * W) / GRID, y: (r.y0 * H) / GRID, w: ((r.x1 - r.x0) * W) / GRID, h: ((r.y1 - r.y0) * H) / GRID };
        const freeCells = inside.filter(free);
        const overCells = inside.filter((c) => free(c) || photoCalm(c));
        // SOUS : ≥ 80 % de fond libre. SUR : aucune case de texte, ≥ 85 % de cases calmes, et pas toute la page.
        const under = freeCells.length / inside.length >= 0.8;
        const over = !under && r.name !== 'full' && !inside.some((c) => c.text) && overCells.length / inside.length >= 0.85;
        if (!under && !over) continue;
        const used = under ? freeCells : overCells;
        const score = area * (used.length / inside.length) * (under ? 1.15 : 1);
        if (best && best.score >= score) continue;
        const bare = used.filter((c) => !c.text);
        const lumCells = bare.length ? bare : used;
        best = { name: r.name, mode: under ? 'under' : 'over', score, lum: lumCells.reduce((s, c) => s + c.mean, 0) / lumCells.length, box, fade: fadeOf(r.name, text, W, H) };
      }
      if (!best) return skip(o.seed, 'no-region', { calmShare: Math.round(calmShare * 100) / 100 });
      const plan = planPattern({ regionLum: best.lum, tiles: o.tiles, textShare, seed: o.seed });
      if (!plan) return skip(o.seed, 'not-visible-on-region', { lum: Math.round(best.lum * 100) / 100 });

      const layer = patternLayerHtml(plan, best.box, best.fade, Math.min(W, H) / 1080);
      let html: string;
      if (best.mode === 'under') {
        // PREMIER enfant de la racine : le texte et les images viennent par-dessus, le motif reste au fond.
        const match = /<[a-z0-9]+\b[^>]*class="[^"]*\bge-page\b[^"]*"[^>]*>/i.exec(o.html);
        if (!match) return skip(o.seed, 'no-root');
        html = `${o.html.slice(0, match.index + match[0].length)}${layer}${o.html.slice(match.index + match[0].length)}`;
      } else {
        // DERNIER enfant : par-dessus la photo (zone sans texte), sous le logo que le directeur pose ensuite.
        const close = o.html.lastIndexOf('</div>');
        if (close < 0) return skip(o.seed, 'no-root');
        html = `${o.html.slice(0, close)}${layer}${o.html.slice(close)}`;
      }
      // VÉRIFICATION dans la même page : le calque est où prévu et la page garde sa taille.
      await page.evaluate(`(function(){var r=document.querySelector('.ge-page');r.querySelectorAll('img[data-ge-logo]').forEach(function(i){i.style.visibility='';});r.insertAdjacentHTML(${JSON.stringify(best.mode === 'under' ? 'afterbegin' : 'beforeend')}, ${JSON.stringify(layer)});})()`);
      const check = (await page.evaluate(`(function(){var r=document.querySelector('.ge-page'),l=r.querySelector('[data-ge-pattern-layer]');if(!l)return null;var rb=r.getBoundingClientRect(),b=l.getBoundingClientRect();return {x:b.left-rb.left,y:b.top-rb.top,w:b.width,h:b.height,cw:rb.width,ch:rb.height};})()`)) as { x: number; y: number; w: number; h: number; cw: number; ch: number } | null;
      if (!check || Math.abs(check.x - best.box.x) > 3 || Math.abs(check.y - best.box.y) > 3 || Math.abs(check.w - best.box.w) > 3 || Math.abs(check.cw - W) > 2 || Math.abs(check.ch - H) > 2) return skip(o.seed, 'layer-misplaced');
      await page.evaluate(WAIT_PATTERN_IMAGE).catch(() => undefined);
      const png = o.shoot ? Buffer.from(await (await page.$('.ge-page'))!.screenshot({ type: 'png' })) : undefined;
      const where = `${best.mode === 'under' ? 'fond' : 'sur la photo'} ${best.name} (${best.fade}), ${plan.tile.kind ?? 'motif'}, ${plan.blend} ${Math.round(plan.opacity * 100)} %`;
      log().info('graphic.pattern', { event: 'graphic.pattern', placed: true, where, seed: o.seed.slice(0, 60) });
      return { html, ...(png ? { png } : {}), plan, where };
    });
  } catch (error) {
    return skip(o.seed, 'error', { error: String((error as Error)?.message ?? error).slice(0, 160) });
  }
}

const IMAGE_RECTS = `(function(){var root=document.querySelector('.ge-page'),rb=root.getBoundingClientRect(),out=[];
  function add(el){var r=el.getBoundingClientRect();if(r.width>24&&r.height>24)out.push({x:r.left-rb.left,y:r.top-rb.top,w:r.width,h:r.height});}
  root.querySelectorAll('img:not([data-ge-logo]),video,picture').forEach(add);
  root.querySelectorAll('*').forEach(function(el){var bg=getComputedStyle(el).backgroundImage;if(bg&&bg.indexOf('url(')>=0&&!el.hasAttribute('data-ge-pattern-layer'))add(el);});
  return out;})()`;

/** Le fond d'un calque n'est pas une <img> : on laisse le temps de charger la tuile avant la photographie. */
const WAIT_PATTERN_IMAGE = `(async function(){var l=document.querySelector('[data-ge-pattern-layer]');var m=(l&&getComputedStyle(l).backgroundImage||'').match(/url\\(["']?([^"')]+)/);if(!m)return;await new Promise(function(res){var i=new Image();i.onload=res;i.onerror=res;i.src=m[1];setTimeout(res,3000);});})()`;
