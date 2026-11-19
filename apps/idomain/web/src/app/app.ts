import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IdemUpdateBannerComponent } from '@idem/shared-offline/angular';
import { LanguageService } from './core/language.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'idm-root',
  imports: [RouterOutlet, IdemUpdateBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <idem-update-banner
      [label]="t.instant('appUpdate.message')"
      [actionLabel]="t.instant('appUpdate.reload')"
      [dismissLabel]="t.instant('appUpdate.later')"
    />
    <router-outlet />
  `,
})
export class App {
  // Instanciés au démarrage : langue et thème partagés (cookies IDEM) appliqués avant l'interface.
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  protected readonly t = inject(TranslateService);
}
