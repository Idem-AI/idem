import { cacheService } from '../cache.service';

/**
 * Clé du PNG rendu d'un visuel. `v2` : le rendu corrige désormais la
 * déclinaison du logo par mesure du contraste. Sans changer la clé, les PNG
 * déjà en cache (24 h) resteraient servis avec l'ancien logo illisible.
 *
 * Module à part pour que la propagation d'identité (`brand/brandSync.service`)
 * puisse invalider un visuel sans charger toute la chaîne de génération.
 */
export function flyerImageCacheKey(projectId: string, flyerId: string): string {
  return cacheService.generateAIKey('flyer-img', 'public', projectId, `${flyerId}:v2`);
}

/**
 * Oublie le PNG rendu d'un visuel. À appeler après TOUTE modification de son
 * HTML — retouche, ou changement d'identité propagé : `imageUrl` ne change
 * jamais (c'est l'URL de l'endpoint de rendu), donc sans cette invalidation
 * l'utilisateur continuerait de voir l'ancienne image pendant 24 h.
 */
export async function invalidateVisualImage(projectId: string, flyerId: string): Promise<void> {
  await cacheService.delete(flyerImageCacheKey(projectId, flyerId), { prefix: 'flyer' });
}
