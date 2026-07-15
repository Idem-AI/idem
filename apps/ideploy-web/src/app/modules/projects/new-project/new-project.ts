import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { GithubRepo, ServiceTemplate } from '../../../shared/models/ideploy.models';

/**
 * New Project — Vercel-style import flow. Connect GitHub, list the user's repos
 * (via the global Idem API GitHub integration), or clone a one-click template.
 * Importing a repo goes to the import configuration page.
 */
@Component({
  selector: 'app-new-project',
  imports: [FormsModule, RouterLink, SlicePipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Top bar -->
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/dashboard" class="flex items-center gap-2 text-sm transition-colors hover:text-white" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> {{ 'projects.common.back' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono text-white/90">{{ 'projects.common.newProject' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-5xl px-6 py-12">
      <h1 class="heading-serif mb-8 text-center" style="font-size:40px;font-weight:700;color:#fff;">{{ 'projects.new.heading' | translate }}</h1>

      <!-- Git URL prompt -->
      <div class="mb-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border"
           style="background:rgba(255,255,255,0.02);border-color:rgba(255,255,255,0.08);"
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
          <h2 class="mb-4 text-xl font-semibold font-mono text-white/95">{{ 'projects.new.importGitRepo' | translate }}</h2>

          @if (githubUser() === undefined) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.checkingGithub' | translate }}</p>
          } @else if (githubUser() === null) {
            <div class="db-glass text-center p-8 rounded-2xl">
              <i class="fa-brands fa-github mb-3 text-4xl text-white/80"></i>
              <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">
                {{ 'projects.new.connectGithubDesc' | translate }}
              </p>
              <button class="button cursor-pointer" (click)="connectGithub()">
                <i class="fa-brands fa-github mr-2"></i> {{ 'projects.new.connectGithub' | translate }}
              </button>
            </div>
          } @else {
            <div class="mb-4 flex items-center gap-3">
              <span class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono border" style="background:rgba(255,255,255,0.02);border-color:rgba(255,255,255,0.08);color:var(--color-text-secondary);">
                <i class="fa-brands fa-github text-white/80"></i> {{ githubUser() }}
              </span>
              <div class="relative flex-1">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px]" style="color:#8d919a;"></i>
                <input class="input font-mono text-xs" style="padding-left:30px;height:36px;" [placeholder]="'projects.new.searchReposPlaceholder' | translate" [attr.aria-label]="'projects.new.searchReposLabel' | translate" [ngModel]="repoQuery()" (ngModelChange)="repoQuery.set($event)" />
              </div>
            </div>
            @if (filteredRepos().length === 0) {
              <div class="db-glass p-8 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'projects.new.noRepos' | translate }}</div>
            } @else {
              <div class="overflow-y-auto rounded-xl db-glass p-0" style="max-height: 400px;">
                @for (repo of filteredRepos(); track repo.fullName) {
                  <div class="flex items-center gap-4 p-3.5 hover:bg-white/[0.02] transition-colors duration-150" style="border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <i class="fa-solid fa-code-branch"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-semibold text-white/90 font-mono">{{ repo.name }}
                        @if (repo.private) { <i class="fa-solid fa-lock ml-1.5 text-[10px]" style="color:var(--color-text-tertiary);" [title]="'projects.new.privateRepo' | translate"></i> }
                      </div>
                      <div class="truncate text-[10px] font-mono mt-0.5" style="color:var(--color-text-tertiary);">{{ 'projects.new.updated' | translate }} {{ repo.updatedAt | slice:0:10 }}</div>
                    </div>
                    <button class="button-secondary cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors" (click)="importRepo(repo)">{{ 'projects.new.import' | translate }}</button>
                  </div>
                }
              </div>
            }
            <button class="mt-3 text-xs hover:text-white transition-colors cursor-pointer" style="color:var(--color-text-tertiary);" (click)="disconnectGithub()">{{ 'projects.new.disconnectGithub' | translate }}</button>
          }
        </div>

        <!-- ===== Clone Template ===== -->
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold font-mono text-white/95">{{ 'projects.new.cloneTemplate' | translate }}</h2>
            <a routerLink="/templates" class="text-sm font-semibold hover:underline" style="color:#60a5fa;">{{ 'projects.new.browseAll' | translate }}</a>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            @for (t of templates(); track t.name) {
              <div class="db-glass flex flex-col hover:border-blue-500/50 hover:bg-white/[0.01] transition-all duration-200 p-5 rounded-2xl group">
                <div class="flex items-center gap-3 mb-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 group-hover:bg-blue-500/10 transition-colors duration-200">
                    <i [class]="getTemplateIcon(t.name)" class="text-lg"></i>
                  </div>
                  <div class="font-semibold capitalize font-mono text-white/90 group-hover:text-blue-400 transition-colors">{{ t.name }}</div>
                </div>
                <p class="mb-4 flex-1 text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ t.slogan || ('projects.new.oneClickBoilerplate' | translate) }}</p>
                <button class="button-secondary w-full cursor-pointer hover:bg-blue-500 hover:text-white transition-all text-xs font-semibold py-1.5 rounded-lg border border-transparent hover:border-blue-600/30" [disabled]="busy()" (click)="cloneTemplate(t)">{{ 'projects.common.deploy' | translate }}</button>
              </div>
            }
          </div>
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

      @if (error()) {
        <p class="mt-4 text-sm text-red-400 bg-red-500/5 border border-red-500/20 p-3 rounded-lg">{{ error() }}</p>
      }
    </div>
  `,
})
export class NewProjectComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

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
    this.error.set(null);
    this.api.githubAuthUrl().subscribe({
      next: (url) => {
        // Guard: the global API returns client_id='' when GitHub OAuth isn't
        // configured → GitHub would 404. Surface a clear message instead.
        if (!url || /[?&]client_id=(&|$)/.test(url)) {
          this.error.set(this.translate.instant('projects.new.errGithubNotConfigured'));
          return;
        }
        window.location.href = url;
      },
      error: () =>
        this.error.set(this.translate.instant('projects.new.errGithubUnreachable')),
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
        this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
      },
    });
  }

  protected createEmpty(): void {
    const name = `project-${Date.now().toString(36)}`;
    this.api.createProject({ name }).subscribe({
      next: (p) => this.router.navigate(['/projects', p.uuid]),
      error: (e) => this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.errCreateProject')),
    });
  }
}
