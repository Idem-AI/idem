/**
 * LE KIT GRAPHIQUE DES VISUELS — types.
 *
 * Un visuel pro se joue autant dans ses formes que dans ses mots : bandes de couleur, cercles
 * qui débordent, courbes de niveau, grain, trame de points. Le moteur ne savait poser que des
 * rectangles. Le kit ajoute des FORMES DESSINÉES PAR LE CODE, comme le moteur vidéo a ses motifs :
 * l'IA n'écrit pas le SVG, elle NOMME la forme (« rings, seed 3, primary ») en une ligne, et le
 * code la dessine — même graine, même forme, toujours aux couleurs de la charte.
 *
 * C'est ce qui fait baisser les jetons : un cercle concentrique pèse 25 jetons dans une mise en
 * page JSON, 600 dans un SVG écrit à la main.
 */

export type GfxKind =
  | 'blob'
  | 'rings'
  | 'arcs'
  | 'waves'
  | 'contours'
  | 'dots'
  | 'stripes'
  | 'burst'
  | 'grid'
  | 'swash'
  | 'scribble'
  | 'frame'
  | 'mesh'
  | 'weave'
  | 'grain'
  | 'icon';

export type GfxBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

/** Ce qu'une forme reçoit (tout est optionnel : le code a une valeur par défaut pour chaque champ). */
export interface GfxParams {
  kind: GfxKind;
  /** Même graine, même forme. */
  seed?: number;
  /** Jeton de la charte (« primary »), `var(--primary)` ou #rrggbb. */
  color?: string;
  color2?: string;
  /** 0 à 1. */
  opacity?: number;
  /** Une déclinaison de la forme (voir le catalogue). */
  variant?: string;
  /** Degrés. */
  angle?: number;
  blend?: GfxBlend;
  /** Épaisseur de trait, en % du petit côté (formes au trait). */
  stroke?: number;
  /** 1 (aéré) à 5 (dense). */
  density?: number;
  /** Pictogramme (kind = icon) : un concept du vocabulaire. */
  concept?: string;
}

export interface GfxBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Le contexte de dessin : la charte et la toile. */
export interface GfxContext {
  /** 1 % du petit côté, en px. */
  u: number;
  canvas: { w: number; h: number };
  /** Jeton, var(--jeton) ou #hex → #hex ; undefined si inconnu. */
  color: (id?: string) => string | undefined;
  /** Couleur par défaut de la forme, et la seconde. */
  primary: string;
  secondary: string;
  /** Fond sur lequel la forme est posée, et l'encre qui s'y lit. */
  bg: string;
  ink: string;
  /** Fluo : jamais en grande surface. */
  neon: (hex: string) => boolean;
}

/** Ce qu'une forme du catalogue dit, pour les menus des agents et le routeur. */
export interface GfxEntry {
  kind: GfxKind;
  /** Une ligne pour le menu du designer (anglais : c'est la langue des agents). */
  summary: string;
  /** Les déclinaisons, la première par défaut. */
  variants: string[];
  /** La forme se lit en trait (épaisseur) ou en aplat (couleur pleine). */
  paint: 'fill' | 'stroke' | 'both' | 'texture';
  /** Les formes en aplat qui couvrent plus de 3 % de la toile ne reçoivent jamais un fluo. */
  functional?: boolean;
}
