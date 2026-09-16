import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../services/billing.service';

/**
 * Compteur de crédits, dans la barre du haut.
 *
 * Une génération consomme des crédits ; savoir ce qu'il en reste ne devrait pas
 * demander d'ouvrir une page de facturation. Deux compteurs seulement —
 * iBusiness et iCode — parce que ce sont les seuls que l'utilisateur dépense en
 * travaillant : iDeploy se facture à l'abonnement et aux ressources.
 *
 * Le badge se tait tant que les droits n'ont pas été chargés : un « 0 »
 * affiché par défaut ferait croire à un compte vide.
 */
@Component({
  selector: 'app-credits-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    @if (credits(); as balance) {
      <a
        routerLink="/billing"
        class="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs transition-colors hover:border-[var(--color-primary)]"
        [title]="tooltip()"
      >
        <i class="pi pi-bolt text-[11px]" [class.text-warning]="isLow()" [class.text-text-tertiary]="!isLow()"></i>

        <span class="tabular-nums" [class.text-warning]="isLow()" [class.text-text-secondary]="!isLow()">
          {{ balance.business }}
        </span>
        <span class="text-text-disabled">·</span>
        <span class="tabular-nums" [class.text-warning]="isLow()" [class.text-text-secondary]="!isLow()">
          {{ balance.appgen }}
        </span>

        @if (isComplimentary()) {
          <span class="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">bêta</span>
        }
      </a>
    }
  `,
})
export class CreditsBadgeComponent {
  private readonly billing = inject(BillingService);

  readonly credits = this.billing.credits;
  readonly isComplimentary = this.billing.betaActive;

  /**
   * Seuil d'alerte : moins de vingt crédits, soit moins d'un livrable
   * structurant. Alerter plus tôt banaliserait l'avertissement.
   */
  readonly isLow = computed(() => {
    const balance = this.credits();
    if (!balance) return false;
    return balance.business < 20 && balance.appgen < 20;
  });

  readonly tooltip = computed(() => {
    const balance = this.credits();
    if (!balance) return '';
    return `iBusiness : ${balance.business} crédits · iCode : ${balance.appgen} crédits`;
  });

  constructor() {
    // Le badge est monté dans la barre latérale, donc présent sur toutes les
    // pages : c'est le bon endroit pour charger les droits une fois.
    if (!this.billing.me()) this.billing.loadMe().subscribe();
  }
}
