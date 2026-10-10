import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EditorTranslatePipe } from '../../i18n/editor-translate.pipe';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/**
 * Panneau d'édition assistée par IA : l'utilisateur décrit en langage naturel la
 * modification voulue sur la section sélectionnée. Le backend applique
 * l'instruction en tenant compte du contexte projet centralisé (Context Engine).
 */
@Component({
  selector: 'app-ai-edit-panel',
  imports: [ReactiveFormsModule, EditorTranslatePipe, IdemLoaderComponent],
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
            {{ 'ai.title' | idemEditorT }}
          </p>
          <p class="text-xs text-text-tertiary truncate">{{ sectionName() }}</p>
        </div>
      </div>

      <label class="sr-only" for="ai-instruction">{{ 'ai.title' | idemEditorT }}</label>
      <textarea
        id="ai-instruction"
        rows="3"
        class="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-1)] text-text-primary text-sm p-2.5 resize-none focus-visible:outline-none focus-visible:border-[var(--color-primary)]"
        [formControl]="instruction"
        [placeholder]="'ai.placeholder' | idemEditorT"
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
          <idem-loader size="xs" />
          {{ 'ai.working' | idemEditorT }}
        } @else {
          <i class="pi pi-sparkles" aria-hidden="true"></i>
          {{ 'ai.apply' | idemEditorT }}
        }
      </button>

      <p class="text-[0.7rem] text-text-tertiary leading-snug">
        <i class="pi pi-info-circle mr-1" aria-hidden="true"></i>
        {{ 'ai.hint' | idemEditorT }}
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
