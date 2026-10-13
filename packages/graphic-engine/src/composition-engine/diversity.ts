/**
 * La DIVERSITÉ, en trois niveaux :
 *  1. structurelle — le motif, ses paramètres et la SILHOUETTE de la page (régions sur une grille 12 × 8),
 *     mesurable sans IA et avant le rendu ;
 *  2. stylistique — stratégie de couleur, tension, accent, dans les limites de la marque ;
 *  3. visuelle — la silhouette MESURÉE sur la page rendue (quality-engine/browser), qui vérifie que deux
 *     compositions structurellement différentes ne se ressemblent pas à l'œil.
 *
 * On garde les EMPREINTES des compositions, jamais les pages : c'est léger, comparable, et cela suffit à
 * éviter de se répéter dans un document puis dans les documents récents d'une même marque. La portée de
 * la mémoire est explicite (document, puis récents) : une diversité globale pénaliserait les compositions
 * justement les plus adaptées à certains contenus.
 */
import type { Params } from '../contracts/common';
import type { Region } from '../design-system/patterns/types';
import { stableHash } from '../foundation/hash';

const COLS = 12;
const ROWS = 8;
const CODE: Record<Region['kind'], string> = { header: 'H', body: 'B', figure: 'F', band: 'N', aside: 'A', decor: 'D' };

/** La silhouette : la grille 12 × 8 où chaque case porte la région qui la couvre (ou `.`). */
export function silhouette(regions: Region[]): string {
  const cells = Array<string>(COLS * ROWS).fill('.');
  // Les régions les plus « lourdes » d'abord écrites, puis recouvertes par celles qui portent du sens.
  const order: Region['kind'][] = ['decor', 'band', 'body', 'aside', 'figure', 'header'];
  for (const kind of order) {
    for (const r of regions.filter((x) => x.kind === kind)) {
      const x0 = Math.max(0, Math.floor((r.x / 100) * COLS));
      const x1 = Math.min(COLS, Math.ceil(((r.x + r.w) / 100) * COLS));
      const y0 = Math.max(0, Math.floor((r.y / 100) * ROWS));
      const y1 = Math.min(ROWS, Math.ceil(((r.y + r.h) / 100) * ROWS));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cells[y * COLS + x] = CODE[r.kind];
    }
  }
  return cells.join('');
}

/** Ressemblance de deux silhouettes, 0..1 (1 = mêmes régions aux mêmes places). */
export function silhouetteSimilarity(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 0;
  let same = 0;
  let counted = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '.' && b[i] === '.') continue;
    counted += 1;
    if (a[i] === b[i]) same += 1;
  }
  return counted ? same / counted : 1;
}

export interface Fingerprint {
  pattern: string;
  params: string;
  strategy: string;
  tension: string;
  accent: string;
  silhouette: string;
}

export function fingerprintOf(pattern: string, params: Params | undefined, look: { strategy: string; tension: string; accent: string }, regions: Region[]): Fingerprint {
  const p = Object.entries(params ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return { pattern, params: p, strategy: look.strategy, tension: look.tension, accent: look.accent, silhouette: silhouette(regions) };
}

/** L'empreinte sérialisée (posée sur la page en `data-ge-fp`, gardée en mémoire). */
export const serialize = (f: Fingerprint): string => `${f.pattern}|${f.params}|${f.strategy}|${f.tension}|${f.accent}|${f.silhouette}`;

export function parse(text: string): Fingerprint | null {
  const [pattern, params, strategy, tension, accent, sil] = text.split('|');
  return pattern && sil ? { pattern, params: params ?? '', strategy: strategy ?? '', tension: tension ?? '', accent: accent ?? '', silhouette: sil } : null;
}

/**
 * Ressemblance de deux compositions, 0..1. La silhouette pèse le plus : c'est ce que le lecteur reconnaît
 * d'une double page avant d'avoir lu un mot ; viennent ensuite le motif, puis le style.
 */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  const sil = silhouetteSimilarity(a.silhouette, b.silhouette);
  const pattern = a.pattern === b.pattern ? 1 : a.pattern.split('.')[0] === b.pattern.split('.')[0] ? 0.15 : 0;
  const params = a.pattern === b.pattern && a.params === b.params ? 1 : 0;
  const style = (a.strategy === b.strategy ? 0.4 : 0) + (a.tension === b.tension ? 0.35 : 0) + (a.accent === b.accent ? 0.25 : 0);
  return 0.5 * sil + 0.22 * pattern + 0.1 * params + 0.18 * style;
}

/** La mémoire de diversité : les empreintes de ce document, puis celles des documents récents. */
export class DiversityMemory {
  private readonly document: Fingerprint[] = [];
  /** La position (page) de chaque empreinte, quand elle est connue. */
  private readonly positions: Array<number | undefined> = [];
  private readonly recent: Fingerprint[];

  constructor(recent: string[] = []) {
    this.recent = recent.map(parse).filter((f): f is Fingerprint => Boolean(f)).slice(-40);
  }

  /** Une page recomposée (correction, rejeu) REMPLACE son empreinte : jamais de page fantôme dans le document. */
  add(f: Fingerprint, index?: number): void {
    const at = index === undefined ? -1 : this.positions.indexOf(index);
    if (at >= 0) {
      this.document[at] = f;
      return;
    }
    this.document.push(f);
    this.positions.push(index);
  }

  /**
   * Les motifs RÉELLEMENT retenus par les pages voisines (index ± 1) déjà composées. Les réservations du plan
   * ne suffisent pas : une page dont le motif réservé ne convenait pas à son contenu en prend un autre — qui
   * peut être celui que sa voisine a réservé.
   */
  neighbors(index?: number): string[] {
    if (index === undefined) return [];
    return this.document.filter((_, i) => {
      const position = this.positions[i];
      return position !== undefined && Math.abs(position - index) === 1;
    }).map((f) => f.pattern);
  }

  /** La ressemblance la plus forte avec les `window` dernières pages du document (0 si vide). */
  nearestInDocument(f: Fingerprint, window = 3): number {
    return this.document.slice(-window).reduce((m, g) => Math.max(m, similarity(f, g)), 0);
  }

  nearestRecent(f: Fingerprint): number {
    return this.recent.reduce((m, g) => Math.max(m, similarity(f, g)), 0);
  }

  /** Combien de fois ce motif a déjà servi dans le document. */
  uses(pattern: string): number {
    return this.document.filter((f) => f.pattern === pattern).length;
  }

  get size(): number {
    return this.document.length;
  }

  snapshot(): string[] {
    return this.document.map(serialize);
  }
}

/** Écart moyen et minimal entre toutes les paires : la mesure que les contrôles comparent à la référence. */
export function diversityStats(prints: Fingerprint[]): { pairs: number; meanDistance: number; minDistance: number; distinctPatterns: number } {
  let pairs = 0;
  let sum = 0;
  let min = 1;
  for (let i = 0; i < prints.length; i++)
    for (let j = i + 1; j < prints.length; j++) {
      const d = 1 - similarity(prints[i], prints[j]);
      pairs += 1;
      sum += d;
      min = Math.min(min, d);
    }
  return { pairs, meanDistance: pairs ? Math.round((sum / pairs) * 1000) / 1000 : 1, minDistance: pairs ? Math.round(min * 1000) / 1000 : 1, distinctPatterns: new Set(prints.map((p) => p.pattern)).size };
}

export const fingerprintId = (f: Fingerprint): string => stableHash(serialize(f), 10);
