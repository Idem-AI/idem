import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  Application,
  Database,
  DatabaseType,
  DeploymentHistoryItem,
  DeployResponse,
  Destination,
  EnvVar,
  PrivateKey,
  Project,
  ProxyStatus,
  Server,
  ServerValidation,
  Service,
  ServiceTemplate,
  ScheduledTask,
  AppVolumes,
  PersistentVolume,
  Tag,
  FirewallConfig,
  FirewallRule,
} from '../models/ideploy.models';

/**
 * Typed client for the iDeploy Node API. Unwraps the `{ success, data }`
 * envelope returned by every endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = `${environment.api.url}/api/${environment.api.version}`;

  private unwrap<T>(obs: Observable<ApiResponse<T>>): Observable<T> {
    return obs.pipe(map((r) => r.data));
  }

  // ── Servers ──────────────────────────────────────────
  listServers(): Observable<Server[]> {
    return this.unwrap(this.http.get<ApiResponse<Server[]>>(`${this.base}/servers`));
  }
  createServer(body: Partial<Server> & { private_key_id: number }): Observable<Server> {
    return this.unwrap(this.http.post<ApiResponse<Server>>(`${this.base}/servers`, body));
  }
  validateServer(uuid: string): Observable<ServerValidation> {
    return this.unwrap(
      this.http.post<ApiResponse<ServerValidation>>(`${this.base}/servers/${uuid}/validate`, {})
    );
  }
  installDocker(uuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${uuid}/install-docker`,
        {}
      )
    );
  }

  // ── Projects ─────────────────────────────────────────
  listProjects(): Observable<Project[]> {
    return this.unwrap(this.http.get<ApiResponse<Project[]>>(`${this.base}/projects`));
  }

  // ── Applications ─────────────────────────────────────
  listApplications(): Observable<Application[]> {
    return this.unwrap(this.http.get<ApiResponse<Application[]>>(`${this.base}/applications`));
  }
  getApplication(uuid: string): Observable<Application> {
    return this.unwrap(this.http.get<ApiResponse<Application>>(`${this.base}/applications/${uuid}`));
  }
  updateApplication(uuid: string, body: Partial<Application>): Observable<Application> {
    return this.unwrap(
      this.http.patch<ApiResponse<Application>>(`${this.base}/applications/${uuid}`, body)
    );
  }
  appLifecycle(uuid: string, action: 'start' | 'stop' | 'restart'): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/${action}`, {})
    );
  }
  listEnvVars(uuid: string): Observable<EnvVar[]> {
    return this.unwrap(this.http.get<ApiResponse<EnvVar[]>>(`${this.base}/applications/${uuid}/envs`));
  }
  upsertEnvVar(uuid: string, body: Partial<EnvVar> & { key: string; value: string }): Observable<EnvVar> {
    return this.unwrap(
      this.http.post<ApiResponse<EnvVar>>(`${this.base}/applications/${uuid}/envs`, body)
    );
  }
  deleteEnvVar(uuid: string, key: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/envs/${key}`)
    );
  }
  listDeployments(uuid: string): Observable<DeploymentHistoryItem[]> {
    return this.unwrap(
      this.http.get<ApiResponse<DeploymentHistoryItem[]>>(
        `${this.base}/applications/${uuid}/deployments`
      )
    );
  }

  // ── Databases (Phase 3) ──────────────────────────────
  listDatabases(): Observable<Database[]> {
    return this.unwrap(this.http.get<ApiResponse<Database[]>>(`${this.base}/databases`));
  }
  createDatabase(
    type: DatabaseType,
    body: { name: string; environment_id: number; destination_id: number }
  ): Observable<Database> {
    return this.unwrap(this.http.post<ApiResponse<Database>>(`${this.base}/databases/${type}`, body));
  }
  dbLifecycle(
    type: DatabaseType,
    uuid: string,
    action: 'start' | 'stop' | 'restart'
  ): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/databases/${type}/${uuid}/${action}`, {})
    );
  }
  backupNow(type: DatabaseType, uuid: string): Observable<{ success: boolean; filename: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; filename: string }>>(
        `${this.base}/databases/${type}/${uuid}/backup-now`,
        {}
      )
    );
  }

  // ── Services (Phase 4) ───────────────────────────────
  listServices(): Observable<Service[]> {
    return this.unwrap(this.http.get<ApiResponse<Service[]>>(`${this.base}/services`));
  }
  listServiceTemplates(): Observable<ServiceTemplate[]> {
    return this.unwrap(
      this.http.get<ApiResponse<ServiceTemplate[]>>(`${this.base}/services/templates`)
    );
  }
  createService(body: {
    name: string;
    environment_id: number;
    destination_id: number;
    docker_compose_raw: string;
  }): Observable<Service> {
    return this.unwrap(this.http.post<ApiResponse<Service>>(`${this.base}/services`, body));
  }
  createServiceFromTemplate(body: {
    template: string;
    name: string;
    environment_id: number;
    destination_id: number;
  }): Observable<Service> {
    return this.unwrap(
      this.http.post<ApiResponse<Service>>(`${this.base}/services/from-template`, body)
    );
  }
  serviceLifecycle(uuid: string, action: 'start' | 'stop' | 'restart'): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/services/${uuid}/${action}`, {})
    );
  }

  // ── Scheduled tasks (Phase 5) ────────────────────────
  listTasks(uuid: string): Observable<ScheduledTask[]> {
    return this.unwrap(this.http.get<ApiResponse<ScheduledTask[]>>(`${this.base}/applications/${uuid}/tasks`));
  }
  createTask(uuid: string, body: { name: string; command: string; frequency: string }): Observable<ScheduledTask> {
    return this.unwrap(this.http.post<ApiResponse<ScheduledTask>>(`${this.base}/applications/${uuid}/tasks`, body));
  }
  runTask(uuid: string, taskUuid: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/tasks/${taskUuid}/run`, {}));
  }
  deleteTask(uuid: string, taskUuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/tasks/${taskUuid}`));
  }

  // ── Volumes (Phase 5) ────────────────────────────────
  listVolumes(uuid: string): Observable<AppVolumes> {
    return this.unwrap(this.http.get<ApiResponse<AppVolumes>>(`${this.base}/applications/${uuid}/volumes`));
  }
  createPersistentVolume(uuid: string, body: { name: string; mount_path: string; host_path?: string }): Observable<PersistentVolume> {
    return this.unwrap(this.http.post<ApiResponse<PersistentVolume>>(`${this.base}/applications/${uuid}/volumes/persistent`, body));
  }

  // ── Ops (Phase 5) ────────────────────────────────────
  appStatus(uuid: string): Observable<{ status: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ status: string }>>(`${this.base}/applications/${uuid}/status`));
  }
  appMetrics(uuid: string): Observable<{ metrics: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ metrics: string }>>(`${this.base}/applications/${uuid}/metrics`));
  }
  appExec(uuid: string, command: string): Observable<{ exitCode: number; output: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ exitCode: number; output: string }>>(`${this.base}/applications/${uuid}/exec`, { command }));
  }

  // ── Tags (Phase 5) ───────────────────────────────────
  listTags(): Observable<Tag[]> {
    return this.unwrap(this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`));
  }
  createTag(name: string): Observable<Tag> {
    return this.unwrap(this.http.post<ApiResponse<Tag>>(`${this.base}/tags`, { name }));
  }
  deleteTag(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/tags/${uuid}`));
  }

  // ── Firewall / Security (Phase 6) ────────────────────
  getFirewall(uuid: string): Observable<FirewallConfig> {
    return this.unwrap(this.http.get<ApiResponse<FirewallConfig>>(`${this.base}/applications/${uuid}/firewall`));
  }
  updateFirewall(uuid: string, body: Partial<FirewallConfig>): Observable<FirewallConfig> {
    return this.unwrap(this.http.patch<ApiResponse<FirewallConfig>>(`${this.base}/applications/${uuid}/firewall`, body));
  }
  listFirewallRules(uuid: string): Observable<FirewallRule[]> {
    return this.unwrap(this.http.get<ApiResponse<FirewallRule[]>>(`${this.base}/applications/${uuid}/firewall/rules`));
  }
  createFirewallRule(uuid: string, body: { name: string; conditions: unknown[]; action?: string }): Observable<FirewallRule> {
    return this.unwrap(this.http.post<ApiResponse<FirewallRule>>(`${this.base}/applications/${uuid}/firewall/rules`, body));
  }
  deleteFirewallRule(uuid: string, ruleId: number): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/firewall/rules/${ruleId}`));
  }
  deployFirewall(uuid: string): Observable<{ rules: number }> {
    return this.unwrap(this.http.post<ApiResponse<{ rules: number }>>(`${this.base}/applications/${uuid}/firewall/deploy`, {}));
  }
  installCrowdSec(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ success: boolean; output: string }>>(`${this.base}/servers/${serverUuid}/crowdsec/install`, {}));
  }
  crowdSecStatus(serverUuid: string): Observable<{ running: boolean; raw: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ running: boolean; raw: string }>>(`${this.base}/servers/${serverUuid}/crowdsec/status`));
  }

  // ── Pipelines (Phase 7) ──────────────────────────────
  getPipeline(uuid: string): Observable<{ enabled: boolean; stages: string[]; trigger_mode: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ enabled: boolean; stages: string[]; trigger_mode: string }>>(`${this.base}/applications/${uuid}/pipeline`));
  }
  triggerPipeline(uuid: string): Observable<{ executionUuid: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ executionUuid: string }>>(`${this.base}/applications/${uuid}/pipeline/trigger`, {}));
  }
  listPipelineExecutions(uuid: string): Observable<Record<string, unknown>[]> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/applications/${uuid}/pipeline/executions`));
  }

  // ── Notifications (Phase 8) ──────────────────────────
  getNotificationSettings(channel: string): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/notifications/${channel}`));
  }
  updateNotificationSettings(channel: string, body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.put<ApiResponse<Record<string, unknown>>>(`${this.base}/notifications/${channel}`, body));
  }
  testNotification(channel: string): Observable<{ sent: boolean }> {
    return this.unwrap(this.http.post<ApiResponse<{ sent: boolean }>>(`${this.base}/notifications/${channel}/test`, {}));
  }

  // ── Team (Phase 9) ───────────────────────────────────
  listMembers(): Observable<{ user_id: number; name: string; email: string; role: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ user_id: number; name: string; email: string; role: string }[]>>(`${this.base}/team/members`));
  }
  listInvitations(): Observable<{ uuid: string; email: string; role: string; link: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ uuid: string; email: string; role: string; link: string }[]>>(`${this.base}/team/invitations`));
  }
  createInvitation(body: { email: string; role?: string }): Observable<{ uuid: string; link: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ uuid: string; link: string }>>(`${this.base}/team/invitations`, body));
  }
  deleteInvitation(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/team/invitations/${uuid}`));
  }
  setMemberRole(userId: number, role: string): Observable<unknown> {
    return this.unwrap(this.http.patch<ApiResponse<unknown>>(`${this.base}/team/members/${userId}/role`, { role }));
  }

  // ── Subscription (Phase 9) ───────────────────────────
  getSubscription(): Observable<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null }> {
    return this.unwrap(this.http.get<ApiResponse<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null }>>(`${this.base}/subscription`));
  }
  listPlans(): Observable<Record<string, unknown>[]> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/subscription/plans`));
  }
  getQuota(): Observable<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } }> {
    return this.unwrap(this.http.get<ApiResponse<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } }>>(`${this.base}/subscription/quota`));
  }
  checkout(priceId: string): Observable<{ url: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ url: string }>>(`${this.base}/subscription/checkout`, { price_id: priceId }));
  }

  // ── Settings / instance (Phase 10) ───────────────────
  getInstanceSettings(): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/settings/instance`));
  }
  updateInstanceSettings(body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.patch<ApiResponse<Record<string, unknown>>>(`${this.base}/settings/instance`, body));
  }
  getVersion(): Observable<{ version: string; autoUpdate: boolean }> {
    return this.unwrap(this.http.get<ApiResponse<{ version: string; autoUpdate: boolean }>>(`${this.base}/settings/version`));
  }
  search(q: string): Observable<{ type: string; uuid: string; name: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ type: string; uuid: string; name: string }[]>>(`${this.base}/settings/search?q=${encodeURIComponent(q)}`));
  }

  // ── Shell (me / catalog) ─────────────────────────────
  me(): Observable<{
    id: number;
    name: string;
    email: string;
    photoUrl: string | null;
    idemRole: string | null;
    role: string | null;
    team: { id: number; name: string } | null;
  }> {
    return this.unwrap(this.http.get<ApiResponse<{ id: number; name: string; email: string; photoUrl: string | null; idemRole: string | null; role: string | null; team: { id: number; name: string } | null }>>(`${this.base}/me`));
  }
  listSources(): Observable<{ uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]>>(`${this.base}/sources`));
  }
  listS3Storages(): Observable<{ uuid: string; name: string; region: string; endpoint: string | null }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ uuid: string; name: string; region: string; endpoint: string | null }[]>>(`${this.base}/s3-storages`));
  }

  // ── Shared variables (Phase 5) ───────────────────────
  listSharedVariables(scope: string, scopeId: number): Observable<{ id: number; key: string; value: string | null }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ id: number; key: string; value: string | null }[]>>(`${this.base}/shared-variables/${scope}/${scopeId}`));
  }
  upsertSharedVariable(scope: string, scopeId: number, body: { key: string; value: string }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/shared-variables/${scope}/${scopeId}`, body));
  }

  // ── Deploy ───────────────────────────────────────────
  deploy(uuid: string, commit?: string): Observable<DeployResponse> {
    return this.unwrap(
      this.http.post<ApiResponse<DeployResponse>>(`${this.base}/deploy`, { uuid, commit })
    );
  }

  // ── Private keys (Phase 1) ───────────────────────────
  listPrivateKeys(): Observable<PrivateKey[]> {
    return this.unwrap(this.http.get<ApiResponse<PrivateKey[]>>(`${this.base}/security/keys`));
  }
  createPrivateKey(body: {
    name: string;
    private_key: string;
    description?: string;
  }): Observable<PrivateKey> {
    return this.unwrap(
      this.http.post<ApiResponse<PrivateKey>>(`${this.base}/security/keys`, body)
    );
  }

  // ── Destinations (Phase 1) ───────────────────────────
  listDestinations(serverUuid: string): Observable<Destination[]> {
    return this.unwrap(
      this.http.get<ApiResponse<Destination[]>>(`${this.base}/servers/${serverUuid}/destinations`)
    );
  }
  createDestination(serverUuid: string, body: { network?: string }): Observable<Destination> {
    return this.unwrap(
      this.http.post<ApiResponse<Destination>>(
        `${this.base}/servers/${serverUuid}/destinations`,
        body
      )
    );
  }

  // ── Proxy (Phase 1) ──────────────────────────────────
  getProxyStatus(serverUuid: string): Observable<ProxyStatus> {
    return this.unwrap(
      this.http.get<ApiResponse<ProxyStatus>>(`${this.base}/servers/${serverUuid}/proxy`)
    );
  }
  startProxy(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${serverUuid}/proxy/start`,
        {}
      )
    );
  }
  stopProxy(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${serverUuid}/proxy/stop`,
        {}
      )
    );
  }
}
