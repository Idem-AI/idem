import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type PdfFormat = 'A4_PORTRAIT' | 'SLIDE_16_9';

interface FormatOption {
  id: PdfFormat;
  key: 'a4Portrait' | 'landscape';
  size: string;
  recommended: boolean;
}

/**
 * Choix du format de la charte, avant sa génération.
 *
 * De vrais boutons radio (masqués visuellement) portent la sélection : clavier
 * et lecteur d'écran natifs. Le format recommandé est présélectionné — on peut
 * lancer la génération sans rien toucher.
 *
 * Illustrations au trait, dans le code (cf. AGENTS.md § 4) : `currentColor`
 * pour le trait, `--color-primary-500` pour le seul détail qui compte — le
 * signe de la marque sur la page.
 */
@Component({
  selector: 'app-pdf-format-selector',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Pas de <fieldset> : le design system l'encadre, ce qui posait une carte
         autour des cartes. Le groupe radio est porté par l'ARIA. -->
    <div role="radiogroup" [attr.aria-label]="'dashboard.showBranding.formatSelector.title' | translate">

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        @for (option of options; track option.id) {
          <label
            class="format-card glass-card group relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-colors"
            [class.is-selected]="selectedFormat() === option.id"
          >
            <input
              type="radio"
              name="charter-format"
              class="sr-only"
              [value]="option.id"
              [checked]="selectedFormat() === option.id"
              (change)="selectedFormat.set(option.id)"
            />

            <!-- Illustration -->
            <div
              class="h-48 rounded-xl flex items-center justify-center bg-[var(--glass-bg-subtle)] text-text-tertiary"
              aria-hidden="true"
            >
              @if (option.id === 'A4_PORTRAIT') {
                <svg
                  class="h-40 w-auto motion-safe:transition-transform motion-safe:duration-300 group-hover:-translate-y-1"
                  viewBox="0 0 220 170"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <!-- Page suivante, en retrait : un document qui se feuillette -->
                  <g transform="rotate(-7 88 90)" opacity="0.6">
                    <rect x="46" y="22" width="92" height="130" rx="3" />
                    <path d="M58 40 H104 M58 48 H92" />
                    <rect x="58" y="62" width="68" height="44" rx="2" />
                    <path d="M58 118 H126 M58 125 H120 M58 132 H106" />
                  </g>
                  <!-- Page de charte au premier plan, format A4 -->
                  <rect x="96" y="14" width="98" height="140" rx="3" />
                  <!-- Le signe de la marque -->
                  <g stroke="var(--color-primary-500)" stroke-width="2">
                    <circle cx="116" cy="36" r="9" />
                    <path d="M111.5 36 L115 39.5 L121 33.5" />
                  </g>
                  <path d="M132 32 H178" stroke-width="2.5" />
                  <path d="M132 41 H164" stroke-width="2" />
                  <!-- Nuancier -->
                  <circle cx="113" cy="68" r="7" />
                  <circle cx="132" cy="68" r="7" />
                  <circle cx="151" cy="68" r="7" />
                  <circle cx="170" cy="68" r="7" />
                  <!-- Paragraphes -->
                  <path d="M108 92 H182 M108 99 H182 M108 106 H170" />
                  <path d="M108 120 H182 M108 127 H176 M108 134 H150" opacity="0.75" />
                </svg>
              } @else {
                <svg
                  class="h-40 w-auto motion-safe:transition-transform motion-safe:duration-300 group-hover:-translate-y-1"
                  viewBox="0 0 220 170"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <!-- L'écran et son pied -->
                  <rect x="14" y="16" width="192" height="118" rx="6" />
                  <path d="M96 134 L92 152 M124 134 L128 152 M80 152 H140" />
                  <!-- La diapositive 16:9 -->
                  <rect x="26" y="27" width="168" height="94" rx="2" opacity="0.7" />
                  <!-- Grand titre -->
                  <path d="M40 48 H112" stroke-width="2.5" />
                  <path d="M40 58 H96" stroke-width="2" />
                  <path d="M40 74 H104 M40 81 H100 M40 88 H90" opacity="0.75" />
                  <!-- Nuancier en bandes -->
                  <path d="M40 104 H58 M64 104 H82 M88 104 H106" stroke-width="4" />
                  <!-- Cadre d'image, avec le signe de la marque -->
                  <rect x="124" y="40" width="56" height="68" rx="2" />
                  <g stroke="var(--color-primary-500)" stroke-width="2">
                    <circle cx="152" cy="68" r="11" />
                    <path d="M146.5 68 L150.5 72 L158 64.5" />
                  </g>
                  <path d="M132 98 L144 88 L152 94 L162 84 L172 98" opacity="0.75" />
                </svg>
              }
            </div>

            <!-- Texte -->
            <div class="mt-4 px-1 flex-1 flex flex-col">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg font-semibold text-text-primary">
                  {{ 'dashboard.showBranding.formatSelector.' + option.key + '.title' | translate }}
                </span>
                @if (option.recommended) {
                  <span
                    class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500 text-[var(--color-on-primary)]"
                  >
                    {{ 'dashboard.showBranding.dialog.recommended' | translate }}
                  </span>
                }
              </div>
              <span class="text-sm text-text-tertiary mt-0.5">{{ option.size }}</span>
              <span class="text-sm text-text-secondary mt-2">
                {{ 'dashboard.showBranding.formatSelector.' + option.key + '.description' | translate }}
              </span>
              <ul class="mt-3 space-y-1.5">
                @for (use of [0, 1]; track use) {
                  <li class="flex items-start gap-2 text-sm text-text-secondary">
                    <i class="pi pi-check text-xs text-primary-500 mt-1" aria-hidden="true"></i>
                    <span>
                      {{ 'dashboard.showBranding.formatSelector.' + option.key + '.uses.' + use | translate }}
                    </span>
                  </li>
                }
              </ul>
            </div>

            <!-- Témoin de sélection -->
            <span
              class="format-check absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center"
              aria-hidden="true"
            >
              <i class="pi pi-check text-[0.65rem]"></i>
            </span>
          </label>
        }
      </div>
    </div>

    <!-- Collé au bas de l'écran sur mobile : les deux cartes empilées
         repoussaient le bouton sous la ligne de flottaison. -->
    <div class="mt-8 flex flex-col items-center gap-2 max-md:sticky max-md:bottom-4 max-md:z-10">
      <button
        type="button"
        class="inner-button max-md:shadow-glass"
        [disabled]="!selectedFormat()"
        (click)="confirmSelection()"
      >
        <i class="pi pi-sparkles text-sm" aria-hidden="true"></i>
        <span>{{ 'dashboard.showBranding.formatSelector.startGeneration' | translate }}</span>
      </button>
      <p class="text-xs text-text-tertiary max-md:hidden">
        {{ 'dashboard.showBranding.formatSelector.changeLater' | translate }}
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .format-card {
        border-color: var(--glass-border);
      }

      .format-card:hover {
        border-color: var(--glass-border-medium);
      }

      .format-card.is-selected {
        border-color: var(--color-primary-500);
      }

      .format-card:focus-within {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 3px;
      }

      .format-check {
        border-color: var(--glass-border-medium);
        color: transparent;
        transition:
          background-color 0.2s ease,
          border-color 0.2s ease;
      }

      .is-selected .format-check {
        border-color: var(--color-primary-500);
        background-color: var(--color-primary-500);
        color: var(--color-on-primary);
      }
    `,
  ],
})
export class PdfFormatSelectorComponent {
  protected readonly options: readonly FormatOption[] = [
    { id: 'SLIDE_16_9', key: 'landscape', size: '297 × 167 mm', recommended: true },
    { id: 'A4_PORTRAIT', key: 'a4Portrait', size: '210 × 297 mm', recommended: false },
  ];

  /** Le format recommandé est présélectionné. */
  protected readonly selectedFormat = signal<PdfFormat | null>('SLIDE_16_9');
  readonly formatSelected = output<PdfFormat>();

  protected confirmSelection(): void {
    const format = this.selectedFormat();
    if (format) {
      this.formatSelected.emit(format);
    }
  }
}
