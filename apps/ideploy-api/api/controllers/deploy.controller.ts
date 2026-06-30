import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as appService from '../services/application.service';
import * as deploymentService from '../services/deployment.service';

/** POST /api/v1/deploy { uuid } — trigger a deployment for an application. */
export async function deploy(req: CustomRequest, res: Response): Promise<void> {
  const uuid = (req.body?.uuid as string) || (req.query.uuid as string);
  if (!uuid) return fail(res, 'application uuid is required', 422, 'VALIDATION');

  try {
    const teamId = req.user!.currentTeamId!;
    const app = await appService.getApplication(teamId, uuid);
    if (!app) return fail(res, 'Application not found', 404, 'NOT_FOUND');

    const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {
      forceRebuild: Boolean(req.body?.force_rebuild),
      // `commit` enables rollback: redeploy a previous commit from history.
      commit: (req.body?.commit as string) || undefined,
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
