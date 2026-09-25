import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les scènes disponibles. Ajouter un nom ici oblige à dessiner son cas. */
export type IllustrationName =
  | 'box'
  | 'code'
  | 'server'
  | 'store'
  | 'activity'
  | 'managed-cloud'
  | 'own-server'
  | 'search'
  | 'shield'
  | 'team';

/**
 * Les illustrations de l'interface, dessinées en ligne plutôt que livrées en
 * fichiers.
 *
 * Deux encres seulement : `currentColor`, hérité de l'endroit où la scène est
 * posée, et l'accent de la marque pour le seul détail qui compte dans chaque
 * dessin. Rien n'est décoratif — ce qui est tracé décrit ce dont on parle, et
 * le trait reste net à n'importe quelle taille sans requête supplémentaire ni
 * seconde version pour le thème sombre.
 *
 * @example
 * ```html
 * <app-illustration name="managed-cloud" width="112" />
 * ```
 */
@Component({
  selector: 'app-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 120 88"
      fill="none"
      role="img"
      [attr.aria-label]="alt()"
      [attr.aria-hidden]="alt() ? null : true"
      [style.width.px]="width()"
      class="h-auto"
      style="color: var(--color-text-tertiary);">
      @switch (name()) {
        @case ('managed-cloud') {
          <!-- Une infrastructure qu'on ne touche pas : le nuage la contient. -->
          <path
            d="M36 62a14 14 0 1 1 3-27.7 19 19 0 0 1 36 4.2A12 12 0 0 1 86 62z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".5" />
          <rect x="47" y="45" width="28" height="9" rx="2.5" stroke="var(--color-primary-500)" stroke-width="1.5" />
          <circle cx="53" cy="49.5" r="1.75" fill="var(--color-primary-500)" />
          <path d="M44 72h32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".25" />
        }
        @case ('own-server') {
          <!-- Votre machine : une tour, et la clé qui y donne accès. -->
          <rect x="38" y="20" width="44" height="52" rx="5" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          @for (row of [0, 1, 2]; track row) {
            <path
              [attr.d]="'M46 ' + (31 + row * 12) + 'h20'"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              opacity=".3" />
            <circle
              cx="73"
              [attr.cy]="31 + row * 12"
              r="1.75"
              [attr.fill]="row === 0 ? 'var(--color-primary-500)' : 'currentColor'"
              [attr.opacity]="row === 0 ? 1 : 0.35" />
          }
          <path
            d="M24 46h9m4.5 0a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0"
            stroke="var(--color-primary-500)"
            stroke-width="1.5"
            stroke-linecap="round" />
        }
        @case ('code') {
          <!-- Un dépôt : une fenêtre de code, et la branche qui en part. -->
          <rect x="26" y="20" width="56" height="44" rx="5" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          <path d="M26 30h56" stroke="currentColor" stroke-width="1.5" opacity=".35" />
          <path d="M38 42l-5 5 5 5M52 42l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".55" />
          <circle cx="92" cy="30" r="3" stroke="var(--color-primary-500)" stroke-width="1.5" />
          <circle cx="92" cy="66" r="3" stroke="var(--color-primary-500)" stroke-width="1.5" />
          <path d="M92 33v30M92 44c0 8-6 10-10 10" stroke="var(--color-primary-500)" stroke-width="1.5" stroke-linecap="round" />
        }
        @case ('server') {
          @for (row of [0, 1, 2]; track row) {
            <rect
              x="34"
              [attr.y]="20 + row * 18"
              width="52"
              height="14"
              rx="3"
              stroke="currentColor"
              stroke-width="1.5"
              opacity=".55" />
            <circle
              cx="42"
              [attr.cy]="27 + row * 18"
              r="2"
              [attr.fill]="row === 0 ? 'var(--color-primary-500)' : 'currentColor'"
              [attr.opacity]="row === 0 ? 1 : 0.4" />
          }
        }
        @case ('store') {
          <rect x="30" y="26" width="60" height="42" rx="5" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          <path d="M30 40h60" stroke="currentColor" stroke-width="1.5" opacity=".35" />
          <circle cx="40" cy="33" r="2" fill="var(--color-primary-500)" />
          <path d="M44 52h20M44 59h32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".3" />
        }
        @case ('activity') {
          <path
            d="M18 58l14-14 12 10 14-22 12 16 12-8 20 12"
            stroke="var(--color-primary-500)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round" />
          <circle cx="58" cy="32" r="3" fill="var(--color-primary-500)" />
        }
        @case ('search') {
          <circle cx="54" cy="42" r="20" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          <path d="M68 56l14 14" stroke="var(--color-primary-500)" stroke-width="2" stroke-linecap="round" />
          <path d="M46 42h16M46 36h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".3" />
        }
        @case ('shield') {
          <path
            d="M60 18l24 9v20c0 14-10 24-24 29-14-5-24-15-24-29V27z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".55" />
          <path
            d="M50 44l7 7 14-14"
            stroke="var(--color-primary-500)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round" />
        }
        @case ('team') {
          <circle cx="46" cy="34" r="9" stroke="currentColor" stroke-width="1.5" opacity=".55" />
          <circle cx="78" cy="38" r="7" stroke="currentColor" stroke-width="1.5" opacity=".35" />
          <path d="M64 64c0-8 6-13 14-13s14 5 14 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />
          <path d="M26 68c0-11 9-17 20-17s20 6 20 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".6" />
          <circle cx="46" cy="34" r="2.5" fill="var(--color-primary-500)" />
        }
        @default {
          <!-- Une boîte : la chose qu'on déploie. -->
          <path
            d="M60 18l30 15v30L60 78 30 63V33z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".55" />
          <path
            d="M30 33l30 15 30-15M60 48v30"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            opacity=".35" />
          <circle cx="60" cy="48" r="3.5" fill="var(--color-primary-500)" />
        }
      }
    </svg>
  `,
})
export class IllustrationComponent {
  readonly name = input<IllustrationName>('box');
  readonly width = input(140);
  /** Renseigné seulement quand le dessin porte une information à lui seul. */
  readonly alt = input<string | null>(null);
}
