import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top toolbar -->
    <div class="mb-6 flex items-center gap-3">
      <div class="relative flex-1">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style="color:#8d919a;"></i>
        <input class="input" style="padding-left:32px;" placeholder="Search Projects…"
               [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </div>
      <button class="button-secondary" title="Grid view" (click)="view.set('grid')"
              [class.menu-item-active]="view() === 'grid'"><i class="fa-solid fa-table-cells-large"></i></button>
      <button class="button-secondary" title="List view" (click)="view.set('list')"
              [class.menu-item-active]="view() === 'list'"><i class="fa-solid fa-list"></i></button>
      <button class="button" (click)="showDeploy.set(true)"><i class="fa-solid fa-plus mr-2"></i>Add New</button>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- ===== Left column ===== -->
      <div class="lg:col-span-1 space-y-6">
        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">Usage</h2>
          <div class="box">
            <div class="mb-4 flex items-center justify-between">
              <span class="text-sm font-semibold">Current</span>
              <a routerLink="/subscription" class="rounded-md px-2.5 py-1 text-xs font-semibold"
                 style="background:var(--color-surface-2);color:var(--color-text-primary);">Upgrade</a>
            </div>
            <div class="space-y-3">
              @for (m of usageMetrics(); track m.label) {
                <div class="flex items-center justify-between text-sm">
                  <span class="flex items-center gap-2">
                    <i [class]="m.icon" class="text-xs" [style.color]="m.color"></i>{{ m.label }}
                  </span>
                  <span style="color:var(--color-text-secondary);">{{ m.value }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">Alerts</h2>
          <div class="box text-center">
            <p class="font-semibold">Get notified about your deployments</p>
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
              Slack, Discord, Telegram, email — be alerted when a deploy fails or a server goes down.
            </p>
            <a routerLink="/notifications" class="button-secondary mt-3 inline-flex">Configure notifications</a>
          </div>
        </div>

        <div>
          <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">Recent Deployments</h2>
          <div class="box text-center" style="color:var(--color-text-tertiary);">
            <i class="fa-solid fa-clock-rotate-left mb-2 text-lg"></i>
            <p class="text-sm">Deployments you trigger will appear here.</p>
          </div>
        </div>
      </div>

      <!-- ===== Right column ===== -->
      <div class="lg:col-span-2">
        <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">Projects</h2>

        @if (showDeploy() || projects().length === 0) {
          <div class="box">
            <div class="py-6 text-center">
              <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                   style="background:var(--color-surface-2);">
                <i class="fa-solid fa-cloud-arrow-up text-xl" style="color:var(--color-text-secondary);"></i>
              </div>
              <h3 class="text-lg font-semibold">Deploy your first project</h3>
              <p class="text-sm" style="color:var(--color-text-secondary);">
                Start with one of our templates<br />or import something from Git.
              </p>
            </div>

            @if (error()) {
              <div class="mb-4 rounded-md p-3 text-sm text-red-400" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);">
                {{ error() }}
                @if (error()!.toLowerCase().includes('server')) {
                  · <a routerLink="/servers/new" style="color:#60a5fa;">Add a server</a>
                }
              </div>
            }

            <!-- Deploy rows (Vercel-style list) -->
            <div class="overflow-hidden rounded-xl" style="border:1px solid var(--color-surface-2);">
              <!-- Import Project -->
              <div style="border-bottom:1px solid var(--color-surface-2);">
                <div class="flex items-center gap-3 p-4">
                  <div class="flex h-9 w-9 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                    <i class="fa-solid fa-circle-plus" style="color:var(--color-text-secondary);"></i>
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold">Import Project</div>
                    <div class="text-sm" style="color:var(--color-text-secondary);">Add a repo from your Git provider</div>
                  </div>
                  <button class="button-secondary" (click)="importOpen.set(!importOpen())">Import</button>
                </div>
                @if (importOpen()) {
                  <div class="flex flex-wrap gap-2 px-4 pb-4">
                    <input class="input flex-1" placeholder="App name" [(ngModel)]="gitName" />
                    <input class="input flex-[2]" placeholder="https://github.com/org/repo" [(ngModel)]="gitUrl" />
                    <button class="button" [disabled]="!gitName || !gitUrl || busy()" (click)="deployGit()">
                      {{ busy() ? '…' : 'Deploy' }}
                    </button>
                  </div>
                }
              </div>

              <!-- Template rows -->
              @for (row of templateRows(); track row.id) {
                <div class="flex items-center gap-3 p-4" style="border-bottom:1px solid var(--color-surface-2);">
                  <div class="flex h-9 w-9 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                    <i [class]="row.icon" [style.color]="row.iconColor"></i>
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold capitalize">{{ row.title }}</div>
                    <div class="text-sm" style="color:var(--color-text-secondary);">{{ row.description }}</div>
                  </div>
                  <button class="button-secondary" [disabled]="busy()" (click)="deployTemplate(row)">Deploy</button>
                </div>
              }

              <!-- Browse templates -->
              <a routerLink="/services" class="flex items-center gap-3 p-4">
                <div class="flex-1">
                  <div class="font-semibold">Browse Templates</div>
                  <div class="text-sm" style="color:var(--color-text-secondary);">Databases, stacks and one-click apps</div>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square" style="color:var(--color-text-secondary);"></i>
              </a>
            </div>

            @if (projects().length > 0) {
              <button class="button-secondary mt-4 w-full" (click)="showDeploy.set(false)">Back to projects</button>
            }
          </div>
        } @else {
          <div [class]="projectsContainerClass()">
            @for (p of filteredProjects(); track p.uuid) {
              <a class="block rounded-lg p-4 hover:border-white/20" style="border:1px solid var(--color-surface-2);"
                 [routerLink]="['/projects', p.uuid]">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i>
                  <span class="font-semibold">{{ p.name }}</span>
                </div>
                @if (p.description) {
                  <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ p.description }}</p>
                }
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly projects = signal<Project[]>([]);
  protected readonly servers = signal<Server[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly dbCount = signal(0);
  protected readonly quota = signal<{ apps: { used: number; limit: number }; servers: { used: number; limit: number } }>({
    apps: { used: 0, limit: 0 },
    servers: { used: 0, limit: 0 },
  });

  protected readonly showDeploy = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<'grid' | 'list'>('grid');
  protected readonly query = signal('');

  protected gitName = '';
  protected gitUrl = '';

  protected readonly projectsContainerClass = computed(() =>
    this.view() === 'grid' ? 'box grid grid-cols-1 sm:grid-cols-2 gap-3' : 'box space-y-3'
  );

  protected readonly filteredProjects = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.projects().filter((p) => p.name.toLowerCase().includes(q)) : this.projects();
  });

  protected readonly usageMetrics = computed(() => {
    const q = this.quota();
    return [
      { label: 'Applications', icon: 'fa-solid fa-cube', color: '#60a5fa', value: `${q.apps.used} / ${q.apps.limit || '∞'}` },
      { label: 'Servers', icon: 'fa-solid fa-server', color: '#4ade80', value: `${q.servers.used} / ${q.servers.limit || '∞'}` },
      { label: 'Databases', icon: 'fa-solid fa-database', color: '#a78bfa', value: `${this.dbCount()}` },
      { label: 'Projects', icon: 'fa-solid fa-layer-group', color: '#2563eb', value: `${this.projects().length}` },
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
      description: t.slogan || 'One-click service',
      action: 'deploy' as const,
      template: t.name,
    }));
  });

  ngOnInit(): void {
    this.api.listProjects().subscribe((p) => this.projects.set(p));
    this.api.listServers().subscribe((s) => this.servers.set(s));
    this.api.listDatabases().subscribe((d) => this.dbCount.set(d.length));
    this.api.getQuota().subscribe((q) => this.quota.set(q));
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t.slice(0, 5)));
  }

  protected deployGit(): void {
    this.run({ name: this.gitName, git_repository: this.gitUrl });
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
        this.error.set(e?.error?.error?.message ?? 'Deployment failed');
      },
    });
  }
}
