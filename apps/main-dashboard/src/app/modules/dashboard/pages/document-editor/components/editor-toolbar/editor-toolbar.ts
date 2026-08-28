import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SaveState } from '../../models/editor.types';

/**
 * Barre d'outils supérieure de l'éditeur : retour, titre, annuler/rétablir,
 * zoom, état de sauvegarde et enregistrement manuel. Chaque contrôle expose ses
 * états (hover/focus/disabled) et respecte le design system.
 */
@Component({
  selector: 'app-editor-toolbar',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-3 px-4 h-14 border-b border-[var(--glass-border)] bg-[var(--color-surface-2)]"
    >
      <button
        type="button"
        class="editor-icon-btn"
        (click)="exit.emit()"
        [attr.aria-label]="'dashboard.documentEditor.toolbar.back' | translate"
      >
        <i class="pi pi-arrow-left" aria-hidden="true"></i>
      </button>

      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold text-text-primary truncate">{{ title() }}</h1>
        <p class="text-xs text-text-tertiary truncate">
          {{ 'dashboard.documentEditor.toolbar.subtitle' | translate }}
        </p>
      </div>

      <!-- Annuler / Rétablir -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="editor-icon-btn"
          [disabled]="!canUndo()"
          (click)="undo.emit()"
          [attr.aria-label]="'dashboard.documentEditor.toolbar.undo' | translate"
          [title]="('dashboard.documentEditor.toolbar.undo' | translate) + ' (Ctrl+Z)'"
        >
          <i class="pi pi-undo" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="editor-icon-btn"
          [disabled]="!canRedo()"
          (click)="redo.emit()"
          [attr.aria-label]="'dashboard.documentEditor.toolbar.redo' | translate"
          [title]="('dashboard.documentEditor.toolbar.redo' | translate) + ' (Ctrl+Y)'"
        >
          <i class="pi pi-undo -scale-x-100" aria-hidden="true"></i>
        </button>
      </div>

      <div class="w-px h-6 bg-[var(--glass-border)]" role="separator"></div>

      <!-- Zoom -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="editor-icon-btn"
          (click)="zoomOut.emit()"
          [attr.aria-label]="'dashboard.documentEditor.toolbar.zoomOut' | translate"
        >
          <i class="pi pi-search-minus" aria-hidden="true"></i>
        </button>
        <span class="text-xs tabular-nums text-text-secondary w-10 text-center">{{ zoomPercent() }}%</span>
        <button
          type="button"
          class="editor-icon-btn"
          (click)="zoomIn.emit()"
          [attr.aria-label]="'dashboard.documentEditor.toolbar.zoomIn' | translate"
        >
          <i class="pi pi-search-plus" aria-hidden="true"></i>
        </button>
      </div>

      <div class="w-px h-6 bg-[var(--glass-border)]" role="separator"></div>

      <!-- État de sauvegarde -->
      <span class="text-xs min-w-24 text-right" [class]="saveClass()" aria-live="polite">
        {{ saveLabel() | translate }}
      </span>

      <button
        type="button"
        class="inner-button !py-2 !px-4 !text-xs !normal-case"
        [disabled]="saveState() === 'saving'"
        (click)="save.emit()"
      >
        <i class="pi pi-save" aria-hidden="true"></i>
        {{ 'dashboard.documentEditor.toolbar.save' | translate }}
      </button>
    </div>
  `,
  styles: [
    `
      .editor-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        color: var(--color-text-secondary);
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .editor-icon-btn:hover:not(:disabled) {
        background: var(--glass-bg-subtle);
        color: var(--color-text-primary);
      }
      .editor-icon-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .editor-icon-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `,
  ],
})
export class EditorToolbarComponent {
  readonly title = input<string>('');
  readonly canUndo = input<boolean>(false);
  readonly canRedo = input<boolean>(false);
  readonly saveState = input<SaveState>('idle');
  readonly zoom = input<number>(1);

  readonly undo = output<void>();
  readonly redo = output<void>();
  readonly save = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly exit = output<void>();

  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  protected readonly saveLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return 'dashboard.documentEditor.toolbar.saving';
      case 'saved':
        return 'dashboard.documentEditor.toolbar.saved';
      case 'error':
        return 'dashboard.documentEditor.toolbar.saveError';
      case 'dirty':
        return 'dashboard.documentEditor.toolbar.unsaved';
      default:
        return 'dashboard.documentEditor.toolbar.upToDate';
    }
  });

  protected readonly saveClass = computed(() => {
    switch (this.saveState()) {
      case 'error':
        return 'text-red-400';
      case 'saved':
        return 'text-emerald-400';
      case 'saving':
        return 'text-text-tertiary';
      default:
        return 'text-text-tertiary';
    }
  });
}
