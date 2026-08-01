import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';
import { Workspace, WorkspaceProject } from '../../models/ideploy.models';

export interface WorkspaceTarget {
  workspace_uuid: string;
  environment_name: string;
  /** Optional: naming "frontend" here creates that project if it does not exist yet. */
  project_name?: string;
}

/**
 * Where a resource (application, database, service) is created.
 *
 * Every resource-creation form used to ask for a raw numeric `environment_id`
 * and `destination_id`, typed by hand — which meant the destination the
 * backend actually used was whatever the operator happened to type, not
 * necessarily the workspace's own server. This replaces both with a workspace
 * (which decides the server), an environment within it, and an optional named
 * project ("frontend", "backend", …) — the same three-tier grouping a
 * workspace exists to support.
 */
@Component({
  selector: 'app-workspace-target-picker',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-sm">{{ 'workspaceTargetPicker.workspace' | translate }}</label>
        @if (workspaces().length === 0) {
          <p class="text-sm" style="color: var(--color-text-secondary)">
            {{ 'workspaceTargetPicker.noWorkspaces' | translate }}
          </p>
        } @else {
          <select
            class="input"
            [ngModel]="selectedWorkspace()?.uuid ?? ''"
            (ngModelChange)="onWorkspaceUuidChange($event)"
          >
            <option value="" disabled>{{ 'workspaceTargetPicker.chooseWorkspace' | translate }}</option>
            @for (ws of workspaces(); track ws.uuid) {
              <option [value]="ws.uuid">{{ ws.name }}</option>
            }
          </select>
        }
      </div>

      @if (selectedWorkspace(); as ws) {
        <div>
          <label class="mb-1 block text-sm">{{ 'workspaceTargetPicker.environment' | translate }}</label>
          <select class="input" [ngModel]="selectedEnvironment()" (ngModelChange)="onEnvironmentChange($event)">
            @for (env of ws.environments; track env.uuid) {
              <option [value]="env.name">{{ env.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm">
            {{ 'workspaceTargetPicker.project' | translate }}
            <span style="color: var(--color-text-secondary)">{{ 'workspaceTargetPicker.projectOptional' | translate }}</span>
          </label>
          <input
            class="input"
            list="workspace-target-picker-projects"
            [ngModel]="projectName()"
            (ngModelChange)="onProjectNameChange($event)"
            [placeholder]="'workspaceTargetPicker.projectPlaceholder' | translate"
          />
          <datalist id="workspace-target-picker-projects">
            @for (p of existingProjects(); track p.uuid) {
              <option [value]="p.name"></option>
            }
          </datalist>
          @if (projectName().trim()) {
            <p class="mt-1 text-xs" style="color: var(--color-text-secondary)">
              {{
                (isExistingProject()
                  ? 'workspaceTargetPicker.willUseExisting'
                  : 'workspaceTargetPicker.willCreateNew'
                ) | translate: { name: projectName().trim() }
              }}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class WorkspaceTargetPickerComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly selectedWorkspace = signal<Workspace | null>(null);
  protected readonly selectedEnvironment = signal<string>('');
  protected readonly projectName = signal<string>('');
  protected readonly existingProjects = signal<WorkspaceProject[]>([]);

  /** Emits the resolved target on every change, or null while incomplete. */
  readonly targetChange = output<WorkspaceTarget | null>();

  protected readonly isExistingProject = () =>
    this.existingProjects().some(
      (p) => p.name.toLowerCase() === this.projectName().trim().toLowerCase()
    );

  ngOnInit(): void {
    this.api.listWorkspaces().subscribe((list) => {
      this.workspaces.set(list);
      // The common case — one workspace — should not require a click to use.
      if (list.length === 1) this.selectWorkspace(list[0]);
    });
  }

  protected onWorkspaceUuidChange(uuid: string): void {
    const ws = this.workspaces().find((w) => w.uuid === uuid) ?? null;
    if (ws) this.selectWorkspace(ws);
  }

  private selectWorkspace(ws: Workspace): void {
    this.selectedWorkspace.set(ws);
    const production = ws.environments.find((e) => e.name === 'production');
    this.selectedEnvironment.set((production ?? ws.environments[0])?.name ?? '');
    this.projectName.set('');
    this.loadProjects();
    this.emit();
  }

  protected onEnvironmentChange(name: string): void {
    this.selectedEnvironment.set(name);
    this.loadProjects();
    this.emit();
  }

  protected onProjectNameChange(name: string): void {
    this.projectName.set(name);
    this.emit();
  }

  private loadProjects(): void {
    const ws = this.selectedWorkspace();
    if (!ws || !this.selectedEnvironment()) {
      this.existingProjects.set([]);
      return;
    }
    this.api.listWorkspaceProjects(ws.uuid, this.selectedEnvironment()).subscribe((list) => {
      this.existingProjects.set(list);
    });
  }

  private emit(): void {
    const ws = this.selectedWorkspace();
    if (!ws || !this.selectedEnvironment()) {
      this.targetChange.emit(null);
      return;
    }
    this.targetChange.emit({
      workspace_uuid: ws.uuid,
      environment_name: this.selectedEnvironment(),
      project_name: this.projectName().trim() || undefined,
    });
  }
}
