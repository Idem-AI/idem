import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { TitleStrategy } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { environment } from '@env';

import { authInterceptor, provideFirebase } from './core/auth';
import { LanguageService } from './core/i18n/language.service';
import { TranslatedTitleStrategy } from './core/seo/title.strategy';
import { ThemeService } from './core/theme/theme.service';
import { provideSimulationBackend } from './features/simulations/data-access';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideFirebase(),
    provideSimulationBackend(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
      fallbackLang: environment.defaultLanguage,
      lang: environment.defaultLanguage,
    }),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideAppInitializer(() => {
      inject(LanguageService).init();
      // Instantiating the theme eagerly keeps `data-theme` authoritative from
      // the first navigation, not from the first component that injects it.
      inject(ThemeService);
    }),
  ],
};
