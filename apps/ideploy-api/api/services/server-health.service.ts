/**
 * Server health monitoring.
 *
 * Ports Coolify's `ServerCheckJob` / `Server::isReachableChanged` state machine.
 * Before this, nothing watched the fleet: a server going down surfaced only as
 * an unexplained deployment or backup failure, minutes or hours later.
 *
 * Two behaviours are deliberate:
 *
 *  - **Debounced alerting.** A single failed probe is usually a transient network
 *    blip, and paging on those trains people to ignore alerts. We notify only
 *    after `UNREACHABLE_ALERT_THRESHOLD` consecutive failures.
 *
 *  - **Edge-triggered, not level-triggered.** Notifications fire on a state
 *    *change*, deduplicated through the `unreachable_notification_sent` /
 *    `high_disk_usage_notification_sent` flags, so a server down for a week
 *    produces one alert and one recovery — not one per check.
 *
 * The Laravel original re-probed three times with `sleep(5)` inline, and reset
 * `is_reachable = true` on the first failure, which masked it. Same intent here,
 * implemented as a counter so nothing blocks and no state is misreported.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { executeRemoteCommand, testConnection } from '../ssh/ssh';
import { notifyTeam } from './notification.service';

/** Consecutive failed probes before the team is told. */
export const UNREACHABLE_ALERT_THRESHOLD = 3;

/** Used when a server has no explicit threshold configured. */
export const DEFAULT_DISK_THRESHOLD_PERCENT = 80;

export interface HealthProbe {
  reachable: boolean;
  /** Root filesystem usage, when it could be read. */
  diskUsedPercent: number | null;
  output: string;
}

export interface HealthOutcome {
  serverId: number;
  serverName: string;
  reachable: boolean;
  diskUsedPercent: number | null;
  /** Consecutive failures after this check. */
  unreachableCount: number;
  /** State changes worth telling a human about. */
  notifications: HealthNotification[];
}

export type HealthNotification =
  | { kind: 'unreachable' }
  | { kind: 'recovered' }
  | { kind: 'disk_high'; usedPercent: number; threshold: number }
  | { kind: 'disk_recovered'; usedPercent: number };

/** A server plus the monitoring state we keep for it. */
export interface MonitoredServer {
  server: ServerRow;
  key: PrivateKeyRow;
  unreachableCount: number;
  unreachableNotificationSent: boolean;
  diskNotificationSent: boolean;
  diskThresholdPercent: number;
}

/** Single round trip: liveness and disk usage together. */
const HEALTH_PROBE = [
  'echo ALIVE',
  "echo \"DISK_USED_PCT=$(df -P / 2>/dev/null | awk 'NR==2{print $5}' | tr -d %)\"",
].join('\n');

export function parseHealthProbe(stdout: string, reachable: boolean): HealthProbe {
  const match = /DISK_USED_PCT=(\d+)/.exec(stdout);
  const parsed = match ? Number(match[1]) : NaN;
  return {
    reachable,
    diskUsedPercent: Number.isFinite(parsed) ? parsed : null,
    output: stdout,
  };
}

/** Probe one server. Never throws: an unreachable host is a result, not an error. */
export async function probeServer(server: ServerRow, key: PrivateKeyRow): Promise<HealthProbe> {
  try {
    const connection = await testConnection(server, key);
    if (!connection.ok) {
      return { reachable: false, diskUsedPercent: null, output: connection.output };
    }

    const result = await executeRemoteCommand(server, key, HEALTH_PROBE, { noRetry: true });
    if (result.exitCode !== 0 || !result.stdout.includes('ALIVE')) {
      return { reachable: false, diskUsedPercent: null, output: result.stdout + result.stderr };
    }
    return parseHealthProbe(result.stdout, true);
  } catch (err) {
    return { reachable: false, diskUsedPercent: null, output: (err as Error).message };
  }
}

