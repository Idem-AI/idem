/**
 * Le REGISTRE des ressources d'un projet IDEM (`apps/ivision/core/src/media/asset-registry.ts`), commun au
 * moteur graphique (deck, business plan) et aux vidéos : ce qui a été inscrit (Redis, 180 jours) et ce que
 * le projet possède déjà — les fonds de ses visuels et les médias de ses vidéos (module Communication).
 */
import type { AssetRecord } from '@idem/graphic-engine';
import { createAssetRegistry } from '../../../../ivision/core/src/media/asset-registry';
import { cacheService } from '../cache.service';
import { deliverableDocumentStore } from '../common/deliverable-document.store';

const TTL = 180 * 24 * 3600;
const key = (projectId: string) => `asset-registry:${projectId}`;

export const idemAssetRegistry = createAssetRegistry({
  store: {
    get: async (projectId) => (await cacheService.get<AssetRecord[]>(key(projectId), { prefix: 'graphic' })) ?? [],
    set: async (projectId, records) => {
      await cacheService.set(key(projectId), records, { prefix: 'graphic', ttl: TTL });
    },
  },
  loadBrand: async (userId, projectId) => {
    const project = await deliverableDocumentStore.loadProject(userId, projectId);
    const communication = (project?.analysisResultModel as { communication?: { visuals?: any[]; videos?: any[] } } | undefined)?.communication;
    return project ? { visuals: communication?.visuals ?? [], videos: communication?.videos ?? [], media: [] } : null;
  },
});
