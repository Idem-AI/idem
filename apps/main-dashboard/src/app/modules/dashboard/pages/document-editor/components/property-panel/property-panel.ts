import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EditorSelection, ElementStyle } from '../../models/editor.types';

/**
 * Panneau de propriétés de l'élément sélectionné (édition structurée) : couleur
 * du texte et du fond, taille et graisse de police, alignement, opacité, plus
 * un réordonnancement accessible (monter/descendre) et la suppression.
 * Les changements sont appliqués en style inline via l'hôte.
 */
@Component({
  selector: 'app-property-panel',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Texte -->
      <div class="grid grid-cols-2 gap-3">
        <label class="prop-field">
          <span class="prop-label">{{ 'dashboard.documentEditor.props.textColor' | translate }}</span>
          <input
            type="color"
            class="prop-color"
            [value]="form().color || '#000000'"
            (input)="emitStyle('color', $any($event.target).value)"
          />
        </label>
        <label class="prop-field">
          <span class="prop-label">{{ 'dashboard.documentEditor.props.bgColor' | translate }}</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              class="prop-color flex-1"
              [value]="form().backgroundColor || '#ffffff'"
              (input)="emitStyle('backgroundColor', $any($event.target).value)"
            />
            <button
              type="button"
              class="prop-mini-btn"
              (click)="emitStyle('backgroundColor', 'transparent')"
              [title]="'dashboard.documentEditor.props.clearBg' | translate"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        </label>
      </div>

      <!-- Police -->
      <div class="grid grid-cols-2 gap-3">
        <label class="prop-field">
          <span class="prop-label">{{ 'dashboard.documentEditor.props.fontSize' | translate }}</span>
          <input
            type="number"
            min="6"
            max="200"
            class="prop-input"
            [value]="fontSizeNumber()"
            (input)="emitStyle('fontSize', $any($event.target).value + 'px')"
          />
        </label>
        <label class="prop-field">
          <span class="prop-label">{{ 'dashboard.documentEditor.props.fontWeight' | translate }}</span>
          <select
            class="prop-input"
            [value]="form().fontWeight || '400'"
            (change)="emitStyle('fontWeight', $any($event.target).value)"
          >
            <option value="300">Light</option>
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
            <option value="800">Extrabold</option>
          </select>
        </label>
      </div>

      <!-- Alignement -->
      <div class="prop-field">
        <span class="prop-label">{{ 'dashboard.documentEditor.props.align' | translate }}</span>
        <div class="flex gap-1" role="group" [attr.aria-label]="'dashboard.documentEditor.props.align' | translate">
          @for (a of aligns; track a.value) {
            <button
              type="button"
              class="prop-seg"
              [class.prop-seg-active]="(form().textAlign || 'left') === a.value"
              [attr.aria-pressed]="(form().textAlign || 'left') === a.value"
              (click)="emitStyle('textAlign', a.value)"
            >
              <i class="pi {{ a.icon }}" aria-hidden="true"></i>
            </button>
          }
        </div>
      </div>

      <!-- Opacité -->
      <label class="prop-field">
        <span class="prop-label">
          {{ 'dashboard.documentEditor.props.opacity' | translate }}
          <span class="text-text-tertiary tabular-nums">{{ opacityPercent() }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="w-full accent-[var(--color-primary)]"
          [value]="form().opacity || '1'"
          (input)="emitStyle('opacity', $any($event.target).value)"
        />
      </label>

      <div class="h-px bg-[var(--glass-border)]"></div>

      <!-- Arrangement -->
      <div class="prop-field">
        <span class="prop-label">{{ 'dashboard.documentEditor.props.arrange' | translate }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs flex-1"
            [disabled]="selection()!.index <= 0"
            (click)="reorder.emit('up')"
          >
            <i class="pi pi-arrow-up" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.moveUp' | translate }}
          </button>
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs flex-1"
            [disabled]="selection()!.index >= selection()!.siblingCount - 1"
            (click)="reorder.emit('down')"
          >
            <i class="pi pi-arrow-down" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.moveDown' | translate }}
          </button>
        </div>
        <button
          type="button"
          class="outer-button !py-2 !px-3 !text-xs w-full !text-red-400"
          (click)="remove.emit()"
        >
          <i class="pi pi-trash" aria-hidden="true"></i>
          {{ 'dashboard.documentEditor.props.delete' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .prop-field { display: flex; flex-direction: column; gap: 0.4rem; }
      .prop-label {
        display: flex; justify-content: space-between;
        font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.04em; color: var(--color-text-tertiary);
      }
      .prop-input {
        width: 100%; height: 2.25rem; padding: 0 0.6rem;
        border-radius: 0.5rem; border: 1px solid var(--glass-border);
        background: var(--color-surface-1); color: var(--color-text-primary);
        font-size: 0.85rem; transition: border-color 0.15s ease;
      }
      .prop-input:focus-visible { outline: none; border-color: var(--color-primary); }
      .prop-color {
        width: 100%; height: 2.25rem; padding: 2px; cursor: pointer;
        border-radius: 0.5rem; border: 1px solid var(--glass-border);
        background: var(--color-surface-1);
      }
      .prop-mini-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 2.25rem; height: 2.25rem; border-radius: 0.5rem;
        border: 1px solid var(--glass-border); color: var(--color-text-secondary);
        transition: background-color 0.15s ease;
      }
      .prop-mini-btn:hover { background: var(--glass-bg-subtle); }
      .prop-seg {
        flex: 1; height: 2.25rem; border-radius: 0.5rem;
        border: 1px solid var(--glass-border); color: var(--color-text-secondary);
        transition: all 0.15s ease;
      }
      .prop-seg:hover { background: var(--glass-bg-subtle); }
      .prop-seg-active {
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        border-color: var(--color-primary); color: var(--color-primary);
      }
      .prop-seg:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    `,
  ],
})
export class PropertyPanelComponent {
  readonly selection = input.required<EditorSelection>();

  readonly styleChange = output<ElementStyle>();
  readonly reorder = output<'up' | 'down'>();
  readonly remove = output<void>();

  protected readonly aligns = [
    { value: 'left', icon: 'pi-align-left' },
    { value: 'center', icon: 'pi-align-center' },
    { value: 'right', icon: 'pi-align-right' },
    { value: 'justify', icon: 'pi-align-justify' },
  ];

  /** Copie locale éditable, réinitialisée à chaque changement de sélection. */
  protected readonly form = signal<ElementStyle>({});

  constructor() {
    effect(() => {
      const sel = this.selection();
      this.form.set(this.normalize(sel.style));
    });
  }

  protected fontSizeNumber(): number {
    return Math.round(parseFloat(this.form().fontSize || '16')) || 16;
  }

  protected opacityPercent(): number {
    return Math.round((parseFloat(this.form().opacity || '1') || 1) * 100);
  }

  protected emitStyle<K extends keyof ElementStyle>(key: K, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
    this.styleChange.emit({ [key]: value } as ElementStyle);
  }

  /** Convertit les couleurs rgb() en hex pour les <input type="color">. */
  private normalize(style: ElementStyle): ElementStyle {
    return {
      ...style,
      color: this.toHex(style.color),
      backgroundColor: this.toHex(style.backgroundColor),
    };
  }

  private toHex(value?: string): string | undefined {
    if (!value) return value;
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return value;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length < 3) return value;
    const hex = parts
      .slice(0, 3)
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  }
}
