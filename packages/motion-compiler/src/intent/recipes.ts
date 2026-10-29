/**
 * LES RECETTES DE MOUVEMENT — un verbe de l'intention → des pas du langage, avec des valeurs NOMMÉES (durée, courbe,
 * décalage) que le système de design du film résout. Des recettes composables, jamais des scènes toutes faites.
 *
 * Portées des mesures des films HyperFrames (HeyGen, Apache-2.0 — voir NOTICE : skills `motion`, `motion-doctrine`,
 * `cut-the-curve`) :
 *
 *   reveal    titre mot par mot : flou → net et opacité, sans déplacement, ≈ 0,13 s par mot, 60–120 ms d'écart ;
 *             lettre par lettre pour un nom ; la ligne entière qui sort du flou (8 px → 0) ;
 *   rise      monter et apparaître — permis, jamais pour TOUT (le juge compte les entrées identiques) ;
 *   slide-in  arriver d'un côté par un déplacement PARTIEL (≈ 12 % de l'image), courbe de coupe (power4 out) ;
 *   pop       ressort sur la taille, l'opacité jamais ne rebondit (deux pas) ;
 *   stack /   « waterfall entry » : opacité binaire, montée courte, décalages serrés, une seule direction ;
 *   cascade
 *   draw      un trait qui se dessine, une barre qui pousse depuis son bord ;
 *   wipe      un média dont le cadre s'ouvre, puis un lent travelling (« camera with intent ») ;
 *   highlight un mot porteur de sens prend la couleur d'accent ;
 *   focus     la caméra s'approche ; sur un média, vers son point d'intérêt (le clic d'une démo produit) ;
 *   nudge     glissement lent–rapide–lent d'un groupe (10 / 65 / 25 % de la distance, 20 / 18 / 62 % du temps) ;
 *   exit      plus courte de 40 à 50 % que l'entrée, flou et fondu.
 *
 * Interdit par la doctrine et donc absent : les boucles d'attente (respirer, flotter, pulser) sur un titre ou une
 * interface, un titre qui bouge encore après s'être posé.
 */
import type { AnimProp, AnimValue, DurToken, EaseToken, StaggerToken } from '../dsl/types';
import type { IntentBeat, Verb } from './types';

export interface Move {
  /** Identifiants de nœuds (après développement : une liste devient ses items). */
  target: string | string[];
  from?: Partial<Record<AnimProp, AnimValue>>;
  to?: Partial<Record<AnimProp, AnimValue>>;
  dur: DurToken | 'D' | number;
  ease: EaseToken | 'linear';
  stagger?: StaggerToken | number;
  effect?: 'count' | 'type' | 'point';
  /** Décalage (s) par rapport au départ du verbe (un pas second dans la même recette). */
  offset?: number;
  /** Mouvement principal (compte dans les mouvements simultanés), d'ambiance (toute la scène), ou d'accent. */
  kind: 'entrance' | 'ambient' | 'accent' | 'exit';
}

export interface RecipeTarget {
  /** Nature du nœud visé. */
  node: 'text' | 'media' | 'shape-line' | 'shape-fill' | 'logo' | 'icon' | 'group' | 'world';
  /** Les identifiants de ses morceaux quand il en a (mots découpés, items d'une liste). */
  parts?: string[];
  /** Nombre de signes (écriture lettre par lettre). */
  chars?: number;
  /** Le mot mis en valeur (rang). */
  emphasis?: number;
  /** Format vertical (la direction par défaut d'un glissement change). */
  tall?: boolean;
  /** Un appareil : l'identifiant de son écran (le média où zoomer). */
  screen?: string;
}

export interface NodeNeeds {
  split?: 'words' | 'chars';
  /** Un cadre qui s'ouvre depuis un bord : l'ancre du nœud. */
  anchor?: 'top' | 'left' | 'bottom' | 'right';
  /** Le nœud démarre caché (un mot d'accent, une barre à zéro) : la propriété et sa valeur initiale. */
  initial?: Partial<Record<AnimProp, AnimValue>>;
}

const AMPLITUDE = { soft: 0.6, normal: 1, strong: 1.4 } as const;

