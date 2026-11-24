/**
 * MESURES PERCEPTIVES SUR PIXELS — ce que la géométrie d'un logo dit à l'œil, sans modèle.
 *
 *   symétrie     recouvrement (IoU) de l'encre avec ses miroirs et ses rotations, autour de la boîte d'encre
 *   topologie    nombres de Betti : β0 morceaux d'encre, β1 trous (contre-formes)
 *   trait        régularité de l'épaisseur (transformée de distance, crêtes) : 1 = monoligne
 *   compacité    4πA/P² : 1 = disque, proche de 0 = forme découpée, anguleuse ou filaire
 *   Hu           sept invariants de forme (translation, échelle, rotation) pour l'empreinte
 *   rythme       régularité des espaces optiques entre lettres d'un nom (approche de l'œil)
 *
 * Toutes les fonctions lisent un masque binaire (alpha ≥ 128) et ignorent les poussières.
 */
import type { RasterImage } from './rasterizer';

export interface Mask {
  w: number;
  h: number;
  /** 1 = encre. */
  data: Uint8Array;
}

export function toMask(image: RasterImage, threshold = 128): Mask {
  const data = new Uint8Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) data[i] = image.rgba[i * 4 + 3] >= threshold ? 1 : 0;
  return { w: image.width, h: image.height, data };
}

/** Le masque recadré sur sa boîte d'encre, centré dans un carré (marge 1 px) : la symétrie se lit autour de la forme, pas du canevas. */
export function squareCrop(mask: Mask): Mask | null {
  let x0 = mask.w;
  let y0 = mask.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++)
      if (mask.data[y * mask.w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const side = Math.max(bw, bh) + 2;
  const ox = Math.floor((side - bw) / 2);
  const oy = Math.floor((side - bh) / 2);
  const data = new Uint8Array(side * side);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) data[(y + oy) * side + x + ox] = mask.data[(y + y0) * mask.w + x + x0];
  return { w: side, h: side, data };
}

export interface SymmetryScores {
  /** Miroir gauche/droite (axe vertical). */
  mirrorX: number;
  /** Miroir haut/bas (axe horizontal). */
  mirrorY: number;
  rot180: number;
  rot90: number;
  /** La meilleure des quatre. */
  best: number;
  /** Le groupe reconnu : `none`, `mirror`, `C2`, `C4`, `D2`, `D4`. */
  group: string;
}

const SYMMETRIC = 0.9;

/** IoU d'un masque carré avec sa transformée par `map` (x, y → index source). */
function iou(m: Mask, map: (x: number, y: number) => number): number {
  let inter = 0;
  let union = 0;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const a = m.data[y * m.w + x];
      const b = m.data[map(x, y)];
      if (a && b) inter++;
      if (a || b) union++;
    }
  return union ? inter / union : 0;
}

export function symmetryOf(mask: Mask): SymmetryScores {
  const m = squareCrop(mask);
  if (!m) return { mirrorX: 0, mirrorY: 0, rot180: 0, rot90: 0, best: 0, group: 'none' };
  const n = m.w;
  const mirrorX = iou(m, (x, y) => y * n + (n - 1 - x));
  const mirrorY = iou(m, (x, y) => (n - 1 - y) * n + x);
  const rot180 = iou(m, (x, y) => (n - 1 - y) * n + (n - 1 - x));
  const rot90 = iou(m, (x, y) => (n - 1 - x) * n + y);
  const best = Math.max(mirrorX, mirrorY, rot180, rot90);
  const mirror = mirrorX >= SYMMETRIC || mirrorY >= SYMMETRIC;
  const group = rot90 >= SYMMETRIC ? (mirror ? 'D4' : 'C4') : rot180 >= SYMMETRIC ? (mirrorX >= SYMMETRIC && mirrorY >= SYMMETRIC ? 'D2' : 'C2') : mirror ? 'mirror' : 'none';
  return { mirrorX: r3(mirrorX), mirrorY: r3(mirrorY), rot180: r3(rot180), rot90: r3(rot90), best: r3(best), group };
}

