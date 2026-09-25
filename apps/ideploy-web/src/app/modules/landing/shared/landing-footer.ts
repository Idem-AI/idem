import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorComponent } from '../../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle';
import { environment } from '../../../../environments/environment';

/** Footer shared by the two public pages. */
@Component({
  selector: 'app-landing-footer',
  imports: [RouterLink, TranslateModule, LanguageSelectorComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="py-16 px-6 border-t border-[var(--glass-border-subtle)]">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col md:flex-row md:justify-between gap-12">
          <div class="max-w-sm">
            <img
              src="/assets/logos/Ideploy%20logo%20light.png"
              [alt]="'landing.logoAlt' | translate"
              class="h-7 w-auto mb-5 dark:hidden" />
            <img
              src="/assets/logos/Ideploy%20logo%20dark.png"
              alt=""
              aria-hidden="true"
              class="h-7 w-auto mb-5 hidden dark:block" />
            <p class="text-sm text-text-secondary font-medium leading-relaxed">
              {{ 'landing.footer.blurb' | translate }}
            </p>
          </div>

          <div class="flex gap-16">
            <div>
              <p class="text-xs font-bold uppercase text-text-tertiary mb-5">
                {{ 'landing.footer.productTitle' | translate }}
              </p>
              <ul class="flex flex-col gap-3">
                @for (link of links; track link) {
                  <li>
                    <a
                      routerLink="/"
                      [fragment]="link"
                      class="text-sm font-semibold text-text-secondary hover:text-text-primary transition-smooth">
                      {{ 'landing.nav.' + link | translate }}
                    </a>
                  </li>
                }
                <li>
                  <a routerLink="/pricing" class="text-sm font-semibold text-text-secondary hover:text-text-primary transition-smooth">
                    {{ 'landing.nav.pricing' | translate }}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p class="text-xs font-bold uppercase text-text-tertiary mb-5">
                {{ 'landing.footer.startTitle' | translate }}
              </p>
              <ul class="flex flex-col gap-3">
                <li>
                  <a [href]="loginUrl" class="text-sm font-semibold text-text-secondary hover:text-text-primary transition-smooth">
                    {{ 'landing.footer.createAccount' | translate }}
                  </a>
                </li>
                <li>
                  <a [href]="loginUrl" class="text-sm font-semibold text-text-secondary hover:text-text-primary transition-smooth">
                    {{ 'landing.nav.login' | translate }}
                  </a>
                </li>
                <li>
                  <a [href]="idemUrl" class="text-sm font-semibold text-text-secondary hover:text-text-primary transition-smooth">
                    idem.africa
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="mt-12 flex items-center gap-3">
          <p class="text-xs font-bold uppercase text-text-tertiary mr-1">
            {{ 'landing.footer.settingsTitle' | translate }}
          </p>
          <app-language-selector />
          <app-theme-toggle />
        </div>

        <div
          class="mt-10 pt-8 flex flex-col sm:flex-row sm:justify-between gap-2"
          style="border-top: 1px solid var(--glass-border-subtle);">
          <p class="font-mono text-xs text-text-tertiary">
            {{ 'landing.footer.copyright' | translate: { year: year } }}
          </p>
          <p class="font-mono text-xs text-text-tertiary">{{ 'landing.footer.madeIn' | translate }}</p>
        </div>
      </div>
    </footer>
  `,
})
export class LandingFooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;
  protected readonly idemUrl = 'https://idem.africa';
  protected readonly links = ['how', 'where', 'services'];
}
