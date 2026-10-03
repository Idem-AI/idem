import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '@env';

import { Illustration } from '../../../../shared/components/illustration/illustration';
import { SimulationConsent } from '../../models';

/** Les documents à accepter, dans l'ordre où ils se lisent. */
const DOCUMENTS = [
  { key: 'privacy', path: '/privacy-policy' },
  { key: 'simulationTerms', path: '/simulation-terms' },
  { key: 'beta', path: '/beta-policy' },
] as const;

type DocumentKey = (typeof DOCUMENTS)[number]['key'];

/**
 * Recueille l'accord juste avant qu'une exécution ne démarre.
 *
 * Toute relance part d'ici comme un premier lancement : une simulation lit le
 * projet et en confie un extrait à des moteurs d'IA, ce qui n'est pas couvert
 * par l'acceptation faite une fois à la création du compte. Les cases repartent
 * donc vides à chaque ouverture, et l'API refuse le lancement sans elles.
 *
 * L'écran de nouvelle simulation pose les mêmes cases dans son étape « niveau »,
 * où elles tiennent dans le fil de la page ; ce dialogue sert partout ailleurs.
 */
@Component({
  selector: 'sim-consent-dialog',
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
        aria-labelledby="sim-consent-heading"
        class="modal-panel rise relative max-h-[92dvh] w-full max-w-md overflow-y-auto p-6 sm:p-7"
      >
        <!-- Donner son accord, c'est peser avant de s'engager : la balance akan. -->
        <sim-illustration name="balance" class="mx-auto w-28" />
        <h2 id="sim-consent-heading" class="mt-4 text-center text-xl font-bold">
          {{ 'consent.heading' | translate }}
        </h2>

        <p class="mt-2 text-sm leading-relaxed text-text-secondary">{{ 'consent.body' | translate }}</p>

        <div class="mt-5 flex flex-col gap-2">
          @for (document of documents; track document.key) {
            @if (document.key !== 'beta' || isBeta) {
              <label
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--glass-border)] p-3 text-sm transition-colors hover:border-[var(--glass-border-strong)]"
              >
                <input
                  type="checkbox"
                  class="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                  [checked]="isAccepted(document.key)"
                  (change)="toggle(document.key)"
                />
                <span class="leading-snug text-text-secondary">
                  {{ 'consent.iAccept' | translate }}
                  <a
                    [href]="legalUrl(document.path)"
                    target="_blank"
                    rel="noopener"
                    class="sim-link !inline"
                  >
                    {{ 'consent.document.' + document.key | translate }}
                  </a>
                </span>
              </label>
            }
          }
        </div>

        <div class="mt-6 flex flex-col gap-2">
          <button
            type="button"
            class="inner-button w-full"
            [disabled]="!complete()"
            (click)="accepted.emit(consent())"
          >
            {{ 'consent.confirm' | translate }}
          </button>
          <button type="button" class="button-ghost w-full" (click)="dismissed.emit()">
            {{ 'action.cancel' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConsentDialog {
  protected readonly documents = DOCUMENTS;
  protected readonly isBeta = environment.isBeta;

  private readonly privacy = signal(false);
  private readonly simulationTerms = signal(false);
  private readonly beta = signal(false);

  protected readonly complete = computed(
    () => this.privacy() && this.simulationTerms() && (!this.isBeta || this.beta()),
  );

  readonly dismissed = output<void>();
  readonly accepted = output<SimulationConsent>();

  protected isAccepted(key: DocumentKey): boolean {
    return this.signalFor(key)();
  }

  protected toggle(key: DocumentKey): void {
    this.signalFor(key).update((accepted) => !accepted);
  }

  protected legalUrl(path: string): string {
    return `${environment.services.landing.url}${path}`;
  }

  protected consent(): SimulationConsent {
    return {
      privacyPolicyAccepted: this.privacy(),
      simulationTermsAccepted: this.simulationTerms(),
      betaPolicyAccepted: this.beta(),
    };
  }

  private signalFor(key: DocumentKey) {
    return key === 'privacy' ? this.privacy : key === 'simulationTerms' ? this.simulationTerms : this.beta;
  }
}
