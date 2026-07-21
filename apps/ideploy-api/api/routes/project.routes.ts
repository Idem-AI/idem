import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/project.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/projects:
 *   get: { summary: List projects, tags: [Projects], responses: { 200: { description: OK } } }
 *   post: { summary: Create a project (+ default production env), tags: [Projects], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.listProjects);
router.post('/', ctrl.createProject);

router.get('/:uuid', ctrl.getProject);
router.delete('/:uuid', ctrl.deleteProject);

/**
 * @swagger
 * /api/v1/projects/{uuid}/environments:
 *   get: { summary: List a project's environments, tags: [Projects], responses: { 200: { description: OK } } }
 */
router.get('/:uuid/environments', ctrl.listEnvironments);

export default router;
