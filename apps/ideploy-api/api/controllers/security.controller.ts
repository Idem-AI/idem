import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as firewall from '../services/firewall.service';
import * as geo from '../services/geo-blocking.service';
import * as rateLimit from '../services/rate-limit-templates.service';
import * as crowdsec from '../services/crowdsec.service';
import * as ssl from '../services/ssl.service';

const team = (req: CustomRequest) => req.user!.currentTeamId!;
const appUuid = (req: CustomRequest) => String(req.params.uuid);
const serverUuid = (req: CustomRequest) => String(req.params.serverUuid);

// ── Firewall (application-scoped) ─────────────────────────
/**
 * The firewall configuration, together with whether it enforces anything.
 *
 * `enforcement` is returned on every read so the interface cannot present saved
 * rules as active ones — the distinction the previous response hid.
 */
export async function getConfig(req: CustomRequest, res: Response): Promise<void> {
  try {
    const [config, enforcement] = await Promise.all([
      firewall.getOrCreateConfig(team(req), appUuid(req)),
      firewall.getEnforcementStatus(team(req), appUuid(req)),
    ]);
    ok(res, { ...config, enforcement });
  } catch (err) {
    respondWithError(res, err, 'Loading the firewall configuration');
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
/**
 * Apply the rules, and report what actually changed.
 *
 * The result is returned in full — including `unsupported`, the rules that could
 * not be translated — because "applied" without that list is the same false
 * reassurance this phase set out to remove.
 */
export async function deployFirewall(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await firewall.deploy(team(req), appUuid(req)));
  } catch (err) {
    respondWithError(res, err, 'Applying the firewall rules');
  }
}

// ── Geo-blocking ──────────────────────────────────────────
/** The country catalogue, named in the caller's language. */
export async function listCountries(req: CustomRequest, res: Response): Promise<void> {
  try {
    const locale = String(req.query.locale ?? 'en');
    ok(res, {
      continents: geo.CONTINENT_NAMES,
      countries: geo.listCountries(locale),
    });
  } catch (err) {
    respondWithError(res, err, 'Listing countries');
  }
}

export async function getGeoBlocking(req: CustomRequest, res: Response): Promise<void> {
  try {
    const locale = String(req.query.locale ?? 'en');
    ok(res, await geo.getSelection(team(req), appUuid(req), locale));
  } catch (err) {
    respondWithError(res, err, 'Loading the geo-blocking selection');
  }
}

/**
 * Save a geo-blocking selection.
 *
 * Answers with the warnings the selection raised rather than swallowing them:
 * blocking the country your own server sits in is allowed, but the operator has
 * to be told they did it.
 */
export async function setGeoBlocking(req: CustomRequest, res: Response): Promise<void> {
  const { mode, countries, continents } = req.body ?? {};
  if (mode !== 'block' && mode !== 'allow_only') {
    return fail(res, 'mode must be "block" or "allow_only"', 422, 'VALIDATION');
  }
  if (!Array.isArray(countries) && !Array.isArray(continents)) {
    return fail(res, 'countries[] or continents[] is required', 422, 'VALIDATION');
  }
  try {
    ok(res, await geo.setGeoRule(team(req), appUuid(req), { mode, countries, continents }));
  } catch (err) {
    respondWithError(res, err, 'Saving the geo-blocking selection');
  }
}

export async function removeGeoBlocking(req: CustomRequest, res: Response): Promise<void> {
  try {
    const removed = await geo.removeGeoRule(team(req), appUuid(req));
    if (!removed) return fail(res, 'No geo-blocking rule is set', 404, 'NOT_FOUND');
    // Saying so plainly: the rule is gone, the decisions are not, until re-applied.
    ok(res, { removed: true, applyRequired: true });
  } catch (err) {
    respondWithError(res, err, 'Removing the geo-blocking rule');
  }
}

// ── Rate limiting ─────────────────────────────────────────
/** The named presets, for a picker — see rate-limit-templates.service for why these exist. */
export async function listRateLimitTemplates(_req: CustomRequest, res: Response): Promise<void> {
  ok(res, rateLimit.listTemplates());
}

export async function getRateLimit(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await rateLimit.getRateLimit(team(req), appUuid(req)));
  } catch (err) {
    respondWithError(res, err, 'Loading the rate limit');
  }
}

/**
 * Apply a named template.
 *
 * A redeploy is always required to take effect: this is a Docker label, read by
 * Traefik at container start, not a setting the running proxy can pick up on its
 * own — the same contract geo-blocking has.
 */
export async function applyRateLimitTemplate(req: CustomRequest, res: Response): Promise<void> {
  const { template } = req.body ?? {};
  if (typeof template !== 'string') return fail(res, 'template is required', 422, 'VALIDATION');
  try {
    const settings = await rateLimit.applyTemplate(team(req), appUuid(req), template);
    ok(res, { ...settings, applyRequired: true });
  } catch (err) {
    respondWithError(res, err, 'Applying the rate limit template');
  }
}

export async function setCustomRateLimit(req: CustomRequest, res: Response): Promise<void> {
  const { averagePerSecond, burst, periodSeconds, concurrencyLimit } = req.body ?? {};
  if (typeof averagePerSecond !== 'number' || typeof concurrencyLimit !== 'number') {
    return fail(res, 'averagePerSecond and concurrencyLimit are required numbers', 422, 'VALIDATION');
  }
  try {
    const settings = await rateLimit.setCustomRateLimit(team(req), appUuid(req), {
      averagePerSecond,
      burst,
      periodSeconds,
      concurrencyLimit,
    });
    ok(res, { ...settings, applyRequired: true });
  } catch (err) {
    respondWithError(res, err, 'Saving the rate limit');
  }
}

export async function removeRateLimit(req: CustomRequest, res: Response): Promise<void> {
  try {
    const removed = await rateLimit.clearRateLimit(team(req), appUuid(req));
    if (!removed) return fail(res, 'No rate limit is set', 404, 'NOT_FOUND');
    ok(res, { removed: true, applyRequired: true });
  } catch (err) {
    respondWithError(res, err, 'Removing the rate limit');
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
