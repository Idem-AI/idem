import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

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
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissed.emit()' },
  template: `
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
        class="glass-card rise relative w-full max-w-md p-6 shadow-raised"
      >
        <h2 id="sim-sign-in-heading" class="text-h3 font-semibold text-ink">
          {{ 'signIn.heading' | translate }}
        </h2>

        <p class="mt-2 text-sm leading-relaxed text-ink-muted">{{ reason() | translate }}</p>

        <p class="mt-3 text-meta leading-relaxed text-ink-subtle">
          {{ 'signIn.sharedAccount' | translate }}
        </p>

        @if (warnDraftLoss()) {
          <p class="mt-3 rounded-lg border border-line bg-panel-sunken px-3 py-2 text-meta leading-relaxed text-ink-muted">
            {{ 'signIn.documentTooLarge' | translate }}
          </p>
        }

        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" class="button-ghost" (click)="dismissed.emit()">
            {{ 'signIn.later' | translate }}
          </button>
          <button type="button" class="inner-button" (click)="confirmed.emit()">
            {{ 'auth.signIn' | translate }}
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
