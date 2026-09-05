import { Messages } from '../types/project.js';
import { selectRelevantFiles } from '../services/aiService.js';
import { ChatLogger } from './logger.js';

/**
 * Réduit un projet trop volumineux aux seuls fichiers que la demande concerne.
 *
 * ⚠️ Cette fonction n'est appelée QUE lorsque le contexte dépasse déjà la limite
 * (cf. `CONTEXT_TOKEN_LIMIT` dans builderHandler). Sa version précédente
 * commençait par recopier TOUT l'historique de conversation — donc les 128 000+
 * tokens qu'elle était censée réduire — et les renvoyait au modèle pour lui
 * demander quels fichiers comptaient. L'appel de tri coûtait ainsi plus cher que
 * la génération qu'il devait alléger.
 *
 * Décider quels fichiers sont concernés ne demande pas de relire la
 * conversation : l'arbre des chemins et la dernière demande suffisent.
 */
export async function handleTokenLimit(
  messages: Messages,
  files: { [key: string]: string },
  filesPath: string[]
): Promise<{ [key: string]: string }> {
  const lastUserRequest =
    [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';

  try {
    const selected = await selectRelevantFiles(filesPath, lastUserRequest);
    const kept: { [key: string]: string } = {};

    for (const path of filesPath) {
      if (selected.includes(path)) kept[path] = files[path];
    }

    ChatLogger.info('TOKEN_LIMIT', 'Fichiers retenus pour cette demande', {
      total: filesPath.length,
      kept: Object.keys(kept).length,
    });

    // Une sélection vide signifie que le tri n'a rien compris : mieux vaut un
    // contexte trop large qu'un contexte amputé de ce qu'il fallait modifier.
    return Object.keys(kept).length > 0 ? kept : files;
  } catch (error) {
    ChatLogger.error('TOKEN_LIMIT', 'Tri des fichiers impossible — contexte complet conservé', error);
    return files;
  }
}
