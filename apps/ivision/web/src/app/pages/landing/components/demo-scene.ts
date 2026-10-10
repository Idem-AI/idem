import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type DemoSceneKind = 'hook' | 'offer' | 'date' | 'brand';

/**
 * Un plan de la vidéo d'exemple de la landing (« Maison Nyanga », soldes de fin d'année), tel
 * qu'iVision le livre. Il remplit son conteneur, quel que soit le format : toutes les tailles
 * sont en unités de conteneur (`cqmin`), et la mise en page bascule en paysage.
 *
 *   filled    le plan livré, aux couleurs de la marque
 *   stencil   le squelette du même plan (le modèle qu'on montre) : cadres en pointillé, sans texte
 *
 * Les plans restent clairs dans les deux thèmes, comme tout livrable (politique de surface
 * claire) : ils n'utilisent que des jetons qui ne basculent pas avec le thème.
 * Maison Nyanga est une boutique de mode de Douala : ses visuels portent des clins d'œil discrets
 * à ses étoffes (lisière de kente en dents de scie, cercles de wax en coin, points du bogolan),
 * toujours en lisière ou en coin, jamais en fond.
 * `playing` rejoue l'entrée du plan : chaque plan a son mouvement, le même que celui que la
 * section « modèle » annonce (entre par la gauche, grossit, monte, apparaît).
 */
