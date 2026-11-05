import logger from '../../config/logger';
import { BuilderApplication } from '../../schemas/builderApplication.schema';

/**
 * « Ce compte est-il Idem Builder ? » — lu par le portefeuille (bonus de
 * recharge) et par le compteur iDeploy (réduction d'hébergement).
 *
 * Séparé du service des candidatures, qui verse le bonus de bienvenue par le
 * portefeuille : le portefeuille l'importerait en retour, et le cycle d'imports
 * laisserait l'un des deux `undefined` au démarrage.
 *
 * Une panne de lecture répond « non » : un avantage qui manque une fois se
 * rattrape par un geste commercial, une recharge bloquée ne se rattrape pas.
 */
export async function isActiveBuilder(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await BuilderApplication.exists({ userId, status: 'approved' })) !== null;
  } catch (error: any) {
    logger.warn('builders.status_unreadable', { event: 'builders.status_unreadable', userId, error: error?.message });
    return false;
  }
}
