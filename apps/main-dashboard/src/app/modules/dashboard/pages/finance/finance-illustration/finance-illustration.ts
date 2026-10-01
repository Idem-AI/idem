import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Scènes illustrées du module finance (AGENTS.md § 4, docs/ILLUSTRATIONS.md).
 *
 * - `import`  : le feuillet qu'on apporte — « j'ai déjà mes chiffres ».
 * - `ai`      : le plateau d'awalé — l'IA calcule le coup à jouer.
 * - `manual`  : l'échelle dogon — une marche après l'autre.
 * - `sorting` : le van de vannage — l'IA trie ce qui compte dans le document.
 * - `harvest` : le grenier plein — les chiffres sont prêts à être rangés.
 * - `empty`   : la calebasse vide — rien encore.
 */
export type FinanceScene = 'import' | 'ai' | 'manual' | 'sorting' | 'harvest' | 'empty';

@Component({
  selector: 'app-finance-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 4 / 3;
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

    /* Seul le van bouge : il dit qu'un travail est en cours. */
    .grain {
      animation: grain-fall 1.8s ease-in infinite;
    }
    .grain-2 {
      animation-delay: 0.6s;
    }
    .grain-3 {
      animation-delay: 1.2s;
    }

    @keyframes grain-fall {
      0% {
        transform: translateY(-6px);
        opacity: 0;
      }
      30% {
        opacity: 1;
      }
      100% {
        transform: translateY(14px);
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .grain {
        animation: none;
      }
    }
  `,
  template: `
    <svg
      viewBox="0 0 120 90"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (scene()) {
        @case ('import') {
          <!-- Le feuillet apporté : un relevé tenu en colonnes, qu'on dépose. -->
          <g transform="translate(6 2)">
            <rect x="22" y="12" width="52" height="68" rx="2" stroke-width="2"/>
            <rect x="26" y="16" width="44" height="60" rx="1" stroke-width=".9" opacity=".6"/>
            <path d="M28 20 L31 23 L34 20 L37 23 L40 20 L43 23 L46 20 L49 23 L52 20 L55 23 L58 20 L61 23 L64 20 L67 23" stroke-width=".9" opacity=".6"/>
            <path d="M31 33 H65 M31 41 H65 M31 49 H65 M31 57 H65 M31 65 H65" stroke-width="1.2" opacity=".75"/>
            <path d="M53 29 V69" stroke-width="1.1" opacity=".55"/>
            <path d="M57 37 H63 M57 45 H62 M57 53 H63 M57 61 H61" stroke-width="1.6"/>
            <g class="accent" stroke-width="2.4">
              <path d="M90 62 V30 M80 40 L90 30 L100 40"/>
            </g>
          </g>
        }
        @case ('ai') {
          <!-- Le plateau d'awalé : on compte les graines avant de jouer. -->
          <path d="M8 78 H112" opacity=".4"/>
          <path d="M20 36 H100 C106 36 110 40 110 46 V58 C110 64 106 68 100 68 H20 C14 68 10 64 10 58 V46 C10 40 14 36 20 36Z" stroke-width="2"/>
          <path d="M24 68 L22 76 M96 68 L98 76" stroke-width="1.8"/>
          <path d="M16 52 H104" stroke-width=".9" opacity=".5"/>
          <path d="M22 72 H98" stroke-width=".8" opacity=".35"/>
          @for (x of pits; track x) {
            <circle [attr.cx]="x" cy="44.5" r="5"/>
            <circle [attr.cx]="x" cy="59.5" r="5"/>
          }
          <path d="M23 44.5h.01 M38.2 43h.01 M36.6 46h.01 M68.5 59.5h.01 M82 58h.01 M84 61h.01 M98 44.5h.01" stroke-width="2.6"/>
          <g class="accent">
            <path d="M51 43h.01 M54 43h.01 M52.5 46.2h.01" stroke-width="2.8"/>
            <path d="M52.4 30 V22 M48.4 26 L52.4 30 L56.4 26" stroke-width="1.8"/>
          </g>
        }
        @case ('manual') {
          <!-- L'échelle dogon : un tronc fourchu, taillé de marches, appuyé au grenier. -->
          <path d="M14 85 H108" opacity=".4"/>
          <path d="M70 30 C82 25 94 25 106 30 V85" stroke-width="1.6" opacity=".7"/>
          <rect x="85" y="48" width="11" height="13" rx="1" stroke-width="1.3" opacity=".7"/>
          <path d="M44.2 82.8 L64.2 16.8 M51.8 85.2 L71.8 19.2" stroke-width="2"/>
          <path d="M64.2 16.8 C62 12 60 8 57 4 M71.8 19.2 C74 14 76 10 79.5 6 M61 9.5 C63.5 13 66 15 67.5 15.8 C69.5 14 72 11 75 8" stroke-width="1.8"/>
          <path d="M55.4 73.3 L52.1 71.1 L56.9 68.5 M59 61.4 L55.7 59.2 L60.5 56.6 M62.6 49.6 L59.3 47.4 L64.1 44.8" stroke-width="1.6"/>
          <g class="accent">
            <path d="M66.2 37.7 L62.9 35.5 L67.7 32.9" stroke-width="2.2"/>
          </g>
        }
        @case ('sorting') {
          <!-- Le van de vannage : on secoue, le grain utile reste, la balle s'en va. -->
          <g transform="rotate(-10 56 38)">
            <ellipse cx="56" cy="38" rx="36" ry="12" stroke-width="2"/>
            <ellipse cx="56" cy="38" rx="28" ry="8" stroke-width="1" opacity=".6"/>
            <path d="M30 38 L34 34 L38 38 L42 34 L46 38 L50 34 L54 38 L58 34 L62 38 L66 34 L70 38 L74 34 L78 38 L82 34" stroke-width=".9" opacity=".45"/>
            <g class="accent">
              <path d="M46 39h.01 M52 41h.01 M58 39h.01 M64 41h.01 M55 36h.01" stroke-width="3"/>
            </g>
          </g>
          <path class="grain" d="M88 56h.01" stroke-width="2.4"/>
          <path class="grain grain-2" d="M84 62h.01" stroke-width="2.4"/>
          <path class="grain grain-3" d="M90 66h.01" stroke-width="2.4"/>
          <path d="M70 84 C78 76 94 76 102 84" stroke-width="1.6"/>
          <path d="M80 81h.01 M86 79h.01 M92 81h.01" stroke-width="2.2" opacity=".7"/>
          <path d="M8 84 H112" opacity=".4"/>
        }
        @case ('harvest') {
          <!-- Le grenier plein : la récolte est rentrée, on peut la ranger. -->
          <g transform="translate(0 4)">
            <path d="M42 40 L44 74 H76 L78 40" stroke-width="2"/>
            <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M36 80 H84" opacity=".8"/>
            <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="2"/>
            <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width=".9" opacity=".6"/>
            <path d="M58 6 L60 2 L62 6" stroke-width="1.4"/>
            <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="1.1" opacity=".7"/>
            <rect x="54" y="48" width="12" height="11" rx="1"/>
            <g class="accent">
              <path d="M56.5 56h.01 M60 54h.01 M63.5 56h.01 M58 51.5h.01 M62 51.5h.01" stroke-width="2.8"/>
            </g>
          </g>
        }
        @case ('empty') {
          <!-- La calebasse vide : rien n'y est encore déposé. -->
          <path d="M12 84 H108" opacity=".4"/>
          <ellipse cx="60" cy="44" rx="38" ry="9" stroke-width="2"/>
          <ellipse cx="60" cy="45" rx="31" ry="5.5" stroke-width=".9" opacity=".5"/>
          <path d="M22 44 C22 68 40 80 60 80 C80 80 98 68 98 44" stroke-width="2"/>
          <path d="M31 62 L35 66 L39 62 L43 66 L47 62 M73 62 L77 66 L81 62 L85 66 L89 62" stroke-width="1.1" opacity=".65"/>
          <g class="accent">
            <path d="M60 59 L64 64 L60 69 L56 64Z" stroke-width="1.8"/>
          </g>
        }
      }
    </svg>
  `,
})
export class FinanceIllustrationComponent {
  readonly scene = input.required<FinanceScene>();

  /** Les six trous de chaque rangée du plateau d'awalé. */
  protected readonly pits = [22, 37.2, 52.4, 67.6, 82.8, 98];
}
