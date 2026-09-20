import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CheckoutComponent } from '../../components/checkout/checkout';
import { PaymentView } from '../../models/billing.model';

/**
 * Page de paiement partagée par toutes les applications IDEM.
 *
 * AppGen (React), Simulation et iDeploy (Laravel) n'ont pas à réimplémenter un
 * parcours Mobile Money : elles renvoient ici avec un code produit et une
 * adresse de retour, et récupèrent l'utilisateur une fois le paiement réglé.
 * Une seule interface de paiement à maintenir, une seule à auditer.
 *
 * **L'adresse de retour est filtrée.** Sans liste blanche, un lien
 * `/billing/checkout?returnUrl=https://site-pirate/` transformerait une page
 * authentifiée d'IDEM en tremplin de redirection — la faille la plus banale de
 * ce type d'écran.
 */
@Component({
  selector: 'app-billing-checkout-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, CheckoutComponent],
  template: `
    <!-- Pas de carte autour du paiement : l'écran EST le paiement. Un cadre de
         plus n'ajouterait qu'une bordure à regarder. -->
    <div class="min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <div class="mx-auto w-full max-w-3xl">
        <header class="mb-10 flex items-center gap-3">
          <!-- Retour discret : la seule sortie de l'écran, à côté de son titre,
               plutôt qu'une barre de navigation qui invite à partir. -->
          <button
            type="button"
            class="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-[var(--glass-bg-subtle)] hover:text-text-primary"
            [attr.aria-label]="'common.back' | translate"
            (click)="goBack()"
          >
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
          </button>

          <!-- Deux fichiers plutôt qu'un filtre CSS : le logo sombre existe. -->
          <img src="assets/icons/logo_white.png" alt="IDEM" class="h-7 w-auto dark:hidden" />
          <img src="assets/icons/logo_dark.png" alt="IDEM" class="hidden h-7 w-auto dark:block" />

          <h1 class="text-base font-medium text-text-secondary">
            {{ 'billing.checkout.title' | translate }}
          </h1>
        </header>

        @if (productCode()) {
          <app-checkout
            [productCode]="productCode()!"
            [engine]="engine()"
            [projectId]="projectId()"
            [interval]="interval()"
            [simulationTier]="simulationTier()"
            [app]="app()"
            (completed)="onCompleted($event)"
            (dismissed)="onDismissed()"
          ></app-checkout>
        } @else {
          <p class="text-sm text-text-secondary">
            {{ 'billing.checkout.noProduct' | translate }}
          </p>
        }

        @if (returnLabel(); as label) {
          <p class="mt-10 border-t border-[var(--glass-border)] pt-4 text-xs text-text-tertiary">
            {{ 'billing.checkout.returnNote' | translate: { app: label } }}
          </p>
        }
      </div>
    </div>
  `,
})
export class BillingCheckoutPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly productCode = signal<string | null>(null);
  readonly engine = signal<string | undefined>(undefined);
  readonly projectId = signal<string | undefined>(undefined);
  readonly interval = signal<'month' | 'year' | undefined>(undefined);
  readonly simulationTier = signal<string | undefined>(undefined);
  readonly app = signal<'dashboard' | 'appgen' | 'simulation' | 'ideploy'>('dashboard');
  readonly returnLabel = signal<string | null>(null);

  private returnUrl: string | null = null;

  /** Transaction aboutie, retenue jusqu'à ce que l'utilisateur ferme l'écran. */
  private settled: PaymentView | null = null;

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    this.productCode.set(params.get('product'));
    this.engine.set(params.get('engine') ?? undefined);
    this.projectId.set(params.get('projectId') ?? undefined);
    this.simulationTier.set(params.get('tier') ?? undefined);

    const interval = params.get('interval');
    if (interval === 'month' || interval === 'year') this.interval.set(interval);

    const app = params.get('app');
    if (app === 'appgen' || app === 'simulation' || app === 'ideploy' || app === 'dashboard') {
      this.app.set(app);
    }

    this.returnUrl = this.sanitizeReturnUrl(params.get('returnUrl'));
    if (this.returnUrl) {
      this.returnLabel.set(new URL(this.returnUrl).host);
    }
  }

  /**
   * N'accepte qu'un retour vers une application IDEM.
   *
   * Domaines autorisés : `idem.africa` et ses sous-domaines, plus `localhost`
   * en développement. Toute autre adresse est ignorée — l'utilisateur revient
   * alors simplement sur son tableau de bord.
   */
  private sanitizeReturnUrl(raw: string | null): string | null {
    if (!raw) return null;

    try {
      const url = new URL(raw);

      if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;

      const allowed =
        url.hostname === 'idem.africa' ||
        url.hostname.endsWith('.idem.africa') ||
        url.hostname === 'localhost';

      return allowed ? url.toString() : null;
    } catch {
      return null;
    }
  }

  /**
   * Sortie de l'écran de paiement.
   *
   * Un arrivant direct — lien collé, retour depuis un autre domaine — n'a pas
   * d'historique à remonter. Le renvoyer aux offres vaut mieux qu'un bouton
   * sans effet, ou qu'une sortie du site.
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigate(['/account/plans']);
  }

  /**
   * Paiement abouti.
   *
   * Rien ne bouge tant que l'utilisateur n'a pas fermé : le composant de
   * paiement affiche sa confirmation, et c'est « Continuer » qui déclenche la
   * sortie. Partir ici escamoterait l'écran qui dit que le paiement est passé.
   */
  onCompleted(payment: PaymentView): void {
    this.settled = payment;
  }

  /**
   * Sortie de l'écran.
   *
   * Vers l'application d'origine quand il y en a une, sinon vers le
   * récapitulatif du paiement — jamais vers une liste de factures muette, qui
   * était le point exact où l'utilisateur perdait le fil : il venait de payer,
   * et rien à l'écran ne lui disait ce qu'il avait obtenu.
   */
  onDismissed(): void {
    const payment = this.settled;

    if (!payment) {
      this.leave({});
      return;
    }

    this.leave({ payment: payment.reference, status: 'completed' });
  }

  /**
   * Renvoie l'utilisateur d'où il vient, avec la référence du paiement.
   *
   * L'application d'origine peut ainsi confirmer elle-même l'encaissement
   * plutôt que de faire confiance à un simple retour de navigation.
   */
  private leave(params: Record<string, string>): void {
    if (!this.returnUrl) {
      // Un paiement réglé a son récapitulatif ; un écran quitté sans payer
      // ramène simplement au compte.
      void (params['payment']
        ? this.router.navigate(['/billing/success'], {
            queryParams: { payment: params['payment'] },
          })
        : this.router.navigate(['/account']));
      return;
    }

    const target = new URL(this.returnUrl);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }

    window.location.href = target.toString();
  }
}
