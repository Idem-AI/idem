import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/destination.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/servers/{serverUuid}/destinations:
 *   get: { summary: List a server's Docker destinations, tags: [Destinations], responses: { 200: { description: OK } } }
 *   post: { summary: Create a StandaloneDocker destination (+ docker network), tags: [Destinations], responses: { 201: { description: Created } } }
 */
router.get('/servers/:serverUuid/destinations', ctrl.listForServer);
router.post('/servers/:serverUuid/destinations', ctrl.create);
router.delete('/destinations/:uuid', ctrl.remove);

export default router;
