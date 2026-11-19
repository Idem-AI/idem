import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IdemFooterComponent } from '@idem/shared-footer/angular';
import type { FooterLocale } from '@idem/shared-footer';

import { LanguageService } from '../../core/i18n/language.service';
import { environment } from '../../../environments/environment';

/**
 * Le pied de page du simulateur.
 *
 * Il n'en avait aucun : les conditions de la simulation existaient, mais il
 * fallait connaître leur adresse pour les trouver. Les deux coquilles le
 * portent désormais — en version compacte, parce qu'un atelier de simulation
 * n'est pas une page d'accueil et n'a pas besoin de trois colonnes de liens.
 */
@Component({
  selector: 'sim-footer',
  imports: [IdemFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <idem-footer app="isimulator" [locale]="locale()" [services]="services" [compact]="true" />
  `,
})
export class SimulationFooter {
  private readonly language = inject(LanguageService);

  protected readonly locale = computed<FooterLocale>(() =>
    this.language.language().toLowerCase().startsWith('en') ? 'en' : 'fr',
  );

  /** Les adresses connues du simulateur ; le reste retombe sur la production. */
  protected readonly services = {
    landing: environment.services.landing.url,
    dashboard: environment.services.dashboard.url,
    simulator: environment.services.self.url,
  };
}
