import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * La KORA — harpe-luth des griots mandingues.
 *
 * Le griot (jeli) raconte en musique l'histoire d'une famille, d'un roi, d'une
 * lignée : c'est exactement ce que fait une vidéo de promotion, l'histoire de la
 * marque portée par une musique. Le tambour parleur dit déjà « communiquer »
 * ailleurs dans le module ; la kora dit « raconter en musique ».
 *
 * Source : « Kora (instrument) », Wikipédia —
 * https://fr.wikipedia.org/wiki/Kora_(instrument)
 *
 * Deux encres (AGENTS.md § 4) : le trait en `currentColor`, le CHEVALET en
 * couleur primaire — c'est lui qui fait chanter les cordes.
 */
@Component({
  selector: 'app-video-kora',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'inline-block' },
  template: `
    <svg viewBox="0 0 160 170" width="100%" height="100%" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <!-- Manche et anneaux d'accord en cuir -->
      <path d="M80 8 V78" />
      @for (y of rings; track y; let i = $index) {
        <path [attr.d]="i % 2 ? 'M80 ' + y + ' h6' : 'M80 ' + y + ' h-6'" />
      }
      <!-- Poignées de part et d'autre du manche -->
      <path d="M64 58 V90 M96 58 V90" />
      <!-- Calebasse tendue de peau, motif bogolan à l'intérieur -->
      <circle cx="80" cy="118" r="40" style="fill: var(--kora-surface, transparent)" />
      <path d="M48 96 Q80 84 112 96" />
      <path d="M50 140 Q80 154 110 140" stroke-dasharray="0 7" stroke-width="3" />
      <path d="M58 150 Q80 160 102 150" stroke-dasharray="0 9" stroke-width="2.4" />
      <!-- Cordes : du manche au chevalet, puis à l'anneau de base -->
      @for (s of strings; track s.y) {
        <path [attr.d]="'M' + s.x + ' ' + s.y + ' L' + s.bx + ' ' + s.by + ' L80 164'" stroke-width="0.9" />
      }
      <!-- Le chevalet (encre primaire) -->
      <rect x="74" y="92" width="12" height="38" rx="2" stroke="var(--color-primary-500)" stroke-width="2"
        style="fill: var(--kora-surface, transparent)" />
      <path d="M74 100 h12 M74 108 h12 M74 116 h12 M74 124 h12" stroke="var(--color-primary-500)" stroke-width="1.4" />
      <!-- La musique qui part -->
      <path d="M124 54 q8 8 0 16 M132 48 q13 14 0 28" stroke-width="1.5" opacity="0.55" />
    </svg>
  `,
})
export class VideoKora {
  protected readonly rings = [16, 24, 32, 40, 48, 56, 64];
  protected readonly strings = [
    { x: 74, y: 18, bx: 74, by: 96 },
    { x: 74, y: 30, bx: 74, by: 106 },
    { x: 74, y: 42, bx: 74, by: 116 },
    { x: 74, y: 54, bx: 74, by: 126 },
    { x: 86, y: 24, bx: 86, by: 100 },
    { x: 86, y: 36, bx: 86, by: 110 },
    { x: 86, y: 48, bx: 86, by: 120 },
    { x: 86, y: 60, bx: 86, by: 128 },
  ];
}
