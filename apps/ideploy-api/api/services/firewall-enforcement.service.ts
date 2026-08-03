/**
 * Turning firewall rules into traffic that is actually blocked.
 *
 * This is the module the rest of Phase 4 exists to make possible: it translates
 * saved rules into CrowdSec decisions, registers the bouncer the proxy
 * authenticates with, and reconciles the two so the Local API reflects the rules
 * — including after an outage, a manual change, or a rule being deleted.
 *
 * ## Two layers, and why the difference is visible
 *
 * CrowdSec decisions operate on *addresses*, and the bouncer consults them per
 * request — so an address rule takes effect the moment it is pushed. Countries
 * it cannot do at all: the bouncer has no GeoIP, and the Local API matches
 * decisions by address range, so a country decision would sit there looking
 * applied while every request sailed past. Those are handled by the proxy
 * instead, as Docker labels — which Traefik reads at container start, meaning
 * they do nothing until the application is redeployed.
 *
 * Each rule therefore carries `enforcedBy`, and `enforce()` reports the redeploy
 * when one is needed. Collapsing both into "enforced" would tell an operator
 * they are protected during precisely the window where they are not.
 *
 * A rule matching on a request path, a header or a user agent still cannot be
 * enforced by either: that needs CrowdSec's AppSec component, which is not
 * installed and is disabled outright on the Laravel side
 * (`$shouldEnableAppSec = false`). The rule builder in the existing interface
 * only offers `request_path` conditions, so those rules are classified
 * `unsupported` and reported with the reason rather than silently ignored.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { unprocessable } from '../utils/errors';
import { CrowdSecLapiClient } from './crowdsec-lapi.client';
import * as appService from './application.service';
import { FirewallRule, listRules } from './firewall.service';

/** Condition fields that map onto an address-scoped CrowdSec decision. */
const ADDRESS_FIELDS = new Set(['ip', 'remote_addr', 'source_ip', 'client_ip']);

/**
 * Condition fields that name a country.
 *
 * Routed to the proxy, never to CrowdSec. Pushing a country-scoped decision
 * *succeeds*, which is exactly the trap: the bouncer has no GeoIP and asks the
 * Local API only about the client's address, and the Local API matches decisions
 * by `start_ip`/`end_ip`, which a country decision does not have.
 */
const COUNTRY_FIELDS = new Set(['country', 'country_code', 'geoip_country']);

/**
 * Who applies a rule.
 *
 * Not a detail: the two paths take effect at different moments. A CrowdSec
 * decision applies the instant it is pushed, because the bouncer asks the Local
 * API per request. A proxy rule is a Docker label, and Traefik reads labels when
 * the container starts — so it does nothing until the application is redeployed.
 * Reporting both as simply "enforced" would tell an operator they are protected
 * during the window where they are not.
 */
export type EnforcedBy = 'crowdsec' | 'proxy';

/** Operators we know how to translate. */
const ADDRESS_OPERATORS = new Set(['equals', 'is', 'in', 'in_range']);

/** Origin CrowdSec records for decisions we create — lets us reconcile only ours. */
const DECISION_ORIGIN = 'ideploy';

export interface RuleCondition {
  field?: string;
  operator?: string;
  value?: string | string[];
}

export type Enforceability = 'enforceable' | 'unsupported';

/** What a decision applies to. CrowdSec calls this the decision's scope. */
export type TargetScope = 'ip' | 'country';

export interface DecisionTarget {
  scope: TargetScope;
  value: string;
}

export interface RuleAnalysis {
  ruleId: number;
  name: string;
  enforceability: Enforceability;
  /** What this rule blocks, when it is enforceable. */
  targets: DecisionTarget[];
  /** Which layer applies it — absent when it cannot be applied at all. */
  enforcedBy?: EnforcedBy;
  /** Why it cannot be enforced, in terms the user can act on. */
  reason?: string;
}

/** A stable key for a target, so sets can be compared. */
export function targetKey(target: DecisionTarget): string {
  return `${target.scope}:${target.value}`;
}

