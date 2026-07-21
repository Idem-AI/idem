import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as firewall from '../services/firewall.service';
import * as crowdsec from '../services/crowdsec.service';
import * as ssl from '../services/ssl.service';

const team = (req: CustomRequest) => req.user!.currentTeamId!;
const appUuid = (req: CustomRequest) => String(req.params.uuid);
const serverUuid = (req: CustomRequest) => String(req.params.serverUuid);

// ── Firewall (application-scoped) ─────────────────────────
export async function getConfig(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.getOrCreateConfig(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get firewall config');
  }
}
export async function updateConfig(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.updateConfig(team(req), appUuid(req), req.body ?? {}));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to update firewall config');
  }
}
export async function listRules(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.listRules(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list rules');
  }
}
export async function createRule(req: CustomRequest, res: Response): Promise<void> {
  const { name, conditions } = req.body ?? {};
  if (!name || !Array.isArray(conditions))
    return fail(res, 'name and conditions[] are required', 422, 'VALIDATION');
  try {
    ok(res, await firewall.createRule(team(req), appUuid(req), req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create rule');
  }
}
export async function deleteRule(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await firewall.deleteRule(team(req), appUuid(req), Number(req.params.ruleId));
    if (!deleted) return fail(res, 'Rule not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete rule');
  }
}
export async function listAlerts(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.listAlerts(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list alerts');
  }
}
export async function listTraffic(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.listTrafficLogs(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list traffic logs');
  }
}
export async function deployFirewall(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.deploy(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to deploy firewall');
  }
}

// ── CrowdSec (server-scoped) ──────────────────────────────
export async function installCrowdSec(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await crowdsec.install(team(req), serverUuid(req)));
  } catch (err) {
    logger.error('installCrowdSec error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to install CrowdSec');
  }
}
export async function crowdSecStatus(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await crowdsec.status(team(req), serverUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get CrowdSec status');
  }
}
export async function addBouncer(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.name) return fail(res, 'name is required', 422, 'VALIDATION');
  try {
    ok(res, await crowdsec.addBouncer(team(req), serverUuid(req), String(req.body.name)), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to add bouncer');
  }
}

// ── SSL (server-scoped) ───────────────────────────────────
export async function listCerts(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await ssl.listForServer(team(req), serverUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list certificates');
  }
}
export async function generateCert(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.common_name) return fail(res, 'common_name is required', 422, 'VALIDATION');
  try {
    ok(
      res,
      await ssl.generateSelfSigned(team(req), serverUuid(req), String(req.body.common_name), Boolean(req.body.is_ca)),
      201
    );
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to generate certificate');
  }
}
export async function deleteCert(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await ssl.deleteCert(team(req), serverUuid(req), Number(req.params.id));
    if (!deleted) return fail(res, 'Certificate not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete certificate');
  }
}
