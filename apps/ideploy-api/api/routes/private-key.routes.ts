import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/private-key.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/security/keys:
 *   get: { summary: List private keys, tags: [Security], responses: { 200: { description: OK } } }
 *   post: { summary: Create a private key (PEM encrypted at rest), tags: [Security], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:uuid', ctrl.get);
router.delete('/:uuid', ctrl.remove);

export default router;
