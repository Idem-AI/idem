import mongoose from 'mongoose';
import logger from '../../config/logger';
import pool from '../../config/ideploy-pg.config';
import { ProjectGroup, ProjectMember } from '../../schemas/projectTeam.schema';
import { getTeamIdByEmail } from '../ideploy-pg.service';
import { journeyService } from '../journey/journey.service';
import { effectivePermissions, findProjectOwner } from './project-access.service';

/**
 * L'équipe d'un projet, recopiée dans iDeploy.
 *
 * iDeploy a sa propre base et ses propres équipes : un membre IDEM n'y existe
 * pas pour l'équipe du propriétaire. On écrit donc, dans la base d'iDeploy, la
 * table `idem_project_shares` (migration d'ideploy-api `…_add-idem-project-shares`) :
 * pour chaque membre qui a l'espace « Mise en ligne », l'équipe iDeploy du
 * propriétaire, les applications reliées au projet et le niveau. iDeploy lit
 * cette table et ouvre ces applications — elles seules — au membre.
 *
 * Même principe que `idem_app_meters` : IDEM écrit l'état voulu, iDeploy
 * l'applique. La synchronisation est complète à chaque appel (on réécrit les
 * lignes du projet), donc rejouable sans risque ; elle ne lève jamais : un
 * iDeploy injoignable ne doit pas faire échouer une invitation.
 */

/** Dernière synchronisation par projet, pour la resynchronisation paresseuse. */
const lastSync = new Map<string, number>();
const STALE_MS = 5 * 60_000;

async function clear(projectId: string): Promise<void> {
  await pool.query('DELETE FROM idem_project_shares WHERE idem_project_id = $1', [projectId]);
}

export async function syncIdeployShares(projectId: string): Promise<void> {
  lastSync.set(projectId, Date.now());
  try {
    const project = await findProjectOwner(projectId);
    if (!project || project.archived) {
      await clear(projectId);
      return;
    }

    const owner = await mongoose.connection
      .collection('users')
      .findOne({ uid: project.ownerId }, { projection: { email: 1, displayName: 1 } });
    const teamId = owner?.email ? await getTeamIdByEmail(String(owner.email)) : null;
    // Le propriétaire n'a pas encore d'espace iDeploy : rien à partager.
    if (!teamId) {
      await clear(projectId);
      return;
    }

    const [apps, members] = await Promise.all([
      journeyService.appUuidsOfProject(project.ownerId, projectId),
      ProjectMember.find({ projectId, status: 'active' }).lean(),
    ]);
    const groupIds = members.filter((m) => m.roleKey === 'group' && m.groupId).map((m) => m.groupId as string);
    const groups = groupIds.length ? await ProjectGroup.find({ _id: { $in: groupIds }, projectId }).lean() : [];
    const groupById = new Map(groups.map((g) => [String(g._id), g]));

    const shares = members
      .map((member) => ({
        uid: member.userId,
        level: effectivePermissions(member, member.groupId ? groupById.get(member.groupId)?.permissions : undefined).deployment,
      }))
      .filter((share): share is { uid: string; level: 'read' | 'write' } => share.level === 'read' || share.level === 'write');

    const ownerName = String(owner?.displayName || owner?.email || '');
    for (const share of shares) {
      await pool.query(
        `INSERT INTO idem_project_shares
           (idem_project_id, project_name, owner_team_id, owner_name, member_idem_uid, level, application_uuids, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (idem_project_id, member_idem_uid) DO UPDATE SET
           project_name = EXCLUDED.project_name,
           owner_team_id = EXCLUDED.owner_team_id,
           owner_name = EXCLUDED.owner_name,
           level = EXCLUDED.level,
           application_uuids = EXCLUDED.application_uuids,
           updated_at = now()`,
        [projectId, project.name.slice(0, 255), teamId, ownerName.slice(0, 255), share.uid, share.level, apps]
      );
    }
    // Ceux qui n'ont plus l'espace « Mise en ligne » (retirés, rôle changé, groupe supprimé).
    await pool.query(
      'DELETE FROM idem_project_shares WHERE idem_project_id = $1 AND NOT (member_idem_uid = ANY($2::text[]))',
      [projectId, shares.map((share) => share.uid)]
    );
    logger.info('team.ideploy_synced', { event: 'team.ideploy_synced', projectId, members: shares.length, apps: apps.length });
  } catch (error) {
    // Table absente (migration d'iDeploy pas encore passée) ou base injoignable :
    // la prochaine synchronisation rattrapera.
    logger.warn('team.ideploy_sync_failed', { event: 'team.ideploy_sync_failed', projectId, error: (error as Error).message });
  }
}

/** Sans attendre : l'écran qui a déclenché le changement n'a pas à patienter pour iDeploy. */
export function syncIdeploySharesLater(projectId: string): void {
  void syncIdeployShares(projectId);
}

/**
 * Rattrape une dérive (application reliée ailleurs, migration passée après coup) :
 * au plus une fois toutes les cinq minutes par projet.
 */
export function resyncIfStale(projectId: string): void {
  const at = lastSync.get(projectId) ?? 0;
  if (Date.now() - at > STALE_MS) syncIdeploySharesLater(projectId);
}
