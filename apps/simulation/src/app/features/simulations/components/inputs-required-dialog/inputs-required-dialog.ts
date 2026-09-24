import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PROJECT_INPUT_KEYS, ProjectInputKey } from '../../models';

/**
 * Prévient qu'un livrable d'appui manque, avant que la lecture ne commence.
 *
 * Trois livrables portent les entrées d'une simulation, et chacun répond à une
 * question que les deux autres ne posent pas : le business plan dit ce qui est
 * vendu et à qui, les prévisions donnent les prix et les charges, la stratégie
 * de communication dit par quels canaux les clients arrivent. Ce qui manque
 * n'empêche pas de simuler — le moteur estimera — mais il l'estimera, et le
 * rapport le dira ligne par ligne. Autant le dire AVANT, quand il est encore
 * temps de produire ce qui manque.
 *
 * DEUX ISSUES, ET UNE SEULE ÉVIDENTE. « Compléter le projet » est le bouton
 * principal et reçoit le focus à l'ouverture : la touche Entrée mène donc au
 * meilleur résultat, pas au plus rapide. « Continuer quand même » reste offert,
 * en retrait — c'est l'utilisateur qui juge de ce qu'il lui faut, ce n'est pas à
 * un dialogue de le lui interdire.
 *
 * Échap ne choisit ni l'un ni l'autre : on revient à l'écran, rien n'est lancé.
 */
