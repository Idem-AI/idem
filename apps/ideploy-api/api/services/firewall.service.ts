/**
 * Application firewall (WAF) — config + rules + alerts + traffic logs.
 * Ports Coolify's FirewallConfig/FirewallRule models and the
 * FirewallConfigService/FirewallRuleService. Rules carry a JSON `conditions`
 * array and an `action`; deploying generates the per-rule YAML.
 */
import pool from '../config/db.config';
import * as appService from './application.service';

export interface FirewallConfig {
  id: number;
  application_id: number;
  enabled: boolean;
  appsec_enabled: boolean;
  inband_enabled: boolean;
  outofband_enabled: boolean;
  default_remediation: string;
  ban_duration: number;
  blocked_http_code: number;
  total_requests: number;
  total_blocked: number;
}

function mapConfig(r: Record<string, unknown>): FirewallConfig {
  return {
    id: Number(r.id),
    application_id: Number(r.application_id),
    enabled: Boolean(r.enabled),
    appsec_enabled: Boolean(r.appsec_enabled),
    inband_enabled: Boolean(r.inband_enabled),
    outofband_enabled: Boolean(r.outofband_enabled),
    default_remediation: String(r.default_remediation),
    ban_duration: Number(r.ban_duration),
    blocked_http_code: Number(r.blocked_http_code),
    total_requests: Number(r.total_requests),
    total_blocked: Number(r.total_blocked),
  };
}

async function appOr404(teamId: number, appUuid: string) {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  return app;
}

/** Get (creating a default row if absent) the firewall config for an app. */
export async function getOrCreateConfig(teamId: number, appUuid: string): Promise<FirewallConfig> {
  const app = await appOr404(teamId, appUuid);
  const existing = await pool.query('SELECT * FROM firewall_configs WHERE application_id = $1 LIMIT 1', [
    app.id,
  ]);
  if (existing.rows[0]) return mapConfig(existing.rows[0]);
  const { rows } = await pool.query(
    `INSERT INTO firewall_configs (application_id, created_at, updated_at) VALUES ($1, now(), now()) RETURNING *`,
    [app.id]
  );
  return mapConfig(rows[0]);
}

