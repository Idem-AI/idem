import { ChangeDetectionStrategy, Component } from '@angular/core';

let nextCrossId = 0;

/**
 * Croix d'Agadez (tanaghilt), pendue à son cordon de cuir tressé : l'emblème
 * de l'étape « Votre projet » de la création, au format du bouclier de
 * connexion.
 *
 * Le bijou touareg se transmet du père au fils quand celui-ci part faire sa
 * vie, avec la formule « je te donne les quatre coins du monde » : on remet à
 * quelqu'un de quoi choisir sa route. C'est ce que fait l'écran — nommer son
 * projet, sa cible, sa portée. Source : Club des Voyages, « Les croix
 * touarègues » (https://www.club-des-voyages.com/niger/les-croix-touaregues-12196.html).
 *
 * Dessiné au trait selon la règle des illustrations d'IDEM : `currentColor`
 * pour tout le dessin, `--color-primary-500` pour la seule gravure du cœur,
 * « l'œil du caméléon ». Autour, les quatre petits cercles sont « les traces
 * du chacal », comme sur les croix gravées. Aucun aplat visible.
 *
 * Décoratif : masqué des lecteurs d'écran, le texte voisin porte le sens.
 */
@Component({
  selector: 'app-agadez-cross-illustration',
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
        <clipPath [attr.id]="uid + '-plate'">
          <path d="M160 200 C196 234 218 264 218 294 C218 338 184 382 160 408 C136 382 102 338 102 294 C102 264 124 234 160 200 Z" />
        </clipPath>
      </defs>

      <!-- Cordon de cuir tressé, noué au-dessus de l'anneau -->
      <path d="M96 4 L152 52 M224 4 L168 52" stroke-width="2" />
      <path d="M104 4 L156 48 M216 4 L164 48" stroke-width="1" opacity="0.5" />
      <path d="M110 17 l5 -6 M122 27 l5 -6 M134 37 l5 -6 M210 17 l-5 -6 M198 27 l-5 -6 M186 37 l-5 -6" stroke-width="1.25" opacity="0.7" />
      <rect x="148" y="48" width="24" height="14" rx="5" stroke-width="2" />
      <path d="M154 48 V62 M160 48 V62 M166 48 V62" stroke-width="1" opacity="0.6" />

      <!-- Anneau du haut, gravé de tirets -->
      <path d="M160 62 C188 62 204 84 204 110 C204 136 186 156 160 160 C134 156 116 136 116 110 C116 84 132 62 160 62 Z" stroke-width="2.25" />
      <path d="M160 80 C176 80 186 94 186 110 C186 126 175 139 160 142 C145 139 134 126 134 110 C134 94 144 80 160 80 Z" stroke-width="1.75" />
      <path
        d="M160 66 V75 M182 72 L177 80 M197 92 L189 96 M200 114 H191 M193 136 L185 131 M138 72 L143 80 M123 92 L131 96 M120 114 H129 M127 136 L135 131"
        stroke-width="1.25"
        opacity="0.7"
      />

      <!-- Col et traverse : deux bras pointus terminés par des boutons -->
      <path d="M154 159 V170 M166 159 V170" stroke-width="2" />
      <path d="M154 170 L98 172 L66 182 L98 192 L154 196 M166 170 L222 172 L254 182 L222 192 L166 196" stroke-width="2.25" />
      <path d="M154 170 H166 M154 196 H166" stroke-width="2.25" />
      <circle cx="58" cy="182" r="7" stroke-width="2" />
      <circle cx="262" cy="182" r="7" stroke-width="2" />
      <path d="M100 182 H146 M174 182 H220" stroke-width="1.25" opacity="0.7" />
      <path d="M112 177 L118 182 L112 187 M128 177 L134 182 L128 187 M208 177 L202 182 L208 187 M192 177 L186 182 L192 187" stroke-width="1.25" />

      <!-- Plaque en losange, et son bouton du bas -->
      <path
        d="M160 196 C200 232 226 262 226 294 C226 342 188 388 160 418 C132 388 94 342 94 294 C94 262 120 232 160 196 Z"
        stroke-width="2.25"
      />
      <path
        d="M160 200 C196 234 218 264 218 294 C218 338 184 382 160 408 C136 382 102 338 102 294 C102 264 124 234 160 200 Z"
        stroke-width="1.25"
        opacity="0.7"
      />
      <circle cx="160" cy="428" r="8" stroke-width="2" />

      <!-- Gravures de la plaque -->
      <g [attr.clip-path]="'url(#' + uid + '-plate)'">
        <!-- Chevrons pointés vers le cœur -->
        <path d="M136 228 L160 244 L184 228" stroke-width="1.5" />
        <path d="M126 240 L160 262 L194 240" stroke-width="1.25" opacity="0.7" />
        <path d="M132 362 L160 344 L188 362" stroke-width="1.5" />
        <path d="M140 376 L160 362 L180 376" stroke-width="1.25" opacity="0.7" />
        <!-- Rangées de points le long des flancs -->
        <path
          d="M114 286 h0.01 M114 302 h0.01 M206 286 h0.01 M206 302 h0.01 M120 318 h0.01 M200 318 h0.01 M120 270 h0.01 M200 270 h0.01"
          stroke-width="3.5"
        />
      </g>

      <!-- Les traces du chacal, aux quatre points cardinaux -->
      <circle cx="160" cy="268" r="5" stroke-width="1.75" />
      <circle cx="160" cy="324" r="5" stroke-width="1.75" />
      <circle cx="132" cy="296" r="5" stroke-width="1.75" />
      <circle cx="188" cy="296" r="5" stroke-width="1.75" />

      <!-- L'œil du caméléon, au cœur : la seule gravure en couleur -->
      <g style="color: var(--color-primary-500)">
        <circle cx="160" cy="296" r="17" stroke-width="2" />
        <circle cx="160" cy="296" r="10" stroke-width="1.5" />
        <path
          d="M160 279 V286 M172 284 L167 289 M177 296 H170 M172 308 L167 303 M160 313 V306 M148 308 L153 303 M143 296 H150 M148 284 L153 289"
          stroke-width="1.25"
        />
        <circle cx="160" cy="296" r="3" stroke-width="2" />
      </g>
    </svg>
  `,
})
export class AgadezCrossIllustrationComponent {
  protected readonly uid = `agadez-${nextCrossId++}`;
}
