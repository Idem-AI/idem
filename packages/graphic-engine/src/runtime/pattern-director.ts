/**
 * LE DIRECTEUR DES MOTIFS — les motifs de la charte font partie de la composition, par construction.
 *
 * Le principe est GÉOMÉTRIQUE, pas statistique. Un motif est un calque posé sur la page, restreint (clip-path) à
 * ce que la page laisse voir de son fond : tout ce qu'une image, un panneau opaque ou une carte couvre est un
 * TROU du calque. Il n'y a donc aucune « zone calme » à deviner dans les pixels, aucun tirage au sort :
 *   1. SI      une part suffisante du fond est visible (≥ 12 %) et le texte laisse respirer ; le contenu décide,
 *              et la raison de chaque refus est journalisée (`graphic.pattern`) ;
 *   2. OÙ      sur tout le fond visible, ancré au point le plus éloigné du texte et fondu vers lui ;
 *   3. QUEL    le motif dont l'encre se lit le mieux sur la luminosité MESURÉE du fond visible ;
 *   4. COMMENT mélangé (`multiply` sur fond clair, `screen` sur fond sombre), opacité de 5 à 14 % calculée pour une
 *              différence perçue ≈ 6,5 % : on le découvre en regardant, il ne prend jamais la place du message.
 * Une direction sobre (minimalisme, suisse, luxe discret) garde le motif, plus léger — jamais un refus arbitraire.
 * Aucun appel de modèle. La même logique pure sert les films (`video/rendering/hyperframes/composition.ts`).
 */
import { createHash } from 'crypto';
import type { Page } from 'puppeteer';
import type { BrandPattern } from '../design-system/tokens';
import type { FormatDef } from '../design-system/formats';
import { hexToRgb } from '../foundation/color';
import { engineHost, log } from '../host';
import { pageDocument, withPage } from './browser';
import { ANALYZE } from './logo-director';
import type { Box, Region } from './logo-director';

// ─── Logique pure ───────────────────────────────────────────────────────────

export interface PatternTile {
  /** L'adresse de la tuile SVG (hébergée, ou fichier du rendu pour un film). */
  src: string;
  tile: number;
  ink: string;
  ground: string;
  kind?: string;
  /** Le code SVG de la tuile, quand on l'a : l'encre peut alors être adaptée au fond (palette de la marque). */
  svg?: string;
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

/** Les directions très sobres : le motif y est plus léger (jamais supprimé au hasard). */
export const QUIET_STYLES = new Set(['minimalism', 'swiss', 'quiet-luxury']);
/** Le motif d'une direction sobre : 25 % plus léger. */
export const QUIET_STRENGTH = 0.75;

/** Un nombre stable 0–1 pour une graine (le choix entre deux motifs équivalents, jamais un refus). */
export const unit = (seed: string): number => parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) / 0xffffffff;

export interface PatternVerdict {
  place: boolean;
  reason?: 'covered' | 'text-too-dense';
}

/**
 * Le motif a-t-il de la place ? `exposed` : part du fond visible (0–1), hors images et panneaux opaques ;
 * `textShare` : part de la page occupée par du texte. Décision déterministe, fondée sur le contenu seul.
 */
export function patternVerdict(o: { exposed: number; textShare: number }): PatternVerdict {
  if (o.exposed < 0.12) return { place: false, reason: 'covered' };
  if (o.textShare > 0.75) return { place: false, reason: 'text-too-dense' };
  return { place: true };
}

