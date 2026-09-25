import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { environment } from '../../../../environments/environment';
import { parseEnvFile } from '../../../shared/utils/parse-env-file.util';
import { EcosystemWarning, ManifestDirectory } from '../../../shared/models/ideploy.models';
import {
  WorkspaceChoice,
  WorkspaceChoicePickerComponent,
} from '../../../shared/components/workspace-choice-picker/workspace-choice-picker';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { FrameworkLogoComponent } from '../../../shared/components/framework-logo/framework-logo';

interface EnvRow {
  key: string;
  value: string;
  reveal: boolean;
}

interface Preset {
  label: string;
  icon: string;
  buildPack: string;
}

/**
 * Import configuration — step 2 of "New project".
 *
 * Four short sections (name, where it goes, how it builds, variables) and a
 * summary that holds the one button. Detection fills in what it can read from
 * the repository; everything it filled stays editable and says so.
 */
@Component({
  selector: 'app-import-config',
  imports: [FormsModule, RouterLink, TranslateModule, WorkspaceChoicePickerComponent, IdemLoaderComponent, FrameworkLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .step-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      color: var(--color-primary-500);
      border: 1px solid color-mix(in srgb, var(--color-primary-500) 40%, transparent);
    }
  `,
  template: `
    <header class="flex h-16 items-center justify-between border-b px-4 sm:px-6" style="border-color:var(--glass-border-subtle);">
      <a routerLink="/new-project" [queryParams]="lockedWorkspaceUuid() ? { workspace: lockedWorkspaceUuid() } : {}"
         class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="pi pi-arrow-left" aria-hidden="true"></i> {{ 'projects.configure.changeSource' | translate }}
      </a>
      <a routerLink="/dashboard" class="shrink-0" aria-label="iDeploy">
        <img src="/assets/logos/Ideploy%20logo%20light.png" alt="iDeploy" class="h-7 w-auto dark:hidden" />
        <img src="/assets/logos/Ideploy%20logo%20dark.png" alt="" aria-hidden="true" class="hidden h-7 w-auto dark:block" />
      </a>
      <span class="w-16" aria-hidden="true"></span>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-text-primary">{{ 'projects.configure.heading' | translate: { name: repoName() } }}</h1>
        <p class="mt-2 text-sm" style="color:var(--color-text-secondary);">{{ 'projects.configure.subheading' | translate }}</p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-5">
          <!-- 1. Application -->
          <section class="glass-card rounded-2xl p-5 sm:p-6" aria-labelledby="s-app">
            <h2 id="s-app" class="mb-4 flex items-center gap-3 font-semibold text-text-primary">
              <span class="step-index">1</span>{{ 'projects.configure.sectionApp' | translate }}
            </h2>
            <label class="mb-1.5 block text-sm font-medium" for="projectName">{{ 'projects.import.applicationName' | translate }}</label>
            <input type="text" id="projectName" name="projectName" [(ngModel)]="projectName" autocomplete="off" />
            <p class="mt-1.5 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.nameHint' | translate }}</p>
          </section>

          <!-- 2. Where it goes -->
          <section class="glass-card rounded-2xl p-5 sm:p-6" aria-labelledby="s-where">
            <h2 id="s-where" class="mb-4 flex items-center gap-3 font-semibold text-text-primary">
              <span class="step-index">2</span>{{ 'projects.configure.sectionWhere' | translate }}
            </h2>
            <app-workspace-choice-picker
              [suggestedName]="projectName"
              [lockedWorkspaceUuid]="lockedWorkspaceUuid()"
              (choiceChange)="workspaceChoice.set($event)"
            />
          </section>

          <!-- 3. Build -->
          <section class="glass-card rounded-2xl p-5 sm:p-6" aria-labelledby="s-build">
            <h2 id="s-build" class="mb-4 flex items-center gap-3 font-semibold text-text-primary">
              <span class="step-index">3</span>{{ 'projects.configure.sectionBuild' | translate }}
            </h2>

            <!-- What detection read from the repository leads; the select is the override. -->
            <label class="mb-1.5 block text-sm font-medium" for="appPreset">{{ 'projects.configure.framework' | translate }}</label>
            @if (detecting()) {
              <div class="mb-2 flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
                <idem-loader size="xs" /> {{ 'projects.import.detecting' | translate }}
              </div>
            }
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div class="flex items-center gap-3">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style="border-color:var(--glass-border-subtle);">
                  <app-framework-logo [framework]="presets[presetIndex()].label" [size]="22" />
                </span>
              <select id="appPreset" name="appPreset" class="cursor-pointer sm:!w-64" [ngModel]="presetIndex()" (ngModelChange)="presetIndex.set(+$event)">
                @for (p of presets; track p.label; let i = $index) {
                  <option [value]="i">{{ p.label }}</option>
                }
              </select>
              </div>
              @if (!detecting() && ecosystemLabel()) {
                <span class="flex items-center gap-1.5 text-xs" style="color:var(--color-success);">
                  <i class="pi pi-check-circle" aria-hidden="true"></i>{{ 'projects.configure.detectedAs' | translate: { label: ecosystemLabel() } }}
                </span>
              }
            </div>

            @if (canChooseBuildMethod()) {
              <div class="mt-5" role="radiogroup" aria-labelledby="build-method-label">
                <span id="build-method-label" class="mb-2 block text-sm font-medium">{{ 'projects.configure.buildMethod' | translate }}</span>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  @for (m of buildMethods; track m.id) {
                    <label class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
                           [style.border-color]="buildMethod() === m.id ? 'var(--color-primary-500)' : 'var(--glass-border-subtle)'">
                      <input type="radio" name="buildMethod" class="mt-0.5 cursor-pointer" [checked]="buildMethod() === m.id" (change)="buildMethod.set(m.id)" />
                      <span>
                        <span class="block text-sm font-medium text-text-primary">{{ m.titleKey | translate }}</span>
                        <span class="block text-xs" style="color:var(--color-text-secondary);">{{ m.descKey | translate }}</span>
                      </span>
                    </label>
                  }
                </div>
              </div>
            }

            <!-- A blocking finding means the build engine will refuse this repo as configured. -->
            @for (w of ecosystemWarnings(); track w.code) {
              <p class="mt-4 flex gap-2 rounded-xl border p-3 text-sm" role="alert"
                 [style.color]="w.severity === 'blocking' ? 'var(--color-danger)' : 'var(--color-warning)'"
                 [style.border-color]="w.severity === 'blocking' ? 'color-mix(in srgb, var(--color-danger) 35%, transparent)' : 'color-mix(in srgb, var(--color-warning) 40%, transparent)'">
                <i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i><span>{{ w.message }}</span>
              </p>
            }

            <div class="mt-5">
              <label class="mb-1.5 block text-sm font-medium" for="rootDir">{{ 'projects.import.rootDirectory' | translate }}</label>
              <input type="text" id="rootDir" name="rootDir" class="font-mono" [ngModel]="rootDir" (ngModelChange)="onRootDirEdit($event)" placeholder="./" autocomplete="off" />
              @if (rootDirAutoDetected()) {
                <p class="mt-1.5 text-xs" style="color:var(--color-success);"><i class="pi pi-check mr-1" aria-hidden="true"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
              } @else {
                <p class="mt-1.5 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.rootDirHint' | translate }}</p>
              }

              <!-- Monorepo with 2+ plausible roots: which one deploys is the user's call, not a guess. -->
              @if (monorepoCandidates().length > 0) {
                <div class="mt-3 rounded-xl border p-3" style="border-color:color-mix(in srgb, var(--color-warning) 40%, transparent);">
                  <p class="mb-2 text-xs font-medium" style="color:var(--color-warning);">
                    {{ 'projects.import.monorepoFound' | translate: { count: monorepoCandidates().length } }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (c of monorepoCandidates(); track c.dir) {
                      <button type="button" class="outer-button button-sm font-mono" (click)="pickMonorepoCandidate(c.dir)">{{ c.dir }}</button>
                    }
                  </div>
                </div>
              }
            </div>

            <button type="button" class="mt-5 flex w-full cursor-pointer items-center justify-between border-t pt-4 text-left text-sm font-medium"
                    style="border-color:var(--glass-border-subtle);" [attr.aria-expanded]="showBuild()" (click)="showBuild.set(!showBuild())">
              {{ 'projects.configure.advanced' | translate }}
              <i class="pi text-xs" [class.pi-chevron-down]="!showBuild()" [class.pi-chevron-up]="showBuild()" aria-hidden="true"></i>
            </button>
            @if (showBuild()) {
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="installCmd">{{ 'projects.import.installCommandLabel' | translate }}</label>
                  <input type="text" id="installCmd" class="font-mono" [(ngModel)]="installCommand" placeholder="npm install" autocomplete="off" />
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="buildCmd">{{ 'projects.import.buildCommandLabel' | translate }}</label>
                  <input type="text" id="buildCmd" class="font-mono" [(ngModel)]="buildCommand" placeholder="npm run build" autocomplete="off" />
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="startCmd">{{ 'projects.import.startCommandLabel' | translate }}</label>
                  <input type="text" id="startCmd" class="font-mono" [ngModel]="startCommand" (ngModelChange)="onStartCommandEdit($event)" placeholder="npm run start" autocomplete="off" />
                  @if (startCommandAutoDetected()) {
                    <p class="mt-1.5 text-xs" style="color:var(--color-success);"><i class="pi pi-check mr-1" aria-hidden="true"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
                  }
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium" for="portCmd">{{ 'projects.import.portLabel' | translate }}</label>
                  <input type="text" id="portCmd" class="font-mono" inputmode="numeric" [ngModel]="portsExposes" (ngModelChange)="onPortEdit($event)" placeholder="3000" autocomplete="off" />
                  @if (portAutoDetected()) {
                    <p class="mt-1.5 text-xs" style="color:var(--color-success);"><i class="pi pi-check mr-1" aria-hidden="true"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
                  }
                </div>
                <p class="text-xs sm:col-span-2" style="color:var(--color-text-tertiary);">{{ 'projects.configure.advancedHint' | translate }}</p>
              </div>
            }
          </section>

          <!-- 4. Environment variables — pre-filled from the repository's own .env.example. -->
          <section class="glass-card rounded-2xl p-5 sm:p-6" aria-labelledby="s-env">
            <button type="button" class="flex w-full cursor-pointer items-center justify-between text-left" [attr.aria-expanded]="showEnv()" (click)="showEnv.set(!showEnv())">
              <h2 id="s-env" class="flex items-center gap-3 font-semibold text-text-primary">
                <span class="step-index">4</span>{{ 'projects.import.envVariables' | translate }}
                @if (envRows().length > 0) {
                  <span class="tag text-[10px]">{{ 'projects.import.envDetectedBadge' | translate: { count: envRows().length } }}</span>
                }
              </h2>
              <i class="pi text-xs" [class.pi-chevron-down]="!showEnv()" [class.pi-chevron-up]="showEnv()" aria-hidden="true"></i>
            </button>
            @if (showEnv()) {
              <p class="mb-4 mt-3 text-xs" style="color:var(--color-text-secondary);">{{ 'projects.configure.envHint' | translate }}</p>
              @if (envRows().length > 0) {
                <div class="mb-3 space-y-2">
                  @for (row of envRows(); track $index; let i = $index) {
                    <div class="flex items-center gap-2">
                      <input type="text" class="font-mono flex-1 !w-auto min-w-0" [value]="row.key"
                             (input)="updateEnvKey(i, $any($event.target).value)"
                             [placeholder]="'projects.import.envKeyPlaceholder' | translate"
                             [attr.aria-label]="'projects.import.envKeyLabel' | translate" autocomplete="off" />
                      <div class="relative min-w-0 flex-1">
                        <input class="font-mono !w-full pr-9" [attr.type]="row.reveal ? 'text' : 'password'" type="text" [value]="row.value"
                               (input)="updateEnvValue(i, $any($event.target).value)"
                               [placeholder]="'projects.import.envValuePlaceholder' | translate"
                               [attr.aria-label]="'projects.import.envValueLabel' | translate" autocomplete="off" />
                        <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style="color:var(--color-text-tertiary);"
                                [attr.aria-label]="(row.reveal ? 'projects.import.hideValue' : 'projects.import.revealValue') | translate" (click)="toggleReveal(i)">
                          <i class="pi text-xs" [class.pi-eye]="!row.reveal" [class.pi-eye-slash]="row.reveal" aria-hidden="true"></i>
                        </button>
                      </div>
                      <button type="button" class="button-icon cursor-pointer" style="color:var(--color-text-tertiary);"
                              [attr.aria-label]="'projects.import.removeVariable' | translate" (click)="removeEnvRow(i)">
                        <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                      </button>
                    </div>
                  }
                </div>
              }
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" class="outer-button button-sm" (click)="addEnvRow()">
                  <i class="pi pi-plus mr-1" aria-hidden="true"></i>{{ 'projects.import.addVariable' | translate }}
                </button>
                <button type="button" class="cursor-pointer text-xs font-medium text-primary-500 hover:underline" (click)="envFileInput.click()">
                  {{ 'projects.import.importEnvFile' | translate }}
                </button>
                <input #envFileInput type="file" accept=".env,text/plain" class="hidden" (change)="onImportEnvFile($event)" />
              </div>
              @if (envImportError()) {
                <p class="mt-2 text-xs" role="alert" style="color:var(--color-danger);">{{ envImportError() }}</p>
              }
            }
          </section>
        </div>

        <!-- Summary: what will happen when the button is pressed. -->
        <aside class="lg:sticky lg:top-6 lg:self-start">
          <div class="glass-card rounded-2xl p-5">
            <h2 class="mb-4 text-sm font-semibold text-text-primary">{{ 'projects.configure.summary' | translate }}</h2>
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.source' | translate }}</dt>
                <dd class="mt-0.5 flex min-w-0 items-center gap-1.5 text-text-primary">
                  <i [class]="provider === 'gitlab' ? 'pi pi-sitemap' : 'pi pi-github'" aria-hidden="true"></i>
                  <span class="truncate">{{ repo() }}</span>
                </dd>
                <dd class="mt-1"><span class="tag text-[10px]"><i class="pi pi-share-alt mr-1" aria-hidden="true"></i>{{ branch() }}</span></dd>
              </div>
              <div>
                <dt class="text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.framework' | translate }}</dt>
                <dd class="mt-0.5 flex items-center gap-1.5 text-text-primary">
                  <app-framework-logo [framework]="presets[presetIndex()].label" [size]="16" />{{ presets[presetIndex()].label }}
                  <span style="color:var(--color-text-secondary);">· {{ (buildMethod() === 'docker' ? 'projects.configure.viaDocker' : 'projects.configure.viaAuto') | translate }}</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.team' | translate }}</dt>
                <dd class="mt-0.5 text-text-primary">{{ teamName() }}</dd>
              </div>
              @if (envRows().length > 0) {
                <div>
                  <dt class="text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.import.envVariables' | translate }}</dt>
                  <dd class="mt-0.5 text-text-primary">{{ envRows().length }}</dd>
                </div>
              }
            </dl>

            @if (error()) {
              <div class="mt-4 rounded-xl border p-3 text-sm" role="alert" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
                <p style="color:var(--color-danger);">{{ error() }}</p>
                @if (isServerError()) {
                  <div class="mt-3 flex flex-wrap items-center gap-3">
                    @if (!isProd) {
                      <button type="button" class="outer-button button-sm" [disabled]="settingUpLocal()" (click)="useLocalServer()">
                        @if (settingUpLocal()) { <idem-loader size="xs" /> }
                        {{ 'projects.import.useLocalMachine' | translate }}
                      </button>
                    }
                    <a routerLink="/servers/new" class="text-xs font-medium text-primary-500 hover:underline">{{ 'projects.import.addServer' | translate }}</a>
                  </div>
                }
              </div>
            }

            <button type="button" class="inner-button mt-5 w-full" [disabled]="deploying() || !projectName.trim() || !workspaceChoice()" (click)="executeDeploy()">
              @if (deploying()) { <idem-loader size="xs" /> }
              {{ (deploying() ? 'projects.configure.publishing' : 'projects.configure.publish') | translate }}
            </button>
            <p class="mt-2 text-center text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.configure.publishHint' | translate }}</p>
          </div>
        </aside>
      </div>
    </main>
  `,
})
export class ImportConfigComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly repo = signal('');
  /** Last segment of `owner/name` — what the heading calls the project. */
  protected readonly repoName = computed(() => this.repo().split('/').pop() || this.repo());
  protected readonly branch = signal('main');
  protected readonly teamName = signal('My Team');
  protected readonly presetIndex = signal(0);
  protected readonly isProd = environment.production;
  protected readonly hasDockerfile = signal(false);
  protected readonly hasDockerCompose = signal(false);
  protected readonly buildMethod = signal<'docker' | 'buildless'>('buildless');
  /** Docker vs automatic build is only a real choice when the repository ships Docker files. */
  protected readonly canChooseBuildMethod = computed(() => this.hasDockerfile() || this.hasDockerCompose());
  protected readonly buildMethods: { id: 'docker' | 'buildless'; titleKey: string; descKey: string }[] = [
    { id: 'buildless', titleKey: 'projects.configure.methodAuto', descKey: 'projects.configure.methodAutoDesc' },
    { id: 'docker', titleKey: 'projects.configure.methodDocker', descKey: 'projects.configure.methodDockerDesc' },
  ];
  /** Where this lands — an existing workspace, or a new one. Never implicit. */
  protected readonly workspaceChoice = signal<WorkspaceChoice | null>(null);
  /** Set when arriving from a specific workspace's "+ Nouvelle ressource" link. */
  protected readonly lockedWorkspaceUuid = signal<string | null>(null);
  protected readonly deploying = signal(false);
  protected readonly settingUpLocal = signal(false);
  protected readonly error = signal<string | null>(null);
  /** No server or destination to run on — the error block then offers the two ways out. */
  protected readonly isServerError = computed(() => /server|destination/i.test(this.error() ?? ''));
  protected readonly showBuild = signal(false);
  protected readonly showEnv = signal(false);
  protected readonly envRows = signal<EnvRow[]>([]);
  protected readonly envImportError = signal<string | null>(null);
  /** Pre-flight findings from ecosystem detection — a blocking one means the build engine will refuse this repo as-is. */
  protected readonly ecosystemWarnings = signal<EcosystemWarning[]>([]);
  /** Raw detection results, kept only for the "detected configuration" summary — the preset dropdown above stays the actual source of truth for what deploys. */
  protected readonly detectedEcosystem = signal<string | null>(null);
  protected readonly detectedBuildTool = signal<string | null>(null);
  protected readonly detecting = signal(false);
  protected readonly portAutoDetected = signal(false);
  protected readonly startCommandAutoDetected = signal(false);
  protected readonly rootDirAutoDetected = signal(false);
  /** Set only when the repository has 2+ plausible application roots and none could be picked automatically. */
  protected readonly monorepoCandidates = signal<ManifestDirectory[]>([]);

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

  /** "Java · Maven", "Node.js · pnpm", … — null while nothing recognisable was found (a plain "Other" repo, or detection still running). */
  protected readonly ecosystemLabel = computed(() => {
    const eco = this.detectedEcosystem();
    if (!eco || eco === 'unknown') return null;
    const name = ImportConfigComponent.ECOSYSTEM_NAMES[eco] ?? eco;
    const tool = this.detectedBuildTool();
    return tool ? `${name} · ${tool}` : name;
  });

  protected projectName = '';
  protected rootDir = './';
  protected installCommand = '';
  protected buildCommand = '';
  protected startCommand = '';
  protected portsExposes = '';
  private cloneUrl = '';
  /** Which connected provider (if any) supplied this repo — decides whether `githubDetect` or `gitlabDetect` runs. Defaults to 'github' for a pasted URL, matching the previous behaviour. */
  protected provider: 'github' | 'gitlab' = 'github';

  protected readonly presets: Preset[] = [
    { label: 'Vite', icon: 'pi pi-bolt', buildPack: 'nixpacks' },
    { label: 'Next.js', icon: 'pi pi-desktop', buildPack: 'nixpacks' },
    { label: 'Node.js', icon: 'pi pi-code', buildPack: 'nixpacks' },
    { label: 'Angular', icon: 'pi pi-desktop', buildPack: 'nixpacks' },
    { label: 'Static', icon: 'pi pi-file', buildPack: 'static' },
    // Nixpacks (the build engine) already builds every one of these
    // natively — the gap was only ever that nothing here recognised or
    // labelled them. See ecosystem-detection.service.ts on the backend.
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
    const q = this.route.snapshot.queryParamMap;
    const repo = q.get('repo') || 'repository';
    this.repo.set(repo);
    this.branch.set(q.get('branch') || 'main');
    this.projectName = q.get('name') || 'app';
    this.cloneUrl = q.get('clone') || '';
    this.provider = q.get('provider') === 'gitlab' ? 'gitlab' : 'github';
    this.lockedWorkspaceUuid.set(q.get('workspace'));
    // Fallback preset from the repo language passed by the list…
    this.presetIndex.set(this.detectPreset(q.get('language') || ''));
    this.api.me().subscribe((m) => this.teamName.set(m.team?.name ?? 'My Team'));
    // …then refine by inspecting the repo's files (package.json / Dockerfile).
    if (repo.includes('/')) {
      this.detecting.set(true);
      const detect$ = this.provider === 'gitlab' ? this.api.gitlabDetect(repo) : this.api.githubDetect(repo);
      detect$.subscribe({
        next: (d) => {
          this.detecting.set(false);
          this.detectedEcosystem.set(d.ecosystem ?? null);
          this.detectedBuildTool.set(d.buildTool ?? null);
          const idx = this.presets.findIndex((p) => p.label === d.preset);
          if (idx >= 0) this.presetIndex.set(idx);
          this.hasDockerfile.set(d.hasDockerfile);
          this.hasDockerCompose.set(d.hasDockerCompose || false);
          // Default to the suggested method; user can switch when a Dockerfile exists.
          this.buildMethod.set(d.buildPack === 'dockerfile' ? 'docker' : 'buildless');
          // Both the keys AND the values the repository's own .env.example
          // (or .sample/.template) already commits — that file is public in
          // the repository regardless of what this form does with it, so
          // pre-filling from it discloses nothing the user couldn't already
          // see, and it's exactly the value most of these keys actually want
          // (APP_ENV=local, LOG_CHANNEL=stack, …). What it doesn't carry —
          // a real secret — the example file left blank in the first place
          // (APP_KEY=, DB_PASSWORD=), which arrives here blank too, ready
          // for the operator to fill in the one that matters.
          // Shown in the clear by default, not masked: these came from a
          // public file in the repository, so hiding them behind a reveal
          // click protects nothing and only adds back the friction detecting
          // them was supposed to remove. Masking stays available per-row for
          // whichever key the operator ends up typing a real secret into.
          if (d.envVars?.length) {
            this.envRows.set(d.envVars.map((v) => ({ key: v.key, value: v.defaultValue, reveal: true })));
          }
          // Port convention + start command for the ecosystem actually
          // detected (Spring Boot → 8080, Flask → 5000, …) instead of the
          // blind 3000 every non-Node deploy silently got before. See
          // ecosystem-detection.service.ts for the per-framework table.
          if (d.suggestedPort !== null && d.suggestedPort !== undefined) {
            this.portsExposes = String(d.suggestedPort);
            this.portAutoDetected.set(true);
          }
          if (d.startCommandHint) {
            this.startCommand = d.startCommandHint;
            this.startCommandAutoDetected.set(true);
          }
          this.ecosystemWarnings.set(d.warnings ?? []);
          // Monorepo: nothing recognisable at the repository root, but
          // exactly one subdirectory had an application in it — the Root
          // Directory field that used to be left blank for the operator to
          // guess at is now pre-filled with where the detector actually
          // found something. Two or more candidates is genuinely ambiguous
          // (which service is "the" one to deploy is not this form's call
          // to make), so those are offered as a pick list instead.
          if (d.rootDirSuggestion) {
            this.rootDir = d.rootDirSuggestion;
            this.rootDirAutoDetected.set(true);
          }
          this.monorepoCandidates.set(d.monorepoCandidates ?? []);
          // Expand "Build and Output Settings" automatically when there is
          // something here worth the operator actually looking at — an
          // auto-filled value or a pre-flight warning left collapsed is the
          // same as not detecting it at all.
          if (d.suggestedPort || d.startCommandHint || (d.warnings ?? []).length > 0) {
            this.showBuild.set(true);
          }
        },
        error: () => {
          /* keep the language-based guess + buildless default */
          this.detecting.set(false);
        },
      });
    }
  }

  /** Best-effort framework preset from the repo's primary language. */
  private detectPreset(language: string): number {
    const l = language.toLowerCase();
    let label = 'Vite';
    if (l === 'python') label = 'Python';
    else if (l === 'dockerfile') label = 'Dockerfile';
    else if (l === 'html' || l === 'css') label = 'Static';
    const idx = this.presets.findIndex((p) => p.label === label);
    return idx >= 0 ? idx : 0;
  }

  protected onStartCommandEdit(value: string): void {
    this.startCommand = value;
    this.startCommandAutoDetected.set(false);
  }

  protected onPortEdit(value: string): void {
    this.portsExposes = value;
    this.portAutoDetected.set(false);
  }

  protected onRootDirEdit(value: string): void {
    this.rootDir = value;
    this.rootDirAutoDetected.set(false);
  }

  protected pickMonorepoCandidate(dir: string): void {
    this.rootDir = dir;
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
    this.envRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, value } : r)));
  }

  protected toggleReveal(index: number): void {
    this.envRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, reveal: !r.reveal } : r)));
  }

  /**
   * Read a picked `.env` file and merge its keys in.
   *
   * Merge, not replace: a file picked after detection already populated some
   * keys is adding to that list, matching what "Import .env" means on the
   * platform this flow is modelled on — it is not a reset button.
   */
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

  /** Set up the local machine as a server, then deploy. */
  protected useLocalServer(): void {
    this.settingUpLocal.set(true);
    this.error.set(null);
    this.api.createLocalServer().subscribe({
      next: (r) => {
        this.settingUpLocal.set(false);
        if (!r.dockerOk) {
          this.error.set(this.translate.instant('projects.import.errLocalDockerUnreachable'));
          return;
        }
        this.executeDeploy();
      },
      error: (e) => {
        this.settingUpLocal.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.import.errLocalSetup'));
      },
    });
  }

  protected executeDeploy(): void {
    const workspaceChoice = this.workspaceChoice();
    if (!this.projectName || !this.cloneUrl || !workspaceChoice) {
      this.error.set(this.translate.instant('projects.import.errMissingRepo'));
      return;
    }
    this.deploying.set(true);
    this.error.set(null);
    // 'nixpacks', not the UI's own 'buildless' label — the backend's
    // BuildPack union has no 'buildless' member, so that string previously
    // reached `toBuildPack()` unrecognised and fell back to 'nixpacks' by
    // implicit default rather than by a mapping that says so.
    const buildPack = this.buildMethod() === 'docker' ? 'dockerfile' : 'nixpacks';
    const environmentVariables = this.envRows()
      .filter((r) => r.key.trim())
      .map((r) => ({ key: r.key.trim(), value: r.value }));
    this.api
      .quickDeploy({
        name: this.projectName.trim(),
        workspace_uuid: workspaceChoice.workspace_uuid,
        workspace_name: workspaceChoice.workspace_name,
        git_repository: this.cloneUrl,
        git_branch: this.branch(),
        build_pack: buildPack,
        base_directory: this.rootDir,
        install_command: this.installCommand || undefined,
        build_command: this.buildCommand || undefined,
        start_command: this.startCommand || undefined,
        ports_exposes: this.portsExposes || undefined,
        environment_variables: environmentVariables.length > 0 ? environmentVariables : undefined,
      })
      .subscribe({
        next: (res) => {
          this.deploying.set(false);
          this.router.navigate(res.deploymentUuid ? ['/deployments', res.deploymentUuid] : ['/services']);
        },
        error: (e) => {
          this.deploying.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
        },
      });
  }
}
