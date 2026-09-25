import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { TitleStrategy } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { environment } from '@env';

import { authInterceptor } from './core/auth';
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
    provideSimulationBackend(),
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
