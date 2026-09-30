import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les scènes d'erreur. Chacune DÉCRIT ce qui a échoué — ajouter un cas oblige
 * à dessiner son sujet, pas à reprendre un triangle d'alerte générique.
 */
export type ErrorScene = 'document' | 'connection' | 'generation' | 'project' | 'not-found';

/**
 * Illustrations des états d'erreur, dessinées en ligne (cf. AGENTS.md §4) :
 * chacune est un objet de la culture africaine qui dit ce qui a échoué.
 *
 * Deux encres seulement : `currentColor` pour le trait, hérité de l'endroit où
 * la scène est posée, et `--color-primary-500` pour le SEUL détail qui dit ce
 * qui s'est passé — la déchirure, le son qui se brise, le fil cassé. Au trait,
 * sans aplat ni ombre : net à toutes les tailles, juste dans les deux thèmes.
 */
@Component({
  selector: 'app-error-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 120 88"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [style.width.px]="width()"
      class="h-auto block"
      style="color: var(--color-text-tertiary)"
    >
      @switch (scene()) {
        @case ('document') {
          <!-- Un document qui n'a pas pu s'ouvrir : le feuillet manuscrit est déchiré. -->
          <rect x="34" y="12" width="52" height="68" rx="2" stroke-width="2"/>
          <rect x="38" y="16" width="44" height="60" rx="1" stroke-width=".9" opacity=".6"/>
          <path d="M40 20 L43 23 L46 20 L49 23 L52 20 L55 23 L58 20 L61 23 L64 20 L67 23 L70 20 L73 23 L76 20 L79 23" stroke-width=".9" opacity=".6"/>
          <path d="M44 34 C48 32 52 36 56 34 S64 32 68 34 S74 36 76 34 M44 42 C48 40 52 44 56 42 S62 40 66 42 M44 50 C48 48 52 52 56 50 S64 48 68 50 S74 52 76 50" stroke-width="1.2" opacity=".8"/>
          <g style="color: var(--color-primary-500)">
            <path d="M30 60 L38 56 L44 62 L52 55 L58 62 L66 56 L72 62 L80 55 L90 60" stroke-width="2"/>
          </g>
        }
        @case ('connection') {
          <!-- Un service injoignable : le tambour parleur bat, mais son message se brise en route. -->
          <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="2"/>
          <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="2"/>
          <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
          <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="1" opacity=".6"/>
          <path d="M44 44 H76" stroke-width="1.2" opacity=".6"/>
          <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="1.2" opacity=".75"/>
          <path d="M78 76 C88 70 94 62 96 52" stroke-width="2"/>
          <path d="M88 22 C92 26 92 32 88 36 M32 22 C28 26 28 32 32 36" stroke-width="1.6" opacity=".6"/>
          <g style="color: var(--color-primary-500)" stroke-width="1.8">
            <path d="M96 18 L100 24 M104 28 L99 30 M97 38 L101 43"/>
            <path d="M24 18 L20 24 M16 28 L21 30 M23 38 L19 43"/>
          </g>
        }
        @case ('generation') {
          <!-- Une création interrompue : sur le métier à tisser, le fil de chaîne a cassé. -->
          <path d="M26 10 V82 M94 10 V82 M22 12 H98" stroke-width="2"/>
          <path d="M60 12 V18 M52 18 H68"/>
          <path d="M44 30 H76 M44 36 H76" stroke-width="1.8"/>
          <path d="M46 20 V80 M50 20 V80 M54 20 V80 M58 20 V80 M62 20 V56 M66 20 V56 M70 20 V56 M74 20 V56" stroke-width=".9" opacity=".65"/>
          <rect x="43" y="58" width="34" height="22" rx="1" stroke-width="1.6"/>
          <path d="M44.0 60 h3.2 v3.4 h-3.2z M53.2 60 h3.2 v3.4 h-3.2z M62.4 60 h3.2 v3.4 h-3.2z M71.6 60 h3.2 v3.4 h-3.2z M48.6 65 h3.2 v3.4 h-3.2z M57.8 65 h3.2 v3.4 h-3.2z M67.0 65 h3.2 v3.4 h-3.2z M44.0 70 h3.2 v3.4 h-3.2z M53.2 70 h3.2 v3.4 h-3.2z M62.4 70 h3.2 v3.4 h-3.2z M71.6 70 h3.2 v3.4 h-3.2z M48.6 75 h3.2 v3.4 h-3.2z M57.8 75 h3.2 v3.4 h-3.2z M67.0 75 h3.2 v3.4 h-3.2z" stroke-width="1" opacity=".8"/>
          <path d="M40 82 H80" stroke-width="2"/>
          <g style="color: var(--color-primary-500)" stroke-width="1.8">
            <path d="M62 56 C64 50 60 46 63 40"/>
            <path d="M66 58 L70 52 M74 58 L70 52" stroke-width="1.4"/>
          </g>
          <path d="M24 50 C28 46 32 46 36 48 H44" stroke-width="1.4" opacity=".5"/>
        }
        @case ('project') {
          <!-- Aucun projet ouvert : le grenier est vide, sa porte attend qu'on le remplisse. -->
          <path d="M42 40 L44 74 H76 L78 40" stroke-width="2"/>
          <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
          <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="2"/>
          <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width=".9" opacity=".6"/>
          <path d="M58 6 L60 2 L62 6" stroke-width="1.4"/>
          <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="1.1" opacity=".7"/>
          <g style="color: var(--color-primary-500)">
            <rect x="54" y="48" width="12" height="11" rx="1" stroke-width="1.8" stroke-dasharray="3 2.5"/>
          </g>
          <path d="M66 48 L72 46 V60 L66 59" opacity=".7"/>
        }
        @case ('not-found') {
          <!-- Une page introuvable : Sankofa, l'oiseau-poids akan qui se retourne — revenir sur ses pas pour retrouver ce qu'on cherchait. -->
          <path d="M24 82 H96" opacity=".4"/>
          <path d="M38 82 V76 H82 V82" stroke-width="1.6"/>
          <path d="M52 76 V66 M68 76 V66 M49 76 H55 M65 76 H71" stroke-width="1.8"/>
          <path d="M30 46 C30 58 44 66 60 66 C76 66 90 58 92 44 C92 38 88 34 84 34" stroke-width="2"/>
          <path d="M30 46 L16 38 L22 50 L14 56 L32 54" stroke-width="1.8"/>
          <path d="M84 34 C86 22 82 12 72 10 C62 8 54 14 52 22" stroke-width="2"/>
          <path d="M52 22 L44 26 L52 28" stroke-width="1.8"/>
          <circle cx="60" cy="18" r="1.4" stroke-width="1.6"/>
          <path d="M30 46 C44 42 70 40 84 34" stroke-width="1.4" opacity=".6"/>
          <path d="M42 54 L48 58 L54 54 L60 58 L66 54 L72 58 L78 54" stroke-width="1.1" opacity=".7"/>
          <g style="color: var(--color-primary-500)">
            <ellipse cx="44" cy="36" rx="4.6" ry="3.6" transform="rotate(-10 44 36)" stroke-width="1.8"/>
          </g>
        }
      }
    </svg>
  `,
})
export class ErrorIllustrationComponent {
  readonly scene = input.required<ErrorScene>();
  readonly width = input(140);
}
