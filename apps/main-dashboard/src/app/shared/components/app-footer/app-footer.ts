import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IdemFooterComponent } from '@idem/shared-footer/angular';
import type { FooterLocale } from '@idem/shared-footer';

import { environment } from '../../../../environments/environment';

/**
 * Le pied de page du tableau de bord.
 *
 * Le tableau de bord n'avait aucun pied de page : les conditions générales et
 * la politique de confidentialité n'étaient atteignables que depuis la landing,
 * c'est-à-dire en quittant l'application. Version compacte — une ligne de
 * signature et les textes juridiques — parce qu'un atelier n'a pas besoin de
 * trois colonnes de liens produit.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [IdemFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <idem-footer app="idem" [locale]="locale()" [services]="services" [compact]="true" />
  `,
})
export class AppFooterComponent {
  private readonly translate = inject(TranslateService);

  private readonly lang = signal(this.translate.currentLang || 'fr');

  protected readonly locale = computed<FooterLocale>(() =>
    this.lang().toLowerCase().startsWith('en') ? 'en' : 'fr',
  );

  /**
   * Les adresses connues du tableau de bord. `landing` porte les textes
   * juridiques : sans elle, les liens du pied de page tomberaient sur
   * l'application elle-même, qui ne les sert pas.
   */
  protected readonly services = {
    landing: environment.services.domain,
    icode: environment.services.webgen.url,
    ideploy: environment.services.ideploy.url,
    ivision: environment.services.ivision.url,
    idomain: environment.services.idomain.url,
    simulator: environment.services.simulation.url,
  };

  constructor() {
    this.translate.onLangChange.subscribe((event) => this.lang.set(event.lang));
  }
}
