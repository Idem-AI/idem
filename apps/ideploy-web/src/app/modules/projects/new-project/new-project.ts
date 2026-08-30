import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { GithubRepo, ServiceTemplate } from '../../../shared/models/ideploy.models';
import { ARCHITECTURE_TEMPLATES } from '../../../shared/data/architecture-templates';
import { serviceLogoUrl, serviceScreenshotUrl } from '../../../shared/utils/service-logo.util';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

type GitProvider = 'github' | 'gitlab';
/** What the left panel is currently showing — the provider picker, one provider's repo list, or a git-less quick-deploy form. */
type ImportMode = 'pick' | GitProvider | 'compose' | 'image';

/**
 * New Project — Vercel-style import flow.
 *
 * "Import Git Repository" now offers every source iDeploy actually supports:
 * GitHub and GitLab (each its own self-contained OAuth connect, see
 * `github.service.ts` / `gitlab.service.ts`), plus two git-less quick-deploys
 * — Docker Compose and Docker Image — which both land as a Service (this
 * rewrite's docker-compose-stack primitive), the same creation path already
 * used by `/services`' own custom-compose form.
 *
 * Two legacy iDeploy sources are deliberately NOT here yet: Bitbucket (asked
 * to be skipped for now) and a git-less standalone Dockerfile build (that one
 * needs a real new deploy path — building an image with no repository to
 * clone — not just a UI entry; see the session notes for why it was left out
 * rather than half-built).
 */
