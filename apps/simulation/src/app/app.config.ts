import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { TitleStrategy } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { environment } from '@env';

import { authInterceptor } from './core/auth';
import { LanguageService } from './core/i18n/language.service';
import { TranslatedTitleStrategy } from './core/seo/title.strategy';
import { ThemeService } from './core/theme/theme.service';
import { provideSimulationBackend } from './features/simulations/data-access';

// Les dates s'affichent dans la langue choisie : « 2 oct. 2026 », pas « Oct 2, 2026 ».
registerLocaleData(localeFr);
import { routes } from './app.routes';
import { provideIdemPromotions } from '@idem/shared-promotions/angular';
import {
  IdemNetworkAwarePreloading,
  provideIdemServiceWorker,
} from '@idem/shared-offline/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    // Service worker partagé : la deuxième visite part du cache et se met à
    // jour en arrière-plan — l'application s'affiche tout de suite, même à
    // 30 Ko/s. C'est aussi la garantie contre les versions périmées.
    provideIdemServiceWorker(),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Les morceaux des pages suivantes arrivent pendant que l'utilisateur
      // lit — mais jamais en 2G ni en mode économie de données, où ils
      // voleraient la bande passante.
      withPreloading(IdemNetworkAwarePreloading),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideSimulationBackend(),
    // Prix (barrés pendant la bêta) et paiement mobile money : page /pricing.
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
      fallbackLang: environment.defaultLanguage,
      lang: environment.defaultLanguage,
    }),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const language = inject(LanguageService);
        const theme = inject(ThemeService);
        return () => {
          language.init();
        };
      },
      multi: true,
    },
  ],
};
