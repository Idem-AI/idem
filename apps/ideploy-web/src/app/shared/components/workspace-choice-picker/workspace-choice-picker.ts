import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';
import { Workspace } from '../../models/ideploy.models';

export interface WorkspaceChoice {
  /** Set when an existing workspace was picked. */
  workspace_uuid?: string;
  /** Set when creating a new one — find-or-create by name. */
  workspace_name?: string;
}

/**
 * Where a one-click deploy lands: an existing workspace, or a new one.
 *
 * Every "New Project" entry point used to skip this question entirely and
 * silently create a workspace named after whatever was being deployed — which
 * is why importing the same repository twice produced two separate,
 * unrelated workspaces with no way to tell they were related. This makes the
 * choice visible without adding a step for the common case: with no
 * workspaces yet, it defaults straight to "create one named after this
 * deploy", exactly what used to happen implicitly.
 */
@Component({
  selector: 'app-workspace-choice-picker',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <label class="mb-1 block text-sm">{{ 'workspaceChoicePicker.label' | translate }}</label>

      @if (workspaces().length > 0) {
        <div class="flex gap-2 text-xs">
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 font-semibold transition-colors"
            [style.background]="mode() === 'new' ? 'var(--color-primary-500)' : 'var(--glass-bg-subtle)'"
            [style.color]="mode() === 'new' ? 'white' : 'var(--color-text-secondary)'"
            (click)="setMode('new')"
          >
            {{ 'workspaceChoicePicker.createNew' | translate }}
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 font-semibold transition-colors"
            [style.background]="mode() === 'existing' ? 'var(--color-primary-500)' : 'var(--glass-bg-subtle)'"
            [style.color]="mode() === 'existing' ? 'white' : 'var(--color-text-secondary)'"
            (click)="setMode('existing')"
          >
            {{ 'workspaceChoicePicker.useExisting' | translate }}
          </button>
        </div>
      }

      @if (mode() === 'existing' && workspaces().length > 0) {
        <select class="input" [ngModel]="selectedUuid()" (ngModelChange)="onExistingChange($event)">
          <option value="" disabled>{{ 'workspaceChoicePicker.choose' | translate }}</option>
          @for (ws of workspaces(); track ws.uuid) {
            <option [value]="ws.uuid">{{ ws.name }}</option>
          }
        </select>
        <p class="text-xs" style="color: var(--color-text-secondary)">
          {{ 'workspaceChoicePicker.existingHint' | translate }}
        </p>
      } @else {
        <input
          class="input"
          [ngModel]="newName()"
          (ngModelChange)="onNewNameChange($event)"
          [placeholder]="'workspaceChoicePicker.namePlaceholder' | translate"
        />
        <p class="text-xs" style="color: var(--color-text-secondary)">
          {{ 'workspaceChoicePicker.newHint' | translate }}
        </p>
      }
    </div>
  `,
})
export class WorkspaceChoicePickerComponent implements OnInit {
  private api = inject(ApiService);

  /** Prefills the "create new" name — typically the thing being deployed. */
  readonly suggestedName = input<string>('');

  readonly choiceChange = output<WorkspaceChoice | null>();

  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly selectedUuid = signal<string>('');
  protected readonly newName = signal<string>('');

  constructor() {
    // Keeps the suggested name in sync until the operator actually types
    // something of their own — after that, their input wins.
    effect(() => {
      const suggested = this.suggestedName();
      if (!this.touchedName) this.newName.set(suggested);
      this.emit();
    });
  }

  private touchedName = false;

  ngOnInit(): void {
    this.api.listWorkspaces().subscribe((list) => this.workspaces.set(list));
  }

  protected setMode(mode: 'new' | 'existing'): void {
    this.mode.set(mode);
    this.emit();
  }

  protected onExistingChange(uuid: string): void {
    this.selectedUuid.set(uuid);
    this.emit();
  }

  protected onNewNameChange(name: string): void {
    this.touchedName = true;
    this.newName.set(name);
    this.emit();
  }

  private emit(): void {
    if (this.mode() === 'existing') {
      const uuid = this.selectedUuid();
      this.choiceChange.emit(uuid ? { workspace_uuid: uuid } : null);
      return;
    }
    const name = this.newName().trim();
    this.choiceChange.emit(name ? { workspace_name: name } : null);
  }
}
