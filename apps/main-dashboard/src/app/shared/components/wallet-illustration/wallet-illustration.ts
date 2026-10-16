import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Le portefeuille : une calebasse coupée qui contient des cauris (AGENTS.md § 4, « Argent,
 * paiement, crédits, prix »). La calebasse dit « ce que j'ai mis de côté » ; le cauris au
 * premier plan, à l'encre primaire, est l'argent prêt à servir.
 *
 * Deux encres, au trait. Décoratif : le solde affiché à côté porte le sens.
 */
@Component({
  selector: 'app-wallet-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
      aspect-ratio: 120 / 80;
      color: var(--color-text-tertiary);
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <!-- Les cauris qui dépassent du bord -->
      <g stroke-width="1.6">
        <g transform="translate(44 30) rotate(-24) scale(0.62)">
          <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6" />
          <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2" />
        </g>
        <g transform="translate(76 29) rotate(20) scale(0.62)">
          <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6" />
          <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2" />
        </g>
      </g>

      <!-- La calebasse coupée, et le bord épais de la coupe -->
      <path d="M16 36 C16 60 36 74 60 74 C84 74 104 60 104 36" stroke-width="1.8" fill="var(--color-surface-1, transparent)" />
      <path d="M14 36 H106" stroke-width="2" />
      <!-- Le décor gravé au feu, à l'intérieur de l'objet : une frise de chevrons -->
      <path d="M28 52 L34 47 L40 52 L46 47 L52 52 L58 47 L64 52 L70 47 L76 52 L82 47 L88 52 L92 49" stroke-width="1.3" opacity=".7" />
      <path d="M34 62 H86" stroke-width="1.2" opacity=".5" />

      <!-- Le cauris prêt à servir -->
      <g style="color: var(--color-primary-500)" transform="translate(60 25) scale(0.78)">
        <path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.4" />
        <path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2" />
        <path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.6" />
      </g>
    </svg>
  `,
})
export class WalletIllustrationComponent {}
