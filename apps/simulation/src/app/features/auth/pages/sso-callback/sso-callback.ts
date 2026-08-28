import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../../core/auth';

/** Le cookie met parfois un instant à être lisible après la redirection. */
const VERIFY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

/**
 * Retour du login central, sur `{simulation}/auth/idem`.
 *
 * C'est aussi le point d'arrivée du bouton « Simuler mon entreprise » du
 * dashboard IDEM. Il n'y a pas de jeton à échanger : le cookie de session est
 * posé sur le domaine IDEM partagé au moment du login, donc on se contente de
 * confirmer la session auprès de l'API avant d'entrer dans l'application.
 */
@Component({
  selector: 'sim-sso-callback',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="sim-main"
      class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center"
    >
      @if (failed()) {
        <h1 class="text-h2 font-semibold text-ink">{{ 'handoff.failedHeading' | translate }}</h1>
        <p class="text-sm leading-relaxed text-ink-muted">{{ 'handoff.failedBody' | translate }}</p>
        <button type="button" class="inner-button mt-1" (click)="signIn()">
          {{ 'auth.signIn' | translate }}
        </button>
      } @else {
        <div
          class="size-6 animate-spin rounded-full border-2 border-line border-t-brand"
          aria-hidden="true"
        ></div>
        <p class="text-sm text-ink-muted" role="status" aria-live="polite">
          {{ 'handoff.connecting' | translate }}
        </p>
      }
    </main>
  `,
})
export class SsoCallback {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly failed = signal(false);

  constructor() {
    void this.verify();
  }

  /** Clic explicite : on repart au login, anti-boucle mis de côté. */
  protected signIn(): void {
    this.auth.redirectToLogin(this.destination(), { force: true });
  }

  private async verify(): Promise<void> {
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      if (await this.auth.fetchProfile()) {
        await this.router.navigateByUrl(this.destination());
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    this.failed.set(true);
  }

  /**
   * Où reprendre : la page demandée avant la connexion, sinon la création
   * d'exécution quand le dashboard a précisé le projet à simuler.
   */
  private destination(): string {
    const params = this.route.snapshot.queryParamMap;

    const returnUrl = params.get('returnUrl');
    if (returnUrl) {
      const path = toInternalPath(returnUrl);
      if (path) {
        return path;
      }
    }

    const projectId = params.get('projectId');
    return projectId ? `/simulations/new?projectId=${encodeURIComponent(projectId)}` : '/simulations';
  }
}

/**
 * Ne garde d'une `returnUrl` que sa partie interne : une URL étrangère glissée
 * dans le paramètre ferait du callback un relais de redirection ouvert.
 */
function toInternalPath(returnUrl: string): string | null {
  try {
    const url = new URL(returnUrl, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
