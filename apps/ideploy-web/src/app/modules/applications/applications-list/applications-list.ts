import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { Application } from '../../../shared/models/ideploy.models';
import { appStatusDisplay } from '../../../shared/utils/app-status.util';
import { techIcon } from '../../../shared/utils/tech-icon.util';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

/**
 * Every application, one row each: what it is, whether it's up, where its
 * code comes from, and the two things you do from a list — open the site,
 * ship again. Creating one goes through `/new-project`, the one flow that
 * asks where it should run; a second, thinner form here used to skip that.
 */
@Component({
  selector: 'app-applications-list',
  imports: [RouterLink, FormsModule, TranslateModule, IdemLoaderComponent, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="'applications.list.title' | translate"
      [subtitle]="'applications.list.subtitle' | translate"
      [count]="loading() ? null : applications().length"
    >
      @if (!loading() && applications().length > 0) {
        <a class="inner-button" routerLink="/new-project"><i class="pi pi-plus mr-2 text-xs"></i>{{ 'applications.list.newApplication' | translate }}</a>
      }
    </app-page-header>

    @if (cleanupFailed) {
      <p class="mb-6 rounded-xl border p-4 text-sm" role="alert" style="color:var(--color-warning);border-color:color-mix(in srgb, var(--color-warning) 35%, transparent);background:color-mix(in srgb, var(--color-warning) 8%, transparent);">
        <i class="pi pi-exclamation-triangle mr-2"></i>{{ 'applications.list.cleanupFailed' | translate }}
      </p>
    }

    @if (loading()) {
      <app-list-skeleton />
    } @else if (applications().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="activity" [title]="'applications.list.empty' | translate" [body]="'applications.list.emptyHint' | translate">
          <a class="inner-button mt-5" routerLink="/new-project">{{ 'applications.list.newApplication' | translate }}</a>
        </app-empty-state>
      </div>
    } @else {
      @if (applications().length > 5) {
        <div class="relative mb-4">
          <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs" style="color:var(--color-text-tertiary);"></i>
          <input type="text" style="padding-left:36px;" [placeholder]="'applications.list.searchPlaceholder' | translate" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </div>
      }

      @if (filtered().length === 0) {
        <div class="glass-card"><app-empty-state kind="search" [title]="'applications.list.noMatch' | translate" /></div>
      } @else {
        <div class="glass-card overflow-hidden">
          @for (app of filtered(); track app.uuid; let last = $last) {
            <!-- The name's link is stretched over the whole row (after:inset-0), so the row opens the application
                 while staying a real link — middle-click, Ctrl+click and keyboard focus all work. Buttons sit above it. -->
            <div class="group relative flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition-smooth hover:bg-[var(--glass-bg-subtle)] focus-within:bg-[var(--glass-bg-subtle)]" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
              <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
                <i [class]="stack(app).icon" [style.color]="stack(app).color"></i>
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a class="truncate font-semibold text-text-primary outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--color-primary-500)] focus-visible:underline" [routerLink]="['/applications', app.uuid]">{{ app.name }}</a>
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" [style.color]="status(app).color" style="background:color-mix(in srgb, currentColor 10%, transparent);">
                    <i [class]="status(app).icon" class="text-[10px]"></i>{{ status(app).labelKey | translate }}
                  </span>
                </div>
                <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style="color:var(--color-text-secondary);">
                  @if (app.git_repository) {
                    <span class="inline-flex min-w-0 items-center gap-1.5">
                      <i class="pi text-[10px]" [class.pi-github]="app.git_repository.includes('github')" [class.pi-code]="!app.git_repository.includes('github')"></i>
                      <span class="truncate">{{ repoName(app.git_repository) }}</span>
                      @if (app.git_branch) { <span style="color:var(--color-text-tertiary);">· {{ app.git_branch }}</span> }
                    </span>
                  }
                  @if (app.workspace_name) {
                    <span class="inline-flex items-center gap-1.5"><i class="pi pi-clone text-[10px]"></i>{{ app.workspace_name }}</span>
                  }
                </div>
              </div>

              <div class="relative z-10 flex items-center gap-2">
                @if (app.link) {
                  <a class="outer-button button-sm" [href]="app.link" target="_blank" rel="noopener noreferrer">
                    <i class="pi pi-external-link mr-1.5 text-xs"></i>{{ 'applications.open' | translate }}
                  </a>
                }
                <button type="button" class="outer-button button-sm" [disabled]="deploying() === app.uuid" (click)="deploy(app)">
                  @if (deploying() === app.uuid) { <idem-loader size="xs" /> } @else { <i class="pi pi-send mr-1.5 text-xs"></i> }
                  {{ (deploying() === app.uuid ? 'applications.list.queuing' : 'applications.deploy') | translate }}
                </button>
                <i class="pi pi-chevron-right ml-1 hidden text-xs sm:block" style="color:var(--color-text-tertiary);" aria-hidden="true"></i>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class ApplicationsListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  /** Set after a deletion whose record is gone but whose server could not be cleaned. */
  protected readonly cleanupFailed = inject(ActivatedRoute).snapshot.queryParamMap.get('cleanup') === 'failed';

  protected readonly applications = signal<Application[]>([]);
  protected readonly loading = signal(true);
  protected readonly deploying = signal<string | null>(null);
  protected readonly query = signal('');

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.applications();
    return this.applications().filter((a) =>
      [a.name, a.git_repository ?? '', a.workspace_name ?? ''].some((v) => v.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.api.listApplications().subscribe({
      next: (apps) => {
        this.applications.set(apps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected status(app: Application) {
    return appStatusDisplay(app.status);
  }

  protected stack(app: Application) {
    return techIcon(app);
  }

  /** `owner/repo` reads faster than the full clone URL. */
  protected repoName(url: string): string {
    return url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
  }

  protected deploy(app: Application): void {
    this.deploying.set(app.uuid);
    this.api.deploy(app.uuid).subscribe({
      next: (res) => this.router.navigate(['/deployments', res.deploymentUuid]),
      error: () => this.deploying.set(null),
    });
  }
}
