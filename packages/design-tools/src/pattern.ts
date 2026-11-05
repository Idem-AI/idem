/// <reference path="./vendor.d.ts" />
/**
 * LES MOTIFS PROCÉDURAUX — semis, lignes de flux, grain, tracés à la main, en SVG.
 *
 * Le code dessine, l'agent choisit : il demande une NATURE de motif et ses couleurs (celles de la marque), le code
 * rend une tuile SVG déterministe (même graine, même tuile). Aucun motif n'est un gabarit de page : c'est une
 * matière que l'auteur pose où il veut, avec parcimonie.
 */
import { z } from 'zod';
import { createNoise2D } from 'simplex-noise';
import PoissonDiskSampling from 'poisson-disk-sampling';
import type { DesignTool } from './tool';
import { seededRandom } from './tool';

// roughjs n'a pas de types CommonJS utilisables ici : le générateur seul (sans DOM).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rough = require('roughjs') as { generator: () => RoughGenerator };
interface RoughGenerator {
  line(x1: number, y1: number, x2: number, y2: number, o?: Record<string, unknown>): unknown;
  rectangle(x: number, y: number, w: number, h: number, o?: Record<string, unknown>): unknown;
  circle(x: number, y: number, d: number, o?: Record<string, unknown>): unknown;
  toPaths(drawable: unknown): Array<{ d: string; stroke: string; strokeWidth: number; fill?: string }>;
}

export type PatternKind = 'scatter' | 'flow' | 'grain' | 'hand-lines' | 'hand-circles';

export interface PatternRequest {
  kind: PatternKind;
  size: number;
  colors: string[];
  /** 0 → épars, 1 → dense. */
  density: number;
  seed: string;
  /** Épaisseur des traits (px). */
  stroke?: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

function scatter(r: PatternRequest, rand: () => number): string {
  const min = Math.max(6, r.size * (0.16 - r.density * 0.12));
  const points = new PoissonDiskSampling({ shape: [r.size, r.size], minDistance: min, tries: 20 }, rand).fill();
  return points.map(([x, y], i) => `<circle cx="${round(x)}" cy="${round(y)}" r="${round(min * (0.12 + rand() * 0.1))}" fill="${r.colors[i % r.colors.length]}"/>`).join('');
}

function flow(r: PatternRequest, rand: () => number): string {
  const noise = createNoise2D(rand);
  const lines = Math.round(6 + r.density * 18);
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const y0 = ((i + 0.5) / lines) * r.size;
    const pts: string[] = [];
    for (let x = 0; x <= r.size; x += r.size / 40) {
      const y = y0 + noise(x / (r.size * 0.45), i * 0.3) * (r.size / lines) * 1.4;
      pts.push(`${round(x)},${round(y)}`);
    }
    paths.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${r.colors[i % r.colors.length]}" stroke-width="${r.stroke ?? 1.5}" stroke-linecap="round"/>`);
  }
  return paths.join('');
}

function grain(r: PatternRequest, rand: () => number): string {
  const noise = createNoise2D(rand);
  const n = Math.round(200 + r.density * 1800);
  const dots: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = rand() * r.size;
    const y = rand() * r.size;
    if (noise(x / 60, y / 60) < -0.2) continue;
    dots.push(`<rect x="${round(x)}" y="${round(y)}" width="1.2" height="1.2" fill="${r.colors[i % r.colors.length]}" opacity="${round(0.25 + rand() * 0.4)}"/>`);
  }
  return dots.join('');
}

function hand(r: PatternRequest, rand: () => number, shape: 'lines' | 'circles'): string {
  const gen = rough.generator();
  const count = Math.round(4 + r.density * 12);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = r.colors[i % r.colors.length];
    const o = { stroke: color, strokeWidth: r.stroke ?? 1.6, roughness: 1.4, bowing: 1, seed: Math.floor(rand() * 2 ** 31) || 1 };
    const drawable = shape === 'lines' ? gen.line(rand() * r.size * 0.2, ((i + 0.5) / count) * r.size, r.size * (0.8 + rand() * 0.2), ((i + 0.5) / count) * r.size + (rand() - 0.5) * 8, o) : gen.circle(rand() * r.size, rand() * r.size, r.size * (0.06 + rand() * 0.12), o);
    for (const p of gen.toPaths(drawable)) out.push(`<path d="${p.d}" fill="none" stroke="${p.stroke}" stroke-width="${p.strokeWidth}"/>`);
  }
  return out.join('');
}

/** La tuile SVG (fond transparent : l'auteur la pose sur le fond de la page). */
export function patternSvg(r: PatternRequest): string {
  const rand = seededRandom(`${r.seed}|${r.kind}`);
  const body = r.kind === 'scatter' ? scatter(r, rand) : r.kind === 'flow' ? flow(r, rand) : r.kind === 'grain' ? grain(r, rand) : hand(r, rand, r.kind === 'hand-lines' ? 'lines' : 'circles');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.size}" height="${r.size}" viewBox="0 0 ${r.size} ${r.size}">${body}</svg>`;
}

const patternInput = z.object({
  kind: z.enum(['scatter', 'flow', 'grain', 'hand-lines', 'hand-circles']),
  size: z.number().int().min(64).max(2048).default(512),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/)).min(1).max(4),
  density: z.number().min(0).max(1).default(0.4),
  seed: z.string().min(1),
  stroke: z.number().min(0.5).max(12).optional(),
});

export const patternTool: DesignTool<PatternRequest, { svg: string }> = {
  name: 'pattern',
  description: 'A procedural pattern tile in SVG (scatter, flow lines, grain, hand-drawn lines or circles) in the brand colours. Deterministic for a seed.',
  schema: patternInput as unknown as z.ZodType<PatternRequest>,
  run: async (input) => ({ svg: patternSvg(input) }),
};
