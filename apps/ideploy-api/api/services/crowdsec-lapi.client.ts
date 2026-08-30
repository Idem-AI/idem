/**
 * CrowdSec Local API client.
 *
 * The channel through which a firewall rule becomes an actual block: rules are
 * translated into *decisions* pushed here, and the Traefik bouncer consults this
 * same API on every request.
 *
 * ## The API this is actually written against
 *
 * An earlier version of this client assumed one static `X-Api-Key` worked for
 * everything — reads, bans, and registering bouncers. Verified against a real
 * CrowdSec instance (v1.7.8), none of that holds:
 *
 * - A bouncer key (`X-Api-Key`) is read-only: `GET /v1/decisions` succeeds,
 *   `POST /v1/decisions` answers 405, `DELETE /v1/decisions` answers 401.
 * - Creating a ban is not `POST /v1/decisions` at all — that route only
 *   supports GET. The write path is `POST /v1/alerts`, whose `decisions[]`
 *   is what actually creates the ban CrowdSec then reports back under
 *   `/v1/decisions`.
 * - Writes need a *machine* identity, authenticated by exchanging
 *   `machine_id`/`password` at `POST /v1/watchers/login` for a short-lived
 *   JWT — not a static key.
 * - `POST /v1/bouncers` and `DELETE /v1/bouncers/*` do not exist over HTTP
 *   under either auth scheme (404 both ways): registering a bouncer is a
 *   `cscli` operation, run on the machine CrowdSec itself lives on. This
 *   client no longer offers `createBouncer`/`deleteBouncer` for that reason —
 *   see `proxy.service.ts`'s `ensureCrowdSecCredentials`, which runs `cscli
 *   bouncers add` over SSH during proxy provisioning instead.
 *
 * So this client speaks two credentials, for two different roles: a bouncer
 * key for the reads any caller may make, and a machine login for anything
 * that changes state. Every write method requires the latter and throws
 * `CROWDSEC_NO_MACHINE_CREDENTIALS` up front, rather than attempting a call
 * doomed to a confusing 401, if it was not supplied.
 *
 * Failures throw typed errors — "the ban was refused" must never look like
 * "the ban never arrived" to a caller. `health()` is the one exception,
 * because a probe reporting "unreachable" *is* its successful answer.
 */
import axios, {
  AxiosInstance,
  isAxiosError,
  type AddressFamily,
  type AxiosRequestConfig,
  type LookupAddress,
} from 'axios';
import { Agent as HttpsAgent } from 'node:https';
import logger from '../config/logger';
import { DomainError, unprocessable } from '../utils/errors';

/**
 * One keep-alive agent shared by every client this process creates.
 *
 * Reconciliation (`enforce()`) can call this client dozens or hundreds of
 * times in a row — verified live: a backlog of 376 stale decisions took over
 * two minutes to release with a fresh connection per call, each paying its
 * own TCP+TLS handshake to a public HTTPS endpoint. A shared keep-alive agent
 * reuses the socket across calls instead.
 */
const keepAliveAgent = new HttpsAgent({ keepAlive: true, maxSockets: 16 });

/** CrowdSec records who created a decision; ours are attributed to the platform. */
const ORIGIN = 'ideploy';

/** Scenario recorded for decisions we create from a firewall rule. */
const SCENARIO = 'manual:ban';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Refresh the machine token this long before it actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 30_000;
/** CrowdSec's own JWT lifetime is longer than this; used only if a response carries none decodable. */
const DEFAULT_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

