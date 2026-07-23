import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EditorAttribute, EditorSelection } from '../../models/editor.types';

/**
 * Éditeur d'attributs générique : expose TOUS les attributs HTML de l'élément
 * sélectionné (class, style, src, href, data-*, id, …) pour les modifier,
 * en ajouter ou en supprimer. Couvre « n'importe quel paramètre présent dans
 * le code ». Les valeurs longues (class/style) utilisent une zone de texte.
 */
@Component({
  selector: 'app-attributes-panel',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="attr-root" open>
      <summary class="attr-summary">
        <span class="inspector-title-inline">
          <i class="pi pi-code" aria-hidden="true"></i>
          {{ 'dashboard.documentEditor.attrs.heading' | translate }}
        </span>
        <span class="attr-count">{{ rows().length }}</span>
      </summary>

      <div class="space-y-2 mt-3">
        @for (row of rows(); track row.name) {
          <div class="attr-row">
            <div class="flex items-center justify-between gap-2">
              <code class="attr-name">{{ row.name }}</code>
              <button
                type="button"
                class="attr-remove"
                (click)="removeAttr.emit(row.name)"
                [attr.aria-label]="('dashboard.documentEditor.attrs.remove' | translate) + ' ' + row.name"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
            @if (isLong(row.name)) {
              <textarea
                rows="2"
                class="attr-input"
                [value]="row.value"
                (input)="changeAttr.emit({ name: row.name, value: $any($event.target).value })"
                [attr.aria-label]="row.name"
              ></textarea>
            } @else {
              <input
                type="text"
                class="attr-input"
                [value]="row.value"
                (input)="changeAttr.emit({ name: row.name, value: $any($event.target).value })"
                [attr.aria-label]="row.name"
              />
            }
          </div>
        }
      </div>

      <!-- Ajout d'un attribut -->
      <div class="attr-add mt-3">
        <input
          type="text"
          class="attr-input"
          [value]="newName()"
          (input)="newName.set($any($event.target).value)"
          [placeholder]="'dashboard.documentEditor.attrs.name' | translate"
          [attr.aria-label]="'dashboard.documentEditor.attrs.name' | translate"
        />
        <input
          type="text"
          class="attr-input"
          [value]="newValue()"
          (input)="newValue.set($any($event.target).value)"
          [placeholder]="'dashboard.documentEditor.attrs.value' | translate"
          [attr.aria-label]="'dashboard.documentEditor.attrs.value' | translate"
        />
        <button type="button" class="outer-button !py-2 !px-3 !text-xs" [disabled]="!newName().trim()" (click)="add()">
          <i class="pi pi-plus" aria-hidden="true"></i>
          {{ 'dashboard.documentEditor.attrs.add' | translate }}
        </button>
      </div>
    </details>
  `,
  styles: [
    `
      .attr-summary {
        display: flex; align-items: center; justify-content: space-between;
        cursor: pointer; list-style: none;
      }
      .attr-summary::-webkit-details-marker { display: none; }
      .inspector-title-inline {
        display: flex; align-items: center; gap: 0.5rem;
        font-size: 0.8rem; font-weight: 600; color: var(--color-text-primary);
      }
      .attr-count {
        min-width: 1.4rem; height: 1.4rem; padding: 0 0.4rem; border-radius: 0.35rem;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--glass-bg-subtle); color: var(--color-text-tertiary);
        font-size: 0.7rem; font-variant-numeric: tabular-nums;
      }
      .attr-row { display: flex; flex-direction: column; gap: 0.3rem; }
      .attr-name {
        font-size: 0.72rem; color: var(--color-primary); font-weight: 600;
        overflow-wrap: anywhere;
      }
      .attr-input {
        width: 100%; padding: 0.4rem 0.55rem; min-height: 2rem;
        border-radius: 0.45rem; border: 1px solid var(--glass-border);
        background: var(--color-surface-1); color: var(--color-text-primary);
        font-size: 0.78rem; font-family: inherit; resize: vertical;
        transition: border-color 0.15s ease;
      }
      .attr-input:focus-visible { outline: none; border-color: var(--color-primary); }
      .attr-remove {
        display: inline-flex; align-items: center; justify-content: center;
        width: 1.5rem; height: 1.5rem; border-radius: 0.35rem; flex-shrink: 0;
        color: var(--color-text-tertiary); transition: all 0.15s ease;
      }
      .attr-remove:hover { background: var(--glass-bg-subtle); color: #f87171; }
      .attr-remove:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
      .attr-add { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.4rem; align-items: start; }
    `,
  ],
})
export class AttributesPanelComponent {
  readonly selection = input.required<EditorSelection>();

  readonly changeAttr = output<{ name: string; value: string }>();
  readonly addAttr = output<{ name: string; value: string }>();
  readonly removeAttr = output<string>();

  protected readonly rows = signal<EditorAttribute[]>([]);
  protected readonly newName = signal('');
  protected readonly newValue = signal('');

  constructor() {
    effect(() => {
      this.rows.set([...this.selection().attributes]);
    });
  }

  protected isLong(name: string): boolean {
    return name === 'class' || name === 'style';
  }

  protected add(): void {
    const name = this.newName().trim();
    if (!name) return;
    this.addAttr.emit({ name, value: this.newValue() });
    this.newName.set('');
    this.newValue.set('');
  }
}
