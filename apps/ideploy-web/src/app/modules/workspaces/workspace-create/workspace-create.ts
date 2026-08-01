import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  DeploymentType,
  Server,
  WorkspaceOptions,
} from '../../../shared/models/ideploy.models';

/**
 * Two-step workspace creation.
 *
 * Step 1 asks what it is called. Step 2 asks where it runs — the question the
 * simplified flow had dropped, and the reason projects could no longer be
 * guaranteed to sit together.
 *
 * The cost of that question is paid once per workspace, not once per project:
 * everything created inside inherits the answer. Region selection only appears
 * when the plan includes it, so the default path stays two fields and a button.
 */
@Component({
  selector: 'app-workspace-create',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <a
        routerLink="/workspaces"
        class="mb-4 inline-flex items-center gap-2 text-sm"
        style="color:var(--color-text-secondary);"
      >
        <i class="fa-solid fa-chevron-left text-[10px]"></i>
        {{ 'workspaces.backToList' | translate }}
      </a>

      <h1
        class="heading-serif mb-1"
        style="font-size:28px;font-weight:700;color:var(--color-text-primary);"
      >
        {{ 'workspaces.createTitle' | translate }}
      </h1>
      <p class="mb-6 text-sm" style="color:var(--color-text-secondary);">
        {{ 'workspaces.createSubtitle' | translate }}
      </p>

      <ol class="mb-6 flex gap-2 text-xs" style="color:var(--color-text-secondary);">
        <li [style.color]="step() === 1 ? 'var(--color-primary-400)' : undefined">
          1. {{ 'workspaces.step.identity' | translate }}
        </li>
        <li>·</li>
        <li [style.color]="step() === 2 ? 'var(--color-primary-400)' : undefined">
          2. {{ 'workspaces.step.hosting' | translate }}
        </li>
      </ol>

      <form class="box space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        @if (step() === 1) {
          <div>
            <label class="mb-1 block text-sm" for="ws-name">
              {{ 'workspaces.form.name' | translate }}
            </label>
            <input
              id="ws-name"
              class="input"
              formControlName="name"
              [placeholder]="'workspaces.form.namePlaceholder' | translate"
            />
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">
              {{ 'workspaces.form.nameHint' | translate }}
            </p>
          </div>

          <div>
            <label class="mb-1 block text-sm" for="ws-description">
              {{ 'workspaces.form.description' | translate }}
            </label>
            <input id="ws-description" class="input" formControlName="description" />
          </div>

          <button
            class="button"
            type="button"
            [disabled]="form.controls.name.invalid"
            (click)="step.set(2)"
          >
            {{ 'workspaces.form.next' | translate }}
          </button>
        } @else {
          <fieldset>
            <legend class="mb-2 text-sm">{{ 'workspaces.form.target' | translate }}</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (type of deploymentTypes(); track type) {
                <label
                  class="cursor-pointer rounded-lg border p-3"
                  [style.border-color]="
                    form.controls.deployment_type.value === type
                      ? 'var(--color-primary-400)'
                      : 'var(--color-border, rgba(148,163,184,.25))'
                  "
                >
                  <input
                    class="sr-only"
                    type="radio"
                    [value]="type"
                    formControlName="deployment_type"
                  />
                  <span class="block text-sm font-semibold">
                    {{ 'workspaces.target.' + type | translate }}
                  </span>
                  <span class="mt-1 block text-xs" style="color:var(--color-text-secondary);">
                    {{ 'workspaces.targetHint.' + type | translate }}
                  </span>
                </label>
              }
            </div>
          </fieldset>

          @if (form.controls.deployment_type.value === 'own') {
            <div>
              <label class="mb-1 block text-sm" for="ws-server">
                {{ 'workspaces.form.server' | translate }}
              </label>
              @if (servers().length === 0) {
                <p class="text-sm" style="color:var(--color-text-secondary);">
                  {{ 'workspaces.form.noServers' | translate }}
                  <a routerLink="/servers/new" style="color:var(--color-primary-400);">
                    {{ 'workspaces.form.addServer' | translate }}
                  </a>
                </p>
              } @else {
                <select id="ws-server" class="input" formControlName="server_uuid">
                  <option value="">{{ 'workspaces.form.chooseServer' | translate }}</option>
                  @for (server of servers(); track server.uuid) {
                    <option [value]="server.uuid">{{ server.name }} — {{ server.ip }}</option>
                  }
                </select>
              }
            </div>
          } @else if (options()?.regionSelectionAllowed) {
            <div>
              <label class="mb-1 block text-sm" for="ws-region">
                {{ 'workspaces.form.region' | translate }}
              </label>
              <select id="ws-region" class="input" formControlName="region">
                <option value="">
                  {{ 'workspaces.form.defaultRegion' | translate:{ region: options()?.defaultRegion } }}
                </option>
                @for (region of options()?.availableRegions ?? []; track region) {
                  <option [value]="region">{{ region }}</option>
                }
              </select>
            </div>
          } @else {
            <p class="text-xs" style="color:var(--color-text-secondary);">
              {{ 'workspaces.form.regionLocked' | translate:{ region: options()?.defaultRegion } }}
            </p>
          }

          @if (error()) {
            <p class="text-sm" style="color:var(--color-danger);">{{ error() }}</p>
          }

          <div class="flex gap-2">
            <button class="button-secondary" type="button" (click)="step.set(1)">
              {{ 'workspaces.form.back' | translate }}
            </button>
            <button class="button" type="submit" [disabled]="saving() || !canSubmit()">
              {{ (saving() ? 'workspaces.form.creating' : 'workspaces.form.create') | translate }}
            </button>
          </div>
        }
      </form>
    </div>
  `,
})
export class WorkspaceCreateComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly step = signal<1 | 2>(1);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly options = signal<WorkspaceOptions | null>(null);
  protected readonly servers = signal<Server[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    deployment_type: ['saas' as DeploymentType, Validators.required],
    region: [''],
    server_uuid: [''],
  });

  /** Offer only what the API says this team can actually pick. */
  protected readonly deploymentTypes = computed<DeploymentType[]>(
    () => this.options()?.deploymentTypes ?? ['saas', 'own']
  );

  ngOnInit(): void {
    this.api.workspaceOptions().subscribe({
      next: (options) => this.options.set(options),
      // The form still works on defaults if options cannot be loaded.
      error: () => undefined,
    });
    this.api.listServers().subscribe({
      next: (servers) => this.servers.set(servers),
      error: () => undefined,
    });
  }

  /** Deploying to your own server is meaningless until one is chosen. */
  protected canSubmit(): boolean {
    if (this.form.controls.name.invalid) return false;
    return (
      this.form.controls.deployment_type.value !== 'own' ||
      Boolean(this.form.controls.server_uuid.value)
    );
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const ownServer = raw.deployment_type === 'own';

    this.api
      .createWorkspace({
        name: raw.name,
        description: raw.description || undefined,
        deployment_type: raw.deployment_type,
        // A region belongs to IDEM's fleet; sending one for a personal server
        // would be rejected, and rightly so.
        region: !ownServer && raw.region ? raw.region : undefined,
        server_uuid: ownServer ? raw.server_uuid : undefined,
      })
      .subscribe({
        next: (workspace) => {
          void this.router.navigate(['/workspaces', workspace.uuid]);
        },
        error: (e) => {
          this.error.set(
            e?.error?.error?.message ?? this.translate.instant('workspaces.form.createError')
          );
          this.saving.set(false);
        },
      });
  }
}
