/**
 * Les particules : une fonction pure de (graine, indice, temps).
 *
 * Aucun état, aucune accumulation d'une image à l'autre, aucun Math.random : la pose de la
 * particule i à l'instant t se calcule directement, quel que soit l'ordre dans lequel les images
 * sont rendues (c'est ce que le rendu image par image exige). Le hasard vient de `hash` seul.
 *
 * Six modes :
 *   - cycliques (fonction de `t`, secondes depuis le début de la scène) :
 *       drift     poussière lumineuse qui flotte
 *       rise      braises qui montent
 *       fall      confettis qui tombent
 *   - événements (fonction de `p`, 0 → 1, l'avancement de l'événement) :
 *       burst     éclat depuis un point
 *       converge  particules qui se rassemblent vers un point
 *       dissolve  une zone (un bloc de texte) qui se désintègre, de gauche à droite
 *
 * Positions en % du cadre ; déplacements en u (1 u = 1 % du petit côté du cadre), convertis en %
 * avec le rapport largeur/hauteur pour qu'un éclat reste un cercle dans les trois formats.
 */
import { clamp, hash, mix } from '../time';

export type ParticleMode = 'drift' | 'rise' | 'fall' | 'burst' | 'converge' | 'dissolve';
export type ParticleShape = 'dot' | 'square' | 'ring' | 'spark';

export const PARTICLE_MODES: ParticleMode[] = ['drift', 'rise', 'fall', 'burst', 'converge', 'dissolve'];
export const PARTICLE_SHAPES: ParticleShape[] = ['dot', 'square', 'ring', 'spark'];
/** Au-delà, le rendu image par image ralentit sans que l'œil en profite. */
export const MAX_PARTICLES = 120;

export interface ParticleSpec {
  mode: ParticleMode;
  /** 1 → MAX_PARTICLES. */
  count: number;
  seed: number;
  /** Zone d'émission [x0, y0, x1, y1] en % du cadre ; un point pour burst et converge. */
  area: [number, number, number, number];
  /** Taille minimale et maximale, en u. */
  size: [number, number];
  /** Agitation (balancement), 0 → 1. */
  turbulence: number;
  /** Portée du mouvement, en u. */
  reach: number;
  /** Durée d'un cycle, en secondes (modes cycliques). */
  life: number;
  /** Largeur / hauteur du cadre. */
  aspect: number;
  /** Formes tirées au hasard (graine) parmi cette liste. */
  shapes: ParticleShape[];
  /** Nombre de teintes de la palette (le composant leur donne leurs couleurs). */
  tones: number;
}

export interface ParticlePose {
  /** Centre, en % du cadre. */
  x: number;
  y: number;
  /** Taille, en u. */
  size: number;
  /** Degrés. */
  rot: number;
  alpha: number;
  tone: number;
  shape: ParticleShape;
  /** Allongement dans le sens du mouvement (étincelles) : 1 = rond. */
  stretch: number;
}

export const DEFAULT_SPEC: ParticleSpec = {
  mode: 'drift',
  count: 36,
  seed: 7,
  area: [0, 0, 100, 100],
  size: [0.5, 1.6],
  turbulence: 0.5,
  reach: 14,
  life: 6,
  aspect: 9 / 16,
  shapes: ['dot'],
  tones: 4,
};

/** Rend un jeu de paramètres sûr : bornes, valeurs finies. */
export function normalizeSpec(input: Partial<ParticleSpec>): ParticleSpec {
  const s = { ...DEFAULT_SPEC, ...input };
  const num = (v: number, d: number) => (Number.isFinite(v) ? v : d);
  const area = (s.area || DEFAULT_SPEC.area).map((v, i) => clamp(num(v, DEFAULT_SPEC.area[i]), -20, 120)) as ParticleSpec['area'];
  const size: ParticleSpec['size'] = [clamp(num(s.size?.[0], 0.5), 0.1, 30), clamp(num(s.size?.[1], 1.6), 0.1, 30)];
  if (size[1] < size[0]) size.reverse();
  return {
    mode: PARTICLE_MODES.includes(s.mode) ? s.mode : 'drift',
    count: Math.max(1, Math.min(MAX_PARTICLES, Math.round(num(s.count, 36)))),
    seed: num(s.seed, 7),
    area,
    size,
    turbulence: clamp(num(s.turbulence, 0.5)),
    reach: clamp(num(s.reach, 14), 0, 400),
    life: clamp(num(s.life, 6), 0.8, 60),
    aspect: clamp(num(s.aspect, 9 / 16), 0.2, 5),
    shapes: (s.shapes || []).filter((x) => PARTICLE_SHAPES.includes(x)).length ? s.shapes.filter((x) => PARTICLE_SHAPES.includes(x)) : ['dot'],
    tones: Math.max(1, Math.round(num(s.tones, 4))),
  };
}