/** Un SVG dont les couleurs sont remplacées (hex 3 ou 6 chiffres, sans tenir compte de la casse). */
export function recolorSvg(svg: string, map: Record<string, string>): string {
  const norm = (h: string) => (/^#[0-9a-f]{3}$/i.test(h) ? h.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : h).toLowerCase();
  const table = new Map(Object.entries(map).map(([from, to]) => [norm(from), to]));
  return svg.replace(/#[0-9a-fA-F]{3,6}\b/g, (m) => table.get(norm(m)) ?? m);
}

export const svgDataUri = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/**
 * Le meilleur motif pour un fond de luminance relative `regionLum` (0–1), ou `null` si aucun ne se verrait.
 *
 * Une tuile dont on connaît le code SVG est ADAPTÉE : son fond devient neutre (blanc en `multiply`, noir en
 * `screen` : aucune teinte), et son encre est celle de la charte qui se lit le mieux sur ce fond — l'encre d'origine
 * d'abord, puis les couleurs de la marque (`inks`), puis blanc ou presque noir. Un motif ne disparaît donc plus parce
 * que son encre est sombre sur un fond sombre.
 */
export function planPattern(o: { regionLum: number; tiles: PatternTile[]; textShare: number; seed: string; strength?: number; inks?: string[] }): PatternPlan | null {
  const Pr = Math.pow(Math.max(0, Math.min(1, o.regionLum)), 1 / 2.4);
  const strength = o.strength ?? 1;
  const plans: { plan: PatternPlan; rank: number }[] = [];
  const consider = (tile: PatternTile, ink: string, ground: string, blend: 'multiply' | 'screen', priority: number) => {
    const Pi = lightnessOf(ink);
    const Pg = lightnessOf(ground);
    const delta = blend === 'multiply' ? Pr * Math.abs(Pg - Pi) : (1 - Pr) * Math.abs(Pg - Pi);
    if (delta <= 0) return;
    const opacity = Math.round(Math.min(OPACITY.max, Math.max(OPACITY.min * strength, (TARGET_VISIBLE * strength) / delta)) * 1000) / 1000;
    const visible = opacity * delta;
    // Le fond de la tuile teinte tout le fond visible : il ne doit pas se voir.
    const tint = blend === 'multiply' ? opacity * (1 - Pg) * Pr : opacity * Pg * (1 - Pr);
    if (visible < MIN_VISIBLE * strength || tint > MAX_TINT) return;
    const coverage = COVERAGE[tile.kind ?? ''] ?? 0.3;
    // Plus le texte est dense, plus le motif doit être aéré ; un motif au contraste proche du visé gagne ; l'encre
    // d'origine de la marque passe avant ses autres couleurs.
    const rank = -Math.abs(visible - TARGET_VISIBLE * strength) * 10 - coverage * o.textShare * 2 - priority * 0.08;
    plans.push({ plan: { tile: { ...tile, ink, ground }, blend, opacity, visible: Math.round(visible * 1000) / 1000 }, rank });
  };
  for (const tile of o.tiles) {
    // Sans code SVG : la tuile telle quelle. Avec : fond neutre et encre au choix.
    if (!tile.svg) {
      for (const blend of ['multiply', 'screen'] as const) consider(tile, tile.ink, tile.ground, blend, 0);
      continue;
    }
    const inks = [...new Set([tile.ink, ...(o.inks ?? []), '#ffffff', '#111111'].map((c) => c.toLowerCase()))];
    inks.forEach((ink, priority) => {
      consider(tile, ink, '#ffffff', 'multiply', priority);
      consider(tile, ink, '#000000', 'screen', priority);
    });
  }
  if (!plans.length) return null;
  plans.sort((a, b) => b.rank - a.rank);
  // Les motifs presque aussi bons tournent d'un visuel à l'autre (graine) : la marque garde ses motifs, pas un seul.
  const near = plans.filter((p) => p.rank >= plans[0].rank - 0.12);
  const unique = near.filter((p, i) => near.findIndex((q) => q.plan.tile.src === p.plan.tile.src) === i);
  const picked = unique[Math.floor(unit(`${o.seed}|pick`) * unique.length) % unique.length].plan;
  // La tuile adaptée devient une image autonome (fond neutre, encre choisie).
  if (picked.tile.svg) {
    const original = picked.tile;
    const from = o.tiles.find((t) => t.src === original.src)!;
    const svg = recolorSvg(from.svg!, { [from.ink]: original.ink, [from.ground]: original.ground });
    return { ...picked, tile: { ...original, src: svgDataUri(svg) } };
  }
  return picked;
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
const inkCache = new Map<string, { ink: string; ground: string; svg: string } | null>();

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
        const read = svg ? inkOfSvg(svg, p.ground) : null;
        inkCache.set(p.url, read ? { ...read, svg } : null);
      }
      const read = inkCache.get(p.url);
      // Tuile illisible mais encre et fond connus : utilisable telle quelle, sans adaptation.
      if (!read) return p.ink && p.ground ? { src: p.url, tile, ink: p.ink, ground: p.ground, ...(p.motif ? { kind: p.motif } : {}) } : null;
      return { src: p.url, tile, ink: (p.ink ?? read.ink).toLowerCase(), ground: (p.ground ?? read.ground).toLowerCase(), svg: read.svg, ...(p.motif ? { kind: p.motif } : {}) };
    })
  );
  return out.filter((t): t is PatternTile => !!t);
}

