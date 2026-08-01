import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Workspace } from '../../../shared/models/ideploy.models';

/**
 * Workspaces overview.
 *
 * A workspace is where the infrastructure question is answered — target, region,
 * shared network — so the cards surface exactly that, plus how many projects sit
 * inside. Everything else belongs on the detail page.
 */
@Component({
  selector: 'app-workspaces-list',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1
          class="heading-serif"
          style="font-size:32px;font-weight:700;color:var(--color-text-primary);"
        >
          {{ 'workspaces.title' | translate }}
        </h1>
        <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
          {{ 'workspaces.subtitle' | translate }}
        </p>
      </div>
      <a class="button" routerLink="/workspaces/new">{{ 'workspaces.create' | translate }}</a>
    </div>

    @if (loading()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">
        {{ 'projects.common.loading' | translate }}
      </p>
    } @else if (workspaces().length === 0) {
      <div class="box">
        <p class="mb-3">{{ 'workspaces.emptyTitle' | translate }}</p>
        <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">
          {{ 'workspaces.emptyHint' | translate }}
        </p>
        <a class="button" routerLink="/workspaces/new">{{ 'workspaces.createFirst' | translate }}</a>
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (workspace of workspaces(); track workspace.uuid) {
          <div class="db-glass p-5">
            <div class="mb-2 flex items-start justify-between gap-2">
              <a
                class="font-semibold hover:underline"
                style="color:var(--color-text-primary);"
                [routerLink]="['/workspaces', workspace.uuid]"
                >{{ workspace.name }}</a
              >
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                [style.background]="workspace.deploymentType === 'saas' ? 'var(--color-primary-500-10, rgba(79,195,176,.12))' : 'rgba(148,163,184,.15)'"
                [style.color]="workspace.deploymentType === 'saas' ? 'var(--color-primary-400)' : 'var(--color-text-secondary)'"
              >
                {{ 'workspaces.target.' + workspace.deploymentType | translate }}
              </span>
            </div>

            @if (workspace.description) {
              <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
                {{ workspace.description }}
              </p>
            }

            <dl class="space-y-1 text-xs" style="color:var(--color-text-secondary);">
              <div class="flex justify-between gap-2">
                <dt>{{ 'workspaces.field.projects' | translate }}</dt>
                <dd style="color:var(--color-text-primary);">{{ workspace.projectCount }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>{{ 'workspaces.field.environments' | translate }}</dt>
                <dd style="color:var(--color-text-primary);">
                  {{ environmentNames(workspace) }}
                </dd>
              </div>
              @if (workspace.region) {
                <div class="flex justify-between gap-2">
                  <dt>{{ 'workspaces.field.region' | translate }}</dt>
                  <dd style="color:var(--color-text-primary);">{{ workspace.region }}</dd>
                </div>
              }
              @if (workspace.assignedServerName) {
                <div class="flex justify-between gap-2">
                  <dt>{{ 'workspaces.field.server' | translate }}</dt>
                  <dd style="color:var(--color-text-primary);">{{ workspace.assignedServerName }}</dd>
                </div>
              }
            </dl>

            <div class="mt-4 flex justify-end">
              <a
                [routerLink]="['/workspaces', workspace.uuid]"
                style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--color-primary-400);"
              >
                {{ 'workspaces.open' | translate }}
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
              </a>
            </div>
          </div>
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
