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
 * Import configuration — Vercel-style "New Project" step 2. Shows the imported
 * repo, lets the user name the project, auto-detects the framework preset
 * (editable), and deploys via /quick-deploy.
 */
@Component({
  selector: 'app-import-config',
  imports: [FormsModule, RouterLink, TranslateModule, WorkspaceChoicePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/new-project" class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="pi pi-arrow-left"></i> {{ 'projects.common.back' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono">{{ 'projects.common.newProject' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-2xl px-6 py-12">
      <div class="glass-card">
        <h1 class="mb-4 text-2xl font-bold font-mono text-text-primary">{{ 'projects.common.newProject' | translate }}</h1>

        <!-- Imported source -->
        <div class="mb-6 rounded-xl p-4 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
          <div class="text-xs font-semibold uppercase" style="color:var(--color-text-tertiary);">{{ 'projects.import.importingFromGit' | translate }}</div>
          <div class="mt-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <i class="pi pi-github text-lg"></i> {{ repo() }}
            <span class="font-mono text-xs px-2 py-0.5 rounded" style="background:var(--color-surface-2);color:var(--color-text-secondary);"><i class="pi pi-sitemap mr-1"></i>{{ branch() }}</span>
          </div>
        </div>

        <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">{{ 'projects.import.configureDeploy' | translate }}</p>

        <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-semibold text-text-primary" for="teamName">{{ 'projects.import.team' | translate }}</label>
            <input type="text" id="teamName" name="teamName" class="bg-opacity-50 cursor-not-allowed" [value]="teamName()" disabled />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-text-primary" for="projectName">{{ 'projects.import.applicationName' | translate }}</label>
            <input type="text" id="projectName" name="projectName"  [(ngModel)]="projectName" autocomplete="off" />
          </div>
        </div>

        <!-- Where this lands matters more than the build details below it —
             asked right after naming the application, not buried under them. -->
        <div class="mb-5 rounded-xl p-4 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
          <app-workspace-choice-picker
            [suggestedName]="projectName"
            [lockedWorkspaceUuid]="lockedWorkspaceUuid()"
            (choiceChange)="workspaceChoice.set($event)"
          />
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm font-semibold text-text-primary" for="appPreset">{{ 'projects.import.appPreset' | translate }}</label>

          <!--
            "Detected configuration" summary — what ecosystem-detection.service.ts
            actually found in the repository, shown before the override dropdown
            rather than only inside it, the same way Vercel leads with what it
            read instead of an empty form. Kept in sync with the dropdown below:
            the icon/label follow presetIndex() so overriding the preset updates
            this card too, while the ecosystem/build-tool line stays what was
            genuinely detected (there's nothing to override it with).
          -->
          @if (detecting()) {
            <div class="mb-2 flex items-center gap-2 rounded-xl p-3 border text-sm" style="background:var(--color-surface-1);border-color:var(--color-surface-2);color:var(--color-text-secondary);">
              <i class="pi pi-spinner pi-spin"></i> {{ 'projects.import.detecting' | translate }}
            </div>
          } @else if (ecosystemLabel()) {
            <div class="mb-2 flex items-center gap-3 rounded-xl p-3 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                <i [class]="presets[presetIndex()].icon" class="text-base" style="color:var(--color-text-secondary);"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-text-primary">{{ presets[presetIndex()].label }}</div>
                <div class="text-xs" style="color:var(--color-text-tertiary);">{{ ecosystemLabel() }}</div>
              </div>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style="background:rgba(34,197,94,0.15);color:#4ade80;">
                <i class="pi pi-check mr-1"></i>{{ 'projects.import.autoDetectedBadge' | translate }}
              </span>
            </div>
          }

          <select id="appPreset" name="appPreset" class="cursor-pointer" [ngModel]="presetIndex()" (ngModelChange)="presetIndex.set(+$event)">
            @for (p of presets; track p.label; let i = $index) {
              <option [value]="i">{{ p.label }}</option>
            }
          </select>
          <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.import.autoDetected' | translate }}</p>
        </div>

        <!-- Build method -->
        <div class="mb-4">
          <span class="mb-1.5 block text-sm font-semibold text-text-primary">{{ 'projects.import.buildMethod' | translate }}</span>
          @if (hasDockerfile()) {
            <div class="space-y-2 rounded-xl p-3 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
              <label class="flex items-center gap-2 text-sm cursor-pointer text-text-primary hover:text-text-primary">
                <input type="radio" name="buildMethod" class="cursor-pointer" [checked]="buildMethod() === 'docker'" (change)="buildMethod.set('docker')" />
                <span><i class="pi pi-box mr-1 text-primary-400"></i> {{ 'projects.import.useDocker' | translate }}</span>
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer text-text-primary hover:text-text-primary">
                <input type="radio" name="buildMethod" class="cursor-pointer" [checked]="buildMethod() === 'buildless'" (change)="buildMethod.set('buildless')" />
                <span><i class="pi pi-code mr-1 text-green-400"></i> {{ 'projects.import.withoutDocker' | translate }}</span>
              </label>
            </div>
            <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.import.dockerfileDetected' | translate }}</p>
          } @else {
            <div class="rounded-xl p-3 text-sm border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);color:var(--color-text-secondary);">
              <i class="pi pi-code mr-1 text-green-400"></i> {{ 'projects.import.noDockerfilePart1' | translate }}
              <strong>{{ 'projects.import.withoutDockerStrong' | translate }}</strong> {{ 'projects.import.noDockerfilePart2' | translate }}
            </div>
          }
        </div>

        <!--
          Pre-flight findings from ecosystem detection (see
          ecosystem-detection.service.ts) — shown here, not buried in a
          deploy log, because a 'blocking' one (e.g. an unsupported Gradle
          version) means the build engine will refuse this repo exactly as
          configured, and finding that out after a full build cycle is the
          failure mode this exists to prevent.
        -->
        @if (ecosystemWarnings().length > 0) {
          <div class="mb-4 space-y-2">
            @for (w of ecosystemWarnings(); track w.code) {
              <div
                class="rounded-xl p-3 text-sm border"
                [style.background]="w.severity === 'blocking' ? 'rgba(239,68,68,0.08)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)'"
                [style.border-color]="w.severity === 'blocking' ? 'rgba(239,68,68,0.3)' : 'color-mix(in srgb, var(--color-warning) 40%, transparent)'"
              >
                <i
                  class="pi pi-exclamation-triangle mr-1.5"
                  [style.color]="w.severity === 'blocking' ? '#f87171' : 'var(--color-warning)'"
                ></i>
                <span [style.color]="w.severity === 'blocking' ? '#f87171' : 'var(--color-warning)'">{{ w.message }}</span>
              </div>
            }
          </div>
        }

        <div class="mb-5">
          <label class="mb-1 block text-sm font-semibold text-text-primary" for="rootDir">{{ 'projects.import.rootDirectory' | translate }}</label>
          <input type="text" id="rootDir" name="rootDir" class="font-mono" [ngModel]="rootDir" (ngModelChange)="onRootDirEdit($event)" placeholder="./" autocomplete="off" />
          @if (rootDirAutoDetected()) {
            <p class="mt-1 text-xs" style="color:#4ade80;"><i class="pi pi-check mr-1"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
          } @else {
            <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">{{ 'projects.import.rootDirHint' | translate }}</p>
          }

          <!--
            Monorepo, ambiguous: 2+ plausible application roots, none pickable
            automatically (see findManifestDirectories's doc comment on the
            backend for why this form doesn't guess). Shown as an explicit
            choice instead of leaving the field blank with no hint that a
            choice was even needed.
          -->
          @if (monorepoCandidates().length > 0) {
            <div class="mt-2 rounded-xl border p-3" style="background:color-mix(in srgb, var(--color-warning) 8%, transparent);border-color:color-mix(in srgb, var(--color-warning) 30%, transparent);">
              <p class="mb-2 text-xs font-semibold" style="color:var(--color-warning);">
                <i class="pi pi-sitemap mr-1"></i>{{ 'projects.import.monorepoFound' | translate: { count: monorepoCandidates().length } }}
              </p>
              <div class="flex flex-wrap gap-2">
                @for (c of monorepoCandidates(); track c.dir) {
                  <button type="button" class="outer-button cursor-pointer text-xs px-2.5 py-1.5 font-mono" (click)="pickMonorepoCandidate(c.dir)">
                    {{ c.dir }}
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <!-- Collapsibles -->
        <button class="mb-3 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm font-semibold cursor-pointer hover:bg-[var(--glass-bg-subtle)] transition-colors"
                style="border:1px solid var(--color-surface-2);" (click)="showBuild.set(!showBuild())">
          <i class="pi" [class.pi-chevron-right]="!showBuild()" [class.pi-chevron-down]="showBuild()"></i>
          {{ 'projects.import.buildOutputSettings' | translate }}
        </button>
        @if (showBuild()) {
          <div class="mb-3 space-y-3 px-1">
            <input type="text" class="font-mono" [(ngModel)]="installCommand" [placeholder]="'projects.import.installCommandPlaceholder' | translate" [attr.aria-label]="'projects.import.installCommandLabel' | translate" autocomplete="off" />
            <input type="text" class="font-mono" [(ngModel)]="buildCommand" [placeholder]="'projects.import.buildCommandPlaceholder' | translate" [attr.aria-label]="'projects.import.buildCommandLabel' | translate" autocomplete="off" />
            <div>
              <input type="text" class="font-mono" [ngModel]="startCommand" (ngModelChange)="onStartCommandEdit($event)" [placeholder]="'projects.import.startCommandPlaceholder' | translate" [attr.aria-label]="'projects.import.startCommandLabel' | translate" autocomplete="off" />
              @if (startCommandAutoDetected()) {
                <p class="mt-1 text-xs" style="color:#4ade80;"><i class="pi pi-check mr-1"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
              }
            </div>
            <div>
              <input type="text" class="font-mono" [ngModel]="portsExposes" (ngModelChange)="onPortEdit($event)" [placeholder]="'projects.import.portPlaceholder' | translate" [attr.aria-label]="'projects.import.portLabel' | translate" autocomplete="off" />
              @if (portAutoDetected()) {
                <p class="mt-1 text-xs" style="color:#4ade80;"><i class="pi pi-check mr-1"></i>{{ 'projects.import.detectedFromRepo' | translate }}</p>
              }
            </div>
          </div>
        }

        <!--
          Environment variables — the repository's own .env.example (or
          .sample/.template) already names what a build like this one needs,
          and usually commits a usable value for most of them; asking the
          operator to read the source and retype both by hand is exactly the
          friction Vercel's own import flow removes. See the ngOnInit
          detect() subscription for why pre-filling from that file discloses
          nothing the repository doesn't already show.
        -->
        <button class="mb-3 flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left text-sm font-semibold cursor-pointer hover:bg-[var(--glass-bg-subtle)] transition-colors"
                style="border:1px solid var(--color-surface-2);" (click)="showEnv.set(!showEnv())">
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
          <div class="mb-5 px-1">
            <p class="mb-3 text-xs" style="color:var(--color-text-tertiary);">
              {{ 'projects.import.envHint' | translate }}
            </p>

            @if (envRows().length > 0) {
              <div class="mb-3 space-y-2">
                @for (row of envRows(); track $index; let i = $index) {
                  <div class="flex items-center gap-2">
                    <input type="text"
                      class="font-mono flex-1 !w-auto min-w-0"
                      style="min-width:0;"
                      [value]="row.key"
                      (input)="updateEnvKey(i, $any($event.target).value)"
                      [placeholder]="'projects.import.envKeyPlaceholder' | translate"
                      [attr.aria-label]="'projects.import.envKeyLabel' | translate"
                      autocomplete="off"
                    />
                    <div class="relative flex-1" style="min-width:0;">
                      <input type="text"
                        class="font-mono !w-full pr-9"
                        [attr.type]="row.reveal ? 'text' : 'password'"
                        [value]="row.value"
                        (input)="updateEnvValue(i, $any($event.target).value)"
                        [placeholder]="'projects.import.envValuePlaceholder' | translate"
                        [attr.aria-label]="'projects.import.envValueLabel' | translate"
                        autocomplete="off"
                      />
                      <button
                        type="button"
                        class="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
                        style="color:var(--color-text-tertiary);"
                        [attr.aria-label]="(row.reveal ? 'projects.import.hideValue' : 'projects.import.revealValue') | translate"
                        (click)="toggleReveal(i)"
                      >
                        <i class="pi text-xs" [class.pi-eye]="!row.reveal" [class.pi-eye-slash]="row.reveal"></i>
                      </button>
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer px-2 py-2 text-sm"
                      style="color:var(--color-text-tertiary);"
                      [attr.aria-label]="'projects.import.removeVariable' | translate"
                      (click)="removeEnvRow(i)"
                    >
                      <i class="pi pi-minus"></i>
                    </button>
                  </div>
                }
              </div>
            }

            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="outer-button cursor-pointer text-xs px-3 py-1.5" (click)="addEnvRow()">
                <i class="pi pi-plus mr-1"></i>{{ 'projects.import.addVariable' | translate }}
              </button>
              <button type="button" class="text-xs font-semibold hover:underline cursor-pointer" style="color:#60a5fa;" (click)="envFileInput.click()">
                <i class="pi pi-file-import mr-1"></i>{{ 'projects.import.importEnvFile' | translate }}
              </button>
              <input #envFileInput type="file" accept=".env,text/plain" class="hidden" (change)="onImportEnvFile($event)" />
            </div>
            @if (envImportError()) {
              <p class="mt-2 text-xs" style="color:var(--color-danger);">{{ envImportError() }}</p>
            }
          </div>
        }

        @if (error()) {
          <div class="mb-4 rounded-xl p-4 text-sm" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);">
            <p class="text-red-400 font-semibold mb-2"><i class="pi pi-exclamation-triangle mr-1"></i> {{ error() }}</p>
            @if (error()!.toLowerCase().includes('server') || error()!.toLowerCase().includes('destination')) {
              <div class="flex items-center gap-3">
                @if (!isProd) {
                  <button class="inner-button cursor-pointer" [disabled]="settingUpLocal()" (click)="useLocalServer()">
                    {{ (settingUpLocal() ? 'projects.import.settingUp' : 'projects.import.useLocalMachine') | translate }}
                  </button>
                }
                <a routerLink="/servers/new" class="text-xs font-semibold hover:underline" style="color:#60a5fa;">{{ 'projects.import.addServer' | translate }}</a>
              </div>
              @if (!isProd) {
                <p class="mt-2 text-xs" style="color:var(--color-text-tertiary);">
                  {{ 'projects.import.localDockerHint' | translate }}
                </p>
              }
            }
          </div>
        }

        <button class="inner-button w-full cursor-pointer py-2.5 text-base" [disabled]="deploying() || !projectName || !workspaceChoice()" (click)="deploy()">
          {{ (deploying() ? 'projects.import.deploying' : 'projects.common.deploy') | translate }}
        </button>
      </div>
    </div>

    @if (showDockerModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="glass-card max-w-md w-full p-6 rounded-2xl shadow-2xl border border-[var(--glass-border)]" style="background-color: #0b0f19;">
          <div class="flex items-center gap-3 mb-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-primary-400">
              <i class="pi pi-box text-lg"></i>
            </div>
            <h2 class="text-xl font-bold font-mono text-text-primary">{{ 'projects.import.dockerDetectedTitle' | translate }}</h2>
          </div>

          <p class="text-sm mb-6" style="color:var(--color-text-secondary);">
            {{ 'projects.import.dockerModalDesc' | translate }}
          </p>

          <div class="space-y-3 mb-6">
            <label class="flex items-center gap-3 p-3 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-subtle)] cursor-pointer transition-colors group">
              <input type="radio" name="modalBuildMethod" [checked]="modalBuildMethod() === 'docker'" (change)="modalBuildMethod.set('docker')" class="cursor-pointer" />
              <div>
                <div class="text-sm font-semibold text-text-primary group-hover:text-primary-400 transition-colors">{{ 'projects.import.deployWithDocker' | translate }}</div>
                <div class="text-xs text-text-tertiary mt-0.5">{{ 'projects.import.deployWithDockerDesc' | translate }}</div>
              </div>
            </label>
            <label class="flex items-center gap-3 p-3 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-subtle)] cursor-pointer transition-colors group">
              <input type="radio" name="modalBuildMethod" [checked]="modalBuildMethod() === 'buildless'" (change)="modalBuildMethod.set('buildless')" class="cursor-pointer" />
              <div>
                <div class="text-sm font-semibold text-text-primary group-hover:text-primary-400 transition-colors">{{ 'projects.import.deployWithoutDocker' | translate }}</div>
                <div class="text-xs text-text-tertiary mt-0.5">{{ 'projects.import.deployWithoutDockerDesc' | translate }}</div>
              </div>
            </label>
          </div>

          <div class="flex gap-3 justify-end">
            <button class="outer-button cursor-pointer text-xs px-4 py-2" (click)="showDockerModal.set(false)">{{ 'projects.common.cancel' | translate }}</button>
            <button class="inner-button cursor-pointer text-xs px-4 py-2" (click)="confirmDockerDeploy()">{{ 'projects.import.confirmDeploy' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ImportConfigComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly repo = signal('');
  protected readonly branch = signal('main');
  protected readonly teamName = signal('My Team');
  protected readonly presetIndex = signal(0);
  protected readonly isProd = environment.production;
  protected readonly hasDockerfile = signal(false);
  protected readonly hasDockerCompose = signal(false);
  protected readonly showDockerModal = signal(false);
  protected readonly modalBuildMethod = signal<'docker' | 'buildless'>('buildless');
  protected readonly buildMethod = signal<'docker' | 'buildless'>('buildless');
  /** Where this lands — an existing workspace, or a new one. Never implicit. */
  protected readonly workspaceChoice = signal<WorkspaceChoice | null>(null);
  /** Set when arriving from a specific workspace's "+ Nouvelle ressource" link. */
  protected readonly lockedWorkspaceUuid = signal<string | null>(null);
  protected readonly deploying = signal(false);
  protected readonly settingUpLocal = signal(false);
  protected readonly error = signal<string | null>(null);
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
  private provider: 'github' | 'gitlab' = 'github';

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
        this.deploy();
      },
      error: (e) => {
        this.settingUpLocal.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.import.errLocalSetup'));
      },
    });
  }

  protected deploy(): void {
    if (this.hasDockerfile() || this.hasDockerCompose()) {
      this.modalBuildMethod.set(this.buildMethod());
      this.showDockerModal.set(true);
    } else {
      this.executeDeploy();
    }
  }

  protected confirmDockerDeploy(): void {
    this.buildMethod.set(this.modalBuildMethod());
    this.showDockerModal.set(false);
    this.executeDeploy();
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
        name: this.projectName,
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
