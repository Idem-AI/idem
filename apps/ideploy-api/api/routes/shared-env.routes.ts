import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/shared-env.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/shared-variables/{scope}/{scopeId}:
 *   get: { summary: List shared env vars for a scope (team|project|environment), tags: [SharedVariables], responses: { 200: { description: OK } } }
 *   post: { summary: Upsert a shared env var, tags: [SharedVariables], responses: { 201: { description: Created } } }
 */
router.get('/:scope/:scopeId', ctrl.list);
router.post('/:scope/:scopeId', ctrl.upsert);
router.delete('/:scope/:scopeId/:key', ctrl.remove);

export default router;
