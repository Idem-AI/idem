import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

const LEVELS = ['low', 'medium', 'high', 'max', 'ultra'] as const;
/** Hauteur de chaque cran sur l'échelle dogon (`landing-art`, viewBox de 640), du bas vers le haut. */
const NOTCH_TOP = [560, 455, 350, 245, 140].map((y) => (y / 640) * 100);

/**
 * « Montez d'un cran » : l'échelle dogon, taillée cran par cran, sert de sélecteur. Chaque cran
 * est un vrai bouton radio ; à côté, le même visuel recomposé au cran choisi, de la mise en page
 * sûre (Low) à la composition d'auteur (Ultra), et le prix qui suit (×1 → ×2).
 */
@Component({
  selector: 'iv-landing-creativity',
  imports: [TranslateModule, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="cran" ivWrap class="scroll-mt-20 py-20 lg:py-28">
      <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <div class="lg:order-2 lg:col-span-5">
          <iv-display-title [lines]="'landing.creativity.title' | translate" />
          <p class="mt-8 text-lg text-text-secondary">{{ 'landing.creativity.text' | translate }}</p>
          <div class="mt-10 border-t border-[var(--glass-border)] pt-8" aria-live="polite">
            <p class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span class="text-5xl font-black text-heading">{{ 'landing.creativity.levels.' + key() + '.name' | translate }}</span>
              <span class="text-2xl font-black text-primary-500">{{ 'landing.creativity.levels.' + key() + '.mult' | translate }}</span>
              @if (key() === 'medium') {
                <span class="tag">{{ 'landing.creativity.default' | translate }}</span>
              }
            </p>
            <p class="mt-3 text-text-secondary">{{ 'landing.creativity.levels.' + key() + '.text' | translate }}</p>
          </div>
        </div>

        <div class="flex flex-col items-center gap-12 sm:flex-row sm:justify-center sm:gap-10 lg:order-1 lg:col-span-7 lg:justify-start">
          <!-- L'échelle : chaque cran est un bouton radio. -->
          <div class="relative mr-20 h-[28rem] shrink-0 sm:h-[36rem]" role="radiogroup" [attr.aria-label]="'landing.creativity.ladder' | translate">
            <iv-landing-art kind="ladder" [level]="level()" ivInView class="aspect-[240/640] h-full text-text-primary" />
            @for (l of levels; track l; let i = $index) {
              <label class="notch absolute cursor-pointer whitespace-nowrap" [style.top.%]="notchTop[i]" [class.is-on]="i === level()">
                <input type="radio" name="iv-landing-creativity" [checked]="i === level()" (change)="level.set(i)" />
                <span class="font-black">{{ 'landing.creativity.levels.' + l + '.name' | translate }}</span>
                <span class="mult text-base">{{ 'landing.creativity.levels.' + l + '.mult' | translate }}</span>
              </label>
            }
          </div>

          <!-- Le même visuel, recomposé au cran choisi. -->
          <figure class="w-full max-w-xs sm:flex-1">
            <div class="poster relative aspect-[4/5] overflow-hidden rounded-lg shadow-xl" aria-hidden="true">
              <div class="p low" [class.is-current]="key() === 'low'">
                <span class="k">{{ 'landing.demo.kicker' | translate }}</span>
                <span class="n">{{ 'landing.demo.offer' | translate }}</span>
                <span class="c">{{ 'landing.demo.offerText' | translate }}</span>
                <span class="b">{{ 'landing.demo.brand' | translate }}</span>
              </div>
              <div class="p medium" [class.is-current]="key() === 'medium'">
                <span class="k">{{ 'landing.demo.kicker' | translate }}</span>
                <span class="n">{{ 'landing.demo.offer' | translate }}</span>
                <span class="c">{{ 'landing.demo.offerText' | translate }}</span>
                <span class="rule"></span>
                <span class="b"><span class="mono">{{ 'landing.demo.monogram' | translate }}</span>{{ 'landing.demo.brand' | translate }}</span>
              </div>
              <div class="p high" [class.is-current]="key() === 'high'">
                <span class="band"><span class="vert">{{ 'landing.demo.kicker' | translate }}</span></span>
                <span class="main">
                  <span class="n">−30</span>
                  <span class="n pct">%</span>
                  <span class="c">{{ 'landing.demo.offerText' | translate }}</span>
                  <span class="d">{{ 'landing.demo.when' | translate }} {{ 'landing.demo.date' | translate }}</span>
                </span>
              </div>
              <div class="p max" [class.is-current]="key() === 'max'">
                <span class="hook">{{ 'landing.demo.hook' | translate }}</span>
                <span class="pct">%</span>
                <span class="giant">−30</span>
                <span class="foot">{{ 'landing.demo.when' | translate }} {{ 'landing.demo.date' | translate }}</span>
              </div>
              <div class="p ultra" [class.is-current]="key() === 'ultra'">
                <span class="pct">%</span>
                <span class="side">{{ 'landing.demo.kicker' | translate }} · {{ 'landing.demo.brand' | translate }}</span>
                <span class="num">−30</span>
                <span class="hook">{{ 'landing.demo.hook' | translate }}</span>
                <span class="seal">{{ 'landing.demo.monogram' | translate }}</span>
              </div>
            </div>
            <figcaption class="mt-3 text-sm text-text-tertiary">
              {{ 'landing.creativity.poster' | translate: { level: ('landing.creativity.levels.' + key() + '.name' | translate) } }}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  `,
  styles: `
    /* Les crans : à droite du tronc, centrés sur l'entaille. */
    .notch {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin: 0;
      font-size: var(--font-size-lg);
      left: 64%;
      translate: 0 -50%;
      color: var(--color-text-secondary);
      transition: color 0.2s ease;
    }
    .notch.is-on {
      color: var(--color-primary-500);
    }
    .notch:has(input:focus-visible) {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 4px;
      border-radius: var(--radius-md);
    }
    .mult {
      color: var(--color-text-tertiary);
    }

    /* Le visuel : une composition par cran, en fondu. Tailles en unités du cadre. */
    .poster {
      container-type: size;
      background: var(--color-primary-50);
    }
    .p {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      padding: 10cqmin;
      line-height: 0.9;
      opacity: 0;
      transition: opacity 0.45s ease;
    }
    .p.is-current {
      opacity: 1;
    }
    .k,
    .c,
    .d,
    .b,
    .foot,
    .side {
      font-size: 4.6cqmin;
      font-weight: 600;
      line-height: 1.2;
    }
    .k,
    .side {
      text-transform: uppercase;
    }
    .n,
    .giant,
    .pct,
    .num,
    .hook,
    .seal,
    .mono {
      font-weight: 900;
    }

    /* Low : centré, sage. */
    .low {
      align-items: center;
      justify-content: center;
      gap: 3cqmin;
      text-align: center;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    .low .n {
      font-size: 19cqmin;
    }
    .low .b {
      margin-top: 8cqmin;
    }

    /* Medium : le chiffre mis en avant, la signature en pied. */
    .medium {
      justify-content: center;
      gap: 3cqmin;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    .medium .n {
      font-size: 29cqmin;
      color: var(--color-primary-500);
    }
    .rule {
      width: 16cqmin;
      height: 1.2cqmin;
      margin-top: 4cqmin;
      background: var(--color-primary-500);
    }
    .medium .b {
      display: flex;
      align-items: center;
      gap: 2.5cqmin;
    }
    .mono {
      display: grid;
      place-items: center;
      width: 8cqmin;
      height: 8cqmin;
      border-radius: 50%;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
      font-size: 4.4cqmin;
    }

    /* High : une bande de marque, le chiffre empilé. */
    .high {
      flex-direction: row;
      padding: 0;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    .band {
      display: grid;
      place-items: center;
      width: 26%;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }
    .vert {
      writing-mode: vertical-rl;
      rotate: 180deg;
      font-size: 6cqmin;
      font-weight: 900;
      text-transform: uppercase;
    }
    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: flex-end;
      padding: 9cqmin 8cqmin;
    }
    .high .n {
      font-size: 34cqmin;
      line-height: 0.8;
      color: var(--color-primary-500);
    }
    .high .c {
      margin-top: 4cqmin;
    }

    /* Max : le chiffre dépasse du cadre. */
    .max {
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }
    .max .hook {
      max-width: 7ch;
      font-size: 10cqmin;
    }
    .max .giant {
      position: absolute;
      right: -7cqmin;
      bottom: 6cqmin;
      font-size: 62cqmin;
      line-height: 0.8;
      white-space: nowrap;
    }
    .max .pct {
      position: absolute;
      top: 10cqmin;
      right: 9cqmin;
      font-size: 22cqmin;
      color: var(--color-accent-300);
    }
    .max .foot {
      position: absolute;
      bottom: 6cqmin;
      left: 10cqmin;
    }

    /* Ultra : le signe « % » devient l'image, le reste se range autour. */
    .ultra {
      background: var(--color-secondary-500);
      color: var(--color-on-primary);
    }
    .ultra .pct {
      position: absolute;
      top: -22cqmin;
      left: -12cqmin;
      font-size: 118cqmin;
      line-height: 1;
      color: var(--color-primary-500);
    }
    .ultra .side {
      position: absolute;
      top: 8cqmin;
      right: 5cqmin;
      writing-mode: vertical-rl;
      opacity: 0.8;
    }
    .ultra .num {
      position: absolute;
      right: 12cqmin;
      bottom: 24cqmin;
      font-size: 34cqmin;
      line-height: 0.8;
    }
    .ultra .hook {
      position: absolute;
      bottom: 8cqmin;
      left: 8cqmin;
      max-width: 10ch;
      font-size: 6.5cqmin;
      line-height: 1;
    }
    .ultra .seal {
      position: absolute;
      right: 7cqmin;
      bottom: 7cqmin;
      display: grid;
      place-items: center;
      width: 12cqmin;
      height: 12cqmin;
      border: 0.6cqmin solid var(--color-accent-300);
      border-radius: 50%;
      font-size: 5.5cqmin;
      color: var(--color-accent-300);
    }
    @media (prefers-reduced-motion: reduce) {
      .p,
      .notch {
        transition: none;
      }
    }
  `,
})
export class LandingCreativity {
  protected readonly levels = LEVELS;
  protected readonly notchTop = NOTCH_TOP;
  /** Medium par défaut, comme dans l'atelier. */
  protected readonly level = signal(1);
  protected readonly key = computed(() => LEVELS[this.level()]);
}
