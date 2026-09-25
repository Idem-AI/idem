import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { DeploymentType, Server, Workspace, WorkspaceOptions } from '../../../shared/models/ideploy.models';
import { GuideSessionService } from '../../../shared/services/guide-session.service';

/**
 * First inline step of the architecture guide: land on a real workspace
 * before anything else can be created, without leaving this page for
 * `/workspaces/new` — that standalone flow (`workspace-create.ts`) is the
 * fuller version of the same two questions (name, then where it runs),
 * condensed here since the guide already knows why the workspace exists.
 */
@Component({
  selector: 'app-guide-workspace-step',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (workspaces().length > 0) {
        <div class="flex gap-2 text-xs">
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 font-semibold transition-colors"
            [style.background]="mode() === 'existing' ? 'var(--color-primary-500)' : 'var(--glass-bg-subtle)'"
            [style.color]="mode() === 'existing' ? 'white' : 'var(--color-text-secondary)'"
            (click)="mode.set('existing')"
          >
            {{ 'workspaceChoicePicker.useExisting' | translate }}
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 font-semibold transition-colors"
            [style.background]="mode() === 'new' ? 'var(--color-primary-500)' : 'var(--glass-bg-subtle)'"
            [style.color]="mode() === 'new' ? 'white' : 'var(--color-text-secondary)'"
            (click)="mode.set('new')"
          >
            {{ 'workspaceChoicePicker.createNew' | translate }}
          </button>
        </div>
      }

      @if (mode() === 'existing' && workspaces().length > 0) {
        <div>
          <label class="mb-1 block text-sm">{{ 'workspaceTargetPicker.workspace' | translate }}</label>
          <select  [ngModel]="selectedUuid()" (ngModelChange)="selectedUuid.set($event)">
            <option value="" disabled>{{ 'workspaceTargetPicker.chooseWorkspace' | translate }}</option>
            @for (ws of workspaces(); track ws.uuid) {
              <option [value]="ws.uuid">{{ ws.name }}</option>
            }
          </select>
        </div>
      } @else {
        <div>
          <label class="mb-1 block text-sm">{{ 'workspaces.form.name' | translate }}</label>
          <input type="text"  [ngModel]="name()" (ngModelChange)="name.set($event)" [placeholder]="'workspaces.form.namePlaceholder' | translate" />
        </div>

        @if (deploymentTypes().length > 1) {
          <fieldset>
            <legend class="mb-2 text-sm">{{ 'workspaces.form.target' | translate }}</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (type of deploymentTypes(); track type) {
                <label class="cursor-pointer rounded-lg border p-3" [style.border-color]="deploymentType() === type ? 'var(--color-primary-400)' : 'var(--color-surface-2)'">
                  <input class="sr-only" type="radio" name="guideDeploymentType" [checked]="deploymentType() === type" (change)="deploymentType.set(type)" />
                  <span class="block text-sm font-semibold">{{ 'workspaces.target.' + type | translate }}</span>
                  <span class="mt-1 block text-xs" style="color:var(--color-text-secondary);">{{ 'workspaces.targetHint.' + type | translate }}</span>
                </label>
              }
            </div>
          </fieldset>
        }

        @if (deploymentType() === 'own') {
          <div>
            <label class="mb-1 block text-sm">{{ 'workspaces.form.server' | translate }}</label>
            @if (servers().length === 0) {
              <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'workspaces.form.noServers' | translate }}</p>
            } @else {
              <select  [ngModel]="serverUuid()" (ngModelChange)="serverUuid.set($event)">
                <option value="">{{ 'workspaces.form.chooseServer' | translate }}</option>
                @for (server of servers(); track server.uuid) {
                  <option [value]="server.uuid">{{ server.name }} — {{ server.ip }}</option>
                }
              </select>
            }
          </div>
        } @else if (options()?.regionSelectionAllowed) {
          <div>
            <label class="mb-1 block text-sm">{{ 'workspaces.form.region' | translate }}</label>
            <select  [ngModel]="region()" (ngModelChange)="region.set($event)">
              <option value="">{{ 'workspaces.form.defaultRegion' | translate: { region: options()?.defaultRegion } }}</option>
              @for (r of options()?.availableRegions ?? []; track r) {
                <option [value]="r">{{ r }}</option>
              }
            </select>
          </div>
        }
      }

      @if (error()) {
        <p class="text-sm text-red-400">{{ error() }}</p>
      }

      <button class="inner-button" type="button" [disabled]="saving() || !canContinue()" (click)="continue()">
        {{ (saving() ? 'workspaces.form.creating' : 'projects.new.continue') | translate }}
      </button>
    </div>
  `,
})
export class GuideWorkspaceStepComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private guideSession = inject(GuideSessionService);

  readonly architectureId = input.required<string>();
  readonly suggestedName = input<string>('');
  readonly completed = output<void>();

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly selectedUuid = signal('');
  protected readonly name = signal('');
  protected readonly deploymentType = signal<DeploymentType>('saas');
  protected readonly serverUuid = signal('');
  protected readonly region = signal('');
  protected readonly options = signal<WorkspaceOptions | null>(null);
  protected readonly servers = signal<Server[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly deploymentTypes = computed<DeploymentType[]>(() => this.options()?.deploymentTypes ?? ['saas', 'own']);

  ngOnInit(): void {
    this.name.set(this.suggestedName());
    this.api.listWorkspaces().subscribe((list) => {
      this.workspaces.set(list);
      this.mode.set(list.length > 0 ? 'existing' : 'new');
    });
    this.api.workspaceOptions().subscribe({ next: (o) => this.options.set(o), error: () => undefined });
    this.api.listServers().subscribe({ next: (s) => this.servers.set(s), error: () => undefined });
  }

  protected canContinue(): boolean {
    if (this.mode() === 'existing') return Boolean(this.selectedUuid());
    if (!this.name().trim()) return false;
    return this.deploymentType() !== 'own' || Boolean(this.serverUuid());
  }

  protected continue(): void {
    if (!this.canContinue()) return;

    if (this.mode() === 'existing') {
      const ws = this.workspaces().find((w) => w.uuid === this.selectedUuid());
      if (!ws) return;
      this.guideSession.setWorkspace(this.architectureId(), ws.uuid, ws.name);
      this.completed.emit();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const ownServer = this.deploymentType() === 'own';
    this.api
      .createWorkspace({
        name: this.name().trim(),
        deployment_type: this.deploymentType(),
        region: !ownServer && this.region() ? this.region() : undefined,
        server_uuid: ownServer ? this.serverUuid() : undefined,
      })
      .subscribe({
        next: (ws) => {
          this.guideSession.setWorkspace(this.architectureId(), ws.uuid, ws.name);
          this.saving.set(false);
          this.completed.emit();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e?.error?.error?.message ?? this.translate.instant('workspaces.form.createError'));
        },
      });
  }
}
