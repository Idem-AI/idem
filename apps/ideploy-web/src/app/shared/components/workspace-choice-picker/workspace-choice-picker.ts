import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { DeploymentType, Server, Workspace, WorkspaceOptions } from '../../models/ideploy.models';
import { IllustrationComponent } from '../illustration/illustration';
import { NoServerPromptComponent } from '../no-server-prompt/no-server-prompt';
import { withQueryParams } from '../../utils/return-to.util';

export interface WorkspaceChoice {
  /** Set when an existing workspace was picked. */
  workspace_uuid?: string;
  /** Set when creating a new one — find-or-create by name. */
  workspace_name?: string;
  /** Where a new workspace runs. An existing one already knows. */
  deployment_type?: DeploymentType;
  /** Set with `deployment_type: 'own'`. */
  server_uuid?: string;
  /** SaaS only, when the plan allows choosing. */
  region?: string;
  /** Display name of the picked or new workspace — for the caller's own labels, not for the API. */
  label: string;
}

/**
 * Where a deploy lands: IDEM's infrastructure or the operator's own server,
 * then which workspace on it — an existing one, or a new one.
 *
 * The target is asked first, every time. It used to be asked only when a
 * workspace was created from `/workspaces/new`; every other entry point
 * either hid it behind "use existing" or created the workspace on IDEM in
 * silence, so someone with a server of their own never saw the choice.
 * Existing workspaces are then filtered to that target, so picking one can't
 * contradict the answer just given.
 */
