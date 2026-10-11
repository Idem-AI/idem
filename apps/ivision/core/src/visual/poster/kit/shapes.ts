/**
 * LES FORMES DU KIT — un générateur par forme, pur : (graine, couleurs, boîte) → SVG.
 *
 * Chaque forme est dessinée pour une boîte `w × h` en px (le viewBox est la boîte). Rien n'est
 * aléatoire au sens fort : le tirage est celui de la graine, donc rejouable (« même graine, même
 * forme ») — c'est ce qui permet de régénérer UNE forme sans recomposer le visuel.
 *
 * Aucun texte dans ces SVG (les mots sont ceux du rédacteur, ajustés par le rendu), aucune
 * ressource extérieure, aucun script.
 */
import { createNoise2D } from 'simplex-noise';
import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';
import { clamp, mixHex, n1, pick, polyline, pt, smoothClosed, smoothOpen, type Pt } from './math';
import type { GfxKind, GfxParams } from './types';

export interface G {
  w: number;
  h: number;
  p: GfxParams;
  /** Couleurs résolues de la forme. */
  c1: string;
  c2: string;
  ink: string;
  bg: string;
  u: number;
  rnd: () => number;
  seed: number;
  /** Identifiant unique pour les définitions (motifs, dégradés, filtres). */
  uid: (suffix: string) => string;
  /** Épaisseur de trait en px. */
  sw: number;
  density: number;
}

const f = n1;
const circle = (cx: number, cy: number, r: number, attrs: string) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;

// ─── Aplats ─────────────────────────────────────────────────────────────────

/** Une forme organique (galet, nuage, goutte) : points sur une ellipse, rayon tiré, courbe lisse. */
function blob(g: G): string {
  const v = g.p.variant || 'single';
  const shape = (scale: number, ox: number, oy: number, points = 8, jitter = 0.26): string => {
    const cx = g.w / 2 + ox * g.w;
    const cy = g.h / 2 + oy * g.h;
    const phase = g.rnd() * Math.PI;
    const out: Pt[] = [];
    for (let i = 0; i < points; i++) {
      const a = phase + (i / points) * Math.PI * 2;
      const k = 1 - jitter * g.rnd();
      out.push([cx + Math.cos(a) * (g.w / 2) * scale * k, cy + Math.sin(a) * (g.h / 2) * scale * k]);
    }
    return smoothClosed(out);
  };
  if (v === 'outline') return [1, 0.78, 0.56].map((s, i) => `<path d="${shape(s * 0.96, 0, 0, 8, 0.2)}" fill="none" stroke="${i % 2 ? g.c2 : g.c1}" stroke-width="${f(g.sw)}" stroke-linejoin="round"/>`).join('');
  if (v === 'duo') return `<path d="${shape(0.94, -0.03, -0.03)}" fill="${g.c1}"/><path d="${shape(0.46, 0.2, 0.17, 7, 0.2)}" fill="${g.c2}"/>`;
  return `<path d="${shape(0.96, 0, 0)}" fill="${g.c1}"/>`;
}

/** Cercles concentriques : au trait, en cible pleine, ou décentrés (effet de profondeur). */
function rings(g: G): string {
  const v = g.p.variant || 'lines';
  const R = Math.min(g.w, g.h) / 2;
  const cx = g.w / 2;
  const cy = g.h / 2;
  const n = clamp(3 + g.density, 4, 8);
  if (v === 'target') {
    let out = '';
    for (let i = n; i >= 1; i--) out += circle(cx, cy, (R * i) / n, `fill="${i % 2 ? g.c1 : g.c2}"`);
    return out;
  }
  const a = ((g.p.angle ?? -35) * Math.PI) / 180;
  let out = '';
  for (let i = 1; i <= n; i++) {
    const r = (R * 0.98 * i) / n;
    const shift = v === 'offset' ? (R - r) * 0.55 : 0;
    out += circle(cx + Math.cos(a) * shift, cy + Math.sin(a) * shift, r, `fill="none" stroke="${i % 3 === 0 ? g.c2 : g.c1}" stroke-width="${f(g.sw)}"`);
  }
  return out;
}