@Component({
  selector: 'iv-demo-scene',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'demo-scene',
    '[class.is-stencil]': "variant() === 'stencil'",
    '[class.is-playing]': 'playing() !== null',
    '[class.is-on]': 'playing() !== false',
    'aria-hidden': 'true',
  },
  template: `
    @if (variant() === 'filled') {
      @switch (scene()) {
        @case ('hook') {
          <div class="scene hook">
            <span class="k kicker">{{ 'landing.demo.kicker' | translate }}</span>
            <span class="k big" style="--d: 1">{{ 'landing.demo.hook' | translate }}</span>
            <span class="k rule" style="--d: 2"></span>
            <span class="kente"></span>
          </div>
        }
        @case ('offer') {
          <div class="scene offer">
            <span class="wax"></span>
            <span class="k number" [class.is-editing]="editing()">
              {{ offer() ?? ('landing.demo.offer' | translate) }}@if (editing()) {<span class="caret"></span>}
            </span>
            <span class="k caption" style="--d: 1">{{ 'landing.demo.offerText' | translate }}</span>
          </div>
        }
        @case ('date') {
          <div class="scene date">
            <span class="k caption">{{ 'landing.demo.when' | translate }}</span>
            <span class="k big" style="--d: 1">{{ 'landing.demo.date' | translate }}</span>
            <span class="k bogolan" style="--d: 2"></span>
          </div>
        }
        @case ('brand') {
          <div class="scene brand">
            <span class="k monogram"><span>{{ 'landing.demo.monogram' | translate }}</span></span>
            <span class="k name" style="--d: 1">{{ 'landing.demo.brand' | translate }}</span>
            <span class="k caption" style="--d: 2">{{ 'landing.demo.place' | translate }}</span>
            <span class="kente is-light"></span>
          </div>
        }
      }
    } @else {
      <!-- Le squelette : où vont les textes, et dans quel sens ils bougent. -->
      <div class="scene bones" [class]="'is-' + scene()">
        @switch (scene()) {
          @case ('hook') {
            <span class="bar" style="width: 34%; height: 5cqmin"></span>
            <span class="bar" style="width: 82%; height: 15cqmin"></span>
            <span class="bar" style="width: 58%; height: 15cqmin"></span>
            <svg class="move" viewBox="0 0 60 12"><path d="M2 6 H54 M46 1 L55 6 L46 11" /></svg>
          }
          @case ('offer') {
            <span class="bar" style="width: 70%; height: 32cqmin"></span>
            <span class="bar" style="width: 52%; height: 5cqmin"></span>
            <svg class="move" viewBox="0 0 40 40"><path d="M14 14 L3 3 M3 11 V3 H11 M26 26 L37 37 M37 29 V37 H29" /></svg>
          }
          @case ('date') {
            <span class="bar" style="width: 30%; height: 5cqmin"></span>
            <span class="bar" style="width: 76%; height: 14cqmin"></span>
            <svg class="move" viewBox="0 0 12 50"><path d="M6 48 V4 M1 12 L6 3 L11 12" /></svg>
          }
          @case ('brand') {
            <span class="bar round" style="width: 22cqmin; height: 22cqmin"></span>
            <span class="bar" style="width: 56%; height: 8cqmin"></span>
            <span class="bar" style="width: 36%; height: 4.5cqmin"></span>
          }
        }
      </div>
    }
  `,
  styles: `
    /* La hauteur et la position viennent de l'appelant : un rapport (aspect-[4/5]) ou
       \`absolute inset-0\`. Pas de \`position\` ici : un style de composant passe devant les
       utilitaires et écraserait celle de l'appelant. Le plan remplit l'unique case de la grille. */
    :host {
      --sawtooth: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10'%3E%3Cpath d='M0 9 L5 1 L10 9 L15 1 L20 9' fill='none' stroke='%23000' stroke-width='2.2'/%3E%3C/svg%3E");
      display: grid;
      grid-template: minmax(0, 1fr) / minmax(0, 1fr);
      width: 100%;
      overflow: hidden;
      container-type: size;
    }
    .scene {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 3cqmin;
      padding: 9cqmin;
      line-height: 0.92;
    }
    .big,
    .number,
    .name,
    .monogram {
      font-weight: 900;
    }
    .kicker,
    .caption {
      font-size: 5.2cqmin;
      font-weight: 600;
      line-height: 1.15;
    }
    .kicker {
      text-transform: uppercase;
      opacity: 0.85;
    }

    /* Accroche : l'aplat de la marque, le titre en bas. */
    .hook {
      justify-content: flex-end;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }
    .hook .big {
      font-size: 15cqmin;
      max-width: 9ch;
    }
    .rule {
      display: block;
      width: 18cqmin;
      height: 1.4cqmin;
      background: var(--color-accent-300);
    }

    /* Offre : le chiffre, énorme. */
    .offer {
      align-items: center;
      justify-content: center;
      text-align: center;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    .number {
      position: relative;
      font-size: 31cqmin;
      line-height: 0.85;
      color: var(--color-primary-500);
      white-space: nowrap;
    }
    .number.is-editing {
      outline: 0.7cqmin solid var(--color-accent-600);
      outline-offset: 2.4cqmin;
      border-radius: 0.6cqmin;
    }
    .caret {
      display: inline-block;
      width: 0.08em;
      height: 0.78em;
      margin-left: 0.04em;
      vertical-align: -0.02em;
      background: currentColor;
      animation: caret-blink 1s steps(1) infinite;
    }
    @keyframes caret-blink {
      50% {
        opacity: 0;
      }
    }

    /* Date : la marine de la marque. */
    .date {
      justify-content: center;
      background: var(--color-secondary-500);
      color: var(--color-on-primary);
    }
    .date .caption {
      opacity: 0.75;
    }
    .date .big {
      font-size: 14cqmin;
    }

    /* Signature. */
    .brand {
      align-items: center;
      justify-content: center;
      text-align: center;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    .monogram {
      display: grid;
      place-items: center;
      width: 18cqmin;
      height: 18cqmin;
      margin-bottom: 2cqmin;
      border-radius: 2.6cqmin;
      rotate: 45deg;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
      font-size: 10cqmin;
      line-height: 1;
    }
    .monogram > span {
      rotate: -45deg;
    }
    .name {
      margin-top: 2cqmin;
      font-size: 8.5cqmin;
    }
    .brand .caption {
      opacity: 0.7;
    }

    /* Les clins d'œil textiles : en lisière ou en coin, jamais sous le texte. */
    .hook {
      padding-bottom: 17cqmin;
    }
    .kente {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 8cqmin;
    }
    .kente::before,
    .kente::after {
      content: '';
      position: absolute;
      right: 0;
      left: 0;
    }
    .kente::before {
      top: 0;
      height: 3.6cqmin;
      background: var(--color-accent-300);
      -webkit-mask: var(--sawtooth) repeat-x 0 0 / 7.2cqmin 3.6cqmin;
      mask: var(--sawtooth) repeat-x 0 0 / 7.2cqmin 3.6cqmin;
    }
    .kente::after {
      bottom: 0;
      height: 2.8cqmin;
      opacity: 0.6;
      background: repeating-linear-gradient(
        90deg,
        var(--color-on-primary) 0 4cqmin,
        transparent 4cqmin 5.2cqmin,
        var(--color-accent-300) 5.2cqmin 9.2cqmin,
        transparent 9.2cqmin 10.4cqmin
      );
    }
    .kente.is-light {
      height: 6cqmin;
    }
    .kente.is-light::before {
      background: var(--color-primary-500);
    }
    .kente.is-light::after {
      opacity: 0.35;
      background: repeating-linear-gradient(
        90deg,
        var(--color-secondary-500) 0 4cqmin,
        transparent 4cqmin 5.2cqmin,
        var(--color-primary-500) 5.2cqmin 9.2cqmin,
        transparent 9.2cqmin 10.4cqmin
      );
    }
    .wax {
      position: absolute;
      top: -16cqmin;
      right: -16cqmin;
      width: 50cqmin;
      height: 50cqmin;
      border-radius: 50%;
      background: repeating-radial-gradient(circle, var(--color-primary-200) 0 1.2cqmin, transparent 1.2cqmin 3.4cqmin);
    }
    .offer .number,
    .offer .caption {
      position: relative;
    }
    .bogolan {
      display: block;
      width: 62%;
      height: 3cqmin;
      margin-top: 3cqmin;
      opacity: 0.6;
      background:
        radial-gradient(circle, var(--color-on-primary) 0.6cqmin, transparent 0.7cqmin) 0 0 / 3.4cqmin 1.6cqmin repeat-x,
        linear-gradient(var(--color-on-primary), var(--color-on-primary)) 0 100% / 100% 0.35cqmin no-repeat;
    }
    .brand {
      padding-bottom: 13cqmin;
    }

    /* Paysage : le texte se range à gauche, le chiffre et la signature passent en ligne. */
    @container (orientation: landscape) {
      .hook .big {
        font-size: 19cqmin;
        max-width: 12ch;
      }
      .offer {
        flex-direction: row;
        gap: 6cqmin;
        text-align: left;
      }
      .offer .caption {
        max-width: 11ch;
        font-size: 7cqmin;
      }
      .number {
        font-size: 40cqmin;
      }
      .date .big {
        font-size: 20cqmin;
      }
      .brand {
        flex-direction: row;
        gap: 5cqmin;
        text-align: left;
      }
      .brand .name {
        margin-top: 0;
      }
    }

    /* Le squelette (modèle). */
    :host(.is-stencil) {
      border: 1.5px dashed currentColor;
      border-radius: 0.4rem;
    }
    .bones {
      justify-content: flex-end;
    }
    .bones.is-offer,
    .bones.is-brand {
      align-items: center;
      justify-content: center;
    }
    .bones.is-date {
      justify-content: center;
    }
    .bar {
      display: block;
      border: 1.5px dashed currentColor;
      border-radius: 0.3rem;
    }
    .bar.round {
      border-radius: 50%;
    }
    .move {
      position: absolute;
      fill: none;
      stroke: var(--color-primary-500);
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .is-hook .move {
      top: 12cqmin;
      left: 9cqmin;
      width: 40cqmin;
    }
    .is-offer .move {
      top: 8cqmin;
      right: 8cqmin;
      width: 18cqmin;
    }
    .is-date .move {
      top: 10cqmin;
      right: 10cqmin;
      height: 30cqmin;
    }

    /* L'entrée de chaque plan, quand il est lu. */
    .k {
      transition:
        opacity 0.55s var(--ease-fluid),
        transform 0.7s var(--ease-fluid);
      transition-delay: calc(var(--d, 0) * 90ms + 120ms);
    }
    :host(.is-playing:not(.is-on)) .k {
      opacity: 0;
      transition-delay: 0s;
    }
    :host(.is-playing:not(.is-on)) .hook .k {
      transform: translateX(-14cqmin);
    }
    :host(.is-playing:not(.is-on)) .offer .k {
      transform: scale(0.7);
    }
    :host(.is-playing:not(.is-on)) .date .k {
      transform: translateY(10cqmin);
    }
    @media (prefers-reduced-motion: reduce) {
      .k {
        transition: none;
      }
      .caret {
        animation: none;
      }
    }
  `,
})
export class DemoScene {
  readonly scene = input.required<DemoSceneKind>();
  readonly variant = input<'filled' | 'stencil'>('filled');
  /** `null` : plan fixe. `true` / `false` : plan lu dans une séquence, à l'écran ou non. */
  readonly playing = input<boolean | null>(null);
  /** Texte de l'offre en cours de retouche (section « Retouchez en direct »). */
  readonly offer = input<string | null>(null);
  readonly editing = input(false);
}
