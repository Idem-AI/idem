/**
 * L'INTENTION DE SCÈNE — ce que l'auteur écrit depuis le compilateur 0.3, à la place des coordonnées.
 *
 * Le modèle choisit le RÔLE de la scène dans le récit, son ÉNERGIE, un TYPE de composition, la HIÉRARCHIE des éléments
 * (rang 1 : l'élément principal), quelques RELATIONS et des VERBES de mouvement. Le code calcule tout le reste :
 * positions et tailles par format (solveur géométrique), instants et durées (solveur temporel), courbes, décalages,
 * couleurs dérivées. Le schéma est petit, plat et fait d'énumérations : un petit modèle s'y trompe peu, et il se prête
 * aux sorties structurées (`schema.ts`).
 *
 * Le programme du langage de mouvement (0.2.1) devient le LANGAGE D'ASSEMBLAGE : l'intention y est traduite
 * (`lower.ts`), puis compilée comme avant.
 */
import type { TypeLevel } from '../dsl/types';
import type { SceneRole } from '../design/film';

export type LayoutKind = 'hero' | 'hero-left' | 'media-split' | 'full-bleed' | 'stacked' | 'figure' | 'list' | 'quote' | 'device' | 'end-card' | 'grid';
export const LAYOUT_KINDS: LayoutKind[] = ['hero', 'hero-left', 'media-split', 'full-bleed', 'stacked', 'figure', 'list', 'quote', 'device', 'end-card', 'grid'];

export type ElementKind = 'text' | 'image' | 'video' | 'logo' | 'icon' | 'device' | 'shape' | 'list' | 'chip' | 'button';
export const ELEMENT_KINDS: ElementKind[] = ['text', 'image', 'video', 'logo', 'icon', 'device', 'shape', 'list', 'chip', 'button'];

export type ShapeKind = 'bar' | 'underline' | 'circle' | 'ring' | 'block' | 'pill' | 'dots' | 'arc';
export const SHAPE_KINDS: ShapeKind[] = ['bar', 'underline', 'circle', 'ring', 'block', 'pill', 'dots', 'arc'];

export type Relation = 'above' | 'below' | 'beside' | 'left-of' | 'right-of' | 'over' | 'behind' | 'aligned';
export const RELATIONS: Relation[] = ['above', 'below', 'beside', 'left-of', 'right-of', 'over', 'behind', 'aligned'];

/** Les verbes de mouvement — recettes composables (portées des mesures HyperFrames, voir `recipes.ts`). */
export type Verb = 'reveal' | 'rise' | 'slide-in' | 'pop' | 'push' | 'stack' | 'cascade' | 'draw' | 'count' | 'type' | 'wipe' | 'highlight' | 'zoom' | 'focus' | 'blur-in' | 'grow' | 'nudge' | 'exit';
export const VERBS: Verb[] = ['reveal', 'rise', 'slide-in', 'pop', 'push', 'stack', 'cascade', 'draw', 'count', 'type', 'wipe', 'highlight', 'zoom', 'focus', 'blur-in', 'grow', 'nudge', 'exit'];

export type BackgroundRole = 'ground' | 'surface' | 'primary' | 'secondary' | 'accent' | 'media';
export const BACKGROUNDS: BackgroundRole[] = ['ground', 'surface', 'primary', 'secondary', 'accent', 'media'];

export interface IntentElement {
  id: string;
  kind: ElementKind;
  /** `$clé` d'un texte de la scène (text, chip, button). */
  text?: string;
  /** Les clés des puces (list). */
  items?: string[];
  /** Rang d'un média de la scène (image, video, device). */
  media?: number;
  /** Niveau typographique (sinon déduit du rang). */
  level?: TypeLevel;
  /** 1 : l'élément principal ; 2 : secondaire ; 3 : détail. */
  rank: 1 | 2 | 3;
  /** Recadrage d'un média : sur le sujet (défaut), plein cadre, entier. */
  crop?: 'subject' | 'fill' | 'fit';
  shape?: ShapeKind;
  /** Rôle de couleur (primary, accent, onPrimary…) ; sinon calculé (encre lisible sur son fond). */
  color?: string;
  /** Nom d'une icône du catalogue. */
  icon?: string;
  device?: 'phone' | 'laptop' | 'browser';
  /** Le mot (rang 0…) mis en valeur dans la couleur d'accent — un seul, porteur de sens. */
  emphasis?: number;
}

export interface IntentBeat {
  verb: Verb;
  /** L'élément visé (`id`), ses morceaux (`id.*`), ou `world` (toute la scène, la caméra). */
  target: string;
  style?: 'words' | 'letters' | 'line' | 'items';
  from?: 'left' | 'right' | 'top' | 'bottom' | 'center';
  intensity?: 'soft' | 'normal' | 'strong';
  /** Caler le départ : sur le temps fort, sur un temps, sur la voix. */
  sync?: 'downbeat' | 'beat' | 'voice' | 'none';
  /** Partir après (`after`) ou avec (`with`) un autre élément. */
  after?: string;
  with?: string;
}

export interface SceneIntent {
  role?: SceneRole;
  energy?: number;
  layout: LayoutKind;
  background?: BackgroundRole;
  elements: IntentElement[];
  relations?: [string, Relation, string][];
  beats: IntentBeat[];
  camera?: { move: 'none' | 'push' | 'pull' | 'pan'; target?: string };
}
