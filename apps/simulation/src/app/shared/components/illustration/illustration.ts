import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les scènes disponibles. Ajouter un nom ici oblige à dessiner son cas. */
export type IllustrationName =
  | 'awale'
  | 'granary-full'
  | 'granary'
  | 'leaflet'
  | 'import'
  | 'basket'
  | 'shield'
  | 'cowries'
  | 'baobab'
  | 'market'
  | 'ladder'
  | 'daba'
  | 'kyinie'
  | 'winnow'
  | 'balance'
  | 'calabash-empty'
  | 'calabash-cracked'
  | 'sankofa';

/**
 * Les illustrations du simulateur, dessinées en ligne (AGENTS.md § 4) : chacune
 * est un objet de la culture africaine qui dit la même chose que l'écran. Les
 * tracés sont ceux déjà retenus ailleurs dans IDEM (dashboard, iDeploy, AppGen)
 * pour que le même objet ait partout le même dessin.
 *
 * Deux encres seulement : `currentColor`, hérité de l'endroit où la scène est
 * posée, et `--color-primary-500` pour le seul détail qui compte.
 */
@Component({
  selector: 'sim-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' },
  template: `
    <svg
      viewBox="0 0 120 88"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      class="block h-auto w-full"
      style="color: var(--color-text-tertiary)"
    >
      @switch (name()) {
        @case ('awale') {
          <!-- Simulation : le plateau d'awalé, où l'on calcule ses coups avant de semer. -->
          <g transform="translate(0 2)">
            <path d="M16 34 C16 28 20 26 26 26 H94 C100 26 104 28 104 34 V54 C104 60 100 62 94 62 H26 C20 62 16 60 16 54Z" stroke-width="2"/>
            <path d="M22 66 L26 62 M98 66 L94 62 M22 66 H98" opacity=".7"/>
            <ellipse cx="30" cy="36" rx="4.8" ry="3.6"/><ellipse cx="54" cy="36" rx="4.8" ry="3.6"/>
            <ellipse cx="66" cy="36" rx="4.8" ry="3.6"/><ellipse cx="78" cy="36" rx="4.8" ry="3.6"/>
            <ellipse cx="90" cy="36" rx="4.8" ry="3.6"/><ellipse cx="30" cy="52" rx="4.8" ry="3.6"/>
            <ellipse cx="42" cy="52" rx="4.8" ry="3.6"/><ellipse cx="54" cy="52" rx="4.8" ry="3.6"/>
            <ellipse cx="66" cy="52" rx="4.8" ry="3.6"/><ellipse cx="78" cy="52" rx="4.8" ry="3.6"/>
            <ellipse cx="90" cy="52" rx="4.8" ry="3.6"/>
            <path d="M27.8 36h0.01 M30 36h0.01 M32.2 36h0.01 M52.7 36h0.01 M55.3 36h0.01 M64.8 35h0.01 M67.2 35h0.01 M64.8 37h0.01 M67.2 37h0.01 M78 36h0.01 M87.8 36h0.01 M90 36h0.01 M92.2 36h0.01 M28.8 51h0.01 M31.2 51h0.01 M28.8 53h0.01 M31.2 53h0.01 M40.7 52h0.01 M43.3 52h0.01 M51.8 52h0.01 M54 52h0.01 M56.2 52h0.01 M76.8 51h0.01 M79.2 51h0.01 M76.8 53h0.01 M79.2 53h0.01 M88.7 52h0.01 M91.3 52h0.01" stroke-width="2.4"/>
            <g style="color: var(--color-primary-500)">
              <path d="M42 30 C50 20 64 20 70 30" stroke-width="1.6" stroke-dasharray="2 3"/>
              <path d="M66.5 27.5 L70 30.5 L71 26" stroke-width="1.6"/>
              <ellipse cx="42" cy="36" rx="4.8" ry="3.6" stroke-width="2"/>
            </g>
          </g>
        }
        @case ('granary-full') {
          <!-- Un projet IDEM : le grenier plein, la récolte est déjà là. -->
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
        @case ('granary') {
          <!-- Les imprévus : le grenier fermé, la réserve qui fait tenir pendant les coups durs. -->
          <path d="M42 40 L44 74 H76 L78 40" stroke-width="2"/>
          <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
          <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" stroke-width="2"/>
          <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" stroke-width=".9" opacity=".6"/>
          <path d="M58 6 L60 2 L62 6" stroke-width="1.4"/>
          <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" stroke-width="1.1" opacity=".7"/>
          <rect x="54" y="48" width="12" height="11" rx="1"/>
          <path d="M14 30 L20 36 M22 18 L26 26 M100 26 L106 20 M98 38 L106 36" stroke-width="1.4" opacity=".55"/>
          <g style="color: var(--color-primary-500)">
            <path d="M51 53.5 H64" stroke-width="2.2"/>
            <path d="M64 51 V56" stroke-width="1.6"/>
          </g>
        }
        @case ('leaflet') {
          <!-- Un document, un rapport : le feuillet manuscrit. -->
          <rect x="34" y="12" width="52" height="68" rx="2" stroke-width="2"/>
          <rect x="38" y="16" width="44" height="60" rx="1" stroke-width=".9" opacity=".6"/>
          <path d="M40 20 L43 23 L46 20 L49 23 L52 20 L55 23 L58 20 L61 23 L64 20 L67 23 L70 20 L73 23 L76 20 L79 23" stroke-width=".9" opacity=".6"/>
          <path d="M44 34 C48 32 52 36 56 34 S64 32 68 34 S74 36 76 34 M44 42 C48 40 52 44 56 42 S62 40 66 42 M44 50 C48 48 52 52 56 50 S64 48 68 50 S74 52 76 50" stroke-width="1.2" opacity=".8"/>
          <path d="M44 58 C48 56 52 60 56 58" stroke-width="1.2" opacity=".8"/>
          <g style="color: var(--color-primary-500)">
            <path d="M68 62 L73 67 L68 72 L63 67Z" stroke-width="2"/>
          </g>
        }
        @case ('import') {
          <!-- Un document qu'on apporte : le feuillet, et la flèche qui l'envoie. -->
          <g transform="translate(-10 0)">
            <rect x="34" y="12" width="52" height="68" rx="2" stroke-width="2"/>
            <rect x="38" y="16" width="44" height="60" rx="1" stroke-width=".9" opacity=".6"/>
            <path d="M40 20 L43 23 L46 20 L49 23 L52 20 L55 23 L58 20 L61 23 L64 20 L67 23 L70 20 L73 23 L76 20 L79 23" stroke-width=".9" opacity=".6"/>
            <path d="M44 34 C48 32 52 36 56 34 S64 32 68 34 S74 36 76 34 M44 42 C48 40 52 44 56 42 S62 40 66 42 M44 50 C48 48 52 52 56 50 S64 48 68 50 S74 52 76 50" stroke-width="1.2" opacity=".8"/>
            <path d="M44 58 C48 56 52 60 56 58" stroke-width="1.2" opacity=".8"/>
          </g>
          <g style="color: var(--color-primary-500)" stroke-width="2.4">
            <path d="M96 60 V28 M87 37 L96 28 L105 37"/>
          </g>
        }
        @case ('basket') {
          <!-- Le pack : le panier tressé, qui porte le tout. -->
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
        @case ('shield') {
          <!-- Se défendre : le bouclier aux lances croisées. -->
          <path d="M33 80 L42 68 M78 20 L86 9 M87 80 L78 68 M42 20 L34 9" stroke-width="1.6"/>
          <path d="M86 9 L90 2 L82 6Z M34 9 L30 2 L38 6Z" stroke-width="1.4"/>
          <path d="M60 10 C76 20 86 32 86 44 C86 56 76 68 60 78 C44 68 34 56 34 44 C34 32 44 20 60 10Z" stroke-width="2"/>
          <path d="M60 18 C72 26 79 35 79 44 C79 53 72 62 60 70 C48 62 41 53 41 44 C41 35 48 26 60 18Z" stroke-width="1.2"/>
          <path d="M52 26 L60 31 L68 26 M52 62 L60 57 L68 62 M46 40 L50 44 L46 48 M74 40 L70 44 L74 48" stroke-width="1.2"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 36 L67 44 L60 52 L53 44Z" stroke-width="2"/>
          </g>
        }
        @case ('cowries') {
          <!-- Le prix : la calebasse ouverte, et les cauris qu'elle garde. -->
          <path d="M16 44 C16 70 36 82 60 82 C84 82 104 70 104 44" stroke-width="2"/>
          <ellipse cx="60" cy="44" rx="44" ry="7" stroke-width="2"/>
          <path d="M22 58 L28 63 L34 58 L40 63 L46 58 L52 63 L58 58 L64 63 L70 58 L76 63 L82 58 L88 63 L94 58 L98 61" stroke-width="1.1" opacity=".7"/>
          <path d="M34 72 h0.01 M47 76 h0.01 M60 77 h0.01 M73 76 h0.01 M86 72 h0.01" stroke-width="2.4" opacity=".55"/>
          <g transform="rotate(-12 38 38)"><ellipse cx="38" cy="38" rx="7.5" ry="5" stroke-width="1.5"/><path d="M33.5 38 C36.5 36.8 39.5 39.2 42.5 38" stroke-width="1.1"/></g>
          <g transform="rotate(6 55 39)"><ellipse cx="55" cy="39" rx="7.5" ry="5" stroke-width="1.5"/><path d="M50.5 39 C53.5 37.8 56.5 40.2 59.5 39" stroke-width="1.1"/></g>
          <g transform="rotate(-8 72 38)"><ellipse cx="72" cy="38" rx="7.5" ry="5" stroke-width="1.5"/><path d="M67.5 38 C70.5 36.8 73.5 39.2 76.5 38" stroke-width="1.1"/></g>
          <g transform="rotate(14 88 39)"><ellipse cx="88" cy="39" rx="7.5" ry="5" stroke-width="1.5"/><path d="M83.5 39 C86.5 37.8 89.5 40.2 92.5 39" stroke-width="1.1"/></g>
          <g transform="rotate(10 47 27)"><ellipse cx="47" cy="27" rx="7.5" ry="5" stroke-width="1.5"/><path d="M42.5 27 C45.5 25.8 48.5 28.2 51.5 27" stroke-width="1.1"/></g>
          <g transform="rotate(-6 64 27)"><ellipse cx="64" cy="27" rx="7.5" ry="5" stroke-width="1.5"/><path d="M59.5 27 C62.5 25.8 65.5 28.2 68.5 27" stroke-width="1.1"/></g>
          <g transform="rotate(8 80 28)"><ellipse cx="80" cy="28" rx="7.5" ry="5" stroke-width="1.5"/><path d="M75.5 28 C78.5 26.8 81.5 29.2 84.5 28" stroke-width="1.1"/></g>
          <g style="color: var(--color-primary-500)"><g transform="rotate(-4 60 15)"><ellipse cx="60" cy="15" rx="7.5" ry="5" stroke-width="1.5"/><path d="M55.5 15 C58.5 13.8 61.5 16.2 64.5 15" stroke-width="1.1"/></g></g>
        }
        @case ('baobab') {
          <!-- Les investisseurs : le baobab qui porte son fruit, la croissance qui rapporte. -->
          <path d="M22 80 H98" opacity=".4"/>
          <path d="M44 80 C40 66 42 50 48 40 M76 80 C80 66 78 50 72 40" stroke-width="2"/>
          <path d="M48 40 C44 34 36 30 28 30 M48 40 C46 32 44 26 40 18 M55 38 C54 30 56 22 58 14 M65 38 C66 30 70 24 76 18 M72 40 C78 34 86 32 94 32" stroke-width="2"/>
          <path d="M28 30 C24 28 21 29 19 31 M28 30 C27 26 28 23 30 21 M40 18 C36 16 34 13 34 10 M40 18 C42 15 45 13 48 13 M58 14 C56 11 56 8 57 6 M58 14 C61 12 63 12 65 13 M76 18 C76 14 78 12 80 11 M76 18 C80 17 83 17 85 19 M94 32 C97 29 100 29 102 30 M94 32 C96 34 97 36 96 39" stroke-width="1.4"/>
          <path d="M52 50 V60 M57 46 V70 M63 48 V74 M68 52 V64" stroke-width="1" opacity=".45"/>
          <g style="color: var(--color-primary-500)">
            <path d="M86 32 V38" stroke-width="1.4"/>
            <path d="M86 38 C89 38 90 41 90 45 C90 49 88 51 86 51 C84 51 82 49 82 45 C82 41 83 38 86 38Z" stroke-width="1.8"/>
          </g>
        }
        @case ('market') {
          <!-- D'autres façons de vendre : l'étal du marché, où l'on choisit. -->
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
        @case ('ladder') {
          <!-- Les années à venir : l'échelle dogon, une marche à la fois. -->
          <path d="M36 82 H84" opacity=".4"/>
          <path d="M42 82 C46 60 54 30 58 16 M56 82 C58 60 64 30 68 16" stroke-width="2"/>
          <path d="M58 16 C56 10 52 6 48 4 M68 16 C70 10 74 6 78 4 M58 16 H68" stroke-width="2"/>
          <path d="M44 76 L56 76 L54 71" stroke-width="1.4"/>
          <path d="M47.2 65 L59.2 65 L57.2 60" stroke-width="1.4"/>
          <g style="color: var(--color-primary-500)">
            <path d="M50.4 54 L62.4 54 L60.4 49" stroke-width="2"/>
          </g>
          <path d="M53.6 43 L65.6 43 L63.6 38" stroke-width="1.4"/>
          <path d="M56.8 32 L68.8 32 L66.8 27" stroke-width="1.4"/>
          <path d="M60 21 L72 21 L70 16" stroke-width="1.4"/>
        }
        @case ('daba') {
          <!-- Vérifier sur le terrain : la daba, la houe d'Afrique de l'Ouest à lame
               plate perpendiculaire au manche. Ce qu'on apprend en retournant la
               terre — la pousse — porte la couleur. -->
          <path d="M8 80 H112" opacity=".4"/>
          <path d="M14 80 C18 76 24 76 28 80 M54 80 C58 76 64 76 68 80 M84 80 C88 76 94 76 98 80" stroke-width="1.1" opacity=".55"/>
          <path d="M30 78 C46 62 62 42 76 22" stroke-width="2.2"/>
          <path d="M76 22 C78 18 80 15 84 13" stroke-width="2.2"/>
          <path d="M82 12 C92 14 103 22 106 34 C99 37 90 35 84 28 Z" stroke-width="2"/>
          <path d="M88 20 L92 24 L96 21 L100 26 M87 26 L91 29 L95 27" stroke-width=".9" opacity=".7"/>
          <path d="M40 66 L44 70 M48 58 L52 62" stroke-width="1" opacity=".5"/>
          <g style="color: var(--color-primary-500)">
            <path d="M40 80 V70" stroke-width="1.8"/>
            <path d="M40 72 C36 68 31 68 29 71 C32 73 37 73 40 72Z M40 70 C44 65 49 65 51 68 C48 71 43 71 40 70Z" stroke-width="1.6"/>
          </g>
        }
        @case ('kyinie') {
          <!-- S'abriter des imprévus : le kyinie, l'ombrelle d'apparat akan
               (« le roi couvre »), qui protège de la pluie et du soleil. La
               flèche de son sommet porte la couleur. -->
          <path d="M8 22 L5 30 M15 12 L12 20 M10 40 L7 48 M112 22 L115 30 M105 12 L108 20 M110 40 L113 48" stroke-width="1.3" opacity=".45"/>
          <path d="M16 48 C20 28 38 16 60 16 C82 16 100 28 104 48" stroke-width="2"/>
          <path d="M16 48 Q22 56 28 48 Q34 56 40 48 Q46 56 52 48 Q58 56 64 48 Q70 56 76 48 Q82 56 88 48 Q94 56 100 48 Q102 52 104 48" stroke-width="1.6"/>
          <path d="M22 38 C34 32 86 32 98 38" stroke-width="1" opacity=".6"/>
          <path d="M26 33 L30 37 L34 33 L38 37 L42 33 L46 37 L50 33 L54 37 L58 33 L62 37 L66 33 L70 37 L74 33 L78 37 L82 33 L86 37 L90 33 L94 37" stroke-width=".9" opacity=".7"/>
          <path d="M40 22 C46 26 50 34 50 44 M80 22 C74 26 70 34 70 44" stroke-width=".9" opacity=".5"/>
          <path d="M60 48 V84 M54 84 H66" stroke-width="2"/>
          <g style="color: var(--color-primary-500)">
            <path d="M60 16 V10" stroke-width="1.6"/>
            <path d="M60 2 L64 6 L60 10 L56 6Z" stroke-width="1.8"/>
          </g>
        }
        @case ('winnow') {
          <!-- Vérifier : le van, qui sépare le bon grain de la paille. -->
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
        @case ('balance') {
          <!-- L'accord : la balance akan, on pèse juste avant de s'engager. -->
          <g transform="translate(0 10)">
            <path d="M60 6 V14" stroke-width="1.6"/>
            <circle cx="60" cy="16" r="2.5"/>
            <path d="M20 20 H100" stroke-width="2"/>
            <path d="M60 18 L56 24 H64Z"/>
            <path d="M20 20 L10 52 M20 20 L30 52 M100 20 L90 52 M100 20 L110 52" stroke-width="1" opacity=".7"/>
            <path d="M6 52 C8 60 32 60 34 52Z" stroke-width="2"/>
            <path d="M86 52 C88 60 112 60 114 52Z" stroke-width="2"/>
            <path d="M11 55 L14 57 L17 55 L20 57 L23 55 L26 57 L29 55 M91 55 L94 57 L97 55 L100 57 L103 55 L106 57 L109 55" stroke-width=".9" opacity=".6"/>
            <path d="M14 52 V46 H20 V52" stroke-width="1.4"/>
            <g style="color: var(--color-primary-500)">
              <path d="M96 52 V44 L100 40 L104 44 V52" stroke-width="1.8"/>
              <path d="M100 44 V48" stroke-width="1.3"/>
            </g>
          </g>
        }
        @case ('calabash-empty') {
          <!-- Rien encore : la calebasse vide attend d'être remplie. -->
          <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" stroke-width="2"/>
          <ellipse cx="60" cy="36" rx="34" ry="8" stroke-width="2"/>
          <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
          <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
          <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" stroke-width="3"/>
          <g style="color: var(--color-primary-500)">
            <ellipse cx="60" cy="36" rx="28" ry="5" stroke-dasharray="3 4"/>
          </g>
        }
        @case ('calabash-cracked') {
          <!-- Un échec : la calebasse fêlée, rien n'a pu y être puisé. -->
          <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" stroke-width="2"/>
          <ellipse cx="60" cy="36" rx="34" ry="8" stroke-width="2"/>
          <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
          <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
          <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" stroke-width="3"/>
          <ellipse cx="60" cy="36" rx="30" ry="5.5" opacity=".5"/>
          <g style="color: var(--color-primary-500)" stroke-width="2">
            <path d="M68 28.5 L64 38 L70 46 L63 56 L67 64 L64 75"/>
            <path d="M70 46 L76 49"/>
          </g>
        }
        @case ('sankofa') {
          <!-- Revenir sur ses pas : Sankofa, l'oiseau-poids akan qui se retourne. -->
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
export class Illustration {
  readonly name = input.required<IllustrationName>();
}
