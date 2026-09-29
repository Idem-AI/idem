import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les modules du projet, dans l'ordre du parcours. */
export type ModuleEmblemKind =
  | 'branding'
  | 'businessPlan'
  | 'pitchDeck'
  | 'finance'
  | 'diagrams'
  | 'development';

/**
 * L'emblème de chaque module : un objet de la culture africaine qui dit ce
 * que le module produit (AGENTS.md § 4). Partagé par les tuiles du tableau de
 * bord et par celles du lanceur de la conversation, pour qu'un module ait le
 * même visage partout.
 *
 * Deux encres : `currentColor` pour le trait, `--color-primary-500` pour le
 * seul détail qui compte. Décoratif : le titre de la tuile porte le sens.
 */
@Component({
  selector: 'app-module-emblem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 100 / 60;
      color: var(--color-text-tertiary);
      transition: color 0.3s ease;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg
      viewBox="0 0 100 60"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (kind()) {
        @case ('branding') {
          <!-- Identité de marque : le tampon adinkra en calebasse sculptée, et le signe qu'il imprime sur l'étoffe. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <path d="M34 12 L26 44 M34 12 L42 44 M34 12 L20 40 M34 12 L48 40" stroke-width="2.4"/>
            <path d="M30 10 H38" stroke-width="3.6"/>
            <ellipse cx="34" cy="52" rx="22" ry="9" stroke-width="3"/>
            <path d="M12 52 V56 C12 61 22 65 34 65 C46 65 56 61 56 56 V52" stroke-width="2.4"/>
            <g transform="translate(34 52) scale(.9 .36)">
              <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" stroke-width="3.6"/>
            </g>
            <path d="M64 22 H112 V78 H64Z" stroke-width="2.4"/>
            <path d="M64 30 H112 M64 70 H112" stroke-width="1.4" opacity=".55"/>
            <g style="color: var(--color-primary-500)" transform="translate(88 50) scale(1.15)">
              <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" stroke-width="3.9"/>
            </g>
          </g>
        }
        @case ('businessPlan') {
          <!-- Business plan : le baobab, qui grandit lentement et porte son fruit. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <path d="M22 80 H98" opacity=".4"/>
            <path d="M44 80 C40 66 42 50 48 40 M76 80 C80 66 78 50 72 40" stroke-width="3"/>
            <path d="M48 40 C44 34 36 30 28 30 M48 40 C46 32 44 26 40 18 M55 38 C54 30 56 22 58 14 M65 38 C66 30 70 24 76 18 M72 40 C78 34 86 32 94 32" stroke-width="3"/>
            <path d="M28 30 C24 28 21 29 19 31 M28 30 C27 26 28 23 30 21 M40 18 C36 16 34 13 34 10 M40 18 C42 15 45 13 48 13 M58 14 C56 11 56 8 57 6 M58 14 C61 12 63 12 65 13 M76 18 C76 14 78 12 80 11 M76 18 C80 17 83 17 85 19 M94 32 C97 29 100 29 102 30 M94 32 C96 34 97 36 96 39" stroke-width="2.1"/>
            <path d="M52 50 V60 M57 46 V70 M63 48 V74 M68 52 V64" stroke-width="1.5" opacity=".45"/>
            <g style="color: var(--color-primary-500)">
              <path d="M86 32 V38" stroke-width="1.8"/>
              <path d="M86 38 C89 38 90 41 90 45 C90 49 88 51 86 51 C84 51 82 49 82 45 C82 41 83 38 86 38Z" stroke-width="2.7"/>
            </g>
          </g>
        }
        @case ('pitchDeck') {
          <!-- Pitch deck : le tambour parleur, qui porte le message loin. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="3"/>
            <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="3"/>
            <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
            <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="1.5" opacity=".6"/>
            <path d="M44 44 H76" stroke-width="1.8" opacity=".6"/>
            <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="1.8" opacity=".75"/>
            <path d="M78 76 C88 70 94 62 96 52" stroke-width="3"/>
            <g style="color: var(--color-primary-500)" stroke-width="2.7">
              <path d="M88 22 C92 26 92 32 88 36"/>
              <path d="M94 16 C101 23 101 35 94 42"/>
              <path d="M32 22 C28 26 28 32 32 36"/>
              <path d="M26 16 C19 23 19 35 26 42"/>
            </g>
          </g>
        }
        @case ('finance') {
          <!-- Prévisions financières : les cauris, la monnaie historique d'Afrique de l'Ouest. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <path d="M22 76 H98" opacity=".4"/>
            <g  transform="translate(44 60) rotate(-18) scale(1.05)">
              <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.9"/>
              <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.3"/>
              <path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.8"/>
            </g>
            <g  transform="translate(76 60) rotate(18) scale(1.05)">
              <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.9"/>
              <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.3"/>
              <path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.8"/>
            </g>
            <g style="color: var(--color-primary-500)" transform="translate(60 40) rotate(0) scale(1.15)">
              <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6"/>
              <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.1"/>
              <path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.7"/>
            </g>
          </g>
        }
        @case ('diagrams') {
          <!-- Diagrammes : le filet de pêche (épervier), un réseau de nœuds et de liens. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <path d="M60 12 V4 C60 2 64 2 64 4" stroke-width="2.4"/>
            <path d="M60 12 L18.2 72.5 M60 12 L24.4 74.7 M60 12 L34.1 76.5 M60 12 L46.4 77.6 M60 12 L60 78 M60 12 L73.6 77.6 M60 12 L85.9 76.5 M60 12 L95.6 74.7 M60 12 L101.8 72.5" stroke-width="1.7" opacity=".75"/>
            <path d="M45.4 33.2 L47.5 33.9 L50.9 34.6 L55.2 35 L60 35.1 L64.8 35 L69.1 34.6 L72.5 33.9 L74.6 33.2 M34.9 48.3 L38.6 49.6 L44.5 50.7 L51.8 51.4 L60 51.6 L68.2 51.4 L75.5 50.7 L81.4 49.6 L85.1 48.3 M25.7 61.6 L30.8 63.4 L38.8 64.9 L48.9 65.8 L60 66.1 L71.1 65.8 L81.2 64.9 L89.2 63.4 L94.3 61.6" stroke-width="1.7" opacity=".75"/>
            <path d="M18.2 72.5 L24.4 74.7 L34.1 76.5 L46.4 77.6 L60 78 L73.6 77.6 L85.9 76.5 L95.6 74.7 L101.8 72.5" stroke-width="3"/>
            <path d="M47.5 33.9h0.01 M50.9 34.6h0.01 M55.2 35h0.01 M60 35.1h0.01 M64.8 35h0.01 M69.1 34.6h0.01 M72.5 33.9h0.01 M38.6 49.6h0.01 M44.5 50.7h0.01 M51.8 51.4h0.01 M60 51.6h0.01 M68.2 51.4h0.01 M75.5 50.7h0.01 M81.4 49.6h0.01 M30.8 63.4h0.01 M38.8 64.9h0.01 M48.9 65.8h0.01 M60 66.1h0.01 M71.1 65.8h0.01 M81.2 64.9h0.01 M89.2 63.4h0.01" stroke-width="4.5" opacity=".8"/>
            <path d="M18.2 75.5h0.01 M24.4 77.7h0.01 M34.1 79.5h0.01 M46.4 80.6h0.01 M60 81h0.01 M73.6 80.6h0.01 M85.9 79.5h0.01 M95.6 77.7h0.01 M101.8 75.5h0.01" stroke-width="6.1"/>
            <g style="color: var(--color-primary-500)">
              <circle cx="68.2" cy="51.4" r="4" stroke-width="2.7"/>
            </g>
          </g>
        }
        @case ('development') {
          <!-- Développement : le métier à tisser, où l'application se construit fil à fil. -->
          <g transform="translate(10.4 1) scale(0.66)" stroke-width="2.3">
            <path d="M26 10 V82 M94 10 V82 M22 12 H98" stroke-width="3"/>
            <path d="M60 12 V18 M52 18 H68"/>
            <path d="M44 30 H76 M44 36 H76" stroke-width="2.7"/>
            <path d="M46 20 V80 M50 20 V80 M54 20 V80 M58 20 V80 M62 20 V80 M66 20 V80 M70 20 V80 M74 20 V80" stroke-width="1.4" opacity=".65"/>
            <rect x="43" y="58" width="34" height="22" rx="1" stroke-width="2.4"/>
            <path d="M44.0 60 h3.2 v3.4 h-3.2z M53.2 60 h3.2 v3.4 h-3.2z M62.4 60 h3.2 v3.4 h-3.2z M71.6 60 h3.2 v3.4 h-3.2z M48.6 65 h3.2 v3.4 h-3.2z M57.8 65 h3.2 v3.4 h-3.2z M67.0 65 h3.2 v3.4 h-3.2z M44.0 70 h3.2 v3.4 h-3.2z M53.2 70 h3.2 v3.4 h-3.2z M62.4 70 h3.2 v3.4 h-3.2z M71.6 70 h3.2 v3.4 h-3.2z M48.6 75 h3.2 v3.4 h-3.2z M57.8 75 h3.2 v3.4 h-3.2z M67.0 75 h3.2 v3.4 h-3.2z" stroke-width="1.5" opacity=".8"/>
            <path d="M40 82 H80" stroke-width="3"/>
            <g style="color: var(--color-primary-500)">
              <path d="M34 50 C44 46 76 46 86 50 C76 54 44 54 34 50Z" stroke-width="2.7"/>
              <path d="M52 50 H68" stroke-width="3.6"/>
            </g>
          </g>
        }
      }
    </svg>
  `,
})
export class ModuleEmblemComponent {
  readonly kind = input.required<ModuleEmblemKind>();
}
