import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Panneau d'édition assistée par IA : l'utilisateur décrit en langage naturel la
 * modification voulue sur la section sélectionnée. Le backend applique
 * l'instruction en tenant compte du contexte projet centralisé (Context Engine).
 */
@Component({
  selector: 'app-ai-edit-panel',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] p-3 space-y-3">
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]"
        >
          <i class="pi pi-sparkles text-sm" aria-hidden="true"></i>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary leading-tight">
            {{ 'dashboard.documentEditor.ai.title' | translate }}
          </p>
          <p class="text-xs text-text-tertiary truncate">{{ sectionName() }}</p>
        </div>
      </div>

      <label class="sr-only" for="ai-instruction">{{ 'dashboard.documentEditor.ai.title' | translate }}</label>
      <textarea
        id="ai-instruction"
        rows="3"
        class="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-1)] text-text-primary text-sm p-2.5 resize-none focus-visible:outline-none focus-visible:border-[var(--color-primary)]"
        [formControl]="instruction"
        [placeholder]="'dashboard.documentEditor.ai.placeholder' | translate"
        [attr.disabled]="loading() ? true : null"
        (keydown.control.enter)="onSubmit()"
        (keydown.meta.enter)="onSubmit()"
      ></textarea>

      <button
        type="button"
        class="inner-button w-full !py-2.5 !text-xs !normal-case"
        [disabled]="instruction.invalid || loading()"
        (click)="onSubmit()"
      >
        @if (loading()) {
          <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          {{ 'dashboard.documentEditor.ai.working' | translate }}
        } @else {
          <i class="pi pi-sparkles" aria-hidden="true"></i>
          {{ 'dashboard.documentEditor.ai.apply' | translate }}
        }
      </button>

      <p class="text-[0.7rem] text-text-tertiary leading-snug">
        <i class="pi pi-info-circle mr-1" aria-hidden="true"></i>
        {{ 'dashboard.documentEditor.ai.hint' | translate }}
      </p>
    </div>
  `,
})
export class AiEditPanelComponent {
  readonly sectionName = input<string>('');
  readonly loading = input<boolean>(false);
  readonly submitInstruction = output<string>();

  protected readonly instruction = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  protected onSubmit(): void {
    if (this.instruction.invalid || this.loading()) return;
    this.submitInstruction.emit(this.instruction.value.trim());
  }

  reset(): void {
    this.instruction.reset('');
  }
}