/**
 * IoU de l'encre avec sa rotation de `deg` autour du centroïde (le centre d'un groupe Cn est son
 * centroïde, pas le centre de sa boîte : un trèfle à 3 branches n'est pas centré dans sa boîte).
 */
export function rotationIoU(mask: Mask, deg: number): number {
  const { w, h, data } = mask;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[y * w + x]) {
        n++;
        sx += x;
        sy += y;
      }
  if (!n) return 0;
  const cx = sx / n;
  const cy = sy / n;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let inter = 0;
  let union = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = data[y * w + x];
      // Pixel source de la rotation inverse (plus proche voisin).
      const dx = x - cx;
      const dy = y - cy;
      const srcX = Math.round(cx + dx * cos + dy * sin);
      const srcY = Math.round(cy - dx * sin + dy * cos);
      const b = srcX >= 0 && srcY >= 0 && srcX < w && srcY < h ? data[srcY * w + srcX] : 0;
      if (a && b) inter++;
      if (a || b) union++;
    }
  return union ? r3(inter / union) : 0;
}

/** Symétrie mesurée pour un groupe DÉCLARÉ (`C6`, `D4`, `mirror`…) : 1 = tenue exactement. */
export function declaredSymmetry(mask: Mask, group: string): number | null {
  const match = /^([CD])(\d+)$/.exec(group);
  if (group === 'mirror') return symmetryOf(mask).mirrorX;
  if (!match) return null;
  const order = Number(match[2]);
  const rotation = order > 1 ? rotationIoU(mask, 360 / order) : 1;
  return match[1] === 'D' ? Math.min(rotation, symmetryOf(mask).mirrorX) : rotation;
}

export interface Components {
  count: number;
  /** Étiquette par pixel (0 = aucune). */
  labels: Int32Array;
  sizes: number[];
  boxes: { x0: number; y0: number; x1: number; y1: number }[];
}

/** Composantes connexes de la valeur `value` (8-voisinage pour l'encre, 4 pour le fond). Les poussières (< minSize) sont écartées. */
export function components(mask: Mask, value: 0 | 1, minSize: number): Components {
  const { w, h, data } = mask;
  const labels = new Int32Array(w * h);
  const sizes: number[] = [];
  const boxes: Components['boxes'] = [];
  const eight = value === 1;
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < w * h; start++) {
    if (data[start] !== value || labels[start]) continue;
    next++;
    labels[start] = next;
    stack.push(start);
    let size = 0;
    const box = { x0: w, y0: h, x1: -1, y1: -1 };
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      size++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (data[j] === value && !labels[j]) {
            labels[j] = next;
            stack.push(j);
          }
        }
    }
    sizes.push(size);
    boxes.push(box);
  }
  // Poussières : étiquette conservée mais ni comptée ni renvoyée.
  const keep = sizes.map((s) => s >= minSize);
  const remap = new Int32Array(next + 1);
  const keptSizes: number[] = [];
  const keptBoxes: Components['boxes'] = [];
  for (let k = 1; k <= next; k++)
    if (keep[k - 1]) {
      keptSizes.push(sizes[k - 1]);
      keptBoxes.push(boxes[k - 1]);
      remap[k] = keptSizes.length;
    }
  for (let i = 0; i < labels.length; i++) labels[i] = remap[labels[i]];
  return { count: keptSizes.length, labels, sizes: keptSizes, boxes: keptBoxes };
}

export interface Topology {
  /** β0 : morceaux d'encre. */
  pieces: number;
  /** β1 : trous (zones de fond enfermées). */
  holes: number;
  /** χ = β0 − β1. */
  euler: number;
  /** Aire du plus petit trou, en part de l'encre (une contre-forme qui se bouche). */
  smallestHole: number;
}

export function topologyOf(mask: Mask): Topology {
  const ink = mask.data.reduce((s, v) => s + v, 0);
  const dust = Math.max(2, Math.round(ink * 0.004));
  const pieces = components(mask, 1, dust).count;
  const bg = components(mask, 0, dust);
  let holes = 0;
  let smallest = Infinity;
  bg.boxes.forEach((b, i) => {
    const touches = b.x0 === 0 || b.y0 === 0 || b.x1 === mask.w - 1 || b.y1 === mask.h - 1;
    if (touches) return;
    holes++;
    smallest = Math.min(smallest, bg.sizes[i]);
  });
  return { pieces, holes, euler: pieces - holes, smallestHole: holes && ink ? r3(smallest / ink) : 0 };
}

