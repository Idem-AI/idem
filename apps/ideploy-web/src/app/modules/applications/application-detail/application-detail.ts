import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import {
  Application,
  ContainerUsage,
  DeploymentHistoryItem,
  FirewallConfig,
  PipelineConfig,
} from '../../../shared/models/ideploy.models';
import { techIcon } from '../../../shared/utils/tech-icon.util';
import { appStatusDisplay } from '../../../shared/utils/app-status.util';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { TourService } from '../../../shared/services/tour.service';
import { AppEnvTabComponent } from './app-env-tab';
import { AppTasksTabComponent } from './app-tasks-tab';
import { AppStorageTabComponent } from './app-storage-tab';
import { AppSettingsTabComponent } from './app-settings-tab';

type Tab = 'overview' | 'env' | 'storage' | 'tasks' | 'settings';

/** One entry of the tab bar: a tab of this page, or a page of its own. */
interface NavItem {
  key: string;
  icon: string;
  tab?: Tab;
  route?: string;
}

const NAV: NavItem[] = [
  { key: 'overview', icon: 'pi pi-home', tab: 'overview' },
  { key: 'deployments', icon: 'pi pi-history', route: 'deployments' },
  { key: 'env', icon: 'pi pi-key', tab: 'env' },
  { key: 'storage', icon: 'pi pi-database', tab: 'storage' },
  { key: 'tasks', icon: 'pi pi-clock', tab: 'tasks' },
  { key: 'pipeline', icon: 'pi pi-sitemap', route: 'pipeline' },
  { key: 'security', icon: 'pi pi-shield', route: 'security' },
  { key: 'insights', icon: 'pi pi-chart-bar', route: 'insights' },
  { key: 'settings', icon: 'pi pi-cog', tab: 'settings' },
];

const TABS: Tab[] = ['overview', 'env', 'storage', 'tasks', 'settings'];

/**
 * Application detail.
 *
 * One header that always answers "what is it, is it up, where is it" and
 * holds the action people come for (redeploy); then a tab bar that names
 * every place this application has — tabs of this page and the pages of
 * their own (deployments, pipeline, security, insights) side by side, so
 * nothing is found only by scrolling. The overview keeps what matters at a
 * glance, and its checklist points at where each missing step is done.
 * The active tab lives in `?tab=`, so a reload or a shared link lands on it.
 */
