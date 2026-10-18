import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../../environments/environment';
import { ProjectService } from '../../../modules/dashboard/services/project.service';
import { PolicyConsentService } from '../../services/policy-consent.service';

/**
 * LA FENÊTRE D'ACCORD DES POLITIQUES, montée une fois à la racine. Un projet sans accord (créé depuis iVision
 * avant que l'accord y soit demandé) ne peut rien générer : l'utilisateur accepte ici la politique de
 * confidentialité, les conditions d'utilisation et les conditions du programme bêta — les trois cases,
 * jamais cochées d'avance — puis relance son action.
 */
@Component({
  selector: 'app-policy-consent-host',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (consent.pending(); as projectId) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg-darker)_70%,transparent)] p-4" (click)="close()">
        <div class="modal-panel w-full max-w-md p-5" role="dialog" aria-modal="true" aria-labelledby="policy-consent-title" (click)="$event.stopPropagation()">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="policy-consent-title" class="text-base font-semibold text-text-primary">{{ 'policyConsent.title' | translate }}</h2>
              <p class="mt-1 text-sm text-text-secondary">{{ 'policyConsent.body' | translate }}</p>
            </div>
            <button type="button" class="button-icon !p-2" (click)="close()" [attr.aria-label]="'common.close' | translate">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>

          @if (done()) {
            <p class="text-sm text-text-primary" role="status"><i class="pi pi-check text-success mr-1" aria-hidden="true"></i>{{ 'policyConsent.done' | translate }}</p>
            <button type="button" class="inner-button mt-4 w-full" (click)="close()">{{ 'common.close' | translate }}</button>
          } @else {
            <div class="flex flex-col gap-3 text-sm">
              <label class="!flex items-start gap-2 !mb-0 !font-normal">
                <input type="checkbox" class="mt-0.5" [checked]="privacy()" (change)="privacy.set($any($event.target).checked)" />
                <span>{{ 'dashboard.projectSummary.agreements.iAgreeTo' | translate }} <a class="underline" [href]="landing + '/privacy-policy'" target="_blank" rel="noopener">{{ 'dashboard.projectSummary.agreements.privacyPolicy' | translate }}</a></span>
              </label>
              <label class="!flex items-start gap-2 !mb-0 !font-normal">
                <input type="checkbox" class="mt-0.5" [checked]="terms()" (change)="terms.set($any($event.target).checked)" />
                <span>{{ 'dashboard.projectSummary.agreements.iAgreeTo' | translate }} <a class="underline" [href]="landing + '/terms-of-service'" target="_blank" rel="noopener">{{ 'dashboard.projectSummary.agreements.termsOfService' | translate }}</a></span>
              </label>
              <label class="!flex items-start gap-2 !mb-0 !font-normal">
                <input type="checkbox" class="mt-0.5" [checked]="beta()" (change)="beta.set($any($event.target).checked)" />
                <span>{{ 'dashboard.projectSummary.agreements.iAgreeTo' | translate }} <a class="underline" [href]="landing + '/beta-policy'" target="_blank" rel="noopener">{{ 'dashboard.projectSummary.agreements.betaTerms' | translate }}</a></span>
              </label>
            </div>
            @if (failed()) {
              <p class="mt-3 text-sm text-danger" role="alert">{{ 'policyConsent.failed' | translate }}</p>
            }
            <button type="button" class="inner-button mt-5 w-full" [disabled]="!privacy() || !terms() || !beta() || saving()" (click)="accept(projectId)">
              @if (saving()) { <idem-loader size="xs" /> }
              {{ 'policyConsent.accept' | translate }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class PolicyConsentHostComponent {
  protected readonly consent = inject(PolicyConsentService);
  private readonly projects = inject(ProjectService);
  protected readonly landing = String(environment.services.domain || '').replace(/\/+$/, '');

  protected readonly privacy = signal(false);
  protected readonly terms = signal(false);
  protected readonly beta = signal(false);
  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly failed = signal(false);

  protected accept(projectId: string): void {
    this.saving.set(true);
    this.failed.set(false);
    this.projects.finalizeProjectCreation(projectId, { privacyPolicyAccepted: true, termsOfServiceAccepted: true, betaPolicyAccepted: true, marketingAccepted: false }).subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(true);
      },
      error: (e: { status?: number }) => {
        this.saving.set(false);
        // Déjà finalisé entre-temps (autre onglet) : c'est réglé.
        if (e?.status === 409) this.done.set(true);
        else this.failed.set(true);
      },
    });
  }

  protected close(): void {
    this.consent.close();
    this.privacy.set(false);
    this.terms.set(false);
    this.beta.set(false);
    this.done.set(false);
    this.failed.set(false);
  }
}
