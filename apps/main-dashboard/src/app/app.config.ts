import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  importProvidersFrom,
  SecurityContext,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, browserLocalPersistence, setPersistence } from '@angular/fire/auth';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { MyPreset } from './my-preset';
import { provideMarkdown, MARKED_OPTIONS, MERMAID_OPTIONS } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      // Utiliser indexedDB au lieu de sessionStorage pour meilleure compatibilité mobile
      setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.error('Erreur lors de la configuration de la persistance Firebase:', error);
      });
      return auth;
    }),
    providePrimeNG({
      theme: {
        preset: MyPreset,
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
