/**
 * Seeing what the firewall is doing.
 *
 * The alert and traffic tables have been readable since the start — and empty,
 * because nothing ever wrote to them. A firewall you cannot observe is a firewall
 * you cannot tune: without seeing what is blocked, an operator cannot tell
 * protection from an outage they caused themselves.
 *
 * This module fills them from CrowdSec, keeps them from growing without bound,
 * and derives the counters shown on the configuration screen.
 *
 * ## Scope
 *
 * Alerts come from the Local API, which is where CrowdSec records what it
 * detected — now from Traefik's access log, which it reads. Requests
 * themselves (allowed and blocked, per minute, and the detail of blocked
 * ones) come from the same log, read by traffic-ingestion.service.ts; the
 * counters here are derived from what that recorded.
 * `syncTrafficFromDecisions` (banned addresses as rows) is kept for callers
 * but no longer used by the sync: a ban is not a request.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { CrowdSecLapiClient, Alert, Decision } from './crowdsec-lapi.client';

/**
 * How long observability rows are kept.
 *
 * Traffic rows arrive per event and will fill a disk if left alone; alerts are
 * rarer and worth keeping longer for incident review.
 */
export const TRAFFIC_RETENTION_DAYS = Number(process.env.FIREWALL_TRAFFIC_RETENTION_DAYS ?? 7);
export const ALERT_RETENTION_DAYS = Number(process.env.FIREWALL_ALERT_RETENTION_DAYS ?? 30);

/** Severity we record when CrowdSec does not classify an alert itself. */
const DEFAULT_SEVERITY = 'medium';

/**
 * Alert statuses that mean "unresolved". Rows written by Laravel default to
 * `active`, rows written here to `open`: both must count, and neither may be
 * purged, or an incident disappears depending on which side recorded it.
 */
const UNRESOLVED_STATUSES = ['open', 'active'];

/** Decides whether a CrowdSec record concerns the application being synced. */
export type AlertFilter = (alert: Alert) => boolean;

export interface SyncResult {
  /** Rows written on this pass. */
  imported: number;
  /** Rows skipped because they were already recorded. */
  skipped: number;
}

/**
 * The address an alert concerns.
 *
 * CrowdSec nests it under `source`, and an alert without one cannot be stored:
 * the column is `inet NOT NULL`, and a placeholder would be a fabricated fact.
 */
function alertAddress(alert: Alert): string | null {
  const source = alert.source as { value?: string; ip?: string } | undefined;
  const value = source?.value ?? source?.ip;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Import CrowdSec's alerts for an application.
 *
 * Idempotent by construction: an alert already recorded is skipped rather than
 * duplicated, so the sync can run on a schedule and after a manual trigger
 * without producing a growing pile of the same incident.
 */
export async function syncAlerts(
  applicationId: number,
  client: CrowdSecLapiClient,
  limit = 100,
  belongs: AlertFilter = () => true
): Promise<SyncResult> {
  const alerts = (await client.listAlerts({ limit })).filter(belongs);
  let imported = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const address = alertAddress(alert);
    if (!address) {
      skipped += 1;
      continue;
    }

    // CrowdSec's own id is the natural key; storing it in metadata lets a
    // re-import recognise what it has already seen without a schema change.
    const { rowCount } = await pool.query(
      `INSERT INTO firewall_alerts
         (application_id, alert_type, severity, ip_address, scenario, message, metadata,
          status, created_at, updated_at)
       SELECT $1, $2, $3, $4::inet, $5, $6, $7::json, 'open', $8, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM firewall_alerts
         WHERE application_id = $1 AND metadata::jsonb ->> 'crowdsec_id' = $9
       )`,
      [
        applicationId,
        'crowdsec',
        String(alert.scenario ?? '').includes('http') ? 'high' : DEFAULT_SEVERITY,
        address,
        alert.scenario ?? null,
        (alert.message as string) ?? null,
        JSON.stringify({ crowdsec_id: alert.id, raw: alert }),
        alert.created_at ?? new Date().toISOString(),
        String(alert.id),
      ]
    );

    if ((rowCount ?? 0) > 0) imported += 1;
    else skipped += 1;
  }

  if (imported > 0) {
    logger.info('Imported CrowdSec alerts', { applicationId, imported, skipped });
  }
  return { imported, skipped };
}

/**
 * Record the addresses currently blocked, as traffic entries.
 *
 * A coarser signal than a request log — it says "this address is being blocked",
 * not "this request was blocked" — and named so the difference is visible. Real
 * per-request logging needs the proxy's access log; see the note at the top.
 */
