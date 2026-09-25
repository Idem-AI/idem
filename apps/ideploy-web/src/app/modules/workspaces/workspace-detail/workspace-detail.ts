import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Workspace, WorkspaceEnvironment, WorkspaceResource } from '../../../shared/models/ideploy.models';

/**
 * Workspace detail.
 *
 * Shows where the workspace runs and what lives in it. The hosting facts are
 * stated plainly rather than hidden: "these projects share a network" is the
 * whole point of a workspace, and a user who does not know it will not use it.
 */
@Component({
  selector: 'app-workspace-detail',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/workspaces"
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'workspaces.backToList' | translate }}
    </a>

    @if (loading()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">
        {{ 'projects.common.loading' | translate }}
      </p>
    } @else if (workspace(); as ws) {
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            class="heading-serif"
            style="font-size:32px;font-weight:700;color:var(--color-text-primary);"
          >
            {{ ws.name }}
          </h1>
          @if (ws.description) {
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
              {{ ws.description }}
            </p>
          }
        </div>
        <button
          class="text-xs"
          style="color:var(--color-danger);"
          [disabled]="deleting()"
          (click)="remove(ws)"
        >
          {{ 'workspaces.delete' | translate }}
        </button>
      </div>

      @if (error()) {
        <p class="mb-4 text-sm" style="color:var(--color-danger);">{{ error() }}</p>
      }

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">{{ 'workspaces.hosting' | translate }}</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">
                {{ 'workspaces.field.target' | translate }}
              </dt>
              <dd>{{ 'workspaces.target.' + ws.deploymentType | translate }}</dd>
            </div>
            @if (ws.region) {
              <div class="flex justify-between gap-2">
                <dt style="color:var(--color-text-secondary);">
                  {{ 'workspaces.field.region' | translate }}
                </dt>
                <dd>{{ ws.region }}</dd>
              </div>
            }
            @if (ws.assignedServerName) {
              <div class="flex justify-between gap-2">
                <dt style="color:var(--color-text-secondary);">
                  {{ 'workspaces.field.server' | translate }}
                </dt>
                <dd>{{ ws.assignedServerName }}</dd>
              </div>
            }
          </dl>
          <p class="mt-3 text-xs" style="color:var(--color-text-secondary);">
            {{ 'workspaces.colocationNote' | translate }}
          </p>
        </section>

        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">{{ 'workspaces.environments' | translate }}</h2>

          <ul class="mb-3 space-y-2">
            @for (environment of ws.environments; track environment.uuid) {
              <li class="flex items-center justify-between gap-2 text-sm">
                <span>{{ environment.name }}</span>
                @if (ws.environments.length > 1) {
                  <button
                    class="text-xs"
                    style="color:var(--color-danger);"
                    (click)="removeEnvironment(ws, environment)"
                  >
                    {{ 'workspaces.env.delete' | translate }}
                  </button>
                }
              </li>
            }
          </ul>

          <form class="flex gap-2" [formGroup]="environmentForm" (ngSubmit)="addEnvironment(ws)">
            <input
              class="input flex-1"
              formControlName="name"
              [placeholder]="'workspaces.env.placeholder' | translate"
              [attr.aria-label]="'workspaces.env.add' | translate"
            />
            <button class="outer-button" type="submit" [disabled]="environmentForm.invalid">
              {{ 'workspaces.env.add' | translate }}
            </button>
          </form>
        </section>
      </div>

      <section class="glass-card p-4 mt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ 'workspaces.projects' | translate }} ({{ resources().length }})
          </h2>
          <a class="inner-button" routerLink="/new-project" [queryParams]="{ workspace: ws.uuid }">
            {{ 'workspaces.addProject' | translate }}
          </a>
        </div>

        @if (resourcesLoading()) {
          <p class="mt-3 text-sm" style="color:var(--color-text-secondary);">
            {{ 'projects.common.loading' | translate }}
          </p>
        } @else if (resources().length === 0) {
          <p class="mt-3 text-sm" style="color:var(--color-text-secondary);">
            {{ 'workspaces.noProjects' | translate }}
          </p>
        } @else {
          <div class="mt-4 space-y-5">
            @for (group of resourcesByEnvironment(); track group.environmentName) {
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-tertiary);">
                  {{ group.environmentName }}
                </h3>
                <div class="space-y-2">
                  @for (r of group.items; track r.uuid) {
                    <div class="rounded-lg p-3" style="border:1px solid var(--color-surface-2);">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex min-w-0 items-center gap-2">
                          <span
                            class="inline-block h-2 w-2 shrink-0 rounded-full"
                            [style.background]="isRunning(r) ? 'var(--color-success)' : 'var(--color-text-tertiary)'"
                            [title]="r.status || ('workspaces.resource.unknownStatus' | translate)"
                          ></span>
                          <a class="truncate font-semibold hover:underline" [routerLink]="openLink(r)">{{ r.name }}</a>
                          <span class="shrink-0 rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
                            {{ 'workspaces.resource.kind.' + r.kind | translate }}
                          </span>
                        </div>

                        @if (r.kind === 'application') {
                          <div class="flex shrink-0 flex-wrap items-center gap-3 text-xs">
                            <a [routerLink]="['/applications', r.uuid, 'security']" style="color:var(--color-text-secondary);" class="hover:underline">
                              <i class="pi pi-shield mr-1"></i>{{ 'workspaces.resource.security' | translate }}
                            </a>
                            <a [routerLink]="['/applications', r.uuid, 'pipeline']" style="color:var(--color-text-secondary);" class="hover:underline">
                              <i class="pi pi-sitemap mr-1"></i>{{ 'workspaces.resource.pipeline' | translate }}
                            </a>
                            <a [routerLink]="['/applications', r.uuid, 'deployments']" style="color:var(--color-text-secondary);" class="hover:underline">
                              <i class="pi pi-history mr-1"></i>{{ 'workspaces.resource.deployments' | translate }}
                            </a>
                            <a [routerLink]="['/applications', r.uuid, 'insights']" style="color:var(--color-text-secondary);" class="hover:underline">
                              <i class="pi pi-chart-line mr-1"></i>{{ 'workspaces.resource.insights' | translate }}
                            </a>
                          </div>
                        }
                      </div>

                      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style="color:var(--color-text-secondary);">
                        @if (r.fqdn) {
                          <a [href]="'https://' + r.fqdn" target="_blank" rel="noopener" class="hover:underline" style="color:var(--color-primary-400);">
                            <i class="pi pi-external-link mr-1"></i>{{ r.fqdn }}
                          </a>
                        }
                        <span>
                          {{ 'workspaces.resource.internalHost' | translate }}
                          <code class="ml-1" style="color:var(--color-text-primary);">{{ r.internalHost }}</code>
                        </span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>
    } @else {
      <div class="glass-card p-4">{{ 'workspaces.notFound' | translate }}</div>
    }
  `,
})
export class WorkspaceDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly workspace = signal<Workspace | null>(null);
  protected readonly loading = signal(true);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly resources = signal<WorkspaceResource[]>([]);
  protected readonly resourcesLoading = signal(true);

  /** Grouped by environment — the axis a workspace actually organises around. */
  protected readonly resourcesByEnvironment = computed(() => {
    const groups = new Map<string, WorkspaceResource[]>();
    for (const r of this.resources()) {
      const list = groups.get(r.environmentName) ?? [];
      list.push(r);
      groups.set(r.environmentName, list);
    }
    return [...groups.entries()].map(([environmentName, items]) => ({ environmentName, items }));
  });

  protected readonly environmentForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]*$/)]],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) {
      this.loading.set(false);
      return;
    }
    this.api.getWorkspace(uuid).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.resourcesLoading.set(true);
    this.api.listWorkspaceResources(uuid).subscribe({
      next: (resources) => {
        this.resources.set(resources);
        this.resourcesLoading.set(false);
      },
      error: () => this.resourcesLoading.set(false),
    });
  }

  /** A resource's own detail page — the route shape differs per kind. */
  protected openLink(r: WorkspaceResource): string[] {
    if (r.kind === 'database') return ['/databases', r.databaseType ?? '', r.uuid];
    if (r.kind === 'service') return ['/services', r.uuid];
    return ['/applications', r.uuid];
  }

  protected isRunning(r: WorkspaceResource): boolean {
    return (r.status ?? '').toLowerCase().includes('running');
  }

  protected addEnvironment(workspace: Workspace): void {
    if (this.environmentForm.invalid) return;
    this.error.set(null);
    this.api.addEnvironment(workspace.uuid, this.environmentForm.getRawValue().name).subscribe({
      next: () => {
        this.environmentForm.reset({ name: '' });
        this.load();
      },
      error: (e) => this.error.set(this.messageOf(e, 'workspaces.env.addError')),
    });
  }

  protected removeEnvironment(workspace: Workspace, environment: WorkspaceEnvironment): void {
    this.error.set(null);
    this.api.deleteEnvironment(workspace.uuid, environment.uuid).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(this.messageOf(e, 'workspaces.env.deleteError')),
    });
  }

  protected remove(workspace: Workspace): void {
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteWorkspace(workspace.uuid).subscribe({
      next: () => void this.router.navigate(['/workspaces']),
      error: (e) => {
        // Most often: the workspace still holds projects. The API says which.
        this.error.set(this.messageOf(e, 'workspaces.deleteError'));
        this.deleting.set(false);
      },
    });
  }

  /** Prefer the API's explanation; fall back to a generic translated message. */
  private messageOf(error: { error?: { error?: { message?: string } } }, key: string): string {
    return error?.error?.error?.message ?? this.translate.instant(key);
  }
}
