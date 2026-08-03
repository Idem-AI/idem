/**
 * Assembling the labels a deployed container carries.
 *
 * Splits the two concerns the Laravel `generateLabelsApplication` mixes: this
 * module gathers the facts (which proxy the server runs, the shared network, the
 * application's domain settings), while `docker/labels.ts` turns those facts into
 * label strings with no database access. That is what makes the label logic —
 * the part that decides whether a site is reachable — unit-testable.
 */
import pool from '../config/db.config';
import { ApplicationRow } from '../models/ideploy.types';
import {
  BasicAuth,
  CrowdSecBouncer,
  ProxyType,
  RedirectDirection,
  caddyLabels,
  decodeCustomLabels,
  defaultLabels,
  extractMiddlewareNames,
  traefikLabels,
} from '../docker/labels';
import { ConcurrencyOptions, GeoBlockOptions, RateLimitOptions } from '../docker/protection';
import { GEO_RULE_NAME } from './geo-blocking.service';
import { tryDecryptString } from '../utils/laravel-crypto';

/**
 * Countries an enabled geo rule names, from its stored conditions.
 *
 * Reads the raw shape `setGeoRule` writes (`[{ field: 'country', operator:
 * 'in', value: [...] }]`) directly, rather than round-tripping through
 * `analyseRule`: this runs on every deploy, and the classification that rule
 * needs is already known — it is a country rule because it has this name and
 * this shape, not because something reclassified it.
 */
function parseGeoBlockedCountries(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const values = Array.isArray(parsed) ? parsed[0]?.value : undefined;
    return Array.isArray(values) ? values.map((v) => String(v).toUpperCase()) : [];
  } catch {
    return [];
  }
}

/** Everything the label generators need, resolved from the database. */
export interface LabelContext {
  proxyType: ProxyType;
  /**
   * When false, labels for *both* proxies are emitted so the container keeps
   * working if the server's proxy is switched. Mirrors `generate_exact_labels`.
   */
  exactLabelsOnly: boolean;
  network: string;
  workspaceName: string;
  environmentName: string;
  domains: string[];
  forceHttps: boolean;
  gzip: boolean;
  stripPrefix: boolean;
  isStatic: boolean;
  redirect: RedirectDirection;
  basicAuth: BasicAuth | null;
  customLabels: string[];
  /** Set only when the firewall is enabled and has a usable bouncer key. */
  crowdsec: CrowdSecBouncer | null;
  /** Set only when the firewall is enabled and a geo rule names countries. */
  geoBlock: GeoBlockOptions | null;
  /** Set only when the firewall is enabled and a rate limit is configured. */
  rateLimit: RateLimitOptions | null;
  /** Set only when the firewall is enabled and a concurrency cap is configured. */
  concurrency: ConcurrencyOptions | null;
}

/** Where CrowdSec listens when the server records no address of its own. */
const DEFAULT_LAPI_URL = process.env.CROWDSEC_LAPI_URL || 'http://crowdsec:8080';

/** The plugin takes host and scheme separately, so the scheme must come off. */
function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function toRedirect(value: unknown): RedirectDirection {
  return value === 'www' || value === 'non-www' ? value : 'both';
}

function toProxyType(value: unknown): ProxyType {
  const type = String(value ?? '').toLowerCase();
  if (type === 'traefik') return 'traefik';
  if (type === 'caddy') return 'caddy';
  return 'none';
}

/**
 * Read the deployment context for an application.
 *
 * Returns null when the application has no destination, in which case there is
 * nothing to attach labels to.
 */