@Component({
  selector: 'sim-inputs-required-dialog',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissed.emit()' },
  template: `
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
        [attr.aria-label]="'action.dismiss' | translate"
        (click)="dismissed.emit()"
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-inputs-heading"
        aria-describedby="sim-inputs-subtitle"
        class="modal-panel rise relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto p-6 sm:p-7"
      >
        <!-- L'illustration montre le mécanisme, pas une icône d'alerte : trois
             sources alimentent la projection, et celles qui manquent la laissent
             partir en pointillés. C'est exactement ce que le texte dit. -->
        <svg
          viewBox="0 0 208 108"
          class="h-[6.75rem] w-full max-w-[20rem] self-center text-ink"
          fill="none"
          role="img"
          [attr.aria-label]="'inputs.illustrationAlt' | translate"
        >
          <defs>
            <linearGradient id="simInputsBrand" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)" />
              <stop offset="100%" stop-color="var(--color-accent-500)" />
            </linearGradient>
          </defs>

          @for (row of rows(); track row.key; let i = $index) {
            <g [attr.transform]="'translate(2, ' + i * 36 + ')'">
              <rect
                x="0"
                y="6"
                width="52"
                height="28"
                rx="5"
                [attr.fill]="row.present ? 'url(#simInputsBrand)' : 'transparent'"
                [attr.fill-opacity]="row.present ? '.14' : '0'"
                stroke="currentColor"
                [attr.stroke-opacity]="row.present ? '.42' : '.22'"
                stroke-width="1.5"
                [attr.stroke-dasharray]="row.present ? null : '4 3'"
              />
              <path
                d="M9 16h26M9 22h18"
                stroke="currentColor"
                [attr.stroke-opacity]="row.present ? '.4' : '.16'"
                stroke-width="2"
                stroke-linecap="round"
              />
              @if (row.present) {
                <circle cx="52" cy="6" r="6" fill="url(#simInputsBrand)" />
                <path
                  d="m49 6 2.2 2.2L55 4.6"
                  stroke="#ffffff"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              }
              <!-- Le trait d'alimentation : plein quand la source existe. -->
              <path
                [attr.d]="'M56 20H' + (row.present ? '84' : '72')"
                stroke="currentColor"
                [attr.stroke-opacity]="row.present ? '.35' : '.18'"
                stroke-width="1.5"
                stroke-linecap="round"
                [attr.stroke-dasharray]="row.present ? null : '3 3'"
              />
            </g>
          }

          <!-- La projection : franche tant qu'elle est nourrie, en pointillés
               dès que le moteur doit estimer. -->
          <rect
            x="92"
            y="12"
            width="112"
            height="84"
            rx="8"
            stroke="currentColor"
            stroke-opacity=".28"
            stroke-width="1.5"
          />
          <path
            d="M102 82h84M102 82V22"
            stroke="currentColor"
            stroke-opacity=".22"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            [attr.d]="curve()"
            stroke="url(#simInputsBrand)"
            stroke-width="2.5"
            stroke-linecap="round"
            fill="none"
          />
          @if (hasMissing()) {
            <path
              [attr.d]="curveTail()"
              stroke="url(#simInputsBrand)"
              stroke-opacity=".5"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-dasharray="5 4"
              fill="none"
            />
          }
        </svg>

        <h2 id="sim-inputs-heading" class="mt-5 text-h2 font-semibold text-ink">
          {{ 'inputs.heading' | translate }}
        </h2>

        <p id="sim-inputs-subtitle" class="mt-2 text-sm leading-relaxed text-ink-muted">
          {{ 'inputs.subtitle' | translate }}
        </p>

        <!-- Ce qui manque, et ce que chacun aurait réglé. Une liste de noms de
             livrables n'apprend rien : c'est l'effet sur le résultat qui décide
             si l'on prend le temps de les produire. -->
        <ul class="mt-5 flex flex-col gap-2.5">
          @for (row of missingRows(); track row.key) {
            <li class="flex items-start gap-3 rounded-xl border border-line bg-panel-sunken p-3.5">
              <span
                class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-verdict-warn/15 text-verdict-warn"
                aria-hidden="true"
              >
                <i class="pi pi-exclamation-triangle text-[0.7rem]"></i>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-ink">
                  {{ 'inputs.item.' + row.key + '.label' | translate }}
                </span>
                <span class="mt-0.5 block text-meta leading-relaxed text-ink-muted">
                  {{ 'inputs.item.' + row.key + '.effect' | translate }}
                </span>
              </span>
            </li>
          }
        </ul>

        <p class="mt-4 text-meta leading-relaxed text-ink-subtle">
          {{ 'inputs.note' | translate }}
        </p>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- En retrait, et c'est délibéré : rien n'empêche de continuer, mais
               ce n'est pas ce que l'écran recommande. -->
          <button
            type="button"
            class="button-ghost button-sm text-meta"
            (click)="continued.emit()"
          >
            {{ 'inputs.continueAnyway' | translate }}
          </button>

          <button #completeButton type="button" class="inner-button" (click)="completed.emit()">
            <i class="pi pi-arrow-up-right text-[0.7rem]" aria-hidden="true"></i>
            {{ 'inputs.complete' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class InputsRequiredDialog {
  /** Les livrables absents, tels que l'API les a comptés. */
  readonly missing = input.required<readonly ProjectInputKey[]>();

  /** Lancer malgré tout, avec les estimations que cela implique. */
  readonly continued = output<void>();

  /** Partir produire ce qui manque, dans le tableau de bord IDEM. */
  readonly completed = output<void>();

  /** Échap ou clic sur le voile : on ne lance rien et on ne part nulle part. */
  readonly dismissed = output<void>();

  private readonly completeButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('completeButton');

  protected readonly rows = computed(() =>
    PROJECT_INPUT_KEYS.map((key) => ({ key, present: !this.missing().includes(key) })),
  );

  protected readonly missingRows = computed(() => this.rows().filter((row) => !row.present));

  protected readonly hasMissing = computed(() => this.missingRows().length > 0);

  /**
   * Où la projection cesse d'être établie.
   *
   * Plus le projet porte de livrables, plus loin la courbe tient avant de
   * passer en pointillés. Le segment franc n'est jamais nul : le descriptif du
   * projet existe toujours, et c'est déjà quelque chose.
   */
  private readonly breakPoint = computed(() => {
    const present = this.rows().filter((row) => row.present).length;
    const ratio = present / PROJECT_INPUT_KEYS.length;
    return { x: 118 + Math.round(44 * ratio), y: 74 - Math.round(40 * ratio) };
  });

  /** La part établie de la courbe — celle que les livrables présents portent. */
  protected readonly curve = computed(() => {
    const { x, y } = this.breakPoint();
    const middle = Math.round((102 + x) / 2);
    return `M102 74 C ${middle} 74, ${middle} ${y}, ${x} ${y}`;
  });

  /** Le prolongement estimé, en pointillés : ce que le moteur devra supposer. */
  protected readonly curveTail = computed(() => {
    const { x, y } = this.breakPoint();
    return `M${x} ${y} C ${x + 18} ${y - 10}, ${x + 30} ${y + 12}, 190 ${y - 16}`;
  });

  constructor() {
    // Le bouton principal prend le focus : la touche Entrée mène alors au
    // meilleur résultat plutôt qu'au plus rapide.
    afterNextRender(() => this.completeButton().nativeElement.focus());
  }
}
