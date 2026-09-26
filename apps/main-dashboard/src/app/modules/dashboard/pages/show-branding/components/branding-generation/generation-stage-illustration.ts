import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GenerationPhase } from './generation-chapters';

/**
 * L'illustration animée de la génération : ce que l'atelier est en train de
 * faire, phase par phase — on trace le logo, on pose les couleurs, on règle
 * la typographie, on compose, on photographie, on publie, on fixe les règles,
 * on relie la charte.
 *
 * Règles des illustrations (AGENTS.md § 4) : SVG dans le code, au trait,
 * `currentColor` pour le trait et `--color-primary-500` pour le seul détail
 * qui compte. Les tracés utilisent `pathLength="100"` : une seule animation
 * de dessin sert toutes les formes. Mouvement réduit → l'état final, immobile.
 */
@Component({
  selector: 'app-generation-stage-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      class="stage"
      viewBox="0 0 240 180"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (phase()) {
        @case ('logo') {
          <!-- Tracé de construction, puis le signe -->
          <g class="guide">
            <circle cx="120" cy="90" r="52" />
            <path d="M52 90 H188 M120 22 V158" />
            <rect x="68" y="38" width="104" height="104" />
          </g>
          <g class="accent">
            <circle class="draw" pathLength="100" cx="120" cy="90" r="32" stroke-width="2.5" />
            <path class="draw d2" pathLength="100" d="M106 91 L116 101 L135 80" stroke-width="3" />
          </g>
          <path class="nib" d="M168 130 l14 -14 l8 8 l-14 14 z M168 130 l-4 12 l12 -4" />
        }
        @case ('colors') {
          <path class="dropper" d="M56 40 l10 -10 l8 8 l-10 10 z M60 44 l-12 12 l-2 6 l6 -2 l12 -12" />
          @for (swatch of swatches; track swatch.x) {
            <circle [attr.cx]="swatch.x" cy="92" r="17" />
            <circle
              class="pop accent"
              [style.animation-delay]="swatch.delay"
              [attr.cx]="swatch.x"
              cy="92"
              r="10"
              stroke-width="2.5"
            />
          }
          <path d="M44 132 H196" />
          <path class="draw accent" pathLength="100" d="M44 132 H150" stroke-width="3" />
        }
        @case ('type') {
          <path class="guide" d="M40 124 H200 M40 80 H200 M40 58 H200" />
          <text
            x="66"
            y="124"
            font-size="86"
            font-family="Georgia, 'Times New Roman', serif"
            stroke-width="1.5"
          >Aa</text>
          <path class="caret accent" d="M178 60 V128" stroke-width="3" />
        }
        @case ('direction') {
          <rect x="34" y="30" width="172" height="120" rx="3" />
          <path class="guide" d="M77 30 V150 M120 30 V150 M163 30 V150" />
          <path class="slide s1" d="M48 50 H112" stroke-width="3" />
          <path class="slide s2" d="M48 62 H96" />
          <rect class="slide s3 accent" x="128" y="46" width="64" height="58" rx="2" stroke-width="2" />
          <path class="slide s4" d="M48 82 H108 M48 90 H108 M48 98 H96 M48 126 H192 M48 134 H170" />
        }
        @case ('mockups') {
          <path d="M84 56 C84 30 156 30 156 56" />
          <path d="M70 56 H170 L180 150 H60 Z" />
          <g class="accent">
            <circle class="draw" pathLength="100" cx="120" cy="104" r="20" stroke-width="2.5" />
            <path class="draw d2" pathLength="100" d="M111 105 L117 111 L130 97" stroke-width="3" />
          </g>
          <path class="flash" d="M196 42 v12 M190 48 h12 M44 70 v10 M39 75 h10" />
        }
        @case ('social') {
          <rect x="82" y="16" width="76" height="150" rx="12" />
          <path d="M110 26 H130" />
          <g class="rise">
            <rect x="92" y="54" width="56" height="56" rx="3" />
            <path d="M92 124 H140 M92 132 H128" />
          </g>
          <path
            class="pop accent"
            d="M188 70 c-6 -8 -18 -4 -16 6 c1 6 16 16 16 16 s15 -10 16 -16 c2 -10 -10 -14 -16 -6 z"
            stroke-width="2"
          />
        }
        @case ('usage') {
          <rect x="30" y="34" width="84" height="112" rx="3" />
          <rect x="126" y="34" width="84" height="112" rx="3" />
          <path d="M44 56 H100 M44 64 H88 M140 56 H196 M140 64 H184" />
          <g class="accent">
            <circle class="draw" pathLength="100" cx="72" cy="108" r="18" stroke-width="2.5" />
            <path class="draw d2" pathLength="100" d="M64 108 L70 114 L81 102" stroke-width="3" />
          </g>
          <circle cx="168" cy="108" r="18" />
          <path d="M161 101 L175 115 M175 101 L161 115" />
        }
        @default {
          <!-- Finalisation : les pages se rassemblent en une charte -->
          <rect class="gather g1" x="58" y="40" width="96" height="120" rx="3" />
          <rect class="gather g2" x="72" y="30" width="96" height="120" rx="3" />
          <rect x="86" y="20" width="96" height="120" rx="3" />
          <path d="M100 42 H160 M100 50 H146" />
          <g class="accent">
            <circle class="draw" pathLength="100" cx="134" cy="96" r="22" stroke-width="2.5" />
            <path class="draw d2" pathLength="100" d="M124 97 L131 104 L146 88" stroke-width="3" />
          </g>
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--color-text-tertiary);
      }

      .stage {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .accent {
        stroke: var(--color-primary-500);
      }

      .guide {
        stroke-dasharray: 3 5;
        opacity: 0.55;
      }

      text {
        fill: none;
        stroke: currentColor;
      }

      /* Dessin d'un tracé, en boucle, avec un temps de pose. */
      .draw {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: draw 3.2s ease-in-out infinite;
      }
      .d2 {
        animation-delay: 0.45s;
      }
      @keyframes draw {
        0% { stroke-dashoffset: 100; opacity: 1; }
        45%, 85% { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }

      .pop {
        transform-box: fill-box;
        transform-origin: center;
        animation: pop 2.8s ease-in-out infinite both;
      }
      @keyframes pop {
        0%, 15% { transform: scale(0); opacity: 0; }
        35%, 80% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1); opacity: 0; }
      }

      .nib {
        animation: nib 3.2s ease-in-out infinite;
      }
      @keyframes nib {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-10px, -8px); }
      }

      .dropper {
        animation: dropper 4s ease-in-out infinite;
      }
      @keyframes dropper {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(118px); }
      }

      .caret {
        animation: blink 1.1s steps(1) infinite;
      }
      @keyframes blink {
        50% { opacity: 0; }
      }

      .slide {
        animation: slide 3.6s ease-out infinite both;
      }
      .s2 { animation-delay: 0.25s; }
      .s3 { animation-delay: 0.5s; }
      .s4 { animation-delay: 0.75s; }
      @keyframes slide {
        0% { transform: translateY(8px); opacity: 0; }
        25%, 85% { transform: translateY(0); opacity: 1; }
        100% { opacity: 0; }
      }

      .flash {
        animation: blink 1.6s steps(1) infinite;
      }

      .rise {
        animation: rise 3.4s ease-out infinite both;
      }
      @keyframes rise {
        0% { transform: translateY(26px); opacity: 0; }
        30%, 85% { transform: translateY(0); opacity: 1; }
        100% { opacity: 0; }
      }

      .gather {
        animation: gather 3s ease-in-out infinite both;
      }
      .g1 { animation-delay: 0.15s; }
      @keyframes gather {
        0% { transform: translate(-18px, 14px) rotate(-6deg); opacity: 0.2; }
        45%, 100% { transform: none; opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
        }
        .draw {
          stroke-dashoffset: 0;
        }
        .pop,
        .rise,
        .slide,
        .gather {
          opacity: 1;
          transform: none;
        }
      }
    `,
  ],
})
export class GenerationStageIllustrationComponent {
  readonly phase = input<GenerationPhase>('logo');

  protected readonly swatches = [
    { x: 66, delay: '0s' },
    { x: 102, delay: '0.35s' },
    { x: 138, delay: '0.7s' },
    { x: 174, delay: '1.05s' },
  ];
}
