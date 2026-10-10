import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { LanguageService } from '../../core/language.service';
import { BrandMark } from '../../shared/components/brand-mark';
import { Illustration, IllustrationKind } from '../../shared/components/illustration';

/** La page publique d'iVision : ce que fait le service, en trois gestes, et l'entrée dans l'atelier. */
@Component({
  selector: 'iv-landing',
  imports: [RouterLink, TranslateModule, BrandMark, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
})
export class Landing {
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected readonly signedIn = signal(false);
  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly landingUrl = environment.services.landing.url;
  protected readonly year = new Date().getFullYear();

  protected readonly steps: { kind: IllustrationKind; key: string }[] = [
    { kind: 'stamp', key: 'site' },
    { kind: 'stencil', key: 'model' },
    { kind: 'calame', key: 'edit' },
  ];

  constructor() {
    // La page reste publique : on regarde seulement si une session IDEM existe déjà.
    void this.auth.ensureLoaded().then((user) => this.signedIn.set(!!user));
  }

  protected toggleLanguage(): void {
    this.language.set(this.language.current() === 'fr' ? 'en' : 'fr');
  }
}