/** Où le motif est le plus marqué (% de la page) et jusqu'où il se prolonge (% de la diagonale). */
export interface PatternAnchor {
  x: number;
  y: number;
  reach: number;
}

/** Le masque : plein au point d'ancrage, fondu vers le texte et vers les bords. */
export function maskOf(anchor: PatternAnchor): string {
  const x = Math.round(anchor.x * 100);
  const y = Math.round(anchor.y * 100);
  const r = Math.round(Math.max(35, Math.min(140, anchor.reach * 100)));
  return `radial-gradient(ellipse ${r}% ${r}% at ${x}% ${y}%, #000 0%, rgba(0,0,0,0.6) 45%, transparent 100%)`;
}

/** Le contour du fond visible : la page entière moins les trous (images, panneaux opaques), en `clip-path` evenodd. */
export function clipPathOf(size: { w: number; h: number }, holes: Box[]): string {
  const r = (v: number) => Math.round(v);
  const outer = `M0 0H${r(size.w)}V${r(size.h)}H0Z`;
  const cut = holes.map((b) => `M${r(b.x)} ${r(b.y)}h${r(b.w)}v${r(b.h)}h${-r(b.w)}Z`).join('');
  return `path(evenodd,'${outer}${cut}')`;
}

/** Le calque : une image de fond répétée, mélangée, masquée, découpée autour des images. Aucune classe : le CSS est en ligne. */
export function patternLayerHtml(plan: PatternPlan, layer: { size: { w: number; h: number }; holes?: Box[]; anchor: PatternAnchor; scale: number }): string {
  const tile = Math.round(Math.max(40, Math.min(280, plan.tile.tile * layer.scale)));
  const mask = maskOf(layer.anchor);
  const url = plan.tile.src.replace(/'/g, '%27').replace(/"/g, '%22');
  const clip = layer.holes?.length ? `clip-path:${clipPathOf(layer.size, layer.holes)};` : '';
  return `<div aria-hidden="true" data-ge-pattern-layer data-blend="${plan.blend}" style="position:absolute;left:0;top:0;width:${Math.round(layer.size.w)}px;height:${Math.round(layer.size.h)}px;z-index:30;pointer-events:none;background-image:url('${url}');background-size:${tile}px ${tile}px;background-repeat:repeat;opacity:${plan.opacity};mix-blend-mode:${plan.blend};${clip}-webkit-mask-image:${mask};mask-image:${mask}"></div>`;
}

// ─── La page ────────────────────────────────────────────────────────────────

const GRID = 24;

/** Pourquoi une page n'a pas de motif (journal) : le réglage se décide sur des faits, pas à l'aveugle. */
function skip(seed: string, reason: string, extra: Record<string, unknown> = {}): null {
  log().info('graphic.pattern', { event: 'graphic.pattern', placed: false, reason, seed: seed.slice(0, 60), ...extra });
  return null;
}

export interface DirectedPattern {
  html: string;
  png?: Buffer;
  plan: PatternPlan;
  where: string;
}

/**
 * Ce que la page montre : les textes, et les TROUS du calque (images, vidéos, fonds en `url(…)`, panneaux et cartes
 * opaques). Un panneau d'au moins 85 % de la page est le fond lui-même, pas un trou.
 */
const SCAN = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return null;
  var rb = root.getBoundingClientRect(), area = rb.width * rb.height;
  function rel(r) { return { x: r.left - rb.left, y: r.top - rb.top, w: r.width, h: r.height }; }
  function shown(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05; }
  var texts = [], holes = [];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    var t = walker.currentNode, el = t.parentElement;
    if (!el || !(t.textContent || '').trim() || el.closest('[data-ge-logo]') || !shown(el)) continue;
    var range = document.createRange(); range.selectNodeContents(t);
    var r = range.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) texts.push(rel(r));
  }
  root.querySelectorAll('img:not([data-ge-logo]),video,picture,canvas').forEach(function (el) { if (shown(el)) holes.push(rel(el.getBoundingClientRect())); });
  root.querySelectorAll('*').forEach(function (el) {
    if (el === root || el.hasAttribute('data-ge-pattern-layer') || el.closest('[data-ge-logo]') || !shown(el)) return;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.backgroundImage && cs.backgroundImage.indexOf('url(') >= 0) { holes.push(rel(r)); return; }
    var m = (cs.backgroundColor || '').match(/rgba?\\(([^)]*)\\)/);
    var parts = m ? m[1].split(',') : [], alpha = parts.length > 3 ? parseFloat(parts[3]) : (m ? 1 : 0);
    if (alpha >= 0.9 && r.width * r.height < area * 0.85 && r.width > 40 && r.height > 24) holes.push(rel(r));
  });
  root.querySelectorAll('img[data-ge-logo]').forEach(function (img) { img.style.visibility = 'hidden'; });
  return { w: rb.width, h: rb.height, texts: texts, holes: holes };
})()`;

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Pose (ou non) un motif de la charte sur une page de visuel affichée. `null` : pas de motif — la page est gardée
 * telle quelle. Une seule ouverture de page : mesure, pose et vérification se font dans la même session.
 */
export async function directPattern(o: { html: string; head: string; format: FormatDef; tiles: PatternTile[]; seed: string; quiet?: boolean; inks?: string[]; lang?: string; shoot?: boolean }): Promise<DirectedPattern | null> {
  if (o.format.kind !== 'fixed') return null;
  if (!o.tiles.length) return skip(o.seed, 'no-usable-pattern');
  try {
    return await withPage(pageDocument(o.html, o.head, { lang: o.lang, background: '#ffffff' }), { width: o.format.width, height: o.format.height }, async (page: Page) => {
      if (await page.$('canvas[data-idem-chart]')) return skip(o.seed, 'chart');
      const scan = (await page.evaluate(SCAN)) as { w: number; h: number; texts: Box[]; holes: Box[] } | null;
      if (!scan || scan.w < 200 || scan.h < 200) return skip(o.seed, 'no-root');
      const root = await page.$('.ge-page');
      if (!root) return skip(o.seed, 'no-root');
      const { w: W, h: H, texts, holes } = scan;
      // La grille : quelles cases le calque atteint-il (ni trou, ni texte) ?
      const rects: Box[] = [];
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) rects.push({ x: (gx * W) / GRID, y: (gy * H) / GRID, w: W / GRID, h: H / GRID });
      const inHole = rects.map((c) => holes.some((h) => overlaps({ x: c.x + c.w * 0.25, y: c.y + c.h * 0.25, w: c.w * 0.5, h: c.h * 0.5 }, h)));
      const hasText = rects.map((c) => texts.some((t) => overlaps(c, t)));
      const exposed = inHole.filter((x) => !x).length / rects.length;
      const textShare = hasText.filter(Boolean).length / rects.length;
      const verdict = patternVerdict({ exposed, textShare });
      if (!verdict.place) return skip(o.seed, verdict.reason!, { exposed: Math.round(exposed * 100) / 100, textShare: Math.round(textShare * 100) / 100 });

      // La luminosité MESURÉE du fond visible (cases sans trou ni texte) : seul usage des pixels.
      const bare = Buffer.from(await root.screenshot({ type: 'png' }));
      const wanted = rects.filter((_, i) => !inHole[i] && !hasText[i]);
      const sample = wanted.length >= 6 ? wanted : rects.filter((_, i) => !inHole[i]);
      const stats = (await page.evaluate(`${ANALYZE}(${JSON.stringify(`data:image/png;base64,${bare.toString('base64')}`)}, ${JSON.stringify(sample)})`)) as Region[];
      const lum = stats.reduce((s, c) => s + c.mean, 0) / Math.max(1, stats.length);
      const plan = planPattern({ regionLum: lum, tiles: o.tiles, textShare, seed: o.seed, strength: o.quiet ? QUIET_STRENGTH : 1, inks: o.inks });
      if (!plan) return skip(o.seed, 'not-visible-on-background', { lum: Math.round(lum * 100) / 100 });

      // L'ancrage : le point du fond visible le plus éloigné du texte ; le motif s'y marque et se fond vers le texte.
      const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      const mass = texts.length ? texts.reduce((s, t) => ({ x: s.x + centre(t).x * t.w * t.h, y: s.y + centre(t).y * t.w * t.h, a: s.a + t.w * t.h }), { x: 0, y: 0, a: 0 }) : { x: (W / 2) * 1, y: (H / 2) * 1, a: 1 };
      const tx = mass.x / mass.a;
      const ty = mass.y / mass.a;
      const free = rects.filter((_, i) => !inHole[i]);
      const far = free.reduce((best, c) => {
        const p = centre(c);
        const d = Math.hypot(p.x - tx, p.y - ty);
        return d > best.d ? { d, p } : best;
      }, { d: -1, p: { x: W / 2, y: H / 2 } });
      const anchor: PatternAnchor = { x: far.p.x / W, y: far.p.y / H, reach: o.quiet ? 0.7 : 0.95 };

      const layer = patternLayerHtml(plan, { size: { w: W, h: H }, holes, anchor, scale: Math.min(W, H) / 1080 });
      // DERNIER enfant de la racine, au-dessus de tout : l'ordre d'empilement des gabarits ne compte plus, c'est le
      // `clip-path` qui garde le motif hors des images et des panneaux. Mélangé à 5–14 %, il ne change pas la lecture du texte.
      const close = o.html.lastIndexOf('</div>');
      if (close < 0) return skip(o.seed, 'no-root');
      const html = `${o.html.slice(0, close)}${layer}${o.html.slice(close)}`;
      // VÉRIFICATION dans la même page : le calque couvre la toile, sa découpe est acceptée par le navigateur.
      await page.evaluate(`(function(){var r=document.querySelector('.ge-page');r.querySelectorAll('img[data-ge-logo]').forEach(function(i){i.style.visibility='';});r.insertAdjacentHTML('beforeend', ${JSON.stringify(layer)});})()`);
      const check = (await page.evaluate(`(function(){var r=document.querySelector('.ge-page'),l=r.querySelector('[data-ge-pattern-layer]');if(!l)return null;var rb=r.getBoundingClientRect(),b=l.getBoundingClientRect(),cs=getComputedStyle(l);return {w:b.width,h:b.height,cw:rb.width,ch:rb.height,clip:cs.clipPath!=='none'||${holes.length}===0};})()`)) as { w: number; h: number; cw: number; ch: number; clip: boolean } | null;
      if (!check || Math.abs(check.w - W) > 2 || Math.abs(check.h - H) > 2 || Math.abs(check.cw - W) > 2 || !check.clip) return skip(o.seed, 'layer-misplaced');
      await page.evaluate(WAIT_PATTERN_IMAGE).catch(() => undefined);
      const png = o.shoot ? Buffer.from(await (await page.$('.ge-page'))!.screenshot({ type: 'png' })) : undefined;
      const where = `fond visible ${Math.round(exposed * 100)} % (ancre ${Math.round(anchor.x * 100)}/${Math.round(anchor.y * 100)}), ${plan.tile.kind ?? 'motif'}, ${plan.blend} ${Math.round(plan.opacity * 100)} %`;
      log().info('graphic.pattern', { event: 'graphic.pattern', placed: true, where, seed: o.seed.slice(0, 60) });
      return { html, ...(png ? { png } : {}), plan, where };
    });
  } catch (error) {
    return skip(o.seed, 'error', { error: String((error as Error)?.message ?? error).slice(0, 160) });
  }
}

/** Le fond d'un calque n'est pas une <img> : on laisse le temps de charger la tuile avant la photographie. */
const WAIT_PATTERN_IMAGE = `(async function(){var l=document.querySelector('[data-ge-pattern-layer]');var m=(l&&getComputedStyle(l).backgroundImage||'').match(/url\\(["']?([^"')]+)/);if(!m)return;await new Promise(function(res){var i=new Image();i.onload=res;i.onerror=res;i.src=m[1];setTimeout(res,3000);});})()`;
