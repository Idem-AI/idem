/**
 * Aléa déterministe : une graine (le plus souvent la clé du document) produit toujours la même
 * suite. C'est ce qui rend un rendu rejouable et un classement SEMÉ PAR LE PROJET — jamais par
 * un numéro de page, qui donnait trois projets de même style aux mêmes mises en page.
 */

/** Hachage 32 bits d'une chaîne (xmur3). */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: number | string) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
    this.state = this.seed;
  }

  /** Flottant dans [0, 1[ (mulberry32). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Tirage pondéré ; un poids nul ou négatif n'est jamais tiré (sauf si tout l'est). */
  weighted<T>(items: ReadonlyArray<{ value: T; weight: number }>): T {
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) return items[Math.floor(this.next() * items.length)].value;
    let cursor = this.next() * total;
    for (const item of items) {
      cursor -= Math.max(0, item.weight);
      if (cursor < 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Un sous-générateur indépendant : ajouter une décision ne décale pas les autres. */
  fork(label: string): Rng {
    return new Rng(`${this.seed}:${label}`);
  }
}

export const rngFor = (...parts: Array<string | number | undefined>): Rng => new Rng(parts.filter((p) => p !== undefined).join('|'));
