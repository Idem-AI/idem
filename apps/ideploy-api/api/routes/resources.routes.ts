import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { CustomRequest } from '../interfaces/express.interface';
import { Response } from 'express';
import { ok } from '../utils/response';
import { getVersion } from '../services/settings.service';
import * as appService from '../services/application.service';
import * as dbService from '../services/database.service';
import * as serviceService from '../services/service.service';
import * as teamService from '../services/team.service';
import * as catalog from '../services/catalog.service';
import pool from '../config/db.config';

const router = Router();

/**
 * @swagger
 * /api/v1/me:
 *   get: { summary: Current authenticated user + team + role (for the shell), tags: [System], responses: { 200: { description: OK } } }
 */
router.get('/me', authenticate, async (req: CustomRequest, res: Response) => {
  const u = req.user!;
  const role = u.currentTeamId ? await teamService.roleOf(u.id, u.currentTeamId) : null;
  const team = u.currentTeamId ? await teamService.getTeam(u.currentTeamId) : null;
  const { rows } = await pool.query('SELECT idem_role, photo_url FROM users WHERE id = $1 LIMIT 1', [u.id]);
  ok(res, {
    id: u.id,
    name: u.name,
    email: u.email,
    photoUrl: rows[0]?.photo_url ?? null,
    idemRole: rows[0]?.idem_role ?? null,
    role,
    team: team ? { id: team.id, name: team.name } : null,
  });
});

/**
 * @swagger
 * /api/v1/version:
 *   get: { summary: API version, tags: [System], responses: { 200: { description: OK } } }
 */
router.get('/version', authenticate, (_req, res: Response) => {
  ok(res, getVersion());
});

/**
 * @swagger
 * /api/v1/resources:
 *   get: { summary: All resources (apps, databases, services) for the team, tags: [System], responses: { 200: { description: OK } } }
 */
router.get('/resources', authenticate, requireTeam, async (req: CustomRequest, res: Response) => {
  const teamId = req.user!.currentTeamId!;
  const [applications, databases, services] = await Promise.all([
    appService.listApplications(teamId),
    dbService.listDatabases(teamId),
    serviceService.listServices(teamId),
  ]);
  ok(res, { applications, databases, services });
});

/**
 * @swagger
 * /api/v1/sources:
 *   get: { summary: Git sources (GitHub/GitLab apps) for the team, tags: [System], responses: { 200: { description: OK } } }
 */
router.get('/sources', authenticate, requireTeam, async (req: CustomRequest, res: Response) => {
  ok(res, await catalog.listSources(req.user!.currentTeamId!));
});

/**
 * @swagger
 * /api/v1/s3-storages:
 *   get: { summary: S3 storages for the team, tags: [System], responses: { 200: { description: OK } } }
 */
router.get('/s3-storages', authenticate, requireTeam, async (req: CustomRequest, res: Response) => {
  ok(res, await catalog.listS3Storages(req.user!.currentTeamId!));
});

export default router;
