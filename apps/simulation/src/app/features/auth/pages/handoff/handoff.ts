import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env';

import { AuthService } from '../../../../core/auth';

interface HandoffResponse {
  success: boolean;
  /** Firebase custom token minted for the uid behind the one-time token. */
  customToken: string;
}

/**
 * Entry point for "Simuler mon entreprise" in the IDEM dashboard.
 *
 * The dashboard asks the IDEM API for a one-time token, then sends the user
 * here with `?token=`. This page exchanges it for a Firebase custom token, so
 * the user lands already signed in, on the right project, without a second
 * account. Falls back to the sign-in screen whenever the exchange fails.
 */
@Component({
  selector: 'sim-handoff',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="sim-main" class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      @if (failed()) {
        <h1 class="text-h2 font-semibold text-ink">{{ 'handoff.failedHeading' | translate }}</h1>
        <p class="text-sm leading-relaxed text-ink-muted">{{ 'handoff.failedBody' | translate }}</p>
        <a routerLink="/login" class="inner-button mt-1">{{ 'auth.signIn' | translate }}</a>
      } @else {
        <div class="size-6 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden="true"></div>
        <p class="text-sm text-ink-muted" role="status" aria-live="polite">
          {{ 'handoff.connecting' | translate }}
        </p>
      }
    </main>
  `,
})
export class Handoff {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly failed = signal(false);

  constructor() {
    void this.exchange();
  }

  private async exchange(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    const projectId = this.route.snapshot.queryParamMap.get('projectId');

    if (!token) {
      this.failed.set(true);
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<HandoffResponse>(
          `${environment.services.api.url}/auth/simulation-token/exchange`,
          { token },
          { withCredentials: true },
        ),
      );

      if (!response.success || !response.customToken) {
        throw new Error('Handoff token rejected');
      }

      await this.auth.signInWithHandoffToken(response.customToken);
      await this.router.navigate(
        ['/simulations/new'],
        projectId ? { queryParams: { projectId } } : {},
      );
    } catch (error) {
      console.error('[auth] IDEM handoff failed', error);
      this.failed.set(true);
    }
  }
}
