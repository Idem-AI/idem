/**
 * What reaches each application, from the proxy's own access log.
 *
 * Traefik writes one JSON line per request (proxy.service.ts). Every minute
 * iDeploy reads what was appended on each server since the last read — a byte
 * offset kept in Redis — and turns it into:
 *   - per-application, per-minute counts of allowed and blocked requests
 *     (`firewall_traffic_stats`): the firewall's chart and counters;
 *   - the detail of blocked requests (`firewall_traffic_logs`).
 *
 * A request is "blocked" when the proxy answered it itself, without reaching
 * the application: a 403 from the CrowdSec bouncer or geo-blocking, a 429
 * from rate limiting. An application's own 403 reached the application
 * (`OriginStatus` set) and is not the firewall's doing.
 *
 * The legacy platform put a logging container in front of every request
 * (forwardAuth): a hop on every call and a point of failure. Reading the log
 * the proxy writes anyway costs the applications nothing.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import redis from '../config/redis.config';
import { executeRemoteCommand } from '../ssh/ssh';
import { listMonitoredServers } from './server-health.service';
import { PrivateKeyRow, ServerRow } from '../models/ideploy.types';
import { proxyPath } from '../utils/paths';

/** Most read per server and per pass; the rest is read on the next pass. */
const MAX_READ_BYTES = 4_000_000;
/** The log is rotated past this size (Traefik reopens it on USR1). */
const ROTATE_AT_BYTES = 50_000_000;
/** On a first read, only the recent end of an existing log is taken. */
const FIRST_READ_BYTES = 1_000_000;
/** Blocked requests kept in detail per pass; counts are always complete. */
const MAX_BLOCKED_ROWS = 500;

export interface AccessLogEntry {
  applicationUuid: string;
  at: Date;
  status: number;
  blocked: boolean;
  reason: 'firewall' | 'rate-limit' | null;
  clientIp: string;
  method: string;
  path: string;
  host: string;
}

/** Application routers are named `<entrypoint>-<n>-<uuid>@docker` (docker/labels.ts). */
const ROUTER = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@docker$/i;

/** One access-log line, or null when it is not an application request worth counting. */
export function parseAccessLogLine(line: string): AccessLogEntry | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  const router = String(raw.RouterName ?? '');
  const uuid = ROUTER.exec(router)?.[1];
  if (!uuid) return null;

  const status = Number(raw.DownstreamStatus ?? 0);
  // The http → https redirect is not a request to the application.
  if (router.startsWith('http-') && status >= 300 && status < 400) return null;

  const reachedApplication = Number(raw.OriginStatus ?? 0) > 0;
  const blocked = !reachedApplication && (status === 403 || status === 429);
  return {
    applicationUuid: uuid.toLowerCase(),
    at: new Date(String(raw.StartUTC ?? raw.time ?? new Date().toISOString())),
    status,
    blocked,
    reason: blocked ? (status === 429 ? 'rate-limit' : 'firewall') : null,
    clientIp: String(raw.ClientHost ?? ''),
    method: String(raw.RequestMethod ?? ''),
    path: String(raw.RequestPath ?? ''),
    host: String(raw.RequestHost ?? ''),
  };
}

export interface MinuteCount {
  applicationUuid: string;
  bucket: string;
  allowed: number;
  blocked: number;
}

/** Per application and per minute. */
export function countByMinute(entries: AccessLogEntry[]): MinuteCount[] {
  const counts = new Map<string, MinuteCount>();
  for (const e of entries) {
    if (Number.isNaN(e.at.getTime())) continue;
    const minute = new Date(e.at);
    minute.setUTCSeconds(0, 0);
    const bucket = minute.toISOString();
    const key = `${e.applicationUuid}|${bucket}`;
    const current = counts.get(key) ?? { applicationUuid: e.applicationUuid, bucket, allowed: 0, blocked: 0 };
    if (e.blocked) current.blocked += 1;
    else current.allowed += 1;
    counts.set(key, current);
  }
  return [...counts.values()];
}

const offsetKey = (serverId: number) => `ideploy:traffic-offset:${serverId}`;

export interface IngestResult {
  requests: number;
  blocked: number;
}

