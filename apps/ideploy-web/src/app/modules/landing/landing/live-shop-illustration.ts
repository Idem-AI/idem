import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * La page d'accueil montre le résultat d'une mise en ligne : une capture
 * d'écran redessinée au trait, dans le style des illustrations d'IDEM
 * (AGENTS.md § 4). La fenêtre du navigateur affiche une boutique déjà en
 * ligne, dont les articles sont des objets africains : le panier tressé, la
 * calebasse, le pagne plié, et un pagne tendu en bannière. Les motifs restent
 * dans les objets.
 *
 * Deux encres : `currentColor` pour le trait, l'accent de la marque pour le
 * seul détail qui compte, le cadenas de l'adresse (en ligne, et en HTTPS).
 * La fenêtre est remplie à la couleur de la surface : elle se lit comme un
 * écran sur le fond de la page, dans les deux thèmes.
 */
@Component({
  selector: 'app-live-shop-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 480 368"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      [attr.aria-label]="url() + ' — ' + status()"
      class="w-full h-auto"
      style="color: var(--color-text-secondary);">
      <!-- La fenêtre et sa barre d'adresse -->
      <rect x="8" y="8" width="464" height="334" rx="14" stroke-width="2" style="fill: var(--color-surface-1);" />
      <path d="M8 44 H472" />
      <circle cx="30" cy="26" r="4" opacity=".6" />
      <circle cx="44" cy="26" r="4" opacity=".6" />
      <circle cx="58" cy="26" r="4" opacity=".6" />
      <rect x="96" y="15" width="288" height="22" rx="11" opacity=".8" />
      <g style="color: var(--color-primary-500);" stroke-width="1.8">
        <rect x="108" y="24.5" width="10" height="8" rx="1.5" />
        <path d="M110.5 24.5 V22 a2.5 2.5 0 0 1 5 0 V24.5" />
      </g>
      <text x="126" y="30.5" font-size="11.5" font-weight="600" stroke="none" fill="currentColor" style="font-family: inherit;">{{ url() }}</text>
      <path d="M414 22 a5 5 0 1 0 4 3 M418 20 V25 H413" opacity=".6" />

      <!-- L'en-tête de la boutique -->
      <path d="M32 60 L39 53 L46 60 L39 67 Z" stroke-width="1.8" />
      <path d="M56 60 H108" stroke-width="4" opacity=".8" />
      <path d="M300 60 H326 M340 60 H366 M380 60 H406" opacity=".5" />
      <path d="M430 57 H452 L448 67 H434 Z M435 57 C435 51 447 51 447 57" stroke-width="1.6" />

      <!-- La bannière : un pagne tendu -->
      <rect x="24" y="78" width="432" height="100" rx="10" />
      <path d="M44 102 H184 M44 116 H150" stroke-width="7" opacity=".85" />
      <path d="M44 132 H200 M44 140 H176" opacity=".45" />
      <rect x="44" y="150" width="72" height="16" rx="8" />
      <path d="M58 158 H102" opacity=".7" />
      <path d="M272 92 H436" stroke-width="2" />
      <path d="M280 92 C282 120 276 150 284 170 H424 C432 150 426 120 428 92" stroke-width="1.8" />
      <path d="M314 96 V168 M354 96 V168 M394 96 V168" opacity=".45" />
      <path d="M286 128 L294 134 L302 128 L310 134 L318 128 L326 134 L334 128 L342 134 L350 128 L358 134 L366 128 L374 134 L382 128 L390 134 L398 128 L406 134 L414 128 L422 134" stroke-width="1.1" opacity=".75" />
      <path d="M334 106 L340 112 L334 118 L328 112 Z M374 106 L380 112 L374 118 L368 112 Z M334 146 L340 152 L334 158 L328 152 Z M374 146 L380 152 L374 158 L368 152 Z" stroke-width="1.1" opacity=".8" />

      <!-- Trois articles -->
      <rect x="24" y="192" width="136" height="134" rx="10" />
      <rect x="172" y="192" width="136" height="134" rx="10" />
      <rect x="320" y="192" width="136" height="134" rx="10" />

      <!-- Le panier tressé -->
      <path d="M70 220 C70 196 114 196 114 220" stroke-width="1.8" />
      <ellipse cx="92" cy="220" rx="32" ry="6" stroke-width="1.8" />
      <path d="M60 220 C60 244 70 262 92 262 C114 262 124 244 124 220" stroke-width="1.8" />
      <path d="M66 227 L72.5 232 L79 227 L85.5 232 L92 227 L98.5 232 L105 227 L111.5 232 L118 227 M72 241 L78.67 246 L85.34 241 L92.01 246 L98.68 241 L105.35 246" stroke-width="1" opacity=".7" />

      <!-- La calebasse -->
      <circle cx="240" cy="240" r="26" stroke-width="1.8" />
      <path d="M234 215 C234 207 236 203 240 201 C244 203 246 207 246 215" stroke-width="1.6" />
      <path d="M240 201 L243 195" />
      <path d="M216 235 L222 240 L228 235 L234 240 L240 235 L246 240 L252 235 L258 240 L264 235" stroke-width="1" opacity=".7" />
      <path d="M226 252 h0.01 M234 256 h0.01 M242 257 h0.01 M250 256 h0.01 M257 252 h0.01" stroke-width="2.4" opacity=".6" />

      <!-- Le pagne plié -->
      <rect x="352" y="246" width="72" height="16" rx="3" stroke-width="1.6" style="fill: var(--color-surface-1);" />
      <path d="M356 252 L364 256 L372 252 L380 256 L388 252 L396 256 L404 252 L412 256 L420 252" stroke-width="1" opacity=".7" />
      <rect x="356" y="230" width="64" height="16" rx="3" stroke-width="1.6" style="fill: var(--color-surface-1);" />
      <path d="M360 236 L368 240 L376 236 L384 240 L392 236 L400 240 L408 236 L416 240" stroke-width="1" opacity=".7" />
      <rect x="360" y="214" width="56" height="16" rx="3" stroke-width="1.6" style="fill: var(--color-surface-1);" />
      <path d="M364 220 L372 224 L380 220 L388 224 L396 220 L404 224 L412 220" stroke-width="1" opacity=".7" />

      <!-- Nom, prix, ajout au panier -->
      <path d="M42 290 H102 M190 290 H250 M338 290 H398" stroke-width="4" opacity=".8" />
      <path d="M42 306 H78 M190 306 H226 M338 306 H374" stroke-width="4" opacity=".45" />
      <circle cx="136" cy="302" r="9" />
      <circle cx="284" cy="302" r="9" />
      <circle cx="432" cy="302" r="9" />
      <path d="M136 298 V306 M132 302 H140 M284 298 V306 M280 302 H288 M432 298 V306 M428 302 H436" />

      <!-- L'état, posé sur le bord de la fenêtre -->
      <rect x="296" y="324" width="168" height="34" rx="17" stroke-width="2" style="fill: var(--color-surface-1);" />
      <path d="M314 341 L318 345 L326 337" stroke-width="2" />
      <text x="336" y="345.5" font-size="12.5" font-weight="700" stroke="none" fill="currentColor" style="font-family: inherit;">{{ status() }}</text>
    </svg>
  `,
})
export class LiveShopIllustrationComponent {
  /** L'adresse affichée dans la barre du navigateur. */
  readonly url = input.required<string>();
  /** L'état, posé en pastille sur le bord de la fenêtre. */
  readonly status = input.required<string>();
}
