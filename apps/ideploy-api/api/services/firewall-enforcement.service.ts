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

/**
 * How many ban/unban calls to CrowdSec run at once during reconciliation.
 *
 * Reconciliation replays the *entire* difference on every call, including
 * decisions left over from before — verified live: a backlog of 376 stale
 * decisions, released one at a time with `await` in a `for` loop, took over
 * two minutes and was still running when it was killed. That is long enough
 * to blow through any reasonable HTTP timeout on the request that triggered
 * it, which would make a firewall that did eventually apply look like one
 * that had failed. A small bounded concurrency keeps a large backlog from
 * being a multi-minute request while not hammering CrowdSec's Local API with
 * hundreds of simultaneous connections.
 */
const RECONCILE_CONCURRENCY = 8;

/** Run `fn` over `items`, at most `RECONCILE_CONCURRENCY` in flight at once. */
async function runBounded<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(RECONCILE_CONCURRENCY, items.length) }, worker));
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
  banDurationSeconds: number;
  /** null when the application has no server/destination resolved yet. */
  serverId: number | null;
  /** null when this application's server has no CrowdSec provisioned yet. */
  crowdsec: { lapiUrl: string; machinePassword: string; bouncerKey: string | null; serverIp: string } | null;
}

/**
 * CrowdSec is provisioned once per *server* (`proxy.service.ts`, alongside
 * Traefik), not per application: its decisions are address-scoped and the one
 * bouncer identity it registers is shared by every application on that server
 * whose labels attach the bouncer middleware. `firewall_configs` still holds
 * what genuinely is per-application — whether the firewall is on, the ban
 * duration, the saved rules — so this stitches the two together rather than
 * pretending an application has its own CrowdSec.
 */
async function loadConfig(teamId: number, appUuid: string): Promise<EnforcementConfigRow> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const { rows } = await pool.query(
    `SELECT id, application_id, enabled, ban_duration
     FROM firewall_configs WHERE application_id = $1 LIMIT 1`,
    [app.id]
  );
  const r = rows[0];
  if (!r) {
    throw unprocessable('FIREWALL_NOT_CONFIGURED', 'This application has no firewall configuration.');
  }

  const server = await appService.getApplicationServer(app.id);
  const { getCrowdSecCredentials } = await import('./proxy.service');
  const crowdsec = server ? await getCrowdSecCredentials(server.serverId) : null;

  return {
    id: Number(r.id),
    applicationId: Number(r.application_id),
    enabled: Boolean(r.enabled),
    banDurationSeconds: Number(r.ban_duration ?? 3600),
    serverId: server?.serverId ?? null,
    crowdsec: crowdsec
      ? {
          lapiUrl: crowdsec.lapiUrl,
          machinePassword: crowdsec.machinePassword,
          bouncerKey: crowdsec.bouncerKey,
          serverIp: crowdsec.serverIp,
        }
      : null,
  };
}

/**
 * What every *other* enabled firewall config on this application's server
 * currently wants blocked.
 *
 * CrowdSec's decisions are shared by every application the bouncer protects
 * (see `EnforcementConfigRow.crowdsec`'s doc comment) — without this, turning
 * a firewall off on one application, or reconciling its rules, would release
 * an address a *different* application on the same server still needs
 * blocked, the moment the two happened to disagree about it.
 */
async function desiredTargetsFromOtherConfigs(config: EnforcementConfigRow): Promise<DecisionTarget[]> {
  if (config.serverId === null) return [];
  const { listEnabledConfigsOnServer, listRulesByConfigId } = await import('./firewall.service');
  const siblings = await listEnabledConfigsOnServer(config.serverId);

  const targets: DecisionTarget[] = [];
  for (const sibling of siblings) {
    if (sibling.applicationId === config.applicationId) continue;
    const rules = await listRulesByConfigId(sibling.configId);
    const analyses = rules.filter((r) => r.enabled).map(analyseRule);
    const crowdsecTargets = analyses
      .filter((a) => a.enforceability === 'enforceable' && a.enforcedBy === 'crowdsec')
      .flatMap((a) => a.targets);
    targets.push(...crowdsecTargets);
  }
  return targets;
}

