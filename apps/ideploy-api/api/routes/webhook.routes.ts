import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, respondWithError } from '../utils/response';
import * as webhooks from '../services/webhook.service';
import * as appService from '../services/application.service';
import * as deploymentService from '../services/deployment.service';

const router = Router();

const providerParam = z.object({
  provider: z.enum(webhooks.GIT_PROVIDERS),
  uuid: z.string().trim().min(1),
});

/**
 * @swagger
 * /api/v1/webhooks/{provider}/{uuid}:
 *   post:
 *     summary: Push-to-deploy endpoint for a git host
 *     description: >
 *       Unauthenticated by necessity — a git host cannot present a session — so
 *       the signature is the authorisation. Deploys only when the pushed branch
 *       is the one the application tracks and automatic deployment is enabled.
 *     tags: [Webhooks]
 *     responses:
 *       200: { description: Deployed, or deliberately ignored }
 *       422: { description: Signature could not be verified }
 */
router.post('/:provider/:uuid', validate({ params: providerParam }), async (req, res: Response) => {
  const request = req as CustomRequest;
  try {
    const outcome = await webhooks.handleWebhook(
      {
        provider: req.params.provider as webhooks.GitProvider,
        applicationUuid: String(req.params.uuid),
        // The parsed body is only read after the signature is verified.
        rawBody: request.rawBody ?? Buffer.from(''),
        payload: (req.body ?? {}) as Record<string, unknown>,
        signature:
          (req.headers['x-hub-signature-256'] as string | undefined) ??
          (req.headers['x-gitea-signature'] as string | undefined),
        token: req.headers['x-gitlab-token'] as string | undefined,
      },
      async (target) => {
        const app = await appService.getApplicationById(target.applicationId);
        if (!app) throw new Error('Application vanished between verification and deployment');
        const { deploymentUuid } = await deploymentService.createDeployment(app, target.teamId, {});
        return deploymentUuid;
      }
    );

    ok(res, outcome);
  } catch (err) {
    respondWithError(res, err, 'Handling the webhook');
  }
});

// ── Management (authenticated) ─────────────────────────

const managementRouter = Router();
managementRouter.use(authenticate, requireTeam);

const secretParams = z.object({
  uuid: z.string().trim().min(1),
  provider: z.enum(webhooks.GIT_PROVIDERS),
});

/**
 * @swagger
 * /api/v1/applications/{uuid}/webhooks/{provider}:
 *   get: { summary: The push-to-deploy URL and secret to configure on the git host, tags: [Webhooks], responses: { 200: { description: OK } } }
 *   post: { summary: Rotate the secret, retiring a leaked one, tags: [Webhooks], responses: { 200: { description: OK } } }
 */
managementRouter.get(
  '/applications/:uuid/webhooks/:provider',
  validate({ params: secretParams }),
  async (req: CustomRequest, res: Response) => {
    try {
      const provider = req.params.provider as webhooks.GitProvider;
      const secret = await webhooks.ensureWebhookSecret(
        req.user!.currentTeamId!,
        String(req.params.uuid),
        provider
      );
      ok(res, { provider, secret, url: webhookUrl(provider, String(req.params.uuid)) });
    } catch (err) {
      respondWithError(res, err, 'Loading the webhook settings');
    }
  }
);

managementRouter.post(
  '/applications/:uuid/webhooks/:provider/rotate',
  validate({ params: secretParams }),
  async (req: CustomRequest, res: Response) => {
    try {
      const provider = req.params.provider as webhooks.GitProvider;
      const secret = await webhooks.rotateWebhookSecret(
        req.user!.currentTeamId!,
        String(req.params.uuid),
        provider
      );
      ok(res, { provider, secret, url: webhookUrl(provider, String(req.params.uuid)) });
    } catch (err) {
      respondWithError(res, err, 'Rotating the webhook secret');
    }
  }
);

/**
 * The URL to paste into the git host.
 *
 * Forced to https: git hosts refuse to deliver secrets over plain http, and a
 * webhook that silently never fires is worse than one that fails loudly.
 */
function webhookUrl(provider: webhooks.GitProvider, applicationUuid: string): string {
  const base = (process.env.IDEPLOY_API_PUBLIC_URL || 'http://localhost:3002').replace(
    /^http:\/\//,
    'https://'
  );
  return `${base}/api/v1/webhooks/${provider}/${applicationUuid}`;
}

export { managementRouter };
export default router;