export async function syncTrafficFromDecisions(
  applicationId: number,
  client: CrowdSecLapiClient,
  targets?: ReadonlySet<string>
): Promise<SyncResult> {
  const decisions = ownDecisions(await client.listDecisions({ origin: 'ideploy' }), targets);
  let imported = 0;
  let skipped = 0;

  for (const decision of decisions) {
    // Runs every few minutes: one row per address and day, not one per pass,
    // or the "blocked" counter would measure how often the sync ran.
    const { rowCount } = await pool.query(
      `INSERT INTO firewall_traffic_logs
         (application_id, ip_address, decision, rule_name, timestamp)
       SELECT $1, $2::inet, 'blocked', $3, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM firewall_traffic_logs
         WHERE application_id = $1 AND ip_address = $2::inet AND decision = 'blocked'
           AND timestamp > now() - interval '1 day'
       )`,
      [applicationId, decision.value, decision.scenario ?? 'ideploy-rule']
    );
    if ((rowCount ?? 0) > 0) imported += 1;
    else skipped += 1;
  }

  return { imported, skipped };
}

/**
 * Our own address/range decisions, narrowed to `targets` (keys from
 * `targetKey`) when given. CrowdSec echoes the scope title-cased ("Ip",
 * "Range"), and ignores the `origin` filter, so both are checked here.
 */
function ownDecisions(decisions: Decision[], targets?: ReadonlySet<string>): Decision[] {
  return decisions.filter((d) => {
    const scope = d.scope.toLowerCase();
    if (d.origin !== 'ideploy' || (scope !== 'ip' && scope !== 'range')) return false;
    return !targets || targets.has(`${scope}:${d.value}`);
  });
}

export interface FirewallCounters {
  totalBlocked: number;
  activeDecisions: number;
  openAlerts: number;
}

/**
 * Refresh the counters shown beside the firewall toggle.
 *
 * `total_blocked` is derived from what is actually recorded rather than
 * incremented in place: a counter that only ever goes up drifts from reality the
 * first time a write is lost, and there is no way to notice.
 */
export async function refreshCounters(
  applicationId: number,
  client: CrowdSecLapiClient,
  targets?: ReadonlySet<string>
): Promise<FirewallCounters> {
  const decisions = ownDecisions(await client.listDecisions({ origin: 'ideploy' }), targets);

  // Requests counted from the proxy's access log (traffic-ingestion.service.ts).
  const { rows } = await pool.query<{ requests: string; blocked: string; alerts: string }>(
    `SELECT
       (SELECT coalesce(sum(allowed + blocked), 0)::text FROM firewall_traffic_stats WHERE application_id = $1) AS requests,
       (SELECT coalesce(sum(blocked), 0)::text FROM firewall_traffic_stats WHERE application_id = $1) AS blocked,
       (SELECT count(*)::text FROM firewall_alerts
         WHERE application_id = $1 AND status = ANY($2)) AS alerts`,
    [applicationId, UNRESOLVED_STATUSES]
  );

  const counters: FirewallCounters = {
    totalBlocked: Number(rows[0].blocked),
    activeDecisions: decisions.length,
    openAlerts: Number(rows[0].alerts),
  };

  await pool.query(
    'UPDATE firewall_configs SET total_requests = $2, total_blocked = $3, updated_at = now() WHERE application_id = $1',
    [applicationId, Number(rows[0].requests), counters.totalBlocked]
  );

  return counters;
}

export interface PurgeResult {
  trafficRemoved: number;
  alertsRemoved: number;
}

/**
 * Delete observability rows past their retention window.
 *
 * Runs across every application at once: retention is a property of the
 * installation, not of one customer, and a per-application sweep would leave
 * rows behind for anything deleted in the meantime.
 *
 * Resolved alerts are dropped on the alert schedule; open ones are kept whatever
 * their age, because an unresolved incident does not stop mattering.
 */
export async function purgeExpired(): Promise<PurgeResult> {
  const traffic = await pool.query(
    `DELETE FROM firewall_traffic_logs
     WHERE timestamp < now() - ($1 || ' days')::interval`,
    [String(TRAFFIC_RETENTION_DAYS)]
  );

  await pool.query(
    `DELETE FROM firewall_traffic_stats WHERE bucket < now() - ($1 || ' days')::interval`,
    [String(TRAFFIC_RETENTION_DAYS)]
  );

  const alerts = await pool.query(
    `DELETE FROM firewall_alerts
     WHERE status <> ALL($2) AND created_at < now() - ($1 || ' days')::interval`,
    [String(ALERT_RETENTION_DAYS), UNRESOLVED_STATUSES]
  );

  const result = {
    trafficRemoved: traffic.rowCount ?? 0,
    alertsRemoved: alerts.rowCount ?? 0,
  };

  if (result.trafficRemoved > 0 || result.alertsRemoved > 0) {
    logger.info('Purged expired firewall observability rows', result);
  }
  return result;
}

