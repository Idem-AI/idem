import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { environment } from '@env';

import { AuthService, SocialProvider } from '../../../../core/auth';
import { LanguageMenu } from '../../../../shared/components/language-menu/language-menu';
import { ThemeToggle } from '../../../../shared/components/theme-toggle/theme-toggle';

/**
 * Sign-in against the IDEM identity. This app issues no accounts of its own:
 * the same credentials open the dashboard, iDeploy and the simulator.
 */
@Component({
  selector: 'sim-login',
  imports: [ReactiveFormsModule, TranslatePipe, ThemeToggle, LanguageMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  protected readonly landingUrl = environment.services.landing.url;
  protected readonly pending = signal<SocialProvider | 'email' | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async signInWith(provider: SocialProvider): Promise<void> {
    this.errorMessage.set(null);
    this.pending.set(provider);
    try {
      const user = await this.auth.signInWithProvider(provider);
      // A null user means a redirect flow took over; the page is unloading.
      if (user) {
        await this.goToReturnUrl();
      }
    } catch (error) {
      this.errorMessage.set(this.describe(error));
    } finally {
      this.pending.set(null);
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.pending.set('email');
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.signInWithEmail(email, password);
      await this.goToReturnUrl();
    } catch (error) {
      this.errorMessage.set(this.describe(error));
    } finally {
      this.pending.set(null);
    }
  }

  private async goToReturnUrl(): Promise<void> {
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
    await this.router.navigateByUrl(
      returnUrl && returnUrl.startsWith('/') ? returnUrl : '/simulations',
    );
  }

  /**
   * Firebase error codes are not something to show a user; map the ones that
   * are actionable and fall back to a single generic line.
   */
  private describe(error: unknown): string {
    const code = (error as { code?: string })?.code ?? '';
    const key =
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
        ? 'auth.error.badCredentials'
        : code === 'auth/too-many-requests'
          ? 'auth.error.tooManyAttempts'
          : code === 'auth/popup-closed-by-user'
            ? 'auth.error.popupClosed'
            : code === 'auth/network-request-failed'
              ? 'auth.error.network'
              : 'auth.error.generic';
    return this.translate.instant(key) as string;
  }
}