export async function loadLabelContext(app: ApplicationRow): Promise<LabelContext | null> {
  const { rows } = await pool.query(
    `SELECT s.proxy,
            COALESCE(ss.generate_exact_labels, false) AS exact_labels,
            d.network,
            p.name  AS workspace_name,
            e.name  AS environment_name,
            COALESCE(aps.is_force_https_enabled, true)  AS force_https,
            COALESCE(aps.is_gzip_enabled, true)         AS gzip,
            COALESCE(aps.is_stripprefix_enabled, true)  AS strip_prefix,
            COALESCE(aps.is_static, false)              AS is_static,
            a.redirect,
            a.custom_labels,
            a.is_http_basic_auth_enabled,
            a.http_basic_auth_username,
            a.http_basic_auth_password,
            fw.enabled           AS firewall_enabled,
            fw.crowdsec_api_key  AS crowdsec_api_key,
            fw.crowdsec_lapi_url AS crowdsec_lapi_url,
            fw.ban_duration      AS crowdsec_ban_duration,
            (SELECT r.conditions FROM firewall_rules r
              WHERE r.firewall_config_id = fw.id AND r.name = $2 AND r.enabled = true
              LIMIT 1) AS geo_conditions,
            fw.rate_limit_average, fw.rate_limit_burst, fw.rate_limit_period_seconds,
            fw.concurrency_limit
     FROM applications a
     JOIN environments e            ON e.id = a.environment_id
     JOIN projects p                ON p.id = e.project_id
     LEFT JOIN application_settings aps ON aps.application_id = a.id
     LEFT JOIN standalone_dockers d ON d.id = a.destination_id
     LEFT JOIN servers s            ON s.id = d.server_id
     LEFT JOIN server_settings ss   ON ss.server_id = s.id
     LEFT JOIN firewall_configs fw  ON fw.application_id = a.id
     WHERE a.id = $1
     LIMIT 1`,
    [app.id, GEO_RULE_NAME]
  );

  const r = rows[0];
  if (!r || !r.network) return null;

  // The password column is Laravel-encrypted; a failed decrypt must not silently
  // produce an unprotected route, so basic auth is dropped only when unreadable
  // *and* logged by the caller through the missing middleware.
  let basicAuth: BasicAuth | null = null;
  if (r.is_http_basic_auth_enabled && r.http_basic_auth_username) {
    const password = tryDecryptString(r.http_basic_auth_password as string | null);
    if (password) {
      basicAuth = { username: String(r.http_basic_auth_username), password };
    }
  }

  // Both conditions are required. A firewall marked enabled but without a
  // bouncer key cannot authenticate to the Local API, so the middleware would be
  // declared and fail every lookup — configuration that looks protective and is
  // not. Better to emit nothing and let the enforcement status say why.
  const firewallEnabled = Boolean(r.firewall_enabled);
  const bouncerKey = (r.crowdsec_api_key as string) ?? null;
  const crowdsec: CrowdSecBouncer | null =
    firewallEnabled && bouncerKey
      ? {
          apiKey: bouncerKey,
          lapiHost: stripScheme(
            (r.crowdsec_lapi_url as string) ?? DEFAULT_LAPI_URL
          ),
          banDurationSeconds: Number(r.crowdsec_ban_duration ?? 3600),
        }
      : null;

  const blockedCountries = firewallEnabled ? parseGeoBlockedCountries(r.geo_conditions) : [];
  const geoBlock: GeoBlockOptions | null =
    blockedCountries.length > 0 ? { blockedCountries } : null;

  const rateLimit: RateLimitOptions | null =
    firewallEnabled && r.rate_limit_average !== null
      ? {
          averagePerSecond: Number(r.rate_limit_average),
          burst: Number(r.rate_limit_burst),
          periodSeconds: Number(r.rate_limit_period_seconds),
        }
      : null;
  const concurrency: ConcurrencyOptions | null =
    firewallEnabled && r.concurrency_limit !== null
      ? { maxInFlight: Number(r.concurrency_limit) }
      : null;

  return {
    crowdsec,
    geoBlock,
    rateLimit,
    concurrency,
    proxyType: toProxyType((r.proxy as Record<string, unknown> | null)?.type),
    exactLabelsOnly: Boolean(r.exact_labels),
    network: String(r.network),
    workspaceName: String(r.workspace_name),
    environmentName: String(r.environment_name),
    domains: (app.fqdn ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
    forceHttps: Boolean(r.force_https),
    gzip: Boolean(r.gzip),
    stripPrefix: Boolean(r.strip_prefix),
    isStatic: Boolean(r.is_static),
    redirect: toRedirect(r.redirect),
    basicAuth,
    customLabels: decodeCustomLabels(r.custom_labels as string | null),
  };
}

/**
 * The labels to attach to an application's container.
 *
 * Ownership labels are always present; routing labels only when a domain is
 * configured — a container with no domain is still ours to manage, it is simply
 * not published.
 */
export function buildApplicationLabels(
  app: ApplicationRow,
  context: LabelContext
): string[] {
  const labels = defaultLabels({
    id: app.id,
    name: `${app.name}-${app.uuid}`.toLowerCase(),
    workspaceName: context.workspaceName,
    resourceName: app.name,
    environment: context.environmentName,
    type: 'application',
  });

  if (context.domains.length === 0 || context.proxyType === 'none') {
    return labels.sort();
  }

  // A static site is served by nginx on 80 regardless of what the app declares.
  const exposed = context.isStatic
    ? 80
    : Number((app.ports_exposes ?? '').split(',')[0]) || null;

  const options = {
    uuid: app.uuid,
    domains: context.domains,
    forceHttps: context.forceHttps,
    onlyPort: exposed,
    gzip: context.gzip,
    stripPrefix: context.stripPrefix,
    redirect: context.redirect,
    basicAuth: context.basicAuth,
    extraMiddlewares: extractMiddlewareNames(context.customLabels),
    crowdsec: context.crowdsec,
    geoBlock: context.geoBlock,
    rateLimit: context.rateLimit,
    concurrency: context.concurrency,
  };

  const wantsTraefik = !context.exactLabelsOnly || context.proxyType === 'traefik';
  const wantsCaddy = !context.exactLabelsOnly || context.proxyType === 'caddy';

  if (wantsTraefik) labels.push(...traefikLabels(options));
  if (wantsCaddy) labels.push(...caddyLabels(context.network, options));

  // The user's own labels win: they are appended last and de-duplicated.
  labels.push(...context.customLabels);

  return [...new Set(labels)].sort();
}

/** Convenience: load the context and build the labels in one call. */
export async function resolveApplicationLabels(app: ApplicationRow): Promise<string[]> {
  const context = await loadLabelContext(app);
  if (!context) return [];
  return buildApplicationLabels(app, context);
}
