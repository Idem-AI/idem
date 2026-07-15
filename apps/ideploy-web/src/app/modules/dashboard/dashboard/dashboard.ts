import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../shared/services/api.service';
import { Project, Server, ServiceTemplate } from '../../../shared/models/ideploy.models';

interface DeployRow {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  action: 'import' | 'deploy';
  template?: string;
}

/**
 * Vercel-style dashboard. Left column = Usage / Alerts / Recent deployments.
 * Right column = "Deploy your first project" with one-click rows (Import from
 * Git + templates) wired to /quick-deploy for non-technical one-click deploys.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top toolbar -->
    <div class="mb-8 flex items-center gap-3">
      <div class="relative flex-1"
           [class.focus-within:border-blue-500/80]="true"
           [class.focus-within:ring-2]="true"
           [class.focus-within:ring-blue-500/20]="true">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-white/40"></i>
        <input class="input" style="padding-left:36px;" [placeholder]="'dashboard.searchProjects' | translate"
               [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </div>
      <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <button class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 transition-colors cursor-pointer" [title]="'dashboard.gridView' | translate" (click)="view.set('grid')"
                [class.bg-white/10]="view() === 'grid'" [class.!text-white]="view() === 'grid'"><i class="fa-solid fa-table-cells-large"></i></button>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 transition-colors cursor-pointer" [title]="'dashboard.listView' | translate" (click)="view.set('list')"
                [class.bg-white/10]="view() === 'list'" [class.!text-white]="view() === 'list'"><i class="fa-solid fa-list"></i></button>
      </div>
      <button class="button flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]" (click)="goNewProject()">
        <i class="fa-solid fa-plus text-xs"></i> {{ 'dashboard.newProject' | translate }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- ===== Left column ===== -->
      <div class="lg:col-span-1 space-y-6">
        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">{{ 'dashboard.usage' | translate }}</h2>
          <div class="box p-5">
            <div class="mb-4 flex items-center justify-between">
              <span class="text-sm font-semibold text-white/90">{{ 'dashboard.currentLimit' | translate }}</span>
              <a routerLink="/subscription" class="rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-white/15 transition-colors"
                 style="background:var(--color-surface-2);color:var(--color-text-primary);">{{ 'dashboard.upgrade' | translate }}</a>
            </div>
            <div class="space-y-4">
              @if (loading()) {
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="flex items-center justify-between text-sm dbpulse">
                    <div class="h-4 w-24 rounded bg-white/10"></div>
                    <div class="h-4 w-12 rounded bg-white/10"></div>
                  </div>
                }
              } @else {
                @for (m of usageMetrics(); track m.label) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="flex items-center gap-2">
                      <i [class]="m.icon" class="text-xs" [style.color]="m.color"></i>{{ m.label }}
                    </span>
                    <span class="font-mono" style="color:var(--color-text-secondary);">{{ m.value }}</span>
                  </div>
                }
              }
            </div>
          </div>
        </div>

        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">{{ 'dashboard.alerts' | translate }}</h2>
          <div class="box text-center p-6">
            <p class="font-semibold text-white/90">{{ 'dashboard.getNotified' | translate }}</p>
            <p class="mt-1.5 text-xs leading-relaxed" style="color:var(--color-text-secondary);">
              {{ 'dashboard.alertsDescription' | translate }}
            </p>
            <a routerLink="/notifications" class="button-secondary mt-4 inline-flex text-xs px-4 py-2 cursor-pointer rounded-xl hover:bg-white/10 transition-colors">{{ 'dashboard.configureNotifications' | translate }}</a>
          </div>
        </div>

        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">{{ 'dashboard.recentDeployments' | translate }}</h2>
          <div class="box text-center p-6" style="color:var(--color-text-tertiary);">
            <i class="fa-solid fa-clock-rotate-left mb-2 text-lg text-white/30"></i>
            <p class="text-xs">{{ 'dashboard.recentDeploymentsEmpty' | translate }}</p>
          </div>
        </div>
      </div>

      <!-- ===== Right column ===== -->
      <div class="lg:col-span-2 space-y-6">
        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">{{ 'dashboard.projectHistory' | translate }}</h2>

          @if (loading()) {
            <!-- Skeleton Projects Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              @for (i of [1, 2]; track i) {
                <div class="dbpulse rounded-2xl p-5 border border-white/5 bg-white/[0.02]" style="min-height: 80px;">
                  <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-xl bg-white/10"></div>
                    <div class="space-y-2 flex-1">
                      <div class="h-4 w-28 rounded bg-white/10"></div>
                      <div class="h-3 w-40 rounded bg-white/10"></div>
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else if (projects().length > 0) {
            @if (view() === 'grid') {
              <!-- Projects Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (p of displayedProjects(); track p.uuid) {
                  <a class="db-glass block p-5 hover:border-blue-500/50 hover:bg-white/[0.01] transition-all duration-200 rounded-2xl group"
                     [routerLink]="['/projects', p.uuid]">
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                        <i class="fa-solid fa-layer-group"></i>
                      </div>
                      <div>
                        <span class="font-semibold font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ p.name }}</span>
                        @if (p.description) {
                          <p class="mt-0.5 text-xs truncate max-w-[200px]" style="color:var(--color-text-secondary);">{{ p.description }}</p>
                        }
                      </div>
                    </div>
                  </a>
                }
              </div>
            } @else {
              <!-- Projects List -->
              <div class="space-y-3">
                @for (p of displayedProjects(); track p.uuid) {
                  <a class="db-glass block p-4 hover:border-blue-500/50 hover:bg-white/[0.01] transition-all duration-200 rounded-xl group"
                     [routerLink]="['/projects', p.uuid]">
                    <div class="flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                          <i class="fa-solid fa-layer-group text-sm"></i>
                        </div>
                        <span class="font-semibold font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ p.name }}</span>
                      </div>
                      @if (p.description) {
                        <span class="text-xs truncate max-w-[300px]" style="color:var(--color-text-secondary);">{{ p.description }}</span>
                      }
                    </div>
                  </a>
                }
              </div>
            }
          } @else {
            <!-- Empty State -->
            <div class="db-glass p-8 text-center text-sm rounded-2xl" style="color:var(--color-text-secondary);">
              {{ 'dashboard.noProjects' | translate }}
            </div>
          }
        </div>

        <!-- Deploy / templates panel — always visible -->
        <div class="db-glass p-6 rounded-2xl">
            <!-- Highlighted Import Project Box -->
            <div class="db-glass p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(0, 0, 0, 0) 100%);">
              <div class="flex items-center gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                  <i class="fa-brands fa-github text-xl animate-pulse"></i>
                </div>
                <div>
                  <h4 class="font-bold text-white/95 text-base">{{ 'dashboard.importProject' | translate }}</h4>
                  <p class="text-xs mt-0.5" style="color:var(--color-text-secondary);">{{ 'dashboard.importProjectDescription' | translate }}</p>
                </div>
              </div>
              <button class="button cursor-pointer text-xs font-semibold py-2.5 px-5 shadow-lg shadow-blue-500/15 hover:scale-[1.02] transition-transform" (click)="goNewProject()">
                {{ 'dashboard.importRepository' | translate }}
              </button>
            </div>

            @if (error()) {
              <div class="mb-4 rounded-md p-3 text-sm text-red-400" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);">
                {{ error() }}
                @if (error()!.toLowerCase().includes('server')) {
                  · <a routerLink="/servers/new" style="color:#60a5fa;">{{ 'dashboard.addServer' | translate }}</a>
                }
              </div>
            }

            <!-- Templates title -->
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-sm font-semibold font-mono text-white/80">{{ 'dashboard.startWithTemplate' | translate }}</h4>
              @if (loading()) {
                <div class="h-3 w-16 rounded bg-white/10 dbpulse"></div>
              } @else {
                <span class="text-[10px] font-mono" style="color:var(--color-text-secondary);">{{ 'dashboard.available' | translate: { count: templateRows().length } }}</span>
              }
            </div>

            <!-- Deploy rows (Vercel-style list) -->
            <div class="overflow-hidden rounded-xl border border-white/10" style="background-color: rgba(0, 0, 0, 0.1);">
              <!-- Template rows / loading skeletons -->
              @if (loading()) {
                @for (i of [1, 2, 3]; track i) {
                  <div class="flex items-center gap-4 p-4 dbpulse border-b border-white/5">
                    <div class="h-9 w-9 rounded-xl bg-white/10"></div>
                    <div class="space-y-1.5 flex-1">
                      <div class="h-4 w-28 rounded bg-white/10"></div>
                      <div class="h-3 w-40 rounded bg-white/10"></div>
                    </div>
                    <div class="h-7 w-16 rounded-lg bg-white/10"></div>
                  </div>
                }
              } @else {
                @for (row of templateRows(); track row.id) {
                  <div class="flex items-center gap-4 p-4 hover:bg-white/[0.01] transition-colors" style="border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                      <i [class]="getTemplateIcon(row.title)"></i>
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold capitalize text-white/90">{{ row.title }}</div>
                      <div class="text-xs" style="color:var(--color-text-secondary);">{{ row.description }}</div>
                    </div>
                    <button class="button-secondary cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors" [disabled]="busy()" (click)="deployTemplate(row)">{{ 'dashboard.deploy' | translate }}</button>
                  </div>
                }
              }

              <!-- Browse templates -->
              <a routerLink="/services" class="flex items-center gap-4 p-4 hover:bg-white/[0.01] transition-colors group">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <i class="fa-solid fa-compass"></i>
                </div>
                <div class="flex-1">
                  <div class="font-semibold text-white/90 group-hover:text-blue-400 transition-colors">{{ 'dashboard.browseTemplates' | translate }}</div>
                  <div class="text-xs" style="color:var(--color-text-secondary);">{{ 'dashboard.browseTemplatesDescription' | translate }}</div>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square text-xs text-white/40 group-hover:text-blue-400 transition-colors"></i>
              </a>
            </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly servers = signal<Server[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly dbCount = signal(0);
  protected readonly quota = signal<{ apps: { used: number; limit: number }; servers: { used: number; limit: number } }>({
    apps: { used: 0, limit: 0 },
    servers: { used: 0, limit: 0 },
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<'grid' | 'list'>('grid');
  protected readonly query = signal('');
  protected readonly loading = signal(true);

  protected readonly projectsContainerClass = computed(() =>
    this.view() === 'grid' ? 'box grid grid-cols-1 sm:grid-cols-2 gap-3' : 'box space-y-3'
  );

  protected readonly filteredProjects = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.projects().filter((p) => p.name.toLowerCase().includes(q)) : this.projects();
  });

  protected readonly displayedProjects = computed(() => {
    return this.filteredProjects().slice(0, 2);
  });

  protected readonly usageMetrics = computed(() => {
    const q = this.quota();
    return [
      { label: this.translate.instant('dashboard.metricApplications'), icon: 'fa-solid fa-cube', color: '#60a5fa', value: `${q.apps.used} / ${q.apps.limit || '∞'}` },
      { label: this.translate.instant('dashboard.metricServers'), icon: 'fa-solid fa-server', color: '#4ade80', value: `${q.servers.used} / ${q.servers.limit || '∞'}` },
      { label: this.translate.instant('dashboard.metricDatabases'), icon: 'fa-solid fa-database', color: '#a78bfa', value: `${this.dbCount()}` },
      { label: this.translate.instant('dashboard.metricProjects'), icon: 'fa-solid fa-layer-group', color: '#2563eb', value: `${this.projects().length}` },
    ];
  });

  /** Built-in boilerplates + the team's one-click service templates. */
  protected readonly templateRows = computed<DeployRow[]>(() => {
    const tpls = this.templates();
    return tpls.map((t) => ({
      id: t.name,
      icon: 'fa-solid fa-cube',
      iconColor: '#60a5fa',
      title: t.name,
      description: t.slogan || this.translate.instant('dashboard.oneClickService'),
      action: 'deploy' as const,
      template: t.name,
    }));
  });

  ngOnInit(): void {
    forkJoin({
      projects: this.api.listProjects(),
      servers: this.api.listServers(),
      databases: this.api.listDatabases(),
      quota: this.api.getQuota(),
      templates: this.api.listServiceTemplates(),
    }).subscribe({
      next: (res) => {
        this.projects.set(res.projects);
        this.servers.set(res.servers);
        this.dbCount.set(res.databases.length);
        this.quota.set(res.quota);
        this.templates.set(res.templates.slice(0, 5));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('dashboard.loadError'));
      },
    });
  }

  protected getTemplateIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('angular')) return 'fa-brands fa-angular text-red-500';
    if (n.includes('node')) return 'fa-brands fa-node-js text-green-500';
    if (n.includes('python')) return 'fa-brands fa-python text-blue-400';
    if (n.includes('docker')) return 'fa-brands fa-docker text-blue-400';
    if (n.includes('next') || n.includes('react')) return 'fa-brands fa-react text-sky-400';
    if (n.includes('static')) return 'fa-solid fa-file-code text-amber-500';
    if (n.includes('vite')) return 'fa-solid fa-bolt text-yellow-400';
    return 'fa-solid fa-cube text-blue-400';
  }

  protected goNewProject(): void {
    void this.router.navigate(['/new-project']);
  }
  protected deployTemplate(row: DeployRow): void {
    if (row.template) this.run({ name: row.template, template: row.template });
  }

  private run(body: { name: string; git_repository?: string; template?: string }): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.quickDeploy(body).subscribe({
      next: (res) => {
        this.busy.set(false);
        void this.router.navigate(res.deploymentUuid ? ['/deployments', res.deploymentUuid] : ['/services']);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('dashboard.deploymentFailed'));
      },
    });
  }
}