/** Read what the server's proxy logged since the last pass, and store it. */
export async function ingestServer(server: ServerRow, key: PrivateKeyRow): Promise<IngestResult> {
  const serverId = server.id;

  const file = `${proxyPath()}/logs/access.log`;
  const stored = await redis.get(offsetKey(serverId));
  const sizeResult = await executeRemoteCommand(server, key, `stat -c %s ${file} 2>/dev/null || echo 0`, { noRetry: true });
  const size = Number(sizeResult.stdout.trim()) || 0;
  let offset = stored === null ? Math.max(size - FIRST_READ_BYTES, 0) : Number(stored);
  if (offset > size) offset = 0; // rotated since the last read

  let entries: AccessLogEntry[] = [];
  let readUpTo = offset;
  if (size > offset) {
    const r = await executeRemoteCommand(
      server,
      key,
      `tail -c +${offset + 1} ${file} | head -c ${MAX_READ_BYTES}`,
      { noRetry: true }
    );
    const text = r.stdout;
    // Only whole lines: a line still being written is read next time.
    const complete = text.slice(0, text.lastIndexOf('\n') + 1);
    readUpTo = offset + Buffer.byteLength(complete, 'utf8');
    entries = complete
      .split('\n')
      .map(parseAccessLogLine)
      .filter((e): e is AccessLogEntry => e !== null);
  }

  // Rotate once everything was read, so the file never grows without bound.
  if (readUpTo >= size && size > ROTATE_AT_BYTES) {
    await executeRemoteCommand(
      server,
      key,
      `mv ${file} ${file}.1 && docker kill -s USR1 ideploy-proxy >/dev/null 2>&1; true`,
      { noRetry: true }
    );
    readUpTo = 0;
  }
  await redis.set(offsetKey(serverId), String(readUpTo));

  if (entries.length === 0) return { requests: 0, blocked: 0 };
  await store(entries);
  const blocked = entries.filter((e) => e.blocked).length;
  return { requests: entries.length, blocked };
}

async function store(entries: AccessLogEntry[]): Promise<void> {
  const uuids = [...new Set(entries.map((e) => e.applicationUuid))];
  const { rows } = await pool.query<{ id: string; uuid: string }>(
    'SELECT id, lower(uuid) AS uuid FROM applications WHERE lower(uuid) = ANY($1)',
    [uuids]
  );
  const idOf = new Map(rows.map((r) => [r.uuid, Number(r.id)]));

  for (const c of countByMinute(entries)) {
    const id = idOf.get(c.applicationUuid);
    if (!id) continue;
    await pool.query(
      `INSERT INTO firewall_traffic_stats (application_id, bucket, allowed, blocked)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (application_id, bucket)
       DO UPDATE SET allowed = firewall_traffic_stats.allowed + EXCLUDED.allowed,
                     blocked = firewall_traffic_stats.blocked + EXCLUDED.blocked`,
      [id, c.bucket, c.allowed, c.blocked]
    );
  }

  const blocked = entries.filter((e) => e.blocked && idOf.has(e.applicationUuid)).slice(-MAX_BLOCKED_ROWS);
  for (const e of blocked) {
    await pool.query(
      `INSERT INTO firewall_traffic_logs (application_id, ip_address, method, uri, host, decision, rule_name, "timestamp")
       VALUES ($1, $2::inet, $3, $4, $5, 'blocked', $6, $7)`,
      [idOf.get(e.applicationUuid), e.clientIp, e.method.slice(0, 10), e.path, e.host.slice(0, 255), e.reason, e.at]
    ).catch((err: Error) => logger.warn('Traffic row skipped', { message: err.message }));
  }
}

/** Monitored servers hosting at least one application: those whose proxy has traffic to read. */
export async function listServersToIngest(): Promise<{ server: ServerRow; key: PrivateKeyRow }[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT DISTINCT sd.server_id AS id
     FROM applications a
     JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
     WHERE a.deleted_at IS NULL`
  );
  const hosting = new Set(rows.map((r) => Number(r.id)));
  return (await listMonitoredServers())
    .filter((m) => hosting.has(m.server.id))
    .map((m) => ({ server: m.server, key: m.key }));
}

/** One pass over every server; one unreachable server does not stop the others. */
export async function ingestAll(): Promise<IngestResult> {
  const total: IngestResult = { requests: 0, blocked: 0 };
  for (const { server, key } of await listServersToIngest()) {
    try {
      const r = await ingestServer(server, key);
      total.requests += r.requests;
      total.blocked += r.blocked;
    } catch (err) {
      logger.warn('Traffic ingestion failed', { serverId: server.id, message: (err as Error).message });
    }
  }
  return total;
}

export interface TrafficStats {
  buckets: { at: string; allowed: number; blocked: number }[];
  totals: { requests: number; blocked: number };
}

/**
 * An application's traffic over the last `hours`, in buckets sized for a
 * chart: 5 minutes over a day or less, an hour beyond.
 */
export async function trafficStats(applicationId: number, hours = 24): Promise<TrafficStats> {
  const span = Math.min(Math.max(hours, 1), 24 * 30);
  const bucketMinutes = span <= 24 ? 5 : 60;
  const { rows } = await pool.query<{ at: Date; allowed: string; blocked: string }>(
    `SELECT to_timestamp(floor(extract(epoch FROM bucket) / ($3 * 60)) * ($3 * 60)) AS at,
            sum(allowed)::text AS allowed, sum(blocked)::text AS blocked
     FROM firewall_traffic_stats
     WHERE application_id = $1 AND bucket >= now() - ($2 || ' hours')::interval
     GROUP BY 1 ORDER BY 1`,
    [applicationId, String(span), bucketMinutes]
  );
  const buckets = rows.map((r) => ({
    at: new Date(r.at).toISOString(),
    allowed: Number(r.allowed),
    blocked: Number(r.blocked),
  }));
  const blocked = buckets.reduce((sum, b) => sum + b.blocked, 0);
  const requests = buckets.reduce((sum, b) => sum + b.allowed + b.blocked, 0);
  return { buckets, totals: { requests, blocked } };
}
