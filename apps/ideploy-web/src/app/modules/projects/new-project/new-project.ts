import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SlicePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { GithubRepo, ServiceTemplate } from '../../../shared/models/ideploy.models';
import { ARCHITECTURE_TEMPLATES } from '../../../shared/data/architecture-templates';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';
import { TourService } from '../../../shared/services/tour.service';
import { IllustrationComponent, IllustrationName } from '../../../shared/components/illustration/illustration';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

/** The one question the page asks: where does the thing to put online come from? */
type Source = 'code' | 'docker' | 'template';
type CodeTab = 'github' | 'gitlab' | 'url';
type DockerTab = 'image' | 'compose';

interface SourceChoice {
  id: Source;
  illustration: IllustrationName;
  titleKey: string;
  descKey: string;
}

/**
 * The one-click apps shown up front: the most used open source software of the
 * catalog, by popularity (GitHub stars, installs), not the catalog's alphabetical
 * order. Each name is a key of the API's template catalog; one missing from it
 * is simply not shown.
 */
const POPULAR_APPS: { template: string; label: string; descKey: string }[] = [
  { template: 'wordpress-with-mysql', label: 'WordPress', descKey: 'projects.start.apps.wordpress' },
  { template: 'n8n', label: 'n8n', descKey: 'projects.start.apps.n8n' },
  { template: 'odoo', label: 'Odoo', descKey: 'projects.start.apps.odoo' },
  { template: 'supabase', label: 'Supabase', descKey: 'projects.start.apps.supabase' },
  { template: 'nextcloud', label: 'Nextcloud', descKey: 'projects.start.apps.nextcloud' },
  { template: 'open-webui', label: 'Open WebUI', descKey: 'projects.start.apps.openWebui' },
  { template: 'ghost', label: 'Ghost', descKey: 'projects.start.apps.ghost' },
  { template: 'strapi', label: 'Strapi', descKey: 'projects.start.apps.strapi' },
  { template: 'uptime-kuma', label: 'Uptime Kuma', descKey: 'projects.start.apps.uptimeKuma' },
  { template: 'metabase', label: 'Metabase', descKey: 'projects.start.apps.metabase' },
  { template: 'umami', label: 'Umami', descKey: 'projects.start.apps.umami' },
  { template: 'chatwoot', label: 'Chatwoot', descKey: 'projects.start.apps.chatwoot' },
];

/**
 * New project — one question, then one panel.
 *
 * The page first asks what is being put online (code, a Docker image, a
 * ready-made app) and only then shows the controls for that answer. Every
 * source iDeploy supports is still here — GitHub, GitLab, a public Git URL,
 * an image, a compose file, the template catalog and the architecture guides —
 * but never all on screen at once. The guides for a project in several parts
 * sit at the top of "My code": that is where someone with a site, an API and
 * a database looks, and missing them means deploying the parts unconnected.
 */
