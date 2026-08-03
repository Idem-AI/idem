import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { description, hostAddress, port, resourceName, uuidParam } from '../validation/common';
import * as ctrl from '../controllers/server.controller';

const router = Router();
router.use(authenticate, requireTeam);

export const createServerSchema = z.object({
  name: resourceName,
  description,
  ip: hostAddress,
  port: port.optional().default(22),
  // Non-root works provided the account can reach the Docker socket; Coolify
  // defaults to root and so do we.
  user: z.string().trim().min(1).max(255).optional().default('root'),
  private_key_id: z.coerce.number().int().positive('A private key must be selected.'),
});

/**
 * @swagger
 * /api/v1/servers:
 *   get: { summary: List servers for the current team, tags: [Servers], responses: { 200: { description: OK } } }
 *   post: { summary: Register a server (creates its settings and Docker destination too), tags: [Servers], responses: { 201: { description: Created }, 404: { description: Private key not found } } }
 */
router.get('/', ctrl.listServers);
router.post('/', validate({ body: createServerSchema }), ctrl.createServer);

/**
 * @swagger
 * /api/v1/servers/local:
 *   post: { summary: Use this machine (local Docker) as a server + destination, tags: [Servers], responses: { 201: { description: Created } } }
 */
router.post('/local', ctrl.createLocalServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}:
 *   get: { summary: Get a server, tags: [Servers], responses: { 200: { description: OK } } }
 *   delete: { summary: Delete a server, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.get('/:uuid', validate({ params: uuidParam }), ctrl.getServer);
router.delete('/:uuid', validate({ params: uuidParam }), ctrl.deleteServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}/validate:
 *   post: { summary: Run the full readiness check and report actionable diagnostics, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.post('/:uuid/validate', validate({ params: uuidParam }), ctrl.validateServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}/setup:
 *   post:
 *     summary: Install and configure Docker (log rotation, shared network), then re-check readiness
 *     description: Idempotent — safe to re-run on a partially configured host.
 *     tags: [Servers]
 *     responses: { 200: { description: OK } }
 */
router.post('/:uuid/setup', validate({ params: uuidParam }), ctrl.setUpServer);

export default router;
