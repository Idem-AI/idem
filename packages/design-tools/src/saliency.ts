/// <reference path="./vendor.d.ts" />
/**
 * LA SALIENCY — où l'œil va d'abord, mesuré sur la capture.
 *
 * Méthode « FREQUENCY-TUNED » (Achanta, Hemami, Estrada & Süsstrunk, CVPR 2009) : la saillance d'un point est l'écart
 * de sa couleur (OKLab, image légèrement floutée) à la couleur MOYENNE de la page. Elle voit les grands aplats et les
 * sujets entiers — là où la méthode du résidu spectral (essayée d'abord) ne voyait que leurs bords. Calcul classique,
 * sans modèle entraîné ni GPU : 64 × 64 pixels, quelques millisecondes. DeepGaze est écarté (aucune licence).
 *
 * Ce qu'on en tire pour un visuel : combien de foyers se disputent l'œil (un seul est voulu), et quelle part de
 * l'attention reçoivent le titre, le logo et le visuel principal (rectangles mesurés dans le DOM).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { converter, parse } from 'culori';
import type { DesignTool } from './tool';

const N = 64;
const toOklch = converter('oklch');

export interface Rect {
  /** En part de la page (0–1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SaliencyReport {
  /** Carte normalisée (0–1), N × N, ligne par ligne. */
  map: number[];
  size: number;
  /** Nombre de foyers distincts (zones au-dessus de 50 % du maximum, séparées). */
  focalCount: number;
  /** Centre de gravité de l'attention (part de la page). */
  centroid: { x: number; y: number };
  /** Part de l'attention de chaque région demandée. */
  shares: Record<string, number>;
}

function lab(r: number, g: number, b: number): [number, number, number] {
  const o = toOklch(parse(`rgb(${r},${g},${b})`)!);
  if (!o) return [0, 0, 0];
  const h = ((o.h ?? 0) * Math.PI) / 180;
  return [o.l, o.c * Math.cos(h), o.c * Math.sin(h)];
}

/** La carte de saillance d'une image (PNG, JPEG…), normalisée entre 0 et 1. */
export async function saliencyMap(image: Buffer): Promise<Float64Array> {
  const { data } = await sharp(image).flatten({ background: '#ffffff' }).resize(N, N, { fit: 'fill' }).blur(0.8).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px: [number, number, number][] = [];
  const cache = new Map<number, [number, number, number]>();
  const mean = [0, 0, 0];
  for (let i = 0; i < N * N; i++) {
    const key = (data[i * 3] << 16) | (data[i * 3 + 1] << 8) | data[i * 3 + 2];
    let v = cache.get(key);
    if (!v) {
      v = lab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
      cache.set(key, v);
    }
    px.push(v);
    mean[0] += v[0];
    mean[1] += v[1];
    mean[2] += v[2];
  }
  for (let k = 0; k < 3; k++) mean[k] /= N * N;
  const sal = new Float64Array(N * N);
  let max = 0;
  for (let i = 0; i < N * N; i++) {
    const [l, a, b] = px[i];
    // La clarté compte autant que la teinte : un texte noir sur fond clair est saillant.
    sal[i] = Math.sqrt((l - mean[0]) ** 2 + (a - mean[1]) ** 2 + (b - mean[2]) ** 2);
    max = Math.max(max, sal[i]);
  }
  if (max > 0) for (let i = 0; i < sal.length; i++) sal[i] /= max;
  return sal;
}

/** Les zones au-dessus du seuil, comptées par voisinage (4-connexité), en ignorant les miettes. */
function countFoci(map: Float64Array, threshold = 0.5): number {
  const seen = new Uint8Array(map.length);
  let count = 0;
  for (let i = 0; i < map.length; i++) {
    if (seen[i] || map[i] < threshold) continue;
    let size = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % N;
      const y = Math.floor(p / N);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const q = yy * N + xx;
        if (!seen[q] && map[q] >= threshold) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    // Une miette (moins de 0,4 % de la page) n'est pas un foyer.
    if (size >= 16) count++;
  }
  return count;
}

export async function analyzeSaliency(image: Buffer, regions: Record<string, Rect> = {}): Promise<SaliencyReport> {
  const map = await saliencyMap(image);
  let total = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < map.length; i++) {
    total += map[i];
    cx += (i % N) * map[i];
    cy += Math.floor(i / N) * map[i];
  }
  const shares: Record<string, number> = {};
  for (const [name, r] of Object.entries(regions)) {
    let s = 0;
    const x0 = Math.max(0, Math.floor(r.x * N));
    const y0 = Math.max(0, Math.floor(r.y * N));
    const x1 = Math.min(N, Math.ceil((r.x + r.w) * N));
    const y1 = Math.min(N, Math.ceil((r.y + r.h) * N));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += map[y * N + x];
    shares[name] = total ? Math.round((s / total) * 1000) / 1000 : 0;
  }
  return {
    map: Array.from(map, (v) => Math.round(v * 1000) / 1000),
    size: N,
    focalCount: countFoci(map),
    centroid: total ? { x: Math.round((cx / total / N) * 1000) / 1000, y: Math.round((cy / total / N) * 1000) / 1000 } : { x: 0.5, y: 0.5 },
    shares,
  };
}

const rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const saliencyInput = z.object({ image: z.instanceof(Buffer), regions: z.record(rect).default({}) });

export const saliencyTool: DesignTool<z.infer<typeof saliencyInput>, Omit<SaliencyReport, 'map'>> = {
  name: 'saliency',
  description: 'Where the eye goes first on a rendered page: number of competing focal points, and the share of attention of the title, logo and main visual.',
  schema: saliencyInput as unknown as z.ZodType<z.infer<typeof saliencyInput>>,
  run: async ({ image, regions }) => {
    const { map: _map, ...rest } = await analyzeSaliency(image, regions);
    return rest;
  },
};
