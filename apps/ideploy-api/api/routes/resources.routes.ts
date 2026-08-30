import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { description, resourceName, uuidParam } from '../validation/common';
import { CustomRequest } from '../interfaces/express.interface';
import { Response } from 'express';
import { ok, respondWithError } from '../utils/response';
import { getVersion } from '../services/settings.service';
import * as appService from '../services/application.service';
import * as dbService from '../services/database.service';
import * as serviceService from '../services/service.service';
import * as teamService from '../services/team.service';
import * as catalog from '../services/catalog.service';
import * as quickDeploy from '../services/quick-deploy.service';
import { fail } from '../utils/response';
import pool from '../config/db.config';

const router = Router();

/**
 * An S3-compatible bucket. `endpoint` is what makes this work with MinIO,
 * Backblaze and Wasabi as well as AWS; when omitted, AWS is assumed.
 */
export const createS3StorageSchema = z.object({
  name: resourceName,
  description,
  bucket: z.string().trim().min(1, 'A bucket name is required.').max(255),
  key: z.string().trim().min(1, 'An access key is required.'),
  secret: z.string().trim().min(1, 'A secret key is required.'),
  region: z.string().trim().min(1).max(255).optional().default('us-east-1'),
  endpoint: z
    .string()
    .trim()
    .url('The endpoint must be a full URL, for example https://s3.example.com.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

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

/**
 * @swagger
 * /api/v1/s3-storages:
 *   post:
 *     summary: Register an S3-compatible bucket for backups
 *     description: >
 *       The key and secret are encrypted at rest and never returned. The
 *       storage is marked unusable until a backup has actually written to it.
 *     tags: [System]
 *     responses: { 201: { description: Created }, 422: { description: Missing required field } }
 */
router.post(
  '/s3-storages',
  authenticate,
  requireTeam,
  validate({ body: createS3StorageSchema }),
  async (req: CustomRequest, res: Response) => {
    try {
      ok(res, await catalog.createS3Storage(req.user!.currentTeamId!, req.body), 201);
    } catch (err) {
      respondWithError(res, err, 'Registering the S3 storage');
    }
  }
);

/**
 * @swagger
 * /api/v1/s3-storages/{uuid}:
 *   delete:
 *     summary: Remove an S3 storage
 *     description: Refused while a backup schedule still targets it.
 *     tags: [System]
 *     responses: { 200: { description: OK }, 404: { description: Not found }, 409: { description: Still in use } }
 */
router.delete(
  '/s3-storages/:uuid',
  authenticate,
  requireTeam,
  validate({ params: uuidParam }),
  async (req: CustomRequest, res: Response) => {
    try {
      const deleted = await catalog.deleteS3Storage(req.user!.currentTeamId!, String(req.params.uuid));
      if (!deleted) return fail(res, 'Storage not found', 404, 'NOT_FOUND');
      ok(res, { deleted: true });
    } catch (err) {
      respondWithError(res, err, 'Deleting the S3 storage');
    }
  }
);

/**
 * @swagger
 * /api/v1/quick-deploy:
 *   post:
 *     summary: One-click deploy for non-technical users (auto project/env/server selection)
 *     tags: [System]
 *     responses: { 200: { description: OK } }
 */
router.post('/quick-deploy', authenticate, requireTeam, async (req: CustomRequest, res: Response) => {
  const { name } = req.body ?? {};
  if (!name) return fail(res, 'name is required', 422, 'VALIDATION');
  try {
    ok(res, await quickDeploy.quickDeploy(req.user!.currentTeamId!, req.body), 202);
  } catch (err) {
    const message = (err as Error).message;
    const code = message.startsWith('NO_DESTINATION') ? 'NO_DESTINATION' : 'QUICK_DEPLOY_FAILED';
    fail(res, message, code === 'NO_DESTINATION' ? 409 : 400, code);
  }
});

export default router;
