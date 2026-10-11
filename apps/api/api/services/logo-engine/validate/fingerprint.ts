/**
 * L'EMPREINTE D'UN LOGO — de quoi mesurer si deux propositions disent la même chose.
 *
 * Deux niveaux, comme pour les vidéos : la STRUCTURE (type, motifs, effets, mise en page), lue
 * dans le document sans rendre quoi que ce soit, et la FORME (une grille 16 × 16 d'encre du
 * symbole), lue sur pixels. La distance est calculée sur les deux : deux logos qui utilisent
 * des motifs différents mais dessinent la même silhouette sont proches ; deux logos qui
 * partagent un motif mais le règlent autrement peuvent être différents.
 *
 * Les empreintes sont des objets JSON simples : on les garde avec le projet pour que les
 * générations suivantes évitent ce qui a déjà été proposé.
 */
import type { LogoDocument } from '../ir/logo.schema';
import { walkLayers } from '../ir/logo.schema';
import type { LogoSession } from '../render/build';
import { flipGrid, gridSimilarity, inkGrid } from '../raster/measure';
import type { Rasterizer } from '../raster/rasterizer';
import { defaultRasterizer } from '../raster/rasterizer';

export interface LogoFingerprint {
  type: string;
  layout: string;
  /** Motifs structurels : générateurs, géométries, effets, opérations (triés, sans doublon). */
  motifs: string[];
  /** Empreinte de forme : 16 × 16 cases d'encre (0..1), arrondies à 2 décimales. */
  grid: number[];
}

/** Les motifs structurels d'un document. */
export function motifsOf(doc: Pick<LogoDocument, 'layers'>): string[] {
  const set = new Set<string>();
  walkLayers(doc.layers, (layer) => {
    if (layer.kind === 'generator') set.add(`gen:${layer.generator}`);
    else if (layer.kind === 'shape') set.add(`shape:${layer.geometry.type}`);
    else if (layer.kind === 'boolean') set.add(`op:${layer.op}`);
    else if (layer.kind === 'repeat') set.add(`repeat:${layer.mode}`);
    else if (layer.kind === 'text') {
      if (layer.curve) set.add('text:curve');
      for (const effect of layer.effects ?? []) set.add(`fx:${effect.type}`);
      if (layer.role === 'symbol') set.add('text:letter');
    }
  });
  return [...set].sort();
}

export async function fingerprintOf(session: LogoSession, rasterizer: Rasterizer = defaultRasterizer()): Promise<LogoFingerprint | null> {
  const symbol = session.render({ layout: 'symbol-only' });
  const main = session.render();
  const source = symbol ?? main;
  if (!source || !main) return null;
  const image = await rasterizer.render(source.svg, 64, null);
  const grid = Array.from(inkGrid(image, 16), (v) => Math.round(v * 100) / 100);
  return { type: session.doc.concept.type, layout: main.layout, motifs: motifsOf(session.doc), grid };
}

const jaccard = (a: string[], b: string[]) => {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 1;
};

/**
 * Distance entre deux empreintes : 0 = la même idée, 1 = rien de commun.
 * Poids : forme 0,45 · motifs 0,35 · type 0,12 · mise en page 0,08.
 */
export function fingerprintDistance(a: LogoFingerprint, b: LogoFingerprint): number {
  const ga = Float32Array.from(a.grid);
  const gb = Float32Array.from(b.grid);
  // Un logo retourné est le même logo : on garde la meilleure ressemblance.
  const shape = Math.max(gridSimilarity(ga, gb), gridSimilarity(ga, flipGrid(gb)));
  return 0.45 * (1 - shape) + 0.35 * (1 - jaccard(a.motifs, b.motifs)) + 0.12 * (a.type === b.type ? 0 : 1) + 0.08 * (a.layout === b.layout ? 0 : 1);
}

/** Seuils (même logique que les vidéos : on répare jusqu'au seuil, jamais jusqu'à la distance maximale). */
export const LOGO_SIMILARITY = { tooClose: 0.22, distinct: 0.4 } as const;

/** La plus petite distance d'une empreinte à un ensemble (1 si l'ensemble est vide). */
export function nearest(fp: LogoFingerprint, others: LogoFingerprint[]): number {
  return others.length ? Math.min(...others.map((o) => fingerprintDistance(fp, o))) : 1;
}
