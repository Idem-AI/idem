import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import { ProjectSectionKey } from '../../models/revision.model';
import { getRevisionContext } from '../../utils/revision-context.util';
import { ALL_SECTION_KEYS, sectionHasContent, sectionRegistry } from '../context-engine/context-registry';
import { versionHistoryService } from './version-history.service';

/**
 * Hook de versioning branché dans MongooseRepository (point de passage unique
 * de toutes les écritures projet): compare l'avant/après de chaque section
 * versionnée et enregistre une révision par section modifiée — le "commit"
 * automatique de Chronicle. Aucune modification des services métier requis.
 *
 * Volontairement exclus du versioning (anti micro-versioning, cf. bonnes
 * pratiques MongoDB): advisorConversation, activeChatMessages, policyAcceptance.
 */
export async function recordProjectRevisions(
  projectId: string,
  userId: string,
  before: ProjectModel | null | undefined,
  after: ProjectModel | null | undefined
): Promise<void> {
  if (!after) return;

  const context = getRevisionContext();
  const author = {
    type: context?.authorType ?? 'system',
    ...(userId && { userId }),
  } as const;
  const source = context?.source ?? 'system';

  const changedSections: ProjectSectionKey[] = [];

  for (const key of ALL_SECTION_KEYS) {
    try {
      const definition = sectionRegistry.get(key)!;
      const beforeValue = before ? definition.extract(before) : undefined;
      const afterValue = definition.extract(after);

      if (beforeValue === undefined && afterValue === undefined) continue;
      // Pas de baseline v1 pour une section encore vide (anti-bruit).
      if (beforeValue === undefined && !sectionHasContent(afterValue)) continue;

      const revision = await versionHistoryService.record({
        projectId,
        userId,
        section: key,
        before: beforeValue,
        after: afterValue,
        author: { ...author },
        source,
        summary: context?.note,
      });
      if (revision) changedSections.push(key);
    } catch (error: any) {
      // L'historique ne doit jamais casser l'écriture métier.
      logger.error(`recordProjectRevisions(${projectId}/${key}) failed: ${error.message}`);
    }
  }

  // Coherence Guard: programme un audit IA des règles touchées par ce commit.
  // Import différé (pas de cycle statique repository → coherence → repository)
  // et garde anti-boucle EXPLICITE (flag ALS posé par CoherenceService.applyProposal
  // avant sa propre écriture) plutôt qu'une convention d'URL — reste correcte
  // quelle que soit la route qui finit par appliquer une proposition de cohérence.
  if (changedSections.length > 0 && !context?.suppressCoherenceTrigger) {
    try {
      const { coherenceService } = await import('../coherence/coherence.service');
      coherenceService.onSectionsChanged(projectId, userId, changedSections);
    } catch (error: any) {
      logger.error(`Coherence trigger failed for ${projectId}: ${error.message}`);
    }
  }
}

/** Détermine si un chemin de collection cible les projets. */
export function isProjectCollectionPath(collectionPath: string): boolean {
  const parts = collectionPath.split('/');
  return parts[parts.length - 1] === 'projects';
}

/** Extrait le userId d'un chemin "users/{userId}/projects". */
export function extractUserIdFromPath(collectionPath: string): string {
  const parts = collectionPath.split('/');
  const userIndex = parts.indexOf('users');
  return userIndex >= 0 && parts.length > userIndex + 1 ? parts[userIndex + 1] : '';
}
