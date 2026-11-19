import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IdemFooterComponent } from '@idem/shared-footer/angular';
import type { FooterLocale } from '@idem/shared-footer';

import { BrandMark } from '../../../shared/components/brand-mark';
import { environment } from '../../../../environments/environment';

/**
 * Le pied de page d'iVision.
 *
 * C'était une seule ligne — copyright, tarifs, idem.africa, tableau de bord —
 * sans aucun lien vers un texte juridique. C'est maintenant le pied de page
 * d'IDEM, celui de la landing principale, avec les colonnes d'iVision et ses
 * deux textes propres : confidentialité (voix, images, publication) et règles
 * d'utilisation (visages, marques, ce que nous refusons de produire).
 */
@Component({
  selector: 'iv-landing-footer',
  imports: [IdemFooterComponent, BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <idem-footer app="ivision" [locale]="locale()" [services]="services" [brandSlot]="true">
      <!-- iVision trace sa marque : pas de fichier a servir au pied de page. -->
      <a idemFooterBrand href="/" class="inline-flex" aria-label="iVision">
        <iv-brand-mark [size]="30" />
      </a>
    </idem-footer>
  `,
})
export class LandingFooter {
  private readonly translate = inject(TranslateService);

  private readonly lang = signal(this.translate.currentLang || 'fr');

  protected readonly locale = computed<FooterLocale>(() =>
    this.lang().toLowerCase().startsWith('en') ? 'en' : 'fr'
  );

  /** Les adresses connues d'iVision ; le reste retombe sur la production. */
  protected readonly services = {
    landing: environment.services.landing.url,
    dashboard: environment.services.dashboard.url,
    icode: environment.services.icode.url,
  };

  constructor() {
    this.translate.onLangChange.subscribe((event) => this.lang.set(event.lang));
  }
}