@Component({
  selector: 'app-new-project',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SlicePipe,
    TranslateModule,
    IdemLoaderComponent,
    IllustrationComponent,
    WorkspaceTargetPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex h-16 items-center justify-between border-b px-4 sm:px-6" style="border-color:var(--glass-border-subtle);">
      <a routerLink="/dashboard" class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="pi pi-arrow-left" aria-hidden="true"></i> {{ 'projects.common.back' | translate }}
      </a>
      <a routerLink="/dashboard" class="shrink-0" aria-label="iDeploy">
        <img src="/assets/logos/Ideploy%20logo%20light.png" alt="iDeploy" class="h-7 w-auto dark:hidden" />
        <img src="/assets/logos/Ideploy%20logo%20dark.png" alt="" aria-hidden="true" class="hidden h-7 w-auto dark:block" />
      </a>
      <span class="w-16" aria-hidden="true"></span>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 class="mb-1 text-center text-2xl font-bold text-text-primary sm:text-3xl">{{ 'projects.start.heading' | translate }}</h1>
      <p class="mx-auto mb-6 max-w-xl text-center text-sm" style="color:var(--color-text-secondary);">
        {{ 'projects.start.subheading' | translate }}
      </p>

      <!-- Step 1 — the source: compact rows, so the panel below starts above the fold -->
      <div class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" data-tour="ideploy-sources" [attr.aria-label]="'projects.start.sourceLabel' | translate">
        @for (choice of sources; track choice.id) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="source() === choice.id"
            class="glass-card relative flex cursor-pointer items-center gap-4 rounded-2xl p-4 text-left transition-colors"
            [style.border-color]="source() === choice.id ? 'var(--color-primary-500)' : null"
            [style.box-shadow]="source() === choice.id ? '0 0 0 1px var(--color-primary-500)' : null"
            (click)="selectSource(choice.id)">
            @if (source() === choice.id) {
              <i class="pi pi-check-circle absolute right-3 top-3 text-sm" style="color:var(--color-primary-500);" aria-hidden="true"></i>
            }
            <app-illustration class="shrink-0" [name]="choice.illustration" [width]="88" />
            <span class="flex min-w-0 flex-col gap-0.5 pr-5">
              <span class="text-sm font-semibold text-text-primary">{{ choice.titleKey | translate }}</span>
              <span class="text-xs leading-snug" style="color:var(--color-text-secondary);">{{ choice.descKey | translate }}</span>
            </span>
          </button>
        }
      </div>

      <!-- Step 2 — the panel for that source; for code, the guides sit beside it -->
      <div class="grid grid-cols-1 items-start gap-4" [class.lg:grid-cols-3]="source() === 'code'">
      <section class="glass-card rounded-2xl p-5 sm:p-6 lg:col-span-2" data-tour="ideploy-source-panel">
        @switch (source()) {
          @case ('code') {
            <h2 class="font-semibold text-text-primary">{{ 'projects.start.singleRepoTitle' | translate }}</h2>
            <p class="mb-4 mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'projects.start.singleRepoHint' | translate }}</p>
            <div class="mb-5 flex border-b" role="tablist" style="border-color:var(--glass-border-subtle);">
              @for (tab of codeTabs; track tab.id) {
                <button type="button" role="tab" class="-mb-px flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 py-2.5 text-sm font-medium transition-colors"
                        [attr.aria-selected]="codeTab() === tab.id"
                        [style.border-color]="codeTab() === tab.id ? 'var(--color-primary-500)' : 'transparent'"
                        [style.color]="codeTab() === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                        (click)="selectCodeTab(tab.id)">
                  <i [class]="tab.icon" aria-hidden="true"></i>{{ tab.labelKey | translate }}
                </button>
              }
            </div>

            @if (codeTab() === 'url') {
              <form (ngSubmit)="importUrl()" [formGroup]="urlForm">
                <label for="git-url" class="mb-1.5 block text-sm font-medium">{{ 'projects.start.urlLabel' | translate }}</label>
                <div class="flex flex-col gap-2 sm:flex-row">
                  <input id="git-url" type="url" class="flex-1 !w-auto min-w-0 font-mono" formControlName="url"
                         placeholder="https://github.com/organisation/projet" autocomplete="off" />
                  <button class="inner-button" type="submit" [disabled]="urlForm.invalid">{{ 'projects.start.continue' | translate }}</button>
                </div>
                <p class="mt-2 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.start.urlHint' | translate }}</p>
              </form>
            } @else if (providerUser() === undefined) {
              <idem-loader block [label]="'projects.start.checkingProvider' | translate" />
            } @else if (providerUser() === null) {
              <div class="flex flex-col items-center py-6 text-center">
                <i class="mb-3 text-3xl text-text-secondary" [class]="providerIcon()" aria-hidden="true"></i>
                <p class="mb-4 max-w-sm text-sm" style="color:var(--color-text-secondary);">
                  {{ (codeTab() === 'github' ? 'projects.start.connectGithubDesc' : 'projects.start.connectGitlabDesc') | translate }}
                </p>
                <button type="button" class="inner-button" [disabled]="connecting()" (click)="connectProvider()">
                  @if (connecting()) { <idem-loader size="xs" /> }
                  {{ (codeTab() === 'github' ? 'projects.start.connectGithub' : 'projects.start.connectGitlab') | translate }}
                </button>
              </div>
            } @else {
              <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span class="text-xs" style="color:var(--color-text-secondary);">
                  <i class="mr-1" [class]="providerIcon()" aria-hidden="true"></i>{{ providerUser() }}
                </span>
                <div class="sm:ml-auto sm:w-64">
                  <input type="search" class="text-sm" [attr.aria-label]="'projects.start.searchRepos' | translate"
                         [placeholder]="'projects.start.searchRepos' | translate"
                         [value]="repoQuery()" (input)="repoQuery.set($any($event.target).value)" />
                </div>
              </div>

              @if (reposLoading()) {
                <div class="space-y-2" aria-hidden="true">
                  @for (i of [0, 1, 2, 3]; track i) { <div class="skeleton h-14 rounded-xl"></div> }
                </div>
              } @else if (filteredRepos().length === 0) {
                <p class="py-8 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'projects.start.noRepos' | translate }}</p>
              } @else {
                <ul class="custom-scrollbar max-h-72 overflow-y-auto rounded-xl border" style="border-color:var(--glass-border-subtle);">
                  @for (repo of filteredRepos(); track repo.fullName) {
                    <li class="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style="border-color:var(--glass-border-subtle);">
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                          {{ repo.name }}
                          @if (repo.private) {
                            <i class="pi pi-lock text-[10px]" style="color:var(--color-text-tertiary);" [attr.aria-label]="'projects.start.privateRepo' | translate"></i>
                          }
                        </div>
                        <div class="mt-0.5 text-xs" style="color:var(--color-text-tertiary);">
                          {{ 'projects.start.updated' | translate }} {{ repo.updatedAt | slice: 0 : 10 }}
                        </div>
                      </div>
                      <button type="button" class="outer-button button-sm" (click)="importRepo(repo)">{{ 'projects.start.import' | translate }}</button>
                    </li>
                  }
                </ul>
              }

              <div class="mt-3 flex items-center justify-between text-xs" style="color:var(--color-text-tertiary);">
                <a routerLink="/sources" class="hover:underline">{{ 'projects.start.manageConnections' | translate }}</a>
                <button type="button" class="cursor-pointer hover:underline" (click)="disconnectProvider()">
                  {{ (codeTab() === 'github' ? 'projects.start.disconnectGithub' : 'projects.start.disconnectGitlab') | translate }}
                </button>
              </div>
            }
          }

          @case ('docker') {
            <div class="mb-5 flex border-b" role="tablist" style="border-color:var(--glass-border-subtle);">
              @for (tab of dockerTabs; track tab.id) {
                <button type="button" role="tab" class="-mb-px flex-1 cursor-pointer border-b-2 py-2.5 text-sm font-medium transition-colors"
                        [attr.aria-selected]="dockerTab() === tab.id"
                        [style.border-color]="dockerTab() === tab.id ? 'var(--color-primary-500)' : 'transparent'"
                        [style.color]="dockerTab() === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                        (click)="dockerTab.set(tab.id); error.set(null)">
                  {{ tab.labelKey | translate }}
                </button>
              }
            </div>

            <form class="space-y-4" [formGroup]="dockerForm" (ngSubmit)="deployDocker()">
              <div>
                <label for="docker-name" class="mb-1.5 block text-sm font-medium">{{ 'projects.start.name' | translate }}</label>
                <input id="docker-name" type="text" formControlName="name" [placeholder]="'projects.start.namePlaceholder' | translate" />
              </div>

              @if (dockerTab() === 'image') {
                <div>
                  <label for="docker-image" class="mb-1.5 block text-sm font-medium">{{ 'projects.start.imageLabel' | translate }}</label>
                  <input id="docker-image" type="text" class="font-mono" formControlName="image" placeholder="nginx:latest" />
                  <p class="mt-1.5 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.start.imageHint' | translate }}</p>
                </div>
                <details class="rounded-lg p-3" style="border:1px solid var(--color-surface-2);">
                  <summary class="cursor-pointer text-sm font-medium">{{ 'projects.start.privateRegistry' | translate }}</summary>
                  <p class="mt-2 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.start.privateRegistryHint' | translate }}</p>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="text" class="font-mono" formControlName="registryUsername" [placeholder]="'projects.start.registryUser' | translate" autocomplete="off" />
                    <input type="password" class="font-mono" formControlName="registryToken" [placeholder]="'projects.start.registryToken' | translate" autocomplete="new-password" />
                  </div>
                </details>
              } @else {
                <div>
                  <label for="docker-compose" class="mb-1.5 block text-sm font-medium">docker-compose.yml</label>
                  <textarea id="docker-compose" class="font-mono text-sm" rows="9" formControlName="compose"
                            placeholder="services:&#10;  app:&#10;    image: organisation/app:latest"></textarea>
                  <p class="mt-1.5 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.start.composeHint' | translate }}</p>
                </div>
              }

              <app-workspace-target-picker class="block" (targetChange)="target.set($event)" />

              @if (error()) {
                <p class="text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
              }
              <button class="inner-button w-full" type="submit" [disabled]="!dockerReady() || busy()">
                @if (busy()) { <idem-loader size="xs" /> }
                {{ (busy() ? 'projects.start.publishing' : 'projects.start.publish') | translate }}
              </button>
            </form>
          }

          @case ('template') {
            <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 class="font-semibold text-text-primary">{{ 'projects.start.popularApps' | translate }}</h2>
              <a routerLink="/templates" class="text-sm font-medium text-primary-500 hover:underline">{{ 'projects.start.browseCatalog' | translate }}</a>
            </div>
            <p class="mb-4 text-xs" style="color:var(--color-text-secondary);">{{ 'projects.start.popularAppsHint' | translate }}</p>

            @if (templatesLoading()) {
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) { <div class="skeleton h-28 rounded-xl"></div> }
              </div>
            } @else {
              <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                @for (app of popularApps(); track app.template.name) {
                  <li class="flex flex-col gap-3 rounded-xl border p-4" style="border-color:var(--glass-border-subtle);">
                    <div class="flex items-center gap-3">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
                        @if (templateLogo(app.template); as logo) {
                          <img [src]="logo" class="h-6 w-6 object-contain" alt="" (error)="onLogoError($event)" />
                        } @else {
                          <i class="pi pi-box text-text-secondary" aria-hidden="true"></i>
                        }
                      </div>
                      <a [routerLink]="['/templates', app.template.name]" class="min-w-0 truncate text-sm font-semibold text-text-primary hover:underline">{{ app.label }}</a>
                    </div>
                    <p class="flex-1 text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ app.descKey | translate }}</p>
                    <button type="button" class="outer-button button-sm w-full" [disabled]="busy()" (click)="cloneTemplate(app.template)">
                      @if (busyTemplate() === app.template.name) { <idem-loader size="xs" /> }
                      {{ 'projects.start.publishShort' | translate }}
                    </button>
                  </li>
                }
              </ul>
            }

            @if (error()) {
              <p class="mt-3 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
            }
          }
        }

        @if (error() && source() === 'code') {
          <p class="mt-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
        }
      </section>

      @if (source() === 'code') {
        <!-- Second path: a project in several parts, guided step by step -->
        <aside class="glass-card rounded-2xl p-5" aria-labelledby="guides-title">
          <h2 id="guides-title" class="font-semibold text-text-primary">{{ 'projects.start.architecturesTitle' | translate }}</h2>
          <p class="mb-4 mt-1 text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'projects.start.architecturesHint' | translate }}</p>
          <ul class="space-y-2">
            @for (a of multiPartGuides; track a.id) {
              <li>
                <a [routerLink]="['/new-project/guide', a.id]" [queryParams]="workspaceUuid ? { workspace: workspaceUuid } : {}"
                   class="group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:border-primary-500 hover:bg-[var(--glass-bg-subtle)]"
                   style="border-color:var(--glass-border-subtle);">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium text-text-primary">{{ a.name | translate }}</span>
                      <span class="flex shrink-0 items-center gap-1 text-text-secondary" aria-hidden="true">
                        @for (icon of a.pieces; track $index) {
                          @if (!$first) { <span class="h-px w-2" style="background:var(--color-text-tertiary);"></span> }
                          <i [class]="icon" class="text-[11px]"></i>
                        }
                      </span>
                    </div>
                    <p class="mt-1 text-xs leading-snug" style="color:var(--color-text-secondary);">{{ a.description | translate }}</p>
                    <span class="mt-1.5 inline-block text-[11px]" style="color:var(--color-text-tertiary);">{{ 'projects.start.guideSteps' | translate: { count: a.steps.length } }}</span>
                  </div>
                  <i class="pi pi-chevron-right text-xs transition-transform group-hover:translate-x-0.5" style="color:var(--color-text-tertiary);" aria-hidden="true"></i>
                </a>
              </li>
            }
          </ul>
        </aside>
      }
      </div>

      <p class="mt-6 text-center text-sm" style="color:var(--color-text-secondary);">
        {{ 'projects.start.emptyPrompt' | translate }}
        <a routerLink="/workspaces/new" class="font-medium text-primary-500 hover:underline">{{ 'projects.start.emptyLink' | translate }}</a>
      </p>
    </main>
  `,
})
export class NewProjectComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private tour = inject(TourService);

  protected readonly sources: SourceChoice[] = [
    { id: 'code', illustration: 'code', titleKey: 'projects.start.sourceCode', descKey: 'projects.start.sourceCodeDesc' },
    { id: 'template', illustration: 'market', titleKey: 'projects.start.sourceTemplate', descKey: 'projects.start.sourceTemplateDesc' },
    // Last: the path for people who already package their own images.
    { id: 'docker', illustration: 'box', titleKey: 'projects.start.sourceDocker', descKey: 'projects.start.sourceDockerDesc' },
  ];
  protected readonly codeTabs: { id: CodeTab; icon: string; labelKey: string }[] = [
    { id: 'github', icon: 'pi pi-github', labelKey: 'projects.start.tabGithub' },
    { id: 'gitlab', icon: 'pi pi-sitemap', labelKey: 'projects.start.tabGitlab' },
    { id: 'url', icon: 'pi pi-link', labelKey: 'projects.start.tabUrl' },
  ];
  protected readonly dockerTabs: { id: DockerTab; labelKey: string }[] = [
    { id: 'image', labelKey: 'projects.start.tabImage' },
    { id: 'compose', labelKey: 'projects.start.tabCompose' },
  ];
  /**
   * Only the guides that assemble several parts — a single static site is
   * just an import. `pieces` lists the parts in reading order (what the
   * visitor sees first, the database last), the reverse of the build order.
   */
  protected readonly multiPartGuides = ARCHITECTURE_TEMPLATES.filter((a) => a.steps.length > 1).map((a) => ({
    ...a,
    pieces: a.steps.map((step) => step.icon).reverse(),
  }));

  protected readonly source = signal<Source>('code');
  protected readonly codeTab = signal<CodeTab>('github');
  protected readonly dockerTab = signal<DockerTab>('image');

  /** `undefined` = still checking; `null` = not connected; a string = the connected username. */
  protected readonly githubUser = signal<string | null | undefined>(undefined);
  protected readonly gitlabUser = signal<string | null | undefined>(undefined);
  protected readonly githubRepos = signal<GithubRepo[]>([]);
  protected readonly gitlabRepos = signal<GithubRepo[]>([]);
  private readonly githubReposLoading = signal(false);
  private readonly gitlabReposLoading = signal(false);

  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly popularApps = computed(() => {
    const byName = new Map(this.templates().map((t) => [t.name, t]));
    return POPULAR_APPS.flatMap((app) => {
      const template = byName.get(app.template);
      return template ? [{ ...app, template }] : [];
    });
  });
  protected readonly templatesLoading = signal(true);

  protected readonly repoQuery = signal('');
  protected readonly connecting = signal(false);
  protected readonly busy = signal(false);
  protected readonly busyTemplate = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);
  /** Set when arriving from a workspace's "new resource" link, and carried into every next step. */
  protected workspaceUuid: string | null = null;

  protected readonly urlForm = this.fb.nonNullable.group({ url: ['', Validators.required] });
  protected readonly dockerForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    image: [''],
    compose: [''],
    /** Private image: the registry login (saved for the team). */
    registryUsername: [''],
    registryToken: [''],
  });
  /** Reactive-form values are not signals; mirrored so `dockerReady` can be computed. */
  private readonly dockerValue = signal(this.dockerForm.getRawValue());

  protected readonly providerUser = computed(() => (this.codeTab() === 'gitlab' ? this.gitlabUser() : this.githubUser()));
  protected readonly reposLoading = computed(() =>
    this.codeTab() === 'gitlab' ? this.gitlabReposLoading() : this.githubReposLoading()
  );
  protected readonly filteredRepos = computed(() => {
    const repos = this.codeTab() === 'gitlab' ? this.gitlabRepos() : this.githubRepos();
    const q = this.repoQuery().trim().toLowerCase();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  });
  protected readonly providerIcon = computed(() => (this.codeTab() === 'gitlab' ? 'pi pi-sitemap' : 'pi pi-github'));
  protected readonly dockerReady = computed(() => {
    const v = this.dockerValue();
    const payload = this.dockerTab() === 'image' ? v.image : v.compose;
    return v.name.trim() !== '' && payload.trim() !== '' && this.target() !== null;
  });

  ngOnInit(): void {
    // Première mise en ligne : on montre les trois origines possibles, une fois.
    void this.tour.maybeStart('new-project');

    this.workspaceUuid = this.route.snapshot.queryParamMap.get('workspace');
    this.dockerForm.valueChanges.subscribe(() => this.dockerValue.set(this.dockerForm.getRawValue()));

    this.api.listServiceTemplates().subscribe({
      next: (t) => {
        this.templates.set(t);
        this.templatesLoading.set(false);
      },
      error: () => this.templatesLoading.set(false),
    });

    this.api.githubStatus().subscribe({
      next: (user) => {
        this.githubUser.set(user);
        if (!user) return;
        this.githubReposLoading.set(true);
        this.api.githubRepositories().subscribe({
          next: (r) => this.githubRepos.set(r),
          complete: () => this.githubReposLoading.set(false),
          error: () => this.githubReposLoading.set(false),
        });
      },
      error: () => this.githubUser.set(null),
    });
    this.api.gitlabStatus().subscribe({
      next: (user) => {
        this.gitlabUser.set(user);
        if (!user) return;
        this.gitlabReposLoading.set(true);
        this.api.gitlabRepositories().subscribe({
          next: (r) => this.gitlabRepos.set(r),
          complete: () => this.gitlabReposLoading.set(false),
          error: () => this.gitlabReposLoading.set(false),
        });
      },
      error: () => this.gitlabUser.set(null),
    });

    // Back from an OAuth redirect (`?github=connected`, `?gitlab=error`…):
    // land on that provider's tab rather than the default.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.has('gitlab')) this.codeTab.set('gitlab');
  }

  protected selectSource(source: Source): void {
    this.source.set(source);
    this.error.set(null);
  }

  protected selectCodeTab(tab: CodeTab): void {
    this.codeTab.set(tab);
    this.repoQuery.set('');
    this.error.set(null);
  }

  protected templateLogo(t: ServiceTemplate): string | null {
    return serviceLogoUrl(t.logo);
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  protected connectProvider(): void {
    const provider = this.codeTab();
    if (provider === 'url') return;
    this.error.set(null);
    this.connecting.set(true);
    const authUrl$ = provider === 'github' ? this.api.githubAuthUrl() : this.api.gitlabAuthUrl();
    authUrl$.subscribe({
      next: (url) => {
        if (!url) {
          this.connecting.set(false);
          this.error.set(this.translate.instant(`projects.start.${provider}NotConfigured`));
          return;
        }
        window.location.href = url;
      },
      error: (e) => {
        this.connecting.set(false);
        // "Not configured" is a proper API answer (503 *_NOT_CONFIGURED), not a
        // network failure — they call for different fixes.
        const code = (e as { error?: { error?: { code?: string } } })?.error?.error?.code;
        const notConfigured = code === 'GITHUB_NOT_CONFIGURED' || code === 'GITLAB_NOT_CONFIGURED';
        this.error.set(
          this.translate.instant(`projects.start.${provider}${notConfigured ? 'NotConfigured' : 'Unreachable'}`)
        );
      },
    });
  }

  protected disconnectProvider(): void {
    if (this.codeTab() === 'github') {
      this.api.githubDisconnect().subscribe(() => {
        this.githubUser.set(null);
        this.githubRepos.set([]);
      });
    } else if (this.codeTab() === 'gitlab') {
      this.api.gitlabDisconnect().subscribe(() => {
        this.gitlabUser.set(null);
        this.gitlabRepos.set([]);
      });
    }
  }

  protected importRepo(repo: GithubRepo): void {
    this.router.navigate(['/new-project/import'], {
      queryParams: {
        repo: repo.fullName,
        clone: repo.cloneUrl,
        branch: repo.defaultBranch || 'main',
        name: repo.name,
        language: repo.language || '',
        provider: this.codeTab(),
        workspace: this.workspaceUuid,
      },
    });
  }

  protected importUrl(): void {
    const url = this.urlForm.getRawValue().url.trim();
    if (!url) return;
    const fullName = this.parseGithubFullName(url);
    const name = fullName?.split('/').pop() || url.split('/').pop()?.replace(/\.git$/, '') || 'app';
    this.router.navigate(['/new-project/import'], {
      // `repo` in `owner/name` form lets the next step run the same framework
      // detection as a connected-GitHub import.
      queryParams: { clone: url, repo: fullName || name, branch: 'main', name, provider: 'github', workspace: this.workspaceUuid },
    });
  }

  /** Extracts `owner/repo` from a GitHub URL (https or SSH form); null otherwise. */
  private parseGithubFullName(url: string): string | null {
    const patterns = [
      /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?(?:[?#].*)?$/,
      /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return `${m[1]}/${m[2]}`;
    }
    return null;
  }

  protected cloneTemplate(t: ServiceTemplate): void {
    this.busy.set(true);
    this.busyTemplate.set(t.name);
    this.error.set(null);
    this.api
      .quickDeploy({ name: t.name, template: t.name, workspace_uuid: this.workspaceUuid || undefined })
      .subscribe({
        next: () => this.router.navigate(['/services']),
        error: (e) => this.fail(e),
      });
  }

  /**
   * Git-less deploy, as a Service. A bare image is wrapped into a one-service
   * compose so both tabs take the same path as `/services`' custom-compose form.
   */
  protected deployDocker(): void {
    const target = this.target();
    if (!this.dockerReady() || !target) return;
    const { name, image, compose, registryUsername, registryToken } = this.dockerForm.getRawValue();

    this.busy.set(true);
    this.error.set(null);

    // An image becomes a real application: a domain, routing, variables,
    // firewall and deployments, like any other. (It used to be wrapped into a
    // one-service Compose stack that had none of it.)
    if (this.dockerTab() === 'image') {
      const { repository, tag } = splitImageReference(image);
      const create = () =>
        this.api.createApplication({
          name: name.trim(),
          workspace_uuid: target.workspace_uuid,
          environment_name: target.environment_name,
          project_name: target.project_name,
          build_pack: 'dockerimage',
          docker_registry_image_name: repository,
          docker_registry_image_tag: tag,
        });
      const login$: Observable<unknown> =
        registryUsername.trim() && registryToken
          ? this.api.saveRegistryCredential({ registry: registryOf(repository), username: registryUsername.trim(), password: registryToken })
          : of(null);
      login$
        .pipe(
          switchMap(create),
          switchMap((app) => this.api.deploy(app.uuid))
        )
        .subscribe({
          next: (d) => this.router.navigate(['/deployments', d.deploymentUuid]),
          error: (e) => this.fail(e),
        });
      return;
    }

    const raw = compose;
    this.api
      .createService({
        name: name.trim(),
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
        docker_compose_raw: raw,
      })
      .subscribe({
        next: (svc) => this.router.navigate(['/services', svc.uuid]),
        error: (e) => this.fail(e),
      });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.busyTemplate.set(null);
    const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant('projects.common.deploymentFailed'));
  }
}

/** `ghcr.io/org/app:v1` → the image and its tag (`latest` when none; a port in the registry host is not a tag). */
export function splitImageReference(reference: string): { repository: string; tag: string } {
  const ref = reference.trim();
  const colon = ref.lastIndexOf(':');
  if (colon > ref.lastIndexOf('/')) return { repository: ref.slice(0, colon), tag: ref.slice(colon + 1) || 'latest' };
  return { repository: ref, tag: 'latest' };
}

/** The registry host of an image: its first segment when it looks like a host, else Docker Hub. */
export function registryOf(repository: string): string {
  const first = repository.split('/')[0];
  return repository.includes('/') && (first.includes('.') || first.includes(':') || first === 'localhost') ? first : 'docker.io';
}
