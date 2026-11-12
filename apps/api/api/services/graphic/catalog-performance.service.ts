/**
 * LA TENUE RÉELLE DES NŒUDS DU CATALOGUE — le classement qui apprend de l'usage.
 *
 * Le moteur mesure déjà, page par page, quels nœuds l'ont composée et si elle a demandé une réparation ou porté un
 * constat bloquant (`GenerationRecord.templates`). Ce service accumule ces mesures et en tire un POIDS par nœud,
 * que `catalogOverrides` ajoute aux poids posés à la main dans la console.
 *
 * Trois garde-fous, parce qu'un classement qui apprend peut s'enfermer :
 *  · un nœud neuf garde le poids 1 tant qu'il n'a pas assez servi (`MIN_USES`) — il n'est jamais puni d'être neuf ;
 *  · le poids reste borné (`[MIN_WEIGHT, MAX_WEIGHT]`) : il départage, il ne décide pas à la place du graphe ;
 *  · les poids posés à la main restent prioritaires (ils MULTIPLIENT le poids mesuré).
 *
 * La mesure ne dit pas QUEL nœud a fauté : une page réparée compte pour tous ceux qui l'ont composée. C'est
 * l'accumulation sur beaucoup de générations qui désigne le responsable, pas une génération isolée.
 */
import type { GenerationRecord } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { cacheService } from '../cache.service';

const COLLECTION = 'catalog_performance';
const CACHE_KEY = 'catalog-performance:weights';
const CACHE_TTL_S = 300;

/** En deçà, le nœud est trop peu servi pour qu'on en tire quoi que ce soit. */
export const MIN_USES = 12;
export const MIN_WEIGHT = 0.7;
export const MAX_WEIGHT = 1.3;

export interface TemplateStats {
  _id: string;
  uses: number;
  repairs: number;
  blocking: number;
  updatedAt: Date;
}

async function collection(): Promise<import('mongodb').Collection | null> {
  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState !== 1) return null;
  return mongoose.connection.collection(COLLECTION);
}

/**
 * Le poids d'un nœud d'après sa tenue : part des pages livrées sans réparation ni constat bloquant.
 * Une page bloquée pèse deux fois une page simplement réparée.
 */
export function weightOf(s: Pick<TemplateStats, 'uses' | 'repairs' | 'blocking'>): number {
  if (s.uses < MIN_USES) return 1;
  const faults = Math.min(s.uses, s.repairs + s.blocking);
  const clean = 1 - faults / s.uses;
  // 85 % de pages propres = poids neutre ; au-dessus on favorise, en dessous on recule — sans jamais écarter.
  const w = 1 + (clean - 0.85) * 1.6;
  return Math.round(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w)) * 100) / 100;
}

/** Après une génération : ajoute ses mesures aux compteurs. Ne jette jamais — une statistique ne casse pas un livrable. */
export async function recordTemplatePerformance(record: GenerationRecord): Promise<void> {
  if (!record.templates?.length) return;
  try {
    const col = await collection();
    if (!col) return;
    await col.bulkWrite(
      record.templates.map((t) => ({
        updateOne: {
          filter: { _id: t.id as never },
          update: { $inc: { uses: t.uses, repairs: t.repairs, blocking: t.blocking }, $set: { updatedAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  } catch (error) {
    logger.warn('catalog.performance_write_failed', { error: (error as Error).message });
  }
}

/** Les poids mesurés, relus toutes les cinq minutes. Vide quand la base n'est pas là : le graphe garde ses poids à 1. */
export async function performanceWeights(): Promise<Record<string, number>> {
  const cached = await cacheService.get<Record<string, number>>(CACHE_KEY, { prefix: 'graphic' });
  if (cached) return cached;
  try {
    const col = await collection();
    if (!col) return {};
    const rows = (await col.find({ uses: { $gte: MIN_USES } }).limit(5000).toArray()) as unknown as TemplateStats[];
    const weights: Record<string, number> = {};
    for (const r of rows) {
      const w = weightOf(r);
      if (w !== 1) weights[r._id] = w;
    }
    await cacheService.set(CACHE_KEY, weights, { prefix: 'graphic', ttl: CACHE_TTL_S });
    if (Object.keys(weights).length) logger.info('catalog.performance_weights', { event: 'catalog.performance_weights', nodes: Object.keys(weights).length });
    return weights;
  } catch (error) {
    logger.warn('catalog.performance_read_failed', { error: (error as Error).message });
    return {};
  }
}

/** Les poids de la console et les poids mesurés : la main de l'équipe multiplie la mesure. */
export function mergeWeights(manual: Record<string, number> | undefined, measured: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...measured };
  for (const [id, w] of Object.entries(manual ?? {})) out[id] = Math.min(3, Math.max(0, w * (measured[id] ?? 1)));
  return out;
}