@Component({
  selector: 'app-new-project',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, SlicePipe, TranslateModule, WorkspaceTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top bar -->
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/dashboard" class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> {{ 'projects.common.back' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono text-text-primary">{{ 'projects.common.newProject' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-5xl px-6 py-12">
      <h1 class="heading-serif mb-8 text-center" style="font-size:40px;font-weight:700;color:var(--color-text-primary);">{{ 'projects.new.heading' | translate }}</h1>

      <!-- Git URL prompt -->
      <div class="mb-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border"
           style="background:var(--glass-bg-subtle);border-color:var(--glass-border);"
           [class.focus-within:border-blue-500/80]="true"
           [class.focus-within:ring-2]="true"
           [class.focus-within:ring-blue-500/20]="true">
        <i class="fa-solid fa-link text-blue-400"></i>
        <input class="flex-1 bg-transparent outline-none text-sm" [placeholder]="'projects.new.gitUrlPlaceholder' | translate"
               [attr.aria-label]="'projects.new.gitUrlLabel' | translate"
               [(ngModel)]="gitUrl" (keyup.enter)="importUrl()" style="color:var(--color-text-primary);" />
        @if (gitUrl) {
          <button class="button cursor-pointer text-xs font-semibold py-1.5 px-3" (click)="importUrl()">{{ 'projects.new.continue' | translate }}</button>
        }
      </div>
      <p class="mb-10 text-center text-sm" style="color:var(--color-text-tertiary);">
        {{ 'projects.new.subheading' | translate }}
      </p>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <!-- ===== Import Git Repository ===== -->
        <div>
          <h2 class="mb-4 text-xl font-semibold font-mono text-text-primary">{{ 'projects.new.importGitRepo' | translate }}</h2>

          @if (mode() === 'pick') {
            <div class="box rounded-2xl p-8">
              <p class="mb-6 text-center text-sm" style="color:var(--color-text-secondary);">
                {{ 'projects.new.selectProviderHint' | translate }}
              </p>
              <div class="mx-auto max-w-sm space-y-2.5">
                @for (source of importSources; track source.id) {
                  <button
                    type="button"
                    class="db-glass flex w-full items-center gap-3 rounded-xl p-4 text-sm font-semibold transition-colors hover:border-blue-500/50 cursor-pointer"
                    (click)="source.mode === 'github' || source.mode === 'gitlab' ? pickProvider(source.mode) : mode.set(source.mode)"
                  >
                    <i [class]="source.icon" class="w-5 text-center text-lg" [style.color]="source.iconColor"></i>
                    {{ source.labelKey | translate }}
                  </button>
                }
              </div>
              <div class="mt-6 text-center">
                <a routerLink="/sources" class="text-xs hover:underline" style="color:var(--color-text-tertiary);">
                  {{ 'projects.new.manageConnections' | translate }} <i class="fa-solid fa-arrow-up-right-from-square ml-0.5 text-[10px]"></i>
                </a>
              </div>
            </div>
          } @else if (mode() === 'github' || mode() === 'gitlab') {
            <button class="mb-3 text-xs hover:text-text-primary transition-colors cursor-pointer" style="color:var(--color-text-tertiary);" (click)="mode.set('pick')">
              <i class="fa-solid fa-arrow-left mr-1"></i>{{ 'projects.new.chooseAnotherSource' | translate }}
            </button>

            @if (providerUser() === undefined) {
              <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.checkingProvider' | translate }}</p>
            } @else if (providerUser() === null) {
              <div class="db-glass text-center p-8 rounded-2xl">
                <i class="text-4xl mb-3" [class]="mode() === 'github' ? 'fa-brands fa-github' : 'fa-brands fa-gitlab'" style="color:var(--color-text-secondary);"></i>
                <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">
                  {{ (mode() === 'github' ? 'projects.new.connectGithubDesc' : 'projects.new.connectGitlabDesc') | translate }}
                </p>
                <button class="button cursor-pointer" (click)="connectProvider()">
                  <i class="mr-2" [class]="mode() === 'github' ? 'fa-brands fa-github' : 'fa-brands fa-gitlab'"></i>
                  {{ (mode() === 'github' ? 'projects.new.connectGithub' : 'projects.new.connectGitlab') | translate }}
                </button>
              </div>
            } @else {
              <div class="mb-4 flex items-center gap-3">
                <span class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono border" style="background:var(--glass-bg-subtle);border-color:var(--glass-border);color:var(--color-text-secondary);">
                  <i [class]="mode() === 'github' ? 'fa-brands fa-github' : 'fa-brands fa-gitlab'"></i> {{ providerUser() }}
                </span>
                <div class="relative flex-1">
                  <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px]" style="color:var(--color-text-tertiary);"></i>
                  <input class="input font-mono text-xs" style="padding-left:30px;height:36px;" [placeholder]="'projects.new.searchReposPlaceholder' | translate" [attr.aria-label]="'projects.new.searchReposLabel' | translate" [ngModel]="repoQuery()" (ngModelChange)="repoQuery.set($event)" />
                </div>
              </div>
              @if (filteredRepos().length === 0) {
                <div class="db-glass p-8 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.noRepos' | translate }}</div>
              } @else {
                <div class="overflow-y-auto rounded-xl db-glass p-0" style="max-height: 400px;">
                  @for (repo of filteredRepos(); track repo.fullName) {
                    <div class="flex items-center gap-4 p-3.5 hover:bg-[var(--glass-bg-subtle)] transition-colors duration-150" style="border-bottom:1px solid var(--glass-border-subtle);">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                        <i class="fa-solid fa-code-branch"></i>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-semibold text-text-primary font-mono">{{ repo.name }}
                          @if (repo.private) { <i class="fa-solid fa-lock ml-1.5 text-[10px]" style="color:var(--color-text-tertiary);" [title]="'projects.new.privateRepo' | translate"></i> }
                        </div>
                        <div class="truncate text-[10px] font-mono mt-0.5" style="color:var(--color-text-tertiary);">{{ 'projects.new.updated' | translate }} {{ repo.updatedAt | slice:0:10 }}</div>
                      </div>
                      <button class="button-secondary cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[var(--glass-bg-subtle)] transition-colors" (click)="importRepo(repo)">{{ 'projects.new.import' | translate }}</button>
                    </div>
                  }
                </div>
              }
              <button class="mt-3 text-xs hover:text-text-primary transition-colors cursor-pointer" style="color:var(--color-text-tertiary);" (click)="disconnectProvider()">
                {{ (mode() === 'github' ? 'projects.new.disconnectGithub' : 'projects.new.disconnectGitlab') | translate }}
              </button>
            }
          } @else if (mode() === 'compose') {
            <button class="mb-3 text-xs hover:text-text-primary transition-colors cursor-pointer" style="color:var(--color-text-tertiary);" (click)="mode.set('pick')">
              <i class="fa-solid fa-arrow-left mr-1"></i>{{ 'projects.new.chooseAnotherSource' | translate }}
            </button>
            <form class="db-glass space-y-3 rounded-2xl p-5" [formGroup]="composeForm" (ngSubmit)="deployCompose()">
              <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'projects.new.composeHint' | translate }}</p>
              <div>
                <label class="mb-1 block text-xs font-semibold">{{ 'projects.new.name' | translate }}</label>
                <input class="input" formControlName="name" />
              </div>
              <app-workspace-target-picker (targetChange)="target.set($event)" />
              <div>
                <label class="mb-1 block text-xs font-semibold">{{ 'projects.new.composeLabel' | translate }}</label>
                <textarea class="input font-mono" rows="8" formControlName="compose" placeholder="services:
  app:
    image: myorg/myapp:latest"></textarea>
              </div>
              @if (error()) { <p class="text-sm text-red-400">{{ error() }}</p> }
              <button class="button w-full" type="submit" [disabled]="composeForm.invalid || !target() || busy()">
                {{ (busy() ? 'projects.common.deploying' : 'projects.new.deployCompose') | translate }}
              </button>
            </form>
          } @else if (mode() === 'image') {
            <button class="mb-3 text-xs hover:text-text-primary transition-colors cursor-pointer" style="color:var(--color-text-tertiary);" (click)="mode.set('pick')">
              <i class="fa-solid fa-arrow-left mr-1"></i>{{ 'projects.new.chooseAnotherSource' | translate }}
            </button>
            <form class="db-glass space-y-3 rounded-2xl p-5" [formGroup]="imageForm" (ngSubmit)="deployImage()">
              <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'projects.new.imageHint' | translate }}</p>
              <div>
                <label class="mb-1 block text-xs font-semibold">{{ 'projects.new.name' | translate }}</label>
                <input class="input" formControlName="name" />
              </div>
              <app-workspace-target-picker (targetChange)="target.set($event)" />
              <div>
                <label class="mb-1 block text-xs font-semibold">{{ 'projects.new.imageLabel' | translate }}</label>
                <input class="input font-mono" formControlName="image" placeholder="nginx:latest" />
              </div>
              @if (error()) { <p class="text-sm text-red-400">{{ error() }}</p> }
              <button class="button w-full" type="submit" [disabled]="imageForm.invalid || !target() || busy()">
                {{ (busy() ? 'projects.common.deploying' : 'projects.new.deployImage') | translate }}
              </button>
            </form>
          }
        </div>

        <!-- ===== Clone Template ===== -->
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold font-mono text-white/95">{{ 'projects.new.cloneTemplate' | translate }}</h2>
            <a routerLink="/templates" class="text-sm font-semibold hover:underline" style="color:#60a5fa;">{{ 'projects.new.browseAll' | translate }}</a>
          </div>

          <!-- Two different kinds of "template": a ready-made app to deploy in one click,
               vs. a multi-resource architecture this rewrite can't wire up automatically —
               see architecture-templates.ts for why the second one is a checklist, not a deploy button. -->
          <div class="mb-4 flex gap-1 rounded-xl p-1" style="background:var(--glass-bg-subtle);border:1px solid var(--glass-border);">
            <button type="button" class="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    [style.background]="templateTab() === 'architectures' ? 'var(--color-surface-2)' : 'transparent'"
                    [style.color]="templateTab() === 'architectures' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                    (click)="templateTab.set('architectures')">
              {{ 'architectures.tabLabel' | translate }}
            </button>
            <button type="button" class="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    [style.background]="templateTab() === 'apps' ? 'var(--color-surface-2)' : 'transparent'"
                    [style.color]="templateTab() === 'apps' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                    (click)="templateTab.set('apps')">
              {{ 'projects.new.oneClickAppsTab' | translate }}
            </button>
          </div>

          @if (templateTab() === 'architectures') {
            <p class="mb-3 text-xs" style="color:var(--color-text-tertiary);">{{ 'architectures.pickerHint' | translate }}</p>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              @for (a of architectureTemplates; track a.id) {
                <a [routerLink]="['/new-project/guide', a.id]" [queryParams]="workspaceUuid ? { workspace: workspaceUuid } : {}"
                   class="db-glass flex flex-col overflow-hidden hover:border-blue-500/50 transition-all duration-200 rounded-2xl group">
                  <div class="flex-1 p-5">
                    <div class="mb-2 font-semibold font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ a.name | translate }}</div>
                    <p class="text-xs leading-relaxed" style="color:var(--color-text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{{ a.description | translate }}</p>
                  </div>
                  <!-- No real screenshot exists for an abstract multi-resource guide — an honest
                       iconographic panel, not a fabricated "preview" of something that isn't a single deploy. -->
                  <div class="relative flex h-24 items-center justify-center" [style.background]="archVisualBg(a.id)">
                    <i [class]="a.icon" class="text-3xl" style="color:rgba(255,255,255,0.85);"></i>
                    <span class="absolute bottom-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold" style="background:rgba(0,0,0,0.35);color:white;">
                      {{ a.steps.length }} {{ 'architectures.steps' | translate }}
                    </span>
                  </div>
                </a>
              }
            </div>
          } @else {
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              @for (t of templates(); track t.name) {
                <div class="db-glass flex flex-col overflow-hidden hover:border-blue-500/50 transition-all duration-200 rounded-2xl group">
                  <div class="flex-1 p-5">
                    <div class="mb-2 font-semibold capitalize font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ t.name }}</div>
                    <p class="text-xs leading-relaxed" style="color:var(--color-text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{{ t.slogan || ('projects.new.oneClickBoilerplate' | translate) }}</p>
                  </div>
                  <div class="relative flex h-24 items-center justify-center overflow-hidden" style="background:var(--color-surface-2);">
                    @if (templateScreenshot(t); as shot) {
                      <img [src]="shot" class="h-full w-full object-cover" alt="" (error)="onVisualError($event)" />
                    } @else if (templateLogo(t); as logo) {
                      <img [src]="logo" class="h-12 w-12 object-contain" alt="" (error)="onVisualError($event)" />
                    } @else {
                      <i [class]="getTemplateIcon(t.name)" class="text-3xl"></i>
                    }
                  </div>
                  <button class="button-secondary w-full cursor-pointer hover:bg-blue-500 hover:text-white transition-all text-xs font-semibold py-1.5 rounded-none border-0 border-t" style="border-color:var(--glass-border-subtle);" [disabled]="busy()" (click)="cloneTemplate(t)">{{ 'projects.common.deploy' | translate }}</button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Create Empty Project -->
      <div class="mt-12 db-glass p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4 hover:border-white/10 transition-all duration-200">
        <div class="flex items-center gap-4">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/70">
            <i class="fa-solid fa-cube text-lg"></i>
          </div>
          <div>
            <div class="font-semibold font-mono text-white/90">{{ 'projects.new.createEmpty' | translate }}</div>
            <p class="text-xs mt-0.5" style="color:var(--color-text-secondary);">{{ 'projects.new.createEmptyDesc' | translate }}</p>
          </div>
        </div>
        <button class="button-secondary cursor-pointer text-xs font-semibold py-2 px-4 rounded-xl hover:bg-white/10 hover:text-white transition-all" (click)="createEmpty()">{{ 'projects.new.createEmpty' | translate }}</button>
      </div>

      @if (error() && mode() !== 'compose' && mode() !== 'image') {
        <p class="mt-4 text-sm text-red-400 bg-red-500/5 border border-red-500/20 p-3 rounded-lg">{{ error() }}</p>
      }
    </div>
  `,
})
export class NewProjectComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);

  protected readonly mode = signal<ImportMode>('pick');
  protected readonly templateTab = signal<'architectures' | 'apps'>('architectures');
  protected readonly architectureTemplates = ARCHITECTURE_TEMPLATES;
  /** Dark glass button, brand-coloured icon — the original, preferred look. */
  protected readonly importSources: { id: string; mode: ImportMode; icon: string; iconColor: string; labelKey: string }[] = [
    { id: 'github', mode: 'github', icon: 'fa-brands fa-github', iconColor: 'var(--color-text-primary)', labelKey: 'projects.new.continueWithGithub' },
    { id: 'gitlab', mode: 'gitlab', icon: 'fa-brands fa-gitlab', iconColor: '#fc6d26', labelKey: 'projects.new.continueWithGitlab' },
    { id: 'compose', mode: 'compose', icon: 'fa-brands fa-docker', iconColor: '#2496ed', labelKey: 'projects.new.continueWithCompose' },
    { id: 'image', mode: 'image', icon: 'fa-solid fa-box', iconColor: '#60a5fa', labelKey: 'projects.new.continueWithImage' },
  ];
  /** `undefined` = still checking; `null` = checked, not connected; a string = the connected username. Shared by both providers — only one is ever shown at a time. */
  protected readonly githubUser = signal<string | null | undefined>(undefined);
  protected readonly gitlabUser = signal<string | null | undefined>(undefined);
  protected readonly githubRepos = signal<GithubRepo[]>([]);
  protected readonly gitlabRepos = signal<GithubRepo[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly repoQuery = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);
  protected gitUrl = '';
  /** Set when arriving from a specific workspace's "+ Nouvelle ressource" link — also read directly by the template to carry it into the architecture guide link. */
  protected workspaceUuid: string | null = null;

  protected readonly providerUser = computed(() => (this.mode() === 'gitlab' ? this.gitlabUser() : this.githubUser()));
  private readonly providerRepos = computed(() => (this.mode() === 'gitlab' ? this.gitlabRepos() : this.githubRepos()));

  protected readonly filteredRepos = computed(() => {
    const q = this.repoQuery().trim().toLowerCase();
    const repos = this.providerRepos();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  });

  protected readonly composeForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    compose: ['', Validators.required],
  });
  protected readonly imageForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    image: ['', Validators.required],
  });

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

  /** A real UI screenshot — only present for the curated subset of templates (see `template-enrichment.json`). */
  protected templateScreenshot(t: ServiceTemplate): string | null {
    const first = t.screenshots?.[0];
    return first ? serviceScreenshotUrl(first) : null;
  }

  /** Every template has this — the vendored catalog's own icon, not a screenshot. */
  protected templateLogo(t: ServiceTemplate): string | null {
    return serviceLogoUrl(t.logo);
  }

  protected onVisualError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /** A stable, distinct dark tint per architecture — same accessibility reasoning as `importSources` above (icon on a dark fill, never text needing to sit on the bright hue itself). */
  protected archVisualBg(id: string): string {
    const palette: Record<string, string> = {
      '3-tier': 'linear-gradient(135deg, #0c4a6e, #075985)',
      'fullstack-monolith': 'linear-gradient(135deg, #431407, #7c2d12)',
      'api-database': 'linear-gradient(135deg, #134e4a, #115e59)',
      'static-site': 'linear-gradient(135deg, #3730a3, #4338ca)',
      microservices: 'linear-gradient(135deg, #581c87, #6b21a8)',
    };
    return palette[id] ?? 'linear-gradient(135deg, #18181b, #27272a)';
  }

  ngOnInit(): void {
    this.workspaceUuid = this.route.snapshot.queryParamMap.get('workspace');
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t.slice(0, 4)));

    this.api.githubStatus().subscribe({
      next: (user) => {
        this.githubUser.set(user);
        if (user) this.api.githubRepositories().subscribe((r) => this.githubRepos.set(r));
      },
      error: () => this.githubUser.set(null),
    });
    this.api.gitlabStatus().subscribe({
      next: (user) => {
        this.gitlabUser.set(user);
        if (user) this.api.gitlabRepositories().subscribe((r) => this.gitlabRepos.set(r));
      },
      error: () => this.gitlabUser.set(null),
    });

    // Returning from an OAuth redirect (`?github=connected` / `?gitlab=error` …) —
    // land straight back on that provider's panel instead of the picker.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.has('github')) this.mode.set('github');
    else if (qp.has('gitlab')) this.mode.set('gitlab');
  }

  protected pickProvider(provider: GitProvider): void {
    this.repoQuery.set('');
    this.mode.set(provider);
  }

  protected connectProvider(): void {
    this.error.set(null);
    const provider = this.mode();
    if (provider !== 'github' && provider !== 'gitlab') return;
    const authUrl$ = provider === 'github' ? this.api.githubAuthUrl() : this.api.gitlabAuthUrl();
    authUrl$.subscribe({
      next: (url) => {
        if (!url) {
          this.error.set(this.translate.instant(provider === 'github' ? 'projects.new.errGithubNotConfigured' : 'projects.new.errGitlabNotConfigured'));
          return;
        }
        window.location.href = url;
      },
      error: (e) => {
        // The API answers "not configured" as a proper error (503
        // GITHUB_NOT_CONFIGURED / GITLAB_NOT_CONFIGURED), not a network
        // failure — showing "can't reach the API" for that case sent people
        // chasing the wrong fix.
        const code = (e as { error?: { error?: { code?: string } } })?.error?.error?.code;
        const notConfigured = code === 'GITHUB_NOT_CONFIGURED' || code === 'GITLAB_NOT_CONFIGURED';
        this.error.set(
          this.translate.instant(
            notConfigured
              ? provider === 'github' ? 'projects.new.errGithubNotConfigured' : 'projects.new.errGitlabNotConfigured'
              : provider === 'github' ? 'projects.new.errGithubUnreachable' : 'projects.new.errGitlabUnreachable'
          )
        );
      },
    });
  }

  protected disconnectProvider(): void {
    const provider = this.mode();
    if (provider === 'github') {
      this.api.githubDisconnect().subscribe(() => {
        this.githubUser.set(null);
        this.githubRepos.set([]);
      });
    } else if (provider === 'gitlab') {
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
        provider: this.mode(),
        workspace: this.workspaceUuid,
      },
    });
  }

  protected importUrl(): void {
    if (!this.gitUrl.trim()) return;
    const url = this.gitUrl.trim();
    const fullName = this.parseGithubFullName(url);
    const name = fullName?.split('/').pop() || url.split('/').pop()?.replace(/\.git$/, '') || 'app';
    this.router.navigate(['/new-project/import'], {
      // `repo` in `owner/name` form (when resolvable) lets the next step run the
      // same auto-detection (framework, Dockerfile) used for connected-GitHub
      // imports — a pasted public repo URL gets the same smart defaults.
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
    this.error.set(null);
    this.api
      .quickDeploy({
        name: t.name,
        template: t.name,
        workspace_uuid: this.workspaceUuid || undefined,
      })
      .subscribe({
        next: () => this.router.navigate(['/services']),
        error: (e) => {
          this.busy.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
        },
      });
  }

  /** Git-less: a pasted/typed docker-compose.yml, deployed as a Service — the same primitive `/services`' own custom-compose form uses. */
  protected deployCompose(): void {
    const target = this.target();
    if (this.composeForm.invalid || !target) return;
    const { name, compose } = this.composeForm.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.api
      .createService({
        name,
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
        docker_compose_raw: compose,
      })
      .subscribe({
        next: (svc) => this.router.navigate(['/services', svc.uuid]),
        error: (e) => {
          this.busy.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
        },
      });
  }

  /** Git-less: a bare image reference, wrapped into a minimal one-service compose and deployed the same way. */
  protected deployImage(): void {
    const target = this.target();
    if (this.imageForm.invalid || !target) return;
    const { name, image } = this.imageForm.getRawValue();
    const compose = `services:\n  app:\n    image: '${image.trim()}'\n    restart: unless-stopped\n`;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .createService({
        name,
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
        docker_compose_raw: compose,
      })
      .subscribe({
        next: (svc) => this.router.navigate(['/services', svc.uuid]),
        error: (e) => {
          this.busy.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
        },
      });
  }

  /**
   * "Create empty" now means creating a Workspace: the old flow inserted a bare
   * `projects` row with no deployment target or server, which is exactly the
   * state a workspace refuses to be created in — the target and region are
   * asked for once, here, rather than defaulted silently.
   */
  protected createEmpty(): void {
    void this.router.navigate(['/workspaces/new']);
  }
}
