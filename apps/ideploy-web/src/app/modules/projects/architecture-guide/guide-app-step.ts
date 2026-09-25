import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap, takeWhile } from 'rxjs/operators';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import { EcosystemWarning, GithubRepo, ManifestDirectory } from '../../../shared/models/ideploy.models';
import { GuideSessionService } from '../../../shared/services/guide-session.service';
import { GuideStepRole } from '../../../shared/data/architecture-templates';
import { parseEnvFile } from '../../../shared/utils/parse-env-file.util';
import { forEcosystem, isApiUrlKey, isDatabaseUrlKey, isRedisUrlKey } from '../../../shared/utils/guide-env-link.util';

type GitProvider = 'github' | 'gitlab';
type Stage = 'provider' | 'repos' | 'configure' | 'deploying' | 'result';

interface EnvRow {
  key: string;
  value: string;
  reveal: boolean;
  /** Filled from an architecture guide's linked resource, not detected from the repository — see `guide-env-link.util.ts`. */
  linkedFrom?: 'database' | 'cache' | 'backend';
}

interface Preset {
  label: string;
  icon: string;
  buildPack: string;
}

/**
 * Inline "import and deploy" step, reusable for a `backend` or `frontend`
 * role (or neither — a monolith's single app) — the guide's own condensed
 * merge of `new-project.ts`'s repo picker and `import-config.ts`'s detection
 * + config + deploy, minus the workspace question (the guide already
 * answered that in its first step) and the local-dev recovery path (a
 * standalone-flow convenience, not something a guided production deploy
 * needs). Never navigates: connecting a provider is the one unavoidable
 * full-page round trip (OAuth), and it comes back to this exact guide via
 * `return_to` — see `github.service.ts` / `gitlab.service.ts`.
 *
 * `quickDeploy` only queues the build (`deployment.worker.ts` does the real
 * work asynchronously), so a deploy step is done the moment the HTTP call
 * returns — the same trap the database step had before it streamed live
 * progress. This mirrors `deployment-logs.ts`'s own pattern exactly: a live
 * console over the `deployment.{uuid}` realtime channel plus polling
 * `getDeployment` for the terminal `status` (no `'status'` realtime event is
 * ever emitted server-side — only `'log'` — so polling is the only way to
 * know the build actually finished, and only that moment — not the HTTP
 * response — links the app into the guide session.
 */
