import { createHash, randomBytes } from 'crypto';
import mongoose from 'mongoose';
import logger from '../../config/logger';
import { ProjectGroup, ProjectGroupDocument, ProjectMember, ProjectMemberDocument } from '../../schemas/projectTeam.schema';
import { transactionalEmailService } from '../email/email.service';
import { projectInvitation } from '../email/templates';
import { resyncIfStale, syncIdeploySharesLater } from './ideploy-share.service';
import { firstNameOf } from '../email/email-layout';
import {
  effectivePermissions,
  findProjectOwner,
  invalidateProjectAccess,
  ProjectOwnerInfo,
} from './project-access.service';
import {
  INVITATION_TTL_DAYS,
  MAX_PROJECT_GROUPS,
  MAX_PROJECT_MEMBERS,
  MemberRoleInput,
  MemberRoleKey,
  PROJECT_SPACES,
  ProjectGroupView,
  ProjectMemberView,
  ProjectPermissions,
  ProjectSpace,
  ProjectTeamView,
  ReceivedInvitationView,
  TeamErrorCode,
  hasAnySpace,
  isRolePreset,
  normalizePermissions,
} from '../../../../../packages/shared-models/src/projects/project-access.model';

/**
 * L'équipe d'un projet : inviter, accepter, régler les droits, groupes.
 *
 * Toutes les opérations de gestion vérifient que la personne connectée est le
 * PROPRIÉTAIRE du projet ; celles de l'invité vérifient que l'invitation lui est
 * bien adressée (même compte, pas seulement le lien).
 */

