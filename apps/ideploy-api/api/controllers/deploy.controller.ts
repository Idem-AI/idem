import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as appService from '../services/application.service';
import * as deploymentService from '../services/deployment.service';
import { isSafeImageTag } from '../validation/git-input';

/** POST /api/v1/deploy { uuid } — trigger a deployment for an application. */
export async function deploy(req: CustomRequest, res: Response): Promise<void> {
  const uuid = (req.body?.uuid as string) || (req.query.uuid as string);
  if (!uuid) return fail(res, 'application uuid is required', 422, 'VALIDATION');

  try {
    const teamId = req.user!.currentTeamId!;
    const app = await appService.getApplication(teamId, uuid);
    if (!app) return fail(res, 'Application not found', 404, 'NOT_FOUND');

    // `commit` enables rollback; `image_tag` is the same thing for an
    // application that runs a registry image (what a CI pipeline sends).
    const version = (req.body?.commit as string) || (req.body?.image_tag as string) || undefined;
    if (req.body?.image_tag && !isSafeImageTag(req.body.image_tag)) {
      return fail(res, 'image_tag may contain letters, digits, . _ - (128 characters at most)', 422, 'INVALID_IMAGE_TAG');
    }
    const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {
      forceRebuild: Boolean(req.body?.force_rebuild),
      commit: version,
    });
    ok(res, { deploymentUuid, message: 'Deployment queued' }, 202);
  } catch (err) {
    logger.error('deploy error', { message: (err as Error).message });
    fail(res, 'Failed to queue deployment');
  }
}

/** GET /api/v1/deploy/:deploymentUuid — deployment status. */
export async function getDeployment(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deployment = await deploymentService.getDeployment(
      req.user!.currentTeamId!,
      String(req.params.deploymentUuid)
    );
    if (!deployment) return fail(res, 'Deployment not found', 404, 'NOT_FOUND');
    ok(res, deployment);
  } catch (err) {
    logger.error('getDeployment error', { message: (err as Error).message });
    fail(res, 'Failed to fetch deployment');
  }
}

/** Past deployments this application can be rolled back to. */
export async function rollbackTargets(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await deploymentService.listRollbackTargets(
        req.user!.currentTeamId!,
        String(req.params.uuid)
      )
    );
  } catch (err) {
    respondWithError(res, err, 'Listing rollback targets');
  }
}

/** Redeploy the commit a previous deployment used. */
export async function rollback(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await deploymentService.rollbackTo(
        req.user!.currentTeamId!,
        String(req.params.uuid),
        String(req.body.deployment_uuid)
      ),
      202
    );
  } catch (err) {
    respondWithError(res, err, 'Rolling back');
  }
}
