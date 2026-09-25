import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  Application,
  AppVolumes,
  ContainerUsage,
  DeploymentHistoryItem,
  EnvVar,
  FirewallConfig,
  FileVolume,
  PersistentVolume,
  PipelineConfig,
  ScheduledTask,
  Tag,
  TaskExecution,
} from '../../../shared/models/ideploy.models';
import { techIcon } from '../../../shared/utils/tech-icon.util';
import { appStatusDisplay } from '../../../shared/utils/app-status.util';

/** The Eloquent morph class this Node API expects for an application. */
const APPLICATION_TAGGABLE_TYPE = 'App\\Models\\Application';

/**
 * Application detail — configuration, environment variables, scheduled tasks,
 * volumes and one-off operations.
 *
 * Security, the CI/CD pipeline and deployment history each have a dedicated
 * screen; what remains here are summaries that link to them, so a given
 * capability has exactly one implementation.
 */
@Component({
  selector: 'app-application-detail',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (app(); as a) {
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ a.name }}</h1>
        <div class="flex items-center gap-2">
          @if (a.link) {
            <a class="outer-button" [href]="a.link" target="_blank" rel="noopener">
              <i class="pi pi-external-link mr-2"></i>{{ 'applications.open' | translate }}
            </a>
          }
          <a class="outer-button" [routerLink]="['/applications', uuid, 'insights']">
            <i class="pi pi-chart-bar mr-2"></i>{{ 'insights.open' | translate }}
          </a>
          <a class="outer-button" [routerLink]="['/applications', uuid, 'terminal']">
            <i class="pi pi-code mr-2"></i>{{ 'terminal.open' | translate }}
          </a>
          <button class="outer-button" (click)="lifecycle('restart')">{{ 'applications.detail.restart' | translate }}</button>
          <button class="outer-button" (click)="lifecycle('stop')">{{ 'applications.detail.stop' | translate }}</button>
          <button class="inner-button" (click)="deploy()">{{ 'applications.deploy' | translate }}</button>
        </div>
      </div>

      <!--
        Production Deployment — Vercel's own project-overview hero, adapted:
        the same "here is what's actually live" summary (preview, domains,
        status, source), built from real data this platform has. The preview
        is a live iframe of the app's own URL rather than a captured
        screenshot — always current, and needs no screenshot service; the
        trade-off, accepted deliberately, is that an application whose own
        response sends X-Frame-Options/CSP framing restrictions shows an
        empty preview pane for itself, same as it would in any other iframe.
      -->
      <section class="glass-card mb-6 overflow-hidden p-0">
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-4" style="border-bottom:1px solid var(--color-surface-2);">
          <h2 class="text-sm font-semibold">{{ 'applications.detail.productionDeployment' | translate }}</h2>
          <div class="flex items-center gap-1">
            @if (a.git_repository) {
              <a class="button-icon" [href]="a.git_repository" target="_blank" rel="noopener" [title]="'applications.detail.viewSource' | translate">
                <i class="pi pi-github" aria-hidden="true"></i>
              </a>
            }
            <a class="outer-button text-xs px-3 py-1.5" [routerLink]="['/applications', uuid, 'deployments']">
              <i class="pi pi-history mr-1.5" aria-hidden="true"></i>{{ 'applications.detail.rollback' | translate }}
            </a>
            @if (a.link) {
              <a class="inner-button text-xs px-3 py-1.5" [href]="a.link" target="_blank" rel="noopener">
                {{ 'applications.open' | translate }}
              </a>
            }
          </div>
        </div>
        <div class="grid grid-cols-1 gap-5 p-5 md:grid-cols-[280px_1fr]">
          <div class="relative aspect-video overflow-hidden rounded-xl" style="background:var(--color-surface-2);">
            @if (previewUrl(); as url) {
              <iframe
                [src]="url"
                title="live preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
                style="width:400%;height:400%;transform:scale(0.25);transform-origin:0 0;border:0;pointer-events:none;"
              ></iframe>
            } @else {
              <div class="flex h-full items-center justify-center">
                <i [class]="stackIcon().icon" class="text-4xl opacity-40" [style.color]="stackIcon().color" aria-hidden="true"></i>
              </div>
            }
          </div>
          <dl class="grid grid-cols-2 content-start gap-x-6 gap-y-3 text-sm">
            <div class="col-span-2">
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.deploymentUrl' | translate }}</dt>
              <dd class="truncate font-mono font-semibold">{{ shortDomain() || '—' }}</dd>
            </div>
            @if (a.fqdn) {
              <div class="col-span-2">
                <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domainsLabel' | translate }}</dt>
                <dd>
                  <a class="inline-flex items-center gap-1.5 font-mono font-semibold hover:underline" [style.color]="'var(--color-primary-400)'" [href]="a.link ?? undefined" target="_blank" rel="noopener">
                    {{ shortDomain() }}<i class="pi pi-external-link text-[10px]" aria-hidden="true"></i>
                  </a>
                </dd>
              </div>
            }
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.statusLabel' | translate }}</dt>
              <dd class="flex items-center gap-1.5">
                <i [class]="statusOf(a.status).icon" [style.color]="statusOf(a.status).color" class="text-xs" aria-hidden="true"></i>
                {{ statusOf(a.status).labelKey | translate }}
              </dd>
            </div>
            @if (latestDeployment(); as dep) {
              <div>
                <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.createdLabel' | translate }}</dt>
                <dd>{{ dep.created_at | date: 'medium' }}</dd>
              </div>
            }
            <div class="col-span-2">
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.sourceLabel' | translate }}</dt>
              <dd class="flex flex-wrap items-center gap-3 font-mono text-xs">
                <span><i class="pi pi-sitemap mr-1" aria-hidden="true"></i>{{ a.git_branch || 'main' }}</span>
                @if (latestDeployment(); as dep) {
                  <span style="color:var(--color-text-secondary);">{{ shortCommit(dep.commit) }} · {{ dep.status }}</span>
                }
              </dd>
            </div>
          </dl>
        </div>

        <!-- Deployment settings — collapsed by default, badge is the real onboarding-checklist gap count. -->
        <button type="button" class="flex w-full items-center gap-2 px-5 py-3 text-sm transition-colors hover:bg-[var(--glass-bg-subtle)]" style="border-top:1px solid var(--color-surface-2);" (click)="settingsOpen.set(!settingsOpen())">
          <i class="pi text-[10px] transition-transform" [class.pi-chevron-right]="!settingsOpen()" [class.pi-chevron-down]="settingsOpen()" aria-hidden="true"></i>
          <span class="font-semibold">{{ 'applications.detail.deploymentSettings' | translate }}</span>
          @if (checklistItems().length - checklistDone(); as remaining) {
            @if (remaining > 0) {
              <span class="rounded-full px-2 py-0.5 text-xs font-semibold" style="background:color-mix(in srgb, var(--color-primary-500) 16%, transparent);color:var(--color-primary-400);">
                {{ 'applications.detail.recommendations' | translate: { count: remaining } }}
              </span>
            }
          }
        </button>
        @if (settingsOpen()) {
          <div class="grid grid-cols-2 gap-4 px-5 pb-5 text-sm">
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.buildPack' | translate }}</dt>
              <dd class="font-mono">{{ a.build_pack || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.gitRepository' | translate }}</dt>
              <dd class="truncate font-mono">{{ a.git_repository || '—' }}</dd>
            </div>
          </div>
        }
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs" style="border-top:1px solid var(--color-surface-2);color:var(--color-text-secondary);">
          <span>{{ 'applications.detail.pushToUpdate' | translate: { branch: a.git_branch || 'main' } }}</span>
          <a class="hover:underline" style="color:var(--color-primary-400);" [routerLink]="['/applications', uuid, 'deployments']">{{ 'applications.detail.manageDeployments' | translate }}</a>
        </div>
      </section>

      <!-- Checklist / resource snapshot / firewall snapshot — Vercel's three-card row, on our own data. -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section class="glass-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ 'applications.detail.checklist' | translate }}</h3>
            <span class="text-xs" style="color:var(--color-text-secondary);">{{ checklistDone() }}/{{ checklistItems().length }}</span>
          </div>
          <ul class="space-y-2 text-sm">
            @for (item of checklistItems(); track item.key) {
              <li class="flex items-center gap-2" [style.color]="item.done ? 'var(--color-text-secondary)' : 'var(--color-text-primary)'">
                <i [class]="item.done ? 'pi pi-check-circle' : 'pi pi-circle-fill'" [style.color]="item.done ? 'var(--color-success)' : 'var(--color-text-tertiary)'" aria-hidden="true"></i>
                <span [style.text-decoration]="item.done ? 'line-through' : 'none'">{{ 'applications.detail.checklistItem.' + item.key | translate }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="glass-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ 'applications.detail.resourceUsage' | translate }}</h3>
            <a class="text-xs hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'insights']">{{ 'applications.detail.viewInsights' | translate }}</a>
          </div>
          @if (usage(); as u) {
            <dl class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'insights.cpu' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ u.cpuPercent !== null ? u.cpuPercent.toFixed(1) + '%' : '—' }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'insights.memory' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ formatBytes(u.memoryUsedBytes) }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'insights.networkOut' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ formatBytes(u.networkOutBytes) }}</dd>
              </div>
            </dl>
          } @else {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noUsage' | translate }}</p>
          }
        </section>

        <section class="glass-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ 'applications.detail.firewallOverview' | translate }}</h3>
            <a class="text-xs hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'security']">{{ 'applications.detail.manageSecurity' | translate }}</a>
          </div>
          @if (firewall(); as fw) {
            <dl class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'applications.detail.totalRequests' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ fw.total_requests }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'applications.detail.blockedRequests' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ fw.total_blocked }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt style="color:var(--color-text-secondary);">{{ 'security.app.wafEnabled' | translate }}</dt>
                <dd>
                  <i [class]="fw.enabled ? 'pi pi-check-circle' : 'pi pi-times-circle'" [style.color]="fw.enabled ? 'var(--color-success)' : 'var(--color-text-tertiary)'" aria-hidden="true"></i>
                </dd>
              </div>
            </dl>
          }
        </section>
      </div>

      <!-- Recent deployments — Vercel's "Active Branches", on our own deployment history. -->
      <section class="glass-card p-4 mb-6">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ 'applications.detail.recentDeployments' | translate }}</h2>
          <a class="text-xs hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'deployments']">{{ 'applications.detail.manageDeployments' | translate }}</a>
        </div>
        @if (deployments().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noDeployments' | translate }}</p>
        } @else {
          <div class="space-y-2">
            @for (dep of deployments().slice(0, 5); track dep.deployment_uuid) {
              <a class="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-[var(--glass-bg-subtle)]" [routerLink]="['/deployments', dep.deployment_uuid]">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [style.background]="statusBackground(dep.status)" [style.color]="statusColor(dep.status)">{{ dep.status }}</span>
                <code class="font-mono text-xs">{{ shortCommit(dep.commit) }}</code>
                <span class="ml-auto text-xs" style="color:var(--color-text-secondary);">{{ dep.created_at | date: 'short' }}</span>
              </a>
            }
          </div>
        }
      </section>

      <!-- Config -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.configuration' | translate }}</h2>
        <form class="space-y-3" [formGroup]="configForm" (ngSubmit)="saveConfig()">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm">{{ 'applications.detail.gitRepository' | translate }}</label>
              <input type="text"  formControlName="git_repository" />
            </div>
            <div>
              <label class="mb-1 block text-sm">{{ 'applications.branch' | translate }}</label>
              <input type="text"  formControlName="git_branch" />
            </div>
            <div>
              <label class="mb-1 block text-sm">{{ 'applications.detail.buildPack' | translate }}</label>
              <input type="text"  formControlName="build_pack" />
            </div>
            <div>
              <label class="mb-1 block text-sm">{{ 'applications.detail.fqdn' | translate }}</label>
              <input type="text"  formControlName="fqdn" />
            </div>
          </div>
          <button class="inner-button" type="submit" [disabled]="savingConfig()">{{ 'applications.detail.save' | translate }}</button>
        </form>
      </section>

      <!-- Env vars -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.environmentVariables' | translate }}</h2>
        @for (env of envVars(); track env.key) {
          <div class="mb-2 flex items-center gap-2">
            <code class="text-sm">{{ env.key }}</code>
            <span class="text-sm" style="color: var(--color-text-secondary)">= {{ env.value }}</span>
            <button class="ml-auto text-xs text-red-400" (click)="removeEnv(env)">{{ 'applications.detail.remove' | translate }}</button>
          </div>
        }
        <form class="mt-3 flex gap-2" [formGroup]="envForm" (ngSubmit)="addEnv()">
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.keyPlaceholder' | translate" formControlName="key" />
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.valuePlaceholder' | translate" formControlName="value" />
          <button class="inner-button" type="submit" [disabled]="envForm.invalid">{{ 'applications.detail.add' | translate }}</button>
        </form>
      </section>

      <!-- Scheduled tasks -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.scheduledTasks' | translate }}</h2>
        @for (task of tasks(); track task.uuid) {
          <div class="mb-1 flex items-center gap-3 text-sm">
            <span class="font-semibold">{{ task.name }}</span>
            <code>{{ task.command }}</code>
            <span style="color: var(--color-text-secondary)">{{ task.frequency }}</span>
            <button class="ml-auto text-xs" (click)="runTask(task)">{{ 'applications.detail.runNow' | translate }}</button>
            <button class="text-xs" style="color:var(--color-text-secondary);" (click)="toggleTaskExecutions(task)">
              {{ (expandedTask() === task.uuid ? 'applications.detail.hideRuns' : 'applications.detail.showRuns') | translate }}
            </button>
            <button class="text-xs text-red-400" (click)="removeTask(task)">{{ 'applications.detail.delete' | translate }}</button>
          </div>
          @if (expandedTask() === task.uuid) {
            @if (taskExecutions().length === 0) {
              <p class="mb-2 ml-4 text-xs" style="color:var(--color-text-secondary);">
                {{ 'applications.detail.noRuns' | translate }}
              </p>
            } @else {
              <ul class="mb-2 ml-4 space-y-0.5 text-xs" style="color:var(--color-text-secondary);">
                @for (ex of taskExecutions(); track $index) {
                  <li>{{ ex.created_at }} — {{ ex.status }}</li>
                }
              </ul>
            }
          }
        }
        <form class="mt-3 flex flex-wrap gap-2" [formGroup]="taskForm" (ngSubmit)="addTask()">
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.namePlaceholder' | translate" formControlName="name" />
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.commandPlaceholder' | translate" formControlName="command" />
          <input type="text" class="!w-40" [placeholder]="'applications.detail.cronPlaceholder' | translate" formControlName="frequency" />
          <button class="inner-button" type="submit" [disabled]="taskForm.invalid">{{ 'applications.detail.addTask' | translate }}</button>
        </form>
      </section>

      <!-- Volumes -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.persistentVolumes' | translate }}</h2>
        @for (vol of volumes()?.persistent ?? []; track vol.id) {
          <div class="mb-1 flex items-center gap-2 text-sm">
            <code>{{ vol.name }}</code> → {{ vol.mount_path }}
            <button class="ml-auto text-xs text-red-400" (click)="removePersistentVolume(vol)">
              {{ 'applications.detail.delete' | translate }}
            </button>
          </div>
        }
        <form class="mt-3 flex flex-wrap gap-2" [formGroup]="volumeForm" (ngSubmit)="addVolume()">
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.namePlaceholder' | translate" formControlName="name" />
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.mountPathPlaceholder' | translate" formControlName="mount_path" />
          <button class="inner-button" type="submit" [disabled]="volumeForm.invalid">{{ 'applications.detail.addVolume' | translate }}</button>
        </form>

        <h3 class="mb-2 mt-4 text-sm font-semibold">{{ 'applications.detail.fileVolumes' | translate }}</h3>
        @for (file of volumes()?.files ?? []; track file.id) {
          <div class="mb-1 text-sm">
            <code>{{ file.mount_path }}</code>
          </div>
        }
        <form class="mt-2 flex flex-wrap gap-2" [formGroup]="fileVolumeForm" (ngSubmit)="addFileVolume()">
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.mountPathPlaceholder' | translate" formControlName="mount_path" />
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.fileContentPlaceholder' | translate" formControlName="content" />
          <button class="inner-button" type="submit" [disabled]="fileVolumeForm.invalid">{{ 'applications.detail.addFile' | translate }}</button>
        </form>
      </section>

      <!-- Tags -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.tags' | translate }}</h2>
        <div class="flex flex-wrap gap-2">
          @for (tag of appTags(); track tag.uuid) {
            <span class="inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm" style="background-color: var(--color-surface-2)">
              {{ tag.name }}
              <button class="text-xs text-red-400" (click)="detachTag(tag)">×</button>
            </span>
          }
        </div>
        @if (availableTags().length > 0) {
          <div class="mt-3 flex flex-wrap gap-2">
            <select class="!w-48" #tagPicker>
              <option value="">{{ 'applications.detail.attachTag' | translate }}</option>
              @for (tag of availableTags(); track tag.uuid) {
                <option [value]="tag.uuid">{{ tag.name }}</option>
              }
            </select>
            <button class="outer-button" (click)="attachTag(tagPicker.value); tagPicker.value = ''">
              {{ 'applications.detail.add' | translate }}
            </button>
          </div>
        }
      </section>

      <!-- Ops -->
      <section class="glass-card p-4 mb-6">
        <h2 class="mb-3 font-semibold">{{ 'applications.detail.operations' | translate }}</h2>
        <div class="mb-2 flex gap-2">
          <button class="outer-button" (click)="refreshStatus()">{{ 'applications.detail.status' | translate }}</button>
          <button class="outer-button" (click)="refreshMetrics()">{{ 'applications.detail.metrics' | translate }}</button>
        </div>
        @if (opsOutput()) {
          <pre class="overflow-auto whitespace-pre-wrap font-mono text-xs">{{ opsOutput() }}</pre>
        }
        <form class="mt-3 flex gap-2" [formGroup]="execForm" (ngSubmit)="runExec()">
          <input type="text" class="flex-1 !w-auto min-w-0" [placeholder]="'applications.detail.execPlaceholder' | translate" formControlName="command" />
          <button class="inner-button" type="submit" [disabled]="execForm.invalid">{{ 'applications.detail.exec' | translate }}</button>
        </form>
      </section>

    } @else {
      <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'applications.loading' | translate }}</p>
    }
  `,
})
export class ApplicationDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  protected readonly app = signal<Application | null>(null);
  protected readonly envVars = signal<EnvVar[]>([]);
  protected readonly deployments = signal<DeploymentHistoryItem[]>([]);
  protected readonly tasks = signal<ScheduledTask[]>([]);
  protected readonly volumes = signal<AppVolumes | null>(null);
  protected readonly opsOutput = signal<string>('');
  protected readonly firewall = signal<FirewallConfig | null>(null);
  protected readonly pipeline = signal<PipelineConfig | null>(null);
  protected readonly savingConfig = signal(false);

  protected readonly expandedTask = signal<string | null>(null);
  protected readonly taskExecutions = signal<TaskExecution[]>([]);

  protected readonly appTags = signal<Tag[]>([]);
  protected readonly allTags = signal<Tag[]>([]);
  /** Team tags not already on this application — what the picker offers. */
  protected readonly availableTags = signal<Tag[]>([]);

  /** This application's own container — the "Observability" card's data. */
  protected readonly usage = signal<ContainerUsage | null>(null);

  protected uuid = '';

  protected stackIcon = (): ReturnType<typeof techIcon> => techIcon(this.app() ?? {});
  protected statusOf = appStatusDisplay;

  protected readonly latestDeployment = computed<DeploymentHistoryItem | null>(() => this.deployments()[0] ?? null);

  protected readonly settingsOpen = signal(false);

  /**
   * A live iframe of the app's own URL, standing in for the screenshot
   * Vercel itself captures — always current, no screenshot service to run.
   * Only offered once the app has actually started (`link` set): pointing an
   * iframe at a container that never booted is not a preview of anything.
   */
  protected readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const link = this.app()?.link;
    return link ? this.sanitizer.bypassSecurityTrustResourceUrl(link) : null;
  });

  /**
   * Real onboarding steps for this platform, not Vercel's own — a repository,
   * a domain, and the CI/CD, firewall and environment-variable setup someone
   * would otherwise only discover by visiting five different screens.
   */
  protected readonly checklistItems = computed(() => {
    const a = this.app();
    return [
      { key: 'gitRepo', done: Boolean(a?.git_repository) },
      { key: 'domain', done: Boolean(a?.fqdn) },
      { key: 'pipeline', done: Boolean(this.pipeline()?.enabled) },
      { key: 'firewall', done: Boolean(this.firewall()?.enabled) },
      { key: 'envVars', done: this.envVars().length > 0 },
    ];
  });
  protected readonly checklistDone = computed(() => this.checklistItems().filter((i) => i.done).length);

  /** The domain shown in the hero — `fqdn` may hold several, comma-separated. */
  protected shortDomain(): string {
    const fqdn = this.app()?.fqdn;
    return fqdn ? fqdn.split(',')[0].trim().replace(/^https?:\/\//, '') : '';
  }

  protected shortCommit(commit: string): string {
    return commit.slice(0, 7);
  }

  protected statusColor(status: string): string {
    if (status === 'finished' || status === 'success') return 'var(--color-success)';
    if (status === 'failed' || status === 'error') return 'var(--color-danger)';
    if (status === 'in_progress' || status === 'running') return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  }
  protected statusBackground(status: string): string {
    return `color-mix(in srgb, ${this.statusColor(status)} 16%, transparent)`;
  }

  protected formatBytes(bytes: number | null): string {
    if (bytes === null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  protected readonly configForm = this.fb.nonNullable.group({
    git_repository: [''],
    git_branch: [''],
    build_pack: [''],
    fqdn: [''],
  });

  protected readonly envForm = this.fb.nonNullable.group({
    key: ['', Validators.required],
    value: ['', Validators.required],
  });

  protected readonly taskForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    command: ['', Validators.required],
    frequency: ['', Validators.required],
  });

  protected readonly volumeForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mount_path: ['', Validators.required],
  });

  protected readonly execForm = this.fb.nonNullable.group({
    command: ['', Validators.required],
  });

  protected readonly fileVolumeForm = this.fb.nonNullable.group({
    mount_path: ['', Validators.required],
    content: ['', Validators.required],
  });

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.reload();
  }

  private reload(): void {
    this.api.getApplication(this.uuid).subscribe((a) => {
      this.app.set(a);
      this.configForm.patchValue({
        git_repository: a.git_repository ?? '',
        git_branch: a.git_branch ?? '',
        build_pack: a.build_pack ?? '',
      });
      // Tags are keyed by the numeric id, only known once the app has loaded.
      this.reloadTags();
    });
    this.api.listEnvVars(this.uuid).subscribe((v) => this.envVars.set(v));
    this.api.listDeployments(this.uuid).subscribe((d) => this.deployments.set(d));
    this.api.listTasks(this.uuid).subscribe((t) => this.tasks.set(t));
    this.api.listVolumes(this.uuid).subscribe((v) => this.volumes.set(v));
    this.api.getFirewall(this.uuid).subscribe((f) => this.firewall.set(f));
    // Best-effort: the container may not be up yet (never deployed, or stopped) — an
    // empty snapshot is a normal state here, not something to surface as an error.
    this.api.appUsage(this.uuid).subscribe({
      next: (usage) => this.usage.set(usage[0] ?? null),
      error: () => this.usage.set(null),
    });
    this.api.getPipeline(this.uuid).subscribe((p) => this.pipeline.set(p));
  }

  private reloadTags(): void {
    this.api.listTags().subscribe((all) => {
      this.allTags.set(all);
      this.recomputeAvailableTags();
    });
    this.api.listTagsForResource(APPLICATION_TAGGABLE_TYPE, this.appId()).subscribe((tags) => {
      this.appTags.set(tags);
      this.recomputeAvailableTags();
    });
  }

  /** This application's numeric id — tags are attached by id, not uuid. */
  private appId(): number {
    return this.app()?.id ?? 0;
  }

  private recomputeAvailableTags(): void {
    const attached = new Set(this.appTags().map((t) => t.uuid));
    this.availableTags.set(this.allTags().filter((t) => !attached.has(t.uuid)));
  }

  protected saveConfig(): void {
    this.savingConfig.set(true);
    this.api.updateApplication(this.uuid, this.configForm.getRawValue()).subscribe({
      next: (a) => {
        this.app.set(a);
        this.savingConfig.set(false);
      },
      error: () => this.savingConfig.set(false),
    });
  }

  protected addEnv(): void {
    if (this.envForm.invalid) return;
    this.api.upsertEnvVar(this.uuid, this.envForm.getRawValue()).subscribe(() => {
      this.envForm.reset();
      this.api.listEnvVars(this.uuid).subscribe((v) => this.envVars.set(v));
    });
  }

  protected removeEnv(env: EnvVar): void {
    this.api.deleteEnvVar(this.uuid, env.key).subscribe(() => {
      this.envVars.update((list) => list.filter((e) => e.key !== env.key));
    });
  }

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
    this.api.appLifecycle(this.uuid, action).subscribe(() => this.reload());
  }

  protected deploy(): void {
    this.api.deploy(this.uuid).subscribe((res) =>
      this.router.navigate(['/deployments', res.deploymentUuid])
    );
  }

  protected addTask(): void {
    if (this.taskForm.invalid) return;
    this.api.createTask(this.uuid, this.taskForm.getRawValue()).subscribe(() => {
      this.taskForm.reset();
      this.api.listTasks(this.uuid).subscribe((t) => this.tasks.set(t));
    });
  }

  protected runTask(task: ScheduledTask): void {
    this.api.runTask(this.uuid, task.uuid).subscribe();
  }

  protected removeTask(task: ScheduledTask): void {
    this.api.deleteTask(this.uuid, task.uuid).subscribe(() => {
      this.tasks.update((list) => list.filter((t) => t.uuid !== task.uuid));
      if (this.expandedTask() === task.uuid) this.expandedTask.set(null);
    });
  }

  protected toggleTaskExecutions(task: ScheduledTask): void {
    if (this.expandedTask() === task.uuid) {
      this.expandedTask.set(null);
      return;
    }
    this.expandedTask.set(task.uuid);
    this.taskExecutions.set([]);
    this.api.listTaskExecutions(this.uuid, task.uuid).subscribe((e) => this.taskExecutions.set(e));
  }

  protected addVolume(): void {
    if (this.volumeForm.invalid) return;
    this.api.createPersistentVolume(this.uuid, this.volumeForm.getRawValue()).subscribe(() => {
      this.volumeForm.reset();
      this.api.listVolumes(this.uuid).subscribe((v) => this.volumes.set(v));
    });
  }

  protected removePersistentVolume(vol: PersistentVolume): void {
    this.api.deletePersistentVolume(this.uuid, vol.id).subscribe(() => {
      this.volumes.update((v) => (v ? { ...v, persistent: v.persistent.filter((p) => p.id !== vol.id) } : v));
    });
  }

  protected addFileVolume(): void {
    if (this.fileVolumeForm.invalid) return;
    this.api.createFileVolume(this.uuid, this.fileVolumeForm.getRawValue()).subscribe((file: FileVolume) => {
      this.fileVolumeForm.reset();
      this.volumes.update((v) => (v ? { ...v, files: [...v.files, file] } : v));
    });
  }

  protected attachTag(tagUuid: string): void {
    if (!tagUuid) return;
    this.api
      .attachTag(tagUuid, { taggable_type: APPLICATION_TAGGABLE_TYPE, taggable_id: this.appId() })
      .subscribe(() => this.reloadTags());
  }

  protected detachTag(tag: Tag): void {
    this.api
      .detachTag(tag.uuid, { taggable_type: APPLICATION_TAGGABLE_TYPE, taggable_id: this.appId() })
      .subscribe(() => this.reloadTags());
  }

  protected refreshStatus(): void {
    this.api.appStatus(this.uuid).subscribe((s) => this.opsOutput.set(s.status));
  }

  protected refreshMetrics(): void {
    this.api.appMetrics(this.uuid).subscribe((m) => this.opsOutput.set(m.metrics));
  }

  protected runExec(): void {
    if (this.execForm.invalid) return;
    this.api.appExec(this.uuid, this.execForm.getRawValue().command).subscribe((r) => {
      this.opsOutput.set(r.output);
    });
  }

}
