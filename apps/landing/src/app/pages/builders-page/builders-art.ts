import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les illustrations propres à la page Idem Builders, dessinées pour elle.
 *
 * Trois objets nouveaux, chacun choisi pour ce que dit sa section (AGENTS.md
 * § 4, sources dans `docs/ILLUSTRATIONS.md`) :
 *
 *  - `mortar` — le mortier et son pilon : le geste de chaque jour, celui dont
 *    le bruit annonce que la maison tourne. Gérer son projet avec IDEM, au
 *    quotidien. Le pilon, ce qui agit, porte la couleur ;
 *  - `ishango` — l'os d'Ishango, le plus ancien outil de comptage connu : ses
 *    encoches groupées sont les étapes. Il sert de frise au-dessus des quatre
 *    étapes, un groupe d'encoches par étape ;
 *  - `gankogui` — la cloche double ewe, sur laquelle tout l'ensemble se cale,
 *    dans une musique d'appel et de réponse : les questions et leurs
 *    réponses. La baguette qui frappe porte la couleur.
 *
 * Deux encres, au trait, décoratif pour les lecteurs d'écran.
 */
export type BuildersArtScene = 'mortar' | 'ishango' | 'gankogui';

@Component({
  selector: 'app-builders-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      color: var(--color-text-secondary);
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .accent {
      color: var(--color-primary-500);
    }
    /* La frise s'étire sur toute la largeur : son trait garde l'épaisseur
       des autres dessins au lieu de grossir avec elle. */
    .frieze * {
      vector-effect: non-scaling-stroke;
    }

    /* Le pilon bat lentement, comme on pile : une montée, une frappe. */
    .pestle {
      transform-box: fill-box;
      transform-origin: 50% 100%;
    }
    .ring {
      transform-box: fill-box;
      transform-origin: 0% 50%;
    }
    @media (prefers-reduced-motion: no-preference) {
      .pestle {
        animation: pound 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }
      .ring {
        animation: ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      }
    }
    @keyframes pound {
      0%,
      100% {
        transform: translateY(0);
      }
      45% {
        transform: translateY(-10px);
      }
      60% {
        transform: translateY(0);
      }
    }
    @keyframes ring {
      0%,
      55% {
        opacity: 0;
        transform: scale(0.85);
      }
      65% {
        opacity: 0.6;
      }
      100% {
        opacity: 0;
        transform: scale(1.15);
      }
    }
  `,
  template: `
    @switch (scene()) {
      @case ('mortar') {
        <svg
          viewBox="0 0 220 220"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Le sol -->
          <path d="M36 204 H184" opacity=".35" />

          <!-- Le mortier taillé dans une pièce : coupe, taille fine, pied évasé -->
          <ellipse cx="110" cy="86" rx="50" ry="10" />
          <path d="M70 87.5 Q110 95 150 87.5" opacity=".45" />
          <path d="M60 86 C62 114 80 128 88 140 C80 158 68 178 66 196" />
          <path d="M160 86 C158 114 140 128 132 140 C140 158 152 178 154 196" />
          <path d="M66 196 Q110 208 154 196" />
          <!-- Les deux bagues sculptées de la taille -->
          <path d="M86 134 Q110 140 134 134 M86 146 Q110 152 134 146" stroke-width="1.6" />
          <!-- La frise de chevrons gravée sur la coupe -->
          <path
            d="M68 106 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7"
            stroke-width="1.4"
            opacity=".7"
          />
          <!-- Les losanges du pied -->
          <path
            d="M96 176 l4 -5 l4 5 l-4 5 Z M108 178 l4 -5 l4 5 l-4 5 Z M120 176 l4 -5 l4 5 l-4 5 Z"
            stroke-width="1.3"
            opacity=".7"
          />

          <!-- Le bruit de la frappe, qui dit que la maison tourne -->
          <g opacity=".55" stroke-width="1.6">
            <path class="ring" d="M44 64 q-8 10 0 20" />
            <path class="ring" d="M34 58 q-12 16 0 32" />
          </g>

          <!-- Le pilon : ce qui agit -->
          <g class="accent">
            <path
              class="pestle"
              d="M118 95 C124 78 132 58 138 40 C141 30 140 20 146 12 C150 6 160 6 164 12 C168 18 164 26 160 34 C152 52 142 74 134 97"
              stroke-width="2.4"
            />
          </g>
        </svg>
      }

      @case ('ishango') {
        <!-- L'os, posé à plat, légèrement arqué ; le quartz serti à gauche.
             Quatre groupes d'encoches (3, 6, 4, 8 — les premiers de la colonne
             centrale de l'original), centrés sur les quatre colonnes des
             étapes. -->
        <svg
          class="frieze"
          viewBox="0 0 480 96"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Le quartz, taillé à facettes -->
          <path d="M6 50 L16 34 L30 38 L34 52 L22 64 Z" stroke-width="1.8" />
          <path d="M16 34 L22 50 L34 52 M22 50 L22 64" stroke-width="1" opacity=".55" />
          <!-- L'os : tête renflée à gauche, fût arqué, extrémité noueuse à droite -->
          <path
            d="M32 40 C38 30 52 28 62 34 C70 38 80 36 96 34 C190 26 300 26 392 34 C408 35 420 30 434 26 C452 22 470 30 472 46 C474 62 458 72 440 68 C426 65 414 60 396 62 C300 70 190 70 96 64 C80 63 70 62 62 66 C50 72 36 66 32 56"
          />
          <!-- Le fil de l'os et ses pores -->
          <path d="M100 48 C200 44 300 44 390 48" stroke-width="1" opacity=".3" />
          <path d="M44 46 h.01 M52 54 h.01 M448 40 h.01 M456 52 h.01 M444 58 h.01" stroke-width="2.4" opacity=".4" />
          <!-- Les encoches, groupe par groupe -->
          <g class="accent" stroke-width="2.2">
            <path d="M54 39 l-3 18 M61 38 l-3 18 M68 38 l-3 18" />
            <path
              d="M164 33 l-3 30 M171 33 l-3 30 M178 33 l-3 30 M185 33 l-3 30 M192 33 l-3 30 M199 33 l-3 30"
            />
            <path d="M290 33 l-3 30 M297 33 l-3 30 M304 33 l-3 30 M311 33 l-3 30" />
            <path
              d="M396 36 l-3 26 M403 36 l-3 26 M410 35 l-3 26 M417 34 l-3 26 M424 33 l-3 26 M431 32 l-3 26 M438 31 l-3 26 M445 31 l-3 28"
            />
          </g>
        </svg>
      }

      @case ('gankogui') {
        <svg
          viewBox="0 0 220 220"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- La grande cloche : un cône de fer forgé, droit, la lèvre ourlée -->
          <path d="M72 172 C68 130 60 82 54 48" />
          <path d="M88 172 C94 130 102 82 108 48" />
          <ellipse cx="81" cy="46" rx="27" ry="7.5" />
          <ellipse cx="81" cy="46" rx="21" ry="4.5" opacity=".45" />
          <path d="M80 166 C78 128 74 92 70 60" stroke-width="1.2" opacity=".4" />
          <!-- La petite cloche, plus courte, plus aiguë -->
          <path d="M134 172 C131 144 127 116 123 92" />
          <path d="M148 172 C152 144 157 116 162 92" />
          <ellipse cx="142.5" cy="90" rx="19.5" ry="5.5" />
          <ellipse cx="142.5" cy="90" rx="14" ry="3" opacity=".45" />
          <path d="M141 166 C140 140 138 118 136 100" stroke-width="1.2" opacity=".4" />
          <!-- La poignée en U qui les réunit, et la prise -->
          <path d="M72 172 C72 192 92 196 110 196 C128 196 148 192 148 172" />
          <path d="M88 172 C88 182 98 185 110 185 C122 185 134 182 134 172" />
          <path d="M104 196 V214 M116 196 V214 M104 214 H116" />

          <!-- L'appel, et la réponse qui revient -->
          <g opacity=".6" stroke-width="1.6">
            <path class="ring" d="M38 30 q-12 12 -4 30" />
            <path class="ring" d="M178 74 q12 10 6 28" />
          </g>

          <!-- La baguette qui frappe la grande cloche -->
          <g class="accent">
            <path d="M204 20 L112 58" stroke-width="3" />
            <path d="M204 20 L211 17" stroke-width="5" />
          </g>
        </svg>
      }
    }
  `,
})
export class BuildersArtComponent {
  readonly scene = input.required<BuildersArtScene>();
}
