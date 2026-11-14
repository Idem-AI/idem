/**
 * LE DIRECTEUR DU LOGO — sur un visuel, le code décide de la déclinaison, de la place et de la taille du logo.
 *
 * Le problème : le gabarit pose `[[logo]]` à une taille fixe (≈ 7 % de la hauteur), dans une déclinaison choisie
 * d'après l'aplat de la page, sans jamais regarder la PHOTO dessous. Le logo est petit, parfois illisible sur
 * l'image, et certains gabarits l'omettent.
 *
 * Ce que fait le directeur, sur la page déjà affichée (toile fixe) :
 *   1. MESURE   la page est photographiée SANS logo ; pour chaque emplacement possible, la luminosité réelle
 *               (moyenne, extrêmes) et l'agitation de l'image dessous ;
 *   2. DÉCLINAISON  chaque déclinaison du logo a une encre mesurée (luminance des pixels) : celle qui contraste
 *               le mieux avec la zone est retenue (le logo de marque d'abord s'il est lisible) ;
 *   3. PLACE    le logo actuel (agrandi autour de son ancre) et les six emplacements sûrs (coins, centre haut et
 *               bas, dans la zone de sécurité) sont notés : aucun texte recouvert, zone calme, contraste ;
 *   4. TAILLE   le logo est LISIBLE : ≈ 9,5 % du petit côté en hauteur d'encre (davantage s'il est carré),
 *               jamais plus de 42 % de la largeur ;
 *   5. OMBRE    quand le contraste reste juste ou la zone agitée, une ombre portée très discrète (jamais un halo) ;
 *   6. VÉRIFIE  la page finale est rouverte : le logo est où prévu, entier, dans la toile.
 * Aucun modèle n'intervient : tout est mesuré.
 */
import type { Page } from 'puppeteer';
import { engineHost } from '../host';
import type { BrandLogos } from '../design-system/tokens';
import type { FormatDef } from '../design-system/formats';
import { pageDocument, withPage } from './browser';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Region {
  /** Luminance relative moyenne (0 noir – 1 blanc). */
  mean: number;
  /** Les 10 % les plus sombres et les 10 % les plus clairs de la zone. */
  p10: number;
  p90: number;
  /** Agitation : écart-type de la luminance perçue (0 uni – 0,5 très contrasté). */
  std: number;
}

export interface VariantInfo {
  key: keyof BrandLogos;
  url: string;
  /** Luminance relative de l'encre (pixels opaques). */
  lum: number;
  /** Rapport l/h de l'image entière. */
  aspect: number;
  /** Part de l'image réellement occupée par l'encre (boîte englobante). */
  inkW: number;
  inkH: number;
}

export interface Candidate {
  id: 'current' | 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc';
  /** La boîte de l'IMAGE du logo. */
  box: Box;
}

