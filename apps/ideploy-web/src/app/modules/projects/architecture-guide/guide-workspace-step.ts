import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { GuideSessionService } from '../../../shared/services/guide-session.service';
import {
  WorkspaceChoice,
  WorkspaceChoicePickerComponent,
} from '../../../shared/components/workspace-choice-picker/workspace-choice-picker';

/**
 * First inline step of the architecture guide: land on a real workspace
 * before anything else can be created, without leaving this page.
 *
 * The questions themselves — IDEM's servers or yours, then which workspace —
 * are the shared `<app-workspace-choice-picker>`, the same one the Git import
 * asks, so the two flows can't drift apart again. This step only turns the
 * answer into a workspace and hands it to the guide session.
 */
@Component({
  selector: 'app-guide-workspace-step',
  imports: [TranslateModule, IdemLoaderComponent, WorkspaceChoicePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <app-workspace-choice-picker [suggestedName]="suggestedName()" [preferExisting]="true" (choiceChange)="choice.set($event)" />

      @if (error()) {
        <p class="text-sm" style="color:var(--color-danger);">{{ error() }}</p>
      }

      <div class="flex justify-end">
        <button class="inner-button" type="button" [disabled]="saving() || !choice()" (click)="continue()">
          @if (saving()) { <idem-loader size="xs" /> }
          {{ (saving() ? 'workspaces.form.creating' : 'projects.new.continue') | translate }}
        </button>
      </div>
    </div>
  `,
})
export class GuideWorkspaceStepComponent {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private guideSession = inject(GuideSessionService);

  readonly architectureId = input.required<string>();
  readonly suggestedName = input<string>('');
  readonly completed = output<void>();

  protected readonly choice = signal<WorkspaceChoice | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected continue(): void {
    const choice = this.choice();
    if (!choice) return;

    if (choice.workspace_uuid) {
      this.guideSession.setWorkspace(this.architectureId(), choice.workspace_uuid, choice.label);
      this.completed.emit();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api
      .createWorkspace({
        name: choice.label,
        deployment_type: choice.deployment_type ?? 'saas',
        region: choice.region,
        server_uuid: choice.server_uuid,
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
