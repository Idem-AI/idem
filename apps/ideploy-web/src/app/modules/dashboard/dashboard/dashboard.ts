import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../shared/services/api.service';
import { Application, Workspace } from '../../../shared/models/ideploy.models';
import { techIcon } from '../../../shared/utils/tech-icon.util';
import { appStatusDisplay } from '../../../shared/utils/app-status.util';

/**
 * Vercel-style overview: every application in a flat, searchable grid (each
 * card shows its stack icon, live status and the workspace it belongs to),
 * with an "Add New" menu covering the three things this platform actually
 * lets someone create — an application, a workspace, or a server — the same
 * way Vercel's own "Add New" covers a project, a team resource or a domain.
 * Left column stays the account-wide usage/alerts summary.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top toolbar -->
    <div class="mb-8 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-white/40"></i>
        <input class="input" style="padding-left:36px;" [placeholder]="'dashboard.searchProjects' | translate"
               [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </div>

      <select class="input w-auto" style="min-width:160px;" [ngModel]="selectedWorkspace()" (ngModelChange)="selectedWorkspace.set($event)">
        <option value="">{{ 'dashboard.allWorkspaces' | translate }}</option>
        @for (w of workspaces(); track w.uuid) {
          <option [value]="w.uuid">{{ w.name }}</option>
        }
      </select>

      <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <button class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 transition-colors cursor-pointer" [title]="'dashboard.gridView' | translate" (click)="view.set('grid')"
                [class.bg-white/10]="view() === 'grid'" [class.!text-white]="view() === 'grid'"><i class="fa-solid fa-table-cells-large"></i></button>
        <button class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 transition-colors cursor-pointer" [title]="'dashboard.listView' | translate" (click)="view.set('list')"
                [class.bg-white/10]="view() === 'list'" [class.!text-white]="view() === 'list'"><i class="fa-solid fa-list"></i></button>
      </div>

      <div class="relative">
        <button class="button flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]" (click)="toggleAddNew()">
          <i class="fa-solid fa-plus text-xs"></i> {{ 'dashboard.addNew' | translate }}
          <i class="fa-solid fa-chevron-down text-[10px] opacity-70"></i>
        </button>
        @if (addNewOpen()) {
          <div class="fixed inset-0 z-10" (click)="closeAddNew()"></div>
          <div class="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 shadow-2xl" style="background:var(--color-surface-1);">
            <a routerLink="/new-project" class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors" (click)="closeAddNew()">
              <i class="fa-solid fa-cube w-4 text-center" style="color:var(--color-primary-400);"></i>{{ 'dashboard.addNewApplication' | translate }}
            </a>
            <a routerLink="/workspaces/new" class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors" (click)="closeAddNew()">
              <i class="fa-solid fa-layer-group w-4 text-center" style="color:var(--color-primary-500);"></i>{{ 'dashboard.addNewWorkspace' | translate }}
            </a>
            <a routerLink="/servers/new" class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors" (click)="closeAddNew()">
              <i class="fa-solid fa-server w-4 text-center" style="color:var(--color-success);"></i>{{ 'dashboard.addNewServer' | translate }}
            </a>
          </div>
        }
      </div>
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
                  <a [routerLink]="m.link"
                     class="flex items-center justify-between text-sm rounded-lg -mx-2 px-2 py-1 hover:bg-white/5 transition-colors cursor-pointer">
                    <span class="flex items-center gap-2">
                      <i [class]="m.icon" class="text-xs" [style.color]="m.color"></i>{{ m.label }}
                    </span>
                    <span class="font-mono" style="color:var(--color-text-secondary);">{{ m.value }}</span>
                  </a>
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

      <!-- ===== Right column: the project grid ===== -->
      <div class="lg:col-span-2">
        <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">
          {{ 'dashboard.projects' | translate }}
          @if (!loading()) { <span style="color:var(--color-text-tertiary);">· {{ filteredApps().length }}</span> }
        </h2>

        @if (error()) {
          <div class="mb-4 rounded-md p-3 text-sm text-red-400" style="background:color-mix(in srgb, var(--color-danger) 8%, transparent);border:1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);">
            {{ error() }}
          </div>
        }

        @if (loading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="dbpulse rounded-2xl p-5 border border-white/5 bg-white/[0.02]" style="min-height: 92px;">
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
        } @else if (filteredApps().length > 0) {
          @if (view() === 'grid') {
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              @for (app of filteredApps(); track app.uuid) {
                <a class="db-glass block p-5 hover:border-blue-500/50 hover:bg-white/[0.01] transition-all duration-200 rounded-2xl group"
                   [routerLink]="['/applications', app.uuid]">
                  <div class="flex items-start gap-3">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <i [class]="stackIcon(app).icon" [style.color]="stackIcon(app).color"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate font-semibold font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ app.name }}</span>
                        <i [class]="statusOf(app.status).icon" class="shrink-0 text-xs" [style.color]="statusOf(app.status).color" [title]="statusOf(app.status).labelKey | translate"></i>
                      </div>
                      @if (app.fqdn) {
                        <p class="mt-0.5 truncate text-xs" style="color:var(--color-text-secondary);">{{ firstDomain(app.fqdn) }}</p>
                      }
                      @if (app.workspace_name) {
                        <span class="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]" style="background:var(--color-surface-2);color:var(--color-text-tertiary);">
                          <i class="fa-solid fa-layer-group" aria-hidden="true"></i>{{ app.workspace_name }}
                        </span>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          } @else {
            <div class="space-y-3">
              @for (app of filteredApps(); track app.uuid) {
                <a class="db-glass block p-4 hover:border-blue-500/50 hover:bg-white/[0.01] transition-all duration-200 rounded-xl group"
                   [routerLink]="['/applications', app.uuid]">
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex min-w-0 items-center gap-3">
                      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                        <i [class]="stackIcon(app).icon" [style.color]="stackIcon(app).color" class="text-sm"></i>
                      </div>
                      <span class="truncate font-semibold font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ app.name }}</span>
                      <i [class]="statusOf(app.status).icon" class="shrink-0 text-xs" [style.color]="statusOf(app.status).color" [title]="statusOf(app.status).labelKey | translate"></i>
                    </div>
                    <div class="flex shrink-0 items-center gap-3">
                      @if (app.workspace_name) {
                        <span class="text-xs" style="color:var(--color-text-tertiary);">{{ app.workspace_name }}</span>
                      }
                      @if (app.fqdn) {
                        <span class="hidden sm:inline text-xs truncate max-w-[220px]" style="color:var(--color-text-secondary);">{{ firstDomain(app.fqdn) }}</span>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        } @else if (query() || selectedWorkspace()) {
          <div class="db-glass p-8 text-center text-sm rounded-2xl" style="color:var(--color-text-secondary);">
            {{ 'dashboard.noMatch' | translate }}
          </div>
        } @else {
          <div class="db-glass p-8 text-center text-sm rounded-2xl" style="color:var(--color-text-secondary);">
            <i class="fa-solid fa-cube mb-2 block text-lg text-white/30" aria-hidden="true"></i>
            <p class="mb-3">{{ 'dashboard.noProjects' | translate }}</p>
            <a routerLink="/new-project" class="button inline-flex text-xs px-4 py-2 cursor-pointer">
              {{ 'dashboard.addNewApplication' | translate }}
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private tour = inject(TourService);

  protected readonly apps = signal<Application[]>([]);
  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly dbCount = signal(0);
  protected readonly quota = signal<{ apps: { used: number; limit: number }; servers: { used: number; limit: number } }>({
    apps: { used: 0, limit: 0 },
    servers: { used: 0, limit: 0 },
  });

  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<'grid' | 'list'>('grid');
  protected readonly query = signal('');
  protected readonly selectedWorkspace = signal('');
  protected readonly addNewOpen = signal(false);
  protected readonly loading = signal(true);

  protected readonly filteredApps = computed(() => {
    const q = this.query().trim().toLowerCase();
    const ws = this.selectedWorkspace();
    return this.apps().filter(
      (a) => (!q || a.name.toLowerCase().includes(q)) && (!ws || a.workspace_uuid === ws)
    );
  });

  protected readonly usageMetrics = computed(() => {
    const q = this.quota();
    return [
      { label: this.translate.instant('dashboard.metricApplications'), icon: 'fa-solid fa-cube', color: 'var(--color-primary-400)', value: `${q.apps.used} / ${q.apps.limit || '∞'}`, link: '/applications' },
      { label: this.translate.instant('dashboard.metricServers'), icon: 'fa-solid fa-server', color: 'var(--color-success)', value: `${q.servers.used} / ${q.servers.limit || '∞'}`, link: '/servers' },
      { label: this.translate.instant('dashboard.metricDatabases'), icon: 'fa-solid fa-database', color: '#a78bfa', value: `${this.dbCount()}`, link: '/databases' },
      { label: this.translate.instant('dashboard.metricProjects'), icon: 'fa-solid fa-layer-group', color: 'var(--color-primary-500)', value: `${this.workspaces().length}`, link: '/workspaces' },
    ];
  });

  ngOnInit(): void {
    // Le tableau de bord est la porte d'entrée d'iDeploy : c'est ici qu'on
    // présente les lieux, la première fois seulement.
    void this.tour.maybeStart();

    forkJoin({
      apps: this.api.listApplications(),
      workspaces: this.api.listWorkspaces(),
      databases: this.api.listDatabases(),
      quota: this.api.getQuota(),
    }).subscribe({
      next: (res) => {
        this.apps.set(res.apps);
        this.workspaces.set(res.workspaces);
        this.dbCount.set(res.databases.length);
        this.quota.set(res.quota);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('dashboard.loadError'));
      },
    });
  }

  protected stackIcon = techIcon;
  protected statusOf = appStatusDisplay;

  /** `fqdn` can hold several comma-separated domains; the card only has room for one. */
  protected firstDomain(fqdn: string): string {
    return fqdn.split(',')[0].trim().replace(/^https?:\/\//, '');
  }

  protected toggleAddNew(): void {
    this.addNewOpen.update((v) => !v);
  }
  protected closeAddNew(): void {
    this.addNewOpen.set(false);
  }
}
