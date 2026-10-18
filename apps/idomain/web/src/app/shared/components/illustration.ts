import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les illustrations d'iDomain — style IDEM (AGENTS.md § 4) : un objet de la culture africaine qui
 * dit la même chose que l'écran, au trait, deux encres (`currentColor` et la couleur primaire pour
 * le seul détail qui compte). Aucun objet nouveau : chacun reprend le dessin du répertoire
 * (`docs/ILLUSTRATIONS.md`) qui porte déjà ce sens.
 *
 *   facade    façade ndebele peinte : une adresse à son nom — le nom de domaine (même dessin qu'iDeploy)
 *   search    van de vannage : chercher, trier pour trouver
 *   cowries   calebasse de cauris : le prix, le paiement
 *   pirogue   pirogue à la proue dressée : la mise en ligne (relier le nom au site)
 *   shield    bouclier aux lances croisées : la protection (garanties de prix, remboursement, courrier intact)
 *   calabash  calebasse vide : rien encore
 *   cracked   calebasse fêlée : une erreur
 */
export type IllustrationKind = 'facade' | 'search' | 'cowries' | 'pirogue' | 'shield' | 'calabash' | 'cracked';

@Component({
  selector: 'idm-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'block', style: 'color: var(--color-text-tertiary)' },
  template: `
    <svg viewBox="0 0 120 88" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" [style.width.px]="width()" class="h-auto max-w-full">
      @switch (kind()) {
        @case ('facade') {
          <path d="M8 80 H112" opacity=".7" />
          <path d="M22 80 V36 H34 V30 H46 V24 H74 V30 H86 V36 H98 V80" stroke-width="2" />
          <path d="M52 80 V58 C52 50 68 50 68 58 V80" stroke-width="2" />
          <path d="M28 44 H46 V72 H28Z M74 44 H92 V72 H74Z" opacity=".75" />
          <path d="M28 52 L32.5 47 L37 52 L41.5 47 L46 52 M74 52 L78.5 47 L83 52 L87.5 47 L92 52" stroke-width="1.1" opacity=".7" />
          <path d="M31 58 H43 V66 H31Z M77 58 H89 V66 H77Z" stroke-width="1" opacity=".6" />
          <path d="M28 76 H46 M74 76 H92 M26 40 H94" stroke-width="1" opacity=".5" />
          <g style="color: var(--color-primary-500)">
            <path d="M60 31 L66 37 L60 43 L54 37Z" stroke-width="1.8" />
            <path d="M48 37 H52 M68 37 H72" stroke-width="1.4" />
          </g>
        }
        @case ('search') {
          <ellipse cx="60" cy="56" rx="44" ry="15" stroke-width="2" />
          <ellipse cx="60" cy="56" rx="36" ry="11" opacity=".6" />
          <path d="M26 52 C40 48 80 48 94 52 M26 60 C40 65 80 65 94 60" stroke-width=".9" opacity=".45" />
          <path d="M60 45 V67 M42 46 L46 66 M78 46 L74 66" stroke-width=".9" opacity=".45" />
          <path d="M44 30 h0.01 M52 22 h0.01 M72 26 h0.01 M80 18 h0.01 M36 18 h0.01 M62 14 h0.01 M90 28 h0.01" stroke-width="2.6" opacity=".5" />
          <path d="M36 56 h0.01 M48 60 h0.01 M52 52 h0.01 M84 56 h0.01 M78 61 h0.01" stroke-width="2.6" />
          <g style="color: var(--color-primary-500)">
            <circle cx="66" cy="56" r="7" stroke-width="1.8" />
            <path d="M66 52.5 L69 56 L66 59.5 L63 56Z" stroke-width="1.4" />
          </g>
        }
        @case ('cowries') {
          <path d="M16 44 C16 70 36 82 60 82 C84 82 104 70 104 44" stroke-width="2" />
          <ellipse cx="60" cy="44" rx="44" ry="7" stroke-width="2" />
          <path d="M22 58 L28 63 L34 58 L40 63 L46 58 L52 63 L58 58 L64 63 L70 58 L76 63 L82 58 L88 63 L94 58 L98 61" stroke-width="1.1" opacity=".7" />
          <path d="M34 72 h0.01 M47 76 h0.01 M60 77 h0.01 M73 76 h0.01 M86 72 h0.01" stroke-width="2.4" opacity=".55" />
          @for (c of cowries; track c.x) {
            <g [attr.transform]="'rotate(' + c.r + ' ' + c.x + ' ' + c.y + ')'">
              <ellipse [attr.cx]="c.x" [attr.cy]="c.y" rx="7.5" ry="5" stroke-width="1.5" />
              <path [attr.d]="'M' + (c.x - 4.5) + ' ' + c.y + ' C' + (c.x - 1.5) + ' ' + (c.y - 1.2) + ' ' + (c.x + 1.5) + ' ' + (c.y + 1.2) + ' ' + (c.x + 4.5) + ' ' + c.y" stroke-width="1.1" />
            </g>
          }
          <g style="color: var(--color-primary-500)" transform="rotate(-4 60 15)">
            <ellipse cx="60" cy="15" rx="7.5" ry="5" stroke-width="1.5" />
            <path d="M55.5 15 C58.5 13.8 61.5 16.2 64.5 15" stroke-width="1.1" />
          </g>
        }
        @case ('pirogue') {
          <path d="M8 38 C12 44 16 50 24 56 C40 66 82 66 98 56 C104 52 108 44 112 34" stroke-width="2" />
          <path d="M8 38 C18 46 40 50 60 50 C80 50 100 46 112 34" stroke-width="1.6" />
          <path d="M20 48 L26 55.4 L28.5 50.6 L35.1 57.6 L38.7 52.5 L45.3 59.1 L50 53.5 L56.2 59.7 L61.8 53.8 L67.3 59.6 L73.4 53.1 L78 58.5 L84.4 51.7 L87.8 56.6 L94.1 49.3 L96.4 53.8 L102 46" stroke-width="1.1" opacity=".75" />
          <path d="M44 50 L36 28 M36 28 L33 22 C32 20 34 19 35 21 L38 27" stroke-width="1.6" />
          <g style="color: var(--color-primary-500)">
            <path d="M112 34 L116 26 L110 30 Z" stroke-width="1.8" />
            <path d="M104 44 L107 40 L110 44 L107 48 Z" stroke-width="1.6" />
          </g>
          <path d="M14 72 C20 68 26 68 32 72 S44 76 50 72 S62 68 68 72 S80 76 86 72 S98 68 104 72" opacity=".5" />
          <path d="M30 80 C36 77 42 77 48 80 S60 83 66 80 S78 77 84 80" opacity=".3" />
        }
        @case ('shield') {
          <path d="M33 80 L42 68 M78 20 L86 9 M87 80 L78 68 M42 20 L34 9" stroke-width="1.6" />
          <path d="M86 9 L90 2 L82 6Z M34 9 L30 2 L38 6Z" stroke-width="1.4" />
          <path d="M60 10 C76 20 86 32 86 44 C86 56 76 68 60 78 C44 68 34 56 34 44 C34 32 44 20 60 10Z" stroke-width="2" style="fill: var(--color-surface-1)" />
          <path d="M60 18 C72 26 79 35 79 44 C79 53 72 62 60 70 C48 62 41 53 41 44 C41 35 48 26 60 18Z" stroke-width="1.2" />
          <path d="M52 26 L60 31 L68 26 M52 62 L60 57 L68 62 M46 40 L50 44 L46 48 M74 40 L70 44 L74 48" stroke-width="1.2" />
          <g style="color: var(--color-primary-500)"><path d="M60 36 L67 44 L60 52 L53 44Z" stroke-width="2" /></g>
        }
        @case ('calabash') {
          <g transform="translate(12 -2) scale(0.6)" stroke-width="2.6">
            <path d="M26 74 H134" />
            <path d="M28 74 C30 112 54 134 80 134 C106 134 130 112 132 74" />
            <path d="M44 96 C58 108 102 108 116 96" stroke-width="1.8" stroke-dasharray="0 9" />
            <path d="M80 134 V142 M66 142 H94" />
            <ellipse cx="80" cy="74" rx="54" ry="8" style="color: var(--color-primary-500)" stroke="currentColor" />
          </g>
        }
        @case ('cracked') {
          <g transform="translate(12 -2) scale(0.6)" stroke-width="2.6">
            <path d="M26 74 H134" />
            <path d="M28 74 C30 112 54 134 80 134 C106 134 130 112 132 74" />
            <path d="M44 96 C58 108 102 108 116 96" stroke-width="1.8" stroke-dasharray="0 9" />
            <path d="M80 134 V142 M66 142 H94" />
            <path d="M84 74 L78 88 L88 98 L80 112 L86 124" style="color: var(--color-primary-500)" stroke="currentColor" stroke-width="3.4" />
          </g>
        }
      }
    </svg>
  `,
})
export class Illustration {
  readonly kind = input.required<IllustrationKind>();
  readonly width = input(140);
  protected readonly cowries = [
    { x: 38, y: 38, r: -12 },
    { x: 55, y: 39, r: 6 },
    { x: 72, y: 38, r: -8 },
    { x: 88, y: 39, r: 14 },
    { x: 47, y: 27, r: 10 },
    { x: 64, y: 27, r: -6 },
    { x: 80, y: 28, r: 8 },
  ];
}