export interface LapiConfig {
  /** Base URL of the CrowdSec Local API, e.g. `https://crowdsec-admin.1.2.3.4.sslip.io`. */
  baseUrl: string;
  /** Read-only credential — enough for `listDecisions`/`decisionsForIp`/`health`. */
  bouncerKey?: string;
  /** Required for every write (ban, unban, alerts, bouncer bookkeeping reads). */
  machineId?: string;
  machinePassword?: string;
  timeoutMs?: number;
  /**
   * The target server's own IP, when known.
   *
   * `baseUrl`'s host is an sslip.io-style hostname that only ever encodes this
   * same IP (see `proxy.service.ts`'s `crowdsecAdminHost`) — it exists so
   * Traefik can route the request and present a certificate, not because the
   * address is actually looked up anywhere. Some resolvers (corporate/cloud
   * DNS filters that blocklist wildcard-IP domains such as sslip.io/nip.io)
   * refuse to resolve it at all, which — verified against this exact failure
   * mode: `getent`/`nslookup` timing out on the sslip.io host while any other
   * public domain resolved fine from the very same network — would make
   * every health check, ban and unban fail with `CROWDSEC_UNREACHABLE` even
   * though the server is completely healthy. When the IP is supplied, the
   * lookup is skipped and the connection goes straight to it; the hostname is
   * still sent as the `Host` header and TLS SNI (axios/Node only change the
   * connection target, not those), so Traefik routing and certificate
   * validation are unaffected.
   */
  serverIp?: string;
}

export interface Decision {
  id?: number;
  /** `ban`, `captcha`, … */
  type: string;
  /** The banned value — an IP or a range, per `scope`. */
  value: string;
  scope: string;
  duration: string;
  origin: string;
  scenario?: string;
}

export interface Alert {
  id: number;
  scenario?: string;
  source?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface LapiHealth {
  reachable: boolean;
  version: string | null;
  /** Why it is unreachable, when it is. */
  detail?: string;
}

export interface BanRequest {
  ip: string;
  /** How long the ban lasts. */
  durationSeconds: number;
  reason?: string;
  /** Remediation the bouncer applies. `ban` blocks outright. */
  type?: 'ban' | 'captcha';
}

/**
 * Turn a transport failure into an error that says what to do about it.
 *
 * The distinctions matter operationally: a refused connection means CrowdSec is
 * not running, a 403 means the key is wrong, and they need different fixes.
 */
function toDomainError(error: unknown, action: string): DomainError {
  if (isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return unprocessable(
        'CROWDSEC_UNAUTHORIZED',
        `CrowdSec rejected our credentials while ${action}. The API key is wrong or has been revoked.`
      );
    }
    if (status !== undefined) {
      return unprocessable(
        'CROWDSEC_REQUEST_FAILED',
        `CrowdSec answered ${status} while ${action}.`
      );
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      // EAI_AGAIN is a DNS lookup that failed to get an answer in time — a
      // transient resolver hiccup, not a permanent "no such host". CrowdSec
      // being unreachable is still the right classification for a caller
      // deciding what to do about it (retry, check the server), and it must
      // not fall through to the generic message below just because the
      // symptom this time was a slow resolver rather than a refused socket.
      return unprocessable(
        'CROWDSEC_UNREACHABLE',
        `Could not reach CrowdSec while ${action}. Check that it is installed and running on the server.`
      );
    }
    if (error.code === 'ECONNABORTED') {
      return unprocessable('CROWDSEC_TIMEOUT', `CrowdSec did not answer in time while ${action}.`);
    }
  }

  return unprocessable('CROWDSEC_REQUEST_FAILED', `Something went wrong while ${action}.`);
}

