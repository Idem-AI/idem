import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Workspace, WorkspaceEnvironment } from '../../../shared/models/ideploy.models';

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
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
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
        <section class="box">
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

        <section class="box">
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
            <button class="button-secondary" type="submit" [disabled]="environmentForm.invalid">
              {{ 'workspaces.env.add' | translate }}
            </button>
          </form>
        </section>
      </div>

      <section class="box mt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">
            {{ 'workspaces.projects' | translate }} ({{ ws.projectCount }})
          </h2>
          <a class="button" routerLink="/new-project" [queryParams]="{ workspace: ws.uuid }">
            {{ 'workspaces.addProject' | translate }}
          </a>
        </div>
        @if (ws.projectCount === 0) {
          <p class="mt-3 text-sm" style="color:var(--color-text-secondary);">
            {{ 'workspaces.noProjects' | translate }}
          </p>
        }
      </section>
    } @else {
      <div class="box">{{ 'workspaces.notFound' | translate }}</div>
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
