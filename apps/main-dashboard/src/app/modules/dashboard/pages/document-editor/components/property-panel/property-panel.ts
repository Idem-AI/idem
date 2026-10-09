import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EditorSelection, ElementStyle } from '../../models/editor.types';

/**
 * Panneau de propriétés de l'élément sélectionné (édition structurée) : couleur
 * du texte et du fond, taille et graisse de police, alignement, opacité, plus
 * les commandes de canevas : placement libre, dimensions, cadre et ordre des
 * calques. Les changements sont appliqués en style inline via l'hôte.
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
          <span class="prop-label">{{
            'dashboard.documentEditor.props.textColor' | translate
          }}</span>
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
          <span class="prop-label">{{
            'dashboard.documentEditor.props.fontSize' | translate
          }}</span>
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
          <span class="prop-label">{{
            'dashboard.documentEditor.props.fontWeight' | translate
          }}</span>
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
        <div
          class="flex gap-1"
          role="group"
          [attr.aria-label]="'dashboard.documentEditor.props.align' | translate"
        >
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

      <!-- Placement libre : les coordonnées restent relatives au contenant du visuel. -->
      <div class="prop-field">
        <div class="flex items-center justify-between gap-3">
          <span class="prop-label">{{
            'dashboard.documentEditor.props.position' | translate
          }}</span>
          <button
            type="button"
            class="prop-toggle"
            [class.prop-toggle-active]="isFreePosition()"
            [disabled]="isDocumentRoot()"
            [attr.aria-pressed]="isFreePosition()"
            (click)="toggleFreePosition()"
          >
            <i class="pi pi-arrows-alt" aria-hidden="true"></i>
            {{
              (isFreePosition()
                ? 'dashboard.documentEditor.props.flowPosition'
                : 'dashboard.documentEditor.props.freePosition'
              ) | translate
            }}
          </button>
        </div>
        @if (isFreePosition()) {
          <div class="grid grid-cols-2 gap-3">
            <label class="prop-field">
              <span class="prop-label">{{ 'dashboard.documentEditor.props.x' | translate }}</span>
              <input
                type="number"
                class="prop-input"
                [value]="lengthNumber('left')"
                (change)="emitPixels('left', $any($event.target).value)"
              />
            </label>
            <label class="prop-field">
              <span class="prop-label">{{ 'dashboard.documentEditor.props.y' | translate }}</span>
              <input
                type="number"
                class="prop-input"
                [value]="lengthNumber('top')"
                (change)="emitPixels('top', $any($event.target).value)"
              />
            </label>
          </div>
          <p class="prop-help">{{ 'dashboard.documentEditor.props.dragHint' | translate }}</p>
        }
      </div>

      <!-- Dimensions, rayon et bordure : les mêmes réglages pour tous les livrables. -->
      <div class="prop-field">
        <span class="prop-label">{{ 'dashboard.documentEditor.props.size' | translate }}</span>
        <div class="grid grid-cols-2 gap-3">
          <label class="prop-field">
            <span class="prop-label">{{ 'dashboard.documentEditor.props.width' | translate }}</span>
            <input
              type="number"
              min="1"
              class="prop-input"
              [value]="lengthNumber('width')"
              (change)="emitPixels('width', $any($event.target).value)"
            />
          </label>
          <label class="prop-field">
            <span class="prop-label">{{
              'dashboard.documentEditor.props.height' | translate
            }}</span>
            <input
              type="number"
              min="1"
              class="prop-input"
              [value]="lengthNumber('height')"
              (change)="emitPixels('height', $any($event.target).value)"
            />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="prop-field">
            <span class="prop-label">{{
              'dashboard.documentEditor.props.radius' | translate
            }}</span>
            <input
              type="number"
              min="0"
              class="prop-input"
              [value]="lengthNumber('borderRadius')"
              (change)="emitPixels('borderRadius', $any($event.target).value)"
            />
          </label>
          <label class="prop-field">
            <span class="prop-label">{{
              'dashboard.documentEditor.props.border' | translate
            }}</span>
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="0"
                class="prop-input min-w-0"
                [value]="lengthNumber('borderWidth')"
                (change)="emitPixels('borderWidth', $any($event.target).value)"
              />
              <input
                type="color"
                class="prop-color prop-color-mini"
                [value]="form().borderColor || '#000000'"
                (input)="emitStyle('borderColor', $any($event.target).value)"
                [attr.aria-label]="'dashboard.documentEditor.props.borderColor' | translate"
              />
            </div>
          </label>
        </div>
      </div>

      <div class="h-px bg-[var(--glass-border)]"></div>

      <!-- Calques : ordre visuel indépendant de l'ordre sémantique du HTML. -->
      <div class="prop-field">
        <span class="prop-label">{{ 'dashboard.documentEditor.props.layers' | translate }}</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs"
            (click)="setLayer('front')"
          >
            <i class="pi pi-angle-double-up" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.bringToFront' | translate }}
          </button>
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs"
            (click)="setLayer('back')"
          >
            <i class="pi pi-angle-double-down" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.sendToBack' | translate }}
          </button>
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs"
            (click)="setLayer('forward')"
          >
            <i class="pi pi-angle-up" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.bringForward' | translate }}
          </button>
          <button
            type="button"
            class="outer-button !py-2 !px-3 !text-xs"
            (click)="setLayer('backward')"
          >
            <i class="pi pi-angle-down" aria-hidden="true"></i>
            {{ 'dashboard.documentEditor.props.sendBackward' | translate }}
          </button>
        </div>
        <label class="prop-field">
          <span class="prop-label">{{ 'dashboard.documentEditor.props.layer' | translate }}</span>
          <input
            type="number"
            class="prop-input"
            [value]="layerNumber()"
            (change)="setLayerValue($any($event.target).value)"
          />
        </label>
      </div>

      <!-- Ordre du contenu dans le flux, conservé pour les documents texte. -->
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
      .prop-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .prop-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .prop-input {
        width: 100%;
        height: 2.25rem;
        padding: 0 0.6rem;
        border-radius: 0.5rem;
        border: 1px solid var(--glass-border);
        background: var(--color-surface-1);
        color: var(--color-text-primary);
        font-size: 0.85rem;
        transition: border-color 0.15s ease;
      }
      .prop-input:focus-visible {
        outline: none;
        border-color: var(--color-primary);
      }
      .prop-color {
        width: 100%;
        height: 2.25rem;
        padding: 2px;
        cursor: pointer;
        border-radius: 0.5rem;
        border: 1px solid var(--glass-border);
        background: var(--color-surface-1);
      }
      .prop-color-mini {
        width: 2.6rem;
        flex: 0 0 2.6rem;
      }
      .prop-mini-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--glass-border);
        color: var(--color-text-secondary);
        transition: background-color 0.15s ease;
      }
      .prop-mini-btn:hover {
        background: var(--glass-bg-subtle);
      }
      .prop-seg {
        flex: 1;
        height: 2.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--glass-border);
        color: var(--color-text-secondary);
        transition: all 0.15s ease;
      }
      .prop-seg:hover {
        background: var(--glass-bg-subtle);
      }
      .prop-seg-active {
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .prop-seg:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .prop-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        min-height: 2rem;
        padding: 0 0.65rem;
        border: 1px solid var(--glass-border);
        border-radius: 0.5rem;
        color: var(--color-text-secondary);
        font-size: 0.72rem;
        font-weight: 600;
        transition: all 0.15s ease;
      }
      .prop-toggle:hover:not(:disabled) {
        background: var(--glass-bg-subtle);
      }
      .prop-toggle:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .prop-toggle-active {
        color: var(--color-primary);
        border-color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      }
      .prop-help {
        font-size: 0.72rem;
        line-height: 1.35;
        color: var(--color-text-tertiary);
      }
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

  private readonly pixelKeys = [
    'left',
    'top',
    'width',
    'height',
    'borderRadius',
    'borderWidth',
  ] as const;

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

  protected isDocumentRoot(): boolean {
    return this.selection().path === '';
  }

  protected isFreePosition(): boolean {
    return this.form().position === 'absolute';
  }

  protected lengthNumber(key: (typeof this.pixelKeys)[number]): number {
    const value = parseFloat(this.form()[key] || '0');
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }

  protected layerNumber(): number {
    const value = parseInt(this.form().zIndex || '0', 10);
    return Number.isFinite(value) ? value : 0;
  }

  protected toggleFreePosition(): void {
    if (this.isDocumentRoot()) return;
    if (this.isFreePosition()) {
      this.emitStyles({ position: '', left: '', top: '' });
      return;
    }
    this.emitStyles({
      position: 'absolute',
      left: `${this.lengthNumber('left')}px`,
      top: `${this.lengthNumber('top')}px`,
    });
  }

  protected emitPixels(key: (typeof this.pixelKeys)[number], rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const minimum = key === 'width' || key === 'height' ? 1 : 0;
    this.emitStyle(key, `${Math.max(minimum, value)}px`);
  }

  protected setLayer(direction: 'front' | 'back' | 'forward' | 'backward'): void {
    const current = this.layerNumber();
    const zIndex =
      direction === 'front'
        ? 100
        : direction === 'back'
          ? 0
          : direction === 'forward'
            ? current + 1
            : Math.max(0, current - 1);
    this.emitStyles({
      // z-index ne crée un calque que sur un élément positionné. `relative`
      // conserve sa place dans le flux pour les documents à mise en page texte.
      position: this.isFreePosition() ? 'absolute' : 'relative',
      zIndex: String(zIndex),
    });
  }

  protected setLayerValue(rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    this.emitStyles({
      position: this.isFreePosition() ? 'absolute' : 'relative',
      zIndex: String(Math.round(value)),
    });
  }

  protected emitStyle<K extends keyof ElementStyle>(key: K, value: string): void {
    this.emitStyles({ [key]: value } as ElementStyle);
  }

  private emitStyles(style: ElementStyle): void {
    this.form.update((form) => ({ ...form, ...style }));
    this.styleChange.emit(style);
  }

  /** Convertit les couleurs rgb() en hex pour les <input type="color">. */
  private normalize(style: ElementStyle): ElementStyle {
    return {
      ...style,
      color: this.toHex(style.color),
      backgroundColor: this.toHex(style.backgroundColor),
      borderColor: this.toHex(style.borderColor),
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
      .map((n) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
    return `#${hex}`;
  }
}
