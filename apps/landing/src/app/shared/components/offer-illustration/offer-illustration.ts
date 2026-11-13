import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ce que dit une offre, dessiné (AGENTS.md § 4) : un objet de la culture africaine par sens, au
 * trait, deux encres. Les dessins sont ceux du répertoire (`docs/ILLUSTRATIONS.md`), repris du
 * tableau de bord pour qu'un même sens ait le même visage partout :
 *
 *  - `wallet`   calebasse de cauris : l'argent, le portefeuille ;
 *  - `sprout`   jeune pousse : le projet qu'on commence, gratuitement ;
 *  - `kit`      pagnes pliés en pile : les livrables complets ;
 *  - `launch`   pirogue à la proue dressée : le départ, la mise en ligne ;
 *  - `drum`     tambour parleur : la communication de chaque mois ;
 *  - `tontine`  calebasse de la tontine : acheter à plusieurs ;
 *  - `measure`  la mesure du marché, rase : on achète au bol la quantité voulue, à prix connu
 *               — « ne payez que ce que vous gardez » (héros des tarifs) ;
 *  - `kyinie`   l'ombrelle d'apparat akan (« le roi couvre ») : à l'abri des mauvaises surprises
 *               (garanties des tarifs ; même dessin que le simulateur, même sens).
 *
 * Décoratif (`aria-hidden`) : le texte voisin porte le sens.
 */
export type OfferIllustrationKind = 'wallet' | 'sprout' | 'kit' | 'launch' | 'drum' | 'tontine' | 'measure' | 'kyinie';

