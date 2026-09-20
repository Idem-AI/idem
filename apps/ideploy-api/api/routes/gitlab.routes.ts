import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/gitlab.controller';

const router = Router();

/**
 * Self-contained GitLab OAuth for iDeploy (no dependency on the global API) —
 * mirrors `github.routes.ts`.
 *
 * @swagger
 * /api/v1/gitlab/auth/callback:
 *   get: { summary: GitLab OAuth callback, tags: [GitLab], responses: { 302: { description: Redirect } } }
 */
// Callback is hit by GitLab's redirect → NOT authenticated (identity is in `state`).
router.get('/auth/callback', ctrl.callback);

// Everything else requires the iDeploy session.
router.get('/auth/url', authenticate, ctrl.authUrl);
router.get('/user', authenticate, ctrl.status);
router.get('/repositories', authenticate, ctrl.repositories);
router.get('/detect', authenticate, ctrl.detect);
router.delete('/disconnect', authenticate, ctrl.disconnect);

export default router;
