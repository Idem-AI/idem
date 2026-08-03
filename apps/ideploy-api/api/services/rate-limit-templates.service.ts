/**
 * Rate limiting, as named presets over the proxy's own middleware.
 *
 * ## Not what Laravel called rate limiting
 *
 * `RateLimitTemplateService` on the Laravel side names its templates after
 * specific endpoints ("Login Protection", blocking POST to `/login`), but every
 * one of them is a `request_path`/`method`/`user_agent` condition — the same
 * AppSec-only shape `analyseRule` classifies as unenforceable elsewhere in this
 * phase. Worse, the `rate_limit` field carrying the window/threshold/tracking
 * numbers is never persisted by `importTemplate()`: nothing there ever counted a
 * request. Its own docblock says as much ("not true rate limiting... planned
 * for future release").
 *
 * Traefik's native `ratelimit`/`inflightreq` middlewares (see
 * `docker/protection.ts`) are real, immediately available, and need no AppSec.
 * The honest trade: they apply to the **whole application**, not to one path —
 * a router-level limit cannot single out `/login` from `/`. So these templates
 * are named for a traffic *profile* ("API-heavy", "Strict"), not an endpoint,
 * and the description says so.
 *
 * ## Why a template at all
 *
 * The numbers a sane rate limit needs — burst well above the average so one
 * page's parallel asset requests are not refused, a concurrency cap distinct
 * from the rate — are not obvious to pick from nothing. A template is a
 * starting point; `setCustomRateLimit` exists for anyone who wants their own.
 */
import pool from '../config/db.config';
import { unprocessable } from '../utils/errors';
import * as appService from './application.service';
import { getOrCreateConfig } from './firewall.service';

export interface RateLimitTemplate {
  key: string;
  name: string;
  description: string;
  averagePerSecond: number;
  burst: number;
  periodSeconds: number;
  concurrencyLimit: number;
}

export const RATE_LIMIT_TEMPLATES: Record<string, RateLimitTemplate> = {
  standard: {
    key: 'standard',
    name: 'Standard protection',
    description:
      'A sane default for most applications: allows ordinary browsing and a handful ' +
      'of concurrent tabs per visitor without noticing, while capping a single client ' +
      'well short of what a small server can be driven to.',
    averagePerSecond: 20,
    burst: 40,
    periodSeconds: 1,
    concurrencyLimit: 50,
  },
  api_heavy: {
    key: 'api_heavy',
    name: 'API-heavy traffic',
    description:
      'For applications whose clients are other programs — dashboards polling, ' +
      'integrations syncing — that legitimately send more requests per second than a ' +
      'browser ever would.',
    averagePerSecond: 50,
    burst: 100,
    periodSeconds: 1,
    concurrencyLimit: 100,
  },
  strict: {
    key: 'strict',
    name: 'Strict',
    description:
      'For an application-wide tight limit — an admin panel, a low-traffic internal ' +
      'tool — where a client sending more than a few requests a second is never ' +
      'legitimate. Applies to every request, not only to a login page: there is no ' +
      'way to limit one path more tightly than the rest without AppSec.',
    averagePerSecond: 5,
    burst: 10,
    periodSeconds: 1,
    concurrencyLimit: 10,
  },
  lenient: {
    key: 'lenient',
    name: 'High-traffic / lenient',
    description:
      'A safety net rather than a real constraint, for a public site expecting bursts ' +
      'of legitimate traffic — a launch, a link going around — where the goal is only ' +
      'to stop a single client from monopolising the server.',
    averagePerSecond: 100,
    burst: 200,
    periodSeconds: 1,
    concurrencyLimit: 200,
  },
};

/** The custom marker stored when numbers were set directly, not from a template. */
export const CUSTOM_TEMPLATE_KEY = 'custom';

export function listTemplates(): RateLimitTemplate[] {
  return Object.values(RATE_LIMIT_TEMPLATES);
}

export interface RateLimitSettings {
  averagePerSecond: number;
  burst: number;
  periodSeconds: number;
  concurrencyLimit: number;
  /** The template these numbers came from, or `custom`. Display only. */
  template: string;
}