@Component({
  selector: 'app-offer-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 120 / 88;
      color: var(--color-text-tertiary);
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
    <svg viewBox="0 0 120 88" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      @switch (kind()) {
        @case ('wallet') {
          <g transform="translate(0 6)">
            <g stroke-width="1.6">
              <g transform="translate(44 30) rotate(-24) scale(0.62)">
                <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6" />
                <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2" />
              </g>
              <g transform="translate(76 29) rotate(20) scale(0.62)">
                <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6" />
                <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2" />
              </g>
            </g>
            <path d="M16 36 C16 60 36 74 60 74 C84 74 104 60 104 36" stroke-width="1.8" />
            <path d="M14 36 H106" stroke-width="2" />
            <path d="M28 52 L34 47 L40 52 L46 47 L52 52 L58 47 L64 52 L70 47 L76 52 L82 47 L88 52 L92 49" stroke-width="1.3" opacity=".7" />
            <path d="M34 62 H86" stroke-width="1.2" opacity=".5" />
            <g class="accent" transform="translate(60 25) scale(0.78)">
              <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.4" />
              <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2" />
              <path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.6" />
            </g>
          </g>
        }
        @case ('sprout') {
          <g transform="translate(-6 -2) scale(1.1)" stroke-width="1.4">
            <path d="M30 76 H90" opacity=".4" />
            <path d="M40 76 C44 70 76 70 80 76" />
            <path d="M60 72 C58 62 58 52 60 42" stroke-width="1.8" />
            <path d="M60 56 C52 56 44 52 42 42 C50 42 58 46 60 56Z" />
            <path d="M50 49 L56 53" opacity=".55" />
            <g class="accent">
              <path d="M60 46 C66 44 74 38 76 28 C68 28 60 34 60 46Z" stroke-width="1.6" />
              <path d="M63 40 L70 34" stroke-width="1.1" />
            </g>
          </g>
        }
        @case ('kit') {
          <g transform="translate(0 2)" stroke-width="1.4">
            <path d="M16 80 H104" opacity=".4" />
            <path d="M20 64 H100 V78 H20Z" />
            <path d="M25 71h0.01 M31 71h0.01 M37 71h0.01 M43 71h0.01 M49 71h0.01 M55 71h0.01 M61 71h0.01 M67 71h0.01 M73 71h0.01 M79 71h0.01 M85 71h0.01 M91 71h0.01" stroke-width="2.2" />
            <path d="M23 48 H97 V62 H23Z" />
            <path d="M26 51 L30.9 59 L35.7 51 L40.6 59 L45.4 51 L50.3 59 L55.1 51 L60 59 L64.9 51 L69.7 59 L74.6 51 L79.4 59 L84.3 51 L89.1 59 L94 51" stroke-width="0.9" />
            <path d="M26 32 H94 V46 H26Z" />
            <path d="M30 35h5v8h-5z M46 35h5v8h-5z M62 35h5v8h-5z M78 35h5v8h-5z" stroke-width="0.9" />
            <path d="M29 16 H91 V30 H29Z" />
            <path d="M32 19 L36.7 27 L41.3 19 L46 27 L50.7 19 L55.3 27 L60 19 L64.7 27 L69.3 19 L74 27 L78.7 19 L83.3 27 L88 19" stroke-width="0.9" />
            <path class="accent" d="M60 4 L66 10 L60 16 L54 10Z" stroke-width="1.8" />
          </g>
        }
        @case ('launch') {
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
        @case ('drum') {
          <g transform="translate(0 4)" stroke-width="1.6">
            <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="2" />
            <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="2" />
            <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68" />
            <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="1" opacity=".6" />
            <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="1.2" opacity=".75" />
            <path d="M78 76 C88 70 94 62 96 52" stroke-width="2" />
            <g class="accent" stroke-width="1.8">
              <path d="M88 22 C92 26 92 32 88 36" />
              <path d="M94 16 C101 23 101 35 94 42" />
              <path d="M32 22 C28 26 28 32 32 36" />
              <path d="M26 16 C19 23 19 35 26 42" />
            </g>
          </g>
        }
        @case ('measure') {
          <!-- La mesure du marché : le bol rempli de grain, arasé par la règle de bois (en couleur) —
               on achète exactement la quantité voulue, à un prix connu par mesure. Quelques grains
               tombent sur la natte : ce qu'on ne prend pas, on ne le paie pas. -->
          <path d="M10 80 H110" stroke-width="1.2" opacity=".45" />
          <path d="M14 80 L18 76 M24 80 L28 76 M34 80 L38 76 M84 80 L88 76 M94 80 L98 76" stroke-width="1" opacity=".35" />
          <ellipse cx="56" cy="42" rx="34" ry="7" stroke-width="1.8" />
          <path d="M22 42 C22 64 38 74 56 74 C74 74 90 64 90 42" stroke-width="1.8" />
          <path d="M30 56 L35 52 L40 56 L45 52 L50 56 L55 52 L60 56 L65 52 L70 56 L75 52 L80 56" stroke-width="1.2" opacity=".6" />
          <path d="M36 66 H76" stroke-width="1" opacity=".45" />
          <path d="M27 40 C30 35 40 33 56 33 C72 33 82 35 85 40" stroke-width="1.5" />
          <path d="M34 38 h.01 M40 36 h.01 M46 37 h.01 M52 35 h.01 M58 36 h.01 M64 35 h.01 M70 37 h.01 M76 36 h.01 M44 40 h.01 M62 40 h.01 M74 40 h.01" stroke-width="2.4" opacity=".7" />
          <path d="M96 48 h.01 M99 57 h.01 M101 66 h.01" stroke-width="2.4" opacity=".6" />
          <path d="M94 80 C97 74 105 74 108 80" stroke-width="1.4" />
          <path d="M98 78 h.01 M102 77 h.01 M105 78 h.01" stroke-width="2.2" opacity=".7" />
          <g class="accent">
            <path d="M16 31 L98 33" stroke-width="2.4" />
            <path d="M98 33 L106 33.2" stroke-width="3.2" />
          </g>
        }
        @case ('kyinie') {
          <!-- À l'abri des mauvaises surprises : le kyinie, l'ombrelle d'apparat akan (« le roi couvre »),
               qui protège de la pluie et du soleil. La flèche de son sommet porte la couleur. -->
          <path d="M8 22 L5 30 M15 12 L12 20 M10 40 L7 48 M112 22 L115 30 M105 12 L108 20 M110 40 L113 48" stroke-width="1.3" opacity=".45" />
          <path d="M16 48 C20 28 38 16 60 16 C82 16 100 28 104 48" stroke-width="2" />
          <path d="M16 48 Q22 56 28 48 Q34 56 40 48 Q46 56 52 48 Q58 56 64 48 Q70 56 76 48 Q82 56 88 48 Q94 56 100 48 Q102 52 104 48" stroke-width="1.6" />
          <path d="M22 38 C34 32 86 32 98 38" stroke-width="1" opacity=".6" />
          <path d="M26 33 L30 37 L34 33 L38 37 L42 33 L46 37 L50 33 L54 37 L58 33 L62 37 L66 33 L70 37 L74 33 L78 37 L82 33 L86 37 L90 33 L94 37" stroke-width=".9" opacity=".7" />
          <path d="M40 22 C46 26 50 34 50 44 M80 22 C74 26 70 34 70 44" stroke-width=".9" opacity=".5" />
          <path d="M60 48 V84 M54 84 H66" stroke-width="2" />
          <g class="accent">
            <path d="M60 16 V10" stroke-width="1.6" />
            <path d="M60 2 L64 6 L60 10 L56 6Z" stroke-width="1.8" />
          </g>
        }
        @case ('tontine') {
          <g transform="translate(0 4)">
            <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" stroke-width="2" />
            <ellipse cx="60" cy="36" rx="34" ry="8" stroke-width="2" />
            <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58" />
            <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" stroke-width="3" />
            <g transform="translate(46 30) rotate(-20)">
              <path d="M0 -7 C5 -7 6.5 -3 6.5 0 C6.5 4 4 7 0 7 C-4 7 -6.5 4 -6.5 0 C-6.5 -3 -5 -7 0 -7Z" />
              <path d="M0 -5 C1 -2 -1 2 0 5" stroke-width="1.1" />
            </g>
            <g class="accent" transform="translate(58 27) rotate(5)">
              <path d="M0 -7 C5 -7 6.5 -3 6.5 0 C6.5 4 4 7 0 7 C-4 7 -6.5 4 -6.5 0 C-6.5 -3 -5 -7 0 -7Z" />
              <path d="M0 -5 C1 -2 -1 2 0 5" stroke-width="1.1" />
            </g>
            <g transform="translate(71 30) rotate(25)">
              <path d="M0 -7 C5 -7 6.5 -3 6.5 0 C6.5 4 4 7 0 7 C-4 7 -6.5 4 -6.5 0 C-6.5 -3 -5 -7 0 -7Z" />
              <path d="M0 -5 C1 -2 -1 2 0 5" stroke-width="1.1" />
            </g>
          </g>
        }
      }
    </svg>
  `,
})
export class OfferIllustrationComponent {
  readonly kind = input.required<OfferIllustrationKind>();
}
