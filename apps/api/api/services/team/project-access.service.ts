import mongoose from 'mongoose';
import logger from '../../config/logger';
import { ProjectGroup, ProjectMember } from '../../schemas/projectTeam.schema';
import {
  OWNER_ACCESS,
  ProjectAccess,
  ProjectPermissions,
  ROLE_PRESET_PERMISSIONS,
  hasAnySpace,
  isRolePreset,
  normalizePermissions,
  uniformPermissions,
} from '../../../../../packages/shared-models/src/projects/project-access.model';

/**
 * Qui peut quoi sur un projet.
 *
 * Toute l'API range les données d'un projet sous son propriétaire
 * (`users/<propriétaire>/…`). Plutôt que de réécrire chaque service pour qu'il
 * accepte un membre, on répond ici à une seule question — « cette personne
 * a-t-elle le droit, et au nom de qui ? » — et le middleware d'authentification
 * fait agir le membre au nom du propriétaire, une fois le droit vérifié
 * (`project-access.middleware.ts`).
 *
 * Les réponses sont gardées quelques secondes en mémoire : une page du tableau
 * de bord déclenche une dizaine d'appels sur le même projet. Tout changement
 * d'équipe vide le cache du projet sur cette instance ; sur les autres, le
 * retrait d'un droit prend effet au plus tard après `TTL_MS`.
 */

const TTL_MS = 10_000;

export interface ProjectOwnerInfo {
  projectId: string;
  ownerId: string;
  name: string;
  archived: boolean;
}

export interface ResolvedAccess {
  project: ProjectOwnerInfo;
  access: ProjectAccess;
}

const ownerCache = new Map<string, { value: ProjectOwnerInfo | null; at: number }>();
const accessCache = new Map<string, { value: ResolvedAccess | null; at: number }>();

function fresh<T>(entry: { value: T; at: number } | undefined): entry is { value: T; at: number } {
  return !!entry && Date.now() - entry.at < TTL_MS;
}

function idCandidates(projectId: string): unknown[] {
  const ids: unknown[] = [projectId];
  if (/^[a-f0-9]{24}$/i.test(projectId)) ids.push(new mongoose.Types.ObjectId(projectId));
  return ids;
}

/** Le propriétaire d'un projet, ou `null` si aucun projet ne porte cet identifiant. */
export async function findProjectOwner(projectId: string): Promise<ProjectOwnerInfo | null> {
  if (!projectId || projectId.length > 128) return null;
  const cached = ownerCache.get(projectId);
  if (fresh(cached)) return cached.value;

  const doc = await mongoose.connection
    .collection('projects')
    .findOne(
      { _id: { $in: idCandidates(projectId) } as any },
      { projection: { userId: 1, name: 1, isArchived: 1, archived: 1 } }
    );
  const value: ProjectOwnerInfo | null =
    doc && typeof doc.userId === 'string'
      ? {
          projectId,
          ownerId: doc.userId,
          name: String(doc.name ?? ''),
          archived: doc.isArchived === true || doc.archived === true,
        }
      : null;

  ownerCache.set(projectId, { value, at: Date.now() });
  if (ownerCache.size > 5_000) ownerCache.clear();
  return value;
}

/**
 * Les permissions effectives d'une ligne d'équipe : celles du groupe, du rôle
 * prêt à l'emploi, ou le réglage propre au membre.
 */
export function effectivePermissions(
  member: { roleKey: string; groupId?: string | null; permissions?: unknown },
  groupPermissions?: unknown
): ProjectPermissions {
  if (member.roleKey === 'group') {
    // Un groupe supprimé entre-temps ne laisse aucun droit derrière lui.
    return groupPermissions ? normalizePermissions(groupPermissions) : uniformPermissions('none');
  }
  if (isRolePreset(member.roleKey)) return { ...ROLE_PRESET_PERMISSIONS[member.roleKey] };
  return normalizePermissions(member.permissions);
}

/**
 * Les droits de `uid` sur `projectId`.
 *
 * `null` : le projet n'existe pas, ou la personne n'en est ni propriétaire ni
 * membre actif — pour elle, il n'existe pas.
 */
export async function resolveProjectAccess(projectId: string, uid: string): Promise<ResolvedAccess | null> {
  const project = await findProjectOwner(projectId);
  if (!project) return null;
  if (project.ownerId === uid) return { project, access: OWNER_ACCESS };
  if (project.archived) return null;

  const key = `${projectId}|${uid}`;
  const cached = accessCache.get(key);
  if (fresh(cached)) return cached.value;

  let value: ResolvedAccess | null = null;
  try {
    const member = await ProjectMember.findOne({ projectId, userId: uid, status: 'active' }).lean();
    if (member) {
      const group =
        member.roleKey === 'group' && member.groupId
          ? await ProjectGroup.findOne({ _id: member.groupId, projectId }).lean()
          : null;
      const permissions = effectivePermissions(member, group?.permissions);
      if (hasAnySpace(permissions)) {
        const owner = await mongoose.connection
          .collection('users')
          .findOne({ uid: project.ownerId }, { projection: { displayName: 1, email: 1 } });
        value = {
          project,
          access: {
            role: 'member',
            permissions,
            ownerName: (owner?.displayName as string) || (owner?.email as string) || undefined,
            roleKey: member.roleKey,
            groupName: group?.name,
          },
        };
      }
    }
  } catch (error) {
    // Base indisponible : on refuse plutôt que d'ouvrir.
    logger.error('project_access.resolve_failed', { event: 'project_access.resolve_failed', projectId, error });
    return null;
  }

  accessCache.set(key, { value, at: Date.now() });
  if (accessCache.size > 20_000) accessCache.clear();
  return value;
}

/** Après tout changement d'équipe sur ce projet. */
export function invalidateProjectAccess(projectId: string): void {
  ownerCache.delete(projectId);
  for (const key of accessCache.keys()) {
    if (key.startsWith(`${projectId}|`)) accessCache.delete(key);
  }
}

/**
 * Les projets partagés avec `uid` (membre actif), avec ses droits.
 * Les projets archivés et ceux où il ne voit plus aucun espace sont écartés.
 */
export async function listSharedProjectAccess(uid: string): Promise<Map<string, ProjectAccess>> {
  const out = new Map<string, ProjectAccess>();
  const memberships = await ProjectMember.find({ userId: uid, status: 'active' }).lean();
  for (const membership of memberships) {
    const resolved = await resolveProjectAccess(membership.projectId, uid);
    if (resolved && resolved.access.role === 'member') out.set(membership.projectId, resolved.access);
  }
  return out;
}
