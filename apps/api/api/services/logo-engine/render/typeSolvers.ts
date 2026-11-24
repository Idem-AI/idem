/**
 * SOLVEURS TYPOGRAPHIQUES — ce qu'un typographe règle à l'œil, calculé sur les contours.
 *
 *   espacement optique   l'espace entre deux lettres se juge à la SURFACE blanche qui les sépare,
 *                        pas à la distance de leurs boîtes : « AV » paraît trop large, « HI » juste.
 *                        On mesure ligne par ligne la distance entre le profil droit de l'une et le
 *                        profil gauche de l'autre, en bornant la profondeur (une contre-forme ouverte
 *                        comme celle du « L » ne compte pas toute), et on égalise.
 *   jambage partagé      deux initiales qui partagent un même fût : on cherche le décalage où le
 *                        dernier trait de l'une coïncide avec le premier de l'autre.
 *   contre-forme         le centre du plus grand cercle inscrit dans le creux d'une lettre : l'endroit
 *                        exact où poser un point, une feuille, un éclat.
 *
 * Tout passe par les mesures facultatives du noyau (`rowIntervals`, `contains`, `distanceToEdge`) :
 * sans elles, les solveurs rendent `null` et le texte garde son crénage de police.
 */
import type { GeometryKernel, Shape } from '../kernel/geometry';

const ROWS = 28;

type Profiles = { left: (number | null)[]; right: (number | null)[] };

/**
 * Cache des profils, indexé par le tracé exact des lettres : l'affineur reconstruit le même nom des
 * dizaines de fois, ses lettres ne changent pas. Borné (les plus anciens sortent en premier).
 */
const PROFILE_CACHE = new Map<string, Profiles>();
const PROFILE_CACHE_MAX = 4000;

/** Profils gauche et droit d'une forme sur des lignes de la zone de capitale (y de −cap à 0). */
function profiles(kernel: GeometryKernel, shapes: Shape[], capHeight: number): Profiles | null {
  if (!kernel.rowIntervals) return null;
  const key = `${kernel.name}|${capHeight.toFixed(3)}|${shapes.map((s) => s.d).join('|')}`;
  const cached = PROFILE_CACHE.get(key);
  if (cached) return cached;
  const computed = computeProfiles(kernel, shapes, capHeight);
  if (PROFILE_CACHE.size >= PROFILE_CACHE_MAX) PROFILE_CACHE.delete(PROFILE_CACHE.keys().next().value as string);
  PROFILE_CACHE.set(key, computed);
  return computed;
}

function computeProfiles(kernel: GeometryKernel, shapes: Shape[], capHeight: number): Profiles {
  if (!kernel.rowIntervals) return { left: [], right: [] };
  const left: (number | null)[] = [];
  const right: (number | null)[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = -capHeight * ((r + 0.5) / ROWS);
    let lo = Infinity;
    let hi = -Infinity;
    for (const shape of shapes)
      for (const [x0, x1] of kernel.rowIntervals(shape, y)) {
        lo = Math.min(lo, x0);
        hi = Math.max(hi, x1);
      }
    left.push(Number.isFinite(lo) ? lo : null);
    right.push(Number.isFinite(hi) ? hi : null);
  }
  return { left, right };
}

/**
 * Espace optique entre deux glyphes voisins : moyenne, sur les lignes où l'un des deux a de
 * l'encre, de la distance profil droit → profil gauche, bornée à `minGap + depth`.
 */
export function opticalGap(kernel: GeometryKernel, a: Shape[], b: Shape[], capHeight: number): number | null {
  const pa = profiles(kernel, a, capHeight);
  const pb = profiles(kernel, b, capHeight);
  if (!pa || !pb) return null;
  const both: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    const ra = pa.right[r];
    const lb = pb.left[r];
    if (ra !== null && lb !== null) both.push(lb - ra);
  }
  if (!both.length) return null;
  const minGap = Math.min(...both);
  const depth = capHeight * 0.25;
  let sum = 0;
  let rows = 0;
  for (let r = 0; r < ROWS; r++) {
    const ra = pa.right[r];
    const lb = pb.left[r];
    if (ra === null && lb === null) continue;
    sum += ra !== null && lb !== null ? Math.min(lb - ra, minGap + depth) : minGap + depth;
    rows++;
  }
  return rows ? sum / rows : null;
}

/**
 * Décalages qui égalisent l'espace optique d'un mot. `glyphs[i]` = formes de la lettre i (vide
 * pour une espace : les paires de part et d'autre d'une espace ne sont pas touchées). Renvoie
 * le décalage CUMULÉ à appliquer à chaque lettre, borné à ±20 % de la capitale par paire.
 */