@Component({
  selector: 'app-guide-app-step',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (stage() === 'provider') {
        <div class="flex gap-2">
          <button type="button" class="outer-button flex-1" (click)="pickProvider('github')">
            <i class="pi pi-github mr-1.5"></i>GitHub
          </button>
          <button type="button" class="outer-button flex-1" (click)="pickProvider('gitlab')">
            <i class="pi pi-sitemap mr-1.5" style="color:#fc6d26;"></i>GitLab
          </button>
        </div>
      }

      @if (stage() === 'repos') {
        <button type="button" class="text-xs hover:underline" style="color:var(--color-text-tertiary);" (click)="stage.set('provider')">
          <i class="pi pi-arrow-left mr-1"></i>{{ 'projects.new.chooseAnotherSource' | translate }}
        </button>

        @if (providerUser() === undefined) {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.checkingProvider' | translate }}</p>
        } @else if (providerUser() === null) {
          <div class="glass-card text-center p-6 rounded-2xl">
            <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
              {{ (provider() === 'github' ? 'projects.new.connectGithubDesc' : 'projects.new.connectGitlabDesc') | translate }}
            </p>
            <button class="inner-button" type="button" (click)="connectProvider()">
              {{ (provider() === 'github' ? 'projects.new.connectGithub' : 'projects.new.connectGitlab') | translate }}
            </button>
          </div>
        } @else {
          <input class="input font-mono text-xs" [ngModel]="repoQuery()" (ngModelChange)="repoQuery.set($event)" [placeholder]="'projects.new.searchReposPlaceholder' | translate" />
          @if (filteredRepos().length === 0) {
            <div class="glass-card p-6 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.noRepos' | translate }}</div>
          } @else {
            <div class="overflow-y-auto rounded-xl glass-card" style="max-height: 320px;">
              @for (repo of filteredRepos(); track repo.fullName) {
                <div class="flex items-center gap-3 p-3 hover:bg-[var(--glass-bg-subtle)] transition-colors" style="border-bottom:1px solid var(--glass-border-subtle);">
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-semibold font-mono">
                      {{ repo.name }}
                      @if (repo.private) { <i class="pi pi-lock ml-1.5 text-[10px]" style="color:var(--color-text-tertiary);"></i> }
                    </div>
                  </div>
                  <button class="outer-button text-xs px-3 py-1.5" type="button" (click)="importRepo(repo)">{{ 'projects.new.import' | translate }}</button>
                </div>
              }
            </div>
          }
        }
      }

      @if (stage() === 'configure') {
        <button type="button" class="text-xs hover:underline" style="color:var(--color-text-tertiary);" (click)="stage.set('repos')">
          <i class="pi pi-arrow-left mr-1"></i>{{ repo() }}
        </button>

        <div>
          <label class="mb-1 block text-sm font-semibold">{{ 'projects.import.applicationName' | translate }}</label>
          <input class="input" [ngModel]="projectName()" (ngModelChange)="projectName.set($event)" autocomplete="off" />
        </div>

        @if (detecting()) {
          <div class="flex items-center gap-2 rounded-xl p-3 border text-sm" style="border-color:var(--color-surface-2);color:var(--color-text-secondary);">
            <i class="pi pi-spinner pi-spin"></i> {{ 'projects.import.detecting' | translate }}
          </div>
        } @else if (ecosystemLabel()) {
          <div class="flex items-center gap-3 rounded-xl p-3 border" style="border-color:var(--color-surface-2);">
            <i [class]="presets[presetIndex()].icon" style="color:var(--color-text-secondary);"></i>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold">{{ presets[presetIndex()].label }}</div>
              <div class="text-xs" style="color:var(--color-text-tertiary);">{{ ecosystemLabel() }}</div>
            </div>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style="background:rgba(34,197,94,0.15);color:#4ade80;">
              <i class="pi pi-check mr-1"></i>{{ 'projects.import.autoDetectedBadge' | translate }}
            </span>
          </div>
        }

        @if (hasDockerfile()) {
          <div class="space-y-1.5 rounded-xl p-3 border text-sm" style="border-color:var(--color-surface-2);">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="guideAppBuildMethod" [checked]="buildMethod() === 'docker'" (change)="buildMethod.set('docker')" />
              <span><i class="pi pi-box mr-1 text-blue-400"></i>{{ 'projects.import.useDocker' | translate }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="guideAppBuildMethod" [checked]="buildMethod() === 'buildless'" (change)="buildMethod.set('buildless')" />
              <span><i class="pi pi-code mr-1 text-green-400"></i>{{ 'projects.import.withoutDocker' | translate }}</span>
            </label>
          </div>
        }

        @if (ecosystemWarnings().length > 0) {
          <div class="space-y-2">
            @for (w of ecosystemWarnings(); track w.code) {
              <div class="rounded-xl p-3 text-sm border"
                   [style.background]="w.severity === 'blocking' ? 'rgba(239,68,68,0.08)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)'"
                   [style.border-color]="w.severity === 'blocking' ? 'rgba(239,68,68,0.3)' : 'color-mix(in srgb, var(--color-warning) 40%, transparent)'">
                <i class="pi pi-exclamation-triangle mr-1.5" [style.color]="w.severity === 'blocking' ? '#f87171' : 'var(--color-warning)'"></i>
                <span [style.color]="w.severity === 'blocking' ? '#f87171' : 'var(--color-warning)'">{{ w.message }}</span>
              </div>
            }
          </div>
        }

        <div>
          <label class="mb-1 block text-sm font-semibold">{{ 'projects.import.rootDirectory' | translate }}</label>
          <input class="input font-mono" [ngModel]="rootDir()" (ngModelChange)="onRootDirEdit($event)" placeholder="./" autocomplete="off" />
          @if (rootDirAutoDetected()) {
            <p class="mt-1 text-xs" style="color:#4ade80;"><i class="pi pi-check mr-1"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
          }
          @if (monorepoCandidates().length > 0) {
            <div class="mt-2 rounded-xl border p-3" style="background:color-mix(in srgb, var(--color-warning) 8%, transparent);border-color:color-mix(in srgb, var(--color-warning) 30%, transparent);">
              <p class="mb-2 text-xs font-semibold" style="color:var(--color-warning);">
                <i class="pi pi-sitemap mr-1"></i>{{ 'projects.import.monorepoFound' | translate: { count: monorepoCandidates().length } }}
              </p>
              <div class="flex flex-wrap gap-2">
                @for (c of monorepoCandidates(); track c.dir) {
                  <button type="button" class="outer-button text-xs px-2.5 py-1.5 font-mono" (click)="pickMonorepoCandidate(c.dir)">{{ c.dir }}</button>
                }
              </div>
            </div>
          }
        </div>

        <button type="button" class="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm font-semibold" style="border:1px solid var(--color-surface-2);" (click)="showBuild.set(!showBuild())">
          <i class="pi" [class.pi-chevron-right]="!showBuild()" [class.pi-chevron-down]="showBuild()"></i>
          {{ 'projects.import.buildOutputSettings' | translate }}
        </button>
        @if (showBuild()) {
          <div class="space-y-3 px-1">
            <input class="input font-mono" [ngModel]="installCommand()" (ngModelChange)="installCommand.set($event)" [placeholder]="'projects.import.installCommandPlaceholder' | translate" autocomplete="off" />
            <input class="input font-mono" [ngModel]="buildCommand()" (ngModelChange)="buildCommand.set($event)" [placeholder]="'projects.import.buildCommandPlaceholder' | translate" autocomplete="off" />
            <input class="input font-mono" [ngModel]="startCommand()" (ngModelChange)="onStartCommandEdit($event)" [placeholder]="'projects.import.startCommandPlaceholder' | translate" autocomplete="off" />
            <input class="input font-mono" [ngModel]="portsExposes()" (ngModelChange)="onPortEdit($event)" [placeholder]="'projects.import.portPlaceholder' | translate" autocomplete="off" />
          </div>
        }

        <button type="button" class="flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left text-sm font-semibold" style="border:1px solid var(--color-surface-2);" (click)="showEnv.set(!showEnv())">
          <span class="flex items-center gap-2">
            <i class="pi" [class.pi-chevron-right]="!showEnv()" [class.pi-chevron-down]="showEnv()"></i>
            {{ 'projects.import.envVariables' | translate }}
          </span>
          @if (envRows().length > 0) {
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold" style="background:rgba(59,130,246,0.15);color:#60a5fa;">
              {{ 'projects.import.envDetectedBadge' | translate: { count: envRows().length } }}
            </span>
          }
        </button>
        @if (showEnv()) {
          <div class="px-1">
            @if (envRows().length > 0) {
              <div class="mb-3 space-y-2">
                @for (row of envRows(); track $index; let i = $index) {
                  <div>
                    <div class="flex items-center gap-2">
                      <input class="input font-mono flex-1" style="min-width:0;" [value]="row.key" (input)="updateEnvKey(i, $any($event.target).value)" autocomplete="off" />
                      <div class="relative flex-1" style="min-width:0;">
                        <input class="input font-mono w-full pr-9" [attr.type]="row.reveal ? 'text' : 'password'" [value]="row.value" (input)="updateEnvValue(i, $any($event.target).value)" autocomplete="off" />
                        <button type="button" class="absolute top-1/2 right-2.5 -translate-y-1/2" style="color:var(--color-text-tertiary);" (click)="toggleReveal(i)">
                          <i class="pi text-xs" [class.pi-eye]="!row.reveal" [class.pi-eye-slash]="row.reveal"></i>
                        </button>
                      </div>
                      <button type="button" class="px-2 py-2 text-sm" style="color:var(--color-text-tertiary);" (click)="removeEnvRow(i)"><i class="pi pi-minus"></i></button>
                    </div>
                    @if (row.linkedFrom) {
                      <p class="mt-1 ml-1 text-xs" style="color:#60a5fa;">
                        <i class="pi pi-link mr-1"></i>
                        {{ linkedFromLabel(row.linkedFrom) | translate: { name: linkedFromName(row.linkedFrom) } }}
                      </p>
                    }
                  </div>
                }
              </div>
            }
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="outer-button text-xs px-3 py-1.5" (click)="addEnvRow()"><i class="pi pi-plus mr-1"></i>{{ 'projects.import.addVariable' | translate }}</button>
              <button type="button" class="text-xs font-semibold hover:underline" style="color:#60a5fa;" (click)="envFileInput.click()"><i class="pi pi-file-import mr-1"></i>{{ 'projects.import.importEnvFile' | translate }}</button>
              <input #envFileInput type="file" accept=".env,text/plain" class="hidden" (change)="onImportEnvFile($event)" />
            </div>
            @if (envImportError()) {
              <p class="mt-2 text-xs" style="color:var(--color-danger);">{{ envImportError() }}</p>
            }
          </div>
        }

        @if (error()) {
          <p class="text-sm text-red-400"><i class="pi pi-exclamation-triangle mr-1"></i>{{ error() }}</p>
        }

        <button class="inner-button w-full py-2.5" type="button" [disabled]="deploying() || !projectName().trim()" (click)="deploy()">
          {{ (deploying() ? 'projects.import.deploying' : 'projects.common.deploy') | translate }}
        </button>
      }

      @if (stage() === 'deploying') {
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-sm">
            <i class="pi pi-spinner pi-spin" style="color:var(--color-primary-400);"></i>
            <span>{{ (deploymentInfo()?.status === 'in_progress' ? 'deploy.statusInProgress' : 'deploy.statusQueued') | translate }}</span>
          </div>
          <pre class="max-h-56 overflow-auto rounded-xl p-3 font-mono text-xs leading-relaxed" style="background:#080b12;color:#c9d1d9;">@for (line of consoleLines(); track $index) {<span>{{ line }}</span>
}@if (consoleLines().length === 0) {<span style="color:var(--color-text-tertiary);">{{ 'deploy.waitingForLogs' | translate }}</span>}</pre>
        </div>
      }

      @if (stage() === 'result') {
        <div class="space-y-4">
          @if (deploymentInfo(); as dep) {
            <div class="flex items-center gap-3">
              @if (dep.status === 'finished') {
                <span class="status-badge bg-green-500/10 text-green-400 border border-green-500/20">✓ {{ 'deploy.statusSuccess' | translate }}</span>
              } @else {
                <span class="status-badge bg-red-500/10 text-red-400 border border-red-500/20">✗ {{ 'deploy.statusFailed' | translate }}</span>
              }
              @if (dep.status === 'finished' && dep.application_url) {
                <a [href]="dep.application_url" target="_blank" rel="noopener noreferrer" class="inner-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  {{ 'deploy.visitApp' | translate }} <i class="pi pi-external-link text-[10px]"></i>
                </a>
              }
            </div>
            @if (dep.status === 'finished' && dep.application_url) {
              <p class="font-mono text-xs" style="color:var(--color-text-secondary);">{{ dep.application_url }}</p>
            }
          }

          <pre class="max-h-56 overflow-auto rounded-xl p-3 font-mono text-xs leading-relaxed" style="background:#080b12;color:#c9d1d9;">@for (line of consoleLines(); track $index) {<span>{{ line }}</span>
}</pre>

          @if (error()) {
            <p class="text-sm text-red-400">{{ error() }}</p>
          }

          <div class="flex gap-3">
            @if (deploymentInfo()?.status === 'failed') {
              <button class="outer-button text-xs px-3 py-1.5" type="button" (click)="retryDeploy()">{{ 'architectures.dbStep.retryStart' | translate }}</button>
              <button class="inner-button" type="button" (click)="finish()">{{ 'architectures.dbStep.continueAnyway' | translate }}</button>
            } @else {
              <button class="inner-button" type="button" (click)="finish()">{{ 'projects.new.continue' | translate }}</button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class GuideAppStepComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private guideSession = inject(GuideSessionService);
  private realtime = inject(RealtimeService);

  readonly architectureId = input.required<string>();
  readonly workspaceUuid = input.required<string>();
  readonly role = input<GuideStepRole | undefined>(undefined);
  readonly suggestedName = input<string>('');
  readonly completed = output<void>();

  protected readonly stage = signal<Stage>('provider');
  protected readonly provider = signal<GitProvider>('github');
  protected readonly githubUser = signal<string | null | undefined>(undefined);
  protected readonly gitlabUser = signal<string | null | undefined>(undefined);
  protected readonly githubRepos = signal<GithubRepo[]>([]);
  protected readonly gitlabRepos = signal<GithubRepo[]>([]);
  protected readonly repoQuery = signal('');

  protected readonly providerUser = computed(() => (this.provider() === 'gitlab' ? this.gitlabUser() : this.githubUser()));
  private readonly providerRepos = computed(() => (this.provider() === 'gitlab' ? this.gitlabRepos() : this.githubRepos()));
  protected readonly filteredRepos = computed(() => {
    const q = this.repoQuery().trim().toLowerCase();
    const repos = this.providerRepos();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  });

  protected readonly repo = signal('');
  protected readonly branch = signal('main');
  protected readonly projectName = signal('');
  protected readonly presetIndex = signal(0);
  protected readonly hasDockerfile = signal(false);
  protected readonly hasDockerCompose = signal(false);
  protected readonly buildMethod = signal<'docker' | 'buildless'>('buildless');
  protected readonly detecting = signal(false);
  protected readonly detectedEcosystem = signal<string | null>(null);
  protected readonly detectedBuildTool = signal<string | null>(null);
  protected readonly rootDir = signal('./');
  protected readonly rootDirAutoDetected = signal(false);
  protected readonly monorepoCandidates = signal<ManifestDirectory[]>([]);
  protected readonly showBuild = signal(false);
  protected readonly installCommand = signal('');
  protected readonly buildCommand = signal('');
  protected readonly startCommand = signal('');
  protected readonly startCommandAutoDetected = signal(false);
  protected readonly portsExposes = signal('');
  protected readonly portAutoDetected = signal(false);
  protected readonly ecosystemWarnings = signal<EcosystemWarning[]>([]);
  protected readonly showEnv = signal(false);
  protected readonly envRows = signal<EnvRow[]>([]);
  protected readonly envImportError = signal<string | null>(null);
  protected readonly deploying = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The in-flight (or just-finished) deployment's own row — `status`/`application_uuid`/`application_name`/`application_url`, same loose shape `deployment-logs.ts` uses. */
  protected readonly deploymentInfo = signal<any>(null);
  protected readonly consoleLines = signal<string[]>([]);

  private readonly linkedDatabaseName = signal<string | null>(null);
  private readonly linkedCacheName = signal<string | null>(null);
  private readonly linkedBackendName = signal<string | null>(null);
  private cloneUrl = '';
  private unsubscribeRealtime?: () => void;
  private pollSub?: Subscription;

  private static readonly ECOSYSTEM_NAMES: Record<string, string> = {
    node: 'Node.js',
    'java-maven': 'Java',
    'java-gradle': 'Java',
    python: 'Python',
    go: 'Go',
    ruby: 'Ruby',
    php: 'PHP',
    dockerfile: 'Docker',
  };

  protected readonly ecosystemLabel = computed(() => {
    const eco = this.detectedEcosystem();
    if (!eco || eco === 'unknown') return null;
    const name = GuideAppStepComponent.ECOSYSTEM_NAMES[eco] ?? eco;
    const tool = this.detectedBuildTool();
    return tool ? `${name} · ${tool}` : name;
  });

  protected readonly presets: Preset[] = [
    { label: 'Vite', icon: 'pi pi-bolt', buildPack: 'nixpacks' },
    { label: 'Next.js', icon: 'pi pi-desktop', buildPack: 'nixpacks' },
    { label: 'Node.js', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Angular', icon: 'pi pi-desktop', buildPack: 'nixpacks' },
    { label: 'Static', icon: 'pi pi-file', buildPack: 'static' },
    { label: 'Spring Boot (Maven)', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Java (Maven)', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Spring Boot (Gradle)', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Java (Gradle)', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Django', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'FastAPI', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Flask', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Python', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Go', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Ruby on Rails', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Ruby', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Laravel', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'PHP', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Dockerfile', icon: 'pi pi-box', buildPack: 'dockerfile' },
    { label: 'Other', icon: 'pi pi-box', buildPack: 'nixpacks' },
  ];

  ngOnInit(): void {
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
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
    this.pollSub?.unsubscribe();
  }

  private resetDetectionState(): void {
    this.presetIndex.set(0);
    this.hasDockerfile.set(false);
    this.hasDockerCompose.set(false);
    this.buildMethod.set('buildless');
    this.detectedEcosystem.set(null);
    this.detectedBuildTool.set(null);
    this.rootDir.set('./');
    this.rootDirAutoDetected.set(false);
    this.monorepoCandidates.set([]);
    this.showBuild.set(false);
    this.installCommand.set('');
    this.buildCommand.set('');
    this.startCommand.set('');
    this.startCommandAutoDetected.set(false);
    this.portsExposes.set('');
    this.portAutoDetected.set(false);
    this.ecosystemWarnings.set([]);
    this.showEnv.set(false);
    this.envRows.set([]);
    this.envImportError.set(null);
    this.error.set(null);
    this.linkedDatabaseName.set(null);
    this.linkedCacheName.set(null);
    this.linkedBackendName.set(null);
  }

  protected pickProvider(p: GitProvider): void {
    this.provider.set(p);
    this.repoQuery.set('');
    this.stage.set('repos');
  }

  protected connectProvider(): void {
    this.error.set(null);
    const returnTo = `/new-project/guide/${this.architectureId()}`;
    const authUrl$ = this.provider() === 'github' ? this.api.githubAuthUrl(returnTo) : this.api.gitlabAuthUrl(returnTo);
    authUrl$.subscribe({
      next: (url) => {
        if (!url) {
          this.error.set(this.translate.instant(this.provider() === 'github' ? 'projects.new.errGithubNotConfigured' : 'projects.new.errGitlabNotConfigured'));
          return;
        }
        window.location.href = url;
      },
      error: (e) => {
        const code = (e as { error?: { error?: { code?: string } } })?.error?.error?.code;
        const notConfigured = code === 'GITHUB_NOT_CONFIGURED' || code === 'GITLAB_NOT_CONFIGURED';
        this.error.set(
          this.translate.instant(
            notConfigured
              ? this.provider() === 'github' ? 'projects.new.errGithubNotConfigured' : 'projects.new.errGitlabNotConfigured'
              : this.provider() === 'github' ? 'projects.new.errGithubUnreachable' : 'projects.new.errGitlabUnreachable'
          )
        );
      },
    });
  }

  protected importRepo(repoItem: GithubRepo): void {
    // Going back and picking a different repo reuses this same component
    // instance — without a reset, a monorepo root directory or a warning
    // detected for the previous repo would silently linger onto this one.
    this.resetDetectionState();
    this.repo.set(repoItem.fullName);
    this.branch.set(repoItem.defaultBranch || 'main');
    this.projectName.set(repoItem.name || this.suggestedName());
    this.cloneUrl = repoItem.cloneUrl;
    this.stage.set('configure');
    this.detecting.set(true);

    const detect$ = this.provider() === 'gitlab' ? this.api.gitlabDetect(repoItem.fullName) : this.api.githubDetect(repoItem.fullName);
    detect$.subscribe({
      next: (d) => {
        this.detecting.set(false);
        this.detectedEcosystem.set(d.ecosystem ?? null);
        this.detectedBuildTool.set(d.buildTool ?? null);
        const idx = this.presets.findIndex((p) => p.label === d.preset);
        if (idx >= 0) this.presetIndex.set(idx);
        this.hasDockerfile.set(d.hasDockerfile);
        this.hasDockerCompose.set(d.hasDockerCompose || false);
        this.buildMethod.set(d.buildPack === 'dockerfile' ? 'docker' : 'buildless');
        if (d.envVars?.length) {
          this.envRows.set(d.envVars.map((v) => ({ key: v.key, value: v.defaultValue, reveal: true })));
        }
        this.applyGuideLinks();
        if (d.suggestedPort !== null && d.suggestedPort !== undefined) {
          this.portsExposes.set(String(d.suggestedPort));
          this.portAutoDetected.set(true);
        }
        if (d.startCommandHint) {
          this.startCommand.set(d.startCommandHint);
          this.startCommandAutoDetected.set(true);
        }
        this.ecosystemWarnings.set(d.warnings ?? []);
        if (d.rootDirSuggestion) {
          this.rootDir.set(d.rootDirSuggestion);
          this.rootDirAutoDetected.set(true);
        }
        this.monorepoCandidates.set(d.monorepoCandidates ?? []);
        if (d.suggestedPort || d.startCommandHint || (d.warnings ?? []).length > 0) {
          this.showBuild.set(true);
        }
      },
      error: () => this.detecting.set(false),
    });
  }

  /**
   * Overwrites a detected env var's value with what an earlier guide step
   * actually created, when its key unambiguously names that kind of thing —
   * see `guide-env-link.util.ts`. A `backend` step gets both the database
   * and (when this architecture added one) the Redis cache; a `frontend`
   * step gets the most recently deployed backend's own public URL.
   */
  private applyGuideLinks(): void {
    if (this.role() === 'backend') {
      const db = this.guideSession.database(this.architectureId());
      if (db?.connectionUrl) {
        this.linkedDatabaseName.set(db.name);
        const value = forEcosystem(db.connectionUrl, this.detectedEcosystem());
        this.envRows.update((rows) => rows.map((r) => (isDatabaseUrlKey(r.key) ? { ...r, value, linkedFrom: 'database' } : r)));
      }
      const cache = this.guideSession.cache(this.architectureId());
      if (cache?.connectionUrl) {
        this.linkedCacheName.set(cache.name);
        this.envRows.update((rows) => rows.map((r) => (isRedisUrlKey(r.key) ? { ...r, value: cache.connectionUrl!, linkedFrom: 'cache' } : r)));
      }
    }
    if (this.role() === 'frontend') {
      const backend = this.guideSession.latestBackend(this.architectureId());
      if (backend?.publicUrl) {
        this.linkedBackendName.set(backend.name);
        this.envRows.update((rows) => rows.map((r) => (isApiUrlKey(r.key) ? { ...r, value: backend.publicUrl!, linkedFrom: 'backend' } : r)));
      }
    }
  }

  protected linkedFromLabel(kind: 'database' | 'cache' | 'backend'): string {
    if (kind === 'database') return 'projects.import.linkedFromDatabase';
    if (kind === 'cache') return 'projects.import.linkedFromCache';
    return 'projects.import.linkedFromBackend';
  }

  protected linkedFromName(kind: 'database' | 'cache' | 'backend'): string | null {
    if (kind === 'database') return this.linkedDatabaseName();
    if (kind === 'cache') return this.linkedCacheName();
    return this.linkedBackendName();
  }

  protected onStartCommandEdit(value: string): void {
    this.startCommand.set(value);
    this.startCommandAutoDetected.set(false);
  }

  protected onPortEdit(value: string): void {
    this.portsExposes.set(value);
    this.portAutoDetected.set(false);
  }

  protected onRootDirEdit(value: string): void {
    this.rootDir.set(value);
    this.rootDirAutoDetected.set(false);
  }

  protected pickMonorepoCandidate(dir: string): void {
    this.rootDir.set(dir);
    this.rootDirAutoDetected.set(true);
    this.monorepoCandidates.set([]);
  }

  protected addEnvRow(): void {
    this.envRows.update((rows) => [...rows, { key: '', value: '', reveal: false }]);
  }

  protected removeEnvRow(index: number): void {
    this.envRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected updateEnvKey(index: number, key: string): void {
    this.envRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, key } : r)));
  }

  protected updateEnvValue(index: number, value: string): void {
    this.envRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, value, linkedFrom: undefined } : r)));
  }

  protected toggleReveal(index: number): void {
    this.envRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, reveal: !r.reveal } : r)));
  }

  protected onImportEnvFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.envImportError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseEnvFile(text);
      if (parsed.length === 0) {
        this.envImportError.set(this.translate.instant('projects.import.envImportEmpty'));
        return;
      }
      this.envRows.update((rows) => {
        const byKey = new Map(rows.map((r) => [r.key, r]));
        for (const { key, value } of parsed) byKey.set(key, { key, value, reveal: false });
        return [...byKey.values()];
      });
    };
    reader.onerror = () => this.envImportError.set(this.translate.instant('projects.import.envImportError'));
    reader.readAsText(file);
  }

  protected deploy(): void {
    if (!this.projectName().trim() || !this.cloneUrl) return;
    this.deploying.set(true);
    this.error.set(null);
    const buildPack = this.buildMethod() === 'docker' ? 'dockerfile' : 'nixpacks';
    const environmentVariables = this.envRows()
      .filter((r) => r.key.trim())
      .map((r) => ({ key: r.key.trim(), value: r.value }));
    this.api
      .quickDeploy({
        name: this.projectName().trim(),
        workspace_uuid: this.workspaceUuid(),
        git_repository: this.cloneUrl,
        git_branch: this.branch(),
        build_pack: buildPack,
        base_directory: this.rootDir(),
        install_command: this.installCommand() || undefined,
        build_command: this.buildCommand() || undefined,
        start_command: this.startCommand() || undefined,
        ports_exposes: this.portsExposes() || undefined,
        environment_variables: environmentVariables.length > 0 ? environmentVariables : undefined,
      })
      .subscribe({
        next: (res) => {
          this.deploying.set(false);
          if (res.deploymentUuid) {
            this.trackDeployment(res.deploymentUuid);
          } else {
            // No deployment to track (not the git-repository path this form
            // always takes, but defensively handled) — nothing to show
            // progress for, so this is the one case still completed inline.
            this.guideSession.linkApp(this.architectureId(), { uuid: '', name: this.projectName().trim(), publicUrl: null, role: this.role() });
            this.completed.emit();
          }
        },
        error: (e) => {
          this.deploying.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
        },
      });
  }

  /** Live console + polled status, exactly `deployment-logs.ts`'s own pattern — see this file's class doc for why polling, not the realtime channel, is what detects completion. */
  private trackDeployment(deploymentUuid: string): void {
    this.stage.set('deploying');
    this.deploymentInfo.set(null);
    this.consoleLines.set([]);
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.realtime.subscribeToDeployment(deploymentUuid, (line) => this.consoleLines.update((lines) => [...lines, line]));

    this.pollSub?.unsubscribe();
    this.pollSub = interval(4000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.getDeployment(deploymentUuid)),
        takeWhile((d) => d && (d.status === 'queued' || d.status === 'in_progress'), true)
      )
      .subscribe({
        next: (d) => {
          if (!d) return;
          this.deploymentInfo.set(d);
          if (d.status === 'finished' || d.status === 'failed') {
            this.unsubscribeRealtime?.();
            this.stage.set('result');
          }
        },
        error: () => {
          this.unsubscribeRealtime?.();
          this.stage.set('result');
        },
      });
  }

  protected retryDeploy(): void {
    const applicationUuid = this.deploymentInfo()?.application_uuid;
    if (!applicationUuid) return;
    this.api.deploy(applicationUuid).subscribe({
      next: (res) => this.trackDeployment(res.deploymentUuid),
      error: (e) => this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed')),
    });
  }

  /**
   * Only now — once the operator has actually seen the build finish (or
   * chosen to move on despite a failure) — does this step register as done.
   * Linking any earlier would flip the parent guide's `isDone()` the same
   * render pass the deploy was merely queued, destroying this component
   * before the live console or the app's URL was ever shown — the exact bug
   * `guide-db-step.ts` had for its own "creating…done" gap.
   */
  protected finish(): void {
    const dep = this.deploymentInfo();
    this.guideSession.linkApp(this.architectureId(), {
      uuid: dep?.application_uuid ?? '',
      name: dep?.application_name ?? this.projectName().trim(),
      publicUrl: dep?.application_url ?? null,
      role: this.role(),
    });
    this.completed.emit();
  }
}
