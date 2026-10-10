import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

interface Spoken {
  t: string;
  cut: boolean;
}

/** Ce qui apparaît à l'écran, calé sur les phrases (indices des segments dits). */
const OVERLAYS = [
  { key: 'title', from: 0, to: 2, accent: false },
  { key: 'offer', from: 4, to: 4, accent: true },
  { key: 'logo', from: 6, to: 6, accent: false },
];

/** Hauteur d'une barre de la forme d'onde : pseudo-aléatoire mais stable d'un rendu à l'autre. */
const amplitude = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * « Filmez-vous. iVision monte. » : l'étoffe de raphia kuba (on découpe, puis on coud une pièce),
 * et le montage tel qu'il sort de l'atelier, en trois pistes : ce qui apparaît à l'écran, les
 * sous-titres, la prise de parole. Les hésitations sont barrées et coupées de la forme d'onde.
 */
@Component({
  selector: 'iv-landing-montage',
  imports: [TranslateModule, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="montage" ivWrap class="scroll-mt-20 py-20 lg:py-28">
      <div class="grid items-center gap-10 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <iv-display-title [lines]="'landing.montage.title' | translate" />
          <p class="mt-8 max-w-xl text-lg text-text-secondary">{{ 'landing.montage.text' | translate }}</p>
        </div>
        <iv-landing-art kind="kuba" ivInView class="mx-auto w-full max-w-md text-text-primary lg:col-span-5 lg:max-w-none" />
      </div>

      <figure class="glass-card tracks mt-16 p-5 sm:p-8" ivInView>
        <figcaption class="sr-only">{{ 'landing.montage.screen' | translate }}</figcaption>
        <div class="custom-scrollbar overflow-x-auto pb-2" aria-hidden="true">
          <!-- Une seule grille pour les trois pistes : les colonnes (une par segment dit) sont
               communes, chaque mot garde sa largeur, et ce qui apparaît à l'écran s'étend
               exactement sur les phrases qu'il illustre. -->
          <div class="grid min-w-[46rem] items-center gap-x-1 gap-y-4" [style.grid-template-columns]="columns()">
            <span class="label">{{ 'landing.montage.tracks.screen' | translate }}</span>
            @for (o of overlays; track o.key) {
              <span class="chip" [class.is-accent]="o.accent" [style.grid-column]="o.from + 2 + ' / ' + (o.to + 3)" style="grid-row: 1">
                {{ 'landing.montage.overlays.' + o.key | translate }}
              </span>
            }

            <span class="label" style="grid-row: 2">{{ 'landing.montage.tracks.subtitles' | translate }}</span>
            @for (s of segments(); track $index; let i = $index) {
              <span class="word" [class.is-cut]="s.cut" [style.--i]="i" style="grid-row: 2">{{ s.t }}</span>
            }

            <span class="label" style="grid-row: 3">{{ 'landing.montage.tracks.take' | translate }}</span>
            @for (s of segments(); track $index; let i = $index) {
              <span class="wave" [class.is-cut]="s.cut" [style.--i]="i" style="grid-row: 3">
                @for (h of s.bars; track $index) {
                  <i [style.height.%]="h"></i>
                }
              </span>
            }
          </div>
        </div>
        <p class="mt-6 flex items-center gap-2 text-sm font-semibold text-text-secondary">
          <i class="pi pi-eraser text-primary-500" aria-hidden="true"></i> {{ 'landing.montage.removed' | translate }}
        </p>
      </figure>
    </section>
  `,
  styles: `
    .tracks:hover {
      transform: none;
    }
    .label {
      grid-column: 1;
      margin-right: 0.75rem;
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      color: var(--color-text-tertiary);
    }

    /* Ce qui apparaît à l'écran. */
    .chip {
      display: flex;
      height: 2.5rem;
      align-items: center;
      padding: 0 0.75rem;
      overflow: hidden;
      border: 1px solid var(--glass-border-medium);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      font-size: var(--font-size-sm);
      font-weight: 600;
      white-space: nowrap;
    }
    .chip.is-accent {
      border-color: var(--color-primary-500);
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }

    /* Les sous-titres : les mots dits, les hésitations barrées. */
    .word {
      align-self: stretch;
      padding: 0.5rem 0.625rem;
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      font-size: var(--font-size-sm);
      line-height: 1.3;
    }
    .word.is-cut {
      border: 1px dashed var(--glass-border-strong);
      background: linear-gradient(currentColor, currentColor) no-repeat 0.625rem 50% / calc(100% - 1.25rem) 1.5px;
      color: var(--color-text-tertiary);
    }

    /* La forme d'onde : les coupes ne gardent qu'un souffle. */
    .wave {
      display: flex;
      height: 5rem;
      align-items: center;
      gap: 2px;
      overflow: hidden;
      border-radius: var(--radius-md);
    }
    .wave i {
      flex: 1;
      max-width: 4px;
      border-radius: 2px;
      background: var(--color-primary-500);
    }
    .wave.is-cut {
      border: 1px dashed var(--glass-border-strong);
    }
    .wave.is-cut i {
      background: var(--color-text-disabled);
    }

    /* À l'arrivée : les hésitations se barrent, leur onde s'éteint (barrées au repos). */
    .tracks.is-drawn .word.is-cut {
      animation: strike 0.5s var(--ease-fluid) both;
      animation-delay: calc(0.6s + var(--i, 0) * 180ms);
    }
    .tracks.is-drawn .wave.is-cut i {
      animation: hush 0.5s ease both;
      animation-delay: calc(0.6s + var(--i, 0) * 180ms);
    }
    @keyframes strike {
      from {
        background-size: 0 1.5px;
        color: var(--color-text-primary);
      }
    }
    @keyframes hush {
      from {
        background: var(--color-primary-500);
      }
    }
  `,
})
export class LandingMontage {
  private readonly translate = inject(TranslateService);
  private readonly transcript = toSignal(this.translate.stream('landing.montage.transcript'), { initialValue: [] as Spoken[] });

  /** Chaque segment pèse sa longueur ; ses barres d'onde en découlent. */
  protected readonly segments = computed(() => {
    const spoken = Array.isArray(this.transcript()) ? (this.transcript() as Spoken[]) : [];
    let seed = 1;
    return spoken.map((s) => {
      const weight = Math.max(s.t.length, 6);
      const bars = Array.from({ length: Math.round(weight * 0.9) }, () => {
        const a = amplitude(seed++);
        return s.cut ? 6 + a * 12 : 22 + a * 78;
      });
      return { ...s, weight, bars };
    });
  });

  /** Ce qui apparaît à l'écran (placé par colonnes de la grille). */
  protected readonly overlays = OVERLAYS;

  /** Une colonne pour les libellés, puis une par segment dit, proportionnelle à sa longueur. */
  protected readonly columns = computed(
    () => `max-content ${this.segments().map((s) => `minmax(min-content, ${s.weight}fr)`).join(' ')}`,
  );
}