/**
 * Decide what changed, given the previous state and a fresh probe.
 *
 * Pure — the whole state machine is unit-testable without a database or a server,
 * which is the only practical way to cover flapping, debouncing and recovery.
 */
export function decideTransitions(
  previous: Pick<
    MonitoredServer,
    'unreachableCount' | 'unreachableNotificationSent' | 'diskNotificationSent' | 'diskThresholdPercent'
  >,
  probe: HealthProbe
): { unreachableCount: number; notifications: HealthNotification[] } {
  const notifications: HealthNotification[] = [];

  if (!probe.reachable) {
    const unreachableCount = previous.unreachableCount + 1;

    // Alert exactly once, on the check that crosses the threshold.
    if (unreachableCount >= UNREACHABLE_ALERT_THRESHOLD && !previous.unreachableNotificationSent) {
      notifications.push({ kind: 'unreachable' });
    }
    // Disk state is unknown while unreachable; leave its flag untouched rather
    // than claiming recovery we cannot observe.
    return { unreachableCount, notifications };
  }

  if (previous.unreachableNotificationSent) {
    notifications.push({ kind: 'recovered' });
  }

  if (probe.diskUsedPercent !== null) {
    const threshold = previous.diskThresholdPercent;
    if (probe.diskUsedPercent >= threshold && !previous.diskNotificationSent) {
      notifications.push({
        kind: 'disk_high',
        usedPercent: probe.diskUsedPercent,
        threshold,
      });
    } else if (probe.diskUsedPercent < threshold && previous.diskNotificationSent) {
      notifications.push({ kind: 'disk_recovered', usedPercent: probe.diskUsedPercent });
    }
  }

  return { unreachableCount: 0, notifications };
}

/** Human-facing alert text. Deliberately states the server and what to do. */
export function describeNotification(server: ServerRow, notification: HealthNotification): string {
  switch (notification.kind) {
    case 'unreachable':
      return (
        `⚠️ Server "${server.name}" (${server.ip}) is unreachable after ` +
        `${UNREACHABLE_ALERT_THRESHOLD} consecutive checks. Deployments and backups ` +
        `targeting it will fail until it is back.`
      );
    case 'recovered':
      return `✅ Server "${server.name}" (${server.ip}) is reachable again.`;
    case 'disk_high':
      return (
        `⚠️ Server "${server.name}" (${server.ip}) is ${notification.usedPercent}% full ` +
        `(threshold ${notification.threshold}%). Builds and image pulls will start failing — ` +
        `free up space or run a Docker cleanup.`
      );
    case 'disk_recovered':
      return `✅ Disk usage on "${server.name}" is back to ${notification.usedPercent}%.`;
  }
}

/** Every server eligible for monitoring, with its stored state. */
export async function listMonitoredServers(): Promise<MonitoredServer[]> {
  const { rows } = await pool.query(
    `SELECT s.*,
            COALESCE(s.unreachable_count, 0)                      AS unreachable_count,
            COALESCE(s.unreachable_notification_sent, false)       AS unreachable_notification_sent,
            COALESCE(s.high_disk_usage_notification_sent, false)   AS disk_notification_sent,
            COALESCE(ss.server_disk_usage_notification_threshold, $1) AS disk_threshold,
            pk.uuid        AS pk_uuid,
            pk.name        AS pk_name,
            pk.private_key AS pk_private_key,
            pk.team_id     AS pk_team_id
     FROM servers s
     JOIN server_settings ss ON ss.server_id = s.id
     JOIN private_keys pk    ON pk.id = s.private_key_id
     WHERE COALESCE(ss.force_disabled, false) = false`,
    [DEFAULT_DISK_THRESHOLD_PERCENT]
  );

  return rows.map((r) => ({
    server: {
      id: Number(r.id),
      uuid: String(r.uuid),
      name: String(r.name),
      description: (r.description as string) ?? null,
      ip: String(r.ip),
      port: Number(r.port),
      user: String(r.user),
      team_id: Number(r.team_id),
      private_key_id: Number(r.private_key_id),
      proxy: (r.proxy as Record<string, unknown>) ?? null,
    },
    key: {
      id: Number(r.private_key_id),
      uuid: String(r.pk_uuid),
      name: String(r.pk_name),
      description: null,
      private_key: String(r.pk_private_key),
      is_git_related: false,
      team_id: Number(r.pk_team_id),
    },
    unreachableCount: Number(r.unreachable_count),
    unreachableNotificationSent: Boolean(r.unreachable_notification_sent),
    diskNotificationSent: Boolean(r.disk_notification_sent),
    diskThresholdPercent: Number(r.disk_threshold),
  }));
}

