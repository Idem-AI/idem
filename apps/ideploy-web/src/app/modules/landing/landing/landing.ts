import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';

/**
 * Public iDeploy landing page. If the user is already authenticated (global
 * session cookie), the top-right shows their profile + "Open Dashboard".
 * Otherwise it shows "Log in", which sends them to the central app login;
 * after login they are redirected back to the iDeploy dashboard. Mirrors how
 * apps/landing handles the authenticated/anonymous header.
 */
@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen" style="background: var(--color-bg-dark);">
      <!-- Header -->
      <header class="flex items-center justify-between px-6 h-16 topbar-shell">
        <img src="/ideploy-logo.svg" alt="iDeploy" class="h-8 w-auto object-contain"
             onerror="this.onerror=null;this.src='/ideploy-logo.png';" />
        <div class="flex items-center gap-3">
          @if (user(); as u) {
            <button class="button" (click)="openDashboard()">
              <i class="fa-solid fa-gauge-high mr-2"></i> Open Dashboard
            </button>
            <div class="flex items-center gap-2">
              @if (u.photoURL) {
                <img [src]="u.photoURL" class="w-9 h-9 rounded-full object-cover" alt="" />
              } @else {
                <div class="w-9 h-9 rounded-full flex items-center justify-center"
                     style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);">
                  <span class="text-sm font-bold text-white">{{ (u.displayName || u.email || 'U').charAt(0).toUpperCase() }}</span>
                </div>
              }
              <button class="p-1.5 rounded-lg" title="Log out" (click)="logout()">
                <i class="fa-solid fa-arrow-right-from-bracket text-xs" style="color:#8d919a;"></i>
              </button>
            </div>
          } @else {
            <button class="button" (click)="login()">Log in</button>
          }
        </div>
      </header>

      <!-- Hero -->
      <main class="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 class="heading-serif mb-6" style="font-size:56px;font-weight:700;color:#fff;line-height:1.1;">
          Deploy anything, anywhere.
        </h1>
        <p class="mx-auto mb-10 max-w-2xl text-lg" style="color:#8d919a;">
          iDeploy — your self-hosted platform for applications, databases and services.
          Connect your servers, deploy from Git, and manage everything from one place.
        </p>
        @if (user()) {
          <button class="button" style="font-size:16px;padding:12px 28px;" (click)="openDashboard()">
            <i class="fa-solid fa-gauge-high mr-2"></i> Open Dashboard
          </button>
        } @else {
          <button class="button" style="font-size:16px;padding:12px 28px;" (click)="login()">
            Get started — Log in
          </button>
        }
      </main>
    </div>
  `,
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  protected readonly user = toSignal(this.auth.user$, { initialValue: null });

  ngOnInit(): void {
    // Best-effort: populate the session state without redirecting.
    void this.auth.ensureLoaded();
  }

  protected openDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }
  protected login(): void {
    this.auth.redirectToLogin();
  }
  protected logout(): void {
    void this.auth.logout();
  }
}
