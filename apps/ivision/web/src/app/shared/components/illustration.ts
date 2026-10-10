import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les illustrations d'iVision — style IDEM (AGENTS.md § 4) : un objet de la culture africaine
 * choisi pour ce que dit l'écran, au trait, deux encres (`currentColor` et la couleur primaire
 * pour le seul détail qui compte), décoratif pour les lecteurs d'écran.
 *
 *   kora      raconter en musique : la VIDÉO (même dessin que le module Communication d'IDEM)
 *   kente     bandes de kente assemblées : la COMPOSITION, donc le visuel
 *   stamp     tampon adinkra et son empreinte : l'identité de la marque (le site lu)
 *   stencil   pochoir d'adire eleko : le motif d'un MODÈLE reproduit sur une autre étoffe
 *   calame    feuillet et calame : les textes qu'on écrit soi-même (l'éditeur)
 *   calabash  calebasse vide : rien encore
 *   cracked   calebasse fêlée : une erreur
 *   cauris    cauris : les crédits
 *   kuba      étoffe de raphia kuba : une zone découpée, une pièce appliquée cousue — le MONTAGE
 *             (on coupe la prise, puis on l'habille)
 *
 * Sources des objets ajoutés pour iVision : `docs/ILLUSTRATIONS.md`.
 */
export type IllustrationKind = 'kora' | 'kente' | 'stamp' | 'stencil' | 'calame' | 'calabash' | 'cracked' | 'cauris' | 'kuba';

@Component({
  selector: 'iv-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 160" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      @switch (kind()) {
        @case ('kora') {
          <path d="M80 6 V70" />
          @for (y of rings; track y; let i = $index) {
            <path [attr.d]="i % 2 ? 'M80 ' + y + ' h6' : 'M80 ' + y + ' h-6'" />
          }
          <path d="M64 52 V84 M96 52 V84" />
          <circle cx="80" cy="110" r="38" style="fill: var(--color-surface-1)" />
          <path d="M50 89 Q80 78 110 89" />
          <path d="M52 132 Q80 146 108 132" stroke-dasharray="0 7" stroke-width="3" />
          @for (s of strings; track s.y) {
            <path [attr.d]="'M' + s.x + ' ' + s.y + ' L' + s.bx + ' ' + s.by + ' L80 152'" stroke-width="0.9" />
          }
          <rect x="74" y="86" width="12" height="36" rx="2" stroke="var(--color-primary-500)" stroke-width="2" style="fill: var(--color-surface-1)" />
          <path d="M74 94 h12 M74 102 h12 M74 110 h12 M74 118 h12" stroke="var(--color-primary-500)" stroke-width="1.4" />
          <path d="M122 48 q8 8 0 16 M130 42 q13 14 0 28" stroke-width="1.5" opacity="0.55" />
        }
        @case ('kente') {
          <!-- Trois bandes étroites cousues bord à bord : chaque bloc a sa place dans la composition. -->
          <path d="M34 18 H62 V142 H34Z M66 18 H94 V142 H66Z M98 18 H126 V142 H98Z" />
          <path d="M34 48 H62 M34 54 H62 M34 96 H62 M34 102 H62 M98 48 H126 M98 54 H126 M98 96 H126 M98 102 H126" stroke-width="1.2" />
          <path d="M40 66 L48 74 L56 66 M40 76 L48 84 L56 76 M104 66 L112 74 L120 66 M104 76 L112 84 L120 76" stroke-width="1.4" />
          <path d="M66 34 H94 M66 126 H94" stroke-width="1.2" />
          <path d="M72 120 L80 112 L88 120 M72 40 L80 48 L88 40" stroke-width="1.4" opacity="0.7" />
          <g stroke="var(--color-primary-500)" stroke-width="2">
            <path d="M70 62 H90 V98 H70Z" />
            <path d="M80 66 L88 80 L80 94 L72 80Z" />
          </g>
        }
        @case ('stamp') {
          <!-- Le tampon adinkra en calebasse et le signe qu'il imprime sur l'étoffe. -->
          <g transform="translate(8 14) scale(1.25)">
            <path d="M34 12 L26 44 M34 12 L42 44 M34 12 L20 40 M34 12 L48 40" stroke-width="1.9" />
            <path d="M30 10 H38" stroke-width="2.8" />
            <ellipse cx="34" cy="52" rx="22" ry="9" stroke-width="2.2" />
            <path d="M12 52 V56 C12 61 22 65 34 65 C46 65 56 61 56 56 V52" stroke-width="1.9" />
            <g transform="translate(34 52) scale(.9 .36)">
              <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" stroke-width="2.8" />
            </g>
            <path d="M64 22 H112 V78 H64Z" stroke-width="1.9" />
            <path d="M64 30 H112 M64 70 H112" stroke-width="1.1" opacity=".55" />
            <g style="color: var(--color-primary-500)" transform="translate(88 50) scale(1.15)">
              <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" stroke-width="3" />
            </g>
          </g>
        }
        @case ('stencil') {
          <!-- Adire eleko : le pochoir de tôle posé sur l'étoffe, la pâte de manioc passée à la
               spatule ; dessous, le même motif déjà imprimé sur une autre pièce, dans une autre couleur. -->
          <path d="M22 40 H104 V112 H22Z" />
          <path d="M22 40 L30 32 H112 V104 L104 112" />
          @for (c of stencilHoles; track c.x + '-' + c.y) {
            <path [attr.d]="'M' + c.x + ' ' + (c.y - 7) + ' L' + (c.x + 7) + ' ' + c.y + ' L' + c.x + ' ' + (c.y + 7) + ' L' + (c.x - 7) + ' ' + c.y + 'Z'" stroke-width="1.5" />
          }
          <path d="M40 76 H86" stroke-width="1.2" stroke-dasharray="2 5" />
          <path d="M110 22 L134 46 M106 26 L114 18 L138 42 L130 50Z" stroke-width="1.6" />
          <path d="M60 122 H146 V150 H60" stroke-width="1.4" opacity="0.7" />
          <g stroke="var(--color-primary-500)" stroke-width="1.8">
            @for (x of printed; track x) {
              <path [attr.d]="'M' + x + ' 129 L' + (x + 7) + ' 136 L' + x + ' 143 L' + (x - 7) + ' 136Z'" />
            }
          </g>
        }
        @case ('calame') {
          <path d="M36 22 H104 L120 38 V140 H36Z" />
          <path d="M104 22 V38 H120" />
          <path d="M50 56 H104 M50 70 H106 M50 84 H96 M50 98 H102 M50 112 H84" stroke-width="1.3" opacity="0.6" />
          <path d="M140 30 L92 112" stroke-width="2.2" />
          <path d="M92 112 L88 124 L98 116Z" stroke="var(--color-primary-500)" stroke-width="2" style="fill: var(--color-primary-500)" />
          <path d="M86 112 H96" stroke="var(--color-primary-500)" stroke-width="1.6" />
        }
        @case ('calabash') {
          <path d="M26 74 H134" />
          <path d="M28 74 C30 112 54 134 80 134 C106 134 130 112 132 74" />
          <path d="M44 96 C58 108 102 108 116 96" stroke-width="1.2" stroke-dasharray="0 7" />
          <path d="M80 134 V142 M66 142 H94" stroke-width="1.6" />
          <ellipse cx="80" cy="74" rx="54" ry="8" stroke="var(--color-primary-500)" stroke-width="1.6" />
        }
        @case ('cracked') {
          <path d="M26 74 H134" />
          <path d="M28 74 C30 112 54 134 80 134 C106 134 130 112 132 74" />
          <path d="M44 96 C58 108 102 108 116 96" stroke-width="1.2" stroke-dasharray="0 7" />
          <path d="M80 134 V142 M66 142 H94" stroke-width="1.6" />
          <path d="M84 74 L78 88 L88 98 L80 112 L86 124" stroke="var(--color-primary-500)" stroke-width="2.2" />
        }
        @case ('kuba') {
          <!-- L'étoffe de raphia tissée ; une zone découpée (la coupe) ; une pièce appliquée, cousue au point (l'habillage). -->
          <rect x="22" y="22" width="116" height="116" rx="3" />
          @for (x of weave; track x) {
            <path [attr.d]="'M' + x + ' 24 V136 M24 ' + x + ' H136'" stroke-width="0.6" opacity="0.35" />
          }
          <path d="M22 138 v8 M30 138 v10 M38 138 v7 M46 138 v10 M54 138 v8 M62 138 v10 M70 138 v7 M78 138 v10 M86 138 v8 M94 138 v10 M102 138 v7 M110 138 v10 M118 138 v8 M126 138 v10 M134 138 v7" stroke-width="1.1" />
          <rect x="38" y="40" width="26" height="22" rx="2" stroke-dasharray="3 4" style="fill: var(--color-surface-1)" />
          <path d="M44 51 h14" stroke-width="1.2" opacity="0.5" />
          <g stroke="var(--color-primary-500)">
            <path d="M98 58 C112 58 120 68 120 80 C120 94 110 102 98 102 C86 102 76 94 76 80 C76 68 84 58 98 58Z" stroke-width="2" style="fill: var(--color-surface-1)" />
            <path d="M98 52 C116 52 126 64 126 80 C126 98 114 108 98 108 C82 108 70 98 70 80 C70 64 80 52 98 52Z" stroke-width="1.3" stroke-dasharray="2 5" />
            <path d="M98 68 L108 80 L98 92 L88 80Z" stroke-width="1.6" />
          </g>
          <path d="M46 98 L58 110 L46 122 L34 110Z" style="fill: var(--color-surface-1)" />
          <path d="M46 92 L64 110 L46 128 L28 110Z" stroke-width="1.1" stroke-dasharray="2 5" />
        }
        @case ('cauris') {
          @for (c of cowries; track c.x; let i = $index) {
            <g [attr.transform]="'translate(' + c.x + ' ' + c.y + ') rotate(' + c.r + ')'" [attr.stroke]="i === 1 ? 'var(--color-primary-500)' : null">
              <ellipse cx="0" cy="0" rx="17" ry="26" />
              <path d="M0 -20 C-4 -8 -4 8 0 20 C4 8 4 -8 0 -20" stroke-width="1.4" />
              <path d="M-4 -10 h-3 M-4 -2 h-3 M-4 6 h-3 M4 -10 h3 M4 -2 h3 M4 6 h3" stroke-width="1.2" />
            </g>
          }
        }
      }
    </svg>
  `,
})
export class Illustration {
  readonly kind = input.required<IllustrationKind>();

  protected readonly rings = [14, 22, 30, 38, 46, 54, 62];
  /** La trame du raphia (kuba). */
  protected readonly weave = [32, 42, 52, 62, 72, 82, 92, 102, 112, 122, 132];
  protected readonly strings = [
    { x: 74, y: 16, bx: 74, by: 90 },
    { x: 74, y: 28, bx: 74, by: 100 },
    { x: 74, y: 40, bx: 74, by: 110 },
    { x: 74, y: 52, bx: 74, by: 118 },
    { x: 86, y: 22, bx: 86, by: 94 },
    { x: 86, y: 34, bx: 86, by: 104 },
    { x: 86, y: 46, bx: 86, by: 114 },
    { x: 86, y: 58, bx: 86, by: 120 },
  ];
  protected readonly stencilHoles = [
    { x: 42, y: 56 },
    { x: 63, y: 56 },
    { x: 84, y: 56 },
    { x: 42, y: 96 },
    { x: 63, y: 96 },
    { x: 84, y: 96 },
  ];
  protected readonly printed = [78, 98, 118, 138];
  protected readonly cowries = [
    { x: 46, y: 92, r: -24 },
    { x: 82, y: 70, r: 6 },
    { x: 116, y: 96, r: 28 },
  ];
}
