/// <reference path="./vendor.d.ts" />
/**
 * LA VECTORISATION — une image (générée par FLUX.2, ou fournie) devient un SVG propre aux couleurs de la marque.
 *
 * Remplace OmniSVG (26 Go de mémoire GPU) : l'image est d'abord RAMENÉE à la palette de la marque (chaque pixel prend
 * la couleur la plus proche, en OKLab perçu), puis tracée par vtracer (`@neplex/vectorizer`, binaire Rust, processeur
 * seul) et optimisée. Repli : imagetracerjs (JavaScript pur), si le binaire natif manque sur la machine.
 */
import sharp from 'sharp';
import { z } from 'zod';
import { converter, parse } from 'culori';
import type { DesignTool } from './tool';

export interface VectorizeRequest {
  image: Buffer;
  /** Les couleurs permises (marque + fond) : l'image y est ramenée avant le tracé. Vide : couleurs d'origine. */
  palette?: string[];
  /** Taille de travail (px, côté le plus long). */
  size?: number;
  /** Détail : 0 → affiche (peu de formes), 1 → fidèle. */
  detail?: number;
}

export interface VectorizeResult {
  svg: string;
  paths: number;
  engine: 'vtracer' | 'imagetracer';
}

const toLab = converter('oklch');

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** OKLCH → coordonnées cartésiennes (a, b) pour une distance perçue. */
function labOf(r: number, g: number, b: number): [number, number, number] {
  const o = toLab(parse(`rgb(${r},${g},${b})`)!);
  if (!o) return [0, 0, 0];
  const h = ((o.h ?? 0) * Math.PI) / 180;
  return [o.l, o.c * Math.cos(h), o.c * Math.sin(h)];
}

/** Ramène chaque pixel à la couleur de palette la plus proche (cache par couleur quantifiée). */
async function posterize(image: Buffer, palette: string[], size: number): Promise<{ raw: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(image).flatten({ background: palette[palette.length - 1] ?? '#ffffff' }).resize(size, size, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const targets = palette.map((hex) => ({ rgb: hexToRgb(hex), lab: labOf(...hexToRgb(hex)) }));
  const cache = new Map<number, [number, number, number]>();
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
    let rgb = cache.get(key);
    if (!rgb) {
      const lab = labOf(data[i], data[i + 1], data[i + 2]);
      let best = targets[0];
      let bestD = Infinity;
      for (const t of targets) {
        const d = (lab[0] - t.lab[0]) ** 2 + (lab[1] - t.lab[1]) ** 2 + (lab[2] - t.lab[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      rgb = best.rgb;
      cache.set(key, rgb);
    }
    out[j] = rgb[0];
    out[j + 1] = rgb[1];
    out[j + 2] = rgb[2];
    out[j + 3] = 255;
  }
  return { raw: out, width: info.width, height: info.height };
}

export async function vectorizeImage(r: VectorizeRequest): Promise<VectorizeResult> {
  const size = r.size ?? 768;
  const detail = Math.min(1, Math.max(0, r.detail ?? 0.4));
  const prepared = r.palette?.length
    ? await posterize(r.image, r.palette, size)
    : await (async () => {
        const { data, info } = await sharp(r.image).resize(size, size, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return { raw: data, width: info.width, height: info.height };
      })();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const v = require('@neplex/vectorizer') as typeof import('@neplex/vectorizer');
    const svg = await v.vectorizeRaw(prepared.raw, { width: prepared.width, height: prepared.height }, {
      colorMode: v.ColorMode.Color,
      hierarchical: v.Hierarchical.Stacked,
      filterSpeckle: Math.round(12 - detail * 9),
      colorPrecision: r.palette?.length ? 8 : Math.round(4 + detail * 3),
      layerDifference: Math.round(32 - detail * 24),
      mode: v.PathSimplifyMode.Spline,
      cornerThreshold: 60,
      lengthThreshold: 4,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 1,
    });
    const optimized = snapFills(await v.optimize(svg, { preset: v.OptimizePreset.Default }).catch(() => svg), r.palette);
    return { svg: optimized, paths: (optimized.match(/<path/g) || []).length, engine: 'vtracer' };
  } catch {
    // Le binaire natif absent (plateforme non publiée) : le traceur en JavaScript pur.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracer = require('imagetracerjs') as { imagedataToSVG: (d: { width: number; height: number; data: Buffer }, o?: Record<string, unknown>) => string };
    const svg = snapFills(tracer.imagedataToSVG({ width: prepared.width, height: prepared.height, data: prepared.raw }, { numberofcolors: r.palette?.length || 8, pathomit: Math.round(16 - detail * 12), ltres: 1, qtres: 1, roundcoords: 1 }), r.palette);
    return { svg, paths: (svg.match(/<path/g) || []).length, engine: 'imagetracer' };
  }
}

/** Le traceur arrondit les couleurs (précision des canaux) : chaque remplissage revient à la couleur exacte de la palette. */
function snapFills(svg: string, palette?: string[]): string {
  if (!palette?.length) return svg;
  const targets = palette.map((hex) => ({ hex: hex.toLowerCase(), lab: labOf(...hexToRgb(hex)) }));
  const nearest = (r: number, g: number, b: number) => {
    const l = labOf(r, g, b);
    let best = targets[0];
    let d0 = Infinity;
    for (const t of targets) {
      const d = (l[0] - t.lab[0]) ** 2 + (l[1] - t.lab[1]) ** 2 + (l[2] - t.lab[2]) ** 2;
      if (d < d0) {
        d0 = d;
        best = t;
      }
    }
    return best.hex;
  };
  return svg
    .replace(/(fill|stroke)="#([0-9a-fA-F]{6})"/g, (_, attr: string, hex: string) => `${attr}="${nearest(...hexToRgb(hex))}"`)
    .replace(/(fill|stroke)="rgb\((\d+),\s*(\d+),\s*(\d+)\)"/g, (_, attr: string, r: string, g: string, b: string) => `${attr}="${nearest(Number(r), Number(g), Number(b))}"`);
}

const vectorizeInput = z.object({
  image: z.instanceof(Buffer),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/)).max(8).optional(),
  size: z.number().int().min(128).max(2048).optional(),
  detail: z.number().min(0).max(1).optional(),
});

export const vectorizeTool: DesignTool<VectorizeRequest, VectorizeResult> = {
  name: 'vectorize',
  description: 'Turns an image into a clean SVG in the brand palette (vtracer, CPU only).',
  schema: vectorizeInput as unknown as z.ZodType<VectorizeRequest>,
  run: (input) => vectorizeImage(input),
};