/** Une grille de modules (quarts, demi-cercles, disques) : le langage du Bauhaus. */
function arcs(g: G): string {
  const cols = clamp(Math.round(1.5 + g.density), 2, 7);
  const s = g.w / cols;
  const rows = Math.max(1, Math.round(g.h / s));
  const ch = g.h / rows;
  const cell = Math.min(s, ch);
  const modules = ['quarter', 'quarter', 'quarter', 'quarter', 'half', 'full', 'dot', 'empty'] as const;
  let out = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * s + (s - cell) / 2;
      const y = j * ch + (ch - cell) / 2;
      const fill = g.rnd() < 0.55 ? g.c1 : g.c2;
      const m = pick(g.rnd, modules);
      const rot = Math.floor(g.rnd() * 4) * 90;
      const wrap = (d: string) => `<path d="${d}" fill="${fill}" transform="rotate(${rot} ${f(x + cell / 2)} ${f(y + cell / 2)})"/>`;
      if (m === 'quarter') out += wrap(`M${f(x)},${f(y)}L${f(x + cell)},${f(y)}A${f(cell)},${f(cell)} 0 0 1 ${f(x)},${f(y + cell)}Z`);
      else if (m === 'half') out += wrap(`M${f(x)},${f(y)}L${f(x + cell)},${f(y)}A${f(cell / 2)},${f(cell / 2)} 0 0 1 ${f(x)},${f(y)}Z`);
      else if (m === 'full') out += circle(x + cell / 2, y + cell / 2, cell * 0.46, `fill="${fill}"`);
      else if (m === 'dot') out += circle(x + cell / 2, y + cell / 2, cell * 0.16, `fill="${fill}"`);
    }
  }
  return out;
}

/** Vagues : strates pleines qui se superposent (bas ou haut de page), ou lignes de flux. */
function waves(g: G): string {
  const v = g.p.variant || 'layers';
  const phase = g.rnd() * Math.PI * 2;
  const steps = 7;
  const curve = (baseY: number, amp: number, shift: number): Pt[] => {
    const pts: Pt[] = [];
    for (let j = 0; j <= steps; j++) {
      const x = -g.w * 0.1 + (g.w * 1.2 * j) / steps;
      pts.push([x, baseY + Math.sin(phase + j * 1.15 + shift) * amp + (g.rnd() - 0.5) * amp * 0.45]);
    }
    return pts;
  };
  if (v === 'lines') {
    const n = 7 + g.density * 2;
    let out = '';
    for (let i = 0; i < n; i++) out += `<path d="${smoothOpen(curve(g.h * (0.12 + (0.76 * i) / (n - 1)), g.h * 0.05, i * 0.22))}" fill="none" stroke="${i % 4 === 0 ? g.c2 : g.c1}" stroke-width="${f(g.sw)}" stroke-linecap="round"/>`;
    return out;
  }
  const n = clamp(2 + Math.round(g.density * 0.8), 3, 6);
  let out = '';
  for (let i = 0; i < n; i++) {
    const base = g.h * (0.3 + (0.62 * i) / n);
    out += `<path d="${smoothOpen(curve(base, g.h * 0.075 * (1 - i * 0.08), i * 0.7))}L${f(g.w * 1.1)},${f(g.h)}L${f(-g.w * 0.1)},${f(g.h)}Z" fill="${mixHex(g.c1, g.c2, n > 1 ? i / (n - 1) : 0)}"/>`;
  }
  return out;
}

/** Un soleil : des rayons alternés qui partent du centre de la boîte. */
function burst(g: G): string {
  const n = clamp(12 + g.density * 4, 16, 36);
  const R = Math.hypot(g.w, g.h);
  const cx = g.w / 2;
  const cy = g.h / 2;
  const base = ((g.p.angle ?? 0) * Math.PI) / 180;
  let d = '';
  for (let i = 0; i < n; i += 2) {
    const a0 = base + (i / n) * Math.PI * 2;
    const a1 = base + ((i + 1) / n) * Math.PI * 2;
    d += `M${f(cx)},${f(cy)}L${pt([cx + Math.cos(a0) * R, cy + Math.sin(a0) * R])}L${pt([cx + Math.cos(a1) * R, cy + Math.sin(a1) * R])}Z`;
  }
  return `<path d="${d}" fill="${g.c1}"/>`;
}

