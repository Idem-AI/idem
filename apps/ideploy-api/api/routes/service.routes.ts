import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/service.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/services:
 *   get: { summary: List services (docker-compose stacks), tags: [Services], responses: { 200: { description: OK } } }
 *   post: { summary: Create a service from a raw docker-compose, tags: [Services], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.list);
router.post('/', ctrl.create);

// One-click templates
router.get('/templates', ctrl.listTemplates);
router.post('/from-template', ctrl.createFromTemplate);

router.get('/:uuid', ctrl.get);
router.delete('/:uuid', ctrl.remove);
router.post('/:uuid/start', ctrl.start);
router.post('/:uuid/stop', ctrl.stop);
router.post('/:uuid/restart', ctrl.restart);

export default router;