@Component({
  selector: 'app-application-detail',
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    IdemLoaderComponent,
    EmptyStateComponent,
    AppEnvTabComponent,
    AppTasksTabComponent,
    AppStorageTabComponent,
    AppSettingsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/applications" class="mb-5 inline-flex items-center gap-2 text-sm transition-smooth hover:text-text-primary" style="color:var(--color-text-secondary);">
      <i class="pi pi-arrow-left text-xs"></i>{{ 'applications.list.title' | translate }}
    </a>

    @if (notFound()) {
      <div class="glass-card">
        <app-empty-state kind="search" [title]="'applications.detail.notFound' | translate">
          <a class="outer-button mt-5" routerLink="/applications">{{ 'applications.list.title' | translate }}</a>
        </app-empty-state>
      </div>
    } @else if (app(); as a) {
      <!-- Header: identity, state, address — and the one action people come for. -->
      <header class="mb-6 flex flex-wrap items-start justify-between gap-4" data-tour="ideploy-app-header">
        <div class="flex min-w-0 items-center gap-4">
          <span class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl" style="background:var(--glass-bg-subtle);border:1px solid var(--glass-border);">
            <i [class]="stackIcon().icon" class="text-2xl" [style.color]="stackIcon().color"></i>
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="heading-serif truncate" style="font-size:28px;font-weight:700;line-height:1.15;color:var(--color-text-primary);">{{ a.name }}</h1>
              <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [style.color]="statusOf(a.status).color" style="background:color-mix(in srgb, currentColor 10%, transparent);">
                <i [class]="statusOf(a.status).icon" class="text-[10px]"></i>{{ statusOf(a.status).labelKey | translate }}
              </span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style="color:var(--color-text-secondary);">
              @if (shortDomain()) {
                <a class="inline-flex items-center gap-1.5 font-mono hover:underline" style="color:var(--color-primary-500);" [href]="a.link ?? 'https://' + shortDomain()" target="_blank" rel="noopener noreferrer">
                  {{ shortDomain() }}<i class="pi pi-external-link text-[10px]"></i>
                </a>
              }
              @if (a.git_repository) {
                <a class="inline-flex items-center gap-1.5 hover:underline" [href]="a.git_repository" target="_blank" rel="noopener noreferrer">
                  <i class="pi text-xs" [class.pi-github]="a.git_repository.includes('github')" [class.pi-code]="!a.git_repository.includes('github')"></i>
                  {{ repoName(a.git_repository) }}<span style="color:var(--color-text-tertiary);">· {{ a.git_branch || 'main' }}</span>
                </a>
              }
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          @if (a.link) {
            <a class="outer-button" [href]="a.link" target="_blank" rel="noopener noreferrer"><i class="pi pi-external-link mr-2 text-xs"></i>{{ 'applications.detail.visit' | translate }}</a>
          }
          <button type="button" class="inner-button" [disabled]="deploying()" (click)="deploy()">
            @if (deploying()) { <idem-loader size="xs" /> } @else { <i class="pi pi-send mr-2 text-xs"></i> }
            {{ 'applications.detail.redeploy' | translate }}
          </button>
          <div class="relative">
            <button type="button" class="outer-button" [attr.aria-label]="'servers.moreActions' | translate" [attr.aria-expanded]="menuOpen()" [disabled]="!!acting()" (click)="menuOpen.set(!menuOpen())">
              @if (acting()) { <idem-loader size="xs" /> } @else { <i class="pi pi-ellipsis-h text-xs"></i> }
            </button>
            @if (menuOpen()) {
              <div class="fixed inset-0 z-10" (click)="menuOpen.set(false)"></div>
              <div class="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border shadow-glass" style="background:var(--color-surface-1);border-color:var(--glass-border);" role="menu">
                <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="lifecycle('restart')">
                  <i class="pi pi-refresh w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'applications.detail.restart' | translate }}
                </button>
                @if (isRunning()) {
                  <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="lifecycle('stop')">
                    <i class="pi pi-stop w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'applications.detail.stop' | translate }}
                  </button>
                } @else {
                  <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="lifecycle('start')">
                    <i class="pi pi-play w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'applications.detail.start' | translate }}
                  </button>
                }
                <a role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" [routerLink]="['/applications', uuid, 'terminal']">
                  <i class="pi pi-code w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'terminal.open' | translate }}
                </a>
                <div class="border-t" style="border-color:var(--glass-border-subtle);"></div>
                <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-danger);" (click)="goToDelete()">
                  <i class="pi pi-trash w-4 text-center text-xs"></i>{{ 'applications.detail.deleteApplication' | translate }}
                </button>
              </div>
            }
          </div>
        </div>
      </header>

      @if (actionError()) {
        <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ actionError() }}</p>
      }

      <!-- Every place this application has, in one bar. -->
      <nav class="custom-scrollbar mb-6 flex gap-1 overflow-x-auto border-b" style="border-color:var(--glass-border);" data-tour="ideploy-app-tabs" [attr.aria-label]="'applications.detail.sections' | translate">
        @for (item of nav; track item.key) {
          @if (item.tab) {
            <button
              type="button"
              class="-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-smooth"
              [style.border-color]="tab() === item.tab ? 'var(--color-primary-500)' : 'transparent'"
              [style.color]="tab() === item.tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
              [attr.aria-current]="tab() === item.tab ? 'page' : null"
              (click)="setTab(item.tab)"
            >
              <i [class]="item.icon" class="text-xs"></i>{{ 'applications.detail.tab.' + item.key | translate }}
            </button>
          } @else {
            <a
              class="-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium transition-smooth hover:text-text-primary"
              style="color:var(--color-text-secondary);"
              [routerLink]="['/applications', uuid, item.route]"
            >
              <i [class]="item.icon" class="text-xs"></i>{{ 'applications.detail.tab.' + item.key | translate }}
            </a>
          }
        }
      </nav>

      @switch (tab()) {
        @case ('env') { <app-env-tab [uuid]="uuid" (countChange)="envCount.set($event)" /> }
        @case ('storage') { <app-storage-tab [uuid]="uuid" /> }
        @case ('tasks') { <app-tasks-tab [uuid]="uuid" /> }
        @case ('settings') { <app-settings-tab [app]="a" (updated)="app.set($event)" /> }
        @default {
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-6 lg:col-span-2">
              <!-- What is live right now. -->
              <section class="glass-card overflow-hidden">
                <div class="grid grid-cols-1 gap-5 p-5 md:grid-cols-[240px_1fr]">
                  <div class="relative aspect-video overflow-hidden rounded-xl border" style="background:var(--glass-bg-subtle);border-color:var(--glass-border-subtle);">
                    @if (previewUrl(); as url) {
                      <iframe [src]="url" [title]="'applications.detail.previewTitle' | translate" sandbox="allow-scripts allow-same-origin allow-forms" tabindex="-1"
                        style="width:400%;height:400%;transform:scale(0.25);transform-origin:0 0;border:0;pointer-events:none;"></iframe>
                    } @else {
                      <div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                        <i [class]="stackIcon().icon" class="text-3xl opacity-40" [style.color]="stackIcon().color"></i>
                        <span class="text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.detail.noPreview' | translate }}</span>
                      </div>
                    }
                  </div>
                  <dl class="grid grid-cols-2 content-start gap-x-6 gap-y-4 text-sm">
                    <div class="col-span-2">
                      <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.deploymentUrl' | translate }}</dt>
                      <dd class="mt-0.5 truncate font-mono font-semibold text-text-primary">{{ shortDomain() || ('applications.detail.noDomainYet' | translate) }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.lastDeployment' | translate }}</dt>
                      <dd class="mt-0.5">
                        @if (latestDeployment(); as dep) {
                          <span class="inline-flex items-center gap-1.5" [style.color]="depColor(dep.status)">
                            <i class="pi pi-circle-fill text-[7px]"></i>{{ depLabel(dep.status) | translate }}
                          </span>
                          <span class="block text-xs" style="color:var(--color-text-tertiary);">{{ dep.created_at | date: 'medium' }}</span>
                        } @else {
                          <span style="color:var(--color-text-tertiary);">{{ 'applications.detail.never' | translate }}</span>
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.sourceLabel' | translate }}</dt>
                      <dd class="mt-0.5 font-mono text-xs">
                        {{ a.git_branch || 'main' }}
                        @if (latestDeployment(); as dep) { <span style="color:var(--color-text-tertiary);">· {{ shortCommit(dep.commit) }}</span> }
                      </dd>
                    </div>
                  </dl>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs" style="border-top:1px solid var(--glass-border-subtle);color:var(--color-text-secondary);">
                  <span><i class="pi pi-info-circle mr-1.5"></i>{{ 'applications.detail.pushToUpdate' | translate: { branch: a.git_branch || 'main' } }}</span>
                  <a class="font-semibold hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'deployments']">
                    <i class="pi pi-history mr-1"></i>{{ 'applications.detail.rollback' | translate }}
                  </a>
                </div>
              </section>

              <!-- Recent deployments. -->
              <section class="glass-card overflow-hidden">
                <header class="flex items-center justify-between gap-2 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
                  <h2 class="font-semibold text-text-primary">{{ 'applications.detail.recentDeployments' | translate }}</h2>
                  <a class="text-xs font-semibold hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'deployments']">{{ 'applications.detail.manageDeployments' | translate }}</a>
                </header>
                @if (deployments().length === 0) {
                  <app-empty-state kind="activity" [title]="'applications.detail.noDeployments' | translate" [body]="'applications.detail.noDeploymentsHint' | translate" />
                } @else {
                  @for (dep of deployments().slice(0, 5); track dep.deployment_uuid; let last = $last) {
                    <a class="flex items-center gap-3 px-5 py-3 text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'" [routerLink]="['/deployments', dep.deployment_uuid]">
                      <span class="inline-flex w-28 flex-shrink-0 items-center gap-1.5 text-xs font-medium" [style.color]="depColor(dep.status)">
                        <i class="pi pi-circle-fill text-[7px]"></i>{{ depLabel(dep.status) | translate }}
                      </span>
                      <code class="font-mono text-xs text-text-primary">{{ shortCommit(dep.commit) }}</code>
                      <span class="text-xs" style="color:var(--color-text-tertiary);">{{ (dep.is_webhook ? 'deployments.viaWebhook' : 'deployments.manual') | translate }}</span>
                      <span class="ml-auto text-xs" style="color:var(--color-text-secondary);">{{ dep.created_at | date: 'short' }}</span>
                      <i class="pi pi-chevron-right text-[10px]" style="color:var(--color-text-tertiary);"></i>
                    </a>
                  }
                }
              </section>
            </div>

            <aside class="space-y-6">
              <!-- What's left to set up — each line goes where it's done; gone once everything is. -->
              @if (checklistDone() < checklistItems().length) {
                <section class="glass-card p-5" data-tour="ideploy-app-checklist">
                  <div class="mb-1 flex items-center justify-between">
                    <h2 class="text-sm font-semibold text-text-primary">{{ 'applications.detail.checklist' | translate }}</h2>
                    <span class="text-xs" style="color:var(--color-text-secondary);">{{ checklistDone() }}/{{ checklistItems().length }}</span>
                  </div>
                  <div class="mb-4 h-1.5 overflow-hidden rounded-full" style="background:var(--glass-bg-subtle);">
                    <div class="h-full rounded-full transition-smooth" style="background:var(--color-primary-500);" [style.width.%]="(checklistDone() / checklistItems().length) * 100"></div>
                  </div>
                  <ul class="-mx-2 space-y-0.5">
                    @for (item of checklistItems(); track item.key) {
                      <li>
                        @if (item.done) {
                          <span class="flex items-center gap-2.5 px-2 py-1.5 text-sm" style="color:var(--color-text-tertiary);">
                            <i class="pi pi-check-circle text-sm" style="color:var(--color-success);"></i>
                            <span class="line-through">{{ 'applications.detail.checklistItem.' + item.key | translate }}</span>
                          </span>
                        } @else if (item.tab) {
                          <button type="button" class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-text-primary transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="setTab(item.tab)">
                            <i class="pi pi-circle text-sm" style="color:var(--color-text-tertiary);"></i>
                            <span class="flex-1">{{ 'applications.detail.checklistItem.' + item.key | translate }}</span>
                            <i class="pi pi-arrow-right text-[10px]" style="color:var(--color-primary-500);"></i>
                          </button>
                        } @else {
                          <a class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-smooth hover:bg-[var(--glass-bg-subtle)]" [routerLink]="['/applications', uuid, item.route]">
                            <i class="pi pi-circle text-sm" style="color:var(--color-text-tertiary);"></i>
                            <span class="flex-1">{{ 'applications.detail.checklistItem.' + item.key | translate }}</span>
                            <i class="pi pi-arrow-right text-[10px]" style="color:var(--color-primary-500);"></i>
                          </a>
                        }
                      </li>
                    }
                  </ul>
                </section>
              }

              <section class="glass-card p-5">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-text-primary">{{ 'applications.detail.resourceUsage' | translate }}</h2>
                  <a class="text-xs font-semibold hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'insights']">{{ 'applications.detail.viewInsights' | translate }}</a>
                </div>
                @if (usage(); as u) {
                  <dl class="space-y-2.5 text-sm">
                    <div class="flex items-center justify-between"><dt style="color:var(--color-text-secondary);">{{ 'insights.cpu' | translate }}</dt><dd class="font-mono text-text-primary">{{ u.cpuPercent !== null ? u.cpuPercent.toFixed(1) + '%' : '—' }}</dd></div>
                    <div class="flex items-center justify-between"><dt style="color:var(--color-text-secondary);">{{ 'insights.memory' | translate }}</dt><dd class="font-mono text-text-primary">{{ formatBytes(u.memoryUsedBytes) }}</dd></div>
                    <div class="flex items-center justify-between"><dt style="color:var(--color-text-secondary);">{{ 'insights.networkOut' | translate }}</dt><dd class="font-mono text-text-primary">{{ formatBytes(u.networkOutBytes) }}</dd></div>
                  </dl>
                } @else {
                  <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noUsage' | translate }}</p>
                }
              </section>

              <section class="glass-card p-5">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-text-primary">{{ 'applications.detail.firewallOverview' | translate }}</h2>
                  <a class="text-xs font-semibold hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/applications', uuid, 'security']">{{ 'applications.detail.manageSecurity' | translate }}</a>
                </div>
                @if (firewall(); as fw) {
                  <p class="mb-3 inline-flex items-center gap-1.5 text-sm" [style.color]="fw.enabled ? 'var(--color-success)' : 'var(--color-text-tertiary)'">
                    <i class="pi text-xs" [class.pi-shield]="fw.enabled" [class.pi-times-circle]="!fw.enabled"></i>
                    {{ (fw.enabled ? 'applications.detail.protected' : 'applications.detail.notProtected') | translate }}
                  </p>
                  <dl class="space-y-2.5 text-sm">
                    <div class="flex items-center justify-between"><dt style="color:var(--color-text-secondary);">{{ 'applications.detail.totalRequests' | translate }}</dt><dd class="font-mono text-text-primary">{{ fw.total_requests }}</dd></div>
                    <div class="flex items-center justify-between"><dt style="color:var(--color-text-secondary);">{{ 'applications.detail.blockedRequests' | translate }}</dt><dd class="font-mono text-text-primary">{{ fw.total_blocked }}</dd></div>
                  </dl>
                } @else {
                  <div class="skeleton h-4 w-2/3 rounded" aria-hidden="true"></div>
                }
              </section>
            </aside>
          </div>
        }
      }
    } @else {
      <div class="space-y-6" aria-hidden="true">
        <div class="flex items-center gap-4"><div class="skeleton h-14 w-14 rounded-2xl"></div><div class="flex-1 space-y-2"><div class="skeleton h-6 w-1/3 rounded"></div><div class="skeleton h-4 w-1/4 rounded"></div></div></div>
        <div class="skeleton h-10 rounded"></div>
        <div class="skeleton h-56 rounded-2xl"></div>
      </div>
    }
  `,
})
export class ApplicationDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private tour = inject(TourService);
  /** La visite n'est proposée qu'au premier chargement, pas à chaque rechargement. */
  private tourOffered = false;

  protected readonly nav = NAV;

  protected readonly app = signal<Application | null>(null);
  protected readonly notFound = signal(false);
  protected readonly deployments = signal<DeploymentHistoryItem[]>([]);
  protected readonly firewall = signal<FirewallConfig | null>(null);
  protected readonly pipeline = signal<PipelineConfig | null>(null);
  /** This application's own container — the resource card's data. */
  protected readonly usage = signal<ContainerUsage | null>(null);
  /** Kept here, not in the env tab, because the overview's checklist reads it. */
  protected readonly envCount = signal(0);

  protected readonly tab = signal<Tab>('overview');
  protected readonly menuOpen = signal(false);
  protected readonly deploying = signal(false);
  protected readonly acting = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected uuid = '';

  protected stackIcon = (): ReturnType<typeof techIcon> => techIcon(this.app() ?? {});
  protected statusOf = appStatusDisplay;

  protected readonly latestDeployment = computed<DeploymentHistoryItem | null>(() => this.deployments()[0] ?? null);
  protected readonly isRunning = computed(() => (this.app()?.status ?? '').startsWith('running'));

  /**
   * A live iframe of the app's own URL — always current, no screenshot
   * service to run. Only offered once the app has actually started (`link`
   * set): pointing an iframe at a container that never booted is not a
   * preview of anything. An app that forbids framing shows an empty pane.
   */
  protected readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const link = this.app()?.link;
    return link ? this.sanitizer.bypassSecurityTrustResourceUrl(link) : null;
  });

  /**
   * Real onboarding steps for this platform, each with where it's done — a
   * tab of this page or a page of its own — so the list is a way in, not a
   * reproach.
   */
  protected readonly checklistItems = computed<{ key: string; done: boolean; tab?: Tab; route?: string }[]>(() => {
    const a = this.app();
    return [
      { key: 'gitRepo', done: Boolean(a?.git_repository), tab: 'settings' },
      { key: 'domain', done: Boolean(a?.fqdn), tab: 'settings' },
      { key: 'envVars', done: this.envCount() > 0, tab: 'env' },
      { key: 'pipeline', done: Boolean(this.pipeline()?.enabled), route: 'pipeline' },
      { key: 'firewall', done: Boolean(this.firewall()?.enabled), route: 'security' },
    ];
  });
  protected readonly checklistDone = computed(() => this.checklistItems().filter((i) => i.done).length);

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    const requested = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (requested && TABS.includes(requested)) this.tab.set(requested);
    this.reload();
  }

  private reload(): void {
    this.api.getApplication(this.uuid).subscribe({
      next: (a) => {
        this.app.set(a);
        // Après l'arrivée des données : avant, l'en-tête et les onglets
        // qu'elle montre ne sont pas encore dessinés.
        if (!this.tourOffered) {
          this.tourOffered = true;
          void this.tour.maybeStart('application');
        }
      },
      error: () => this.notFound.set(true),
    });
    this.api.listEnvVars(this.uuid).subscribe({ next: (v) => this.envCount.set(v.length), error: () => undefined });
    this.api.listDeployments(this.uuid).subscribe({ next: (d) => this.deployments.set(d), error: () => undefined });
    this.api.getFirewall(this.uuid).subscribe({ next: (f) => this.firewall.set(f), error: () => undefined });
    this.api.getPipeline(this.uuid).subscribe({ next: (p) => this.pipeline.set(p), error: () => undefined });
    // Best-effort: the container may not be up yet (never deployed, or stopped) — an
    // empty snapshot is a normal state here, not something to surface as an error.
    this.api.appUsage(this.uuid).subscribe({
      next: (usage) => this.usage.set(usage[0] ?? null),
      error: () => this.usage.set(null),
    });
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'overview' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Deletion lives at the bottom of the settings tab; the menu takes you there. */
  protected goToDelete(): void {
    this.menuOpen.set(false);
    this.setTab('settings');
    setTimeout(() => document.getElementById('danger-zone')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  /** The domain shown in the header — `fqdn` may hold several, comma-separated. */
  protected shortDomain(): string {
    const fqdn = this.app()?.fqdn;
    return fqdn ? fqdn.split(',')[0].trim().replace(/^https?:\/\//, '') : '';
  }

  /** `owner/repo` reads faster than the full clone URL. */
  protected repoName(url: string): string {
    return url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
  }

  protected shortCommit(commit: string): string {
    return (commit ?? '').slice(0, 7) || 'HEAD';
  }

  protected depColor(status: string): string {
    if (status === 'finished' || status === 'success') return 'var(--color-success)';
    if (status === 'failed' || status === 'error') return 'var(--color-danger)';
    if (status === 'in_progress' || status === 'running' || status === 'queued') return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  }

  /** A translation key for the deployment states the worker writes; anything else falls back to "other". */
  protected depLabel(status: string): string {
    const known = ['finished', 'failed', 'in_progress', 'queued', 'cancelled'];
    return `applications.detail.depStatus.${known.includes(status) ? status : 'other'}`;
  }

  protected formatBytes(bytes: number | null): string {
    if (bytes === null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
    this.menuOpen.set(false);
    this.acting.set(action);
    this.actionError.set(null);
    this.api.appLifecycle(this.uuid, action).subscribe({
      next: () => {
        this.acting.set(null);
        this.reload();
      },
      error: (e) => {
        this.acting.set(null);
        this.actionError.set(e?.error?.error?.message ?? null);
      },
    });
  }

  protected deploy(): void {
    this.deploying.set(true);
    this.actionError.set(null);
    this.api.deploy(this.uuid).subscribe({
      next: (res) => this.router.navigate(['/deployments', res.deploymentUuid]),
      error: (e) => {
        this.deploying.set(false);
        this.actionError.set(e?.error?.error?.message ?? null);
      },
    });
  }
}
