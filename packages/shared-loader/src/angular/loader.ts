import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IDEM_LOADER_SIZES, type IdemLoaderSize } from '../index';

/** Chaque instance a son propre dégradé : deux `id` identiques dans un document
 *  se marchent dessus dès qu'une application en affiche plusieurs. */
let instance = 0;

/**
 * L'unique indicateur de chargement d'Idem.
 *
 * Un seul arc, tracé dans le dégradé de la marque, qui tourne pendant que sa
 * longueur varie : l'attente reste lisible même quand elle dure, sans jamais
 * donner l'impression d'une progression mesurée qu'on ne connaît pas. La piste
 * derrière lui vient de `--glass-border`, donc le composant se pose aussi bien
 * sur un fond clair que sombre, dans n'importe quelle application.
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
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--color-primary-500, #1447e6)" />
            <stop offset="100%" stop-color="var(--color-secondary-500, #22d3ee)" />
          </linearGradient>
        </defs>
        <circle
          class="idem-loader__track"
          [attr.cx]="BOX / 2"
          [attr.cy]="BOX / 2"
          [attr.r]="RADIUS"
          fill="none"
          [attr.stroke-width]="stroke()" />
        <circle
          class="idem-loader__arc"
          [attr.cx]="BOX / 2"
          [attr.cy]="BOX / 2"
          [attr.r]="RADIUS"
          fill="none"
          [attr.stroke]="'url(#' + gradientId + ')'"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round" />
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
      animation: idem-loader-turn 1.6s linear infinite;
      transform-origin: center;
    }

    .idem-loader__track {
      stroke: var(--glass-border, rgba(15, 23, 42, 0.1));
    }

    /* Le périmètre vaut 2πr ≈ 132.7 pour r = 21.125. Le tiret et son décalage
       sont animés ensemble : l'arc s'étire, se rétracte et glisse, ce qui donne
       le mouvement continu sans jamais suggérer un pourcentage. */
    .idem-loader__arc {
      stroke-dasharray: 100 133;
      stroke-dashoffset: 0;
      animation: idem-loader-draw 1.6s ease-in-out infinite;
    }

    .idem-loader__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-secondary, #64748b);
      text-align: center;
    }

    @keyframes idem-loader-turn {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes idem-loader-draw {
      0% {
        stroke-dasharray: 8 133;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90 133;
        stroke-dashoffset: -30;
      }
      100% {
        stroke-dasharray: 8 133;
        stroke-dashoffset: -132;
      }
    }

    /* Une rotation régulière suffit à dire « ça travaille ». L'étirement, lui,
       est le genre de mouvement que cette préférence demande de retirer. */
    @media (prefers-reduced-motion: reduce) {
      .idem-loader__ring {
        animation-duration: 3s;
      }
      .idem-loader__arc {
        animation: none;
        stroke-dasharray: 60 133;
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

  protected readonly BOX = 48;
  protected readonly RADIUS = 21.125;
  protected readonly gradientId = `idem-loader-${++instance}`;

  protected readonly px = computed(() => IDEM_LOADER_SIZES[this.size()]);
  /** Le trait s'épaissit avec le cercle, mais moins vite : sinon un `lg` a
   *  l'air d'un anneau plein et un `xs` d'un cheveu. */
  protected readonly stroke = computed(() => {
    const map: Record<IdemLoaderSize, number> = { xs: 6, sm: 5.5, md: 4.5, lg: 4 };
    return map[this.size()];
  });
}
