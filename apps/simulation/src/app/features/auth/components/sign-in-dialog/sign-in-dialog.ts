import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Illustration } from '../../../../shared/components/illustration/illustration';

/**
 * Demande la connexion au moment où elle devient nécessaire, sans quitter la
 * page.
 *
 * Le produit se visite sans compte : on ne réclame l'identité qu'à l'action qui
 * en a besoin, et ce dialogue dit laquelle. Le bouton emmène au login du
 * dashboard IDEM — il n'y a pas d'écran de connexion ici.
 */
@Component({
  selector: 'sim-sign-in-dialog',
  imports: [TranslatePipe, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissed.emit()' },
  template: `
    <div class="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        class="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
        [attr.aria-label]="'action.dismiss' | translate"
        (click)="dismissed.emit()"
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-sign-in-heading"
        class="modal-panel rise relative w-full max-w-md p-6 text-center sm:p-7"
      >
        <!-- Se connecter, c'est entrer chez soi : le bouclier de la connexion IDEM. -->
        <sim-illustration name="shield" class="mx-auto w-28" />
        <h2 id="sim-sign-in-heading" class="mt-4 text-xl font-bold">
          {{ 'signIn.heading' | translate }}
        </h2>

        <p class="mt-2 text-sm leading-relaxed text-text-secondary md:text-base">{{ reason() | translate }}</p>

        <p class="mt-3 text-xs leading-relaxed text-text-tertiary">
          {{ 'signIn.sharedAccount' | translate }}
        </p>

        @if (warnDraftLoss()) {
          <p class="mt-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] px-3 py-2 text-left text-xs leading-relaxed text-text-secondary">
            {{ 'signIn.documentTooLarge' | translate }}
          </p>
        }

        <div class="mt-6 flex flex-col gap-2">
          <button type="button" class="inner-button w-full" (click)="confirmed.emit()">
            {{ 'auth.signIn' | translate }}
          </button>
          <button type="button" class="button-ghost w-full" (click)="dismissed.emit()">
            {{ 'signIn.later' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SignInDialog {
  /** Clé de traduction expliquant pourquoi la connexion est demandée ici. */
  readonly reason = input.required<string>();

  /** Prévient que le travail en cours ne survivra pas à l'aller-retour. */
  readonly warnDraftLoss = input(false);

  readonly dismissed = output<void>();

  /**
   * Le départ vers le login appartient à la page : elle a du travail en cours
   * à mettre de côté avant que le navigateur ne quitte l'écran.
   */
  readonly confirmed = output<void>();
}
