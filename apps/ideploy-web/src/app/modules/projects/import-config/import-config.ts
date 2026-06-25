import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';

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
      <a routerLink="/new-project" class="flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> Back
      </a>
      <span class="text-sm font-semibold">New Project</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-2xl px-6 py-12">
      <div class="box">
        <h1 class="mb-4 text-2xl font-bold">New Project</h1>

        <!-- Imported source -->
        <div class="mb-5 rounded-lg p-4" style="background:var(--color-surface-1);border:1px solid var(--color-surface-2);">
          <div class="text-xs" style="color:var(--color-text-secondary);">Importing from Git</div>
          <div class="mt-1 flex items-center gap-2 text-sm font-semibold">
            <i class="fa-brands fa-github"></i> {{ repo() }}
            <span style="color:var(--color-text-tertiary);"><i class="fa-solid fa-code-branch mx-1"></i>{{ branch() }}</span>
          </div>
        </div>

        <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">Choose where to create the project and give it a name.</p>

        <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm">Team</label>
            <input class="input" [value]="teamName()" disabled />
          </div>
          <div>
            <label class="mb-1 block text-sm">Project Name</label>
            <input class="input" [(ngModel)]="projectName" />
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm">Application Preset</label>
          <select class="input" [ngModel]="presetIndex()" (ngModelChange)="presetIndex.set(+$event)">
            @for (p of presets; track p.label; let i = $index) {
              <option [value]="i">{{ p.label }}</option>
            }
          </select>
          <p class="mt-1 text-xs" style="color:var(--color-text-tertiary);">Auto-detected from the repository — change if needed.</p>
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm">Root Directory</label>
          <input class="input" [(ngModel)]="rootDir" placeholder="./" />
        </div>

        <!-- Collapsibles -->
        <button class="mb-2 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm"
                style="border:1px solid var(--color-surface-2);" (click)="showBuild.set(!showBuild())">
          <i class="fa-solid" [class.fa-chevron-right]="!showBuild()" [class.fa-chevron-down]="showBuild()"></i>
          Build and Output Settings
        </button>
        @if (showBuild()) {
          <div class="mb-2 space-y-2 px-1">
            <input class="input" [(ngModel)]="buildCommand" placeholder="Build command (optional)" />
            <input class="input" [(ngModel)]="startCommand" placeholder="Start command (optional)" />
            <input class="input" [(ngModel)]="portsExposes" placeholder="Exposed port (e.g. 3000)" />
          </div>
        }

        <button class="mb-4 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm"
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
          <p class="mb-3 text-sm text-red-400">{{ error() }}
            @if (error()!.toLowerCase().includes('server')) {
              · <a routerLink="/servers/new" style="color:#60a5fa;">Add a server</a>
            }
          </p>
        }

        <button class="button w-full" [disabled]="deploying() || !projectName" (click)="deploy()">
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
  protected readonly deploying = signal(false);
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
        },
        error: () => {
          /* keep the language-based guess */
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

  protected deploy(): void {
    if (!this.projectName || !this.cloneUrl) {
      this.error.set('Missing repository URL.');
      return;
    }
    this.deploying.set(true);
    this.error.set(null);
    const preset = this.presets[this.presetIndex()];
    this.api
      .quickDeploy({
        name: this.projectName,
        project_name: this.projectName,
        git_repository: this.cloneUrl,
        git_branch: this.branch(),
        build_pack: preset.buildPack,
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
