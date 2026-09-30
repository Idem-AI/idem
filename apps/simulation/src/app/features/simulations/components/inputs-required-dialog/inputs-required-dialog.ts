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
/**
 * Les douze cases de l'awalé, dans l'ordre où l'on sème : la rangée du bas de
 * gauche à droite, puis celle du haut de droite à gauche. `seeds` trace les
 * graines d'une case semée.
 */
const AWALE_PITS = [
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ x: 30 + i * 12, y: 52 })),
  ...[5, 4, 3, 2, 1, 0].map((i) => ({ x: 30 + i * 12, y: 36 })),
].map(({ x, y }) => ({
  x,
  y,
  seeds: `M${x - 1.6} ${y - 0.6}h0.01 M${x + 1.6} ${y + 0.6}h0.01 M${x + 1.4} ${y - 1}h0.01`,
}));

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
             calebasses versent leurs graines sur le plateau d'awalé ; celles
             qui manquent y laissent des cases vides. C'est exactement ce que
             le texte dit. -->
        <svg
          viewBox="0 0 208 108"
          class="h-[6.75rem] w-full max-w-[20rem] self-center text-ink-subtle"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          role="img"
          [attr.aria-label]="'inputs.illustrationAlt' | translate"
        >
          @for (row of rows(); track row.key; let i = $index) {
            <!-- Une source : la calebasse, pleine quand le livrable existe. -->
            <g
              [attr.transform]="'translate(2, ' + (2 + i * 36) + ')'"
              [attr.stroke-dasharray]="row.present ? null : '4 3'"
              [attr.stroke-opacity]="row.present ? null : '.45'"
            >
              <ellipse cx="27" cy="12" rx="21" ry="4.5" stroke-width="1.8"/>
              <path d="M6 12 C6 25 15 32 27 32 C39 32 48 25 48 12" stroke-width="1.8"/>
              <path d="M10 20 L14 23 L18 20 L22 23 L26 20 L30 23 L34 20 L38 23 L42 20 L45 22" stroke-width="1" opacity=".7"/>
              @if (row.present) {
                <path d="M19 9.5h0.01 M27 8.5h0.01 M35 9.5h0.01" stroke-width="3.4" style="color: var(--color-primary-500)"/>
              }
            </g>
            <!-- Le trait qui la verse sur le plateau : plein quand la source existe. -->
            <path
              [attr.d]="'M56 ' + (20 + i * 36) + ' C68 ' + (20 + i * 36) + ' 72 54 86 54'"
              stroke-opacity=".5"
              [attr.stroke-dasharray]="row.present ? null : '3 3'"
            />
          }

          <!-- Le plateau d'awalé : autant de cases semées que de livrables
               présents ; les cases vides sont ce que le moteur devra supposer. -->
          <g transform="translate(90 10) scale(0.98)">
            <path d="M16 34 C16 28 20 26 26 26 H94 C100 26 104 28 104 34 V54 C104 60 100 62 94 62 H26 C20 62 16 60 16 54Z" stroke-width="2"/>
            <path d="M22 66 L26 62 M98 66 L94 62 M22 66 H98" opacity=".7"/>
            @for (pit of pits(); track $index) {
              <ellipse
                [attr.cx]="pit.x"
                [attr.cy]="pit.y"
                rx="4.8"
                ry="3.6"
                [attr.stroke-dasharray]="pit.sown ? null : '2 2.5'"
                [attr.stroke-opacity]="pit.sown ? null : '.5'"
              />
              @if (pit.sown) {
                <path [attr.d]="pit.seeds" stroke-width="2.4"/>
              }
            }
          </g>
          <g
            style="color: var(--color-primary-500)"
            stroke-width="1.8"
            [attr.stroke-dasharray]="hasMissing() ? '3 4' : null"
            [attr.stroke-opacity]="hasMissing() ? '.5' : null"
          >
            <path d="M118 36 C128 26 142 26 150 36"/>
            <path d="M146.5 33 L150 36.5 L151 32"/>
          </g>
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
   * Les cases du plateau d'awalé, semées en proportion des livrables présents.
   *
   * Le descriptif du projet existe toujours : quatre cases sont semées quoi
   * qu'il arrive, et chaque livrable en ajoute. Ce qui reste vide, c'est ce
   * que le moteur devra supposer.
   */
  protected readonly pits = computed(() => {
    const present = this.rows().filter((row) => row.present).length;
    const sown = 4 + Math.round((8 * present) / PROJECT_INPUT_KEYS.length);
    return AWALE_PITS.map((pit, index) => ({ ...pit, sown: index < sown }));
  });

  constructor() {
    // Le bouton principal prend le focus : la touche Entrée mène alors au
    // meilleur résultat plutôt qu'au plus rapide.
    afterNextRender(() => this.completeButton().nativeElement.focus());
  }
}
