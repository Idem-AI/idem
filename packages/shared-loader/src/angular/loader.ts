import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  IDEM_LOADER_BOX,
  IDEM_LOADER_SIZES,
  idemLoaderSeeds,
  nextIdemLoaderGradientId,
  type IdemLoaderSize,
} from '../index';

/**
 * L'unique indicateur de chargement d'Idem.
 *
 * Le semis de l'awalé : huit graines en losange, rangées en cercle comme les
 * cases du plateau, et la main qui sème en dépose une dans chaque case, l'une
 * après l'autre, avant de recommencer le tour. Le mouvement dit « ça
 * travaille » sans jamais promettre une progression qu'on ne connaît pas, et
 * l'objet est celui de la stratégie et du calcul. Les graines portent le
 * dégradé de la marque ; au repos elles restent devinées, dans la même encre,
 * donc le composant se pose aussi bien sur un fond clair que sombre.
 *
 * Il remplace toutes les variantes qui existaient auparavant — `<app-loader>`,
 * `.loader`, `.spinner`, `pi-spinner pi-spin`, les `animate-spin` maison. Les
 * squelettes (`.skeleton`, `animate-pulse`) restent : ils disent autre chose,
 * à savoir la forme de ce qui va arriver.
 *
 * @example Dans un bouton
 * ```html
 * <button class="inner-button" [disabled]="saving()">
 *   @if (saving()) { <idem-loader size="xs" /> }
 *   Enregistrer
 * </button>
 * ```
 *
 * @example Au centre d'une zone qui se remplit
 * ```html
 * <idem-loader size="lg" [label]="'common.loading' | translate" />
 * ```
 *
 * @example Par-dessus du contenu déjà affiché qu'on rafraîchit
 * ```html
 * <div class="relative">
 *   <table>…</table>
 *   @if (refreshing()) { <idem-loader overlay /> }
 * </div>
 * ```
 */
@Component({
  selector: 'idem-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.idem-loader--block]': 'block()',
    '[class.idem-loader--overlay]': 'overlay()',
    '[class.idem-loader--fullscreen]': 'fullscreen()',
  },
  template: `
    <div class="idem-loader" role="status" [attr.aria-label]="label() || ariaLabel()">
      <svg
        class="idem-loader__ring"
        [attr.width]="px()"
        [attr.height]="px()"
        [attr.viewBox]="'0 0 ' + BOX + ' ' + BOX"
        aria-hidden="true">
        <defs>
          <linearGradient
            [attr.id]="gradientId"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            [attr.x2]="BOX"
            [attr.y2]="BOX">
            <stop offset="0%" stop-color="var(--color-primary-500, #1447e6)" />
            <stop offset="100%" stop-color="var(--color-secondary-500, #22d3ee)" />
          </linearGradient>
        </defs>
        <g [attr.fill]="'url(#' + gradientId + ')'">
          @for (seed of seeds(); track $index) {
            <path
              class="idem-loader__seed"
              [attr.d]="seed.d"
              [style.animation-delay]="seed.delay" />
          }
        </g>
      </svg>

      @if (label(); as text) {
        <span class="idem-loader__label">{{ text }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    /* Occupe la largeur et se centre : le cas d'une zone qui se remplit. */
    :host(.idem-loader--block) {
      display: flex;
      width: 100%;
      justify-content: center;
      padding: 2.5rem 0;
    }

    /* Par-dessus du contenu déjà là. L'ancêtre positionné est fourni par
       l'application ; le voile reprend le verre du système de design pour que
       ce qui est dessous reste deviné, pas effacé. */
    :host(.idem-loader--overlay),
    :host(.idem-loader--fullscreen) {
      display: flex;
      align-items: center;
      justify-content: center;
      inset: 0;
      z-index: 20;
      background: var(--glass-bg, rgba(255, 255, 255, 0.6));
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }

    :host(.idem-loader--overlay) {
      position: absolute;
    }

    :host(.idem-loader--fullscreen) {
      position: fixed;
      z-index: 9999;
    }

    .idem-loader {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      line-height: normal;
    }

    .idem-loader__ring {
      display: block;
    }

    /* Chaque graine s'allume quand la main passe, puis retombe à l'état de
       graine posée. Les délais, négatifs, sont répartis sur le tour : le
       semis est déjà en cours au premier affichage, sans temps mort. */
    .idem-loader__seed {
      opacity: 0.2;
      animation: idem-loader-sow 1.2s linear infinite;
    }

    .idem-loader__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-secondary, #64748b);
      text-align: center;
    }

    @keyframes idem-loader-sow {
      0% {
        opacity: 1;
      }
      70%,
      100% {
        opacity: 0.2;
      }
    }

    /* Le semis reste, mais au pas : une graine à la fois, lentement, sans le
       sillage qui donne l'impression de tourner. */
    @media (prefers-reduced-motion: reduce) {
      .idem-loader__seed {
        animation-duration: 3.2s;
        animation-timing-function: steps(1, end);
      }
    }
  `,
})
export class IdemLoaderComponent {
  /** Taille du cercle : `xs` dans un bouton, `lg` au centre d'une page. */
  readonly size = input<IdemLoaderSize>('md');
  /** Texte affiché sous le cercle, et lu par les lecteurs d'écran. */
  readonly label = input<string | null>(null);
  /** Prend toute la largeur et se centre, avec de l'air au-dessus et dessous. */
  readonly block = input(false, { transform: booleanAttribute });
  /** Se superpose au contenu du parent positionné plutôt que de le remplacer. */
  readonly overlay = input(false, { transform: booleanAttribute });
  /** Couvre la fenêtre entière. */
  readonly fullscreen = input(false, { transform: booleanAttribute });
  /** Ce que lisent les lecteurs d'écran quand aucun `label` n'est affiché. */
  readonly ariaLabel = input('Chargement');

  protected readonly BOX = IDEM_LOADER_BOX;
  protected readonly gradientId = nextIdemLoaderGradientId();

  /** Les graines, calculées une fois par taille (géométrie commune à tous les rendus). */
  protected readonly seeds = computed(() => idemLoaderSeeds(this.size()));

  protected readonly px = computed(() => IDEM_LOADER_SIZES[this.size()]);
}
