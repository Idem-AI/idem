import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { IdemFooterComponent } from '@idem/shared-footer/angular';
import type { FooterLocale } from '@idem/shared-footer';

import { environment } from '../../../environments/environment';
import { isSupportedLocale, writeLocaleCookie } from '../../shared/utils/locale-cookie';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

/**
 * Le pied de page de la landing.
 *
 * La structure, les colonnes, la promesse et les liens juridiques viennent de
 * `@idem/shared-footer` : c'est le même pied de page que celui d'iCode,
 * d'iDeploy, d'iVision, d'iDomain et du simulateur. Ce composant n'ajoute que
 * ce qui ne peut pas être partagé — la bascule de langue, qui recharge *cette*
 * application sous un autre préfixe, et la bascule de thème.
 *
 * `selfHosted` dit au pied de page que la landing sert elle-même les pages
 * produit et les textes juridiques : ses liens restent donc relatifs, et le
 * routeur les prend en charge sans quitter le site.
 *
 * L'horloge de Douala et la bande de faits qui vivaient ici ont disparu avec
 * la mise en commun : elles n'avaient de sens que sur la landing, et un pied
 * de page partagé qui porte une bande propre à une seule application n'est
 * plus partagé.
 */
@Component({
  selector: 'app-footer',
  imports: [IdemFooterComponent, ThemeToggleComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly locale = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);

  /** La langue servie, dans la forme que le pied de page partagé attend. */
  protected readonly footerLocale = computed<FooterLocale>(() =>
    this.locale.toLowerCase().startsWith('en') ? 'en' : 'fr',
  );

  /**
   * Les adresses que la landing connaît.
   *
   * Le reste retombe sur les adresses de production du paquet. Volontaire :
   * les colonnes de la landing pointent surtout ses propres pages (`/idev`,
   * `/ideploy`, `/simulator`), et son `environment` ne porte ni iVision ni
   * iDomain. Lui faire deviner une adresse absente produirait un lien mort.
   */
  protected readonly services = {
    landing: '',
    dashboard: environment.services.dashboard.url,
  };

  protected switchLanguage(targetLang: string): void {
    if (this.locale === targetLang) {
      return;
    }

    // Persist to the shared cross-app cookie (source of truth) + localStorage.
    if (isSupportedLocale(targetLang)) {
      writeLocaleCookie(targetLang);
    }
    localStorage.setItem('idem_lang', targetLang);

    const pathname = this.document.location.pathname;
    let newPath = pathname;

    // Check if the current URL has /fr/ or /fr or /en/ or /en prefix
    const hasFr = pathname.startsWith('/fr/') || pathname === '/fr';
    const hasEn = pathname.startsWith('/en/') || pathname === '/en';

    if (hasFr) {
      newPath = pathname.replace(/^\/fr(\/|$)/, `/${targetLang}$1`);
    } else if (hasEn) {
      newPath = pathname.replace(/^\/en(\/|$)/, `/${targetLang}$1`);
    } else {
      newPath = `/${targetLang}${pathname.startsWith('/') ? pathname : '/' + pathname}`;
    }

    this.document.location.href = `${this.document.location.origin}${newPath}`;
  }
}
