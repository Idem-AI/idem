import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/pipeline.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/applications/{uuid}/pipeline:
 *   get: { summary: Get pipeline config, tags: [Pipelines], responses: { 200: { description: OK } } }
 *   patch: { summary: Update pipeline config, tags: [Pipelines], responses: { 200: { description: OK } } }
 */
router.get('/applications/:uuid/pipeline', ctrl.getConfig);
router.patch('/applications/:uuid/pipeline', ctrl.updateConfig);
router.post('/applications/:uuid/pipeline/trigger', ctrl.trigger);
router.get('/applications/:uuid/pipeline/executions', ctrl.listExecutions);
router.get('/pipeline/executions/:executionUuid', ctrl.getExecution);

export default router;
