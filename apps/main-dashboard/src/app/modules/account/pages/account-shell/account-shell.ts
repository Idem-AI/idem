import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../../billing/services/billing.service';

/**
 * « Mon compte » : un seul endroit pour tout ce qui touche à l'argent.
 *
 * Avant, ces informations vivaient éparpillées — l'offre sur une page de
 * facturation, les quotas sur la page de profil, les crédits dans un badge de
 * la barre du haut, les paiements nulle part. L'utilisateur devait reconstituer
 * lui-même l'état de son compte en passant d'un écran à l'autre, et il ne
 * trouvait sa dernière transaction dans aucun.
 *
 * Cinq onglets, et un seul ordre possible : d'abord où j'en suis (Aperçu),
 * puis ce que je peux prendre (Offres), puis ce que j'ai consommé
 * (Consommation), puis ce que j'ai payé (Paiements), puis qui je suis (Profil).
 * C'est l'ordre des questions que l'on se pose, pas celui du modèle de données.
 *
 * Le bandeau d'alerte est monté ici et non dans chaque page : un impayé doit
 * rester visible pendant qu'on navigue entre les onglets, pas disparaître dès
 * qu'on quitte l'aperçu.
 */
@Component({
  selector: 'app-account-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-text-primary">
          {{ 'account.title' | translate }}
        </h1>
        <p class="mt-1 text-sm text-text-secondary">{{ 'account.subtitle' | translate }}</p>
      </header>

      <!-- Ce qui appelle une action, avant toute chose et sur tous les onglets -->
      @if (alert(); as issue) {
        <div
          class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          [class]="issue.kind === 'past_due' ? 'border-danger/40 bg-danger/10' : 'border-warning/40 bg-warning/10'"
          role="status"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-text-primary">{{ issue.title }}</p>
            <p class="mt-0.5 text-sm text-text-secondary">{{ issue.body }}</p>
          </div>

          <a
            class="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            [routerLink]="issue.actionLink"
            [queryParams]="issue.actionParams"
          >
            {{ issue.actionLabel }}
          </a>
        </div>
      }

      <!-- Onglets. La correspondance exacte ne vaut que pour l'aperçu : sans
           elle, « Aperçu » resterait actif sur chacun de ses enfants et deux
           onglets s'allumeraient ensemble. -->
      <nav
        class="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--glass-border)] pb-px"
        [attr.aria-label]="'account.title' | translate"
      >
        @for (tab of tabs; track tab.route) {
          <a
            [routerLink]="tab.route"
            routerLinkActive="border-primary text-text-primary"
            [routerLinkActiveOptions]="{ exact: tab.exact }"
            class="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            {{ tab.labelKey | translate }}
          </a>
        }
      </nav>

      <router-outlet />
    </div>
  `,
})
export class AccountShellPage {
  private readonly billing = inject(BillingService);

  protected readonly tabs = [
    { route: '/account', labelKey: 'account.tabs.overview', exact: true },
    { route: '/account/plans', labelKey: 'account.tabs.plans', exact: false },
    { route: '/account/usage', labelKey: 'account.tabs.usage', exact: false },
    { route: '/account/payments', labelKey: 'account.tabs.payments', exact: false },
    { route: '/account/profile', labelKey: 'account.tabs.profile', exact: false },
  ];

  /**
   * Le bandeau, formulé.
   *
   * Les textes sont construits ici plutôt que dans le gabarit : chaque alerte a
   * sa propre cible et son propre verbe, et un `@if` en cascade dans le HTML
   * aurait mélangé trois messages dans un seul bloc.
   */
  protected readonly alert = computed(() => {
    const attention = this.billing.attention();
    if (!attention) return null;

    const { kind, plan } = attention;

    if (kind === 'past_due') {
      return {
        kind,
        title: `${plan.engineLabel} — échéance impayée`,
        body: plan.boundaryDate
          ? `Votre accès reste ouvert jusqu'au ${formatDay(plan.boundaryDate)}.`
          : 'Réglez pour conserver votre accès.',
        actionLabel: 'Régler maintenant',
        actionLink: ['/billing/checkout'],
        actionParams: {
          product: plan.subscription?.productCode,
          engine: plan.engine,
        },
      };
    }

    if (kind === 'beta_ending') {
      return {
        kind,
        title: 'Bêta premium active',
        body: plan.boundaryDate
          ? `Vos accès offerts prennent fin le ${formatDay(plan.boundaryDate)}. Choisissez votre offre avant cette date pour ne rien interrompre.`
          : 'Vos accès offerts prendront fin. Choisissez votre offre pour ne rien interrompre.',
        actionLabel: 'Voir les offres',
        actionLink: ['/account/plans'],
        actionParams: {},
      };
    }

    return {
      kind,
      title: `${plan.engineLabel} — il ne vous reste que ${plan.credits} crédits`,
      body: 'Votre prochaine génération risque d’être interrompue.',
      actionLabel: 'Recharger',
      actionLink: ['/account/plans'],
      actionParams: { engine: plan.engine, focus: 'recharges' },
    };
  });

  constructor() {
    // Une seule fois pour tout l'espace : les onglets lisent ensuite les mêmes
    // signaux, sans rappeler l'API à chaque changement d'onglet.
    this.billing.loadCatalog().subscribe();
    this.billing.loadMe().subscribe();
  }
}

/** Date courte, sans dépendre d'un pipe dans une chaîne construite. */
function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