/** Lueurs d'aurore : des dégradés radiaux qui se mêlent (verre, aurore, futurisme). */
function mesh(g: G): string {
  const n = 3 + (g.density > 3 ? 1 : 0);
  const colors = [g.c1, g.c2, mixHex(g.c1, g.bg, 0.45), mixHex(g.c2, '#ffffff', 0.4)];
  let defs = '';
  let body = '';
  for (let i = 0; i < n; i++) {
    const id = g.uid(`m${i}`);
    const cx = g.w * (0.1 + g.rnd() * 0.8);
    const cy = g.h * (0.1 + g.rnd() * 0.8);
    const r = Math.max(g.w, g.h) * (0.38 + g.rnd() * 0.3);
    defs += `<radialGradient id="${id}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${colors[i % colors.length]}" stop-opacity="0.95"/><stop offset="1" stop-color="${colors[i % colors.length]}" stop-opacity="0"/></radialGradient>`;
    body += `<rect width="${f(g.w)}" height="${f(g.h)}" fill="url(#${id})"/>`;
  }
  return `<defs>${defs}</defs>${body}`;
}

// ─── Traits et trames ───────────────────────────────────────────────────────

/** Le champ de bruit d'une boîte, échantillonné sur une grille. */
function noiseField(g: G, cols: number, rows: number): number[] {
  const noise = createNoise2D(g.rnd);
  const fx = 0.7 + g.density * 0.13;
  const fy = (fx * g.h) / g.w;
  const out: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = (i / cols) * fx;
      const y = (j / rows) * fy;
      out.push(noise(x, y) * 0.78 + noise(x * 2.1, y * 2.1) * 0.22);
    }
  }
  return out;
}

/** Les courbes de niveau d'un champ (carrés marchants), recousues en tracés continus. */
function contourLines(values: number[], cols: number, rows: number, cw: number, ch: number, level: number): { pts: Pt[]; closed: boolean }[] {
  const segs: [Pt, Pt][] = [];
  const at = (i: number, j: number) => values[j * (cols + 1) + i];
  const edge = (x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): Pt => {
    // Ordre canonique : deux cellules voisines calculent le même point au bit près.
    if (x0 > x1 || (x0 === x1 && y0 > y1)) [x0, y0, v0, x1, y1, v1] = [x1, y1, v1, x0, y0, v0];
    const t = v1 === v0 ? 0.5 : (level - v0) / (v1 - v0);
    return [(x0 + (x1 - x0) * t) * cw, (y0 + (y1 - y0) * t) * ch];
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const tl = at(i, j);
      const tr = at(i + 1, j);
      const br = at(i + 1, j + 1);
      const bl = at(i, j + 1);
      const idx = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = () => edge(i, j, tl, i + 1, j, tr);
      const right = () => edge(i + 1, j, tr, i + 1, j + 1, br);
      const bottom = () => edge(i, j + 1, bl, i + 1, j + 1, br);
      const left = () => edge(i, j, tl, i, j + 1, bl);
      switch (idx) {
        case 1: case 14: segs.push([left(), bottom()]); break;
        case 2: case 13: segs.push([bottom(), right()]); break;
        case 3: case 12: segs.push([left(), right()]); break;
        case 4: case 11: segs.push([top(), right()]); break;
        case 5: segs.push([top(), right()], [left(), bottom()]); break;
        case 6: case 9: segs.push([top(), bottom()]); break;
        case 7: case 8: segs.push([top(), left()]); break;
        case 10: segs.push([top(), left()], [bottom(), right()]); break;
      }
    }
  }
  const key = (p: Pt) => `${Math.round(p[0] * 100)}_${Math.round(p[1] * 100)}`;
  const ends = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      ends.set(k, [...(ends.get(k) || []), i]);
    }
  });
  const used = new Set<number>();
  const out: { pts: Pt[]; closed: boolean }[] = [];
  const next = (p: Pt, from: number): number | undefined => (ends.get(key(p)) || []).find((i) => i !== from && !used.has(i));
  for (let s = 0; s < segs.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    const chain: Pt[] = [segs[s][0], segs[s][1]];
    for (const dir of ['fwd', 'back'] as const) {
      let cur = s;
      for (;;) {
        const tip = dir === 'fwd' ? chain[chain.length - 1] : chain[0];
        const n = next(tip, cur);
        if (n === undefined) break;
        used.add(n);
        cur = n;
        const [a, b] = segs[n];
        const other = key(a) === key(tip) ? b : a;
        if (dir === 'fwd') chain.push(other);
        else chain.unshift(other);
        if (key(other) === key(dir === 'fwd' ? chain[0] : chain[chain.length - 1])) break;
      }
    }
    const closed = chain.length > 3 && key(chain[0]) === key(chain[chain.length - 1]);
    if (closed) chain.pop();
    if (chain.length >= 4) out.push({ pts: chain, closed });
  }
  return out;
}

