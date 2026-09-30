import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Workspace } from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

/**
 * Workspaces overview.
 *
 * A workspace is where the infrastructure question is answered — IDEM or your
 * own server, and where — so each card leads with that answer, then what sits
 * inside. The whole card opens the workspace; everything else belongs there.
 */
@Component({
  selector: 'app-workspaces-list',
  imports: [RouterLink, TranslateModule, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="'workspaces.title' | translate"
      [subtitle]="'workspaces.subtitle' | translate"
      [count]="loading() ? null : workspaces().length"
    >
      @if (!loading() && workspaces().length > 0) {
        <a class="inner-button" routerLink="/workspaces/new"><i class="pi pi-plus mr-2 text-xs"></i>{{ 'workspaces.create' | translate }}</a>
      }
    </app-page-header>

    @if (loading()) {
      <app-list-skeleton variant="cards" />
    } @else if (workspaces().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="box" [title]="'workspaces.emptyTitle' | translate" [body]="'workspaces.emptyHint' | translate">
          <a class="inner-button mt-5" routerLink="/workspaces/new">{{ 'workspaces.createFirst' | translate }}</a>
        </app-empty-state>
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (workspace of workspaces(); track workspace.uuid) {
          <a
            class="glass-card group flex flex-col p-5 transition-smooth hover:border-[var(--color-primary-500)]"
            [routerLink]="['/workspaces', workspace.uuid]"
          >
            <div class="mb-3 flex items-center justify-between gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style="background:var(--glass-bg-subtle);"
                [style.color]="workspace.deploymentType === 'saas' ? 'var(--color-primary-500)' : 'var(--color-text-secondary)'"
              >
                <i class="pi text-[10px]" [class.pi-cloud]="workspace.deploymentType === 'saas'" [class.pi-server]="workspace.deploymentType === 'own'"></i>
                {{ 'workspaces.target.' + workspace.deploymentType | translate }}
              </span>
              <i class="pi pi-arrow-right text-xs opacity-0 transition-smooth group-hover:opacity-100" style="color:var(--color-primary-500);"></i>
            </div>

            <h2 class="truncate text-base font-semibold text-text-primary">{{ workspace.name }}</h2>
            @if (workspace.description) {
              <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                {{ workspace.description }}
              </p>
            }

            <div class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs" style="color:var(--color-text-secondary);">
              <span class="inline-flex items-center gap-1.5">
                <i class="pi pi-th-large text-[10px]"></i>
                {{ (workspace.projectCount === 1 ? 'workspaces.resourceOne' : 'workspaces.resourceMany') | translate: { count: workspace.projectCount } }}
              </span>
              @if (workspace.deploymentType === 'own' && workspace.assignedServerName) {
                <span class="inline-flex items-center gap-1.5"><i class="pi pi-server text-[10px]"></i>{{ workspace.assignedServerName }}</span>
              } @else if (workspace.region) {
                <span class="inline-flex items-center gap-1.5"><i class="pi pi-map-marker text-[10px]"></i>{{ workspace.region }}</span>
              }
              <span class="inline-flex items-center gap-1.5"><i class="pi pi-sitemap text-[10px]"></i>{{ environmentNames(workspace) }}</span>
            </div>
          </a>
        }
      </div>
    }
  `,
})
export class WorkspacesListComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.api.listWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected environmentNames(workspace: Workspace): string {
    return workspace.environments.map((e) => e.name).join(', ');
  }
}
