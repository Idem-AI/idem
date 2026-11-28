import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * L'arbre à palabres et les tabourets en cercle : l'équipe, ceux qui
 * s'assoient ensemble pour décider. Même dessin que l'illustration `team`
 * d'iDeploy (`apps/ideploy-web/.../illustration.ts`), pour le même sens.
 *
 * Écrans : page « Équipe » d'un projet (état vide), page d'invitation.
 * Au trait, `currentColor` ; un seul tabouret à la couleur primaire — la place
 * qui attend la personne invitée. Décoratif : le texte voisin porte le sens.
 */
@Component({
  selector: 'app-palaver-tree-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'block' },
  styles: `
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg viewBox="0 0 120 86" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path d="M14 78 H106" opacity=".4" stroke-width="1.5" />
      <path
        d="M22 32 C14 30 12 20 22 16 C24 6 40 4 46 10 C52 2 70 2 76 10 C84 4 100 8 98 18 C108 20 106 32 98 34 C94 38 82 38 76 34 C70 38 50 38 44 34 C38 38 26 36 22 32Z"
        stroke-width="2"
      />
      <path d="M32 22 L36 26 L40 22 M52 16 L56 20 L60 16 L64 20 L68 16 M80 22 L84 26 L88 22" stroke-width="1.1" opacity=".6" />
      <path d="M54 78 C56 64 56 48 52 36 M66 78 C64 64 64 48 68 36 M58 36 V28 M62 36 L66 30" stroke-width="2" />
      <g transform="translate(28 74)">
        <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="1.8" />
        <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.2" />
        <path d="M-8 5 H8" stroke-width="1.8" />
      </g>
      <g transform="translate(92 74)">
        <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="1.8" />
        <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.2" />
        <path d="M-8 5 H8" stroke-width="1.8" />
      </g>
      <g transform="translate(40 64) scale(0.75)">
        <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="2.4" />
        <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.6" />
        <path d="M-8 5 H8" stroke-width="2.4" />
      </g>
      <g style="color: var(--color-primary-500)" transform="translate(80 64) scale(0.75)">
        <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="2.4" />
        <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.6" />
        <path d="M-8 5 H8" stroke-width="2.4" />
      </g>
    </svg>
  `,
})
export class PalaverTreeIllustrationComponent {}
