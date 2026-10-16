import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { BillingService } from '../../../modules/billing/services/billing.service';
import { DeliverableKey, OwnershipStatus } from '../../../modules/billing/models/billing.model';

/**
 * « Créer, Garder » sur la page d'un livrable : où en est ce livrable, et le geste suivant.
 *
 *  - ESQUISSE : gratuite, consultable sans limite. Le bandeau dit ce que la version finale
 *    ajoute et son prix — plafonné par le Kit Entreprise du projet, rappelé à côté ;
 *  - VERSION FINALE débloquée mais pas encore produite : « Générer la version finale »
 *    (`generateFinal`, que la page branche sur sa propre génération) ;
 *  - VERSION FINALE produite : retouches gratuites jusqu'à telle date, et l'option Signature.
 *
 * Le paiement passe par le portefeuille ; un solde insuffisant ouvre le paywall (402), qui
 * propose la recharge exacte et refait l'achat.
 */
@Component({
  selector: 'app-ownership-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, IdemLoaderComponent],
  template: `
    @if (betaActive()) {
      <div class="glass-card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <span class="text-text-secondary">{{ 'billing.ownership.beta' | translate }}</span>
        @if (canRegenerate()) {
          <button type="button" class="outer-button button-sm" (click)="generateFinal.emit('final')">
            {{ 'billing.ownership.generateFinal' | translate }}
          </button>
        }
      </div>
    } @else if (item(); as d) {
      <div class="glass-card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        @if (!d.owned) {
          <div class="min-w-0">
            <p class="font-medium text-text-primary">{{ 'billing.ownership.draftTitle' | translate }}</p>
            <p class="text-xs text-text-secondary">{{ 'billing.ownership.draftBody' | translate }}</p>
            @if (status(); as s) {
              <p class="mt-1 text-xs text-text-tertiary">
                {{ 'billing.ownership.kit' | translate: { spent: (s.kit.spentXaf | number: '1.0-0'), cap: (s.kit.capXaf | number: '1.0-0'), sum: (s.kit.sumXaf | number: '1.0-0') } }}
              </p>
            }
          </div>
          <button type="button" class="inner-button button-sm" [disabled]="busy()" (click)="unlock('final')">
            @if (busy()) {
              <idem-loader size="xs" />
            }
            {{ 'billing.ownership.unlock' | translate: { price: (unlockPrice() | number: '1.0-0') } }}
          </button>
        } @else if (!d.finalGenerated && canRegenerate()) {
          <p class="font-medium text-text-primary">{{ 'billing.ownership.unlocked' | translate }}</p>
          <button type="button" class="inner-button button-sm" (click)="generateFinal.emit(d.tier ?? 'final')">
            {{ 'billing.ownership.generateFinal' | translate }}
          </button>
        } @else {
          <div class="min-w-0">
            <p class="font-medium text-text-primary">
              {{ (d.tier === 'signature' ? 'billing.ownership.signatureTitle' : 'billing.ownership.finalTitle') | translate }}
            </p>
            @if (d.editableUntil) {
              <p class="text-xs text-text-secondary">{{ 'billing.ownership.editableUntil' | translate: { date: (d.editableUntil | date: 'd MMMM y') } }}</p>
            }
          </div>
          @if (d.tier !== 'signature' && canRegenerate()) {
            <button type="button" class="outer-button button-sm" [disabled]="busy()" (click)="unlock('signature')">
              @if (busy()) {
                <idem-loader size="xs" />
              }
              {{ 'billing.ownership.signature' | translate: { price: ((status()?.signaturePriceXaf ?? 1000) | number: '1.0-0') } }}
            </button>
          }
        }
        @if (error(); as message) {
          <p class="w-full text-xs text-danger" role="alert">{{ message }}</p>
        }
      </div>
    }
  `,
})
export class OwnershipBarComponent {
  private readonly billing = inject(BillingService);

  readonly projectId = input<string | null | undefined>(null);
  readonly deliverable = input.required<DeliverableKey>();
  /** La page sait-elle produire une version finale (régénération) ? Sinon : fichiers seulement. */
  readonly canRegenerate = input(false);

  /** Lancer la version finale (ou Signature) : la page appelle sa propre génération. */
  readonly generateFinal = output<'final' | 'signature'>();

  protected readonly status = signal<OwnershipStatus | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly betaActive = computed(() => this.billing.betaActive());
  protected readonly item = computed(() => this.status()?.deliverables.find((d) => d.key === this.deliverable()) ?? null);

  /** Le prix réellement dû : jamais plus que ce qui reste avant le plafond du Kit. */
  protected readonly unlockPrice = computed(() => {
    const status = this.status();
    const item = this.item();
    if (!status || !item) return 0;
    return Math.min(item.priceXaf, status.kit.remainingXaf || item.priceXaf);
  });

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (projectId) this.refresh(projectId);
    });
  }

  private refresh(projectId: string): void {
    this.billing.getOwnership(projectId).subscribe({
      next: (status) => this.status.set(status),
      // Sans réponse de la facturation, la page reste utilisable : pas de bandeau.
      error: () => this.status.set(null),
    });
  }

  protected unlock(tier: 'final' | 'signature'): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.busy.set(true);
    this.error.set(null);
    this.billing.buyOffer({ kind: 'unlock', projectId, deliverable: this.deliverable(), tier }).subscribe({
      next: () => {
        this.busy.set(false);
        this.refresh(projectId);
        if (this.canRegenerate()) this.generateFinal.emit(tier);
      },
      error: (error) => {
        this.busy.set(false);
        // 402 : le paywall propose la recharge ; le reste s'affiche ici.
        if (error?.status !== 402) this.error.set(error?.error?.message ?? null);
      },
    });
  }
}
