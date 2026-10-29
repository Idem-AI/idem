/**
 * LE SYSTÈME DE DESIGN D'UN FILM — calculé une seule fois par le code, puis résolu par scène et par format.
 *
 *   buildFilmDesign     la marque + la direction visuelle (choisie par le directeur) + l'énergie de chaque scène
 *                       → couleurs par rôle, échelle typographique, personnalité du mouvement, coutures, étalonnage ;
 *   resolveSceneDesign  les NOMBRES d'une scène dans un format : tailles des niveaux (u), durées (s), courbes,
 *                       décalages, grille — ce que le code compilé lit dans `ctx.design`.
 *
 * Le modèle ne voit que des noms (niveau, durée, courbe, rôle de couleur) ; ces nombres sont des réglages de départ, à
 * étalonner sur le banc.
 */
import { buildColorRoles, BrandPalette } from './color';
import { DIRECTIONS } from './directions';
import { durations, EASE_CURVES, ENERGY_SIMULTANEOUS, clampEnergy, staggers } from './motion';
import type { SafeFormat } from './safezones';
import { scaleRatio, typeSizes } from './typography';
import type { ColorVariant, DirectionId, FilmDesign, SceneDesign } from './types';

export interface FilmDesignInput {
  brand: BrandPalette;
  direction: DirectionId;
  /** L'énergie de chaque scène (1 → 5). */
  energy: number[];
  /** Une déclinaison des couleurs imposée (sinon celle de la direction). */
  variant?: ColorVariant;
  allowDark?: boolean;
}

export function buildFilmDesign(input: FilmDesignInput): FilmDesign {
  const d = DIRECTIONS[input.direction] || DIRECTIONS.editorial;
  const variant = input.variant || d.variant;
  return {
    version: 1,
    direction: d.id,
    variant,
    colors: buildColorRoles(input.brand, { variant, allowDark: input.allowDark }),
    type: { ratio: d.ratio, weights: { ...d.weights }, tracking: { ...d.tracking }, uppercaseTitles: d.uppercaseTitles },
    motion: { speed: d.speed, spring: d.spring, current: d.current, seams: [...d.seams] },
    shape: { radius: d.radius, stroke: d.stroke },
    grade: JSON.parse(JSON.stringify(d.grade)),
    energy: input.energy.map(clampEnergy),
  };
}

/** Colonnes de la grille par format (la marge est la zone sûre). */
export const GRID_COLUMNS: Record<SafeFormat, number> = { story: 4, portrait: 6, square: 6, landscape: 12 };
export const GRID_GUTTER = 2.4;

export function resolveSceneDesign(design: FilmDesign, format: SafeFormat, sceneIndex: number): SceneDesign {
  const energy = clampEnergy(design.energy[sceneIndex] ?? 3);
  return {
    format,
    energy,
    colors: { ...design.colors },
    sizes: typeSizes(format, scaleRatio(design.type.ratio, format, energy)),
    weights: { ...design.type.weights },
    tracking: { ...design.type.tracking },
    uppercaseTitles: design.type.uppercaseTitles,
    durations: durations(design.motion.speed, energy),
    eases: { ...EASE_CURVES },
    spring: design.motion.spring,
    stagger: staggers(energy),
    columns: GRID_COLUMNS[format],
    gutter: GRID_GUTTER,
    radius: design.shape.radius,
    stroke: design.shape.stroke,
    maxSimultaneous: ENERGY_SIMULTANEOUS[energy] ?? 2,
  };
}

/** Le système résolu par défaut (vidéos d'avant le système de design) : la marque seule, direction éditoriale. */
export function defaultSceneDesign(brand: BrandPalette, format: SafeFormat, energy = 3): SceneDesign {
  return resolveSceneDesign(buildFilmDesign({ brand, direction: 'editorial', energy: [energy] }), format, 0);
}

/** La ligne d'un système pour un prompt : ce que le modèle peut NOMMER (jamais les valeurs). */
export function designVocabulary(): string {
  return [
    'size: "display" | "title" | "subtitle" | "body" | "caption" | "label"',
    'dur: "instant" | "quick" | "short" | "medium" | "long" | "xlong"',
    'ease: "enter" | "exit" | "standard" | "move" | "arrive" | "cut-in" | "cut-out" | "spring" | "linear"',
    'stagger: "letters" | "words" | "items" | "cards"',
    'colour roles: ground, surface, surfaceStrong, ink, inkMuted, line, primary, onPrimary, secondary, onSecondary, accent, onAccent, highlight, onHighlight, neutral, onNeutral',
  ].join('\n');
}