function validate(settings: {
  averagePerSecond: number;
  burst: number;
  periodSeconds: number;
  concurrencyLimit: number;
}): void {
  if (settings.averagePerSecond <= 0 || settings.concurrencyLimit <= 0) {
    throw unprocessable(
      'RATE_LIMIT_INVALID',
      'The rate and the concurrency cap must both be greater than zero — zero would ' +
        'block every request, which is what turning the firewall off is for.'
    );
  }
  if (settings.burst < settings.averagePerSecond) {
    throw unprocessable(
      'RATE_LIMIT_BURST_TOO_LOW',
      'The burst must be at least the average — otherwise the limit is tighter than the ' +
        'average you asked for, since a burst below it refuses traffic the average alone would allow.'
    );
  }
  if (settings.periodSeconds <= 0) {
    throw unprocessable('RATE_LIMIT_INVALID', 'The period must be greater than zero.');
  }
}

async function saveSettings(
  teamId: number,
  appUuid: string,
  settings: RateLimitSettings
): Promise<RateLimitSettings> {
  const config = await getOrCreateConfig(teamId, appUuid);
  await pool.query(
    `UPDATE firewall_configs
     SET rate_limit_average = $2, rate_limit_burst = $3, rate_limit_period_seconds = $4,
         concurrency_limit = $5, rate_limit_template = $6, updated_at = now()
     WHERE id = $1`,
    [
      config.id,
      settings.averagePerSecond,
      settings.burst,
      settings.periodSeconds,
      settings.concurrencyLimit,
      settings.template,
    ]
  );
  return settings;
}

/** Apply a named template. */
export async function applyTemplate(
  teamId: number,
  appUuid: string,
  templateKey: string
): Promise<RateLimitSettings> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const template = RATE_LIMIT_TEMPLATES[templateKey];
  if (!template) {
    throw unprocessable(
      'UNKNOWN_RATE_LIMIT_TEMPLATE',
      `"${templateKey}" is not a rate limit template. Available: ${Object.keys(RATE_LIMIT_TEMPLATES).join(', ')}.`
    );
  }

  return saveSettings(teamId, appUuid, {
    averagePerSecond: template.averagePerSecond,
    burst: template.burst,
    periodSeconds: template.periodSeconds,
    concurrencyLimit: template.concurrencyLimit,
    template: template.key,
  });
}

/** Set specific numbers, outside any template. */
export async function setCustomRateLimit(
  teamId: number,
  appUuid: string,
  settings: { averagePerSecond: number; burst?: number; periodSeconds?: number; concurrencyLimit: number }
): Promise<RateLimitSettings> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const resolved = {
    averagePerSecond: settings.averagePerSecond,
    // Traefik's own default burst is 1, which refuses the second of two
    // simultaneous requests — including one ordinary page's parallel assets.
    burst: settings.burst ?? Math.max(settings.averagePerSecond * 2, 10),
    periodSeconds: settings.periodSeconds ?? 1,
    concurrencyLimit: settings.concurrencyLimit,
  };
  validate(resolved);

  return saveSettings(teamId, appUuid, { ...resolved, template: CUSTOM_TEMPLATE_KEY });
}

/** The current settings, or null when none are configured. */
export async function getRateLimit(teamId: number, appUuid: string): Promise<RateLimitSettings | null> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const { rows } = await pool.query<{
    rate_limit_average: number | null;
    rate_limit_burst: number | null;
    rate_limit_period_seconds: number | null;
    concurrency_limit: number | null;
    rate_limit_template: string | null;
  }>(
    `SELECT rate_limit_average, rate_limit_burst, rate_limit_period_seconds,
            concurrency_limit, rate_limit_template
     FROM firewall_configs WHERE application_id = $1 LIMIT 1`,
    [app.id]
  );

  const r = rows[0];
  if (!r || r.rate_limit_average === null) return null;

  return {
    averagePerSecond: Number(r.rate_limit_average),
    burst: Number(r.rate_limit_burst),
    periodSeconds: Number(r.rate_limit_period_seconds),
    concurrencyLimit: Number(r.concurrency_limit),
    template: r.rate_limit_template ?? CUSTOM_TEMPLATE_KEY,
  };
}

/** Remove the rate limit — the proxy still enforces it until the next deploy. */
export async function clearRateLimit(teamId: number, appUuid: string): Promise<boolean> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const { rowCount } = await pool.query(
    `UPDATE firewall_configs
     SET rate_limit_average = NULL, rate_limit_burst = NULL, rate_limit_period_seconds = NULL,
         concurrency_limit = NULL, rate_limit_template = NULL, updated_at = now()
     WHERE application_id = $1 AND rate_limit_average IS NOT NULL`,
    [app.id]
  );
  return (rowCount ?? 0) > 0;
}
