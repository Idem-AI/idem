import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { AuthFlowError, AuthService } from '../../services/auth.service';
import {
  OAuthProvider,
  SupabaseAuthService,
} from '../../../../shared/services/supabase-auth.service';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';
type FieldName = 'displayName' | 'email' | 'password';

/** Longueur maximale acceptée par le serveur pour un mot de passe. */
const PASSWORD_MAX = 72;
/** Délai avant de pouvoir redemander un e-mail de confirmation. */
const RESEND_COOLDOWN_SECONDS = 60;

interface ProviderButton {
  id: OAuthProvider;
  label: string;
  icon: string;
  /** Fournisseur affiché mais momentanément désactivé côté IDEM. */
  unavailable?: boolean;
}

/**
 * Carte de connexion unique d'IDEM : fournisseurs OAuth (Google,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Émis une fois la session IDEM ouverte. */
  readonly loginSuccess = output<void>();

  protected readonly mode = signal<Mode>('signin');
  /** Action en cours : fournisseur, formulaire, ou retour d'un lien. */
  protected readonly busy = signal<OAuthProvider | 'form' | 'callback' | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  /** Message d'information (clé i18n + paramètres). */
  protected readonly notice = signal<{ key: string; email?: string } | null>(null);

  /** Vrai dès le premier envoi : les erreurs de champ s'affichent alors partout. */
  protected readonly submitted = signal(false);
  /** Adresse à laquelle le lien de confirmation vient d'être envoyé. */
  protected readonly pendingEmail = signal<string | null>(null);
  /** Secondes restantes avant de pouvoir renvoyer l'e-mail. */
  protected readonly resendIn = signal(0);
  protected readonly resent = signal(false);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  private readonly allProviders: ProviderButton[] = [
    // Google : connexion suspendue le temps de régler le problème côté compte
    // d'IDEM. Le bouton reste visible pour signaler l'intention, mais il est
    // désactivé et clairement marqué « indisponible pour le moment ».
    { id: 'google', label: 'Google', icon: 'pi pi-google', unavailable: true },
    { id: 'linkedin_oidc', label: 'LinkedIn', icon: 'pi pi-linkedin' },
  ];

  /** Seuls les fournisseurs activés sur le serveur d'authentification sont proposés. */
  protected readonly providers = signal<ProviderButton[]>([]);

  protected readonly form = this.fb.group({
    displayName: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.applyPasswordRules('signin');
    this.destroyRef.onDestroy(() => this.stopResendTimer());
  }

  async ngOnInit(): Promise<void> {
    void this.supabase.enabledProviders().then((enabled) =>
      // Un fournisseur marqué « indisponible » est tout de même affiché : on
      // le signale explicitement à l'utilisateur plutôt que de le faire
      // disparaître sans explication.
      this.providers.set(
        this.allProviders.filter((provider) => provider.unavailable || enabled.includes(provider.id)),
      ),
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
    this.pendingEmail.set(null);
    this.submitted.set(false);
    this.stopResendTimer();
    this.applyPasswordRules(mode);
    this.form.controls.password.reset('');
    this.form.controls.displayName.markAsUntouched();
    this.form.controls.email.markAsUntouched();
  }

  /**
   * À la connexion on ne contrôle que la présence du mot de passe (un compte
   * existant reste libre de son format) ; à la création et au changement, les
   * règles du serveur s'appliquent dès la saisie.
   */
  private applyPasswordRules(mode: Mode): void {
    const control = this.form.controls.password;
    control.setValidators(
      mode === 'signin'
        ? [Validators.required]
        : [Validators.required, Validators.minLength(8), Validators.maxLength(PASSWORD_MAX)],
    );
    control.updateValueAndValidity();
  }

  /** Clé i18n de l'erreur d'un champ, ou `null` s'il est valide ou pas encore touché. */
  protected fieldError(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!control.invalid || !(control.touched || this.submitted())) return null;
    const errors = control.errors ?? {};
    if (errors['required']) return `auth.fieldErrors.${name}Required`;
    if (errors['email']) return 'auth.fieldErrors.emailInvalid';
    if (errors['minlength']) return 'auth.fieldErrors.passwordMin';
    if (errors['maxlength']) {
      return name === 'password' ? 'auth.fieldErrors.passwordMax' : 'auth.fieldErrors.nameMax';
    }
    return null;
  }

  private focusFirstInvalid(): void {
    const names: FieldName[] = ['displayName', 'email', 'password'];
    const first = names.find((name) => this.form.controls[name].invalid && this.isFieldShown(name));
    if (!first) return;
    this.host.nativeElement
      .querySelector<HTMLElement>(`[formcontrolname="${first}"]`)
      ?.focus();
  }

  private isFieldShown(name: FieldName): boolean {
    const mode = this.mode();
    if (name === 'displayName') return mode === 'signup';
    if (name === 'email') return mode !== 'recovery';
    return mode !== 'forgot';
  }

  protected useAnotherAddress(): void {
    this.pendingEmail.set(null);
    this.stopResendTimer();
    this.notice.set(null);
    this.form.controls.email.reset('');
  }

  protected async resendConfirmation(): Promise<void> {
    const email = this.pendingEmail();
    if (!email || this.resendIn() > 0 || this.busy() !== null) return;
    this.errorKey.set(null);
    this.resent.set(false);
    this.busy.set('form');
    try {
      await this.authService.resendConfirmation(email);
      this.resent.set(true);
      this.startResendTimer();
    } catch (error) {
      this.fail(error);
      return;
    }
    this.busy.set(null);
  }

  private startResendTimer(): void {
    this.stopResendTimer();
    this.resendIn.set(RESEND_COOLDOWN_SECONDS);
    this.resendTimer = setInterval(() => {
      const left = this.resendIn() - 1;
      this.resendIn.set(Math.max(left, 0));
      if (left <= 0) this.stopResendTimer();
    }, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = null;
    this.resendIn.set(0);
  }

  protected async continueWith(provider: OAuthProvider): Promise<void> {
    // Un fournisseur momentanément désactivé ne doit jamais partir en OAuth.
    if (this.allProviders.find((entry) => entry.id === provider)?.unavailable) return;
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
    if (this.busy() !== null) return;
    // Espaces parasites (copier-coller) : retirés avant tout contrôle.
    const typed = this.form.controls.email.value;
    if (typed !== typed.trim()) this.form.controls.email.setValue(typed.trim());
    const { email, password, displayName } = this.form.getRawValue();
    const needsEmail = mode !== 'recovery';
    const needsPassword = mode !== 'forgot';

    if (
      (needsEmail && this.form.controls.email.invalid) ||
      (needsPassword && this.form.controls.password.invalid)
    ) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
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
          if (outcome === 'already-registered') {
            this.notice.set({ key: 'auth.alreadyRegistered', email });
            break;
          }
          // Écran dédié : l'utilisateur doit comprendre qu'il lui reste à ouvrir son e-mail.
          this.pendingEmail.set(email);
          this.resent.set(false);
          this.startResendTimer();
          this.form.controls.password.reset('');
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