@Component({
  selector: 'app-workspace-choice-picker',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent, IllustrationComponent, NoServerPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <idem-loader block [label]="'projects.common.loading' | translate" />
    } @else if (locked() && lockedWorkspace(); as ws) {
      <div class="flex items-center gap-4">
        <app-illustration [name]="ws.deploymentType === 'own' ? 'own-server' : 'managed-cloud'" [width]="64" class="block flex-shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-text-primary">{{ 'workspaceChoicePicker.lockedInto' | translate: { name: ws.name } }}</p>
          <p class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
            {{ 'workspaces.target.' + ws.deploymentType | translate }}
            @if (ws.deploymentType === 'own' && ws.assignedServerName) { · {{ ws.assignedServerName }} }
          </p>
        </div>
        <button type="button" class="outer-button button-sm" (click)="locked.set(false)">
          {{ 'workspaceChoicePicker.change' | translate }}
        </button>
      </div>
    } @else {
      <div class="space-y-5">
        <fieldset>
          <legend class="mb-2 text-sm">{{ 'workspaces.form.target' | translate }}</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (type of deploymentTypes(); track type) {
              <label
                class="relative flex cursor-pointer flex-col items-center rounded-xl border p-4 text-center transition-smooth"
                [style.border-color]="target() === type ? 'var(--color-primary-500)' : 'var(--glass-border)'"
                [style.background]="target() === type ? 'var(--glass-bg-light)' : 'var(--glass-bg-subtle)'"
              >
                <input class="sr-only" type="radio" [name]="radioName" [checked]="target() === type" (change)="setTarget(type)" />
                @if (target() === type) {
                  <i class="pi pi-check-circle absolute right-3 top-3 text-sm" style="color:var(--color-primary-500);"></i>
                }
                <app-illustration [name]="type === 'own' ? 'own-server' : 'managed-cloud'" [width]="88" class="mb-2 block" />
                <span class="block text-sm font-semibold">{{ 'workspaces.target.' + type | translate }}</span>
                <span class="mt-1 block text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'workspaces.targetHint.' + type | translate }}</span>
              </label>
            }
          </div>
        </fieldset>

        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm">{{ 'workspaceChoicePicker.workspaceLabel' | translate }}</span>
            @if (matching().length > 0) {
              <div class="inline-flex rounded-lg border p-1" style="border-color:var(--glass-border);background:var(--glass-bg-subtle);" role="radiogroup">
                @for (m of modes; track m.value) {
                  <button
                    type="button"
                    role="radio"
                    class="rounded-md px-3 py-1 text-xs font-semibold transition-smooth"
                    [attr.aria-checked]="mode() === m.value"
                    [style.background]="mode() === m.value ? 'var(--glass-bg-light)' : 'transparent'"
                    [style.box-shadow]="mode() === m.value ? '0 0 0 1px var(--glass-border-medium)' : 'none'"
                    [style.color]="mode() === m.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                    (click)="mode.set(m.value)"
                  >
                    {{ m.label | translate }}
                  </button>
                }
              </div>
            }
          </div>

          @if (mode() === 'existing' && matching().length > 0) {
            <select [attr.aria-label]="'workspaceChoicePicker.workspaceLabel' | translate" [ngModel]="selectedUuid()" (ngModelChange)="selectedUuid.set($event)">
              <option value="" disabled>{{ 'workspaceChoicePicker.choose' | translate }}</option>
              @for (ws of matching(); track ws.uuid) {
                <option [value]="ws.uuid">
                  {{ ws.name }}@if (ws.deploymentType === 'own' && ws.assignedServerName) { — {{ ws.assignedServerName }} }
                </option>
              }
            </select>
            <p class="text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'workspaceChoicePicker.existingHint' | translate }}</p>
          } @else {
            <input
              type="text"
              [attr.aria-label]="'workspaceChoicePicker.workspaceLabel' | translate"
              [ngModel]="newName()"
              (ngModelChange)="onNewNameChange($event)"
              [placeholder]="'workspaceChoicePicker.namePlaceholder' | translate"
            />
            <p class="text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'workspaceChoicePicker.newHint' | translate }}</p>
          }
        </div>

        @if (mode() === 'new' || matching().length === 0) {
          @if (target() === 'own') {
            <div>
              <label class="mb-1 block text-sm" [for]="radioName + '-server'">{{ 'workspaces.form.server' | translate }}</label>
              @if (servers().length === 0) {
                <app-no-server-prompt [returnTo]="returnTo()" />
              } @else {
                <select [id]="radioName + '-server'" [ngModel]="serverUuid()" (ngModelChange)="serverUuid.set($event)">
                  <option value="">{{ 'workspaces.form.chooseServer' | translate }}</option>
                  @for (server of servers(); track server.uuid) {
                    <option [value]="server.uuid">{{ server.name }} — {{ server.ip }}</option>
                  }
                </select>
              }
            </div>
          } @else if (options()?.regionSelectionAllowed) {
            <div>
              <label class="mb-1 block text-sm" [for]="radioName + '-region'">{{ 'workspaces.form.region' | translate }}</label>
              <select [id]="radioName + '-region'" [ngModel]="region()" (ngModelChange)="region.set($event)">
                <option value="">{{ 'workspaces.form.defaultRegion' | translate: { region: options()?.defaultRegion } }}</option>
                @for (r of options()?.availableRegions ?? []; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
            </div>
          } @else if (options()?.defaultRegion) {
            <p class="text-xs leading-relaxed" style="color:var(--color-text-secondary);">
              {{ 'workspaces.form.regionLocked' | translate: { region: options()?.defaultRegion } }}
            </p>
          }
        }
      </div>
    }
  `,
})
export class WorkspaceChoicePickerComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Prefills the "create new" name — typically the thing being deployed. */
  readonly suggestedName = input<string>('');

  /**
   * Preselects and locks onto this workspace — set when the flow was entered
   * from that workspace's own page (its "+ Nouvelle ressource" button), so the
   * choice already made there isn't asked again. The operator can still
   * override via "Changer": a lock is a strong default, never a constraint.
   */
  readonly lockedWorkspaceUuid = input<string | null>(null);

  /**
   * Which of "use existing" / "create" opens when both are possible. Import
   * flows default to a new workspace named after what is deployed; the
   * architecture guide defaults to reusing one.
   */
  readonly preferExisting = input(false);

  readonly choiceChange = output<WorkspaceChoice | null>();

  protected readonly modes = [
    { value: 'existing' as const, label: 'workspaceChoicePicker.useExisting' },
    { value: 'new' as const, label: 'workspaceChoicePicker.createNew' },
  ];
  /** Radio groups need a name unique to this instance. */
  protected readonly radioName = `ws-target-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly loading = signal(true);
  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly servers = signal<Server[]>([]);
  protected readonly options = signal<WorkspaceOptions | null>(null);

  protected readonly target = signal<DeploymentType>('saas');
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly selectedUuid = signal('');
  protected readonly newName = signal('');
  protected readonly serverUuid = signal('');
  protected readonly region = signal('');
  /** Set to false once the operator clicks "Changer". */
  protected readonly locked = signal(true);
  private touchedName = false;

  /**
   * This very page, with "own server" already answered — where adding a
   * server brings the person back. The server just added comes back as
   * `?ws_server=` and is picked on arrival (see ngOnInit).
   */
  protected readonly returnTo = computed(() =>
    withQueryParams(this.router, this.router.url, { ws_target: 'own', ws_server: null, ws_name: this.newName().trim() || null })
  );

  protected readonly deploymentTypes = computed<DeploymentType[]>(() => this.options()?.deploymentTypes ?? ['saas', 'own']);
  protected readonly matching = computed(() => this.workspaces().filter((w) => w.deploymentType === this.target()));
  protected readonly lockedWorkspace = computed(
    () => this.workspaces().find((w) => w.uuid === this.lockedWorkspaceUuid()) ?? null
  );

  /** What the caller receives — null until the answer is complete enough to deploy. */
  private readonly choice = computed<WorkspaceChoice | null>(() => {
    if (this.loading()) return null;

    const locked = this.locked() ? this.lockedWorkspace() : null;
    if (locked) return { workspace_uuid: locked.uuid, label: locked.name };

    if (this.mode() === 'existing' && this.matching().length > 0) {
      const ws = this.matching().find((w) => w.uuid === this.selectedUuid());
      return ws ? { workspace_uuid: ws.uuid, label: ws.name } : null;
    }

    const name = this.newName().trim();
    if (!name) return null;
    if (this.target() === 'own') {
      return this.serverUuid()
        ? { workspace_name: name, deployment_type: 'own', server_uuid: this.serverUuid(), label: name }
        : null;
    }
    return { workspace_name: name, deployment_type: 'saas', region: this.region() || undefined, label: name };
  });

  constructor() {
    // Keeps the suggested name in sync until the operator types their own.
    effect(() => {
      const suggested = this.suggestedName();
      if (!this.touchedName) this.newName.set(suggested);
    });
    effect(() => this.choiceChange.emit(this.choice()));
  }

  ngOnInit(): void {
    forkJoin({
      workspaces: this.api.listWorkspaces().pipe(catchError(() => of([] as Workspace[]))),
      servers: this.api.listServers().pipe(catchError(() => of([] as Server[]))),
      options: this.api.workspaceOptions().pipe(catchError(() => of(null))),
    }).subscribe(({ workspaces, servers, options }) => {
      this.workspaces.set(workspaces);
      this.servers.set(servers);
      this.options.set(options);

      // Back from adding a server: resume on "own server", with that server picked.
      const q = this.route.snapshot.queryParamMap;
      const returning = q.get('ws_target') === 'own';
      const returnedName = q.get('ws_name');
      if (returnedName && !this.touchedName) {
        this.touchedName = true;
        this.newName.set(returnedName);
      }

      const locked = returning ? undefined : workspaces.find((w) => w.uuid === this.lockedWorkspaceUuid());
      if (returning) {
        this.locked.set(false);
        this.target.set('own');
        this.mode.set('new');
        const server = q.get('ws_server');
        if (server && servers.some((s) => s.uuid === server)) this.serverUuid.set(server);
      } else if (locked) {
        this.target.set(locked.deploymentType);
        this.mode.set('existing');
        this.selectedUuid.set(locked.uuid);
      } else {
        this.applyDefaultMode();
      }
      this.loading.set(false);
    });
  }

  protected setTarget(type: DeploymentType): void {
    this.target.set(type);
    this.selectedUuid.set('');
    this.applyDefaultMode();
  }

  protected onNewNameChange(name: string): void {
    this.touchedName = true;
    this.newName.set(name);
  }

  private applyDefaultMode(): void {
    const matching = this.matching();
    this.mode.set(this.preferExisting() && matching.length > 0 ? 'existing' : 'new');
    // A single candidate is the answer; no reason to make the operator pick it.
    if (matching.length === 1) this.selectedUuid.set(matching[0].uuid);
  }
}
