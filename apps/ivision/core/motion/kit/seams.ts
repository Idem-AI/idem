/**
 * LES COUTURES ENTRE SCÈNES — planifiées par le code à l'échelle du film (`design/film.ts#planSeams`), jouées ici sur
 * une enveloppe qui contient toute la scène (`r_seam` du code compilé) : la scène A sort, B entre, avec la même
 * direction et la même vitesse de part et d'autre de la coupe (loi vectorielle), la coupe tombe en plein mouvement.
 *
 * Paramètres mesurés sur les films HyperFrames (HeyGen, Apache-2.0 — voir NOTICE) : déplacement PARTIEL d'environ
 * 12 % de l'image, courbes miroirs (power4 in / out : les deux moitiés d'une même courbe), flou de 10 px pour un
 * texte (≈ 0,9 u), de 18–20 px pour un plein cadre, opacité qui s'éteint juste à la coupe.
 */
import { Circle, Node, Rect, View2D } from '@motion-canvas/2d';
import { all, delay, linear, ThreadGenerator, waitFor } from '@motion-canvas/core';
import { cubicBezier } from './design';

export type SeamKind = 'cut-the-curve' | 'zoom-through' | 'inverse-zoom' | 'blur-swap' | 'colour-flood' | 'whip' | 'dip-cut' | 'cut';
export type SeamDir = 'left' | 'right' | 'up' | 'down';

export interface SeamData {
  kind: SeamKind;
  dir: SeamDir;
  /** Couleur de fond de la scène suivante (coulée de couleur). */
  color?: string;
}

const CUT_IN = cubicBezier([0.5, 0, 0.75, 0]);
const CUT_OUT = cubicBezier([0.25, 1, 0.5, 1]);
const ARRIVE = cubicBezier([0.16, 1, 0.3, 1]);
const MOVE = cubicBezier([0.45, 0, 0.55, 1]);

/** Durée de la sortie (s) : elle finit exactement à la coupe. */
export function seamOutDuration(seam?: SeamData | null): number {
  if (!seam) return 0;
  switch (seam.kind) {
    case 'cut-the-curve':
      return 0.32;
    case 'zoom-through':
    case 'inverse-zoom':
    case 'whip':
      return 0.2;
    case 'blur-swap':
      return 0.18;
    case 'colour-flood':
      return 0.42;
    case 'dip-cut':
      return 0.1;
    default:
      return 0;
  }
}

/** La sortie le long d'un axe : vers où va la scène. */
function travel(dir: SeamDir, w: number, h: number, share: number): { x: number; y: number } {
  if (dir === 'left') return { x: -w * share, y: 0 };
  if (dir === 'right') return { x: w * share, y: 0 };
  if (dir === 'up') return { x: 0, y: -h * share };
  return { x: 0, y: h * share };
}

/** La SORTIE de la scène (lancée pour finir à la coupe). */
export function* seamOut(node: Node, view: View2D, seam: SeamData, size: { width: number; height: number; unit: number }): ThreadGenerator {
  const d = seamOutDuration(seam);
  if (!d) return;
  const blurU = size.unit * 0.9;
  switch (seam.kind) {
    case 'cut-the-curve': {
      const t = travel(seam.dir, size.width, size.height, 0.12);
      yield* all(node.position([t.x, t.y], d, CUT_IN), delay(d - 0.24, node.opacity(0, 0.24, linear)));
      return;
    }
    case 'whip': {
      const t = travel(seam.dir, size.width, size.height, 0.3);
      yield* all(node.position([t.x, t.y], d, CUT_IN), node.filters.blur(blurU * 1.6, d, CUT_IN));
      return;
    }
    case 'zoom-through':
      yield* all(node.scale(1.2, d, CUT_IN), node.filters.blur(blurU, d, CUT_IN), node.opacity(0.15, d, linear));
      return;
    case 'inverse-zoom':
      yield* all(node.scale(0.8, d, CUT_IN), node.filters.blur(blurU, d, CUT_IN), node.opacity(0.15, d, linear));
      return;
    case 'blur-swap':
      yield* all(node.opacity(0, d, linear), node.filters.blur(blurU * 0.9, d, linear));
      return;
    case 'colour-flood': {
      // La couleur de la scène suivante envahit le cadre depuis le centre : la coupe se fait sous elle.
      const diag = Math.hypot(size.width, size.height);
      const flood = new Circle({ size: 0, fill: seam.color || '#ffffff', zIndex: 1500 });
      view.add(flood);
      yield* flood.size(diag * 1.05, d, MOVE);
      return;
    }
    case 'dip-cut': {
      const dip = new Rect({ width: size.width, height: size.height, fill: '#000000', opacity: 0, zIndex: 1500 });
      view.add(dip);
      yield* dip.opacity(0.4, d, linear);
      return;
    }
    default:
      yield* waitFor(0);
  }
}

/** L'ENTRÉE de la scène (dès la coupe, en plein mouvement : jamais depuis le repos). */
export function* seamIn(node: Node, seam: SeamData, size: { width: number; height: number; unit: number }): ThreadGenerator {
  const blurU = size.unit * 0.9;
  switch (seam.kind) {
    case 'cut-the-curve': {
      const t = travel(seam.dir, size.width, size.height, 0.12);
      node.position([-t.x, -t.y]);
      node.opacity(0.35);
      yield* all(node.position([0, 0], 0.34, CUT_OUT), node.opacity(1, 0.18, linear));
      return;
    }
    case 'whip': {
      const t = travel(seam.dir, size.width, size.height, 0.18);
      node.position([-t.x, -t.y]);
      node.filters.blur(blurU * 1.6);
      yield* all(node.position([0, 0], 0.2, CUT_OUT), node.filters.blur(0, 0.13, CUT_OUT));
      return;
    }
    case 'zoom-through':
      node.scale(0.75);
      node.filters.blur(blurU);
      node.opacity(0.15);
      yield* all(node.scale(1, 0.5, ARRIVE), node.filters.blur(0, 0.5, ARRIVE), node.opacity(1, 0.5, ARRIVE));
      return;
    case 'inverse-zoom':
      node.scale(1.25);
      node.filters.blur(blurU);
      node.opacity(0.15);
      yield* all(node.scale(1, 0.5, ARRIVE), node.filters.blur(0, 0.5, ARRIVE), node.opacity(1, 0.5, ARRIVE));
      return;
    case 'blur-swap':
      node.filters.blur(blurU * 0.9);
      node.opacity(0);
      yield* all(node.filters.blur(0, 0.15, ARRIVE), node.opacity(1, 0.15, linear));
      return;
    default:
      yield* waitFor(0);
  }
}
