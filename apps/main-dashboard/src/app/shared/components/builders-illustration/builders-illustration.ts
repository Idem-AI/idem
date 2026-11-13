import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Idem Builders : le pagne commémoratif (AGENTS.md § 4, « Être reconnu, mis en
 * avant par une communauté »). En Afrique de l'Ouest, on imprime une étoffe
 * pour honorer une personne, une association, un événement, et on la porte en
 * public : c'est la reconnaissance rendue visible — ce que le programme fait
 * pour un projet.
 *
 * L'étoffe pend à sa corde, bordée de chevrons imprimés ; le médaillon central,
 * à l'encre primaire, porte trois briques de banco empilées : ce qui est
 * célébré, c'est ce qui se bâtit. Deux encres, au trait, aucun visage.
 */
@Component({
  selector: 'app-builders-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 120 / 100;
      color: var(--color-text-tertiary);
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <!-- La corde et ses deux attaches -->
      <path d="M8 14 Q60 10 112 14" stroke-width="1.6" />
      <path d="M26 12.6 v4 M94 12.6 v4" stroke-width="1.6" />

      <!-- L'étoffe, au tombé légèrement ondulé -->
      <path d="M22 16 H98 V84 Q86 88 74 85 T50 85 T22 84 Z" stroke-width="1.8" />

      <!-- Bordures imprimées : chevrons en haut et en bas -->
      <path d="M28 24 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3" stroke-width="1.4" />
      <path d="M28 76 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3" stroke-width="1.4" />

      <!-- Les quatre losanges d'angle -->
      <path d="M32 34 l3 3 l-3 3 l-3 -3 Z M88 34 l3 3 l-3 3 l-3 -3 Z M32 60 l3 3 l-3 3 l-3 -3 Z M88 60 l3 3 l-3 3 l-3 -3 Z" stroke-width="1.4" />

      <!-- Le médaillon : ce qui est célébré -->
      <g stroke="var(--color-primary-500)" stroke-width="1.8">
        <circle cx="60" cy="50" r="17" />
        <circle cx="60" cy="50" r="12.5" stroke-width="1.2" stroke-dasharray="1.5 2.5" />
        <rect x="53" y="52" width="14" height="5" rx="0.8" />
        <rect x="55" y="47" width="10" height="5" rx="0.8" />
        <rect x="57" y="42" width="6" height="5" rx="0.8" />
      </g>
    </svg>
  `,
})
export class BuildersIllustrationComponent {}
