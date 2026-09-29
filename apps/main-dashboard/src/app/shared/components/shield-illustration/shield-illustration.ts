import { ChangeDetectionStrategy, Component } from '@angular/core';

let nextShieldId = 0;

/**
 * Bouclier aux deux lances croisées : l'emblème de l'écran de connexion.
 *
 * Dessiné au trait, selon la règle des illustrations d'IDEM : `currentColor`
 * pour tout le dessin, `--color-primary-500` pour le seul losange du cœur.
 * Le bouclier et ses hampes sont remplis de la couleur de la surface
 * (`--shield-surface`) uniquement pour masquer les lances qui passent derrière :
 * aucun aplat visible.
 *
 * Décoratif : masqué des lecteurs d'écran, le texte voisin porte le sens.
 */
@Component({
  selector: 'app-shield-illustration',
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
    <svg
      viewBox="0 0 320 460"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      <defs>
        <clipPath [attr.id]="uid + '-field'">
          <path
            d="M160 86 C207 118 238 175 238 230 C238 285 207 342 160 374 C113 342 82 285 82 230 C82 175 113 118 160 86 Z"
          />
        </clipPath>
        <g [attr.id]="uid + '-spear'" stroke-width="2">
          <path d="M0 -232 C15 -206 17 -181 0 -158 C-17 -181 -15 -206 0 -232 Z" />
          <path d="M0 -224 V-166" stroke-width="1.5" />
          <path d="M-5 -151 H5 M-5 -145 H5 M-5 -139 H5" stroke-width="1.75" />
          <path d="M-3 -136 C-6 -126 -9 -120 -6 -112 M3 -136 C6 -126 9 -120 6 -112" stroke-width="1.5" />
          <path d="M0 -158 V220" />
          <path d="M-3.5 220 H3.5 V234 H-3.5 Z" />
        </g>
      </defs>

      <!-- Lances croisées, derrière le bouclier -->
      <use [attr.href]="'#' + uid + '-spear'" transform="translate(160 230) rotate(-30)" />
      <use [attr.href]="'#' + uid + '-spear'" transform="translate(160 230) rotate(30)" />

      <!-- Poignées qui dépassent en haut et en bas -->
      <rect x="152" y="46" width="16" height="30" rx="8" stroke-width="2" style="fill: var(--shield-surface)" />
      <rect x="152" y="384" width="16" height="30" rx="8" stroke-width="2" style="fill: var(--shield-surface)" />

      <!-- Corps du bouclier -->
      <path
        d="M160 70 C215 105 252 170 252 230 C252 290 215 355 160 390 C105 355 68 290 68 230 C68 170 105 105 160 70 Z"
        stroke-width="2.25"
        style="fill: var(--shield-surface)"
      />
      <path
        d="M160 86 C207 118 238 175 238 230 C238 285 207 342 160 374 C113 342 82 285 82 230 C82 175 113 118 160 86 Z"
        stroke-width="1.5"
      />

      <!-- Motifs du champ -->
      <g [attr.clip-path]="'url(#' + uid + '-field)'" stroke-width="1.75">
        <!-- Grand X qui partage le champ en quatre -->
        <path d="M84 110 L236 350 M236 110 L84 350" />
        <path d="M92 104 L244 344 M228 104 L76 344" stroke-width="1" opacity="0.55" />

        <!-- Chevrons du haut, pointés vers le cœur -->
        <path d="M138 104 L160 118 L182 104" />
        <path d="M128 116 L160 137 L192 116" />
        <path d="M118 129 L160 157 L202 129" />
        <path d="M150 170 h0.01 M160 176 h0.01 M170 170 h0.01" stroke-width="4" />

        <!-- Chevrons du bas, en miroir -->
        <path d="M138 356 L160 342 L182 356" />
        <path d="M128 344 L160 323 L192 344" />
        <path d="M118 331 L160 303 L202 331" />
        <path d="M150 290 h0.01 M160 284 h0.01 M170 290 h0.01" stroke-width="4" />

        <!-- Flancs : dents de scie et points -->
        <path d="M92 192 L104 201 L92 210 L104 219 L92 228 L104 237 L92 246 L104 255 L92 264" />
        <path d="M228 192 L216 201 L228 210 L216 219 L228 228 L216 237 L228 246 L216 255 L228 264" />
        <path d="M118 212 h0.01 M118 230 h0.01 M118 248 h0.01" stroke-width="4" />
        <path d="M202 212 h0.01 M202 230 h0.01 M202 248 h0.01" stroke-width="4" />
      </g>

      <!-- Cœur du bouclier : le seul détail en couleur -->
      <g style="color: var(--color-primary-500)" stroke-width="2.25">
        <path d="M160 204 L180 230 L160 256 L140 230 Z" style="fill: var(--shield-surface)" />
        <path d="M160 217 L170 230 L160 243 L150 230 Z" />
      </g>
    </svg>
  `,
})
export class ShieldIllustrationComponent {
  /** Identifiants SVG propres à l'instance : la page peut afficher deux boucliers. */
  protected readonly uid = `idem-shield-${nextShieldId++}`;
}