/** Courbes de niveau (relief) ou lignes de flux : la texture « éditoriale » par excellence. */
function contours(g: G): string {
  const v = g.p.variant || 'topo';
  if (v === 'flow') {
    const noise = createNoise2D(g.rnd);
    const n = 12 + g.density * 3;
    const steps = 12;
    let out = '';
    for (let i = 0; i < n; i++) {
      const base = (g.h * (i + 0.5)) / n;
      const pts: Pt[] = [];
      for (let j = 0; j <= steps; j++) {
        const x = (g.w * j) / steps;
        pts.push([x, base + noise((j / steps) * 2.2, i * 0.045) * g.h * 0.16]);
      }
      out += `<path d="${smoothOpen(pts)}" fill="none" stroke="${i % 5 === 0 ? g.c2 : g.c1}" stroke-width="${f(g.sw)}" stroke-linecap="round"/>`;
    }
    return out;
  }
  const cols = 30;
  const rows = clamp(Math.round((cols * g.h) / g.w), 8, 56);
  const cw = g.w / cols;
  const ch = g.h / rows;
  const values = noiseField(g, cols, rows);
  const levels = 6 + g.density;
  let out = '';
  for (let k = 0; k < levels; k++) {
    const level = -0.62 + (1.24 * (k + 0.5)) / levels;
    const index = k % 4 === 0;
    let d = '';
    for (const line of contourLines(values, cols, rows, cw, ch, level)) {
      // Les petites boucles sont du bruit, pas du relief.
      const xs = line.pts.map((q) => q[0]);
      const ys = line.pts.map((q) => q[1]);
      if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < g.u * 7) continue;
      const pts = line.pts.length > 10 ? line.pts.filter((_, i) => i % 2 === 0 || i === line.pts.length - 1) : line.pts;
      d += line.closed ? smoothClosed(pts) : smoothOpen(pts);
    }
    if (d) out += `<path d="${d}" fill="none" stroke="${index ? g.c2 : g.c1}" stroke-width="${f(index ? g.sw * 1.7 : g.sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Trame de points (demi-teinte) : la taille des points suit un dégradé. */
function dots(g: G): string {
  const v = g.p.variant || 'radial';
  const target = 330 + g.density * 45;
  const s = Math.max(g.u * 2.2, Math.sqrt((g.w * g.h) / target));
  const cols = Math.floor(g.w / s) + 1;
  const rows = Math.floor(g.h / s) + 1;
  const ox = (g.w - (cols - 1) * s) / 2;
  const oy = (g.h - (rows - 1) * s) / 2;
  const a = ((g.p.angle ?? 225) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const R = Math.hypot(g.w, g.h) * 0.8;
  const fx = g.w / 2 + dx * g.w * 0.5;
  const fy = g.h / 2 + dy * g.h * 0.5;
  // Des points = des traits de longueur nulle à bouts ronds, regroupés par taille : dix fois plus léger que des cercles.
  const LEVELS = 8;
  const buckets: string[] = Array.from({ length: LEVELS + 1 }, () => '');
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ox + i * s;
      const y = oy + j * s;
      let field = 1;
      if (v === 'radial') field = clamp(1 - Math.hypot(x - fx, y - fy) / R, 0, 1);
      else if (v === 'linear') field = clamp(0.5 + ((x - g.w / 2) * dx + (y - g.h / 2) * dy) / (Math.abs(g.w * dx) + Math.abs(g.h * dy) + 1), 0, 1);
      const q = Math.round(Math.pow(field, 0.8) * LEVELS);
      if (q < 1) continue;
      buckets[q] += `M${f(x)},${f(y)}h0`;
    }
  }
  return buckets.map((d, q) => (d ? `<path d="${d}" stroke="${g.c1}" stroke-width="${f(s * 0.96 * (q / LEVELS))}" stroke-linecap="round" fill="none"/>` : '')).join('');
}

/** Rayures : diagonales, verticales, horizontales ou hachures croisées (un motif, pas mille traits). */
function stripes(g: G): string {
  const v = g.p.variant || 'diagonal';
  const step = Math.max(g.u * 1.6, g.u * (5.2 - g.density * 0.7));
  const line = Math.max(1, g.sw);
  const angle = g.p.angle ?? (v === 'vertical' ? 90 : v === 'horizontal' ? 0 : 45);
  const tile = (id: string, rot: number, color: string) =>
    `<pattern id="${id}" width="${f(step)}" height="${f(step)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})"><rect width="${f(line)}" height="${f(step)}" fill="${color}"/></pattern>`;
  const a = g.uid('a');
  const b = g.uid('b');
  const hatch = v === 'hatch';
  return `<defs>${tile(a, angle, g.c1)}${hatch ? tile(b, angle + 90, g.c2) : ''}</defs><rect width="${f(g.w)}" height="${f(g.h)}" fill="url(#${a})"/>${hatch ? `<rect width="${f(g.w)}" height="${f(g.h)}" fill="url(#${b})"/>` : ''}`;
}

/** Grille technique : quadrillage fin, croix de repérage ou règle graduée (esprit suisse, éditorial). */
function grid(g: G): string {
  const v = g.p.variant || 'lines';
  const step = Math.max(g.u * 4, g.u * (13 - g.density * 1.6));
  const sw = Math.max(0.8, g.sw);
  if (v === 'ruler') {
    let d = '';
    const n = Math.floor(g.w / (step / 4));
    for (let i = 0; i <= n; i++) {
      const x = i * (step / 4);
      const len = i % 4 === 0 ? g.u * 2.4 : g.u * 1.2;
      d += `M${f(x)},0v${f(len)}`;
    }
    return `<path d="${d}" stroke="${g.c1}" stroke-width="${f(sw)}" fill="none"/>`;
  }
  if (v === 'cross') {
    const arm = g.u * 0.9;
    let d = '';
    for (let y = step / 2; y < g.h; y += step) for (let x = step / 2; x < g.w; x += step) d += `M${f(x - arm)},${f(y)}h${f(arm * 2)}M${f(x)},${f(y - arm)}v${f(arm * 2)}`;
    return `<path d="${d}" stroke="${g.c1}" stroke-width="${f(sw)}" fill="none" stroke-linecap="square"/>`;
  }
  const id = g.uid('g');
  return `<defs><pattern id="${id}" width="${f(step)}" height="${f(step)}" patternUnits="userSpaceOnUse"><path d="M${f(step)},0H0V${f(step)}" fill="none" stroke="${g.c1}" stroke-width="${f(sw)}"/></pattern></defs><rect width="${f(g.w)}" height="${f(g.h)}" fill="url(#${id})"/>`;
}

/** Un trait de pinceau (perfect-freehand) : soulignement, surligneur, balafre. */
function swash(g: G): string {
  const v = g.p.variant || 'underline';
  const pts: [number, number, number][] = [];
  const phase = g.rnd() * 2;
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = g.w * (0.03 + 0.94 * t);
    let y = g.h * 0.5;
    if (v === 'underline') y += Math.sin(t * Math.PI * 1.2 + phase) * g.h * 0.08 + (g.rnd() - 0.5) * g.h * 0.02;
    if (v === 'slash') {
      x = g.w * (0.06 + 0.88 * t);
      y = g.h * (0.92 - 0.84 * t) + (g.rnd() - 0.5) * g.h * 0.03;
    }
    if (v === 'highlight') y += Math.sin(t * Math.PI * 2 + phase) * g.h * 0.03;
    pts.push([x, y, 0.55 + Math.sin(t * Math.PI) * 0.45]);
  }
  const size = v === 'highlight' ? g.h * 0.78 : v === 'slash' ? Math.min(g.w, g.h) * 0.13 : g.h * 0.32;
  const outline = getStroke(pts, { size, thinning: v === 'highlight' ? 0.04 : 0.3, smoothing: 0.6, streamline: 0.5, simulatePressure: false, start: { taper: v === 'highlight' ? 0 : size * 2.2, cap: true }, end: { taper: v === 'highlight' ? 0 : size * 2.2, cap: true } });
  if (outline.length < 4) return '';
  const avg = (a: number, b: number) => (a + b) / 2;
  let d = `M${pt(outline[0] as Pt)}Q${pt(outline[1] as Pt)} ${f(avg(outline[1][0], outline[2][0]))},${f(avg(outline[1][1], outline[2][1]))}T`;
  for (let i = 2; i < outline.length - 1; i++) d += `${f(avg(outline[i][0], outline[i + 1][0]))},${f(avg(outline[i][1], outline[i + 1][1]))} `;
  return `<path d="${d.trim()}Z" fill="${g.c1}"/>`;
}

const short = (d: string) => d.replace(/(-?\d+\.\d)\d+/g, '$1');

/** Un geste à la main (roughjs) : cercle autour d'un mot, flèche, soulignement ondulé, zigzag. */
function scribble(g: G): string {
  const v = g.p.variant || 'circle';
  const gen = rough.generator();
  const o = { seed: (g.seed % 9000) + 1, roughness: 1.5, bowing: 2, strokeWidth: g.sw };
  const draw = (drawable: ReturnType<typeof gen.line>) =>
    gen
      .toPaths(drawable)
      .map((p) => `<path d="${short(p.d)}" fill="none" stroke="${g.c1}" stroke-width="${f(g.sw)}" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
  if (v === 'underline') {
    return draw(gen.curve([[g.w * 0.02, g.h * 0.55], [g.w * 0.3, g.h * 0.38], [g.w * 0.62, g.h * 0.62], [g.w * 0.98, g.h * 0.42]], o)) + draw(gen.curve([[g.w * 0.1, g.h * 0.8], [g.w * 0.45, g.h * 0.68], [g.w * 0.9, g.h * 0.84]], { ...o, seed: o.seed + 7 }));
  }
  if (v === 'arrow') {
    const x1 = g.w * 0.94;
    const y1 = g.h * 0.2;
    const body = draw(gen.curve([[g.w * 0.05, g.h * 0.88], [g.w * 0.3, g.h * 0.55], [g.w * 0.62, g.h * 0.32], [x1, y1]], o));
    const head = draw(gen.linearPath([[x1 - g.w * 0.14, y1 - g.h * 0.02], [x1, y1], [x1 - g.w * 0.04, y1 + g.h * 0.2]], { ...o, seed: o.seed + 3 }));
    return body + head;
  }
  if (v === 'zigzag') {
    const pts: [number, number][] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) pts.push([g.w * (0.03 + (0.94 * i) / n), g.h * (i % 2 ? 0.2 : 0.8)]);
    return draw(gen.linearPath(pts, o));
  }
  return draw(gen.ellipse(g.w / 2, g.h / 2, g.w * 0.94, g.h * 0.84, { ...o, roughness: 1.7 }));
}