export function opticalSpacing(kernel: GeometryKernel, glyphs: Shape[][], capHeight: number): number[] | null {
  if (!kernel.rowIntervals || glyphs.length < 3) return null;
  const pairs: { k: number; gap: number }[] = [];
  for (let k = 1; k < glyphs.length; k++) {
    if (!glyphs[k].length || !glyphs[k - 1].length) continue;
    const gap = opticalGap(kernel, glyphs[k - 1], glyphs[k], capHeight);
    if (gap !== null) pairs.push({ k, gap });
  }
  if (pairs.length < 2) return null;
  const target = pairs.reduce((s, p) => s + p.gap, 0) / pairs.length;
  const shift = new Array(glyphs.length).fill(0);
  for (const p of pairs) shift[p.k] = Math.max(-0.2 * capHeight, Math.min(0.2 * capHeight, target - p.gap));
  let acc = 0;
  return shift.map((s) => (acc += s));
}

/**
 * Jambage partagé : le décalage (vers la gauche) qui fait coïncider le dernier trait de `a` avec
 * le premier de `b` sur au moins 45 % de la hauteur. `null` : ces deux lettres n'ont pas de fût commun.
 */
export function sharedStemShift(kernel: GeometryKernel, a: Shape[], b: Shape[], capHeight: number): number | null {
  if (!kernel.rowIntervals) return null;
  const rows: { a: [number, number]; b: [number, number] }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = -capHeight * ((r + 0.5) / ROWS);
    const ia = a.flatMap((s) => kernel.rowIntervals!(s, y)).sort((p, q) => p[0] - q[0]);
    const ib = b.flatMap((s) => kernel.rowIntervals!(s, y)).sort((p, q) => p[0] - q[0]);
    if (ia.length && ib.length) rows.push({ a: ia[ia.length - 1], b: ib[0] });
  }
  if (rows.length < ROWS * 0.45) return null;
  const tol = capHeight * 0.04;
  let best = { s: 0, score: 0 };
  for (let step = 0; step <= 80; step++) {
    const s = (step / 80) * capHeight * 1.2;
    const score = rows.filter(({ a: ra, b: rb }) => Math.abs(ra[0] - (rb[0] - s)) < tol && Math.abs(ra[1] - (rb[1] - s)) < tol).length;
    if (score > best.score) best = { s, score };
  }
  return best.score >= ROWS * 0.45 ? best.s : null;
}

/**
 * Repli du monogramme sans fût commun (« KB », « AV ») : le décalage qui amène les deux lettres
 * au contact, avec un léger recouvrement (4 % de la capitale) pour qu'elles fusionnent.
 */
export function touchShift(kernel: GeometryKernel, a: Shape[], b: Shape[], capHeight: number): number | null {
  const pa = profiles(kernel, a, capHeight);
  const pb = profiles(kernel, b, capHeight);
  if (!pa || !pb) return null;
  let min = Infinity;
  for (let r = 0; r < ROWS; r++) {
    const ra = pa.right[r];
    const lb = pb.left[r];
    if (ra !== null && lb !== null) min = Math.min(min, lb - ra);
  }
  return Number.isFinite(min) ? min + capHeight * 0.04 : null;
}

/**
 * Le plus grand cercle inscrit dans le creux d'une lettre (contre-forme fermée la plus grande).
 * Recherche sur une grille puis affinage local ; `null` si la lettre n'a pas de creux.
 */
export function counterCircle(kernel: GeometryKernel, glyph: Shape): { cx: number; cy: number; r: number } | null {
  if (!kernel.contains || !kernel.distanceToEdge) return null;
  const contours = kernel.contours(glyph);
  if (contours.length < 2) return null;
  const outer = [...contours].sort((p, q) => q.bounds.w * q.bounds.h - p.bounds.w * p.bounds.h)[0];
  // Un creux : contenu dans la boîte du corps, et hors de l'encre (le point d'un « i » est hors de la boîte du fût).
  const holes = contours.filter((c) => c !== outer && c.bounds.x >= outer.bounds.x && c.bounds.y >= outer.bounds.y && c.bounds.x + c.bounds.w <= outer.bounds.x + outer.bounds.w && c.bounds.y + c.bounds.h <= outer.bounds.y + outer.bounds.h && !kernel.contains!(glyph, c.bounds.x + c.bounds.w / 2, c.bounds.y + c.bounds.h / 2));
  if (!holes.length) return null;
  const hole = holes.sort((p, q) => q.bounds.w * q.bounds.h - p.bounds.w * p.bounds.h)[0];
  const b = hole.bounds;
  let best = { cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: 0 };
  const n = 12;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = b.x + ((i + 0.5) / n) * b.w;
      const y = b.y + ((j + 0.5) / n) * b.h;
      if (!kernel.contains(hole, x, y)) continue;
      const r = kernel.distanceToEdge(hole, x, y);
      if (r > best.r) best = { cx: x, cy: y, r };
    }
  // Affinage : pas décroissant autour du meilleur point.
  let step = Math.min(b.w, b.h) / n;
  for (let k = 0; k < 12 && best.r > 0; k++) {
    let moved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = best.cx + dx * step;
      const y = best.cy + dy * step;
      if (!kernel.contains(hole, x, y)) continue;
      const r = kernel.distanceToEdge(hole, x, y);
      if (r > best.r) {
        best = { cx: x, cy: y, r };
        moved = true;
      }
    }
    if (!moved) step /= 2;
  }
  return best.r > 0 ? best : null;
}
