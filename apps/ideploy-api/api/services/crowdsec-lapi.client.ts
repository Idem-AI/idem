/**
 * CrowdSec Local API client.
 *
 * The channel through which a firewall rule becomes an actual block: rules are
 * translated into *decisions* pushed here, and the Traefik bouncer consults this
 * same API on every request.
 *
 * Ports `Services\Security\CrowdSecApiClient`, with one deliberate departure.
 * Every method there swallows its exception and returns `false` / `null` / `[]`,
 * so "the IP was not banned because the API is unreachable" is indistinguishable
 * from "the IP was not banned because the request was rejected" — and both look
 * like an ordinary negative result to the caller. For a security control that is
 * the wrong default: it is the same class of silence that let a firewall report
 * itself deployed while filtering nothing.
 *
 * Here, failures throw typed errors. `health()` is the single exception, because
 * a probe reporting "unreachable" *is* its successful answer.
 */
import axios, { AxiosInstance, isAxiosError } from 'axios';
import logger from '../config/logger';
import { DomainError, unprocessable } from '../utils/errors';

/** CrowdSec records who created a decision; ours are attributed to the platform. */
const ORIGIN = 'ideploy';

/** Scenario recorded for decisions we create from a firewall rule. */
const SCENARIO = 'manual:ban';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface LapiConfig {
  /** Base URL of the CrowdSec Local API, e.g. `http://crowdsec:8080`. */
  baseUrl: string;
  /** Bouncer or machine API key. Never logged. */
  apiKey: string;
  timeoutMs?: number;
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
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
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

export class CrowdSecLapiClient {
  private readonly http: AxiosInstance;

  constructor(config: LapiConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers: {
        'X-Api-Key': config.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      // We interpret every status ourselves, so axios must not throw first.
      validateStatus: () => true,
    });
  }

  /** Throw unless the response is a success, mapping the status to a cause. */
  private assertOk(status: number, action: string): void {
    if (status >= 200 && status < 300) return;
    throw toDomainError({ isAxiosError: true, response: { status } } as never, action);
  }

  // ── Decisions ───────────────────────────────────────

  /** Active decisions, optionally filtered (`ip`, `scope`, `type`, …). */
  async listDecisions(filters: Record<string, string> = {}): Promise<Decision[]> {
    try {
      const response = await this.http.get('/v1/decisions', { params: filters });
      this.assertOk(response.status, 'listing decisions');
      // CrowdSec answers `null`, not `[]`, when nothing matches.
      return (response.data as Decision[] | null) ?? [];
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, 'listing decisions');
    }
  }

  /** Decisions currently applying to one address. */
  async decisionsForIp(ip: string): Promise<Decision[]> {
    return this.listDecisions({ ip });
  }

  /**
   * Ban an address.
   *
   * Throws rather than reporting a boolean: a caller that cannot tell a refusal
   * from an outage will report the address as blocked when it is not.
   */
  async banIp(request: BanRequest): Promise<void> {
    const action = `banning ${request.ip}`;
    try {
      const response = await this.http.post('/v1/decisions', {
        decisions: [
          {
            duration: `${request.durationSeconds}s`,
            origin: ORIGIN,
            scenario: SCENARIO,
            scope: 'ip',
            type: request.type ?? 'ban',
            value: request.ip,
            reason: request.reason ?? 'Blocked by an iDeploy firewall rule',
          },
        ],
      });
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
      const response = await this.http.delete('/v1/decisions', { params: { ip } });
      this.assertOk(response.status, action);
      logger.info('CrowdSec decision deleted', { ip });
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  // ── Alerts ──────────────────────────────────────────

  async listAlerts(options: { limit?: number; offset?: number } = {}): Promise<Alert[]> {
    const action = 'listing alerts';
    try {
      const response = await this.http.get('/v1/alerts', {
        params: { limit: options.limit ?? 100, offset: options.offset ?? 0 },
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
      const response = await this.http.delete(`/v1/alerts/${alertId}`);
      this.assertOk(response.status, action);
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  // ── Bouncers ────────────────────────────────────────

  /**
   * Register a bouncer and return its API key.
   *
   * The key is what the Traefik middleware presents on every request, so it is
   * returned once and stored encrypted — never logged.
   */
  async createBouncer(name: string): Promise<string> {
    const action = `registering the bouncer "${name}"`;
    try {
      const response = await this.http.post('/v1/bouncers', { name });
      this.assertOk(response.status, action);

      const apiKey = (response.data as { api_key?: string } | null)?.api_key;
      if (!apiKey) {
        throw unprocessable(
          'CROWDSEC_NO_BOUNCER_KEY',
          'CrowdSec registered the bouncer but returned no API key, so the proxy cannot authenticate.'
        );
      }
      logger.info('CrowdSec bouncer registered', { name });
      return apiKey;
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  async deleteBouncer(name: string): Promise<void> {
    const action = `removing the bouncer "${name}"`;
    try {
      const response = await this.http.delete(`/v1/bouncers/${encodeURIComponent(name)}`);
      this.assertOk(response.status, action);
    } catch (error) {
      throw error instanceof DomainError ? error : toDomainError(error, action);
    }
  }

  // ── Diagnostics ─────────────────────────────────────

  async metrics(): Promise<Record<string, unknown>> {
    const action = 'reading metrics';
    try {
      const response = await this.http.get('/v1/metrics');
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
      const response = await this.http.get('/v1/decisions', { params: { ip: '127.0.0.1' } });

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
      return {
        reachable: false,
        version: null,
        detail: isAxiosError(error) ? (error.code ?? error.message) : 'Unknown error',
      };
    }
  }
}