/** ISO-8601 an offset from now — CrowdSec wants both ends of an alert's window. */
function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export class CrowdSecLapiClient {
  private readonly http: AxiosInstance;
  private readonly bouncerKey?: string;
  private readonly machineId?: string;
  private readonly machinePassword?: string;

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: LapiConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      // We interpret every status ourselves, so axios must not throw first.
      validateStatus: () => true,
      httpsAgent: keepAliveAgent,
      ...(config.serverIp ? { lookup: directLookup(config.serverIp) } : {}),
    });
    // Because `validateStatus` above never rejects on a status code, the only
    // way this instance's requests ever reject is a transport failure — no
    // response came back at all. Verified live: reusing a pooled keep-alive
    // socket right as the server (or an intermediate proxy) closed its end of
    // an idle connection failed one call with no response, mid-reconciliation,
    // for exactly that reason. Retrying once, on a fresh connection, is safe
    // for every method this client exposes — GETs are idempotent by nature,
    // and the writes (`banIp`/`unbanIp`) never got far enough to have a
    // side effect the first time; nothing here is retried after a real
    // response, only after none arrived.
    this.http.interceptors.response.use(undefined, (error: unknown) => {
      const cfg = isAxiosError(error) ? (error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined) : undefined;
      if (cfg && !cfg._retried && isAxiosError(error) && !error.response) {
        cfg._retried = true;
        return this.http.request(cfg);
      }
      return Promise.reject(error);
    });
    this.bouncerKey = config.bouncerKey;
    this.machineId = config.machineId;
    this.machinePassword = config.machinePassword;
  }

  /** Throw unless the response is a success, mapping the status to a cause. */
  private assertOk(status: number, action: string): void {
    if (status >= 200 && status < 300) return;
    throw toDomainError({ isAxiosError: true, response: { status } } as never, action);
  }

  /** Log in as the machine, caching the JWT until just before it expires. */
  private async machineToken(): Promise<string> {
    if (!this.machineId || !this.machinePassword) {
      throw unprocessable(
        'CROWDSEC_NO_MACHINE_CREDENTIALS',
        'This action changes CrowdSec state and needs machine credentials, which were not supplied.'
      );
    }
    if (this.token && Date.now() < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) return this.token;

    const action = 'logging in to CrowdSec as the platform machine';
    try {
      const response = await this.http.post('/v1/watchers/login', {
        machine_id: this.machineId,
        password: this.machinePassword,
      });
      this.assertOk(response.status, action);
      const token = (response.data as { token?: string } | null)?.token;
      if (!token) throw unprocessable('CROWDSEC_LOGIN_FAILED', 'CrowdSec accepted the login but returned no token.');
      this.token = token;
      this.tokenExpiresAt = Date.now() + decodeJwtTtlMs(token, DEFAULT_TOKEN_TTL_MS);
      return token;
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  private async machineHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.machineToken()}` };
  }

  /** Read-only header set — the bouncer key when there is one, else a machine login. */
  private async readHeaders(): Promise<Record<string, string>> {
    if (this.bouncerKey) return { 'X-Api-Key': this.bouncerKey };
    return this.machineHeaders();
  }

  // ── Decisions (read: bouncer key or machine; write: machine only) ─────

  /** Active decisions, optionally filtered (`ip`, `scope`, `type`, …). */
  async listDecisions(filters: Record<string, string> = {}): Promise<Decision[]> {
    const action = 'listing decisions';
    try {
      const response = await this.http.get('/v1/decisions', {
        params: filters,
        headers: await this.readHeaders(),
      });
      this.assertOk(response.status, action);
      // CrowdSec answers `null`, not `[]`, when nothing matches.
      return (response.data as Decision[] | null) ?? [];
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  /** Decisions currently applying to one address. */
  async decisionsForIp(ip: string): Promise<Decision[]> {
    return this.listDecisions({ ip });
  }

  /**
   * Ban an address.
   *
   * `POST /v1/alerts` — not `/v1/decisions`, which is read-only — with the
   * ban riding in the alert's `decisions[]`. CrowdSec creates the alert and
   * applies the decision atomically; the alert itself is what `listAlerts`/
   * the security dashboard later shows as the record of *why*.
   *
   * Throws rather than reporting a boolean: a caller that cannot tell a
   * refusal from an outage will report the address as blocked when it is not.
   */
  async banIp(request: BanRequest): Promise<void> {
    const action = `banning ${request.ip}`;
    const durationSeconds = request.durationSeconds;
    try {
      const response = await this.http.post(
        '/v1/alerts',
        [
          {
            scenario: SCENARIO,
            scenario_hash: '',
            scenario_version: '',
            message: request.reason ?? 'Blocked by an iDeploy firewall rule',
            events: [],
            events_count: 1,
            source: { scope: 'ip', value: request.ip },
            start_at: isoIn(0),
            stop_at: isoIn(durationSeconds * 1000),
            capacity: 0,
            leakspeed: '',
            labels: null,
            simulated: false,
            decisions: [
              {
                duration: `${durationSeconds}s`,
                origin: ORIGIN,
                scenario: SCENARIO,
                scope: 'ip',
                type: request.type ?? 'ban',
                value: request.ip,
              },
            ],
          },
        ],
        { headers: await this.machineHeaders() }
      );
      this.assertOk(response.status, action);
      logger.info('CrowdSec decision created', { ip: request.ip, type: request.type ?? 'ban' });
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  /** Lift the ban on an address. Succeeds when there was nothing to lift. */
  async unbanIp(ip: string): Promise<void> {
    const action = `unbanning ${ip}`;
    try {
      const response = await this.http.delete('/v1/decisions', {
        params: { ip },
        headers: await this.machineHeaders(),
      });
      this.assertOk(response.status, action);
      logger.info('CrowdSec decision deleted', { ip });
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  // ── Alerts (machine only — this is where a ban's own record lives) ────

  async listAlerts(options: { limit?: number; offset?: number } = {}): Promise<Alert[]> {
    const action = 'listing alerts';
    try {
      const response = await this.http.get('/v1/alerts', {
        params: { limit: options.limit ?? 100, offset: options.offset ?? 0 },
        headers: await this.machineHeaders(),
      });
      this.assertOk(response.status, action);
      return (response.data as Alert[] | null) ?? [];
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  async deleteAlert(alertId: number): Promise<void> {
    const action = `deleting alert ${alertId}`;
    try {
      const response = await this.http.delete(`/v1/alerts/${alertId}`, {
        headers: await this.machineHeaders(),
      });
      this.assertOk(response.status, action);
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  // ── Diagnostics ─────────────────────────────────────

  async metrics(): Promise<Record<string, unknown>> {
    const action = 'reading metrics';
    try {
      const response = await this.http.get('/v1/metrics', { headers: await this.readHeaders() });
      this.assertOk(response.status, action);
      return (response.data as Record<string, unknown> | null) ?? {};
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  /**
   * Probe the API.
   *
   * The one method that does not throw: "unreachable" is the answer it exists to
   * give, and a caller checking health should not need a try/catch to hear it.
   */
  async health(): Promise<LapiHealth> {
    try {
      const headers = await this.readHeaders();
      const response = await this.http.get('/v1/decisions', { params: { ip: '127.0.0.1' }, headers });

      if (response.status === 401 || response.status === 403) {
        return { reachable: true, version: null, detail: 'The API key was rejected.' };
      }
      if (response.status >= 400) {
        return { reachable: true, version: null, detail: `CrowdSec answered ${response.status}.` };
      }

      // The version header is informational; its absence is not a failure.
      const version = (response.headers?.['x-crowdsec-version'] as string | undefined) ?? null;
      return { reachable: true, version };
    } catch (error) {
      if (error instanceof DomainError) {
        // No credentials at all still means "we could not check" here, not a
        // transport failure — but it should not masquerade as reachable.
        return { reachable: false, version: null, detail: error.message };
      }
      return {
        reachable: false,
        version: null,
        detail: isAxiosError(error) ? (error.code ?? error.message) : 'Unknown error',
      };
    }
  }
}

/**
 * A `dns.lookup`-compatible function that always answers with `ip`, never
 * touching an actual resolver. See `LapiConfig.serverIp` for why this exists.
 */
function directLookup(
  ip: string
): (
  hostname: string,
  options: object,
  cb: (err: Error | null, address: LookupAddress | LookupAddress[], family?: AddressFamily) => void
) => void {
  const family: AddressFamily = ip.includes(':') ? 6 : 4;
  return (_hostname, options, cb) => {
    const all = typeof options === 'object' && options !== null && (options as { all?: boolean }).all;
    if (all) {
      cb(null, [{ address: ip, family }]);
    } else {
      cb(null, ip, family);
    }
  };
}

/** Best-effort read of a JWT's own `exp` claim; falls back to `fallbackMs` if it cannot be read. */
function decodeJwtTtlMs(token: string, fallbackMs: number): number {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    if (!exp) return fallbackMs;
    return Math.max(exp * 1000 - Date.now(), 0);
  } catch {
    return fallbackMs;
  }
}
