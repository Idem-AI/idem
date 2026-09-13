import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SaveState } from '../../models/editor.types';
import { ZoomControlComponent } from '../zoom-control/zoom-control';

/**
 * Barre d'outils supérieure de l'éditeur : retour, pages, titre,
 * annuler/rétablir, zoom, état de sauvegarde et enregistrement manuel. Sur
 * petit écran, les libellés cèdent la place aux icônes (l'état de sauvegarde
 * devient une pastille) pour que chaque contrôle reste atteignable.
 */
@Component({
  selector: 'app-editor-toolbar',
  imports: [TranslateModule, ZoomControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-14 border-b border-[var(--glass-border)] bg-[var(--color-surface-2)]"
    >
      <button
        type="button"
        class="editor-icon-btn"
        (click)="exit.emit()"
        [attr.aria-label]="'dashboard.documentEditor.toolbar.back' | translate"
      >
        <i class="pi pi-arrow-left" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="editor-icon-btn"
        [class.editor-icon-btn-active]="layersOpen()"
        aria-controls="editor-layers"
        [attr.aria-expanded]="layersOpen()"
        [attr.aria-label]="'dashboard.documentEditor.toolbar.pages' | translate"
        [title]="'dashboard.documentEditor.toolbar.pages' | translate"
        (click)="toggleLayers.emit()"
      >
        <i class="pi pi-clone" aria-hidden="true"></i>
      </button>

      <div class="min-w-0 flex-1 px-1">
        <h1 class="text-sm font-semibold text-text-primary truncate">{{ title() }}</h1>
        <p class="hidden sm:block text-xs text-text-tertiary truncate">
          {{ 'dashboard.documentEditor.toolbar.subtitle' | translate }}
        </p>
      </div>

      <!-- Annuler / Rétablir -->
      <div class="flex items-center">
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

      <div class="hidden md:block w-px h-6 bg-[var(--glass-border)]" role="separator"></div>

      <app-zoom-control
        [zoom]="zoom()"
        [fitting]="fitting()"
        menuPlacement="bottom"
        (zoomIn)="zoomIn.emit()"
        (zoomOut)="zoomOut.emit()"
        (fitWidth)="fitWidth.emit()"
        (zoomTo)="zoomTo.emit($event)"
      />

      <div class="hidden md:block w-px h-6 bg-[var(--glass-border)]" role="separator"></div>

      <!-- État de sauvegarde : texte sur grand écran, pastille sinon -->
      <span class="hidden md:inline text-xs min-w-24 text-right" [class]="saveClass()" aria-live="polite">
        {{ saveLabel() | translate }}
      </span>
      <span
        class="md:hidden inline-block w-2 h-2 rounded-full mx-1"
        [class]="saveDotClass()"
        [title]="saveLabel() | translate"
      >
        <span class="sr-only">{{ saveLabel() | translate }}</span>
      </span>

      <button
        type="button"
        class="inner-button !py-2 !px-3 sm:!px-4 !text-xs !normal-case"
        [disabled]="saveState() === 'saving'"
        [attr.aria-label]="'dashboard.documentEditor.toolbar.save' | translate"
        (click)="save.emit()"
      >
        <i class="pi pi-save" aria-hidden="true"></i>
        <span class="hidden sm:inline">{{ 'dashboard.documentEditor.toolbar.save' | translate }}</span>
      </button>
    </div>
  `,
  styles: [
    `
      .editor-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
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
      .editor-icon-btn-active {
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        color: var(--color-primary);
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
  readonly fitting = input<boolean>(false);
  readonly layersOpen = input<boolean>(false);

  readonly undo = output<void>();
  readonly redo = output<void>();
  readonly save = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fitWidth = output<void>();
  readonly zoomTo = output<number>();
  readonly toggleLayers = output<void>();
  readonly exit = output<void>();

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
      default:
        return 'text-text-tertiary';
    }
  });

  protected readonly saveDotClass = computed(() => {
    switch (this.saveState()) {
      case 'error':
        return 'bg-red-400';
      case 'dirty':
      case 'saving':
        return 'bg-amber-400';
      default:
        return 'bg-emerald-400';
    }
  });
}
