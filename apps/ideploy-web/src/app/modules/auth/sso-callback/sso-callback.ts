import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

/**
 * SSO callback — landing target of the central app after login
 * (`{ideploy}/auth/idem?token=...`). The session cookie is set on the shared
 * Idem domain at login, so we confirm the session via the global API and then
 * enter the dashboard. Mirrors the Laravel `/auth/idem` SSO entry point.
 */
@Component({
  selector: 'app-sso-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center" style="background: var(--color-bg-dark);">
      <div class="text-center">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl" style="color:#2563eb;"></i>
        <p class="mt-4 text-sm" style="color:#8d919a;">Signing you in…</p>
      </div>
    </div>
  `,
})
export class SsoCallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    // The token is the central app's bridge; the session cookie is what we use.
    // Force a fresh profile fetch, then enter the dashboard (or back to landing).
    const user = await this.auth.fetchCurrentUser();
    if (user) {
      void this.router.navigate(['/dashboard']);
    } else {
      // Session not established (e.g. cross-domain cookie not shared) → back to login.
      this.auth.redirectToLogin();
    }
  }
}
