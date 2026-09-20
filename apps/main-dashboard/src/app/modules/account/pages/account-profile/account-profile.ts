import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { BillingService } from '../../../billing/services/billing.service';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle';

/**
 * Le profil : qui je suis, et rien d'autre.
 *
 * L'ancienne page mélangeait l'identité, un « type de compte » écrit en dur à
 * « gratuit » quel que soit l'abonnement réel, les jauges de quota et un bouton
 * « Passer à la version supérieure » relié à rien. Elle affirmait donc le
 * contraire de la vérité à un abonné payant, et son seul appel à l'action était
 * sans effet.
 *
 * L'offre est désormais lue depuis la facturation — la même source que l'aperçu
 * — et l'écran s'en tient à ce qui le concerne : identité, préférences,
 * déconnexion.
 */
@Component({
  selector: 'app-account-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  template: `
    @if (user(); as account) {
      <section class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-5">
        <div class="flex items-center gap-4">
          @if (account.photoURL) {
            <img
              [src]="account.photoURL"
              alt=""
              class="h-14 w-14 rounded-full border border-[var(--glass-border-medium)] object-cover"
            />
          } @else {
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <i class="pi pi-user text-xl text-primary" aria-hidden="true"></i>
            </div>
          }

          <div class="min-w-0">
            <p class="truncate text-lg font-semibold text-text-primary">
              {{ account.displayName || ('common.notSpecified' | translate) }}
            </p>
            <p class="truncate text-sm text-text-secondary">{{ account.email }}</p>
          </div>
        </div>

        <dl class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'dashboard.profile.fields.memberSince' | translate }}
            </dt>
            <dd class="mt-1 text-sm text-text-primary">
              {{ memberSince() ? (memberSince() | date: 'dd MMMM yyyy') : '—' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'account.signInMethod' | translate }}
            </dt>
            <dd class="mt-1 text-sm text-text-primary">{{ providerLabel() }}</dd>
          </div>

          <div>
            <dt class="text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'account.emailStatus' | translate }}
            </dt>
            <dd class="mt-1 text-sm">
              @if (account.emailVerified) {
                <span class="text-success">
                  <i class="pi pi-check-circle mr-1 text-xs" aria-hidden="true"></i>
                  {{ 'account.emailVerified' | translate }}
                </span>
              } @else {
                <span class="text-warning">{{ 'account.emailUnverified' | translate }}</span>
              }
            </dd>
          </div>

          <!-- L'offre vient de la facturation, jamais d'une valeur écrite ici -->
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'account.currentOffer' | translate }}
            </dt>
            <dd class="mt-1 text-sm text-text-primary">
              @if (planSummary(); as summary) {
                {{ summary }}
                <a class="ml-2 text-primary hover:underline" routerLink="/account">
                  {{ 'account.manage' | translate }}
                </a>
              } @else {
                <span class="text-text-tertiary">—</span>
              }
            </dd>
          </div>
        </dl>
      </section>

      <!-- Préférences : langue et thème étaient relégués au pied de la barre
           latérale, où ils disparaissaient dès qu'on la repliait. -->
      <section class="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-5">
        <h2 class="text-sm font-medium text-text-primary">
          {{ 'account.preferences' | translate }}
        </h2>

        <div class="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <p class="mb-2 text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'account.language' | translate }}
            </p>
            <app-language-selector direction="down" align="left" />
          </div>

          <div>
            <p class="mb-2 text-xs uppercase tracking-wide text-text-tertiary">
              {{ 'account.theme' | translate }}
            </p>
            <app-theme-toggle />
          </div>
        </div>
      </section>

      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
          (click)="logout()"
        >
          <i class="pi pi-sign-out mr-1.5 text-xs" aria-hidden="true"></i>
          {{ 'dashboard.sidebar.userMenu.logout' | translate }}
        </button>
      </div>
    } @else {
      <div class="h-48 animate-pulse rounded-xl bg-[var(--color-surface-2)]"></div>
    }
  `,
})
export class AccountProfilePage {
  private readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);

  protected readonly user = toSignal(this.auth.user$);

  protected readonly memberSince = computed(() => {
    const created = this.user()?.metadata?.creationTime;
    return created ? new Date(created) : null;
  });

  protected readonly providerLabel = computed(() => {
    const providerId = this.user()?.providerData?.[0]?.providerId ?? 'password';
    return (
      {
        'google.com': 'Google',
        'github.com': 'GitHub',
        password: 'E-mail',
      }[providerId] ?? providerId
    );
  });

  /**
   * L'offre, résumée en une ligne.
   *
   * Les moteurs restés sur l'offre gratuite sont omis : les nommer tous les
   * trois transformerait un rappel en inventaire, et c'est l'onglet Aperçu qui
   * est fait pour le détail.
   */
  protected readonly planSummary = computed(() => {
    const paid = this.billing
      .plans()
      .filter((plan) => plan.state !== 'free')
      .map((plan) => `${plan.engineLabel} ${plan.currentName}`);

    if (paid.length > 0) return paid.join(' · ');
    return this.billing.plans().length > 0 ? 'Offre gratuite' : null;
  });

  protected async logout(): Promise<void> {
    try {
      await firstValueFrom(this.auth.logout());
    } finally {
      // La session locale est déjà abandonnée : on quitte l'espace authentifié
      // même si l'appel de déconnexion a échoué.
      void this.router.navigate(['/login']);
    }
  }
}