/** Transformée de distance chanfrein 3-4 (distance de chaque pixel d'encre au fond, en pixels). */
export function distanceTransform(mask: Mask): Float32Array {
  const { w, h, data } = mask;
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = data[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/**
 * Régularité du trait : sur les crêtes de la transformée de distance (l'axe médian des formes),
 * la demi-épaisseur locale. 1 − coefficient de variation : 1 = épaisseur constante (monoligne,
 * géométrique), bas = graisses qui se contredisent. Les grandes masses pleines (disques, aplats)
 * n'ont qu'une crête courte : elles ne pénalisent pas.
 */
export function strokeConsistency(mask: Mask): { consistency: number; meanHalfWidth: number } {
  const { w, h } = mask;
  const d = distanceTransform(mask);
  const ridge: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const v = d[y * w + x];
      if (v < 1.5) continue;
      let max = true;
      for (let dy = -1; dy <= 1 && max; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && d[(y + dy) * w + x + dx] > v) max = false;
      if (max) ridge.push(v);
    }
  if (ridge.length < 4) return { consistency: 1, meanHalfWidth: ridge[0] ?? 0 };
  const mean = ridge.reduce((s, v) => s + v, 0) / ridge.length;
  const sd = Math.sqrt(ridge.reduce((s, v) => s + (v - mean) ** 2, 0) / ridge.length);
  return { consistency: r3(Math.max(0, 1 - sd / mean)), meanHalfWidth: r3(mean) };
}

/** Compacité isopérimétrique 4πA/P² (périmètre corrigé du crénelage par π/4). */
export function compactnessOf(mask: Mask): number {
  const { w, h, data } = mask;
  let area = 0;
  let edges = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      area++;
      if (x === 0 || !data[y * w + x - 1]) edges++;
      if (x === w - 1 || !data[y * w + x + 1]) edges++;
      if (y === 0 || !data[(y - 1) * w + x]) edges++;
      if (y === h - 1 || !data[(y + 1) * w + x]) edges++;
    }
  const perimeter = edges * (Math.PI / 4);
  return perimeter ? r3(Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter))) : 0;
}

/** Les sept moments de Hu, en échelle logarithmique signée (comparables entre eux). */
export function huMoments(mask: Mask): number[] {
  const { w, h, data } = mask;
  let m00 = 0;
  let m10 = 0;
  let m01 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[y * w + x]) {
        m00++;
        m10 += x;
        m01 += y;
      }
  if (!m00) return [0, 0, 0, 0, 0, 0, 0];
  const cx = m10 / m00;
  const cy = m01 / m00;
  const mu: Record<string, number> = { '20': 0, '02': 0, '11': 0, '30': 0, '03': 0, '21': 0, '12': 0 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      const dx = x - cx;
      const dy = y - cy;
      mu['20'] += dx * dx;
      mu['02'] += dy * dy;
      mu['11'] += dx * dy;
      mu['30'] += dx * dx * dx;
      mu['03'] += dy * dy * dy;
      mu['21'] += dx * dx * dy;
      mu['12'] += dx * dy * dy;
    }
  const eta = (p: number, q: number) => mu[`${p}${q}`] / Math.pow(m00, 1 + (p + q) / 2);
  const n20 = eta(2, 0);
  const n02 = eta(0, 2);
  const n11 = eta(1, 1);
  const n30 = eta(3, 0);
  const n03 = eta(0, 3);
  const n21 = eta(2, 1);
  const n12 = eta(1, 2);
  const a = n30 + n12;
  const b = n21 + n03;
  const hu = [
    n20 + n02,
    (n20 - n02) ** 2 + 4 * n11 ** 2,
    (n30 - 3 * n12) ** 2 + (3 * n21 - n03) ** 2,
    a ** 2 + b ** 2,
    (n30 - 3 * n12) * a * (a ** 2 - 3 * b ** 2) + (3 * n21 - n03) * b * (3 * a ** 2 - b ** 2),
    (n20 - n02) * (a ** 2 - b ** 2) + 4 * n11 * a * b,
    (3 * n21 - n03) * a * (a ** 2 - 3 * b ** 2) - (n30 - 3 * n12) * b * (3 * a ** 2 - b ** 2),
  ];
  // Log signé : le 7e moment change de signe avec un miroir ; on garde la valeur absolue (un logo retourné est le même).
  return hu.map((v) => (Math.abs(v) < 1e-12 ? 0 : r3(-Math.log10(Math.abs(v)))));
}

