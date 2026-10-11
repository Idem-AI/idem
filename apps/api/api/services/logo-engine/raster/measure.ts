/**
 * Mesures sur pixels : ce qu'un code constate d'un logo rendu, sans modèle.
 *
 * Tous les rendus se font sur fond TRANSPARENT : l'opacité (canal alpha) est la mesure de
 * l'encre. La couleur ne sert qu'aux contrôles de contraste, calculés sur la palette.
 */
import type { RasterImage } from './rasterizer';

/** Part du canevas couverte par de l'encre (alpha ≥ 50 %). */
export function inkCoverage(image: RasterImage): number {
  let ink = 0;
  const px = image.width * image.height;
  for (let i = 3; i < image.rgba.length; i += 4) if (image.rgba[i] >= 128) ink++;
  return px ? ink / px : 0;
}

/**
 * Part de l'encre qui est « solide » (alpha ≥ 70 %). Un trait plus fin qu'un pixel donne des
 * pixels pâles : à 16–32 px, un logo dont l'encre est surtout pâle devient une bouillie grise.
 */
export function solidRatio(image: RasterImage): number {
  let total = 0;
  let solid = 0;
  for (let i = 3; i < image.rgba.length; i += 4) {
    const a = image.rgba[i];
    total += a;
    if (a >= 180) solid += a;
  }
  return total ? solid / total : 0;
}

/** Centre de masse de l'encre, en fraction du canevas (0,5 ; 0,5 = parfaitement centré). */
export function centerOfMass(image: RasterImage): { x: number; y: number } | null {
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const a = image.rgba[(y * image.width + x) * 4 + 3];
      if (!a) continue;
      sum += a;
      sx += a * (x + 0.5);
      sy += a * (y + 0.5);
    }
  }
  return sum ? { x: sx / sum / image.width, y: sy / sum / image.height } : null;
}

/** Boîte d'encre en fraction du canevas. */
export function inkBox(image: RasterImage): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = image.width;
  let y0 = image.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.rgba[(y * image.width + x) * 4 + 3] < 40) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0: x0 / image.width, y0: y0 / image.height, x1: (x1 + 1) / image.width, y1: (y1 + 1) / image.height };
}

/** Grille d'encre `n × n` (fraction de couverture par case, 0..1) : l'empreinte visuelle d'un symbole. */
export function inkGrid(image: RasterImage, n = 16): Float32Array {
  const grid = new Float32Array(n * n);
  const counts = new Float32Array(n * n);
  for (let y = 0; y < image.height; y++) {
    const gy = Math.min(n - 1, Math.floor((y / image.height) * n));
    for (let x = 0; x < image.width; x++) {
      const gx = Math.min(n - 1, Math.floor((x / image.width) * n));
      grid[gy * n + gx] += image.rgba[(y * image.width + x) * 4 + 3] / 255;
      counts[gy * n + gx] += 1;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] = counts[i] ? grid[i] / counts[i] : 0;
  return grid;
}

/** Ressemblance de deux empreintes (intersection sur union des cases d'encre), 0..1. */
export function gridSimilarity(a: Float32Array, b: Float32Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    inter += Math.min(a[i], b[i]);
    union += Math.max(a[i], b[i]);
  }
  return union ? inter / union : 0;
}

/** Miroir horizontal d'une grille (une proposition retournée est la même idée). */
export function flipGrid(grid: Float32Array, n = 16): Float32Array {
  const out = new Float32Array(grid.length);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = grid[y * n + (n - 1 - x)];
  return out;
}
