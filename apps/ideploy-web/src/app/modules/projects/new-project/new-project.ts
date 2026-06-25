import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { ApiService } from '../../../shared/services/api.service';
import { GithubRepo, ServiceTemplate } from '../../../shared/models/ideploy.models';

/**
 * New Project — Vercel-style import flow. Connect GitHub, list the user's repos
 * (via the global Idem API GitHub integration), or clone a one-click template.
 * Importing a repo goes to the import configuration page.
 */
@Component({
  selector: 'app-new-project',
  imports: [FormsModule, RouterLink, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top bar -->
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/dashboard" class="flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> Back
      </a>
      <span class="text-sm font-semibold">New Project</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-5xl px-6 py-12">
      <h1 class="heading-serif mb-8" style="font-size:40px;font-weight:700;color:#fff;">Let's build something new</h1>

      <!-- Git URL prompt -->
      <div class="mb-2 flex items-center gap-3 rounded-xl px-4 py-3" style="background:var(--color-surface-1);border:1px solid var(--color-surface-2);">
        <i class="fa-solid fa-plus" style="color:var(--color-text-secondary);"></i>
        <input class="flex-1 bg-transparent outline-none" placeholder="Enter a Git repository URL…"
               [(ngModel)]="gitUrl" (keyup.enter)="importUrl()" style="color:var(--color-text-primary);" />
        @if (gitUrl) {
          <button class="button" (click)="importUrl()">Continue</button>
        }
      </div>
      <p class="mb-10 text-center text-sm" style="color:var(--color-text-tertiary);">
        Paste a public Git repository URL, pick one of your GitHub repos, or clone a template.
      </p>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <!-- ===== Import Git Repository ===== -->
        <div>
          <h2 class="mb-4 text-xl font-semibold">Import Git Repository</h2>

          @if (githubUser() === undefined) {
            <p class="text-sm" style="color:var(--color-text-secondary);">Checking GitHub connection…</p>
          } @else if (githubUser() === null) {
            <div class="box text-center">
              <i class="fa-brands fa-github mb-3 text-3xl"></i>
              <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
                Connect your GitHub account to import and deploy your repositories.
              </p>
              <button class="button" (click)="connectGithub()">
                <i class="fa-brands fa-github mr-2"></i> Connect GitHub
              </button>
            </div>
          } @else {
            <div class="mb-3 flex items-center gap-2">
              <span class="flex items-center gap-2 rounded-md px-3 py-2 text-sm" style="background:var(--color-surface-1);border:1px solid var(--color-surface-2);">
                <i class="fa-brands fa-github"></i> {{ githubUser() }}
              </span>
              <input class="input flex-1" placeholder="Search…" [ngModel]="repoQuery()" (ngModelChange)="repoQuery.set($event)" />
            </div>
            @if (filteredRepos().length === 0) {
              <div class="box text-sm" style="color:var(--color-text-secondary);">No repositories found.</div>
            } @else {
              <div class="overflow-hidden rounded-xl" style="border:1px solid var(--color-surface-2);">
                @for (repo of filteredRepos(); track repo.fullName) {
                  <div class="flex items-center gap-3 p-3" style="border-bottom:1px solid var(--color-surface-2);">
                    <i class="fa-solid fa-code-branch" style="color:var(--color-text-secondary);"></i>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-semibold">{{ repo.name }}
                        @if (repo.private) { <i class="fa-solid fa-lock ml-1 text-xs" style="color:var(--color-text-tertiary);"></i> }
                      </div>
                      <div class="truncate text-xs" style="color:var(--color-text-tertiary);">{{ repo.updatedAt | slice:0:10 }}</div>
                    </div>
                    <button class="button-secondary" (click)="importRepo(repo)">Import</button>
                  </div>
                }
              </div>
            }
            <button class="mt-3 text-xs" style="color:var(--color-text-tertiary);" (click)="disconnectGithub()">Disconnect GitHub</button>
          }
        </div>

        <!-- ===== Clone Template ===== -->
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold">Clone Template</h2>
            <a routerLink="/templates" class="text-sm" style="color:#60a5fa;">Browse All</a>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            @for (t of templates(); track t.name) {
              <div class="box flex flex-col">
                <div class="mb-1 font-semibold capitalize">{{ t.name }}</div>
                <p class="mb-3 flex-1 text-sm" style="color:var(--color-text-secondary);">{{ t.slogan }}</p>
                <button class="button-secondary w-full" [disabled]="busy()" (click)="cloneTemplate(t)">Deploy</button>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Create Empty Project -->
      <div class="mt-10 flex items-center justify-between border-t pt-6" style="border-color:var(--color-surface-2);">
        <div>
          <div class="font-semibold">Create Empty Project</div>
          <div class="text-sm" style="color:var(--color-text-secondary);">Skip Git and start from scratch.</div>
        </div>
        <button class="button-secondary" (click)="createEmpty()">Create Empty Project</button>
      </div>

      @if (error()) {
        <p class="mt-4 text-sm text-red-400">{{ error() }}</p>
      }
    </div>
  `,
})
export class NewProjectComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly githubUser = signal<string | null | undefined>(undefined);
  protected readonly repos = signal<GithubRepo[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly repoQuery = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected gitUrl = '';

  protected readonly filteredRepos = computed(() => {
    const q = this.repoQuery().trim().toLowerCase();
    return q ? this.repos().filter((r) => r.fullName.toLowerCase().includes(q)) : this.repos();
  });

  ngOnInit(): void {
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t.slice(0, 4)));
    this.api.githubStatus().subscribe({
      next: (user) => {
        this.githubUser.set(user);
        if (user) this.api.githubRepositories().subscribe((r) => this.repos.set(r));
      },
      error: () => this.githubUser.set(null),
    });
  }

  protected connectGithub(): void {
    this.api.githubAuthUrl().subscribe((url) => {
      if (url) window.location.href = url;
    });
  }

  protected disconnectGithub(): void {
    this.api.githubDisconnect().subscribe(() => {
      this.githubUser.set(null);
      this.repos.set([]);
    });
  }

  protected importRepo(repo: GithubRepo): void {
    this.router.navigate(['/new-project/import'], {
      queryParams: {
        repo: repo.fullName,
        clone: repo.cloneUrl,
        branch: repo.defaultBranch || 'main',
        name: repo.name,
        language: repo.language || '',
      },
    });
  }

  protected importUrl(): void {
    if (!this.gitUrl.trim()) return;
    const url = this.gitUrl.trim();
    const name = url.split('/').pop()?.replace(/\.git$/, '') || 'app';
    this.router.navigate(['/new-project/import'], {
      queryParams: { clone: url, repo: name, branch: 'main', name },
    });
  }

  protected cloneTemplate(t: ServiceTemplate): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.quickDeploy({ name: t.name, template: t.name }).subscribe({
      next: () => this.router.navigate(['/services']),
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.error?.message ?? 'Deployment failed');
      },
    });
  }

  protected createEmpty(): void {
    const name = `project-${Date.now().toString(36)}`;
    this.api.createProject({ name }).subscribe({
      next: (p) => this.router.navigate(['/projects', p.uuid]),
      error: (e) => this.error.set(e?.error?.error?.message ?? 'Failed to create project'),
    });
  }
}