export async function updateConfig(
  teamId: number,
  appUuid: string,
  dto: Partial<{
    enabled: boolean;
    appsec_enabled: boolean;
    inband_enabled: boolean;
    outofband_enabled: boolean;
    default_remediation: string;
    ban_duration: number;
    blocked_http_code: number;
  }>
): Promise<FirewallConfig> {
  const config = await getOrCreateConfig(teamId, appUuid);
  const allowed = [
    'enabled',
    'appsec_enabled',
    'inband_enabled',
    'outofband_enabled',
    'default_remediation',
    'ban_duration',
    'blocked_http_code',
  ] as const;
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const f of allowed) {
    if (dto[f] !== undefined) {
      params.push(dto[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (sets.length === 0) return config;
  params.push(config.id);
  const { rows } = await pool.query(
    `UPDATE firewall_configs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return mapConfig(rows[0]);
}

export interface FirewallRule {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  rule_type: string;
  conditions: unknown;
  logical_operator: string;
  action: string;
}

function mapRule(r: Record<string, unknown>): FirewallRule {
  return {
    id: Number(r.id),
    name: String(r.name),
    enabled: Boolean(r.enabled),
    priority: Number(r.priority),
    rule_type: String(r.rule_type),
    conditions: r.conditions,
    logical_operator: String(r.logical_operator),
    action: String(r.action),
  };
}

export async function listRules(teamId: number, appUuid: string): Promise<FirewallRule[]> {
  const config = await getOrCreateConfig(teamId, appUuid);
  const { rows } = await pool.query(
    'SELECT * FROM firewall_rules WHERE firewall_config_id = $1 ORDER BY priority',
    [config.id]
  );
  return rows.map(mapRule);
}

export async function createRule(
  teamId: number,
  appUuid: string,
  dto: {
    name: string;
    conditions: unknown[];
    action?: string;
    priority?: number;
    rule_type?: string;
    logical_operator?: string;
  }
): Promise<FirewallRule> {
  const config = await getOrCreateConfig(teamId, appUuid);
  const { rows } = await pool.query(
    `INSERT INTO firewall_rules
       (firewall_config_id, name, enabled, priority, rule_type, conditions, logical_operator, action, created_at, updated_at)
     VALUES ($1,$2, true, $3, $4, $5, $6, $7, now(), now()) RETURNING *`,
    [
      config.id,
      dto.name,
      dto.priority ?? 100,
      dto.rule_type ?? 'inband',
      JSON.stringify(dto.conditions),
      dto.logical_operator ?? 'AND',
      dto.action ?? 'block',
    ]
  );
  return mapRule(rows[0]);
}

export async function deleteRule(teamId: number, appUuid: string, ruleId: number): Promise<boolean> {
  const config = await getOrCreateConfig(teamId, appUuid);
  const { rowCount } = await pool.query(
    'DELETE FROM firewall_rules WHERE id = $1 AND firewall_config_id = $2',
    [ruleId, config.id]
  );
  return (rowCount ?? 0) > 0;
}

export async function listAlerts(teamId: number, appUuid: string): Promise<Record<string, unknown>[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    // `host()`: a raw `inet` renders as `203.0.113.5/32`.
    `SELECT alert_type, severity, host(ip_address) AS ip_address, scenario, status, created_at
     FROM firewall_alerts WHERE application_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [app.id]
  );
  return rows;
}

export async function listTrafficLogs(teamId: number, appUuid: string): Promise<Record<string, unknown>[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `SELECT host(ip_address) AS ip_address, method, uri, decision, rule_name, country_code, timestamp
     FROM firewall_traffic_logs WHERE application_id = $1 ORDER BY timestamp DESC LIMIT 100`,
    [app.id]
  );
  return rows;
}

/**
 * Whether a rule set is actually enforcing anything, and why not when it is not.
 *
 * Exposed on every firewall read so the interface can state the truth. A rule
 * that exists in the database is not a rule that blocks traffic, and conflating
 * the two is how an operator ends up believing an application is protected.
 */
export type EnforcementState = 'enforced' | 'partially_enforced' | 'not_enforced';

/**
 * Whether the saved rules actually filter traffic.
 *
 * Delegates to the enforcement service, which reads the live state — the bouncer
 * registration and whether CrowdSec answers — rather than inferring protection
 * from the presence of rows.
 */
export async function getEnforcementStatus(teamId: number, appUuid: string) {
  const { getLiveStatus } = await import('./firewall-enforcement.service');
  return getLiveStatus(teamId, appUuid);
}

/**
 * Render each rule to its CrowdSec AppSec YAML and store it.
 *
 * Preparation, not application: the YAML goes into a column and stays there.
 * Kept because it is the artefact AppSec would consume if it is ever enabled
 * (see the open decision in task 4.7), and named for what it does so no caller
 * mistakes it for enforcement.
 */
export async function prepareRules(teamId: number, appUuid: string): Promise<{ rules: number }> {
  const rules = await listRules(teamId, appUuid);
  for (const rule of rules) {
    const yaml = generateRuleYaml(rule);
    await pool.query('UPDATE firewall_rules SET generated_yaml = $1, updated_at = now() WHERE id = $2', [
      yaml,
      rule.id,
    ]);
  }
  return { rules: rules.length };
}

/** The AppSec rule document for one rule. */
function generateRuleYaml(rule: FirewallRule): string {
  return [
    `name: ideploy/${rule.name}`,
    `description: ${rule.name}`,
    `rules:`,
    `  - and:`,
    `      conditions: ${JSON.stringify(rule.conditions)}`,
    `      logical_operator: ${rule.logical_operator}`,
    `action: ${rule.action}`,
  ].join('\n');
}

/**
 * Apply the rules: reconcile CrowdSec decisions and report what changed.
 *
 * Until Phase 4.3 this refused with a 501, because the previous implementation
 * rendered YAML into a column and answered `{ rules: 3 }` for an operation that
 * reached no server. It now performs the reconciliation and reports, per rule,
 * which ones could not be translated and why — a rule matching on request path
 * still cannot be enforced, and saying so is the point.
 */
export async function deploy(teamId: number, appUuid: string) {
  // Keep rendering the YAML: harmless, and the artefact stays available for the
  // day AppSec is decided on.
  await prepareRules(teamId, appUuid);

  const { enforce } = await import('./firewall-enforcement.service');
  return enforce(teamId, appUuid);
}
