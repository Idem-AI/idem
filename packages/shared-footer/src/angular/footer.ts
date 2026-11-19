import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { resolveFooter, type FooterApp, type FooterServices, type ResolvedFooter } from '../apps';
import type { FooterLocale } from '../legal';

/**
 * Le pied de page IDEM, partagé par les applications Angular du dépôt
 * (landing, iDeploy, iVision, iDomain, simulateur).
 *
 * Tout ce qui s'affiche vient de `resolveFooter` : la vue ne décide de rien,
 * et une application ne peut donc pas avoir « presque » le même pied de page.
 * Ce qui reste propre à l'hôte est passé en entrée — ses logos, ses adresses de
 * service — ou projeté : la bascule de langue et de thème vivent dans
 * l'application, parce qu'elles agissent sur elle.
 *
 * @example
 * ```html
 * <idem-footer
 *   app="ideploy"
 *   [locale]="locale()"
 *   [services]="services"
 *   logoLight="/assets/logos/ideploy-light.png"
 *   logoDark="/assets/logos/ideploy-dark.png">
 *   <app-language-selector /><app-theme-toggle />
 * </idem-footer>
 * ```
 */
@Component({
  selector: 'idem-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = footer();

    <footer class="idem-ft" [class.idem-ft--compact]="compact()">
      @if (!compact()) {
        <div class="idem-ft__shell idem-ft__body">
          <div class="idem-ft__brand">
            <!-- L'application peut dessiner sa marque elle-meme : iVision la
                 trace en SVG, elle n'a pas de fichier a servir. L'emplacement
                 est toujours rendu — vide, il n'affiche rien — parce qu'un
                 ng-content sous @if ne recevrait pas toujours son contenu. -->
            <ng-content select="[idemFooterBrand]" />

            @if (!brandSlot()) {
              <a [href]="homeHref()" class="idem-ft__logo" [attr.aria-label]="logoAlt()">
                <!-- Deux fichiers, une seule variante dark: la même que
                     l'en-tete, pour que les deux restent en phase. -->
                <img [src]="logoLight()" alt="" width="120" height="34" class="dark:hidden" />
                <img [src]="logoDark()" alt="" width="120" height="34" class="hidden dark:block" />
              </a>
            }

            <p class="idem-ft__tagline">{{ data.tagline }}</p>

            <ul class="idem-ft__social">
              @for (network of data.social; track network.id) {
                <li>
                  <a
                    class="idem-ft__social-link"
                    [href]="network.url"
                    [attr.aria-label]="network.label"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i [class]="network.icon" aria-hidden="true"></i>
                  </a>
                </li>
              }
            </ul>
          </div>

          <nav class="idem-ft__nav" [attr.aria-label]="navLabel()">
            @for (column of data.columns; track column.id) {
              <div>
                <h2 class="idem-ft__col-title">{{ column.title }}</h2>
                <ul class="idem-ft__list">
                  @for (link of column.links; track link.href + link.label) {
                    <li>
                      <a
                        class="idem-ft__link"
                        [class.idem-ft__link--out]="link.external"
                        [href]="link.href"
                        [attr.target]="link.external ? '_blank' : null"
                        [attr.rel]="link.external ? 'noopener noreferrer' : null"
                        >{{ link.label }}</a
                      >
                    </li>
                  }
                </ul>
              </div>
            }
          </nav>
        </div>
      }

      <div class="idem-ft__shell idem-ft__foot">
        <p class="idem-ft__copy">
          <span>&copy; {{ data.year }} IDEM S.A.S.</span>
          <span class="idem-ft__sep" aria-hidden="true">·</span>
          <span class="idem-ft__claim">{{ data.claim }}</span>
        </p>

        <ul class="idem-ft__legal">
          @for (link of data.legal; track link.href) {
            <li>
              <a
                class="idem-ft__link"
                [href]="link.href"
                [attr.target]="link.external ? '_blank' : null"
                [attr.rel]="link.external ? 'noopener noreferrer' : null"
                >{{ link.label }}</a
              >
            </li>
          }
          <li>
            <a
              class="idem-ft__link"
              [href]="data.licenseUrl"
              target="_blank"
              rel="noopener noreferrer"
              >{{ data.licenseLabel }}</a
            >
          </li>
        </ul>

        <div class="idem-ft__prefs">
          <ng-content />
        </div>
      </div>
    </footer>
  `,
  styleUrls: ['../footer.css'],
})
export class IdemFooterComponent {
  /** L'application dont c'est le pied de page : décide colonnes et textes. */
  readonly app = input.required<FooterApp>();

  /** La langue affichée. L'hôte la tient (cookie partagé, `LOCALE_ID`, i18n). */
  readonly locale = input<FooterLocale>('fr');

  /** Les adresses des services, telles que l'`environment` de l'hôte les porte. */
  readonly services = input<FooterServices>({});

  /**
   * `true` sur la landing seulement : elle sert elle-même les pages juridiques
   * et les pages produit, donc ses liens restent relatifs.
   */
  readonly selfHosted = input(false);

  /** Une seule ligne, sans colonnes : pour un atelier ou une console. */
  readonly compact = input(false);

  /**
   * `true` quand l'hôte projette sa marque (`[idemFooterBrand]`) au lieu de
   * servir deux fichiers. Angular ne sait pas dire si un emplacement nommé a
   * reçu quelque chose : l'hôte le déclare.
   */
  readonly brandSlot = input(false);

  readonly logoLight = input('/assets/icons/logo_white.png');
  readonly logoDark = input('/assets/icons/logo_dark.png');
  readonly logoAlt = input('IDEM');
  readonly navLabel = input('Navigation');

  /** Où mène le logo. Par défaut la racine de l'application hôte. */
  readonly homeHref = input('/');

  protected readonly footer = computed<ResolvedFooter>(() =>
    resolveFooter(this.app(), {
      locale: this.locale(),
      services: this.services(),
      selfHosted: this.selfHosted(),
    })
  );
}
