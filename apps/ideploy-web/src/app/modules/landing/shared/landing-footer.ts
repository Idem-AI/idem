import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IdemFooterComponent } from '@idem/shared-footer/angular';
import type { FooterLocale } from '@idem/shared-footer';

import { LanguageSelectorComponent } from '../../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle';
import { environment } from '../../../../environments/environment';

/**
 * Le pied de page des pages publiques d'iDeploy.
 *
 * C'est le pied de page d'IDEM, celui de la landing principale, avec les
 * colonnes d'iDeploy : `@idem/shared-footer` tient la structure, les textes et
 * les liens juridiques — dont les règles d'hébergement et le complément de
 * confidentialité propres à iDeploy, que personne n'avait à écrire ici.
 *
 * Seules les bascules de langue et de thème restent locales : elles agissent
 * sur cette application.
 */
@Component({
  selector: 'app-landing-footer',
  imports: [IdemFooterComponent, LanguageSelectorComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <idem-footer
      app="ideploy"
      [locale]="locale()"
      [services]="services"
      logoLight="/assets/logos/Ideploy%20logo%20light.png"
      logoDark="/assets/logos/Ideploy%20logo%20dark.png"
      logoAlt="iDeploy"
    >
      <app-language-selector />
      <app-theme-toggle />
    </idem-footer>
  `,
})
export class LandingFooterComponent {
  private readonly translate = inject(TranslateService);

  // La langue suit celle de l'application : le pied de page est rendu dans la
  // langue affichée, pas dans celle du navigateur.
  private readonly lang = signal(this.translate.currentLang || 'fr');

  protected readonly locale = computed<FooterLocale>(() =>
    this.lang().toLowerCase().startsWith('en') ? 'en' : 'fr'
  );

  constructor() {
    this.translate.onLangChange.subscribe((event) => this.lang.set(event.lang));
  }

  /** Les adresses connues de cette application ; le reste retombe sur la production. */
  protected readonly services = {
    landing: environment.services.landing.url,
    dashboard: environment.services.console.url,
    icode: environment.services.icode.url,
    idomain: environment.services.idomain.url,
  };
}
