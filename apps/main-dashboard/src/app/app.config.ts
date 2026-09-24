import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  importProvidersFrom,
  SecurityContext,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { paymentRequiredInterceptor } from './shared/interceptors/payment-required.interceptor';
import { MyPreset } from './my-preset';
import { provideMarkdown, MARKED_OPTIONS, MERMAID_OPTIONS } from 'ngx-markdown';
import { CustomTitleStrategy } from './shared/services/custom-title-strategy';
import { adoptIncomingProject } from './shared/services/incoming-project';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Avant le routage : un lien entrant d'une autre application IDEM peut
    // désigner le projet à ouvrir, et les pages lisent le cookie dès leur
    // initialisation.
    provideAppInitializer(adoptIncomingProject),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    // `paymentRequiredInterceptor` après l'authentification : un 402 n'a de
    // sens que sur une requête authentifiée, et l'ordre garantit que le jeton
    // a été posé avant que le refus soit interprété.
    provideHttpClient(withInterceptors([authInterceptor, paymentRequiredInterceptor])),
    provideAnimations(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          // Dual color scheme driven by the `.dark` class (shared idem_theme cookie)
          darkModeSelector: '.dark',
        },
      },
    }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideMarkdown({
      sanitize: SecurityContext.NONE,
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: {
          gfm: true,
          breaks: true,
          pedantic: false,
        },
      },
      mermaidOptions: {
        provide: MERMAID_OPTIONS,
        useValue: {
          darkMode: false,
          look: 'classic',
          theme: 'default',
        },
      },
    }),
  ],
};