export class TeamError extends Error {
  constructor(
    public readonly code: TeamErrorCode,
    public readonly status = 400
  ) {
    super(code);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const users = () => mongoose.connection.collection('users');
/**
 * L'adresse du tableau de bord à mettre dans l'e-mail : celle d'où part
 * l'invitation. Le propriétaire invite depuis son navigateur, donc l'origine de
 * la requête est la bonne console — `http://localhost:4200` en local, la console
 * de production en ligne — sans variable à régler. Seules une adresse locale ou
 * une adresse `https` d'idem.africa sont reprises ; sinon, la console publique.
 */
export function consoleUrlFor(origin: string | undefined): string {
  const fallback = (process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa').replace(/\/+$/, '');
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    const local = (url.protocol === 'http:' || url.protocol === 'https:') && ['localhost', '127.0.0.1'].includes(url.hostname);
    const idem = url.protocol === 'https:' && (url.hostname === 'idem.africa' || url.hostname.endsWith('.idem.africa'));
    return local || idem ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

const SPACE_LABELS_FR: Record<ProjectSpace, string> = {
  branding: 'Identité visuelle',
  businessPlan: 'Business plan',
  pitchDeck: 'Pitch deck',
  finance: 'Finances',
  legal: 'Dossiers légaux',
  communication: 'Communication',
  website: 'Site internet et application',
  deployment: 'Mise en ligne et nom de domaine',
  simulation: 'Simulateur',
  advisor: 'Conseiller',
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

function expiry(): Date {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600 * 1000);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface UserCard {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

async function findUserByEmail(email: string): Promise<UserCard | null> {
  const doc = await users().findOne(
    { email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } },
    { projection: { uid: 1, email: 1, displayName: 1, photoURL: 1 } }
  );
  return doc?.uid ? { uid: doc.uid, email: doc.email, displayName: doc.displayName, photoURL: doc.photoURL } : null;
}

async function usersByUid(uids: string[]): Promise<Map<string, UserCard>> {
  if (uids.length === 0) return new Map();
  const docs = await users()
    .find({ uid: { $in: uids } }, { projection: { uid: 1, email: 1, displayName: 1, photoURL: 1 } })
    .toArray();
  return new Map(docs.map((doc) => [doc.uid as string, doc as unknown as UserCard]));
}

/** Les droits, rédigés pour l'e-mail : seuls les espaces ouverts. */
function accessLines(permissions: ProjectPermissions): string[] {
  return PROJECT_SPACES.filter((space) => permissions[space] !== 'none').map(
    (space) => `${SPACE_LABELS_FR[space]} — ${permissions[space] === 'write' ? 'peut modifier' : 'peut consulter'}`
  );
}

class TeamService {
  // ─── Contrôles ────────────────────────────────────────────────────────────

  private async ownedProject(projectId: string, uid: string): Promise<ProjectOwnerInfo> {
    const project = await findProjectOwner(projectId);
    // Un projet d'un autre et un projet inexistant se confondent : 404 dans les deux cas.
    if (!project || project.ownerId !== uid || project.archived) throw new TeamError('not_owner', 404);
    return project;
  }

  /** Valide un rôle reçu et renvoie ce qu'il faut enregistrer. */
  private async validateRole(
    projectId: string,
    input: MemberRoleInput | undefined
  ): Promise<{ roleKey: MemberRoleKey; groupId: string | null; permissions: ProjectPermissions; group?: ProjectGroupDocument | null }> {
    const roleKey = input?.roleKey;
    if (isRolePreset(roleKey)) {
      return { roleKey, groupId: null, permissions: effectivePermissions({ roleKey }) };
    }
    if (roleKey === 'group') {
      const groupId = typeof input?.groupId === 'string' ? input.groupId : '';
      const group = mongoose.isValidObjectId(groupId) ? await ProjectGroup.findOne({ _id: groupId, projectId }) : null;
      if (!group) throw new TeamError('group_not_found', 404);
      return { roleKey, groupId: String(group._id), permissions: normalizePermissions(group.permissions), group };
    }
    if (roleKey === 'custom') {
      const permissions = normalizePermissions(input?.permissions);
      if (!hasAnySpace(permissions)) throw new TeamError('empty_permissions');
      return { roleKey, groupId: null, permissions };
    }
    throw new TeamError('invalid_role');
  }

  // ─── Lecture ──────────────────────────────────────────────────────────────

  async getTeam(projectId: string, uid: string): Promise<ProjectTeamView> {
    const project = await this.ownedProject(projectId, uid);
    // Le propriétaire ouvre sa page Équipe : l'occasion de rattraper iDeploy.
    resyncIfStale(projectId);
    const [members, groups] = await Promise.all([
      ProjectMember.find({ projectId }).sort({ invitedAt: 1 }).lean(),
      ProjectGroup.find({ projectId }).sort({ createdAt: 1 }).lean(),
    ]);
    const people = await usersByUid([uid, ...members.map((member) => member.userId)]);
    const groupById = new Map(groups.map((group) => [String(group._id), group]));

    const memberViews: ProjectMemberView[] = members.map((member) => {
      const person = people.get(member.userId);
      const group = member.groupId ? groupById.get(member.groupId) : undefined;
      return {
        id: String(member._id),
        email: member.email,
        displayName: person?.displayName,
        photoURL: person?.photoURL,
        status: member.status,
        roleKey: member.roleKey,
        groupId: member.groupId ?? null,
        permissions: effectivePermissions(member, group?.permissions),
        invitedAt: new Date(member.invitedAt).toISOString(),
        respondedAt: member.respondedAt ? new Date(member.respondedAt).toISOString() : null,
      };
    });

    const groupViews: ProjectGroupView[] = groups.map((group) => ({
      id: String(group._id),
      name: group.name,
      permissions: normalizePermissions(group.permissions),
      memberCount: members.filter((member) => member.roleKey === 'group' && member.groupId === String(group._id)).length,
    }));

    const owner = people.get(uid);
    return {
      projectId,
      projectName: project.name,
      owner: { uid, email: owner?.email, displayName: owner?.displayName, photoURL: owner?.photoURL },
      members: memberViews,
      groups: groupViews,
    };
  }

  // ─── Invitations (propriétaire) ──────────────────────────────────────────

  async invite(projectId: string, uid: string, rawEmail: unknown, role: MemberRoleInput | undefined, consoleUrl: string): Promise<ProjectTeamView> {
    const project = await this.ownedProject(projectId, uid);
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) throw new TeamError('invalid_email');

    const invitee = await findUserByEmail(email);
    // La règle produit : on n'invite qu'un compte IDEM existant.
    if (!invitee) throw new TeamError('no_account', 404);
    if (invitee.uid === uid) throw new TeamError('self_invite');

    const validated = await this.validateRole(projectId, role);

    const existing = await ProjectMember.findOne({ projectId, userId: invitee.uid });
    if (existing?.status === 'active') throw new TeamError('already_member', 409);
    if (existing?.status === 'pending' && existing.expiresAt > new Date()) throw new TeamError('already_invited', 409);

    const count = await ProjectMember.countDocuments({ projectId });
    if (!existing && count >= MAX_PROJECT_MEMBERS) throw new TeamError('team_full');

    const { token, tokenHash } = newToken();
    const now = new Date();
    const fields = {
      projectId,
      ownerId: uid,
      userId: invitee.uid,
      email: invitee.email?.toLowerCase() || email,
      status: 'pending' as const,
      roleKey: validated.roleKey,
      groupId: validated.groupId,
      permissions: validated.roleKey === 'custom' ? validated.permissions : {},
      invitedBy: uid,
      tokenHash,
      expiresAt: expiry(),
      invitedAt: now,
      respondedAt: null,
    };
    // Une invitation refusée ou expirée se renvoie sur la même ligne.
    if (existing) await ProjectMember.updateOne({ _id: existing._id }, { $set: fields });
    else await ProjectMember.create(fields);

    await this.sendInvitationEmail(project, uid, invitee, validated.permissions, token, fields.expiresAt, consoleUrl);
    logger.info('team.invited', { event: 'team.invited', projectId, roleKey: validated.roleKey });
    return this.getTeam(projectId, uid);
  }

  async resend(projectId: string, uid: string, memberId: string, consoleUrl: string): Promise<ProjectTeamView> {
    const project = await this.ownedProject(projectId, uid);
    const member = await this.memberOf(projectId, memberId);
    if (member.status === 'active') throw new TeamError('already_member', 409);

    const { token, tokenHash } = newToken();
    const expiresAt = expiry();
    await ProjectMember.updateOne(
      { _id: member._id },
      { $set: { status: 'pending', tokenHash, expiresAt, invitedAt: new Date(), respondedAt: null } }
    );
    const group = member.groupId ? await ProjectGroup.findById(member.groupId).lean() : null;
    const invitee = (await usersByUid([member.userId])).get(member.userId) ?? { uid: member.userId, email: member.email };
    await this.sendInvitationEmail(project, uid, invitee, effectivePermissions(member, group?.permissions), token, expiresAt, consoleUrl);
    return this.getTeam(projectId, uid);
  }

  private async sendInvitationEmail(
    project: ProjectOwnerInfo,
    ownerUid: string,
    invitee: UserCard,
    permissions: ProjectPermissions,
    token: string,
    expiresAt: Date,
    consoleUrl: string
  ): Promise<void> {
    const owner = (await usersByUid([ownerUid])).get(ownerUid);
    const inviterName = owner?.displayName || owner?.email || 'Un utilisateur IDEM';
    const base = `${consoleUrl}/invitations/${encodeURIComponent(token)}`;
    const email = projectInvitation({
      firstName: firstNameOf(invitee.displayName, invitee.email) || undefined,
      inviterName,
      projectName: project.name || 'Projet IDEM',
      accessLines: accessLines(permissions),
      acceptUrl: `${base}?action=accept`,
      declineUrl: `${base}?action=decline`,
      expiresAt,
    });
    const result = await transactionalEmailService.send({
      to: invitee.email || '',
      ...email,
      template: 'team.invitation',
      // Répondre à l'e-mail écrit à la personne qui invite, pas à IDEM.
      replyTo: owner?.email || undefined,
      relatedId: project.projectId,
      relatedType: 'project',
      userId: invitee.uid,
    });
    if (!result.sent) {
      // L'invitation existe quand même : elle apparaît dans le tableau de bord de l'invité.
      logger.warn('team.invitation_email_failed', { event: 'team.invitation_email_failed', projectId: project.projectId, error: result.error });
    }
  }

  // ─── Membres (propriétaire) ──────────────────────────────────────────────

  private async memberOf(projectId: string, memberId: string): Promise<ProjectMemberDocument> {
    const member = mongoose.isValidObjectId(memberId) ? await ProjectMember.findOne({ _id: memberId, projectId }) : null;
    if (!member) throw new TeamError('member_not_found', 404);
    return member;
  }

  async updateMember(projectId: string, uid: string, memberId: string, role: MemberRoleInput | undefined): Promise<ProjectTeamView> {
    await this.ownedProject(projectId, uid);
    const member = await this.memberOf(projectId, memberId);
    const validated = await this.validateRole(projectId, role);
    await ProjectMember.updateOne(
      { _id: member._id },
      {
        $set: {
          roleKey: validated.roleKey,
          groupId: validated.groupId,
          permissions: validated.roleKey === 'custom' ? validated.permissions : {},
        },
      }
    );
    invalidateProjectAccess(projectId);
    syncIdeploySharesLater(projectId);
    return this.getTeam(projectId, uid);
  }

  /** Retirer un membre, ou annuler une invitation : la ligne disparaît. */
  async removeMember(projectId: string, uid: string, memberId: string): Promise<ProjectTeamView> {
    await this.ownedProject(projectId, uid);
    const member = await this.memberOf(projectId, memberId);
    await ProjectMember.deleteOne({ _id: member._id });
    invalidateProjectAccess(projectId);
    syncIdeploySharesLater(projectId);
    logger.info('team.member_removed', { event: 'team.member_removed', projectId });
    return this.getTeam(projectId, uid);
  }

  // ─── Groupes (propriétaire) ──────────────────────────────────────────────

  private cleanName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 60) throw new TeamError('invalid_name');
    return name;
  }

  async createGroup(projectId: string, uid: string, name: unknown, permissions: unknown): Promise<ProjectTeamView> {
    await this.ownedProject(projectId, uid);
    if ((await ProjectGroup.countDocuments({ projectId })) >= MAX_PROJECT_GROUPS) throw new TeamError('team_full');
    const clean = normalizePermissions(permissions);
    if (!hasAnySpace(clean)) throw new TeamError('empty_permissions');
    await ProjectGroup.create({ projectId, ownerId: uid, name: this.cleanName(name), permissions: clean });
    return this.getTeam(projectId, uid);
  }

  async updateGroup(projectId: string, uid: string, groupId: string, name: unknown, permissions: unknown): Promise<ProjectTeamView> {
    await this.ownedProject(projectId, uid);
    const group = mongoose.isValidObjectId(groupId) ? await ProjectGroup.findOne({ _id: groupId, projectId }) : null;
    if (!group) throw new TeamError('group_not_found', 404);
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = this.cleanName(name);
    if (permissions !== undefined) {
      const clean = normalizePermissions(permissions);
      if (!hasAnySpace(clean)) throw new TeamError('empty_permissions');
      update.permissions = clean;
    }
    await ProjectGroup.updateOne({ _id: group._id }, { $set: update });
    invalidateProjectAccess(projectId);
    syncIdeploySharesLater(projectId);
    return this.getTeam(projectId, uid);
  }

  /**
   * Supprimer un groupe : ses membres gardent exactement les droits qu'ils
   * avaient, devenus « sur mesure ». Personne ne perd un accès par surprise.
   */
  async deleteGroup(projectId: string, uid: string, groupId: string): Promise<ProjectTeamView> {
    await this.ownedProject(projectId, uid);
    const group = mongoose.isValidObjectId(groupId) ? await ProjectGroup.findOne({ _id: groupId, projectId }) : null;
    if (!group) throw new TeamError('group_not_found', 404);
    await ProjectMember.updateMany(
      { projectId, roleKey: 'group', groupId: String(group._id) },
      { $set: { roleKey: 'custom', groupId: null, permissions: normalizePermissions(group.permissions) } }
    );
    await ProjectGroup.deleteOne({ _id: group._id });
    invalidateProjectAccess(projectId);
    syncIdeploySharesLater(projectId);
    return this.getTeam(projectId, uid);
  }

  // ─── Invitations reçues (invité) ─────────────────────────────────────────

  private async invitationView(member: ProjectMemberDocument | (ProjectMemberDocument & object)): Promise<ReceivedInvitationView | null> {
    const project = await findProjectOwner(member.projectId);
    if (!project || project.archived) return null;
    const inviter = (await usersByUid([member.invitedBy])).get(member.invitedBy);
    const group = member.groupId ? await ProjectGroup.findById(member.groupId).lean() : null;
    const expired = member.status === 'pending' && new Date(member.expiresAt) <= new Date();
    return {
      token: '',
      projectId: member.projectId,
      projectName: project.name,
      invitedBy: { displayName: inviter?.displayName, email: inviter?.email },
      roleKey: member.roleKey,
      groupName: group?.name,
      permissions: effectivePermissions(member, group?.permissions),
      invitedAt: new Date(member.invitedAt).toISOString(),
      status: expired ? 'expired' : member.status,
    };
  }

  /** Les invitations en attente de la personne connectée (bandeau de « Mes projets »). */
  async myInvitations(uid: string): Promise<Array<ReceivedInvitationView & { memberId: string }>> {
    const pending = await ProjectMember.find({ userId: uid, status: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ invitedAt: -1 })
      .limit(20);
    const views = await Promise.all(
      pending.map(async (member) => {
        const view = await this.invitationView(member);
        return view ? { ...view, memberId: String(member._id) } : null;
      })
    );
    return views.filter((view): view is ReceivedInvitationView & { memberId: string } => view !== null);
  }

  private async byToken(token: string, uid: string): Promise<ProjectMemberDocument> {
    const member = typeof token === 'string' && token.length >= 20 && token.length <= 128
      ? await ProjectMember.findOne({ tokenHash: hashToken(token) })
      : null;
    if (!member) throw new TeamError('invitation_not_found', 404);
    // Le lien seul ne suffit pas : il faut être connecté avec le compte invité.
    if (member.userId !== uid) throw new TeamError('invitation_wrong_account', 403);
    return member;
  }

  async invitationByToken(token: string, uid: string): Promise<ReceivedInvitationView> {
    const member = await this.byToken(token, uid);
    const view = await this.invitationView(member);
    if (!view) throw new TeamError('invitation_not_found', 404);
    return { ...view, token };
  }

  private async byTokenOrId(ref: { token?: string; memberId?: string }, uid: string): Promise<ProjectMemberDocument> {
    if (ref.token) return this.byToken(ref.token, uid);
    const member = ref.memberId && mongoose.isValidObjectId(ref.memberId)
      ? await ProjectMember.findOne({ _id: ref.memberId, userId: uid })
      : null;
    if (!member) throw new TeamError('invitation_not_found', 404);
    return member;
  }

  async respond(ref: { token?: string; memberId?: string }, uid: string, accept: boolean): Promise<{ projectId: string; status: 'active' | 'declined' }> {
    const member = await this.byTokenOrId(ref, uid);
    if (member.status === 'active') return { projectId: member.projectId, status: 'active' };
    if (member.status !== 'pending') throw new TeamError('invitation_not_found', 404);
    if (member.expiresAt <= new Date()) throw new TeamError('invitation_expired', 410);
    const project = await findProjectOwner(member.projectId);
    if (!project || project.archived) throw new TeamError('invitation_not_found', 404);

    const status = accept ? 'active' : 'declined';
    await ProjectMember.updateOne({ _id: member._id }, { $set: { status, respondedAt: new Date() } });
    invalidateProjectAccess(member.projectId);
    syncIdeploySharesLater(member.projectId);
    logger.info('team.invitation_answered', { event: 'team.invitation_answered', projectId: member.projectId, status });
    return { projectId: member.projectId, status };
  }

  /** Quitter un projet dont on est membre. */
  async leave(projectId: string, uid: string): Promise<void> {
    const result = await ProjectMember.deleteOne({ projectId, userId: uid });
    if (result.deletedCount === 0) throw new TeamError('member_not_found', 404);
    invalidateProjectAccess(projectId);
    syncIdeploySharesLater(projectId);
  }
}

export const teamService = new TeamService();