const smooth = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / Math.max(1e-6, b - a));
  return x * x * (3 - 2 * x);
};
const easeOut = (q: number) => 1 - Math.pow(1 - clamp(q), 3);
const easeInOut = (q: number) => {
  const x = clamp(q);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Hasard stable de la particule i : `r(k)` renvoie toujours la même valeur pour le même (graine, i, k). */
const rand = (seed: number, i: number, salt = 0) => (k: number) => hash(seed * 97.13 + i * 12.9898 + salt * 3.713 + k * 78.233);

/** Dimensions du cadre en u (1 u = 1 % du petit côté) : sert à convertir un déplacement en u en %. */
function frameU(aspect: number): { w: number; h: number } {
  return aspect >= 1 ? { w: 100 * aspect, h: 100 } : { w: 100, h: 100 / aspect };
}

/**
 * La pose de la particule i. `t` : secondes depuis le début de la scène (modes cycliques) ;
 * `p` : avancement 0 → 1 de l'événement (burst, converge, dissolve).
 */
export function particleAt(spec: ParticleSpec, i: number, t: number, p: number): ParticlePose {
  const r = rand(spec.seed, i);
  const f = frameU(spec.aspect);
  const toX = (u: number) => (u / f.w) * 100;
  const toY = (u: number) => (u / f.h) * 100;
  const [x0, y0, x1, y1] = spec.area;
  const sizeRaw = r(10);
  const size = mix(spec.size[0], spec.size[1], sizeRaw * sizeRaw);
  // Les grosses particules vont un peu plus vite : une impression de profondeur sans 3D.
  const depth = mix(0.65, 1.35, sizeRaw);
  const tone = Math.floor(r(8) * spec.tones) % spec.tones;
  const shape = spec.shapes[Math.floor(r(9) * spec.shapes.length) % spec.shapes.length];
  const sway = (a: number, c: number) => spec.turbulence * Math.sin(a * Math.PI * 2 * mix(1, 2.6, r(6)) + r(7) * Math.PI * 2) * c;
  const pose = (x: number, y: number, rot: number, alpha: number, stretch = 1): ParticlePose => ({ x, y, size, rot, alpha: clamp(alpha), tone, shape, stretch: shape === 'spark' ? Math.max(1, stretch) * 3 : 1 });

  if (spec.mode === 'drift' || spec.mode === 'rise' || spec.mode === 'fall') {
    const life = spec.life * mix(0.7, 1.3, r(1));
    const cyc = Math.max(0, t) / life + r(2);
    const cycle = Math.floor(cyc);
    const a = cyc - cycle;
    // Chaque cycle repart d'un autre point : la poussière ne tourne pas en boucle visible.
    const rc = rand(spec.seed, i, cycle + 1);
    const ox = mix(x0, x1, rc(3));
    const oy = mix(y0, y1, rc(4));
    const travel = spec.reach * depth;
    let x = ox;
    let y = oy;
    if (spec.mode === 'drift') {
      x += toX((rc(5) - 0.5) * travel * 1.4 * a + sway(a, 2.2));
      y += toY((rc(11) - 0.5) * travel * 1.4 * a + sway(a + 0.25, 2.2));
    } else if (spec.mode === 'rise') {
      x += toX(sway(a, 3.2) + (rc(5) - 0.5) * travel * 0.3 * a);
      y -= toY(travel * a);
    } else {
      x += toX(sway(a, 3.6) + (rc(5) - 0.5) * travel * 0.4 * a);
      y += toY(travel * a);
    }
    const alpha = smooth(0, 0.16, a) * (1 - smooth(0.68, 1, a));
    return pose(x, y, (rc(12) - 0.5) * 120 + a * (r(13) - 0.5) * 540, alpha, 1.4);
  }

  if (spec.mode === 'burst' || spec.mode === 'converge') {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const angle = r(1) * Math.PI * 2;
    const dist = spec.reach * mix(0.35, 1, r(2)) * depth;
    const delay = r(3) * 0.16;
    const q = clamp((p - delay) / (1 - delay));
    if (spec.mode === 'burst') {
      const e = easeOut(q);
      const alpha = smooth(0, 0.07, q) * (1 - smooth(0.5, 1, q));
      return pose(cx + toX(Math.cos(angle) * dist * e + sway(q, 1.4)), cy + toY(Math.sin(angle) * dist * e + sway(q + 0.3, 1.4) + 4 * q * q * depth), angle * 57.3 + q * 160, alpha, 1 + (1 - q) * 1.4);
    }
    // converge : l'inverse, les particules arrivent de loin et s'éteignent en touchant le point.
    const e = 1 - easeInOut(q);
    const alpha = smooth(0, 0.22, q) * (1 - smooth(0.82, 1, q));
    return pose(cx + toX(Math.cos(angle) * dist * e + sway(q, 1.2) * e), cy + toY(Math.sin(angle) * dist * e + sway(q + 0.3, 1.2) * e), angle * 57.3 + (1 - q) * 120, alpha, 1 + e * 1.2);
  }

  // dissolve : la zone se défait de gauche à droite, les particules partent vers le haut, portées par le vent.
  const ox = mix(x0, x1, r(3));
  const oy = mix(y0, y1, r(4));
  const across = x1 > x0 ? clamp((ox - x0) / (x1 - x0)) : 0;
  const delay = across * 0.5 + r(5) * 0.12;
  const q = clamp((p - delay) / (1 - delay));
  const e = easeOut(q);
  const angle = -Math.PI / 2 + (r(1) - 0.5) * 1.7 + 0.35;
  const travel = spec.reach * mix(0.4, 1, r(2)) * depth;
  const alpha = q <= 0 ? 0 : smooth(0, 0.06, q) * (1 - Math.pow(clamp(q), 1.6));
  return pose(ox + toX(Math.cos(angle) * travel * e + sway(q, 2)), oy + toY(Math.sin(angle) * travel * e + sway(q + 0.4, 2)), (r(13) - 0.5) * 420 * q, alpha, 1 + (1 - q) * 0.6);
}

/** Toutes les poses d'un instant (le composant les rend, les contrôles les comparent). */
export function particlesAt(input: Partial<ParticleSpec>, t: number, p = 0): ParticlePose[] {
  const spec = normalizeSpec(input);
  return Array.from({ length: spec.count }, (_, i) => particleAt(spec, i, t, p));
}
