/**
 * Instance administration.
 *
 * Every route here crosses team boundaries, so the whole router sits behind
 * `requireInstanceAdmin` — applied once, at the top, rather than repeated per
 * handler where one omission would expose the deployment.
 */
import { Router } from 'express';
import { Response } from 'express';
import { z } from 'zod';
import { CustomRequest } from '../interfaces/express.interface';
import { authenticate } from '../middleware/auth.middleware';
import { requireInstanceAdmin } from '../middleware/authorize.middleware';
import { validate } from '../middleware/validate.middleware';
import { description, hostAddress, port, resourceName, uuidParam } from '../validation/common';
import { ok, fail, respondWithError } from '../utils/response';
import * as admin from '../services/admin.service';

const router = Router();
router.use(authenticate, requireInstanceAdmin);

/**
 * @swagger
 * /api/v1/admin/overview:
 *   get:
 *     summary: Headline counts across every team
 *     tags: [Admin]
 *     responses: { 200: { description: OK }, 403: { description: Not an instance administrator } }
 */
router.get('/overview', async (_req: CustomRequest, res: Response) => {
  try {
    ok(res, await admin.getOverview());
  } catch (err) {
    respondWithError(res, err, 'Loading the instance overview');
  }
});

/**
 * @swagger
 * /api/v1/admin/teams:
 *   get:
 *     summary: Every team, with what it owns
 *     tags: [Admin]
 *     responses: { 200: { description: OK }, 403: { description: Not an instance administrator } }
 */
router.get('/teams', async (_req: CustomRequest, res: Response) => {
  try {
    ok(res, await admin.listTeams());
  } catch (err) {
    respondWithError(res, err, 'Listing the teams');
  }
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Every user
 *     description: No credential material is returned.
 *     tags: [Admin]
 *     responses: { 200: { description: OK }, 403: { description: Not an instance administrator } }
 */
router.get('/users', async (_req: CustomRequest, res: Response) => {
  try {
    ok(res, await admin.listUsers());
  } catch (err) {
    respondWithError(res, err, 'Listing the users');
  }
});

/**
 * @swagger
 * /api/v1/admin/servers:
 *   get:
 *     summary: Every server on the instance, with fleet stats
 *     tags: [Admin]
 *     responses: { 200: { description: OK }, 403: { description: Not an instance administrator } }
 */
router.get('/servers', async (_req: CustomRequest, res: Response) => {
  try {
    const [servers, stats] = await Promise.all([admin.listServers(), admin.getServerFleetStats()]);
    ok(res, { servers, stats });
  } catch (err) {
    respondWithError(res, err, 'Listing the server fleet');
  }
});

export const createManagedServerSchema = z.object({
  name: resourceName,
  description,
  ip: hostAddress,
  port: port.optional().default(22),
  user: z.string().trim().min(1).max(255).optional().default('root'),
  private_key_id: z.coerce.number().int().positive('A private key must be selected.'),
  // Free text: the fleet's own regions, not constrained to any fixed list.
  country_code: z.string().trim().toUpperCase().length(2).optional(),
  region: z.string().trim().max(255).optional(),
  city: z.string().trim().max(255).optional(),
});

/**
 * @swagger
 * /api/v1/admin/servers:
 *   post:
 *     summary: Register a server into the shared IDEM-managed fleet
 *     description: The only way a server becomes `idem_managed` — the public /servers endpoint never accepts that flag.
 *     tags: [Admin]
 *     responses: { 201: { description: Created }, 403: { description: Not an instance administrator }, 404: { description: Private key not found } }
 */
router.post('/servers', validate({ body: createManagedServerSchema }), async (req: CustomRequest, res: Response) => {
  try {
    const { server, destinationId } = await admin.createManagedServer(req.user!.currentTeamId!, req.body);
    ok(res, { ...server, destination_id: destinationId }, 201);
  } catch (err) {
    respondWithError(res, err, 'Registering the managed server');
  }
});

export const updateServerFleetSchema = z.object({
  idem_managed: z.boolean().optional(),
  country_code: z.string().trim().toUpperCase().length(2).nullable().optional(),
  region: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(255).nullable().optional(),
});

/**
 * @swagger
 * /api/v1/admin/servers/{uuid}:
 *   patch:
 *     summary: Promote/demote a server from the shared fleet, or edit its placement geography
 *     tags: [Admin]
 *     responses: { 200: { description: OK }, 403: { description: Not an instance administrator }, 404: { description: Server not found } }
 */
router.patch(
  '/servers/:uuid',
  validate({ params: uuidParam, body: updateServerFleetSchema }),
  async (req: CustomRequest, res: Response) => {
    try {
      const updated = await admin.updateServerFleetStatus(String(req.params.uuid), req.body);
      if (!updated) return fail(res, 'Server not found', 404, 'NOT_FOUND');
      ok(res, { updated: true });
    } catch (err) {
      respondWithError(res, err, 'Updating the server');
    }
  }
);

export default router;
