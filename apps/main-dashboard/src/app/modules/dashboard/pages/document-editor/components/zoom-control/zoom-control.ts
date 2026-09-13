import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Paliers proposés dans le menu du zoom. */
const MENU_PRESETS: readonly number[] = [0.5, 0.75, 1, 1.5, 2];

/**
 * Contrôle de zoom de l'espace de travail : − / pourcentage / +. Le pourcentage
 * ouvre un menu (ajuster à la largeur, paliers). Partagé par la barre d'outils
 * de l'éditeur et le dock de l'aperçu ; `menuPlacement` ouvre le menu vers le
 * bas (barre en haut d'écran) ou vers le haut (dock en bas).
 */
@Component({
  selector: 'app-zoom-control',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'zoom-control',
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '(keydown.escape)': 'closeMenu()',
  },
  template: `
    <button
      type="button"
      class="zc-btn"
      (click)="zoomOut.emit()"
      [attr.aria-label]="'dashboard.documentEditor.toolbar.zoomOut' | translate"
      [title]="('dashboard.documentEditor.toolbar.zoomOut' | translate) + ' (Ctrl −)'"
    >
      <i class="pi pi-minus" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="zc-value"
      aria-haspopup="menu"
      [attr.aria-expanded]="menuOpen()"
      [attr.aria-label]="'dashboard.documentEditor.zoom.menu' | translate: { value: percent() }"
      (click)="menuOpen.set(!menuOpen())"
    >
      <span class="tabular-nums">{{ percent() }}%</span>
      <i class="pi pi-angle-down text-[0.65rem]" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="zc-btn"
      (click)="zoomIn.emit()"
      [attr.aria-label]="'dashboard.documentEditor.toolbar.zoomIn' | translate"
      [title]="('dashboard.documentEditor.toolbar.zoomIn' | translate) + ' (Ctrl +)'"
    >
      <i class="pi pi-plus" aria-hidden="true"></i>
    </button>

    @if (menuOpen()) {
      <div class="zc-menu" [class.zc-menu-up]="menuPlacement() === 'top'" role="menu">
        <button type="button" role="menuitemradio" class="zc-item" [attr.aria-checked]="fitting()" (click)="choose(null)">
          <i class="pi pi-arrows-h" aria-hidden="true"></i>
          <span class="flex-1">{{ 'dashboard.documentEditor.zoom.fitWidth' | translate }}</span>
          <kbd class="zc-kbd">Ctrl 0</kbd>
        </button>
        <div class="zc-sep" role="separator"></div>
        @for (preset of presets; track preset) {
          <button
            type="button"
            role="menuitemradio"
            class="zc-item"
            [attr.aria-checked]="!fitting() && isCurrent(preset)"
            (click)="choose(preset)"
          >
            <i class="pi pi-check" [class.invisible]="fitting() || !isCurrent(preset)" aria-hidden="true"></i>
            <span class="flex-1 tabular-nums">{{ preset * 100 }}%</span>
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.125rem;
      }
      .zc-btn,
      .zc-value {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2.25rem;
        border-radius: 0.6rem;
        color: var(--color-text-secondary);
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .zc-btn { width: 2.25rem; }
      .zc-value { gap: 0.3rem; min-width: 4.25rem; padding: 0 0.5rem; font-size: 0.8rem; font-weight: 600; }
      .zc-btn:hover,
      .zc-value:hover,
      .zc-value[aria-expanded='true'] {
        background: var(--glass-bg-subtle);
        color: var(--color-text-primary);
      }
      .zc-btn:focus-visible,
      .zc-value:focus-visible,
      .zc-item:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .zc-menu {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 50%;
        transform: translateX(-50%);
        z-index: 60;
        min-width: 13rem;
        padding: 0.35rem;
        border-radius: 0.9rem;
        border: 1px solid var(--glass-border);
        background: var(--color-surface-2);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      }
      .zc-menu-up { top: auto; bottom: calc(100% + 0.75rem); }
      .zc-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.5rem 0.65rem;
        border-radius: 0.55rem;
        font-size: 0.82rem;
        text-align: left;
        color: var(--color-text-secondary);
      }
      .zc-item:hover { background: var(--glass-bg-subtle); color: var(--color-text-primary); }
      /* Bleu mêlé au texte : contraste AA sur la surface sombre comme sur la claire. */
      .zc-item[aria-checked='true'] {
        color: color-mix(in srgb, var(--color-primary) 55%, var(--color-text-primary));
        font-weight: 600;
      }
      .zc-sep { height: 1px; margin: 0.3rem 0.4rem; background: var(--glass-border); }
      .zc-kbd {
        font-size: 0.65rem;
        padding: 0.05rem 0.35rem;
        border-radius: 0.3rem;
        border: 1px solid var(--glass-border);
        color: var(--color-text-tertiary);
      }
      /* Très petit écran : le pincement remplace − et + ; le menu reste. */
      @media (max-width: 480px) {
        .zc-btn { display: none; }
        .zc-kbd { display: none; }
      }
    `,
  ],
})
export class ZoomControlComponent {
  readonly zoom = input<number>(1);
  readonly fitting = input<boolean>(false);
  readonly menuPlacement = input<'top' | 'bottom'>('bottom');

  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fitWidth = output<void>();
  readonly zoomTo = output<number>();

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly presets = MENU_PRESETS;
  protected readonly menuOpen = signal(false);
  protected readonly percent = computed(() => Math.round(this.zoom() * 100));

  protected isCurrent(preset: number): boolean {
    return Math.abs(preset - this.zoom()) < 0.005;
  }

  protected choose(preset: number | null): void {
    if (preset === null) this.fitWidth.emit();
    else this.zoomTo.emit(preset);
    this.menuOpen.set(false);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onOutsidePointer(event: PointerEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
