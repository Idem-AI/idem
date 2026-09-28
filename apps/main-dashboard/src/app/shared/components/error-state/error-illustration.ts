import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les scènes d'erreur. Chacune DÉCRIT ce qui a échoué — ajouter un cas oblige
 * à dessiner son sujet, pas à reprendre un triangle d'alerte générique.
 */
export type ErrorScene = 'document' | 'connection' | 'generation' | 'project' | 'not-found';

/**
 * Illustrations des états d'erreur, dessinées en ligne (cf. AGENTS.md §4).
 *
 * Deux encres seulement : `currentColor` pour le trait, hérité de l'endroit où
 * la scène est posée, et `--color-primary-500` pour le SEUL détail qui dit ce
 * qui s'est passé — la déchirure, la coupure, le trait interrompu. Au trait,
 * sans aplat ni ombre : net à toutes les tailles, juste dans les deux thèmes.
 */
@Component({
  selector: 'app-error-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 120 88"
      fill="none"
      aria-hidden="true"
      [style.width.px]="width()"
      class="h-auto block"
      style="color: var(--color-text-tertiary)"
    >
      @switch (scene()) {
        @case ('document') {
          <!-- Un document qui n'a pas pu s'ouvrir : la page est déchirée. -->
          <path
            d="M40 14h28l12 12v46a3 3 0 0 1-3 3H40a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".6"
          />
          <path d="M68 14v9a3 3 0 0 0 3 3h9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity=".6" />
          <path d="M45 34h22M45 41h28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />
          <path
            d="M37 52l7 4 6-5 7 5 6-5 7 5 6-4 4 2"
            stroke="var(--color-primary-500)"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M45 64h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />
        }
        @case ('connection') {
          <!-- Un service injoignable : les deux prises ne se rejoignent plus. -->
          <path d="M8 44h22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".45" />
          <rect x="30" y="34" width="18" height="20" rx="4" stroke="currentColor" stroke-width="1.5" opacity=".7" />
          <path d="M48 39h6M48 49h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7" />
          <rect x="72" y="34" width="18" height="20" rx="4" stroke="currentColor" stroke-width="1.5" opacity=".7" />
          <path d="M90 44h22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".45" />
          <path
            d="M61 31l2 6M66 44h4M61 57l2-6"
            stroke="var(--color-primary-500)"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        }
        @case ('generation') {
          <!-- Une création interrompue : le trait s'arrête en pointillés. -->
          <rect x="22" y="16" width="76" height="56" rx="5" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          <path d="M32 58c8-18 16-24 24-18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" opacity=".8" />
          <path
            d="M60 43c6 4 12 6 22 0"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-dasharray="1 5"
            opacity=".8"
          />
          <!-- L'étincelle de l'IA, là où son trait s'est arrêté. -->
          <path
            d="M58 24c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z"
            stroke="var(--color-primary-500)"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        }
        @case ('project') {
          <!-- Aucun projet ouvert : le dossier est vide, il reste à en choisir un. -->
          <path
            d="M26 26a3 3 0 0 1 3-3h17l6 7h39a3 3 0 0 1 3 3v35a3 3 0 0 1-3 3H29a3 3 0 0 1-3-3z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".6"
          />
          <path d="M26 38h68" stroke="currentColor" stroke-width="1.5" opacity=".3" />
          <path
            d="M70 50l14 5-6 2-2 6z"
            stroke="var(--color-primary-500)"
            stroke-width="1.75"
            stroke-linejoin="round"
          />
        }
        @case ('not-found') {
          <!-- Une page introuvable : le chemin sort de la carte. -->
          <path
            d="M20 22l24-6 32 8 24-6v50l-24 6-32-8-24 6z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".6"
          />
          <path d="M44 16v50M76 24v50" stroke="currentColor" stroke-width="1.5" opacity=".3" />
          <path
            d="M30 58c10-4 14-16 26-14s14 10 22 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-dasharray="2 4"
            opacity=".7"
          />
          <path
            d="M88 30c0 6-6 11-6 11s-6-5-6-11a6 6 0 0 1 12 0z"
            stroke="var(--color-primary-500)"
            stroke-width="1.75"
            stroke-linejoin="round"
          />
          <path d="M80.5 28.5l3 3M83.5 28.5l-3 3" stroke="var(--color-primary-500)" stroke-width="1.5" stroke-linecap="round" />
        }
      }
    </svg>
  `,
})
export class ErrorIllustrationComponent {
  readonly scene = input.required<ErrorScene>();
  readonly width = input(140);
}
