import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as serverService from '../services/server.service';
import * as proxyService from '../services/proxy.service';
import { realtime } from '../services/realtime.service';

export async function listServers(req: CustomRequest, res: Response): Promise<void> {
  try {
    const servers = await serverService.listServers(req.user!.currentTeamId!);
    ok(res, servers);
  } catch (err) {
    logger.error('listServers error', { message: (err as Error).message });
    fail(res, 'Failed to list servers');
  }
}

export async function getServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const server = await serverService.getServer(req.user!.currentTeamId!, String(req.params.uuid));
    if (!server) return fail(res, 'Server not found', 404, 'NOT_FOUND');
    ok(res, server);
  } catch (err) {
    logger.error('getServer error', { message: (err as Error).message });
    fail(res, 'Failed to fetch server');
  }
}

export async function getServerSettings(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await serverService.getServerSettings(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    respondWithError(res, err, 'Loading the server settings');
  }
}

export async function updateServerSettings(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await serverService.updateServerSettings(req.user!.currentTeamId!, String(req.params.uuid), req.body ?? {})
    );
  } catch (err) {
    respondWithError(res, err, 'Saving the server settings');
  }
}

/** One-click: use THIS machine (local Docker) as a server + destination. */
export async function createLocalServer(req: CustomRequest, res: Response): Promise<void> {
  // Local-machine deployment is a dev/testing convenience — never in production.
  if (process.env.NODE_ENV === 'production') {
    return fail(res, 'Local server is disabled in production.', 403, 'LOCAL_DISABLED');
  }
  try {
    const result = await serverService.ensureLocalServer(req.user!.currentTeamId!);
    ok(res, result, 201);
  } catch (err) {
    logger.error('createLocalServer error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to set up local server');
  }
}

/** Body validated by `createServerSchema` on the route. */
export async function createServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const { server, destinationId } = await serverService.createServer(
      req.user!.currentTeamId!,
      req.body
    );
    // Flat shape: the destination is an implementation detail of "a usable
    // server", but callers need its id to target deployments.
    ok(res, { ...server, destination_id: destinationId }, 201);
  } catch (err) {
    respondWithError(res, err, 'Creating the server');
  }
}

export async function deleteServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await serverService.deleteServer(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Server not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteServer error', { message: (err as Error).message });
    fail(res, 'Failed to delete server');
  }
}

/** Full readiness report — every check carries a remedy when it fails. */
export async function validateServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await serverService.validateServer(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    respondWithError(res, err, 'Validating the server');
  }
}

/**
 * Install and configure Docker, then re-check readiness.
 *
 * Streams every line of the setup script to `server-provision.{uuid}` as it
 * runs (subscribed to by the server detail page) — a multi-minute install
 * that reports nothing until it either succeeds or fails is exactly what made
 * "it's stuck" and "it silently failed" indistinguishable before.
 */
export async function setUpServer(req: CustomRequest, res: Response): Promise<void> {
  const uuid = String(req.params.uuid);
  const teamId = req.user!.currentTeamId!;
  try {
    const result = await serverService.setUpServer(teamId, uuid, (chunk) =>
      realtime.provisionLog(uuid, chunk)
    );
    // Matches the Laravel side: a server that just became ready starts serving
    // traffic without a second manual step. Best-effort — a proxy hiccup here
    // must not turn a successful setup into a reported failure; "Démarrer le
    // proxy" is still one click away on this same page if it doesn't.
    if (result.success) {
      try {
        await proxyService.startProxy(teamId, uuid, (chunk) => realtime.provisionLog(uuid, chunk));
      } catch (err) {
        logger.warn('Auto-starting the proxy after setup failed', {
          uuid,
          message: (err as Error).message,
        });
      }
    }
    ok(res, result);
  } catch (err) {
    respondWithError(res, err, 'Setting up the server');
  }
}

/** Reclaim disk space — dangling images, stopped containers, unused build cache. */
export async function dockerCleanup(req: CustomRequest, res: Response): Promise<void> {
  const uuid = String(req.params.uuid);
  try {
    ok(
      res,
      await serverService.cleanupDocker(
        req.user!.currentTeamId!,
        uuid,
        { pruneVolumes: Boolean(req.body?.prune_volumes) },
        (chunk) => realtime.provisionLog(uuid, chunk)
      )
    );
  } catch (err) {
    respondWithError(res, err, 'Cleaning up Docker on this server');
  }
}

/** Applications, databases and services currently deployed on this server. */
export async function listServerResources(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await serverService.listServerResources(req.user!.currentTeamId!, String(req.params.uuid))
    );
  } catch (err) {
    respondWithError(res, err, 'Listing the resources on this server');
  }
}

/** Liveness and disk headroom, probed on demand over SSH. */
export async function getServerHealth(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await serverService.getServerHealth(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    respondWithError(res, err, 'Checking the health of this server');
  }
}
