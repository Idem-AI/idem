import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les scènes disponibles. Ajouter un nom ici oblige à dessiner son cas. */
export type IllustrationName =
  | 'box'
  | 'code'
  | 'server'
  | 'store'
  | 'market'
  | 'activity'
  | 'managed-cloud'
  | 'own-server'
  | 'search'
  | 'shield'
  | 'team'
  | 'beads'
  | 'net'
  | 'cowries';

/**
 * Les illustrations de l'interface, dessinées en ligne plutôt que livrées en
 * fichiers. Chacune est un objet de la culture africaine qui dit la même chose
 * que l'écran (AGENTS.md § 4) : le grenier pour un serveur, les canaris pour
 * une réserve, la pirogue pour un déploiement.
 *
 * Deux encres seulement : `currentColor`, hérité de l'endroit où la scène est
 * posée, et l'accent de la marque pour le seul détail qui compte dans chaque
 * dessin. Le trait reste net à n'importe quelle taille, sans requête
 * supplémentaire ni seconde version pour le thème sombre.
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
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      [attr.aria-label]="alt()"
      [attr.aria-hidden]="alt() ? null : true"
      [style.width.px]="width()"
      class="h-auto"
      style="color: var(--color-text-tertiary);"
    >
      @switch (name()) {
        @case ('managed-cloud') {
          <!-- Cloud géré : le grenier du village, plein et tenu pour vous. -->
          <path d="M42 40 L44 74 H76 L78 40" stroke-width="2"/>
          <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
          <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="2"/>
          <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width=".9" opacity=".6"/>
          <path d="M58 6 L60 2 L62 6" stroke-width="1.4"/>
          <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="1.1" opacity=".7"/>
          <rect x="54" y="48" width="12" height="11" rx="1"/>
          <g style="color: var(--color-primary-500)">
            <path d="M56.5 56 h0.01 M60 54 h0.01 M63.5 56 h0.01 M58 51.5h0.01 M62 51.5h0.01" stroke-width="2.6"/>
          </g>
        }
        @case ('own-server') {
          <!-- Votre machine : la porte du grenier, et la serrure de bois dont vous avez la clé. -->
          <rect x="34" y="10" width="44" height="70" rx="2" stroke-width="2"/>
          <path d="M40 16 H72 V74 H40Z" opacity=".55"/>
          <path d="M44 22 L50 28 L44 34 M68 22 L62 28 L68 34 M44 60 L50 66 L44 72 M68 60 L62 66 L68 72" stroke-width="1.2" opacity=".7"/>
          <path d="M56 18 V36 M56 58 V74" stroke-width="1" opacity=".5"/>
          <rect x="74" y="30" width="12" height="30" rx="2" stroke-width="2"/>
          <path d="M78 34 h4 M78 56 h4" stroke-width="1" opacity=".6"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 45 H96" stroke-width="3"/>
            <path d="M96 41 V49" stroke-width="2"/>
            <path d="M66 42 L69 45 L66 48 L63 45Z" stroke-width="1.4"/>
          </g>
        }
        @case ('code') {
          <!-- Un dépôt : le métier à tisser, où le code se construit fil à fil. -->
          <path d="M26 10 V82 M94 10 V82 M22 12 H98" stroke-width="2"/>
          <path d="M60 12 V18 M52 18 H68"/>
          <path d="M44 30 H76 M44 36 H76" stroke-width="1.8"/>
          <path d="M46 20 V80 M50 20 V80 M54 20 V80 M58 20 V80 M62 20 V80 M66 20 V80 M70 20 V80 M74 20 V80" stroke-width=".9" opacity=".65"/>
          <rect x="43" y="58" width="34" height="22" rx="1" stroke-width="1.6"/>
          <path d="M44.0 60 h3.2 v3.4 h-3.2z M53.2 60 h3.2 v3.4 h-3.2z M62.4 60 h3.2 v3.4 h-3.2z M71.6 60 h3.2 v3.4 h-3.2z M48.6 65 h3.2 v3.4 h-3.2z M57.8 65 h3.2 v3.4 h-3.2z M67.0 65 h3.2 v3.4 h-3.2z M44.0 70 h3.2 v3.4 h-3.2z M53.2 70 h3.2 v3.4 h-3.2z M62.4 70 h3.2 v3.4 h-3.2z M71.6 70 h3.2 v3.4 h-3.2z M48.6 75 h3.2 v3.4 h-3.2z M57.8 75 h3.2 v3.4 h-3.2z M67.0 75 h3.2 v3.4 h-3.2z" stroke-width="1" opacity=".8"/>
          <path d="M40 82 H80" stroke-width="2"/>
          <g style="color: var(--color-primary-500)">
            <path d="M34 50 C44 46 76 46 86 50 C76 54 44 54 34 50Z" stroke-width="1.8"/>
            <path d="M52 50 H68" stroke-width="2.4"/>
          </g>
        }
        @case ('server') {
          <!-- Un serveur : le grenier, fermé par son loquet. -->
          <path d="M42 40 L44 74 H76 L78 40" stroke-width="2"/>
          <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
          <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="2"/>
          <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width=".9" opacity=".6"/>
          <path d="M58 6 L60 2 L62 6" stroke-width="1.4"/>
          <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="1.1" opacity=".7"/>
          <rect x="54" y="48" width="12" height="11" rx="1"/>
          <g style="color: var(--color-primary-500)">
            <path d="M51 53.5 H64" stroke-width="2.2"/>
            <path d="M64 51 V56" stroke-width="1.6"/>
          </g>
        }
        @case ('store') {
          <!-- Une réserve (bases de données, stockage) : les canaris où l'on garde. -->
          <path d="M8 78 H112" opacity=".4"/>
          <path d="M21.5 38 C21.5 45.2 12 48 12 62 C12 76 20.4 78 26 78 C31.6 78 40 76 40 62 C40 48 30.5 45.2 30.5 38" stroke-width="2"/>
          <ellipse cx="26" cy="38" rx="6.5" ry="2" stroke-width="1.6"/>
          <path d="M15.1 54.8 L16.6 58.8 L18.2 54.8 L19.8 58.8 L21.3 54.8 L22.9 58.8 L24.4 54.8 L26 58.8 L27.6 54.8 L29.1 58.8 L30.7 54.8 L32.2 58.8 L33.8 54.8 L35.4 58.8 L36.9 54.8" stroke-width="1" opacity=".7"/>
          <path d="M89.5 42 C89.5 48.5 80 51 80 63.6 C80 76 88.4 78 94 78 C99.6 78 108 76 108 63.6 C108 51 98.5 48.5 98.5 42" stroke-width="2"/>
          <ellipse cx="94" cy="42" rx="6.5" ry="2" stroke-width="1.6"/>
          <path d="M83.1 57.1 L84.6 61.1 L86.2 57.1 L87.8 61.1 L89.3 57.1 L90.9 61.1 L92.4 57.1 L94 61.1 L95.6 57.1 L97.1 61.1 L98.7 57.1 L100.2 61.1 L101.8 57.1 L103.4 61.1 L104.9 57.1" stroke-width="1" opacity=".7"/>
          <g style="color: var(--color-primary-500)">
            <path d="M53.9 24 C53.9 33.7 41 37.5 41 56.4 C41 76 52.4 78 60 78 C67.6 78 79 76 79 56.4 C79 37.5 66.1 33.7 66.1 24" stroke-width="2"/>
            <ellipse cx="60" cy="24" rx="8.1" ry="2" stroke-width="1.6"/>
            <path d="M45.2 46.7 L47.3 50.7 L49.4 46.7 L51.5 50.7 L53.6 46.7 L55.8 50.7 L57.9 46.7 L60 50.7 L62.1 46.7 L64.2 50.7 L66.4 46.7 L68.5 50.7 L70.6 46.7 L72.7 50.7 L74.8 46.7" stroke-width="1" opacity=".7"/>
          </g>
        }
        @case ('market') {
          <!-- Un modèle prêt à l'emploi : l'étal du marché, où l'on choisit. -->
          <path d="M10 80 H110" opacity=".4"/>
          <path d="M16 22 L60 10 L104 22 Z" stroke-width="2"/>
          <path d="M16 22 L24 28 L32 22 L40 28 L48 22 L56 28 L64 22 L72 28 L80 22 L88 28 L96 22 L104 28" stroke-width="1.2"/>
          <path d="M22 24 V80 M98 24 V80" stroke-width="1.8"/>
          <path d="M18 58 H102" stroke-width="2"/>
          <path d="M26 58 V80 M94 58 V80" stroke-width="1.2" opacity=".7"/>
          <path d="M30 58 C30 50 42 50 42 58"/>
          <path d="M46 58 C46 46 62 46 62 58"/>
          <path d="M34 50 L38 54 M50 50 L54 54 M58 50 L55 54" stroke-width="1" opacity=".6"/>
          <g style="color: var(--color-primary-500)">
            <path d="M68 58 C66 48 70 42 78 42 C86 42 90 48 88 58" stroke-width="1.8"/>
            <path d="M72 46 C74 44 82 44 84 46" stroke-width="1.2"/>
          </g>
          <path d="M34 66 L38 70 L42 66 L46 70 L50 66 M70 66 L74 70 L78 66 L82 70 L86 66" stroke-width="1" opacity=".55"/>
        }
        @case ('activity') {
          <!-- Les déploiements : la pirogue, qui attend de prendre le large. -->
          <path d="M8 38 C12 44 16 50 24 56 C40 66 82 66 98 56 C104 52 108 44 112 34" stroke-width="2"/>
          <path d="M8 38 C18 46 40 50 60 50 C80 50 100 46 112 34" stroke-width="1.6"/>
          <path d="M20 48 L26 55.4 L28.5 50.6 L35.1 57.6 L38.7 52.5 L45.3 59.1 L50 53.5 L56.2 59.7 L61.8 53.8 L67.3 59.6 L73.4 53.1 L78 58.5 L84.4 51.7 L87.8 56.6 L94.1 49.3 L96.4 53.8 L102 46" stroke-width="1.1" opacity=".75"/>
          <path d="M44 50 L36 28 M36 28 L33 22 C32 20 34 19 35 21 L38 27" stroke-width="1.6"/>
          <g style="color: var(--color-primary-500)">
            <path d="M112 34 L116 26 L110 30 Z" stroke-width="1.8"/>
            <path d="M104 44 L107 40 L110 44 L107 48 Z" stroke-width="1.6"/>
          </g>
          <path d="M14 72 C20 68 26 68 32 72 S44 76 50 72 S62 68 68 72 S80 76 86 72 S98 68 104 72" opacity=".5"/>
          <path d="M30 80 C36 77 42 77 48 80 S60 83 66 80 S78 77 84 80" opacity=".3"/>
        }
        @case ('search') {
          <!-- Une recherche : le van, qui trie le grain pour garder ce qu'on cherche. -->
          <ellipse cx="60" cy="56" rx="44" ry="15" stroke-width="2"/>
          <ellipse cx="60" cy="56" rx="36" ry="11" opacity=".6"/>
          <path d="M26 52 C40 48 80 48 94 52 M26 60 C40 65 80 65 94 60" stroke-width=".9" opacity=".45"/>
          <path d="M60 45 V67 M42 46 L46 66 M78 46 L74 66" stroke-width=".9" opacity=".45"/>
          <path d="M44 30 h0.01 M52 22 h0.01 M72 26 h0.01 M80 18 h0.01 M36 18 h0.01 M62 14 h0.01 M90 28 h0.01" stroke-width="2.6" opacity=".5"/>
          <path d="M36 56 h0.01 M48 60 h0.01 M52 52 h0.01 M84 56 h0.01 M78 61 h0.01" stroke-width="2.6"/>
          <g style="color: var(--color-primary-500)">
            <circle cx="66" cy="56" r="7" stroke-width="1.8"/>
            <path d="M66 52.5 L69 56 L66 59.5 L63 56Z" stroke-width="1.4"/>
          </g>
        }
        @case ('shield') {
          <!-- La sécurité : le bouclier aux lances croisées, celui de la connexion. -->
          <path d="M33 80 L42 68 M78 20 L86 9 M87 80 L78 68 M42 20 L34 9" stroke-width="1.6"/>
          <path d="M86 9 L90 2 L82 6Z M34 9 L30 2 L38 6Z" stroke-width="1.4"/>
          <path d="M60 10 C76 20 86 32 86 44 C86 56 76 68 60 78 C44 68 34 56 34 44 C34 32 44 20 60 10Z" stroke-width="2"/>
          <path d="M60 18 C72 26 79 35 79 44 C79 53 72 62 60 70 C48 62 41 53 41 44 C41 35 48 26 60 18Z" stroke-width="1.2"/>
          <path d="M52 26 L60 31 L68 26 M52 62 L60 57 L68 62 M46 40 L50 44 L46 48 M74 40 L70 44 L74 48" stroke-width="1.2"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 36 L67 44 L60 52 L53 44Z" stroke-width="2"/>
          </g>
        }
        @case ('team') {
          <!-- L'équipe : l'arbre à palabres et les tabourets autour. -->
          <path d="M14 78 H106" opacity=".4"/>
          <path d="M22 32 C14 30 12 20 22 16 C24 6 40 4 46 10 C52 2 70 2 76 10 C84 4 100 8 98 18 C108 20 106 32 98 34 C94 38 82 38 76 34 C70 38 50 38 44 34 C38 38 26 36 22 32Z" stroke-width="2"/>
          <path d="M32 22 L36 26 L40 22 M52 16 L56 20 L60 16 L64 20 L68 16 M80 22 L84 26 L88 22" stroke-width="1.1" opacity=".6"/>
          <path d="M54 78 C56 64 56 48 52 36 M66 78 C64 64 64 48 68 36 M58 36 V28 M62 36 L66 30" stroke-width="2"/>
          <g  transform="translate(28 74) scale(1)">
            <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="1.8"/>
            <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.2"/>
            <path d="M-8 5 H8" stroke-width="1.8"/>
          </g>
          <g  transform="translate(92 74) scale(1)">
            <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="1.8"/>
            <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.2"/>
            <path d="M-8 5 H8" stroke-width="1.8"/>
          </g>
          <g  transform="translate(40 64) scale(0.75)">
            <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="2.4"/>
            <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.6"/>
            <path d="M-8 5 H8" stroke-width="2.4"/>
          </g>
          <g style="color: var(--color-primary-500)" transform="translate(80 64) scale(0.75)">
            <path d="M-9 -8 C-4 -5 4 -5 9 -8" stroke-width="2.4"/>
            <path d="M-6 -6 C-3 -2 -3 2 -6 5 M6 -6 C3 -2 3 2 6 5 M-2 -5 V5 M2 -5 V5" stroke-width="1.6"/>
            <path d="M-8 5 H8" stroke-width="2.4"/>
          </g>
        }
        @case ('beads') {
          <!-- Les étiquettes : des perles enfilées, chacune reconnaissable à sa forme. -->
          <path d="M14 20 C40 70 80 70 106 20" stroke-width="1.4"/>
          <path d="M14 20 C12 14 18 12 18 17 M106 20 C108 14 102 12 102 17" stroke-width="1.4"/>
          <circle cx="31" cy="44" r="5" stroke-width="1.8"/>
          <path d="M28.5 41.5 L33.5 46.5" stroke-width="1" opacity=".6"/>
          <ellipse cx="45.2" cy="54.1" rx="7" ry="4.2" transform="rotate(25 45.2 54.1)" stroke-width="1.8"/>
          <path d="M42 51.6 L41 55.6 M46 53 L45 57 M50 54.4 L49 58.2" stroke-width="1" opacity=".6"/>
          <ellipse cx="74.8" cy="54.1" rx="7" ry="4.2" transform="rotate(-25 74.8 54.1)" stroke-width="1.8"/>
          <path d="M70 54.4 L71 58.2 M74 53 L75 57 M78 51.6 L79 55.6" stroke-width="1" opacity=".6"/>
          <circle cx="89" cy="44" r="5" stroke-width="1.8"/>
          <path d="M86.5 46.5 L91.5 41.5" stroke-width="1" opacity=".6"/>
          <path d="M22.5 33.5 h0.01 M37.5 50 h0.01 M53 57 h0.01 M67 57 h0.01 M82.5 50 h0.01 M97.5 33.5 h0.01" stroke-width="2.6" opacity=".6"/>
          <path d="M60 66 V74 M56 78 L60 74 L64 78" stroke-width="1.2" opacity=".55"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 48.5 L67 57.5 L60 66 L53 57.5Z" stroke-width="2"/>
            <path d="M60 53 L63 57.5 L60 61.5 L57 57.5Z" stroke-width="1.1"/>
          </g>
        }
        @case ('net') {
          <!-- Un réseau : l'épervier, le filet de pêche dont chaque nœud tient les autres. -->
          <path d="M60 3 V12" stroke-width="1.6"/>
          <path d="M60 12 L22 72 M60 12 L98 72" stroke-width="2"/>
          <path d="M22 72 Q60 84 98 72" stroke-width="2"/>
          <path d="M60 12 L34.9 75.4 M60 12 L47.8 77.4 M60 12 V78 M60 12 L72.2 77.4 M60 12 L85.1 75.4" stroke-width=".9" opacity=".6"/>
          <path d="M46.7 33 Q60 37 73.3 33 M37.2 48 Q60 55 82.8 48 M28.8 61.2 Q60 70 91.2 61.2" stroke-width="1" opacity=".7"/>
          <path d="M22 75 h0.01 M34.9 78.4 h0.01 M47.8 80.4 h0.01 M60 81 h0.01 M72.2 80.4 h0.01 M85.1 78.4 h0.01 M98 75 h0.01" stroke-width="3.2"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 47 L64.5 51.5 L60 56 L55.5 51.5Z" stroke-width="1.8"/>
          </g>
        }
        @case ('cowries') {
          <!-- Le prix : la calebasse ouverte, et les cauris qu'elle garde. -->
          <path d="M16 44 C16 70 36 82 60 82 C84 82 104 70 104 44" stroke-width="2"/>
          <ellipse cx="60" cy="44" rx="44" ry="7" stroke-width="2"/>
          <path d="M22 58 L28 63 L34 58 L40 63 L46 58 L52 63 L58 58 L64 63 L70 58 L76 63 L82 58 L88 63 L94 58 L98 61" stroke-width="1.1" opacity=".7"/>
          <path d="M34 72 h0.01 M47 76 h0.01 M60 77 h0.01 M73 76 h0.01 M86 72 h0.01" stroke-width="2.4" opacity=".55"/>
          <g transform="rotate(-12 38 38)"><ellipse cx="38" cy="38" rx="7.5" ry="5" stroke-width="1.5"/><path d="M33.5 38 C36.5 36.8 39.5 39.2 42.5 38" stroke-width="1.1"/><path d="M35 36.4 v3.2 M38 36.2 v3.6 M41 36.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(6 55 39)"><ellipse cx="55" cy="39" rx="7.5" ry="5" stroke-width="1.5"/><path d="M50.5 39 C53.5 37.8 56.5 40.2 59.5 39" stroke-width="1.1"/><path d="M52 37.4 v3.2 M55 37.2 v3.6 M58 37.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(-8 72 38)"><ellipse cx="72" cy="38" rx="7.5" ry="5" stroke-width="1.5"/><path d="M67.5 38 C70.5 36.8 73.5 39.2 76.5 38" stroke-width="1.1"/><path d="M69 36.4 v3.2 M72 36.2 v3.6 M75 36.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(14 88 39)"><ellipse cx="88" cy="39" rx="7.5" ry="5" stroke-width="1.5"/><path d="M83.5 39 C86.5 37.8 89.5 40.2 92.5 39" stroke-width="1.1"/><path d="M85 37.4 v3.2 M88 37.2 v3.6 M91 37.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(10 47 27)"><ellipse cx="47" cy="27" rx="7.5" ry="5" stroke-width="1.5"/><path d="M42.5 27 C45.5 25.8 48.5 28.2 51.5 27" stroke-width="1.1"/><path d="M44 25.4 v3.2 M47 25.2 v3.6 M50 25.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(-6 64 27)"><ellipse cx="64" cy="27" rx="7.5" ry="5" stroke-width="1.5"/><path d="M59.5 27 C62.5 25.8 65.5 28.2 68.5 27" stroke-width="1.1"/><path d="M61 25.4 v3.2 M64 25.2 v3.6 M67 25.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g transform="rotate(8 80 28)"><ellipse cx="80" cy="28" rx="7.5" ry="5" stroke-width="1.5"/><path d="M75.5 28 C78.5 26.8 81.5 29.2 84.5 28" stroke-width="1.1"/><path d="M77 26.4 v3.2 M80 26.2 v3.6 M83 26.4 v3.2" stroke-width=".7" opacity=".7"/></g>
          <g style="color: var(--color-primary-500)"><g transform="rotate(-4 60 15)"><ellipse cx="60" cy="15" rx="7.5" ry="5" stroke-width="1.5"/><path d="M55.5 15 C58.5 13.8 61.5 16.2 64.5 15" stroke-width="1.1"/><path d="M57 13.4 v3.2 M60 13.2 v3.6 M63 13.4 v3.2" stroke-width=".7" opacity=".7"/></g></g>
        }
        @default {
          <!-- Ce qu'on déploie : le panier tressé, chargé et prêt à partir. -->
          <path d="M40 40 C38 16 82 16 80 40" stroke-width="2"/>
          <path d="M44 40 C43 22 77 22 76 40" opacity=".55"/>
          <path d="M36 26 L40 30 M84 26 L80 30" opacity=".6"/>
          <ellipse cx="60" cy="42" rx="34" ry="6" stroke-width="2"/>
          <path d="M26 42 C26 62 34 78 60 78 C86 78 94 62 94 42" stroke-width="2"/>
          <path d="M28 46 L33.3 52 L38.7 46 L44 52 L49.3 46 L54.7 52 L60 46 L65.3 52 L70.7 46 L76 52 L81.3 46 L86.7 52 L92 46 M30 55 L35 61 L40 55 L45 61 L50 55 L55 61 L60 55 L65 61 L70 55 L75 61 L80 55 L85 61 L90 55 M32 64 L36.7 70 L41.3 64 L46 70 L50.7 64 L55.3 70 L60 64 L64.7 70 L69.3 64 L74 70 L78.7 64 L83.3 70 L88 64" stroke-width="1" opacity=".7"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 45.5 L64 51 L60 56.5 L56 51Z" stroke-width="1.8"/>
          </g>
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
