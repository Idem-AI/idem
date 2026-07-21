import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/subscription.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/subscription:
 *   get: { summary: Current team subscription, tags: [Subscription], responses: { 200: { description: OK } } }
 */
router.get('/', ctrl.current);
router.get('/plans', ctrl.plans);
router.get('/quota', ctrl.quota);
router.post('/checkout', ctrl.checkout);
router.post('/portal', ctrl.portal);
router.post('/cancel', ctrl.cancel);
router.post('/change-plan', ctrl.changePlan);

export default router;
