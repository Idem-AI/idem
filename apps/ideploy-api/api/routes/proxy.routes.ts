import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/proxy.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/servers/{serverUuid}/proxy:
 *   get: { summary: Get proxy (Traefik) status, tags: [Proxy], responses: { 200: { description: OK } } }
 */
router.get('/servers/:serverUuid/proxy', ctrl.status);
router.get('/servers/:serverUuid/proxy/configuration', ctrl.configuration);
router.post('/servers/:serverUuid/proxy/start', ctrl.start);
router.post('/servers/:serverUuid/proxy/stop', ctrl.stop);

export default router;