/** Les besoins d'un nœud pour un verbe (découpe, ancre) : le développement de l'intention les applique. */
export function needsOf(beat: IntentBeat, t: RecipeTarget): NodeNeeds {
  if (beat.verb === 'reveal' && t.node === 'text') return beat.style === 'letters' ? { split: 'chars' } : beat.style === 'line' ? {} : { split: 'words' };
  if (beat.verb === 'highlight' && t.node === 'text' && t.emphasis !== undefined) return { split: 'words' };
  if (beat.verb === 'wipe' && t.node === 'media') return { anchor: beat.from === 'left' ? 'left' : beat.from === 'right' ? 'right' : beat.from === 'bottom' ? 'bottom' : 'top' };
  if (beat.verb === 'draw' && t.node === 'shape-fill') return { anchor: beat.from === 'top' ? 'top' : beat.from === 'bottom' ? 'bottom' : 'left' };
  return {};
}

/** Un verbe → ses pas (les instants sont posés ensuite par le solveur temporel). */
export function recipe(beat: IntentBeat, t: RecipeTarget, id: string): Move[] {
  const amp = AMPLITUDE[beat.intensity || 'normal'];
  const r = (n: number) => Math.round(n * amp * 100) / 100;
  const parts = t.parts && t.parts.length ? t.parts : null;
  const all = parts ? parts : id;
  const travel = (dir: IntentBeat['from'], share: number) => {
    // Un déplacement PARTIEL, en part de l'image (W, H) : jamais de traversée complète.
    const k = r(share);
    if (dir === 'left') return { x: `-=W*${k}` };
    if (dir === 'right') return { x: `+=W*${k}` };
    if (dir === 'top') return { y: `-=H*${k}` };
    return { y: `+=H*${k}` };
  };
  const verb: Verb = beat.verb;
  switch (verb) {
    case 'reveal':
      if (t.node === 'text' && beat.style === 'letters') return [{ target: `${id}.*`, from: { opacity: 0, blur: 0.35 }, to: {}, dur: 'quick', ease: 'arrive', stagger: 'letters', kind: 'entrance' }];
      if (t.node === 'text' && beat.style !== 'line') return [{ target: `${id}.*`, from: { opacity: 0, blur: 0.6 }, to: {}, dur: 'quick', ease: 'arrive', stagger: 'words', kind: 'entrance' }];
      return [{ target: all, from: { opacity: 0, blur: 0.75 }, to: {}, dur: 'short', ease: 'arrive', ...(parts ? { stagger: 'items' as const } : {}), kind: 'entrance' }];
    case 'blur-in':
      return [{ target: all, from: { opacity: 0, blur: r(1) }, to: {}, dur: 'short', ease: 'arrive', ...(parts ? { stagger: 'items' as const } : {}), kind: 'entrance' }];
    case 'rise':
      return [{ target: all, from: { opacity: 0, ...travel(beat.from === 'top' ? 'top' : 'bottom', 0.025) }, to: {}, dur: 'medium', ease: 'enter', ...(parts ? { stagger: 'items' as const } : {}), kind: 'entrance' }];
    case 'slide-in': {
      const dir = beat.from || (t.tall ? 'bottom' : 'left');
      return [
        { target: all, from: travel(dir === 'center' ? 'bottom' : dir, 0.12), to: {}, dur: 'medium', ease: 'cut-out', ...(parts ? { stagger: 'items' as const } : {}), kind: 'entrance' },
        { target: all, from: { opacity: 0.35 }, to: { opacity: 1 }, dur: 'quick', ease: 'linear', ...(parts ? { stagger: 'items' as const } : {}), kind: 'accent' },
      ];
    }
    case 'pop':
      return [
        { target: all, from: { scale: Math.max(0.3, 1 - r(0.4)) }, to: {}, dur: 'medium', ease: 'spring', ...(parts ? { stagger: 'items' as const } : {}), kind: 'entrance' },
        { target: all, from: { opacity: 0 }, to: { opacity: 1 }, dur: 'quick', ease: 'standard', ...(parts ? { stagger: 'items' as const } : {}), kind: 'accent' },
      ];
    case 'grow':
      return [{ target: all, from: { opacity: 0, scale: Math.max(0.5, 1 - r(0.08)) }, to: {}, dur: 'medium', ease: 'enter', ...(parts ? { stagger: 'cards' as const } : {}), kind: 'entrance' }];
    case 'stack':
    case 'cascade': {
      const dir = beat.from === 'top' ? 'top' : 'bottom';
      return [
        // Opacité BINAIRE (une arrivée claque, elle ne fond pas) ; la montée courte porte le mouvement.
        { target: all, from: { opacity: 0 }, to: { opacity: 1 }, dur: 0.02, ease: 'linear', stagger: 'items', kind: 'accent' },
        { target: all, from: travel(dir, 0.03), to: {}, dur: 'quick', ease: 'cut-out', stagger: 'items', kind: 'entrance' },
      ];
    }
    case 'draw':
      if (t.node === 'shape-line') return [{ target: id, from: { end: 0 }, to: { end: 1 }, dur: 'long', ease: 'move', kind: 'entrance' }];
      if (t.node === 'shape-fill') return [{ target: id, from: beat.from === 'top' || beat.from === 'bottom' ? { scaleY: 0 } : { scaleX: 0 }, to: beat.from === 'top' || beat.from === 'bottom' ? { scaleY: 1 } : { scaleX: 1 }, dur: 'medium', ease: 'enter', kind: 'entrance' }];
      return [{ target: all, from: { opacity: 0 }, to: {}, dur: 'medium', ease: 'standard', kind: 'entrance' }];
    case 'count':
      return [
        { target: id, from: { opacity: 0, blur: 0.5 }, to: {}, dur: 'short', ease: 'arrive', kind: 'entrance' },
        { target: id, effect: 'count', dur: 'xlong', ease: 'arrive', offset: 0.05, kind: 'accent' },
      ];
    case 'type':
      return [{ target: id, effect: 'type', dur: Math.min(2.2, Math.max(0.5, (t.chars || 20) * 0.04)), ease: 'linear', kind: 'entrance' }];
    case 'wipe': {
      const prop = beat.from === 'left' || beat.from === 'right' ? 'w' : 'h';
      return [
        { target: id, from: { [prop]: 0 }, to: {}, dur: 'long', ease: 'enter', kind: 'entrance' },
        { target: id, from: { zoom: 1 + r(0.12) }, to: { zoom: 1 }, dur: 'D', ease: 'move', kind: 'ambient' },
      ];
    }
    case 'highlight':
      if (t.node === 'text' && t.emphasis !== undefined) return [{ target: `${id}.${t.emphasis}`, to: { fill: 'accent' }, dur: 'short', ease: 'standard', kind: 'accent' }];
      return [{ target: id, from: { scale: 1 }, to: { scale: 1 + r(0.04) }, dur: 'short', ease: 'spring', kind: 'accent' }];
    case 'zoom':
      return [{ target: id, from: { zoom: 1 + r(0.15) }, to: { zoom: 1 }, dur: 'D', ease: 'move', kind: 'ambient' }];
    case 'push':
      return [{ target: 'world', from: { scale: 1 }, to: { scale: 1 + r(0.05) }, dur: 'D', ease: 'move', kind: 'ambient' }];
    case 'focus':
      // Sur un média : le zoom va VERS son point d'intérêt (le bouton cliqué d'une démo produit, sinon le sujet).
      if (t.node === 'media') return [{ target: t.screen ?? id, effect: 'point', to: { zoom: 1 + r(0.7) }, dur: 'long', ease: 'move', kind: 'accent' }];
      return [{ target: 'world', to: { scale: 1 + r(0.18) }, dur: 'long', ease: 'move', kind: 'accent' }];
    case 'nudge':
      return [
        { target: id, to: { y: `-=H*${r(0.004)}` }, dur: 0.12, ease: 'cut-in', kind: 'accent' },
        { target: id, to: { y: `-=H*${r(0.026)}` }, dur: 0.11, ease: 'linear', offset: 0.12, kind: 'accent' },
        { target: id, to: { y: `-=H*${r(0.01)}` }, dur: 0.37, ease: 'cut-out', offset: 0.23, kind: 'accent' },
      ];
    case 'exit':
      return [{ target: all, to: { opacity: 0, blur: 0.6 }, dur: 'quick', ease: 'exit', ...(parts ? { stagger: 'words' as const } : {}), kind: 'exit' }];
  }
  return [];
}