/** Persist the outcome of a check, including the notification dedup flags. */
async function persistState(
  monitored: MonitoredServer,
  probe: HealthProbe,
  unreachableCount: number,
  notifications: HealthNotification[]
): Promise<void> {
  const sentUnreachable = notifications.some((n) => n.kind === 'unreachable');
  const recovered = notifications.some((n) => n.kind === 'recovered');
  const sentDiskHigh = notifications.some((n) => n.kind === 'disk_high');
  const diskRecovered = notifications.some((n) => n.kind === 'disk_recovered');

  const unreachableFlag = sentUnreachable
    ? true
    : recovered
      ? false
      : monitored.unreachableNotificationSent;

  const diskFlag = sentDiskHigh ? true : diskRecovered ? false : monitored.diskNotificationSent;

  await pool.query(
    `UPDATE servers
     SET unreachable_count = $2,
         unreachable_notification_sent = $3,
         high_disk_usage_notification_sent = $4,
         updated_at = now()
     WHERE id = $1`,
    [monitored.server.id, unreachableCount, unreachableFlag, diskFlag]
  );

  await pool.query(
    `UPDATE server_settings
     SET is_reachable = $2, updated_at = now()
     WHERE server_id = $1`,
    [monitored.server.id, probe.reachable]
  );
}

/**
 * Check one server: probe, decide, persist, notify.
 *
 * Notification failures are logged but do not fail the check — losing an alert is
 * bad, losing the recorded state as well would be worse.
 */
export async function checkServerHealth(monitored: MonitoredServer): Promise<HealthOutcome> {
  const probe = await probeServer(monitored.server, monitored.key);
  const { unreachableCount, notifications } = decideTransitions(monitored, probe);

  await persistState(monitored, probe, unreachableCount, notifications);

  for (const notification of notifications) {
    const message = describeNotification(monitored.server, notification);
    try {
      await notifyTeam(monitored.server.team_id, message);
    } catch (err) {
      logger.error('Could not deliver a server health notification', {
        serverId: monitored.server.id,
        kind: notification.kind,
        message: (err as Error).message,
      });
    }
  }

  return {
    serverId: monitored.server.id,
    serverName: monitored.server.name,
    reachable: probe.reachable,
    diskUsedPercent: probe.diskUsedPercent,
    unreachableCount,
    notifications,
  };
}

/**
 * Check the whole fleet.
 *
 * Servers are checked concurrently but in bounded batches: an instance with a
 * hundred servers should not open a hundred simultaneous SSH sessions.
 */
export async function checkAllServers(concurrency = 5): Promise<HealthOutcome[]> {
  const monitored = await listMonitoredServers();
  const outcomes: HealthOutcome[] = [];

  for (let i = 0; i < monitored.length; i += concurrency) {
    const batch = monitored.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(checkServerHealth));

    for (const [index, result] of settled.entries()) {
      if (result.status === 'fulfilled') {
        outcomes.push(result.value);
      } else {
        logger.error('Server health check failed', {
          serverId: batch[index].server.id,
          message: (result.reason as Error)?.message,
        });
      }
    }
  }

  return outcomes;
}