export interface TrafficFilters {
  /** Only entries for this address. */
  ip?: string;
  /** `blocked`, `allowed`, … */
  decision?: string;
  /** ISO timestamp; entries at or after it. */
  since?: string;
  limit?: number;
}

/**
 * Traffic entries for an application, filtered.
 *
 * Filtering is the point of a traffic view: a flat list of the last hundred
 * entries answers no question an operator actually has.
 */
export async function queryTraffic(
  applicationId: number,
  filters: TrafficFilters = {}
): Promise<Record<string, unknown>[]> {
  const conditions = ['application_id = $1'];
  const params: unknown[] = [applicationId];

  if (filters.ip) {
    params.push(filters.ip);
    conditions.push(`ip_address = $${params.length}::inet`);
  }
  if (filters.decision) {
    params.push(filters.decision);
    conditions.push(`decision = $${params.length}`);
  }
  if (filters.since) {
    params.push(filters.since);
    conditions.push(`timestamp >= $${params.length}::timestamp`);
  }

  params.push(Math.min(filters.limit ?? 100, 1000));

  const { rows } = await pool.query(
    // `host()` renders the address bare. A plain `inet` comes back as
    // `203.0.113.5/32`, which no client comparing against an IP will match.
    `SELECT host(ip_address) AS ip_address, method, uri, host, decision, rule_name, status_code,
            country_code, timestamp
     FROM firewall_traffic_logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY timestamp DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

/** Traffic entries as CSV, for taking the evidence elsewhere. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const columns = ['timestamp', 'ip_address', 'decision', 'rule_name', 'method', 'uri', 'host'];
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    // Quote whenever the value could otherwise break the row apart.
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(',')),
  ].join('\n');
}

export interface ServerSyncResult {
  applications: number;
  alertsImported: number;
  trafficImported: number;
}

/**
 * Fill the alert and traffic tables for every protected application on one
 * server, from that server's CrowdSec.
 *
 * CrowdSec is shared by the whole server, so its records have to be attributed:
 * - a ban we pushed carries the application's uuid in its message, and belongs
 *   to that application only;
 * - a detection of CrowdSec's own (a scenario hitting the shared proxy) concerns
 *   every protected application on the server, and is recorded for each.
 * Traffic and counters keep only decisions matching the application's rules.
 */
export async function syncServer(serverId: number): Promise<ServerSyncResult> {
  const { getServerCrowdSecClient, analyseRule, targetKey } = await import('./firewall-enforcement.service');
  const { listEnabledConfigsOnServer, listRulesByConfigId } = await import('./firewall.service');

  const result: ServerSyncResult = { applications: 0, alertsImported: 0, trafficImported: 0 };
  const configs = await listEnabledConfigsOnServer(serverId);
  if (configs.length === 0) return result;

  const client = await getServerCrowdSecClient(serverId);
  if (!client) return result;

  const otherApps = (uuid: string) => configs.map((c) => c.appUuid).filter((u) => u !== uuid);

  for (const config of configs) {
    const rules = await listRulesByConfigId(config.configId);
    const targets = new Set(
      rules
        .filter((r) => r.enabled)
        .map(analyseRule)
        .filter((a) => a.enforceability === 'enforceable' && a.enforcedBy === 'crowdsec')
        .flatMap((a) => a.targets)
        .map(targetKey)
    );
    const others = otherApps(config.appUuid);
    const belongs: AlertFilter = (alert) => {
      const message = typeof alert.message === 'string' ? alert.message : '';
      if (message.includes(config.appUuid)) return true;
      return !others.some((uuid) => message.includes(uuid));
    };

    const alerts = await syncAlerts(config.applicationId, client, 100, belongs);
    // Real requests now come from the access log; a banned address is not traffic.
    const traffic = { imported: 0 };
    await refreshCounters(config.applicationId, client, targets);

    result.applications += 1;
    result.alertsImported += alerts.imported;
    result.trafficImported += traffic.imported;
  }
  return result;
}

/** Servers with CrowdSec provisioned and at least one protected application. */
export async function listServersToSync(): Promise<number[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT DISTINCT s.id
     FROM firewall_configs fw
     JOIN applications a ON a.id = fw.application_id AND a.deleted_at IS NULL
     JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
     JOIN servers s ON s.id = sd.server_id
     WHERE fw.enabled = true AND s.crowdsec_api_key IS NOT NULL`
  );
  return rows.map((r) => Number(r.id));
}
