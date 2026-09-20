import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '@env';

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
        aria-labelledby="sim-consent-heading"
        class="glass-card rise relative w-full max-w-md p-6 shadow-raised"
      >
        <h2 id="sim-consent-heading" class="text-h3 font-semibold text-ink">
          {{ 'consent.heading' | translate }}
        </h2>

        <p class="mt-2 text-sm leading-relaxed text-ink-muted">{{ 'consent.body' | translate }}</p>

        <div class="mt-4 flex flex-col gap-2.5">
          @for (document of documents; track document.key) {
            @if (document.key !== 'beta' || isBeta) {
              <label class="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand"
                  [checked]="isAccepted(document.key)"
                  (change)="toggle(document.key)"
                />
                <span class="leading-snug text-ink-muted">
                  {{ 'consent.iAccept' | translate }}
                  <a
                    [href]="legalUrl(document.path)"
                    target="_blank"
                    rel="noopener"
                    class="font-medium text-brand underline underline-offset-2"
                  >
                    {{ 'consent.document.' + document.key | translate }}
                  </a>
                </span>
              </label>
            }
          }
        </div>

        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" class="button-ghost" (click)="dismissed.emit()">
            {{ 'action.cancel' | translate }}
          </button>
          <button
            type="button"
            class="inner-button"
            [disabled]="!complete()"
            (click)="accepted.emit(consent())"
          >
            {{ 'consent.confirm' | translate }}
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
