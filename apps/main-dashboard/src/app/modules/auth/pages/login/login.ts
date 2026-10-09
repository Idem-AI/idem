import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SeoService } from '../../../../shared/services/seo.service';
import { LoginCardComponent } from '../../components/login-card/login-card';
import { redirectToApp } from '../../../../shared/utils/app-redirect';
import { ShieldIllustrationComponent } from '../../../../shared/components/shield-illustration/shield-illustration';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector';

/**
 * Écran de connexion unique d'IDEM.
 *
 * Deux colonnes sur grand écran : l'emblème (logo et bouclier) et le
 * formulaire, posé sur le motif IDEM. Sur téléphone, le bouclier se réduit
 * au-dessus du formulaire et le logo passe dans la barre. Après la
 * connexion, l'utilisateur est renvoyé vers l'application qui l'a envoyé ici
 * (`redirect`, `from`, `returnUrl`), sinon vers la console.
 */
@Component({
  selector: 'app-login',
  imports: [
    TranslateModule,
    LoginCardComponent,
    ShieldIllustrationComponent,
    LanguageSelectorComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly termsUrl = `${environment.services.domain}/terms-of-service`;
  protected readonly privacyUrl = `${environment.services.domain}/privacy-policy`;

  private redirectTarget: string | null = null;
  private returnUrl: string | null = null;
  private from: string | null = null;

  ngOnInit(): void {
    this.redirectTarget = this.route.snapshot.queryParamMap.get('redirect');
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.from = this.route.snapshot.queryParamMap.get('from');

    this.seoService.updateTitle('Login - Idem');
    this.seoService.updateMetaTags([
      {
        name: 'description',
        content: 'Access your Idem account to manage your AI-powered projects and brands.',
      },
      { name: 'robots', content: 'noindex, follow' },
    ]);
    this.seoService.setCanonicalUrl('/login');
  }

  protected async onLoginSuccess(): Promise<void> {
    try {
      if (this.redirectTarget === 'ideploy') {
        await this.handleIdeployRedirect();
        return;
      }

      // Simulateur et AppGen : la session voyage par le cookie partagé, il
      // suffit de ramener l'utilisateur sur la page qu'il demandait.
      if (this.redirectTarget === 'simulation') {
        redirectToApp('simulation', this.returnUrl);
        return;
      }
      if (this.redirectTarget === 'ivision') {
        redirectToApp('ivision', this.returnUrl);
        return;
      }
      if (this.from === 'appgen') {
        redirectToApp('appgen', this.returnUrl);
        return;
      }

      if (this.returnUrl) {
        const isRelative = this.returnUrl.startsWith('/') || this.returnUrl.startsWith('./');
        const isSameOrigin = this.returnUrl.startsWith(window.location.origin);
        if (isRelative || isSameOrigin) {
          await this.router.navigateByUrl(this.returnUrl);
          return;
        }
      }

      await this.router.navigate(['/console']);
    } catch (error) {
      console.error('Error navigating after login:', error);
    }
  }

  private async handleIdeployRedirect(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; token: string }>(
          `${environment.services.api.url}/auth/ideploy-token`,
          {},
          { withCredentials: true },
        ),
      );

      if (response.success && response.token) {
        window.location.href = `${environment.services.ideploy.url}/auth/idem?token=${response.token}`;
        return;
      }
      await this.router.navigate(['/console']);
    } catch (error) {
      console.error('Error generating iDeploy SSO token:', error);
      await this.router.navigate(['/console']);
    }
  }
}
