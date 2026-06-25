import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/server.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/servers:
 *   get: { summary: List servers for the current team, tags: [Servers], responses: { 200: { description: OK } } }
 *   post: { summary: Create a server, tags: [Servers], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.listServers);
router.post('/', ctrl.createServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}:
 *   get: { summary: Get a server, tags: [Servers], responses: { 200: { description: OK } } }
 *   delete: { summary: Delete a server, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.get('/:uuid', ctrl.getServer);
router.delete('/:uuid', ctrl.deleteServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}/validate:
 *   post: { summary: Validate SSH connectivity and detect Docker, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.post('/:uuid/validate', ctrl.validateServer);

/**
 * @swagger
 * /api/v1/servers/{uuid}/install-docker:
 *   post: { summary: Install Docker on the server over SSH, tags: [Servers], responses: { 200: { description: OK } } }
 */
router.post('/:uuid/install-docker', ctrl.installDocker);

export default router;