function conditionsOf(rule: FirewallRule): RuleCondition[] {
  const raw = rule.conditions;
  if (Array.isArray(raw)) return raw as RuleCondition[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RuleCondition[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Values of a condition, normalised to a list. */
function valuesOf(condition: RuleCondition): string[] {
  if (Array.isArray(condition.value)) return condition.value.map(String).filter(Boolean);
  return condition.value ? [String(condition.value)] : [];
}

/**
 * Decide whether a rule can be enforced, and what it blocks.
 *
 * Pure, so every branch is testable without CrowdSec.
 */
export function analyseRule(rule: FirewallRule): RuleAnalysis {
  const conditions = conditionsOf(rule);
  const unsupported = (reason: string): RuleAnalysis => ({
    ruleId: rule.id,
    name: rule.name,
    enforceability: 'unsupported',
    targets: [],
    reason,
  });

  if (conditions.length === 0) {
    return unsupported('The rule has no conditions, so there is nothing to match on.');
  }

  // `allow` has no decision equivalent: CrowdSec blocks what it is told about
  // and permits everything else, so an allow rule would apply cleanly and
  // change nothing.
  if (rule.action && rule.action !== 'block' && rule.action !== 'ban') {
    return unsupported(`Only blocking rules can be enforced; this one is set to "${rule.action}".`);
  }

  const targets: DecisionTarget[] = [];

  for (const condition of conditions) {
    const field = String(condition.field ?? '');
    const operator = String(condition.operator ?? 'equals');

    const scope: TargetScope | null = ADDRESS_FIELDS.has(field)
      ? 'ip'
      : COUNTRY_FIELDS.has(field)
        ? 'country'
        : null;

    if (scope === null) {
      return unsupported(
        `Matching on ${field || 'an unnamed field'} requires CrowdSec AppSec, which is not ` +
          'installed. Only rules matching an IP address or a range can be enforced today.'
      );
    }
    if (!ADDRESS_OPERATORS.has(operator)) {
      return unsupported(`The operator "${operator}" is not supported for ${scope} rules.`);
    }

    for (const value of valuesOf(condition)) {
      // Country codes are compared upper-case; CrowdSec expects them that way.
      targets.push({ scope, value: scope === 'country' ? value.toUpperCase() : value });
    }
  }

  if (targets.length === 0) {
    return unsupported('The rule names nothing to block.');
  }

  // De-duplicate while preserving order, so the reported list matches the rule.
  const seen = new Set<string>();
  const unique = targets.filter((t) => {
    const key = targetKey(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // A rule may not straddle the two layers: the halves would take effect at
  // different times, and a single rule reporting two states is not a state
  // anyone can act on.
  const scopes = new Set(unique.map((t) => t.scope));
  if (scopes.size > 1) {
    return unsupported(
      'A rule cannot mix addresses and countries: they are applied by different ' +
        'layers and would take effect at different moments. Split it into two rules.'
    );
  }

  return {
    ruleId: rule.id,
    name: rule.name,
    enforceability: 'enforceable',
    targets: unique,
    // Countries are the proxy's job — the CrowdSec bouncer has no GeoIP and the
    // Local API matches decisions by address range, so a country decision would
    // sit there looking applied while every request sailed past.
    enforcedBy: unique[0].scope === 'country' ? 'proxy' : 'crowdsec',
  };
}

export interface EnforcementConfigRow {
  id: number;
  applicationId: number;
  enabled: boolean;
  lapiUrl: string;
  apiKey: string | null;
  bouncerKey: string | null;
  banDurationSeconds: number;
}

async function loadConfig(teamId: number, appUuid: string): Promise<EnforcementConfigRow> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const { rows } = await pool.query(
    `SELECT id, application_id, enabled, crowdsec_lapi_url, crowdsec_api_key,
            crowdsec_bouncer_key, ban_duration
     FROM firewall_configs WHERE application_id = $1 LIMIT 1`,
    [app.id]
  );
  const r = rows[0];
  if (!r) {
    throw unprocessable('FIREWALL_NOT_CONFIGURED', 'This application has no firewall configuration.');
  }

  return {
    id: Number(r.id),
    applicationId: Number(r.application_id),
    enabled: Boolean(r.enabled),
    lapiUrl: String(r.crowdsec_lapi_url ?? process.env.CROWDSEC_LAPI_URL ?? 'http://crowdsec:8080'),
    apiKey: (r.crowdsec_api_key as string) ?? null,
    bouncerKey: (r.crowdsec_bouncer_key as string) ?? null,
    banDurationSeconds: Number(r.ban_duration ?? 3600),
  };
}

/** Client for managing decisions. Requires the management credential. */
function managementClient(config: EnforcementConfigRow): CrowdSecLapiClient {
  if (!config.apiKey) {
    throw unprocessable(
      'CROWDSEC_NOT_CONFIGURED',
      'No CrowdSec API key is configured for this application. Install CrowdSec on the server first.'
    );
  }
  return new CrowdSecLapiClient({ baseUrl: config.lapiUrl, apiKey: config.apiKey });
}

/**
 * Make sure a bouncer credential exists, registering one if needed.
 *
 * Deliberately a *separate* credential from the management key: the bouncer key
 * ends up in a Docker label, readable by anyone who can inspect the container,
 * and a read-only credential there cannot be used to lift bans.
 *
 * @returns the bouncer key, and whether it was just created — a new key means
 * the container's labels change, so it must be redeployed.
 */
export async function ensureBouncer(
  teamId: number,
  appUuid: string
): Promise<{ bouncerKey: string; created: boolean }> {
  const config = await loadConfig(teamId, appUuid);
  if (config.bouncerKey) return { bouncerKey: config.bouncerKey, created: false };

  const client = managementClient(config);
  const bouncerKey = await client.createBouncer(`ideploy-${appUuid}`);

  await pool.query(
    'UPDATE firewall_configs SET crowdsec_bouncer_key = $2, updated_at = now() WHERE id = $1',
    [config.id, bouncerKey]
  );
  logger.info('Registered a CrowdSec bouncer for an application', { appUuid });

  return { bouncerKey, created: true };
}

export interface EnforcementResult {
  /** Blocked immediately — a CrowdSec decision applies the instant it is pushed. */
  blocked: DecisionTarget[];
  /** No longer blocked, because their rule went away. */
  released: DecisionTarget[];
  /**
   * Enforceable, but only take effect once the application is redeployed —
   * Traefik reads country-blocking labels at container start, not on the fly.
   */
  pendingRedeploy: DecisionTarget[];
  /** Rules that could not be translated, with the reason. */
  unsupported: RuleAnalysis[];
  /** True when the container must be redeployed for something above to take effect. */
  redeployRequired: boolean;
  reason?: string;
}

/**
 * Reconcile the Local API's decisions with the application's rules.
 *
 * Reconciliation rather than "apply the new ones": decisions expire, CrowdSec
 * can be restarted, someone can ban an address by hand. Computing the difference
 * each time makes the operation idempotent and self-healing, where appending
 * would drift from the rules it is supposed to represent.
 *
 * Only decisions we created (`origin = ideploy`) are touched — removing
 * CrowdSec's own detections would undo the protection it provides on its own.
 *
 * Country rules are not reconciled here at all: they carry no CrowdSec decision
 * to push. `buildApplicationLabels` reads them straight from the rule the next
 * time the application deploys, so they only ever show up below as
 * `pendingRedeploy` — the honest answer for something that is saved but not yet
 * in force.
 */
export async function enforce(teamId: number, appUuid: string): Promise<EnforcementResult> {
  const config = await loadConfig(teamId, appUuid);
  const rules = await listRules(teamId, appUuid);
  const analyses = rules.filter((r) => r.enabled).map(analyseRule);
  const unsupported = analyses.filter((a) => a.enforceability === 'unsupported');
  const enforceable = analyses.filter((a) => a.enforceability === 'enforceable');
  const proxyTargets = enforceable.filter((a) => a.enforcedBy === 'proxy').flatMap((a) => a.targets);

  if (!config.enabled) {
    // Disabling the firewall must actually release the addresses, not merely
    // stop adding new ones. The proxy's own labels still need a redeploy to drop.
    const released = await releaseAll(config);
    return {
      blocked: [],
      released,
      pendingRedeploy: [],
      unsupported,
      redeployRequired: proxyTargets.length > 0,
      reason: 'The firewall is turned off for this application.',
    };
  }

  const { created } = await ensureBouncer(teamId, appUuid);
  const client = managementClient(config);

  const crowdsecTargets = enforceable.filter((a) => a.enforcedBy === 'crowdsec').flatMap((a) => a.targets);
  const desiredKeys = new Set(crowdsecTargets.map(targetKey));

  const current = await ourDecisions(client);
  const currentKeys = new Set(current.map(targetKey));

  const toBlock = crowdsecTargets.filter((t) => !currentKeys.has(targetKey(t)));
  const toRelease = current.filter((t) => !desiredKeys.has(targetKey(t)));

  for (const target of toBlock) {
    await client.banIp({
      ip: target.value,
      durationSeconds: config.banDurationSeconds,
      reason: `Blocked by an iDeploy firewall rule (${appUuid})`,
    });
  }
  for (const target of toRelease) {
    await client.unbanIp(target.value);
  }

  logger.info('Firewall rules reconciled', {
    appUuid,
    blocked: toBlock.length,
    released: toRelease.length,
    pendingRedeploy: proxyTargets.length,
    unsupported: unsupported.length,
  });

  const reasons = [
    created && 'a bouncer was just registered, so the proxy must be redeployed to start consulting it',
    proxyTargets.length > 0 &&
      `${proxyTargets.length} rule(s) block by country, which only takes effect at the next deploy`,
  ].filter((r): r is string => Boolean(r));

  return {
    blocked: crowdsecTargets,
    released: toRelease,
    pendingRedeploy: proxyTargets,
    unsupported,
    redeployRequired: reasons.length > 0,
    reason: reasons.length > 0 ? `${reasons.join('; ')}.` : undefined,
  };
}

/** Addresses currently blocked by decisions we created. */
async function ourDecisions(client: CrowdSecLapiClient): Promise<DecisionTarget[]> {
  const decisions = await client.listDecisions({ origin: DECISION_ORIGIN });
  return decisions.filter((d) => d.scope === 'ip').map((d) => ({ scope: 'ip', value: d.value }));
}

/** Lift every decision we created for this application. */
async function releaseAll(config: EnforcementConfigRow): Promise<DecisionTarget[]> {
  if (!config.apiKey) return [];
  const client = managementClient(config);
  const targets = await ourDecisions(client);
  for (const target of targets) {
    await client.unbanIp(target.value);
  }
  return targets;
}

export interface LiveEnforcementStatus {
  state: 'enforced' | 'partially_enforced' | 'not_enforced';
  reason: string;
  rulesConfigured: number;
  /** Address-scoped rules being filtered by CrowdSec right now. */
  rulesEnforced: number;
  /**
   * Country-scoped rules that are configured correctly but only take effect once
   * the application is redeployed — this endpoint has no way to check what a
   * running container's labels actually are, so it never claims more than that.
   */
  rulesPendingRedeploy: number;
  unsupported: RuleAnalysis[];
  /** Whether the proxy is actually configured to consult CrowdSec. */
  bouncerRegistered: boolean;
  /** Whether the Local API answers. */
  lapiReachable: boolean;
}

/**
 * What is actually in force right now.
 *
 * Reads the live state rather than inferring it from the database: a rule row
 * proves someone's intent, not that traffic is filtered. The two enforcement
 * layers are judged independently — a CrowdSec outage must not hide that a
 * country rule is configured and will apply at the next deploy, and a healthy
 * CrowdSec must not be reported as protecting against a country a rule names.
 */
export async function getLiveStatus(
  teamId: number,
  appUuid: string
): Promise<LiveEnforcementStatus> {
  const config = await loadConfig(teamId, appUuid);
  const rules = await listRules(teamId, appUuid);
  const enabled = rules.filter((r) => r.enabled);
  const analyses = enabled.map(analyseRule);
  const unsupported = analyses.filter((a) => a.enforceability === 'unsupported');
  const enforceable = analyses.filter((a) => a.enforceability === 'enforceable');
  const crowdsecRules = enforceable.filter((a) => a.enforcedBy === 'crowdsec');
  const proxyRules = enforceable.filter((a) => a.enforcedBy === 'proxy');

  const bouncerRegistered = Boolean(config.bouncerKey);
  const lapiReachable = config.apiKey
    ? (await new CrowdSecLapiClient({ baseUrl: config.lapiUrl, apiKey: config.apiKey }).health())
        .reachable
    : false;

  const of = (
    state: LiveEnforcementStatus['state'],
    reason: string,
    rulesEnforced: number,
    rulesPendingRedeploy: number
  ): LiveEnforcementStatus => ({
    state,
    reason,
    rulesConfigured: rules.length,
    rulesEnforced,
    rulesPendingRedeploy,
    unsupported,
    bouncerRegistered,
    lapiReachable,
  });

  if (!config.enabled) {
    return of('not_enforced', 'The firewall is turned off for this application.', 0, 0);
  }

  const crowdsecReady = lapiReachable && bouncerRegistered;
  const rulesEnforced = crowdsecReady ? crowdsecRules.length : 0;
  const rulesPendingRedeploy = proxyRules.length;

  if (crowdsecRules.length > 0 && !crowdsecReady) {
    const why = !lapiReachable
      ? 'CrowdSec is not reachable, so no decision can be consulted'
      : 'no bouncer is registered, so the proxy is not consulting CrowdSec';
    const reason =
      `${why}: ${crowdsecRules.length} address-scoped rule(s) are not being filtered` +
      (rulesPendingRedeploy > 0
        ? `. ${rulesPendingRedeploy} country rule(s) are configured and will apply at the next deploy.`
        : '.');
    return of(
      rulesPendingRedeploy > 0 ? 'partially_enforced' : 'not_enforced',
      reason,
      rulesEnforced,
      rulesPendingRedeploy
    );
  }

  if (rulesEnforced === 0 && rulesPendingRedeploy === 0) {
    return of(
      'not_enforced',
      unsupported.length > 0
        ? 'None of the configured rules can be enforced — see the details on each.'
        : 'No rule is configured.',
      0,
      0
    );
  }

  const fullyEnforced = unsupported.length === 0 && rulesPendingRedeploy === 0;
  const reason = [
    rulesEnforced > 0 && `${rulesEnforced} rule(s) are being filtered now`,
    rulesPendingRedeploy > 0 &&
      `${rulesPendingRedeploy} country rule(s) will apply at the next deploy`,
    unsupported.length > 0 && `${unsupported.length} rule(s) cannot be enforced — see the details on each`,
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');

  return of(
    fullyEnforced ? 'enforced' : 'partially_enforced',
    `${reason}.`,
    rulesEnforced,
    rulesPendingRedeploy
  );
}
