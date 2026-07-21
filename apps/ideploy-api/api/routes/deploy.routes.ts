import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/deploy.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/deploy:
 *   post:
 *     summary: Queue a deployment for an application (live logs stream over websocket on channel deployment.{deploymentUuid})
 *     tags: [Deploy]
 *     responses: { 202: { description: Queued } }
 */
router.post('/', ctrl.deploy);

/**
 * @swagger
 * /api/v1/deploy/{deploymentUuid}:
 *   get: { summary: Get deployment status, tags: [Deploy], responses: { 200: { description: OK } } }
 */
router.get('/:deploymentUuid', ctrl.getDeployment);

export default router;
