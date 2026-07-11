import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { environment } from '../../../../environments/environment';

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
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/new-project" class="flex items-center gap-2 text-sm transition-colors hover:text-white" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> Back
      </a>
      <span class="text-sm font-semibold font-mono">New Project</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-2xl px-6 py-12">
      <div class="db-glass">
        <h1 class="mb-4 text-2xl font-bold font-mono text-white/95">New Project</h1>

        <!-- Imported source -->
        <div class="mb-6 rounded-xl p-4 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
          <div class="text-xs font-semibold uppercase tracking-wider" style="color:var(--color-text-tertiary);">Importing from Git</div>
          <div class="mt-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <i class="fa-brands fa-github text-lg"></i> {{ repo() }}
            <span class="font-mono text-xs px-2 py-0.5 rounded" style="background:var(--color-surface-2);color:var(--color-text-secondary);"><i class="fa-solid fa-code-branch mr-1"></i>{{ branch() }}</span>
          </div>
        </div>

        <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">Configure your project parameters and deploy.</p>

        <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-semibold text-white/80" for="teamName">Team</label>
            <input id="teamName" name="teamName" class="input bg-opacity-50 cursor-not-allowed" [value]="teamName()" disabled />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-white/80" for="projectName">Project Name</label>
            <input id="projectName" name="projectName" class="input" [(ngModel)]="projectName" autocomplete="off" />
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm font-semibold text-white/80" for="appPreset">Application Preset</label>
          <select id="appPreset" name="appPreset" class="input cursor-pointer" [ngModel]="presetIndex()" (ngModelChange)="presetIndex.set(+$event)">
            @for (p of presets; track p.label; let i = $index) {
              <option [value]="i">{{ p.label }}</option>
            }
          </select>
          <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">Auto-detected from the repository — change if needed.</p>
        </div>

        <!-- Build method -->
        <div class="mb-4">
          <span class="mb-1.5 block text-sm font-semibold text-white/80">Build method</span>
          @if (hasDockerfile()) {
            <div class="space-y-2 rounded-xl p-3 border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);">
              <label class="flex items-center gap-2 text-sm cursor-pointer text-white/80 hover:text-white">
                <input type="radio" name="buildMethod" class="cursor-pointer" [checked]="buildMethod() === 'docker'" (change)="buildMethod.set('docker')" />
                <span><i class="fa-brands fa-docker mr-1 text-blue-400"></i> Use Docker — build the repo's Dockerfile</span>
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer text-white/80 hover:text-white">
                <input type="radio" name="buildMethod" class="cursor-pointer" [checked]="buildMethod() === 'buildless'" (change)="buildMethod.set('buildless')" />
                <span><i class="fa-brands fa-node-js mr-1 text-green-400"></i> Without Docker — run the app directly (no containerization)</span>
              </label>
            </div>
            <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">A Dockerfile was detected — choose how to deploy.</p>
          } @else {
            <div class="rounded-xl p-3 text-sm border" style="background:var(--color-surface-1);border-color:var(--color-surface-2);color:var(--color-text-secondary);">
              <i class="fa-brands fa-node-js mr-1 text-green-400"></i> No Dockerfile detected — the app will be deployed
              <strong>without Docker</strong> (run directly in a base Node runtime).
            </div>
          }
        </div>

        <div class="mb-5">
          <label class="mb-1 block text-sm font-semibold text-white/80" for="rootDir">Root Directory</label>
          <input id="rootDir" name="rootDir" class="input font-mono" [(ngModel)]="rootDir" placeholder="./" autocomplete="off" />
          <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">The directory where your package.json / build settings are located.</p>
        </div>

        <!-- Collapsibles -->
        <button class="mb-3 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm font-semibold cursor-pointer hover:bg-white/[0.02] transition-colors"
                style="border:1px solid var(--color-surface-2);" (click)="showBuild.set(!showBuild())">
          <i class="fa-solid" [class.fa-chevron-right]="!showBuild()" [class.fa-chevron-down]="showBuild()"></i>
          Build and Output Settings
        </button>
        @if (showBuild()) {
          <div class="mb-3 space-y-3 px-1">
            <input class="input font-mono" [(ngModel)]="buildCommand" placeholder="Build command (optional, e.g. npm run build)" aria-label="Build command" autocomplete="off" />
            <input class="input font-mono" [(ngModel)]="startCommand" placeholder="Start command (optional, e.g. npm run start)" aria-label="Start command" autocomplete="off" />
            <input class="input font-mono" [(ngModel)]="portsExposes" placeholder="Exposed port (e.g. 3000)" aria-label="Exposed port" autocomplete="off" />
          </div>
        }

        <button class="mb-5 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm font-semibold cursor-pointer hover:bg-white/[0.02] transition-colors"
                style="border:1px solid var(--color-surface-2);" (click)="showEnv.set(!showEnv())">
          <i class="fa-solid" [class.fa-chevron-right]="!showEnv()" [class.fa-chevron-down]="showEnv()"></i>
          Environment Variables
        </button>
        @if (showEnv()) {
          <p class="mb-4 px-1 text-xs" style="color:var(--color-text-tertiary);">
            You can add environment variables after the first deploy, from the application's Environment tab.
          </p>
        }

        @if (error()) {
          <div class="mb-4 rounded-xl p-4 text-sm" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);">
            <p class="text-red-400 font-semibold mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i> {{ error() }}</p>
            @if (error()!.toLowerCase().includes('server') || error()!.toLowerCase().includes('destination')) {
              <div class="flex items-center gap-3">
                @if (!isProd) {
                  <button class="button cursor-pointer" [disabled]="settingUpLocal()" (click)="useLocalServer()">
                    {{ settingUpLocal() ? 'Setting up…' : 'Use this machine (local Docker)' }}
                  </button>
                }
                <a routerLink="/servers/new" class="text-xs font-semibold hover:underline" style="color:#60a5fa;">Add a server</a>
              </div>
              @if (!isProd) {
                <p class="mt-2 text-xs" style="color:var(--color-text-tertiary);">
                  Runs the deployment on your local Docker — perfect for testing.
                </p>
              }
            }
          </div>
        }

        <button class="button w-full cursor-pointer py-2.5 text-base" [disabled]="deploying() || !projectName" (click)="deploy()">
          {{ deploying() ? 'Deploying…' : 'Deploy' }}
        </button>
      </div>
    </div>
  `,
})
export class ImportConfigComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly repo = signal('');
  protected readonly branch = signal('main');
  protected readonly teamName = signal('My Team');
  protected readonly presetIndex = signal(0);
  protected readonly isProd = environment.production;
  protected readonly hasDockerfile = signal(false);
  protected readonly buildMethod = signal<'docker' | 'buildless'>('buildless');
  protected readonly deploying = signal(false);
  protected readonly settingUpLocal = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showBuild = signal(false);
  protected readonly showEnv = signal(false);

  protected projectName = '';
  protected rootDir = './';
  protected buildCommand = '';
  protected startCommand = '';
  protected portsExposes = '';
  private cloneUrl = '';

  protected readonly presets: Preset[] = [
    { label: 'Vite', icon: 'fa-solid fa-bolt', buildPack: 'nixpacks' },
    { label: 'Next.js', icon: 'fa-solid fa-n', buildPack: 'nixpacks' },
    { label: 'Node.js', icon: 'fa-brands fa-node-js', buildPack: 'nixpacks' },
    { label: 'Angular', icon: 'fa-brands fa-angular', buildPack: 'nixpacks' },
    { label: 'Static', icon: 'fa-solid fa-file-code', buildPack: 'static' },
    { label: 'Python', icon: 'fa-brands fa-python', buildPack: 'nixpacks' },
    { label: 'Dockerfile', icon: 'fa-brands fa-docker', buildPack: 'dockerfile' },
    { label: 'Other', icon: 'fa-solid fa-cube', buildPack: 'nixpacks' },
  ];

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const repo = q.get('repo') || 'repository';
    this.repo.set(repo);
    this.branch.set(q.get('branch') || 'main');
    this.projectName = q.get('name') || 'app';
    this.cloneUrl = q.get('clone') || '';
    // Fallback preset from the repo language passed by the list…
    this.presetIndex.set(this.detectPreset(q.get('language') || ''));
    this.api.me().subscribe((m) => this.teamName.set(m.team?.name ?? 'My Team'));
    // …then refine by inspecting the repo's files (package.json / Dockerfile).
    if (repo.includes('/')) {
      this.api.githubDetect(repo).subscribe({
        next: (d) => {
          const idx = this.presets.findIndex((p) => p.label === d.preset);
          if (idx >= 0) this.presetIndex.set(idx);
          this.hasDockerfile.set(d.hasDockerfile);
          // Default to the suggested method; user can switch when a Dockerfile exists.
          this.buildMethod.set(d.buildPack === 'dockerfile' ? 'docker' : 'buildless');
        },
        error: () => {
          /* keep the language-based guess + buildless default */
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

  /** Set up the local machine as a server, then deploy. */
  protected useLocalServer(): void {
    this.settingUpLocal.set(true);
    this.error.set(null);
    this.api.createLocalServer().subscribe({
      next: (r) => {
        this.settingUpLocal.set(false);
        if (!r.dockerOk) {
          this.error.set('Local server created, but Docker is not reachable. Is Docker Desktop running?');
          return;
        }
        this.deploy();
      },
      error: (e) => {
        this.settingUpLocal.set(false);
        this.error.set(e?.error?.error?.message ?? 'Failed to set up local server');
      },
    });
  }

  protected deploy(): void {
    if (!this.projectName || !this.cloneUrl) {
      this.error.set('Missing repository URL.');
      return;
    }
    this.deploying.set(true);
    this.error.set(null);
    // Build method drives containerization: 'dockerfile' (Docker build) vs
    // 'buildless' (run directly, no Dockerfile needed).
    const buildPack = this.buildMethod() === 'docker' ? 'dockerfile' : 'buildless';
    this.api
      .quickDeploy({
        name: this.projectName,
        project_name: this.projectName,
        git_repository: this.cloneUrl,
        git_branch: this.branch(),
        build_pack: buildPack,
        base_directory: this.rootDir,
        build_command: this.buildCommand || undefined,
        start_command: this.startCommand || undefined,
        ports_exposes: this.portsExposes || undefined,
      })
      .subscribe({
        next: (res) => {
          this.deploying.set(false);
          this.router.navigate(res.deploymentUuid ? ['/deployments', res.deploymentUuid] : ['/services']);
        },
        error: (e) => {
          this.deploying.set(false);
          this.error.set(e?.error?.error?.message ?? 'Deployment failed');
        },
      });
  }
}
