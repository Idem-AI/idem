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
    const token = this.route.snapshot.queryParamMap.get('token');
    console.log('[SsoCallback] Arrived with token:', token ? token.substring(0, 8) + '…' : 'none');

    // The session cookie may take a moment to be readable after the redirect
    // chain — retry a few times before giving up.
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`[SsoCallback] Attempt ${attempt + 1}/3 to verify session…`);
      const user = await this.auth.fetchCurrentUser();
      if (user) {
        console.log('[SsoCallback] Authenticated as', user.email, '→ /dashboard');
        void this.router.navigate(['/dashboard']);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    console.warn('[SsoCallback] All attempts failed → redirectToLogin()');
    // Still not authenticated → redirectToLogin() now breaks the loop (its
    // attempt-flag was set by the guard) and returns to the public landing.
    this.auth.redirectToLogin();
  }
}
