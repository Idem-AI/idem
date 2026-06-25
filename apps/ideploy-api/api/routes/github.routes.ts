import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/github.controller';

const router = Router();

/**
 * Self-contained GitHub OAuth for iDeploy (no dependency on the global API).
 *
 * @swagger
 * /api/v1/github/auth/callback:
 *   get: { summary: GitHub OAuth callback, tags: [GitHub], responses: { 302: { description: Redirect } } }
 */
// Callback is hit by GitHub's redirect → NOT authenticated (identity is in `state`).
router.get('/auth/callback', ctrl.callback);

// Everything else requires the iDeploy session.
router.get('/auth/url', authenticate, ctrl.authUrl);
router.get('/user', authenticate, ctrl.status);
router.get('/repositories', authenticate, ctrl.repositories);
router.get('/detect', authenticate, ctrl.detect);
router.delete('/disconnect', authenticate, ctrl.disconnect);

export default router;
