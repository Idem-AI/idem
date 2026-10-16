/**
 * LE LANGAGE DE MOUVEMENT — ce que l'IA écrit pour UNE scène, à la place du code Motion Canvas.
 *
 * Un programme décrit des NŒUDS (texte, formes, tracés, médias, groupes, piles, répétitions) et une
 * PISTE de pas datés (quoi bouge, quand, combien de temps, vers quoi, avec quelle courbe). Ce sont des
 * primitives combinables, jamais des scènes toutes faites : le compilateur (`compiler/compile.ts`) les
 * traduit fidèlement en TSX Motion Canvas, sans choisir de composition à la place du modèle.
 *
 * Unités : toutes les longueurs sont en `u` (1 % du petit côté de l'image), l'origine au CENTRE,
 * x vers la droite, y vers le bas. Une longueur peut être une expression (`"L+4"`, `"SW*0.5"`) : voir
 * `expr.ts` pour les variables (taille de l'image, zone sûre, rang d'une répétition).
 */

/** Un nombre, ou une expression en texte (`"T+SH*0.3"`, `"i*12-30"`). */
export type Expr = number | string;

/** Une couleur : jeton de marque (`primary`, `ink`, `on-accent`…), `#hex`, avec opacité `primary/40`. */
export type ColorRef = string;

export interface GradientRef {
  from: ColorRef;
  to: ColorRef;
  /** Degrés : 0 = de gauche à droite, 90 = de haut en bas. */
  angle?: number;
}

export type Fill = ColorRef | GradientRef;

export type Anchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface NodeBase {
  /** Obligatoire pour être animé (lettres, chiffres, `_`, `-`). */
  id?: string;
  x?: Expr;
  y?: Expr;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  z?: number;
  anchor?: Anchor;
  /** Flou en u. */
  blur?: number;
  skewX?: number;
  shadow?: { color?: ColorRef; blur?: number; x?: number; y?: number };
}

export interface TextNode extends NodeBase {
  type: 'text';
  /** `$cle` (un texte de la scène) ; un littéral seulement pour un signe sans lettre (`→`, `+`, `%`). */
  text: string;
  font?: 'display' | 'body';
  weight?: number;
  /** Taille en u, ou `"fit"` : la plus grande qui tient dans `width` sur `lines` lignes (plafond `maxSize`). */
  size?: Expr | 'fit';
  maxSize?: number;
  lines?: number;
  /** Largeur de la boîte (u) : le texte passe à la ligne. */
  width?: Expr;
  align?: 'left' | 'center' | 'right';
  color?: Fill;
  letterSpacing?: number;
  lineHeight?: number;
  upper?: boolean;
  italic?: boolean;
  stroke?: ColorRef;
  lineWidth?: number;
  /** Découpe en mots ou en lettres : chaque morceau devient un nœud `id.0`, `id.1`… (cible `id.*`). */
  split?: 'words' | 'chars';
}

export interface RectNode extends NodeBase {
  type: 'rect';
  w?: Expr;
  h?: Expr;
  radius?: Expr;
  fill?: Fill;
  stroke?: ColorRef;
  lineWidth?: number;
  dash?: number[];
  /** Cache ce qui dépasse (masque) : animer w/h révèle les enfants. */
  clip?: boolean;
  children?: MotionNode[];
}

export interface CircleNode extends NodeBase {
  type: 'circle';
  /** Diamètre (u). */
  size?: Expr;
  fill?: Fill;
  stroke?: ColorRef;
  lineWidth?: number;
  dash?: number[];
  /** Portion tracée du contour, 0 → 1 (animer `end` dessine le cercle). */
  start?: number;
  end?: number;
  clip?: boolean;
  children?: MotionNode[];
}

export interface LineNode extends NodeBase {
  type: 'line';
  points: [Expr, Expr][];
  stroke?: ColorRef;
  lineWidth?: number;
  /** Coins arrondis (u). */
  radius?: number;
  arrow?: boolean;
  dash?: number[];
  start?: number;
  end?: number;
  closed?: boolean;
  fill?: Fill;
}

export interface PathNode extends NodeBase {
  type: 'path';
  /** Données SVG (`M0 0 C…`), coordonnées en u. */
  d: string;
  stroke?: ColorRef;
  lineWidth?: number;
  fill?: Fill;
  start?: number;
  end?: number;
}

export interface PolygonNode extends NodeBase {
  type: 'polygon';
  sides: number;
  size?: Expr;
  radius?: number;
  fill?: Fill;
  stroke?: ColorRef;
  lineWidth?: number;
}

export interface MediaNode extends NodeBase {
  type: 'image' | 'video';
  /** Rang dans les médias de la scène (0 = le premier). */
  media: number;
  w?: Expr;
  h?: Expr;
  fit?: 'cover' | 'contain';
  radius?: Expr;
  /** Agrandissement du média dans son cadre (1 = ajusté) : animable (travelling). */
  zoom?: number;
  panX?: number;
  panY?: number;
  loop?: boolean;
  fill?: Fill;
}