/** Client for managing decisions. Requires the server's machine credential. */
function managementClient(config: EnforcementConfigRow): CrowdSecLapiClient {
  if (!config.crowdsec) {
    // Named after the one concrete action that fixes this — "(re)configure
    // the proxy" told an operator nothing they could act on; verified live
    // against a real server (159.69.185.176) that this exact gap left a
    // firewall permanently unable to enforce with no way to tell why from
    // the message alone. "Install CrowdSec" is the server detail page's own
    // button label for this action (`server-detail.ts`), not a paraphrase.
    throw unprocessable(
      'CROWDSEC_NOT_CONFIGURED',
      "CrowdSec is not installed on this application's server yet — install CrowdSec from the server's page, then try again."
    );
  }
  return new CrowdSecLapiClient({
    baseUrl: config.crowdsec.lapiUrl,
    machineId: 'localhost',
    machinePassword: config.crowdsec.machinePassword,
    bouncerKey: config.crowdsec.bouncerKey ?? undefined,
    serverIp: config.crowdsec.serverIp,
  });
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
 *
 * Enabled and disabled configs are reconciled through the same diff, not two
 * separate code paths: a disabled config simply *wants* nothing, rather than
 * being handled by a variant that only knows how to release exactly what its
 * own remaining rules still name. That distinction is not academic — verified
 * live: deleting a rule and then, in the same "Apply", turning the firewall
 * off left the address it had banned in force forever, because the earlier
 * disable-path only ever released targets its (by then already-deleted) rule
 * could still describe. Diffing against live CrowdSec state instead means a
 * decision orphaned by a deleted rule is released by the *next* reconciliation
 * from anyone on the server, not only by the one call that happened to still
 * remember it.
 */
export async function enforce(teamId: number, appUuid: string): Promise<EnforcementResult> {
  const config = await loadConfig(teamId, appUuid);
  const rules = await listRules(teamId, appUuid);
  const analyses = rules.filter((r) => r.enabled).map(analyseRule);
  const unsupported = analyses.filter((a) => a.enforceability === 'unsupported');
  const enforceable = analyses.filter((a) => a.enforceability === 'enforceable');
  const proxyTargets = enforceable.filter((a) => a.enforcedBy === 'proxy').flatMap((a) => a.targets);
  const crowdsecTargets = enforceable.filter((a) => a.enforcedBy === 'crowdsec').flatMap((a) => a.targets);
  // Nothing, while this application's own firewall is off — its rules still
  // describe what it *would* block (kept above for `unsupported`/redeploy
  // reporting), but an off switch means an empty desired set here.
  const ownDesired = config.enabled ? crowdsecTargets : [];

  if (!config.enabled && !config.crowdsec) {
    // Off, and this server never had CrowdSec provisioned — nothing to
    // reconcile against.
    return {
      blocked: [],
      released: [],
      pendingRedeploy: [],
      unsupported,
      redeployRequired: proxyTargets.length > 0,
      reason: 'The firewall is turned off for this application.',
    };
  }

  // Throws CROWDSEC_NOT_CONFIGURED when enabled but this server has no
  // CrowdSec — unchanged from before this diff was unified.
  const client = managementClient(config);

  // A decision still wanted by a *different* application sharing this
  // server's CrowdSec must survive this application's own reconciliation —
  // see `desiredTargetsFromOtherConfigs`.
  const siblingTargets = await desiredTargetsFromOtherConfigs(config);
  const desiredKeys = new Set([...ownDesired, ...siblingTargets].map(targetKey));

  const current = await ourDecisions(client);
  const currentKeys = new Set(current.map(targetKey));

  const toBlock = ownDesired.filter((t) => !currentKeys.has(targetKey(t)));
  const toRelease = current.filter((t) => !desiredKeys.has(targetKey(t)));

  await runBounded(toBlock, (target) =>
    client.banIp({
      ip: target.value,
      durationSeconds: config.banDurationSeconds,
      reason: `Blocked by an iDeploy firewall rule (${appUuid})`,
    })
  );
  await runBounded(toRelease, (target) => client.unbanIp(target.value));

  logger.info('Firewall rules reconciled', {
    appUuid,
    blocked: toBlock.length,
    released: toRelease.length,
    pendingRedeploy: proxyTargets.length,
    unsupported: unsupported.length,
  });

  if (!config.enabled) {
    return {
      blocked: [],
      released: toRelease,
      pendingRedeploy: [],
      unsupported,
      redeployRequired: proxyTargets.length > 0,
      reason: 'The firewall is turned off for this application.',
    };
  }

  const reasons = [
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

/**
 * A management client for a server's CrowdSec directly, bypassing the
 * per-application config lookup. Used by `proxy.service.ts` to re-probe
 * reachability right after provisioning, when there is no application in
 * play yet.
 */
export async function getServerCrowdSecClient(serverId: number): Promise<CrowdSecLapiClient | null> {
  const { getCrowdSecCredentials } = await import('./proxy.service');
  const creds = await getCrowdSecCredentials(serverId);
  if (!creds) return null;
  return new CrowdSecLapiClient({
    baseUrl: creds.lapiUrl,
    machineId: 'localhost',
    machinePassword: creds.machinePassword,
    bouncerKey: creds.bouncerKey ?? undefined,
    serverIp: creds.serverIp,
  });
}

/** Addresses currently blocked by decisions we created. */
async function ourDecisions(client: CrowdSecLapiClient): Promise<DecisionTarget[]> {
  const decisions = await client.listDecisions({ origin: DECISION_ORIGIN });
  // Verified against a real instance (CrowdSec 1.7.8): the `origin` query
  // parameter on `GET /v1/decisions` is not honoured at all — a request
  // scoped to `origin=ideploy` came back with every decision on the server,
  // CAPI's community blocklist included (12,526 of them against 2 genuinely
  // ours). Trusting that "filtered" response is what made `enforce()`
  // reconcile CrowdSec's own detections as if this application's rules had
  // authored them: on a real run it started deleting the community
  // blocklist, 1,548 entries gone before the process was stopped. The origin
  // has to be checked again here, against what the server actually sent back
  // — never assumed from the request that was made.
  //
  // Also: CrowdSec echoes the scope back title-cased ("Ip"), not as sent
  // ("ip"). A strict `=== 'ip'` compare against that never matched a single
  // decision — every reconciliation believed nothing was banned yet, so
  // `enforce()` re-banned an address on every call instead of recognising it
  // was already blocked, and disabling the firewall never actually released
  // anything already in force.
  return decisions
    .filter((d) => d.origin === DECISION_ORIGIN && d.scope.toLowerCase() === 'ip')
    .map((d) => ({ scope: 'ip', value: d.value }));
}

/**
 * Stable identifier for `reason`, so the UI can show it in the operator's own
 * language instead of the English sentence built for logs and API consumers.
 * `reason` itself stays — it is what ends up in server logs, and a plain
 * string is still the right shape for anything reading this outside our own
 * frontend (a CLI, another team's dashboard).
 */
export type EnforcementReasonCode =
  | 'firewall_off'
  | 'crowdsec_not_installed'
  | 'crowdsec_unreachable'
  | 'bouncer_not_registered'
  | 'rules_not_applied'
  | 'all_rules_unsupported'
  | 'no_rules_configured'
  | 'summary';

export interface LiveEnforcementStatus {
  state: 'enforced' | 'partially_enforced' | 'not_enforced';
  reason: string;
  reasonCode: EnforcementReasonCode;
  /** Interpolation values for the reasonCode's translated template. */
  reasonParams: Record<string, number>;
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

  const bouncerRegistered = Boolean(config.crowdsec?.bouncerKey);
  const lapiReachable = config.crowdsec ? (await managementClient(config).health()).reachable : false;
  const crowdsecReadyForLookup = lapiReachable && bouncerRegistered;

  // Whether CrowdSec *could* enforce an address rule is not whether it
  // actually *is* — a rule just created (or one `enforce()` failed to push,
  // or one CrowdSec forgot after a restart) has no live decision behind it
  // yet. Verified live against a real deployment: right after adding a rule,
  // this used to report "enforced" from reachability alone, at the same
  // moment the UI's own "pending apply" banner said the opposite — two
  // contradictory claims on the same screen. Only a rule with a decision
  // `ourDecisions` can actually see is "enforced" now.
  let liveCrowdsecRules: typeof crowdsecRules = [];
  if (crowdsecReadyForLookup && crowdsecRules.length > 0) {
    try {
      const current = await ourDecisions(managementClient(config));
      const currentKeys = new Set(current.map(targetKey));
      liveCrowdsecRules = crowdsecRules.filter((rule) => rule.targets.every((t) => currentKeys.has(targetKey(t))));
    } catch {
      // A lookup failure here means "cannot confirm", not "confirmed absent"
      // and not "confirmed present" — leaving the list empty already reports
      // the honest, conservative answer (not enforced) without throwing and
      // taking the whole status read down with it.
      liveCrowdsecRules = [];
    }
  }

  const of = (
    state: LiveEnforcementStatus['state'],
    reason: string,
    reasonCode: EnforcementReasonCode,
    reasonParams: Record<string, number>,
    rulesEnforced: number,
    rulesPendingRedeploy: number
  ): LiveEnforcementStatus => ({
    state,
    reason,
    reasonCode,
    reasonParams,
    rulesConfigured: rules.length,
    rulesEnforced,
    rulesPendingRedeploy,
    unsupported,
    bouncerRegistered,
    lapiReachable,
  });

  if (!config.enabled) {
    return of('not_enforced', 'The firewall is turned off for this application.', 'firewall_off', {}, 0, 0);
  }

  const crowdsecReady = crowdsecReadyForLookup;
  const rulesEnforced = liveCrowdsecRules.length;
  const rulesPendingRedeploy = proxyRules.length;

  if (crowdsecRules.length > 0 && !crowdsecReady) {
    // "Not installed" and "installed but currently unreachable" call for
    // different action — the first needs a one-time setup step (Install
    // CrowdSec, on the server's own page), the second is a transient outage
    // worth waiting out or investigating separately. Reporting both as
    // "unreachable" told an operator who had never installed it to wait for
    // something that was never going to come back on its own — confirmed
    // live: this exact ambiguity is why the firewall looked broken rather
    // than merely unset up.
    const why = !config.crowdsec
      ? 'CrowdSec is not installed on this server yet'
      : !lapiReachable
        ? 'CrowdSec is not reachable, so no decision can be consulted'
        : 'no bouncer is registered, so the proxy is not consulting CrowdSec';
    const reason =
      `${why}: ${crowdsecRules.length} address-scoped rule(s) are not being filtered` +
      (rulesPendingRedeploy > 0
        ? `. ${rulesPendingRedeploy} country rule(s) are configured and will apply at the next deploy.`
        : '.');
    const reasonCode: EnforcementReasonCode = !config.crowdsec
      ? 'crowdsec_not_installed'
      : lapiReachable
        ? 'bouncer_not_registered'
        : 'crowdsec_unreachable';
    return of(
      rulesPendingRedeploy > 0 ? 'partially_enforced' : 'not_enforced',
      reason,
      reasonCode,
      { addressRules: crowdsecRules.length, pendingRedeploy: rulesPendingRedeploy },
      rulesEnforced,
      rulesPendingRedeploy
    );
  }

  if (rulesEnforced < crowdsecRules.length) {
    // Infrastructure is ready — CrowdSec answers, a bouncer is registered —
    // but not every configured address rule has a decision behind it yet.
    // Most commonly this is a rule created (or edited) since the last
    // "Apply now": the row exists, CrowdSec has never been told about it.
    const missing = crowdsecRules.length - rulesEnforced;
    const reason =
      `${missing} address-scoped rule(s) are configured but have not been applied yet — apply the firewall to push them to CrowdSec` +
      (rulesPendingRedeploy > 0
        ? `. ${rulesPendingRedeploy} country rule(s) are configured and will apply at the next deploy.`
        : '.');
    return of(
      rulesEnforced > 0 || rulesPendingRedeploy > 0 ? 'partially_enforced' : 'not_enforced',
      reason,
      'rules_not_applied',
      { addressRules: missing, pendingRedeploy: rulesPendingRedeploy },
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
      unsupported.length > 0 ? 'all_rules_unsupported' : 'no_rules_configured',
      {},
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
    'summary',
    { enforced: rulesEnforced, pendingRedeploy: rulesPendingRedeploy, unsupported: unsupported.length },
    rulesEnforced,
    rulesPendingRedeploy
  );
}
