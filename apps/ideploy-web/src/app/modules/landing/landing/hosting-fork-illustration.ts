import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Le choix de l'hébergement, dessiné comme un chemin (AGENTS.md § 4) : en haut
 * le panier tressé, ce que vous mettez en ligne ; un sentier descend et se
 * sépare en deux. À gauche il mène au grenier du village, plein et tenu pour
 * vous (nos serveurs) ; à droite, à la porte de votre propre grenier et à sa
 * serrure de bois (votre serveur).
 *
 * Les deux destinations sont celles de `app-illustration` (`managed-cloud`,
 * `own-server`), reprises ici sans leur accent : dans cette scène, le seul
 * détail en couleur est le cœur du panier, la même application qui part d'un
 * côté ou de l'autre. Les centres des destinations (x = 240 et 720 sur 960)
 * tombent sur les deux colonnes de la comparaison posée dessous.
 */
@Component({
  selector: 'app-hosting-fork-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 960 352"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="w-full h-auto"
      style="color: var(--color-text-secondary);">
      <!-- Ce qu'on met en ligne : le panier tressé -->
      <g transform="translate(399 -13.5) scale(1.35)" stroke-width="1.20">
        <path d="M40 40 C38 16 82 16 80 40" stroke-width="1.60" />
        <path d="M44 40 C43 22 77 22 76 40" opacity=".55" />
        <ellipse cx="60" cy="42" rx="34" ry="6" stroke-width="1.60" />
        <path d="M26 42 C26 62 34 78 60 78 C86 78 94 62 94 42" stroke-width="1.60" />
        <path
          d="M28 46 L33.3 52 L38.7 46 L44 52 L49.3 46 L54.7 52 L60 46 L65.3 52 L70.7 46 L76 52 L81.3 46 L86.7 52 L92 46 M30 55 L35 61 L40 55 L45 61 L50 55 L55 61 L60 55 L65 61 L70 55 L75 61 L80 55 L85 61 L90 55 M32 64 L36.7 70 L41.3 64 L46 70 L50.7 64 L55.3 70 L60 64 L64.7 70 L69.3 64 L74 70 L78.7 64 L83.3 70 L88 64"
          stroke-width="0.80"
          opacity=".7" />
        <g style="color: var(--color-primary-500);">
          <path d="M60 45.5 L64 51 L60 56.5 L56 51Z" stroke-width="1.44" />
        </g>
      </g>

      <!-- Le sentier, qui se sépare -->
      <path
        d="M480 98 V132 C480 172 240 148 240 186 M480 132 C480 172 720 148 720 186"
        stroke-width="3"
        stroke-dasharray="0.1 10"
        opacity=".75" />
      <circle cx="480" cy="146" r="21" stroke-width="1.5" style="fill: var(--color-surface-1);" />
      <text
        x="480"
        y="151.5"
        font-size="15"
        font-weight="800"
        text-anchor="middle"
        stroke="none"
        fill="currentColor"
        style="font-family: inherit;">
        {{ or() }}
      </text>

      <!-- À gauche : le grenier du village, tenu pour vous -->
      <g transform="translate(120 186) scale(2)" stroke-width="0.90">
        <path d="M42 40 L44 74 H76 L78 40" stroke-width="1.20" />
        <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8" />
        <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="1.20" />
        <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width="0.54" opacity=".6" />
        <path d="M58 6 L60 2 L62 6" stroke-width="0.84" />
        <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="0.66" opacity=".7" />
        <rect x="54" y="48" width="12" height="11" rx="1" />
        <path d="M56.5 56 h0.01 M60 54 h0.01 M63.5 56 h0.01 M58 51.5h0.01 M62 51.5h0.01" stroke-width="1.56" />
      </g>

      <!-- À droite : la porte de votre grenier, et votre clé -->
      <g transform="translate(608 166) scale(2)" stroke-width="0.90">
        <rect x="34" y="10" width="44" height="70" rx="2" stroke-width="1.20" />
        <path d="M40 16 H72 V74 H40Z" opacity=".55" />
        <path d="M44 22 L50 28 L44 34 M68 22 L62 28 L68 34 M44 60 L50 66 L44 72 M68 60 L62 66 L68 72" stroke-width="0.72" opacity=".7" />
        <path d="M56 18 V36 M56 58 V74" stroke-width="0.60" opacity=".5" />
        <rect x="74" y="30" width="12" height="30" rx="2" stroke-width="1.20" />
        <path d="M78 34 h4 M78 56 h4" stroke-width="0.60" opacity=".6" />
        <path d="M60 45 H96" stroke-width="1.44" />
        <path d="M96 41 V49" stroke-width="1.20" />
        <path d="M66 42 L69 45 L66 48 L63 45Z" stroke-width="0.84" />
      </g>
    </svg>
  `,
})
export class HostingForkIllustrationComponent {
  /** The word at the fork. */
  readonly or = input.required<string>();
}
