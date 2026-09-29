import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { AuthFlowError, AuthService } from '../../services/auth.service';
import {
  OAuthProvider,
  SupabaseAuthService,
} from '../../../../shared/services/supabase-auth.service';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';

interface ProviderButton {
  id: OAuthProvider;
  label: string;
  icon: string;
}

/**
 * Carte de connexion unique d'IDEM : fournisseurs OAuth (Google, Apple,
 * LinkedIn) et e-mail + mot de passe, avec inscription, mot de passe oublié et
 * choix d'un nouveau mot de passe au retour du lien reçu par e-mail.
 */
@Component({
  selector: 'app-login-card',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  templateUrl: './login-card.html',
  styleUrl: './login-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginCardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly supabase = inject(SupabaseAuthService);

  /** Émis une fois la session IDEM ouverte. */
  readonly loginSuccess = output<void>();

  protected readonly mode = signal<Mode>('signin');
  /** Action en cours : fournisseur, formulaire, ou retour d'un lien. */
  protected readonly busy = signal<OAuthProvider | 'form' | 'callback' | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  /** Message d'information (clé i18n + paramètres). */
  protected readonly notice = signal<{ key: string; email?: string } | null>(null);

  private readonly allProviders: ProviderButton[] = [
    { id: 'google', label: 'Google', icon: 'pi pi-google' },
    { id: 'apple', label: 'Apple', icon: 'pi pi-apple' },
    { id: 'linkedin_oidc', label: 'LinkedIn', icon: 'pi pi-linkedin' },
  ];

  /** Seuls les fournisseurs activés sur le serveur d'authentification sont proposés. */
  protected readonly providers = signal<ProviderButton[]>([]);

  protected readonly form = this.fb.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async ngOnInit(): Promise<void> {
    void this.supabase.enabledProviders().then((enabled) =>
      this.providers.set(this.allProviders.filter((provider) => enabled.includes(provider.id))),
    );

    if (this.authService.callbackInProgress()) this.busy.set('callback');
    const outcome = await this.authService.callbackResult;
    this.busy.set(null);

    switch (outcome.kind) {
      case 'signed-in':
        this.loginSuccess.emit();
        break;
      case 'recovery':
        this.switchMode('recovery');
        break;
      case 'email-confirmed':
        this.notice.set({ key: 'auth.emailConfirmed' });
        break;
      case 'error':
        this.errorKey.set(`auth.errors.${outcome.code}`);
        break;
    }
  }

  protected switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.errorKey.set(null);
    this.notice.set(null);
    this.form.controls.password.reset('');
  }

  protected async continueWith(provider: OAuthProvider): Promise<void> {
    this.errorKey.set(null);
    this.busy.set(provider);
    try {
      // Le navigateur quitte la page : l'indicateur reste jusqu'au départ.
      await this.authService.loginWithProvider(provider);
    } catch (error) {
      this.fail(error);
    }
  }

  protected async submit(): Promise<void> {
    const mode = this.mode();
    const { email, password, displayName } = this.form.getRawValue();
    const needsEmail = mode !== 'recovery';
    const needsPassword = mode !== 'forgot';

    if (
      (needsEmail && this.form.controls.email.invalid) ||
      (needsPassword && this.form.controls.password.invalid)
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorKey.set(null);
    this.notice.set(null);
    this.busy.set('form');
    try {
      switch (mode) {
        case 'signin':
          await new Promise<void>((resolve, reject) =>
            this.authService.login(email, password).subscribe({ next: () => resolve(), error: reject }),
          );
          this.loginSuccess.emit();
          return;
        case 'signup': {
          const outcome = await this.authService.signUp(email, password, displayName);
          if (outcome === 'signed-in') {
            this.loginSuccess.emit();
            return;
          }
          this.notice.set({
            key: outcome === 'already-registered' ? 'auth.alreadyRegistered' : 'auth.confirmSent',
            email,
          });
          break;
        }
        case 'forgot':
          await this.authService.sendPasswordReset(email);
          this.notice.set({ key: 'auth.linkSent', email });
          break;
        case 'recovery':
          await this.authService.completePasswordRecovery(password);
          this.loginSuccess.emit();
          return;
      }
      this.busy.set(null);
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    const code = error instanceof AuthFlowError ? error.code : 'generic';
    this.errorKey.set(`auth.errors.${code}`);
    this.busy.set(null);
  }
}