/** Cadres : décalé (ombre dure), repères de coupe, double filet. */
function frame(g: G): string {
  const v = g.p.variant || 'offset';
  const sw = Math.max(1, g.sw);
  const m = sw;
  if (v === 'corners') {
    const a = Math.min(g.w, g.h) * 0.14;
    const x0 = m;
    const y0 = m;
    const x1 = g.w - m;
    const y1 = g.h - m;
    const d = `M${f(x0)},${f(y0 + a)}V${f(y0)}H${f(x0 + a)}M${f(x1 - a)},${f(y0)}H${f(x1)}V${f(y0 + a)}M${f(x1)},${f(y1 - a)}V${f(y1)}H${f(x1 - a)}M${f(x0 + a)},${f(y1)}H${f(x0)}V${f(y1 - a)}`;
    return `<path d="${d}" fill="none" stroke="${g.c1}" stroke-width="${f(sw)}" stroke-linecap="square"/>`;
  }
  if (v === 'double') {
    const gap = Math.max(g.u * 1.1, sw * 3);
    return `<rect x="${f(m)}" y="${f(m)}" width="${f(g.w - 2 * m)}" height="${f(g.h - 2 * m)}" fill="none" stroke="${g.c1}" stroke-width="${f(sw)}"/><rect x="${f(m + gap)}" y="${f(m + gap)}" width="${f(g.w - 2 * (m + gap))}" height="${f(g.h - 2 * (m + gap))}" fill="none" stroke="${g.c1}" stroke-width="${f(sw)}"/>`;
  }
  const off = Math.max(g.u * 1.4, sw * 3);
  return `<rect x="${f(off + m)}" y="${f(off + m)}" width="${f(g.w - off - 2 * m)}" height="${f(g.h - off - 2 * m)}" fill="${g.c2}"/><rect x="${f(m)}" y="${f(m)}" width="${f(g.w - off - 2 * m)}" height="${f(g.h - off - 2 * m)}" fill="none" stroke="${g.c1}" stroke-width="${f(sw)}"/>`;
}

