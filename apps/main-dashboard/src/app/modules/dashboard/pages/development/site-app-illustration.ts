import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Scènes de « Site et app » et de « Mettre en ligne » (AGENTS.md § 4,
 * docs/ILLUSTRATIONS.md). Les dessins reprennent ceux d'iDeploy et d'AppGen,
 * pour qu'un même objet ait le même trait d'une application à l'autre.
 *
 * - `site`   : l'étal du marché — une vitrine où l'on montre ce qu'on vend.
 * - `app`    : la façade en banco à torons — une application bâtie, avec ses
 *              pièces (interface, serveur, réserve de données).
 * - `plan`   : le filet de pêche — le plan de l'application, ses nœuds et liens.
 * - `golive` : la pirogue à la proue dressée — le départ, la mise en ligne.
 */
export type SiteAppScene = 'site' | 'app' | 'plan' | 'golive';

@Component({
  selector: 'app-site-app-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 120 / 88;
      color: var(--color-text-tertiary);
      transition: color 0.3s ease;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .accent {
      color: var(--color-primary-500);
    }
  `,
  template: `
    <svg
      viewBox="0 0 120 88"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (scene()) {
        @case ('site') {
          <!-- Site vitrine : l'étal du marché, où l'on montre ce qu'on vend. -->
          <path d="M10 80 H110" opacity=".4" />
          <path d="M16 22 L60 10 L104 22 Z" stroke-width="2" />
          <path d="M16 22 L24 28 L32 22 L40 28 L48 22 L56 28 L64 22 L72 28 L80 22 L88 28 L96 22 L104 28" stroke-width="1.2" />
          <path d="M22 24 V80 M98 24 V80" stroke-width="1.8" />
          <path d="M18 58 H102" stroke-width="2" />
          <path d="M26 58 V80 M94 58 V80" stroke-width="1.2" opacity=".7" />
          <path d="M30 58 C30 50 42 50 42 58" />
          <path d="M46 58 C46 46 62 46 62 58" />
          <path d="M34 50 L38 54 M50 50 L54 54 M58 50 L55 54" stroke-width="1" opacity=".6" />
          <g class="accent">
            <path d="M68 58 C66 48 70 42 78 42 C86 42 90 48 88 58" stroke-width="1.8" />
            <path d="M72 46 C74 44 82 44 84 46" stroke-width="1.2" />
          </g>
          <path d="M34 66 L38 70 L42 66 L46 70 L50 66 M70 66 L74 70 L78 66 L82 70 L86 66" stroke-width="1" opacity=".55" />
        }
        @case ('app') {
          <!-- Application complète : la façade en banco, un bâtiment construit pour durer. -->
          <path d="M12 80 H108" opacity=".4" />
          <path d="M20 80 V22 M36 80 V22 M84 80 V22 M100 80 V22" stroke-width="1.3" />
          <path d="M20 22 C20 14 28 10 28 4 C28 10 36 14 36 22 M84 22 C84 14 92 10 92 4 C92 10 100 14 100 22" stroke-width="1.4" />
          <path d="M52 22 C52 16 56 14 60 8 C64 14 68 16 68 22" stroke-width="1.4" />
          <path d="M20 22 H100 V80 H20Z" stroke-width="1.6" />
          <path d="M26 26 h8 M42 26 h8 M70 26 h8 M86 26 h8 M26 44 h8 M42 44 h8 M70 44 h8 M86 44 h8 M26 62 h8 M42 62 h8 M70 62 h8 M86 62 h8" stroke-width="1.8" />
          <path d="M42 32 L46 36 L50 32 M70 32 L74 36 L78 32" stroke-width="0.8" opacity=".6" />
          <g class="accent">
            <path d="M52 80 V58 C52 52 56 50 60 50 C64 50 68 52 68 58 V80" stroke-width="1.6" />
            <path d="M60 50 V44" stroke-width="1.1" />
          </g>
        }
        @case ('plan') {
          <!-- Le plan : le filet de pêche (épervier), un réseau de nœuds et de liens. -->
          <path d="M60 12 V4 C60 2 64 2 64 4" stroke-width="1.6" />
          <path d="M60 12 L18.2 72.5 M60 12 L24.4 74.7 M60 12 L34.1 76.5 M60 12 L46.4 77.6 M60 12 L60 78 M60 12 L73.6 77.6 M60 12 L85.9 76.5 M60 12 L95.6 74.7 M60 12 L101.8 72.5" stroke-width="1.1" opacity=".75" />
          <path d="M45.4 33.2 L47.5 33.9 L50.9 34.6 L55.2 35 L60 35.1 L64.8 35 L69.1 34.6 L72.5 33.9 L74.6 33.2 M34.9 48.3 L38.6 49.6 L44.5 50.7 L51.8 51.4 L60 51.6 L68.2 51.4 L75.5 50.7 L81.4 49.6 L85.1 48.3 M25.7 61.6 L30.8 63.4 L38.8 64.9 L48.9 65.8 L60 66.1 L71.1 65.8 L81.2 64.9 L89.2 63.4 L94.3 61.6" stroke-width="1.1" opacity=".75" />
          <path d="M18.2 72.5 L24.4 74.7 L34.1 76.5 L46.4 77.6 L60 78 L73.6 77.6 L85.9 76.5 L95.6 74.7 L101.8 72.5" stroke-width="2" />
          <path d="M18.2 75.5h0.01 M24.4 77.7h0.01 M34.1 79.5h0.01 M46.4 80.6h0.01 M60 81h0.01 M73.6 80.6h0.01 M85.9 79.5h0.01 M95.6 77.7h0.01 M101.8 75.5h0.01" stroke-width="4" />
          <g class="accent">
            <circle cx="68.2" cy="51.4" r="3.2" stroke-width="1.8" />
          </g>
        }
        @case ('golive') {
          <!-- Mise en ligne : la pirogue à la proue dressée, prête à prendre le large. -->
          <path d="M8 38 C12 44 16 50 24 56 C40 66 82 66 98 56 C104 52 108 44 112 34" stroke-width="2" />
          <path d="M8 38 C18 46 40 50 60 50 C80 50 100 46 112 34" stroke-width="1.6" />
          <path d="M20 48 L26 55.4 L28.5 50.6 L35.1 57.6 L38.7 52.5 L45.3 59.1 L50 53.5 L56.2 59.7 L61.8 53.8 L67.3 59.6 L73.4 53.1 L78 58.5 L84.4 51.7 L87.8 56.6 L94.1 49.3 L96.4 53.8 L102 46" stroke-width="1.1" opacity=".75" />
          <path d="M44 50 L36 28 M36 28 L33 22 C32 20 34 19 35 21 L38 27" stroke-width="1.6" />
          <g class="accent">
            <path d="M112 34 L116 26 L110 30 Z" stroke-width="1.8" />
            <path d="M104 44 L107 40 L110 44 L107 48 Z" stroke-width="1.6" />
          </g>
          <path d="M14 72 C20 68 26 68 32 72 S44 76 50 72 S62 68 68 72 S80 76 86 72 S98 68 104 72" opacity=".5" />
          <path d="M30 80 C36 77 42 77 48 80 S60 83 66 80 S78 77 84 80" opacity=".3" />
        }
      }
    </svg>
  `,
})
export class SiteAppIllustrationComponent {
  readonly scene = input.required<SiteAppScene>();
}
