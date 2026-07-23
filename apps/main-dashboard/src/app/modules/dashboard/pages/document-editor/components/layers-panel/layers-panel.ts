import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EditableSection } from '../../models/editor.types';

/**
 * Panneau latéral gauche : arborescence des pages/sections du document. Cliquer
 * une page y défile et la sélectionne (support de l'édition IA au niveau
 * section). Sert de « couches » du document.
 */
@Component({
  selector: 'app-layers-panel',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="p-3" [attr.aria-label]="'dashboard.documentEditor.layers.title' | translate">
      <p class="px-2 pb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-text-tertiary">
        {{ 'dashboard.documentEditor.layers.pages' | translate }} ({{ sections().length }})
      </p>
      <ul class="space-y-1">
        @for (section of sections(); track section.id; let i = $index) {
          <li>
            <button
              type="button"
              class="layer-item"
              [class.layer-item-active]="section.id === activeSectionId()"
              [attr.aria-current]="section.id === activeSectionId() ? 'true' : null"
              (click)="selectSection.emit(section.id)"
            >
              <span class="layer-index">{{ i + 1 }}</span>
              <span class="truncate">{{ section.name }}</span>
            </button>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [
    `
      .layer-item {
        display: flex; align-items: center; gap: 0.6rem; width: 100%;
        padding: 0.5rem 0.6rem; border-radius: 0.5rem; text-align: left;
        font-size: 0.85rem; color: var(--color-text-secondary);
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .layer-item:hover { background: var(--glass-bg-subtle); color: var(--color-text-primary); }
      .layer-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
      .layer-item-active {
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        color: var(--color-primary); font-weight: 600;
      }
      .layer-index {
        display: inline-flex; align-items: center; justify-content: center;
        width: 1.4rem; height: 1.4rem; border-radius: 0.35rem; flex-shrink: 0;
        background: var(--glass-bg-subtle); color: var(--color-text-tertiary);
        font-size: 0.7rem; font-variant-numeric: tabular-nums;
      }
      .layer-item-active .layer-index {
        background: var(--color-primary); color: #fff;
      }
    `,
  ],
})
export class LayersPanelComponent {
  readonly sections = input<EditableSection[]>([]);
  readonly activeSectionId = input<string | null>(null);
  readonly selectSection = output<string>();
}
