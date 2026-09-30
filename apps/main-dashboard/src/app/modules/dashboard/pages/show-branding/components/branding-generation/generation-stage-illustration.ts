import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GenerationPhase } from './generation-chapters';

/**
 * L'illustration animée de la génération : ce que l'atelier est en train de
 * faire, phase par phase, chaque fois avec un objet de la culture africaine —
 * le tampon adinkra imprime le logo, les canaris de teinture donnent les
 * couleurs, la calebasse pyrogravée porte les lettres, les bandes de kente
 * composent, le panier reçoit la marque, le tambour parleur la diffuse, les
 * pagnes pliés rassemblent la charte.
 *
 * Règles des illustrations (AGENTS.md § 4) : SVG dans le code, au trait,
 * `currentColor` pour le trait et `--color-primary-500` pour le seul détail
 * qui compte. Les tracés utilisent `pathLength="100"` : une seule animation
 * de dessin sert toutes les formes. Mouvement réduit → l'état final, immobile.
 */
@Component({
  selector: 'app-generation-stage-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      class="stage"
      viewBox="0 0 240 180"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (phase()) {
        @case ('logo') {
          <!-- Le tampon adinkra se pose, et le signe s'imprime sur l'étoffe -->
          <g class="nib">
            <g transform="translate(6 34) scale(1.5)" stroke-width="1">
              <path d="M34 12 L26 44 M34 12 L42 44 M34 12 L20 40 M34 12 L48 40" stroke-width="1.1"/>
              <path d="M30 10 H38" stroke-width="1.6"/>
              <ellipse cx="34" cy="52" rx="22" ry="9" stroke-width="1.3"/>
              <path d="M12 52 V56 C12 61 22 65 34 65 C46 65 56 61 56 56 V52" stroke-width="1.1"/>
              <g transform="translate(34 52) scale(.9 .36)">
                <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" stroke-width="1.6"/>
              </g>
            </g>
          </g>
          <rect x="118" y="36" width="96" height="112" rx="2" stroke-width="2"/>
          <path d="M118 50 H214 M118 134 H214" stroke-width="1" opacity=".55"/>
          <path d="M124 42 L128 46 L132 42 L136 46 L140 42 L144 46 L148 42 L152 46 L156 42 L160 46 L164 42 L168 46 L172 42 L176 46 L180 42 L184 46 L188 42 L192 46 L196 42 L200 46 L204 42 L208 46" stroke-width=".9" opacity=".55"/>
          <g style="color: var(--color-primary-500)" transform="translate(166 92)">
            <path class="draw" pathLength="100" d="M0 -26 L26 0 L0 26 L-26 0Z" stroke-width="2.5"/>
            <path class="draw d2" pathLength="100" d="M0 -12 L12 0 L0 12 L-12 0Z" stroke-width="2.5"/>
            <path class="draw d2" pathLength="100" d="M-26 0 H-36 M26 0 H36 M0 -26 V-36 M0 26 V36" stroke-width="2.5"/>
          </g>
        }
        @case ('colors') {
          <!-- L'étoffe trempe dans les canaris de teinture ; chaque bain prend sa couleur -->
          <path d="M36 150 H204" opacity=".4"/>
          <path d="M51 92 C48 118 55 150 66 150 C77 150 84 118 81 92" stroke-width="2"/>
          <path d="M54 118 L59 123 L64 118 L69 123 L74 118 L78 122" stroke-width="1" opacity=".6"/>
          <ellipse cx="66" cy="92" rx="15" ry="4.5" stroke-width="2"/>
          <ellipse class="pop" style="color: var(--color-primary-500); animation-delay: 0s" cx="66" cy="92" rx="10" ry="2.6" stroke-width="2.5"/>
          <path d="M87 92 C84 118 91 150 102 150 C113 150 120 118 117 92" stroke-width="2"/>
          <path d="M90 118 L95 123 L100 118 L105 123 L110 118 L114 122" stroke-width="1" opacity=".6"/>
          <ellipse cx="102" cy="92" rx="15" ry="4.5" stroke-width="2"/>
          <ellipse class="pop" style="color: var(--color-primary-500); animation-delay: 0.35s" cx="102" cy="92" rx="10" ry="2.6" stroke-width="2.5"/>
          <path d="M123 92 C120 118 127 150 138 150 C149 150 156 118 153 92" stroke-width="2"/>
          <path d="M126 118 L131 123 L136 118 L141 123 L146 118 L150 122" stroke-width="1" opacity=".6"/>
          <ellipse cx="138" cy="92" rx="15" ry="4.5" stroke-width="2"/>
          <ellipse class="pop" style="color: var(--color-primary-500); animation-delay: 0.7s" cx="138" cy="92" rx="10" ry="2.6" stroke-width="2.5"/>
          <path d="M159 92 C156 118 163 150 174 150 C185 150 192 118 189 92" stroke-width="2"/>
          <path d="M162 118 L167 123 L172 118 L177 123 L182 118 L186 122" stroke-width="1" opacity=".6"/>
          <ellipse cx="174" cy="92" rx="15" ry="4.5" stroke-width="2"/>
          <ellipse class="pop" style="color: var(--color-primary-500); animation-delay: 1.05s" cx="174" cy="92" rx="10" ry="2.6" stroke-width="2.5"/>
          <path d="M84 30 H156 M112 30 C112 50 116 66 116 86 M124 30 C124 50 120 66 120 86" stroke-width="1.6"/>
        }
        @case ('type') {
          <!-- La calebasse pyrogravée : les lettres gravées sur leurs lignes -->
          <ellipse cx="120" cy="58" rx="66" ry="14" stroke-width="2"/>
          <path d="M54 58 C54 110 84 150 120 150 C156 150 186 110 186 58" stroke-width="2"/>
          <path class="guide" d="M64 84 C90 94 150 94 176 84 M62 128 H178"/>
          <text x="84" y="128" font-size="52" font-family="Georgia, 'Times New Roman', serif" stroke-width="1.5">Aa</text>
          <path class="caret" style="color: var(--color-primary-500)" d="M156 92 V130" stroke-width="3"/>
          <path d="M92 144 h0.01 M120 148 h0.01 M148 144 h0.01" stroke-width="3"/>
        }
        @case ('direction') {
          <!-- Les bandes de kente s'assemblent : la composition prend forme -->
          <rect x="60" y="22" width="40" height="136" stroke-width="2"/>
          <path class="slide s1" d="M66 29 h28 v18 h-28z M66 38 h28" stroke-width="1.2"/>
          <path class="slide s2" d="M80 54.4 L91 64.4 L80 74.4 L69 64.4Z" stroke-width="1.2"/>
          <path class="slide s3" d="M66 81.8 h28 v18 h-28z M66 90.8 h28" stroke-width="1.2"/>
          <path class="slide s4" d="M80 107.2 L91 117.2 L80 127.2 L69 117.2Z" stroke-width="1.2"/>
          <path class="slide s1" d="M66 134.6 h28 v18 h-28z M66 143.6 h28" stroke-width="1.2"/>
          <rect x="100" y="22" width="40" height="136" stroke-width="2"/>
          <path class="slide s2" d="M120 28 L131 38 L120 48 L109 38Z" stroke-width="1.2"/>
          <path class="slide s3" d="M106 55.4 h28 v18 h-28z M106 64.4 h28" stroke-width="1.2"/>
          <path class="slide s4" style="color: var(--color-primary-500)" d="M120 79.8 L132 90.8 L120 101.8 L108 90.8Z M120 85.8 L126 90.8 L120 95.8 L114 90.8Z" stroke-width="2"/>
          <path class="slide s1" d="M106 108.2 h28 v18 h-28z M106 117.2 h28" stroke-width="1.2"/>
          <path class="slide s2" d="M120 133.6 L131 143.6 L120 153.6 L109 143.6Z" stroke-width="1.2"/>
          <rect x="140" y="22" width="40" height="136" stroke-width="2"/>
          <path class="slide s3" d="M146 29 h28 v18 h-28z M146 38 h28" stroke-width="1.2"/>
          <path class="slide s4" d="M160 54.4 L171 64.4 L160 74.4 L149 64.4Z" stroke-width="1.2"/>
          <path class="slide s1" d="M146 81.8 h28 v18 h-28z M146 90.8 h28" stroke-width="1.2"/>
          <path class="slide s2" d="M160 107.2 L171 117.2 L160 127.2 L149 117.2Z" stroke-width="1.2"/>
          <path class="slide s3" d="M146 134.6 h28 v18 h-28z M146 143.6 h28" stroke-width="1.2"/>
        }
        @case ('mockups') {
          <!-- La marque passe sur les objets : le panier tressé reçoit le signe -->
          <g transform="translate(12 10) scale(1.8)" stroke-width="0.8">
            <path d="M40 40 C38 16 82 16 80 40" stroke-width="1.1"/>
            <path d="M44 40 C43 22 77 22 76 40" opacity=".55"/>
            <path d="M36 26 L40 30 M84 26 L80 30" opacity=".6"/>
            <ellipse cx="60" cy="42" rx="34" ry="6" stroke-width="1.1"/>
            <path d="M26 42 C26 62 34 78 60 78 C86 78 94 62 94 42" stroke-width="1.1"/>
            <path d="M28 46 L33.3 52 L38.7 46 L44 52 L49.3 46 L54.7 52 L60 46 L65.3 52 L70.7 46 L76 52 L81.3 46 L86.7 52 L92 46 M30 55 L35 61 L40 55 L45 61 L50 55 L55 61 L60 55 L65 61 L70 55 L75 61 L80 55 L85 61 L90 55 M32 64 L36.7 70 L41.3 64 L46 70 L50.7 64 L55.3 70 L60 64 L64.7 70 L69.3 64 L74 70 L78.7 64 L83.3 70 L88 64" stroke-width="0.6" opacity=".7"/>
          </g>
          <g style="color: var(--color-primary-500)" transform="translate(120 112)">
            <path class="draw" pathLength="100" d="M0 -13 L13 0 L0 13 L-13 0Z" stroke-width="2.5"/>
            <path class="draw d2" pathLength="100" d="M0 -6 L6 0 L0 6 L-6 0Z" stroke-width="2.5"/>
          </g>
          <path class="flash" d="M196 42 v12 M190 48 h12 M44 70 v10 M39 75 h10"/>
        }
        @case ('social') {
          <!-- Le tambour parleur porte la marque sur les réseaux -->
          <g transform="translate(12 2) scale(1.8)" stroke-width="0.8">
            <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="1.1"/>
            <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="1.1"/>
            <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
            <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="0.6" opacity=".6"/>
            <path d="M44 44 H76" stroke-width="0.7" opacity=".6"/>
            <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="0.7" opacity=".75"/>
            <path d="M78 76 C88 70 94 62 96 52" stroke-width="1.1"/>
          </g>
          <g class="rise" style="color: var(--color-primary-500)" stroke-width="2.2">
            <path d="M178 50 C185 58 185 72 178 80"/>
            <path d="M190 40 C202 54 202 76 190 90"/>
            <path d="M62 50 C55 58 55 72 62 80"/>
            <path d="M50 40 C38 54 38 76 50 90"/>
          </g>
        }
        @case ('usage') {
          <!-- Les règles d'usage : le signe bien posé, le signe de travers -->
          <rect x="30" y="34" width="84" height="112" rx="2" stroke-width="2"/>
          <path d="M30 46 H114 M30 134 H114" stroke-width="1" opacity=".55"/>
          <g style="color: var(--color-primary-500)" transform="translate(72 90)">
            <path class="draw" pathLength="100" d="M0 -20 L20 0 L0 20 L-20 0Z" stroke-width="2.5"/>
            <path class="draw d2" pathLength="100" d="M0 -9 L9 0 L0 9 L-9 0Z" stroke-width="2.5"/>
          </g>
          <rect x="126" y="34" width="84" height="112" rx="2" stroke-width="2"/>
          <path d="M126 46 H210 M126 134 H210" stroke-width="1" opacity=".55"/>
          <g transform="translate(182 76) rotate(28) scale(1 .6)">
            <path d="M0 -20 L20 0 L0 20 L-20 0Z M0 -9 L9 0 L0 9 L-9 0Z" stroke-width="1.8"/>
          </g>
          <path d="M156 110 L172 126 M172 110 L156 126" stroke-width="2"/>
        }
        @default {
          <!-- Finalisation : les pagnes se plient en une pile, la charte est prête -->
          <g transform="translate(30 22) scale(1.5)" stroke-width="1">
            <path d="M16 80 H104" opacity=".4"/>
            <path d="M20 64 H100 V78 H20Z" stroke-width="1.3"/>
            <path d="M25 71h0.01 M31 71h0.01 M37 71h0.01 M43 71h0.01 M49 71h0.01 M55 71h0.01 M61 71h0.01 M67 71h0.01 M73 71h0.01 M79 71h0.01 M85 71h0.01 M91 71h0.01" stroke-width="1.6"/>
            <path d="M23 48 H97 V62 H23Z" stroke-width="1.3"/>
            <path d="M26 51 L30.9 59 L35.7 51 L40.6 59 L45.4 51 L50.3 59 L55.1 51 L60 59 L64.9 51 L69.7 59 L74.6 51 L79.4 59 L84.3 51 L89.1 59 L94 51" stroke-width="0.7"/>
            <path d="M26 32 H94 V46 H26Z" stroke-width="1.3"/>
            <path d="M30 35h5v8h-5z M46 35h5v8h-5z M62 35h5v8h-5z M78 35h5v8h-5z" stroke-width="0.7"/>
            <path d="M26 39 H94" stroke-width="0.5" opacity=".6"/>
            <path d="M29 16 H91 V30 H29Z" stroke-width="1.3"/>
            <path d="M32 19 L36.7 27 L41.3 19 L46 27 L50.7 19 L55.3 27 L60 19 L64.7 27 L69.3 19 L74 27 L78.7 19 L83.3 27 L88 19" stroke-width="0.7"/>
            <g style="color: var(--color-primary-500)">
              <path class="draw" pathLength="100" d="M60 18 L65 23 L60 28 L55 23Z" stroke-width="1.2"/>
            </g>
          </g>
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--color-text-tertiary);
      }

      .stage {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .accent {
        stroke: var(--color-primary-500);
      }

      .guide {
        stroke-dasharray: 3 5;
        opacity: 0.55;
      }

      text {
        fill: none;
        stroke: currentColor;
      }

      /* Dessin d'un tracé, en boucle, avec un temps de pose. */
      .draw {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: draw 3.2s ease-in-out infinite;
      }
      .d2 {
        animation-delay: 0.45s;
      }
      @keyframes draw {
        0% { stroke-dashoffset: 100; opacity: 1; }
        45%, 85% { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }

      .pop {
        transform-box: fill-box;
        transform-origin: center;
        animation: pop 2.8s ease-in-out infinite both;
      }
      @keyframes pop {
        0%, 15% { transform: scale(0); opacity: 0; }
        35%, 80% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1); opacity: 0; }
      }

      .nib {
        animation: nib 3.2s ease-in-out infinite;
      }
      @keyframes nib {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-10px, -8px); }
      }


      .caret {
        animation: blink 1.1s steps(1) infinite;
      }
      @keyframes blink {
        50% { opacity: 0; }
      }

      .slide {
        animation: slide 3.6s ease-out infinite both;
      }
      .s2 { animation-delay: 0.25s; }
      .s3 { animation-delay: 0.5s; }
      .s4 { animation-delay: 0.75s; }
      @keyframes slide {
        0% { transform: translateY(8px); opacity: 0; }
        25%, 85% { transform: translateY(0); opacity: 1; }
        100% { opacity: 0; }
      }

      .flash {
        animation: blink 1.6s steps(1) infinite;
      }

      .rise {
        animation: rise 3.4s ease-out infinite both;
      }
      @keyframes rise {
        0% { transform: translateY(26px); opacity: 0; }
        30%, 85% { transform: translateY(0); opacity: 1; }
        100% { opacity: 0; }
      }


      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
        }
        .draw {
          stroke-dashoffset: 0;
        }
        .pop,
        .rise,
        .slide {
          opacity: 1;
          transform: none;
        }
      }
    `,
  ],
})
export class GenerationStageIllustrationComponent {
  readonly phase = input<GenerationPhase>('logo');
}
