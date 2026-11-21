/**
 * « SUPPRIMER LE SITE » (menu ··· de l'atelier) — ce qui part, dans l'ordre :
 *
 *   1. la mise en ligne, dans iDeploy (par le serveur iCode, `/api/ideploy/site/delete`) : applications arrêtées et
 *      effacées, adresse `monapp.idem.africa` rendue et son enregistrement DNS retiré, base de données et espace de
 *      travail d'une application complète ;
 *   2. la trace de cette mise en ligne dans le projet IDEM (API) et dans le navigateur ;
 *   3. le code et la conversation du site (API), puis l'atelier vidé — c'est la conversation qui le fait
 *      (`site:delete`), avec le même nettoyage que « Régénérer ».
 *
 * Une étape qui échoue arrête les suivantes : un site encore en ligne n'est jamais séparé de son code. Le projet IDEM
 * lui-même (marque, charte, documents) reste. Un nom de domaine acheté reste à l'utilisateur.
 */
import { deleteAppDeployment, deleteProjectGeneration, type AppDeployment } from '@/api/persistence/db';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';
import { forgetLocalDeployment } from '@/utils/netlifyDeployment';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';

export class SiteDeletionError extends Error {
  constructor(
    readonly step: 'deployment' | 'record' | 'code' | 'busy',
    message: string
  ) {
    super(message);
  }
}

/** Supprime la mise en ligne dans iDeploy (rien s'il n'y en a pas). */
async function deleteDeployment(deployment: AppDeployment | null): Promise<void> {
  if (!deployment?.ideploy) return;
  const response = await fetch(`${API_BASE}/api/ideploy/site/delete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideploy: deployment.ideploy }),
  });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; code?: string | null } | null;
  if (!response.ok || payload?.success === false) {
    throw new SiteDeletionError('deployment', payload?.code === 'DEPLOYMENT_IN_PROGRESS' ? 'in_progress' : payload?.message || `HTTP ${response.status}`);
  }
}

/**
 * Tout supprimer. La conversation exécute l'étape serveur entre son point de restauration et le vidage de l'atelier ;
 * la promesse se résout quand l'atelier est vide.
 */
export function deleteSite(projectId: string, deployment: AppDeployment | null, draftId?: string | null): Promise<void> {
  const serverStep = async () => {
    await deleteDeployment(deployment);
    try {
      await deleteAppDeployment(projectId);
    } catch (error) {
      throw new SiteDeletionError('record', (error as Error).message);
    }
    forgetLocalDeployment(projectId, draftId);
    try {
      await deleteProjectGeneration(projectId);
    } catch (error) {
      throw new SiteDeletionError('code', (error as Error).message);
    }
  };
  return new Promise<void>((resolve, reject) => {
    eventEmitter.emit('site:delete', { serverStep, resolve, reject });
  });
}