export interface LogoDecision {
  variant: VariantInfo;
  box: Box;
  where: Candidate['id'];
  contrast: number;
  shadow: { blur: number; alpha: number; color: 'dark' | 'light' } | null;
  /** L'image du logo (hauteur en % du petit côté de la toile, mesure d'encre). */
  inkHeightShare: number;
  reason: string;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ─── Mesures pures ──────────────────────────────────────────────────────────

/** Contraste WCAG entre deux luminances relatives. */
export const contrastOf = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Part de la hauteur d'encre visée, selon la forme du logo : un logo carré a besoin de plus de hauteur. */
export function inkTarget(canvas: { w: number; h: number }, inkAspect: number): { w: number; h: number } {
  const side = Math.min(canvas.w, canvas.h);
  const boost = inkAspect <= 1.3 ? 1.5 : inkAspect <= 2.2 ? 1.2 : 1;
  let h = side * 0.095 * boost;
  let w = h * inkAspect;
  const maxW = canvas.w * 0.42;
  if (w > maxW) {
    w = maxW;
    h = w / inkAspect;
  }
  return { w, h };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const intersects = (a: Box, b: Box, margin = 0) => a.x < b.x + b.w + margin && a.x + a.w > b.x - margin && a.y < b.y + b.h + margin && a.y + a.h > b.y - margin;

/**
 * Les emplacements possibles pour une boîte d'image `w × h` : le logo actuel (agrandi autour de son ancre : le bord
 * ou le coin le plus proche reste fixe) et six places sûres dans la zone de sécurité.
 */
export function candidateBoxes(canvas: { w: number; h: number }, safe: Insets, size: { w: number; h: number }, current: Box | null): Candidate[] {
  const m = (v: number) => Math.max(16, v);
  const left = m(safe.left);
  const right = canvas.w - m(safe.right) - size.w;
  const top = m(safe.top);
  const bottom = canvas.h - m(safe.bottom) - size.h;
  const centerX = (canvas.w - size.w) / 2;
  const list: Candidate[] = [];
  if (current) {
    const cx = current.x + current.w / 2;
    const cy = current.y + current.h / 2;
    const centered = Math.abs(cx - canvas.w / 2) < canvas.w * 0.08;
    // La taille finale est au moins celle du logo actuel : on ne le rapetisse jamais.
    const w = Math.max(size.w, current.w);
    const h = Math.max(size.h, current.h);
    const x = centered ? cx - w / 2 : cx < canvas.w / 2 ? current.x : current.x + current.w - w;
    const y = cy < canvas.h / 2 ? current.y : current.y + current.h - h;
    list.push({ id: 'current', box: { x: clamp(x, 4, canvas.w - w - 4), y: clamp(y, 4, canvas.h - h - 4), w, h } });
  }
  const at = (id: Candidate['id'], x: number, y: number): Candidate => ({ id, box: { x: Math.round(x), y: Math.round(y), w: Math.round(size.w), h: Math.round(size.h) } });
  list.push(at('tl', left, top), at('tr', right, top), at('bl', left, bottom), at('br', right, bottom), at('tc', centerX, top), at('bc', centerX, bottom));
  return list;
}

/** La déclinaison qui contraste le mieux avec la zone, et son contraste effectif (la moyenne ET le pire des cas). */
export function bestVariant(variants: VariantInfo[], region: Region, brandFirst: boolean): { variant: VariantInfo; contrast: number } {
  const score = (v: VariantInfo) => {
    const worst = v.lum >= 0.4 ? region.p90 : region.p10;
    return 0.5 * contrastOf(v.lum, region.mean) + 0.5 * contrastOf(v.lum, worst);
  };
  const ranked = variants.map((variant) => ({ variant, contrast: score(variant) })).sort((a, b) => b.contrast - a.contrast);
  // Le logo de marque (primary) garde la main quand il se lit : il porte les couleurs de la marque.
  if (brandFirst) {
    const brand = ranked.find((r) => r.variant.key === 'primary' || r.variant.key === 'onLight');
    if (brand && brand.contrast >= 3.8 && region.std < 0.14) return brand;
  }
  return ranked[0];
}

/** L'ombre portée : discrète, seulement si le contraste est juste ou la zone agitée. Jamais un halo. */
export function shadowFor(variant: VariantInfo, contrast: number, region: Region, height: number): LogoDecision['shadow'] {
  if (contrast >= 7 && region.std < 0.1) return null;
  const alpha = clamp(0.16 + Math.max(0, 4.5 - contrast) * 0.05 + region.std * 0.4, 0.16, 0.38);
  return { blur: Math.round(clamp(height * 0.035, 2, 6) * 10) / 10, alpha: Math.round(alpha * 100) / 100, color: variant.lum >= 0.4 ? 'dark' : 'light' };
}

export interface PlanInput {
  canvas: { w: number; h: number };
  safe: Insets;
  obstacles: Box[];
  current: Box | null;
  variants: VariantInfo[];
}

/** Les emplacements à mesurer (étape 1 du plan) : tous ceux qui ne recouvrent aucun texte. */
export function plannedCandidates(input: PlanInput, scale = 1): Candidate[] {
  const { canvas, variants } = input;
  const ref = variants[0];
  const inkAspect = (ref.aspect * ref.inkW) / Math.max(0.05, ref.inkH);
  const ink = inkTarget(canvas, inkAspect);
  const size = { w: (ink.w / Math.max(0.3, ref.inkW)) * scale, h: (ink.h / Math.max(0.3, ref.inkH)) * scale };
  return candidateBoxes(canvas, input.safe, size, input.current).filter((c) => {
    const inkBox = shrinkToInk(c.box, ref);
    return !input.obstacles.some((o) => intersects(inkBox, o, 12)) && c.box.x >= 0 && c.box.y >= 0 && c.box.x + c.box.w <= canvas.w && c.box.y + c.box.h <= canvas.h;
  });
}

/** La boîte d'ENCRE au centre de la boîte d'image (l'encre ne couvre pas toute l'image). */
export function shrinkToInk(box: Box, v: Pick<VariantInfo, 'inkW' | 'inkH'>): Box {
  const w = box.w * clamp(v.inkW, 0.3, 1);
  const h = box.h * clamp(v.inkH, 0.3, 1);
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Choisit l'emplacement : contraste atteignable, zone calme, préférence pour la place d'origine. */
export function choose(input: PlanInput, candidates: Candidate[], regions: Region[]): LogoDecision | null {
  let best: { score: number; decision: LogoDecision } | null = null;
  candidates.forEach((c, i) => {
    const region = regions[i];
    if (!region) return;
    const { variant, contrast } = bestVariant(input.variants, region, true);
    // Sous 2:1 même avec la meilleure déclinaison, l'emplacement est écarté (ombre ou pas, le logo ne se lirait pas).
    if (contrast < 2) return;
    const calm = 1 - Math.min(region.std, 0.3) / 0.3;
    const score = (Math.min(contrast, 8) / 8) * 0.55 + calm * 0.25 + (c.id === 'current' ? 0.2 : 0) + (c.id === 'br' || c.id === 'tl' ? 0.02 : 0);
    if (best && best.score >= score) return;
    const ink = shrinkToInk(c.box, variant);
    best = {
      score,
      decision: {
        variant,
        box: c.box,
        where: c.id,
        contrast: Math.round(contrast * 10) / 10,
        shadow: shadowFor(variant, contrast, region, ink.h),
        inkHeightShare: Math.round((ink.h / Math.min(input.canvas.w, input.canvas.h)) * 1000) / 1000,
        reason: `${c.id === 'current' ? 'place du gabarit' : `emplacement ${c.id}`}, ${variant.key} (contraste ${contrast.toFixed(1)}:1, agitation ${region.std.toFixed(2)})`,
      },
    };
  });
  return (best as { decision: LogoDecision } | null)?.decision ?? null;
}

// ─── Dans la page (chaînes : la cible ES2016 casserait des fonctions TypeScript) ───

export const COLLECT = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return null;
  var rb = root.getBoundingClientRect();
  function rel(r) { return { x: r.left - rb.left, y: r.top - rb.top, w: r.width, h: r.height }; }
  function shown(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05; }
  var current = null, imgs = root.querySelectorAll('img[data-ge-logo]');
  for (var i = 0; i < imgs.length; i++) if (shown(imgs[i])) { current = rel(imgs[i].getBoundingClientRect()); current.src = imgs[i].getAttribute('src'); break; }
  var obstacles = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    var t = walker.currentNode, el = t.parentElement;
    if (!el || !(t.textContent || '').trim() || el.closest('[data-ge-logo]') || !shown(el)) continue;
    var range = document.createRange(); range.selectNodeContents(t);
    var r = range.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) obstacles.push(rel(r));
  }
  // Un panneau (aplat, verre, cadre) qui porte du texte est un obstacle entier : le logo ne mord pas sur son bord.
  root.querySelectorAll('*').forEach(function (el) {
    if (el === root || !(el.textContent || '').trim() || el.closest('[data-ge-logo]') || !shown(el)) return;
    var cs = getComputedStyle(el), bg = (cs.backgroundColor || '').match(/rgba?\\(([^)]*)\\)/), alpha = bg ? (bg[1].split(',').length > 3 ? parseFloat(bg[1].split(',')[3]) : 1) : 0;
    var glass = (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none');
    var r = el.getBoundingClientRect();
    if ((alpha > 0.05 || glass) && r.width * r.height < rb.width * rb.height * 0.85 && r.width > 40 && r.height > 24) obstacles.push(rel(r));
  });
  root.querySelectorAll('[data-ge-gallery],[data-ge-chart],canvas').forEach(function (el) { if (shown(el)) obstacles.push(rel(el.getBoundingClientRect())); });
  imgs.forEach(function (img) { img.style.visibility = 'hidden'; });
  return { w: rb.width, h: rb.height, current: current, obstacles: obstacles };
})()`;

const MEASURE_INK = `(async function (sources) {
  var out = [];
  for (var i = 0; i < sources.length; i++) {
    try {
      var img = new Image(); img.src = sources[i]; await img.decode();
      var nw = img.naturalWidth || 300, nh = img.naturalHeight || 100;
      var h = 96, w = Math.max(8, Math.round(h * nw / nh));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
      var d = ctx.getImageData(0, 0, w, h).data, sum = 0, wsum = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, a = d[p + 3] / 255;
        if (a < 0.35) continue;
        function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
        var L = 0.2126 * lin(d[p]) + 0.7152 * lin(d[p + 1]) + 0.0722 * lin(d[p + 2]);
        sum += L * a; wsum += a;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (wsum < 20) { out.push(null); continue; }
      out.push({ lum: sum / wsum, aspect: nw / nh, inkW: Math.max(0.05, (x1 - x0 + 1) / w), inkH: Math.max(0.05, (y1 - y0 + 1) / h) });
    } catch (e) { out.push(null); }
  }
  return out;
})`;

export const ANALYZE = `(async function (url, rects) {
  var img = new Image(); img.src = url; await img.decode();
  var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return rects.map(function (r) {
    var x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    var w = Math.max(1, Math.min(c.width - x, Math.ceil(r.w))), h = Math.max(1, Math.min(c.height - y, Math.ceil(r.h)));
    var d = ctx.getImageData(x, y, w, h).data, step = Math.max(1, Math.floor(Math.sqrt(w * h / 3000)));
    var ls = [], ps = [];
    for (var yy = 0; yy < h; yy += step) for (var xx = 0; xx < w; xx += step) {
      var p = (yy * w + xx) * 4;
      var L = 0.2126 * lin(d[p]) + 0.7152 * lin(d[p + 1]) + 0.0722 * lin(d[p + 2]);
      ls.push(L); ps.push(Math.pow(L, 1 / 2.4));
    }
    ls.sort(function (a, b) { return a - b; });
    var mean = ls.reduce(function (s, v) { return s + v; }, 0) / ls.length;
    var pm = ps.reduce(function (s, v) { return s + v; }, 0) / ps.length;
    var std = Math.sqrt(ps.reduce(function (s, v) { return s + (v - pm) * (v - pm); }, 0) / ps.length);
    return { mean: mean, p10: ls[Math.floor(ls.length * 0.1)], p90: ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.9))], std: std };
  });
})`;

// ─── Les images du logo, mesurées ───────────────────────────────────────────

const FAMILY_FULL: (keyof BrandLogos)[] = ['primary', 'onLight', 'onDark', 'mono'];
const FAMILY_ICON: (keyof BrandLogos)[] = ['icon', 'iconOnLight', 'iconOnDark'];

async function asDataUri(url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const allow = engineHost().browser?.allow;
    if (allow && !(await allow(url))) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 4_000_000 ? null : `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Les déclinaisons du logo (le logo complet, sinon l'icône), l'encre mesurée. Une adresse en double compte une fois. */
async function measureVariants(page: Page, logos: BrandLogos): Promise<VariantInfo[]> {
  const family = FAMILY_FULL.some((k) => logos[k]) ? FAMILY_FULL : FAMILY_ICON;
  const entries: { key: keyof BrandLogos; url: string }[] = [];
  for (const key of family) {
    const url = logos[key];
    if (typeof url === 'string' && url && !entries.some((e) => e.url === url)) entries.push({ key, url });
  }
  const sources = await Promise.all(entries.map((e) => asDataUri(e.url)));
  const usable = entries.map((e, i) => ({ ...e, src: sources[i] })).filter((e): e is typeof e & { src: string } => !!e.src);
  if (!usable.length) return [];
  const measured = (await page.evaluate(`${MEASURE_INK}(${JSON.stringify(usable.map((u) => u.src))})`)) as ({ lum: number; aspect: number; inkW: number; inkH: number } | null)[];
  return usable.flatMap((u, i) => (measured[i] ? [{ key: u.key, url: u.url, ...measured[i]! }] : []));
}

// ─── Le directeur ───────────────────────────────────────────────────────────

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function overlayHtml(d: LogoDecision, name: string): string {
  const filter = d.shadow ? `filter:drop-shadow(0 1px ${d.shadow.blur}px ${d.shadow.color === 'dark' ? `rgba(0,0,0,${d.shadow.alpha})` : `rgba(255,255,255,${Math.min(0.5, d.shadow.alpha * 1.2).toFixed(2)})`});` : '';
  return `<img data-ge-logo data-ge-director="${esc(d.where)}" src="${esc(d.variant.url)}" alt="${esc(`Logo ${name}`)}" style="position:absolute;left:${Math.round(d.box.x)}px;top:${Math.round(d.box.y)}px;width:${Math.round(d.box.w)}px;height:${Math.round(d.box.h)}px;object-fit:contain;z-index:40;pointer-events:none;${filter}">`;
}

export interface DirectedPage {
  html: string;
  png?: Buffer;
  decision: LogoDecision;
}

/**
 * Dirige le logo d'une page de visuel déjà affichée. Retourne `null` quand rien n'est à faire ou que le résultat
 * ne se vérifie pas : la page d'origine est alors gardée telle quelle.
 */
export async function directLogo(o: { html: string; head: string; format: FormatDef; logos: BrandLogos; name: string; lang?: string; shoot?: boolean }): Promise<DirectedPage | null> {
  if (o.format.kind !== 'fixed' || !Object.values(o.logos).some((v) => typeof v === 'string' && v)) return null;
  try {
    return await withPage(pageDocument(o.html, o.head, { lang: o.lang, background: '#ffffff' }), { width: o.format.width, height: o.format.height }, async (page) => {
      // Les graphiques se dessinent par script : la mesure des images d'un visuel n'en a pas besoin.
      if (await page.$('canvas[data-idem-chart]')) return null;
      const variants = await measureVariants(page, o.logos);
      if (!variants.length) return null;
      const collected = (await page.evaluate(COLLECT)) as { w: number; h: number; current: (Box & { src?: string }) | null; obstacles: Box[] } | null;
      if (!collected || collected.w < 200 || collected.h < 200) return null;
      const root = await page.$('.ge-page');
      if (!root) return null;
      const bare = Buffer.from(await root.screenshot({ type: 'png' }));
      const input: PlanInput = { canvas: { w: collected.w, h: collected.h }, safe: o.format.safe, obstacles: collected.obstacles, current: collected.current ? { x: collected.current.x, y: collected.current.y, w: collected.current.w, h: collected.current.h } : null, variants };

      let decision: LogoDecision | null = null;
      for (const scale of [1, 0.82, 0.66]) {
        const candidates = plannedCandidates(input, scale);
        if (!candidates.length) continue;
        const regions = (await page.evaluate(`${ANALYZE}(${JSON.stringify(`data:image/png;base64,${bare.toString('base64')}`)}, ${JSON.stringify(candidates.map((c) => shrinkToInk(c.box, variants[0])))})`)) as Region[];
        decision = choose(input, candidates, regions);
        if (decision) break;
      }
      if (!decision) return null;

      // Le logo du gabarit reste en place, invisible (la mise en page ne bouge pas) ; le nouveau se pose par-dessus.
      let html = o.html;
      let replaced = false;
      html = html.replace(/<img\b[^>]*\bdata-ge-logo\b[^>]*>/i, (tag) => {
        if (replaced) return tag;
        replaced = true;
        return tag.replace(/\bdata-ge-logo\b/, 'data-ge-logo-space aria-hidden="true"').replace(/\sstyle="[^"]*"/i, '').replace(/>$/, ' style="visibility:hidden">');
      });
      const overlay = overlayHtml(decision, o.name);
      const close = html.lastIndexOf('</div>');
      if (close < 0) return null;
      html = `${html.slice(0, close)}${overlay}${html.slice(close)}`;

      // VÉRIFICATION : la page finale est rouverte ; le logo est où prévu, entier, dans la toile.
      return await withPage(pageDocument(html, o.head, { lang: o.lang, background: '#ffffff' }), { width: o.format.width, height: o.format.height }, async (final: Page) => {
        const check = (await final.evaluate(`(function () {
          var root = document.querySelector('.ge-page'), img = root && root.querySelector('img[data-ge-director]');
          if (!root || !img) return null;
          var rb = root.getBoundingClientRect(), r = img.getBoundingClientRect();
          return { x: r.left - rb.left, y: r.top - rb.top, w: r.width, h: r.height, cw: rb.width, ch: rb.height, loaded: img.complete && img.naturalWidth > 0 };
        })()`)) as { x: number; y: number; w: number; h: number; cw: number; ch: number; loaded: boolean } | null;
        const b = decision!.box;
        if (!check || !check.loaded || Math.abs(check.x - b.x) > 4 || Math.abs(check.y - b.y) > 4 || Math.abs(check.w - b.w) > 4 || check.x < 0 || check.y < 0 || check.x + check.w > check.cw + 1 || check.y + check.h > check.ch + 1) return null;
        const target = await final.$('.ge-page');
        const png = o.shoot && target ? Buffer.from(await target.screenshot({ type: 'png' })) : undefined;
        return { html, ...(png ? { png } : {}), decision: decision! };
      });
    });
  } catch {
    return null;
  }
}
