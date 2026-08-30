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
  is_build_server: z.coerce.boolean().optional().default(false),
  is_swarm_manager: z.coerce.boolean().optional().default(false),
  is_swarm_worker: z.coerce.boolean().optional().default(false),
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
 * /api/v1/servers/{uuid}/settings:
 *   get: { summary: Get a server's own settings (wildcard domain, …), tags: [Servers], responses: { 200: { description: OK } } }
 *   patch: { summary: Update a server's own settings, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.get('/:uuid/settings', validate({ params: uuidParam }), ctrl.getServerSettings);
router.patch('/:uuid/settings', validate({ params: uuidParam }), ctrl.updateServerSettings);

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

/**
 * @swagger
 * /api/v1/servers/{uuid}/docker-cleanup:
 *   post:
 *     summary: Reclaim disk space (dangling images, stopped containers, unused build cache)
 *     description: Named volumes are untouched unless prune_volumes is true.
 *     tags: [Servers]
 *     responses: { 200: { description: OK }, 404: { description: Server not found } }
 */
router.post(
  '/:uuid/docker-cleanup',
  validate({ params: uuidParam, body: z.object({ prune_volumes: z.boolean().optional() }) }),
  ctrl.dockerCleanup
);

/**
 * @swagger
 * /api/v1/servers/{uuid}/resources:
 *   get:
 *     summary: Applications, databases and services deployed on this server
 *     tags: [Servers]
 *     responses: { 200: { description: OK }, 404: { description: Server not found } }
 */
router.get('/:uuid/resources', validate({ params: uuidParam }), ctrl.listServerResources);

/**
 * @swagger
 * /api/v1/servers/{uuid}/health:
 *   get:
 *     summary: Probe liveness and disk headroom over SSH
 *     description: Never fails on an unreachable host — `reachable:false` is a result, not an error.
 *     tags: [Servers]
 *     responses: { 200: { description: OK }, 404: { description: Server not found } }
 */
router.get('/:uuid/health', validate({ params: uuidParam }), ctrl.getServerHealth);

export default router;
