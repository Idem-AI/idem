import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { IdemServiceWorkerService } from './service-worker.service';

/**
 * « Une nouvelle version est disponible. »
 *
 * Le service worker sert la page depuis le cache pour qu'elle s'affiche tout
 * de suite, même à bas débit — ce qui veut dire qu'une version plus récente
 * peut arriver pendant que l'utilisateur lit. Cette barre le lui dit et lui
 * laisse le choix du moment : recharger pendant qu'il remplit un formulaire
 * lui ferait perdre ce qu'il écrit.
 *
 * Discrète, en bas, au-dessus du reste, et jamais bloquante.
 *
 * @example
 * ```html
 * <idem-update-banner />
 * ```
 */
@Component({
  selector: 'idem-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sw.updateAvailable()) {
      <div class="idem-ub" role="status">
        <p class="idem-ub__text">{{ label() }}</p>
        <button type="button" class="idem-ub__action" (click)="sw.applyUpdate()">
          {{ actionLabel() }}
        </button>
        <button
          type="button"
          class="idem-ub__dismiss"
          [attr.aria-label]="dismissLabel()"
          (click)="sw.dismissUpdate()"
        >
          ×
        </button>
      </div>
    }
  `,
  styles: `
    .idem-ub {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      /* Marge de sécurité pour les barres d'onglets en bas sur mobile. */
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
      background: var(--color-surface-2, #fff);
      border-top: 1px solid var(--glass-border, rgb(0 0 0 / 0.1));
      color: var(--color-text-primary, #111);
      font-size: 0.875rem;
    }

    .idem-ub__text {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
    }

    .idem-ub__action {
      flex: 0 0 auto;
      padding: 0.4rem 0.9rem;
      border-radius: 999px;
      border: 0;
      background: var(--color-primary, #0ea5e9);
      color: var(--color-on-primary, #fff);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .idem-ub__action:focus-visible,
    .idem-ub__dismiss:focus-visible {
      outline: 2px solid var(--color-primary, #0ea5e9);
      outline-offset: 2px;
    }

    .idem-ub__dismiss {
      flex: 0 0 auto;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--color-text-secondary, #555);
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
    }
  `,
})
export class IdemUpdateBannerComponent {
  protected readonly sw = inject(IdemServiceWorkerService);

  /**
   * Textes passés par l'application — chacune a son système de traduction,
   * le paquet n'en impose aucun.
   */
  readonly label = input('Une nouvelle version est disponible.');
  readonly actionLabel = input('Actualiser');
  readonly dismissLabel = input('Plus tard');
}
