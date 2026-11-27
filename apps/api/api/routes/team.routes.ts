import { Response, Router } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { authenticate } from '../services/auth.service';
import { findProjectOwner, resolveProjectAccess } from '../services/team/project-access.service';
import { consoleUrlFor, TeamError, teamService } from '../services/team/team.service';
import type { MemberRoleInput } from '../../../../packages/shared-models/src/projects/project-access.model';

/**
 * L'équipe d'un projet — `/team/*`.
 *
 * Ces routes agissent toujours au nom de la personne connectée : le contrôle
 * d'accès des membres (`project-access.middleware`) ne les réécrit pas, chaque
 * opération vérifie elle-même qui est propriétaire et qui est invité.
 *
 *   GET    /team/projects/:projectId/access          mes droits sur ce projet (toutes les applications)
 *   GET    /team/projects/:projectId                 l'équipe (propriétaire)
 *   POST   /team/projects/:projectId/invitations     inviter par e-mail
 *   POST   /team/projects/:projectId/members/:memberId/resend
 *   PATCH  /team/projects/:projectId/members/:memberId
 *   DELETE /team/projects/:projectId/members/:memberId
 *   POST   /team/projects/:projectId/groups          créer un groupe
 *   PATCH  /team/projects/:projectId/groups/:groupId
 *   DELETE /team/projects/:projectId/groups/:groupId
 *   POST   /team/projects/:projectId/leave           quitter un projet (membre)
 *   GET    /team/invitations                         mes invitations en attente
 *   GET    /team/invitations/:token                  une invitation reçue par e-mail
 *   POST   /team/invitations/:token/accept|decline
 *   POST   /team/invitations/id/:memberId/accept|decline   depuis le tableau de bord
 */

export const teamRoutes = Router();

type Handler = (req: CustomRequest, res: Response, uid: string) => Promise<void>;

const handle =
  (fn: Handler) =>
  async (req: CustomRequest, res: Response): Promise<void> => {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }
    try {
      await fn(req, res, uid);
    } catch (error) {
      if (error instanceof TeamError) {
        res.status(error.status).json({ error: error.code });
        return;
      }
      logger.error('team.route_failed', { event: 'team.route_failed', path: req.path, error });
      if (!res.headersSent) res.status(500).json({ error: 'team_failed' });
    }
  };

const param = (req: CustomRequest, name: string): string => String(req.params[name] ?? '');
const roleOf = (body: unknown): MemberRoleInput | undefined =>
  body && typeof body === 'object' ? (body as MemberRoleInput) : undefined;

teamRoutes.get(
  '/projects/:projectId/access',
  authenticate,
  handle(async (req, res, uid) => {
    const projectId = param(req, 'projectId');
    const resolved = await resolveProjectAccess(projectId, uid);
    if (!resolved) {
      // `unknown_project` : aucun projet IDEM ne porte cet identifiant (un brouillon
      // iCode, par exemple) — rien à protéger. `project_not_found` : il existe,
      // mais pas pour cette personne.
      const exists = await findProjectOwner(projectId);
      res.status(404).json({ error: exists ? 'project_not_found' : 'unknown_project' });
      return;
    }
    res.json(resolved.access);
  })
);

teamRoutes.get(
  '/projects/:projectId',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.getTeam(param(req, 'projectId'), uid));
  })
);

teamRoutes.post(
  '/projects/:projectId/invitations',
  authenticate,
  handle(async (req, res, uid) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    res.status(201).json(await teamService.invite(param(req, 'projectId'), uid, body.email, roleOf(body.role), consoleUrlFor(req.get('origin'))));
  })
);

teamRoutes.post(
  '/projects/:projectId/members/:memberId/resend',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.resend(param(req, 'projectId'), uid, param(req, 'memberId'), consoleUrlFor(req.get('origin'))));
  })
);

teamRoutes.patch(
  '/projects/:projectId/members/:memberId',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.updateMember(param(req, 'projectId'), uid, param(req, 'memberId'), roleOf(req.body?.role)));
  })
);

teamRoutes.delete(
  '/projects/:projectId/members/:memberId',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.removeMember(param(req, 'projectId'), uid, param(req, 'memberId')));
  })
);

teamRoutes.post(
  '/projects/:projectId/groups',
  authenticate,
  handle(async (req, res, uid) => {
    res.status(201).json(await teamService.createGroup(param(req, 'projectId'), uid, req.body?.name, req.body?.permissions));
  })
);

teamRoutes.patch(
  '/projects/:projectId/groups/:groupId',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(
      await teamService.updateGroup(param(req, 'projectId'), uid, param(req, 'groupId'), req.body?.name, req.body?.permissions)
    );
  })
);

teamRoutes.delete(
  '/projects/:projectId/groups/:groupId',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.deleteGroup(param(req, 'projectId'), uid, param(req, 'groupId')));
  })
);

teamRoutes.post(
  '/projects/:projectId/leave',
  authenticate,
  handle(async (req, res, uid) => {
    await teamService.leave(param(req, 'projectId'), uid);
    res.status(204).end();
  })
);

teamRoutes.get(
  '/invitations',
  authenticate,
  handle(async (_req, res, uid) => {
    res.json(await teamService.myInvitations(uid));
  })
);

teamRoutes.post(
  '/invitations/id/:memberId/:answer(accept|decline)',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.respond({ memberId: param(req, 'memberId') }, uid, param(req, 'answer') === 'accept'));
  })
);

teamRoutes.get(
  '/invitations/:token',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.invitationByToken(param(req, 'token'), uid));
  })
);

teamRoutes.post(
  '/invitations/:token/:answer(accept|decline)',
  authenticate,
  handle(async (req, res, uid) => {
    res.json(await teamService.respond({ token: param(req, 'token') }, uid, param(req, 'answer') === 'accept'));
  })
);