export interface LogoNode extends NodeBase {
  type: 'logo';
  w?: Expr;
  /** La couleur sur laquelle le logo est posé (choisit la déclinaison claire ou sombre). */
  on?: ColorRef;
}

export interface GroupNode extends NodeBase {
  type: 'group';
  children: MotionNode[];
}

export interface StackNode extends NodeBase {
  type: 'stack';
  /** `auto` : en colonne dans un format vertical, en ligne sinon. */
  dir?: 'row' | 'column' | 'auto';
  gap?: Expr;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  w?: Expr;
  h?: Expr;
  wrap?: boolean;
  padding?: Expr;
  fill?: Fill;
  radius?: Expr;
  children: MotionNode[];
}

export interface RepeatNode extends NodeBase {
  type: 'repeat';
  /** Nombre de copies, ou des valeurs (`v` dans les expressions de `item`). */
  count?: number;
  data?: number[];
  layout?: 'grid' | 'row' | 'column' | 'circle' | 'free';
  cols?: number;
  w?: Expr;
  h?: Expr;
  gap?: Expr;
  /** Rayon du cercle (layout circle). */
  r?: Expr;
  /** Le modèle de chaque copie : ses expressions peuvent lire `i` (rang), `n` (nombre), `v` (valeur). */
  item: MotionNode;
}

export type MotionNode = TextNode | RectNode | CircleNode | LineNode | PathNode | PolygonNode | MediaNode | LogoNode | GroupNode | StackNode | RepeatNode;
export type NodeType = MotionNode['type'];

/** Ce qu'un pas peut faire varier. */
export type AnimProp =
  | 'x' | 'y' | 'rotation' | 'scale' | 'scaleX' | 'scaleY' | 'opacity' | 'skewX'
  | 'w' | 'h' | 'size' | 'radius' | 'fill' | 'stroke' | 'lineWidth' | 'start' | 'end'
  | 'blur' | 'zoom' | 'panX' | 'panY' | 'letterSpacing';

/** Une valeur cible : absolue (nombre, expression, couleur) ou relative (`"+=6"`, `"-=10"`). */
export type AnimValue = Expr;

export type Ease =
  | 'linear' | 'in' | 'out' | 'inOut' | 'inCubic' | 'outCubic' | 'inOutCubic' | 'outQuart'
  | 'outExpo' | 'inOutExpo' | 'outBack' | 'inOutBack' | 'outElastic' | 'outBounce' | 'inOutSine';

export type SfxKind = 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser';

export interface MotionStep {
  /** Instant de départ (s, temps de la scène) : nombre ou expression (`"D-1"`, `"V+0.2"`). */
  at: Expr;
  /** Un nœud, ses morceaux (`title.*`, `bars.2`), `world` (toute la scène), ou une liste. */
  target?: string | string[];
  /** Durée (s) : nombre ou expression (`"D"` = toute la scène, `"D-1.5"`). */
  dur?: Expr;
  ease?: Ease;
  /** L'état avant le pas (pour le premier pas d'un nœud : son état dès le début de la scène). */
  from?: Partial<Record<AnimProp, AnimValue>>;
  to?: Partial<Record<AnimProp, AnimValue>>;
  /** Décalage entre les cibles (s). */
  stagger?: number;
  order?: 'forward' | 'reverse' | 'center';
  /** Continue jusqu'à la fin de la scène : `loop` recommence, `yoyo` fait l'aller-retour. */
  repeat?: 'loop' | 'yoyo';
  /** `count` : le nombre du texte défile ; `type` : le texte s'écrit lettre par lettre. */
  effect?: 'count' | 'type';
  sfx?: SfxKind;
}

export interface MotionEnter {
  type: 'fade' | 'slide' | 'zoom' | 'none';
  dir?: 'left' | 'right' | 'up' | 'down';
  dur?: number;
}

export interface MotionProgram {
  bg?: Fill;
  enter?: MotionEnter;
  nodes: MotionNode[];
  timeline: MotionStep[];
}

export const NODE_TYPES: NodeType[] = ['text', 'rect', 'circle', 'line', 'path', 'polygon', 'image', 'video', 'logo', 'group', 'stack', 'repeat'];
export const ANIM_PROPS: AnimProp[] = ['x', 'y', 'rotation', 'scale', 'scaleX', 'scaleY', 'opacity', 'skewX', 'w', 'h', 'size', 'radius', 'fill', 'stroke', 'lineWidth', 'start', 'end', 'blur', 'zoom', 'panX', 'panY', 'letterSpacing'];
export const EASES: Ease[] = ['linear', 'in', 'out', 'inOut', 'inCubic', 'outCubic', 'inOutCubic', 'outQuart', 'outExpo', 'inOutExpo', 'outBack', 'inOutBack', 'outElastic', 'outBounce', 'inOutSine'];
export const SFX_KINDS: SfxKind[] = ['whoosh', 'softwhoosh', 'pop', 'click', 'tick', 'impact', 'shimmer', 'riser'];
export const COLOR_TOKENS = ['primary', 'secondary', 'accent', 'background', 'text', 'ink', 'white', 'black', 'transparent'] as const;