/** Tissage : bandes géométriques inspirées des étoffes d'Afrique de l'Ouest (kente, bogolan, wax). */
function weave(g: G): string {
  const v = g.p.variant || 'zigzag';
  const t = Math.max(g.u * 3, g.u * (9 - g.density));
  const id = g.uid('w');
  const sw = Math.max(1, g.sw);
  let tile = '';
  if (v === 'diamond') {
    tile = `<path d="M${f(t / 2)},${f(t * 0.06)}L${f(t * 0.94)},${f(t / 2)}L${f(t / 2)},${f(t * 0.94)}L${f(t * 0.06)},${f(t / 2)}Z" fill="${g.c1}"/><path d="M${f(t / 2)},${f(t * 0.3)}L${f(t * 0.7)},${f(t / 2)}L${f(t / 2)},${f(t * 0.7)}L${f(t * 0.3)},${f(t / 2)}Z" fill="${g.c2}"/>`;
  } else if (v === 'saw') {
    tile = `<path d="M0,${f(t)}L${f(t / 2)},${f(t * 0.1)}L${f(t)},${f(t)}Z" fill="${g.c1}"/><path d="M${f(t / 2)},${f(t)}L${f(t * 0.75)},${f(t * 0.55)}L${f(t)},${f(t)}Z" fill="${g.c2}"/>`;
  } else if (v === 'mud') {
    tile = `<rect x="${f(t * 0.4)}" y="0" width="${f(t * 0.2)}" height="${f(t)}" fill="${g.c1}"/><path d="M${f(t * 0.1)},${f(t * 0.25)}h${f(t * 0.8)}M${f(t * 0.1)},${f(t * 0.75)}h${f(t * 0.8)}" stroke="${g.c2}" stroke-width="${f(sw)}" fill="none"/>${circle(t * 0.15, t * 0.5, t * 0.07, `fill="${g.c2}"`)}${circle(t * 0.85, t * 0.5, t * 0.07, `fill="${g.c2}"`)}`;
  } else {
    tile = `<path d="M0,${f(t * 0.7)}L${f(t / 4)},${f(t * 0.3)}L${f(t / 2)},${f(t * 0.7)}L${f(t * 0.75)},${f(t * 0.3)}L${f(t)},${f(t * 0.7)}" fill="none" stroke="${g.c1}" stroke-width="${f(sw * 1.4)}" stroke-linejoin="miter"/><path d="M0,${f(t * 0.95)}H${f(t)}" stroke="${g.c2}" stroke-width="${f(sw)}"/>`;
  }
  return `<defs><pattern id="${id}" width="${f(t)}" height="${f(t)}" patternUnits="userSpaceOnUse">${tile}</pattern></defs><rect width="${f(g.w)}" height="${f(g.h)}" fill="url(#${id})"/>`;
}

/** Grain de film / papier : bruit fractal gris, à poser en recouvrement (overlay). */
function grain(g: G): string {
  const id = g.uid('n');
  const freq = g.p.variant === 'coarse' ? 0.55 : g.p.variant === 'paper' ? 0.04 : 0.85;
  const octaves = g.p.variant === 'paper' ? 4 : 2;
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${g.seed % 997}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1"/></filter><rect width="${f(g.w)}" height="${f(g.h)}" filter="url(#${id})"/>`;
}

/** Les générateurs par forme (le pictogramme est posé par le rendu : il lit les bibliothèques d'icônes). */
export const SHAPES: Partial<Record<GfxKind, (g: G) => string>> = { blob, rings, arcs, waves, contours, dots, stripes, burst, grid, swash, scribble, frame, mesh, weave, grain };

export { polyline };
