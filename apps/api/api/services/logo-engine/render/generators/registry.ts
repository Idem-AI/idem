/**
 * LE CATALOGUE DES GÉNÉRATEURS — les symboles que le moteur sait construire.
 *
 * Un générateur est une construction géométrique paramétrée : « rosace à N pétales », « barres
 * ascendantes », « flamme », « hibou ». L'agent n'en dessine pas le tracé, il CHOISIT un
 * générateur et règle ses paramètres : quelques dizaines de tokens au lieu de milliers, un
 * résultat propre par construction, et un espace de variations immense (formes × paramètres ×
 * graine × opérations booléennes).
 *
 * Chaque générateur dessine dans la boîte 0–100 et annonce les tons qu'il utilise :
 *   a  couleur principale de la couche      b  seconde encre (ink2)
 *   c  accent                               knockout  découpe (le fond transparaît)
 */
import type { GeometryKernel } from '../../kernel/geometry';

export type Tone = 'a' | 'b' | 'c' | 'knockout';

export interface GenPart {
  d: string;
  tone: Tone;
}

export type ParamDef =
  | { kind: 'num'; min: number; max: number; def: number; int?: boolean }
  | { kind: 'opt'; options: readonly string[]; def: string }
  | { kind: 'bool'; def: boolean };

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export type GeneratorFamily = 'abstract' | 'pictorial' | 'mascot' | 'frame';

export interface GeneratorSpec {
  id: string;
  label: string;
  family: GeneratorFamily;
  /** Mots-clés (français et anglais) qui rattachent le générateur à un secteur ou une personnalité. */
  tags: string[];
  /** Nombre de tons utilisés (1 = une encre ; 2 = + ink2 ; 3 = + accent). */
  tones: 1 | 2 | 3;
  params: Record<string, ParamDef>;
  build(p: Params, ctx: GenContext): GenPart[];
}

export interface GenContext {
  kernel: GeometryKernel;
  rng: () => number;
}

const REGISTRY = new Map<string, GeneratorSpec>();

export function register(spec: GeneratorSpec): void {
  REGISTRY.set(spec.id, spec);
}

export const getGenerator = (id: string): GeneratorSpec | undefined => REGISTRY.get(id);
export const listGenerators = (family?: GeneratorFamily): GeneratorSpec[] => [...REGISTRY.values()].filter((g) => !family || g.family === family);

/** Défauts + valeurs de l'auteur ramenées dans leurs bornes ; clés inconnues ignorées. */
export function resolveParams(spec: GeneratorSpec, input: Params = {}): Params {
  const out: Params = {};
  for (const [key, def] of Object.entries(spec.params)) {
    const raw = input[key];
    if (def.kind === 'num') {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      const v = Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, n)) : def.def;
      out[key] = def.int ? Math.round(v) : v;
    } else if (def.kind === 'opt') {
      out[key] = typeof raw === 'string' && def.options.includes(raw) ? raw : def.def;
    } else {
      out[key] = typeof raw === 'boolean' ? raw : raw === 'true' ? true : raw === 'false' ? false : def.def;
    }
  }
  return out;
}

/** Tire des paramètres au hasard (graine) dans les bornes : la variation du planificateur. */
export function randomParams(spec: GeneratorSpec, rng: () => number, keys?: string[]): Params {
  const out: Params = {};
  for (const [key, def] of Object.entries(spec.params)) {
    if (keys && !keys.includes(key)) continue;
    if (def.kind === 'num') {
      const v = def.min + rng() * (def.max - def.min);
      out[key] = def.int ? Math.round(v) : Math.round(v * 100) / 100;
    } else if (def.kind === 'opt') out[key] = def.options[Math.floor(rng() * def.options.length)];
    else out[key] = rng() < 0.5;
  }
  return out;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une ligne par générateur, pour un prompt : `rosette(petals 3-12=6, shape leaf|ellipse=leaf)`. */
export function describeGenerator(spec: GeneratorSpec): string {
  const params = Object.entries(spec.params).map(([key, def]) => {
    if (def.kind === 'num') return `${key} ${def.min}-${def.max}=${def.def}`;
    if (def.kind === 'opt') return `${key} ${def.options.join('|')}=${def.def}`;
    return `${key} bool=${def.def}`;
  });
  return `${spec.id}(${params.join(', ')})`;
}

export const num = (min: number, max: number, def: number, int = false): ParamDef => ({ kind: 'num', min, max, def, int });
export const opt = (options: readonly string[], def?: string): ParamDef => ({ kind: 'opt', options, def: def ?? options[0] });
export const bool = (def = false): ParamDef => ({ kind: 'bool', def });
