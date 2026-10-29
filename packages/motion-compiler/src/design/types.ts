/**
 * LE SYSTÈME DE DESIGN DU FILM — les types.
 *
 * Calculé UNE fois par film par le code (`system.ts`), à partir de la marque et de la direction visuelle
 * choisie par le directeur ; chaque scène ne puise que dans ses jetons. Le modèle choisit un NIVEAU, un VERBE,
 * un RÔLE (« title », « medium », « enter ») ; le code en tient les valeurs.
 */
import type { SafeFormat } from './safezones';
import type { DurToken, EaseToken as DslEaseToken, StaggerToken, TypeLevel } from '../dsl/types';
export { DUR_TOKENS, STAGGER_TOKENS, TYPE_LEVELS } from '../dsl/types';
export type { DurToken, StaggerToken, TypeLevel };

/** Les directions visuelles nommées (le directeur en choisit une ; l'historique empêche de répéter la précédente). */
export type DirectionId = 'editorial' | 'tech' | 'minimal' | 'organic' | 'playful' | 'bold';
export const DIRECTION_IDS: DirectionId[] = ['editorial', 'tech', 'minimal', 'organic', 'playful', 'bold'];

/** Comment les couleurs de la marque sont déclinées : tonale (harmonisée), vive (chroma relevé), monochrome (une teinte). */
export type ColorVariant = 'tonal' | 'vivid' | 'monochrome';
export const COLOR_VARIANTS: ColorVariant[] = ['tonal', 'vivid', 'monochrome'];

/** Les rôles de couleur que le langage accepte comme jetons (en plus des couleurs de la marque). */
export interface ColorRoles {
  ground: string;
  surface: string;
  surfaceStrong: string;
  ink: string;
  inkMuted: string;
  line: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  onAccent: string;
  /** Un aplat clair de l'accent, sous un mot surligné. */
  highlight: string;
  onHighlight: string;
  neutral: string;
  onNeutral: string;
}
export const COLOR_ROLE_NAMES: (keyof ColorRoles)[] = ['ground', 'surface', 'surfaceStrong', 'ink', 'inkMuted', 'line', 'primary', 'onPrimary', 'secondary', 'onSecondary', 'accent', 'onAccent', 'highlight', 'onHighlight', 'neutral', 'onNeutral'];

/** Les courbes nommées, par RÔLE du mouvement (HyperFrames : « ease by role »), plus la constante. */
export type EaseToken = DslEaseToken | 'linear';

/** Les coutures entre deux scènes (vector law : la sortie de A décide de l'entrée de B). */
export type SeamKind = 'cut-the-curve' | 'zoom-through' | 'inverse-zoom' | 'blur-swap' | 'colour-flood' | 'whip' | 'dip-cut' | 'cut';
export const SEAM_KINDS: SeamKind[] = ['cut-the-curve', 'zoom-through', 'inverse-zoom', 'blur-swap', 'colour-flood', 'whip', 'dip-cut', 'cut'];

export type Direction4 = 'left' | 'right' | 'up' | 'down';

/** Une couture planifiée par le code : comment la scène SORT (et donc comment la suivante ENTRE). */
export interface SeamSpec {
  kind: SeamKind;
  dir: Direction4;
}

/** L'étalonnage commun des médias (paramètres de LUT, grain, vignettage) — porté de HyperFrames (Apache-2.0). */
export interface GradeParams {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  vibrance?: number;
  temperature?: number;
  tint?: number;
  blacks?: number;
  shadows?: number;
  highlights?: number;
  whites?: number;
  splitTone?: { intensity: number; balance: number; shadows: [number, number, number]; highlights: [number, number, number] };
  /** Grain (0 → 0,1) et vignettage (0 → 0,4), appliqués aux médias seulement. */
  grain?: number;
  vignette?: number;
  /** Teinte de la marque mêlée aux médias (0 → 0,15) : l'harmonie d'un film assemblé de sources diverses. */
  brandTint?: number;
}

export interface FilmDesign {
  version: 1;
  direction: DirectionId;
  variant: ColorVariant;
  colors: ColorRoles;
  type: {
    /** Rapport de l'échelle modulaire (1,25 à 1,5 selon le format et l'énergie ; 1,618 pour « bold »). */
    ratio: number;
    weights: { display: number; title: number; subtitle: number; body: number };
    /** Interlettrage en u (titre, texte). */
    tracking: { title: number; body: number };
    uppercaseTitles: boolean;
  };
  motion: {
    /** Facteur des durées (> 1 : plus posé). */
    speed: number;
    /** Amortissement des ressorts (1 : jamais de rebond ; 0,7–0,85 premium ; 0,4–0,6 ludique). */
    spring: number;
    /** La direction dominante du film (« the current »). */
    current: Direction4;
    /** Les coutures que la direction s'autorise (3 à 5 sortes dans un film). */
    seams: SeamKind[];
  };
  shape: { radius: number; stroke: number };
  grade: GradeParams;
  /** L'énergie de chaque scène, 1 à 5 (dans l'ordre du film). */
  energy: number[];
}

/** Le système résolu pour UNE scène dans UN format : des nombres (u, s), lus par le code compilé (`ctx.design`). */
export interface SceneDesign {
  format: SafeFormat;
  energy: number;
  colors: ColorRoles;
  /** Taille (u) de chaque niveau. */
  sizes: Record<TypeLevel, number>;
  weights: { display: number; title: number; subtitle: number; body: number };
  tracking: { title: number; body: number };
  uppercaseTitles: boolean;
  /** Durées (s), courbes (cubic-bezier), décalages (s). */
  durations: Record<DurToken, number>;
  eases: Record<Exclude<EaseToken, 'spring' | 'linear'>, [number, number, number, number]>;
  spring: number;
  stagger: Record<StaggerToken, number>;
  /** Grille : colonnes de la zone sûre (u), gouttière (u). */
  columns: number;
  gutter: number;
  radius: number;
  stroke: number;
  /** Mouvements principaux simultanés admis à cette énergie. */
  maxSimultaneous: number;
}