/** Distance entre deux vecteurs de Hu (0 = même silhouette, 1 = sans rapport). */
export function huDistance(a: number[], b: number[]): number {
  // Les 4 premiers moments sont les plus stables : ils portent l'essentiel.
  const weights = [1, 0.8, 0.5, 0.5, 0.2, 0.2, 0.1];
  let sum = 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const scale = Math.max(1, Math.abs(a[i] ?? 0), Math.abs(b[i] ?? 0));
    sum += weights[i] * Math.min(1, Math.abs((a[i] ?? 0) - (b[i] ?? 0)) / scale);
    total += weights[i];
  }
  return r3(sum / total);
}

/**
 * Rythme d'un nom : les glyphes (composantes regroupées quand elles se chevauchent en x, pour
 * les points des i/j et les accents), puis, pour chaque paire voisine, l'espace optique moyen
 * — distance horizontale de l'encre de gauche à celle de droite, ligne par ligne, là où les deux
 * ont de l'encre. 1 − coefficient de variation : 1 = espacement que l'œil lit comme régulier.
 */
export function letterRhythm(mask: Mask): { rhythm: number; glyphs: number; gaps: number[] } {
  const comps = components(mask, 1, Math.max(2, Math.round(mask.w * mask.h * 0.0002)));
  const groups: { x0: number; x1: number; ids: number[] }[] = [];
  comps.boxes
    .map((b, i) => ({ ...b, id: i + 1 }))
    .sort((p, q) => p.x0 - q.x0)
    .forEach((b) => {
      const last = groups[groups.length - 1];
      const overlap = last ? Math.min(last.x1, b.x1) - Math.max(last.x0, b.x0) : -1;
      if (last && overlap > 0.5 * Math.min(last.x1 - last.x0 + 1, b.x1 - b.x0 + 1)) {
        last.x1 = Math.max(last.x1, b.x1);
        last.ids.push(b.id);
      } else groups.push({ x0: b.x0, x1: b.x1, ids: [b.id] });
    });
  const gaps: number[] = [];
  for (let g = 0; g + 1 < groups.length; g++) {
    const left = new Set(groups[g].ids);
    const right = new Set(groups[g + 1].ids);
    let sum = 0;
    let rows = 0;
    for (let y = 0; y < mask.h; y++) {
      let lx = -1;
      let rx = -1;
      for (let x = 0; x < mask.w; x++) {
        const label = comps.labels[y * mask.w + x];
        if (left.has(label)) lx = x;
        if (rx < 0 && right.has(label)) rx = x;
      }
      if (lx >= 0 && rx > lx) {
        sum += rx - lx;
        rows++;
      }
    }
    if (rows) gaps.push(sum / rows);
  }
  if (gaps.length < 2) return { rhythm: 1, glyphs: groups.length, gaps };
  const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / gaps.length);
  return { rhythm: r3(Math.max(0, 1 - sd / Math.max(1, mean))), glyphs: groups.length, gaps: gaps.map(r3) };
}

/** Centre de masse de l'encre relatif à la boîte d'encre (0 ; 0 = centre optique et géométrique confondus). */
export function massOffset(mask: Mask): { x: number; y: number } {
  const m = squareCrop(mask);
  if (!m) return { x: 0, y: 0 };
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (m.data[y * m.w + x]) {
        n++;
        sx += x + 0.5;
        sy += y + 0.5;
      }
  return n ? { x: r3(sx / n / m.w - 0.5), y: r3(sy / n / m.h - 0.5) } : { x: 0, y: 0 };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
