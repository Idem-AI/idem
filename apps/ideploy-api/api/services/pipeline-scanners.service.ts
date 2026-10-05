/**
 * The two scans a pipeline runs, done properly.
 *
 * Trivy used to count lines containing "CRITICAL" or "HIGH" in the last 40
 * lines of its table output; SonarQube recorded a passed quality gate without
 * ever analysing. Both now produce structured results the interface can show:
 * counts by severity and the findings themselves for Trivy, the quality gate,
 * the measures and a link to the dashboard for SonarQube.
 */
import axios, { AxiosInstance } from 'axios';

// ── Trivy ──────────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface TrivyFinding {
  id: string;
  package: string;
  installed: string;
  fixed: string | null;
  severity: Severity;
  title: string;
  target: string;
}

export interface TrivySummary {
  counts: Record<Severity, number>;
  /** The most severe findings first, at most `limit`. */
  findings: TrivyFinding[];
  /** Secrets found in the code: where, never the value. */
  secrets: { target: string; rule: string; severity: string; line: number | null }[];
}

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

/** `trivy fs --format json` output → counts, the worst findings, and secrets. */
export function summariseTrivy(json: string, limit = 100): TrivySummary {
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  const findings: TrivyFinding[] = [];
  const secrets: TrivySummary['secrets'] = [];
  // Trivy may print progress before the JSON document: start at the first brace.
  const start = json.indexOf('{');
  let report: { Results?: Record<string, unknown>[] };
  try {
    report = JSON.parse(start >= 0 ? json.slice(start) : '{}');
  } catch {
    return { counts, findings, secrets };
  }
  const seen = new Set<string>();
  for (const result of report.Results ?? []) {
    const target = String(result.Target ?? '');
    for (const v of (result.Vulnerabilities as Record<string, unknown>[] | undefined) ?? []) {
      const severity = (SEVERITY_ORDER.includes(v.Severity as Severity) ? v.Severity : 'UNKNOWN') as Severity;
      // The same CVE in the same package is one problem, wherever it is listed.
      const key = `${v.VulnerabilityID}|${v.PkgName}|${v.InstalledVersion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts[severity] += 1;
      findings.push({
        id: String(v.VulnerabilityID ?? ''),
        package: String(v.PkgName ?? ''),
        installed: String(v.InstalledVersion ?? ''),
        fixed: v.FixedVersion ? String(v.FixedVersion) : null,
        severity,
        title: String(v.Title ?? v.Description ?? '').slice(0, 200),
        target,
      });
    }
    for (const s of (result.Secrets as Record<string, unknown>[] | undefined) ?? []) {
      secrets.push({
        target,
        rule: String(s.Title ?? s.RuleID ?? ''),
        severity: String(s.Severity ?? ''),
        line: s.StartLine ? Number(s.StartLine) : null,
      });
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return { counts, findings: findings.slice(0, limit), secrets };
}

/** Whether a scan fails the pipeline: any finding at or above `failOn`. */
export function trivyFails(counts: Record<Severity, number>, failOn: Severity | 'NONE' = 'CRITICAL'): boolean {
  if (failOn === 'NONE') return false;
  const limit = SEVERITY_ORDER.indexOf(failOn);
  return SEVERITY_ORDER.slice(0, limit + 1).some((s) => counts[s] > 0);
}

// ── SonarQube ──────────────────────────────────────────────────────────

/**
 * The platform's SonarQube, from the API's environment (Infisical, project
 * ideploy-api): SONARQUBE_URL and an administrator token able to create
 * projects and analysis tokens. Null when not configured.
 */
export function sonarConfig(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } | null {
  const url = (env.SONARQUBE_URL || env.SONAR_HOST_URL || '').replace(/\/+$/, '');
  const token = env.SONARQUBE_ADMIN_TOKEN || '';
  return url && token ? { url, token } : null;
}

export const SONAR_METRICS = [
  'bugs',
  'vulnerabilities',
  'code_smells',
  'security_hotspots',
  'coverage',
  'duplicated_lines_density',
] as const;

export interface SonarResult {
  projectKey: string;
  qualityGate: string;
  measures: Partial<Record<(typeof SONAR_METRICS)[number], number>>;
  dashboardUrl: string;
}

/** The SonarQube Web API calls a pipeline needs. */
export class SonarClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: { url: string; token: string }) {
    this.http = axios.create({
      baseURL: config.url,
      timeout: 20_000,
      // A user token is sent as the basic-auth login, with an empty password.
      auth: { username: config.token, password: '' },
      validateStatus: () => true,
    });
  }

  async isUp(): Promise<boolean> {
    const r = await this.http.get('/api/system/status').catch(() => null);
    return r?.status === 200 && (r.data as { status?: string })?.status === 'UP';
  }

  /** Create the project; one that already exists is fine. */
  async ensureProject(projectKey: string, name: string): Promise<void> {
    const r = await this.http.post('/api/projects/create', null, { params: { project: projectKey, name } });
    if (r.status >= 400 && !JSON.stringify(r.data).toLowerCase().includes('already exist')) {
      throw new Error(`SonarQube refused to create the project (${r.status}).`);
    }
  }

  /** A token that can only analyse this project; revoked once the analysis is read. */
  async analysisToken(projectKey: string, name: string): Promise<string> {
    const r = await this.http.post('/api/user_tokens/generate', null, {
      params: { name, type: 'PROJECT_ANALYSIS_TOKEN', projectKey },
    });
    const token = (r.data as { token?: string })?.token;
    if (r.status >= 400 || !token) throw new Error(`SonarQube refused an analysis token (${r.status}).`);
    return token;
  }

  async revokeToken(name: string): Promise<void> {
    await this.http.post('/api/user_tokens/revoke', null, { params: { name } }).catch(() => undefined);
  }

  async result(projectKey: string): Promise<SonarResult> {
    const gate = await this.http.get('/api/qualitygates/project_status', { params: { projectKey } });
    const measures = await this.http.get('/api/measures/component', {
      params: { component: projectKey, metricKeys: SONAR_METRICS.join(',') },
    });
    const values: SonarResult['measures'] = {};
    for (const m of ((measures.data as { component?: { measures?: { metric: string; value: string }[] } })?.component
      ?.measures ?? [])) {
      values[m.metric as (typeof SONAR_METRICS)[number]] = Number(m.value);
    }
    return {
      projectKey,
      qualityGate: String((gate.data as { projectStatus?: { status?: string } })?.projectStatus?.status ?? 'NONE'),
      measures: values,
      dashboardUrl: `${this.config.url}/dashboard?id=${encodeURIComponent(projectKey)}`,
    };
  }
}
