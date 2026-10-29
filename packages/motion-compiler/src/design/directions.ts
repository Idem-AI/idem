/**
 * LES DIRECTIONS VISUELLES NOMMÉES — le directeur en choisit une (et une seconde, si la première vient de servir) ;
 * chacune est liée à des préréglages de jetons. Aucune n'impose de mise en page : elles règlent l'échelle, la
 * graisse, la déclinaison des couleurs, la personnalité du mouvement, les coutures permises et l'étalonnage.
 *
 * Toutes gardent une surface CLAIRE (politique d'IDEM) : un fond sombre ne vient que d'une demande explicite.
 * Les seuils de mouvement et les coutures suivent les mesures HyperFrames (HeyGen, Apache-2.0 — voir NOTICE).
 */
import type { ColorVariant, Direction4, DirectionId, GradeParams, SeamKind } from './types';

export interface DirectionPreset {
  id: DirectionId;
  /** Ce que le directeur lit (anglais : la langue des prompts). */
  label: string;
  description: string;
  ratio: number;
  weights: { display: number; title: number; subtitle: number; body: number };
  tracking: { title: number; body: number };
  uppercaseTitles: boolean;
  variant: ColorVariant;
  /** Facteur des durées (> 1 : plus posé) et amortissement des ressorts. */
  speed: number;
  spring: number;
  current: Direction4;
  /** Les coutures de la direction, la première est celle par défaut (3 à 5 sortes dans un film). */
  seams: SeamKind[];
  radius: number;
  stroke: number;
  grade: GradeParams;
  /** Énergie de départ du film (le directeur la module scène par scène). */
  energyBias: number;
}

export const DIRECTIONS: Record<DirectionId, DirectionPreset> = {
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'magazine layout: asymmetric, left-aligned, generous white space, strong scale contrast between one large title and quiet small lines; calm, deliberate arrivals',
    ratio: 1.5,
    weights: { display: 800, title: 700, subtitle: 500, body: 400 },
    tracking: { title: -0.12, body: 0 },
    uppercaseTitles: false,
    variant: 'tonal',
    speed: 1.12,
    spring: 1,
    current: 'left',
    seams: ['cut-the-curve', 'blur-swap', 'colour-flood', 'inverse-zoom', 'dip-cut'],
    radius: 0.6,
    stroke: 0.25,
    grade: { contrast: 0.06, saturation: -0.04, temperature: 0.03, splitTone: { intensity: 0.25, balance: 0.5, shadows: [-0.01, 0.01, 0.03], highlights: [0.04, 0.02, -0.01] }, grain: 0.035, vignette: 0.12, brandTint: 0.05 },
    energyBias: 2.6,
  },
  tech: {
    id: 'tech',
    label: 'Technological',
    description: 'precise grid, crisp alignment, interface and data forward, thin lines and exact geometry; quick, snappy moves that cut on the beat',
    ratio: 1.333,
    weights: { display: 800, title: 700, subtitle: 600, body: 400 },
    tracking: { title: -0.08, body: 0 },
    uppercaseTitles: false,
    variant: 'vivid',
    speed: 0.9,
    spring: 0.85,
    current: 'left',
    seams: ['cut-the-curve', 'zoom-through', 'whip', 'inverse-zoom', 'cut'],
    radius: 1.2,
    stroke: 0.2,
    grade: { contrast: 0.1, saturation: 0.02, temperature: -0.05, tint: -0.01, grain: 0.015, vignette: 0.08, brandTint: 0.06 },
    energyBias: 3.4,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'one idea per frame, a lot of empty space, one colour plus ink, centred or single-column; slow, quiet motion with no bounce',
    ratio: 1.25,
    weights: { display: 700, title: 600, subtitle: 500, body: 400 },
    tracking: { title: -0.06, body: 0 },
    uppercaseTitles: false,
    variant: 'monochrome',
    speed: 1.22,
    spring: 1,
    current: 'up',
    seams: ['blur-swap', 'dip-cut', 'cut-the-curve', 'inverse-zoom'],
    radius: 0.4,
    stroke: 0.2,
    grade: { contrast: 0.03, saturation: -0.08, grain: 0, vignette: 0.05, brandTint: 0.03 },
    energyBias: 2.2,
  },
  organic: {
    id: 'organic',
    label: 'Organic',
    description: 'soft rounded shapes, warm tones, photos of people and places, flowing curves; gentle springs and colour floods between moments',
    ratio: 1.333,
    weights: { display: 800, title: 700, subtitle: 500, body: 400 },
    tracking: { title: -0.06, body: 0 },
    uppercaseTitles: false,
    variant: 'tonal',
    speed: 1.08,
    spring: 0.8,
    current: 'right',
    seams: ['colour-flood', 'cut-the-curve', 'blur-swap', 'inverse-zoom'],
    radius: 3.2,
    stroke: 0.35,
    grade: { contrast: 0.04, saturation: 0.04, temperature: 0.07, tint: 0.01, grain: 0.05, vignette: 0.14, brandTint: 0.07 },
    energyBias: 2.8,
  },
  playful: {
    id: 'playful',
    label: 'Playful',
    description: 'bright colour blocks, big friendly type, stickers and shapes that pop, playful springs; whips and objects that become the next scene',
    ratio: 1.5,
    weights: { display: 900, title: 800, subtitle: 600, body: 500 },
    tracking: { title: -0.04, body: 0 },
    uppercaseTitles: false,
    variant: 'vivid',
    speed: 0.92,
    spring: 0.55,
    current: 'left',
    seams: ['whip', 'zoom-through', 'colour-flood', 'cut-the-curve', 'inverse-zoom'],
    radius: 2.6,
    stroke: 0.5,
    grade: { contrast: 0.06, saturation: 0.1, vibrance: 0.08, temperature: 0.02, grain: 0.01, vignette: 0.04, brandTint: 0.05 },
    energyBias: 3.6,
  },
  bold: {
    id: 'bold',
    label: 'Bold',
    description: 'poster-like: giant words filling the width, hard colour planes, high contrast, uppercase titles; punchy cuts on the beat and zooms through words',
    ratio: 1.618,
    weights: { display: 900, title: 900, subtitle: 700, body: 500 },
    tracking: { title: -0.1, body: 0 },
    uppercaseTitles: true,
    variant: 'vivid',
    speed: 0.85,
    spring: 0.85,
    current: 'left',
    seams: ['cut-the-curve', 'zoom-through', 'whip', 'cut', 'inverse-zoom'],
    radius: 0,
    stroke: 0.6,
    grade: { contrast: 0.16, saturation: 0.06, blacks: -0.03, grain: 0.025, vignette: 0.1, brandTint: 0.04 },
    energyBias: 3.8,
  },
};

/** Lecture tolérante d'une direction écrite par le directeur (« Editorial », « tech », « minimalist »…) — sinon null. */
export function directionOf(raw: unknown): DirectionId | null {
  const k = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const table: Record<string, DirectionId> = { editorial: 'editorial', editoriale: 'editorial', magazine: 'editorial', tech: 'tech', technological: 'tech', technologique: 'tech', technology: 'tech', minimal: 'minimal', minimalist: 'minimal', minimaliste: 'minimal', organic: 'organic', organique: 'organic', playful: 'playful', ludique: 'playful', bold: 'bold', audacieux: 'bold', poster: 'bold' };
  return table[k] ?? null;
}

/** La liste donnée au directeur, une ligne par direction. */
export function directionMenu(exclude?: DirectionId | null): string {
  return Object.values(DIRECTIONS)
    .filter((d) => d.id !== exclude)
    .map((d) => `- ${d.id}: ${d.description}`)
    .join('\n');
}
