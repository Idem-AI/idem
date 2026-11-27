import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  importProvidersFrom,
  SecurityContext,
} from '@angular/core';
import { provideRouter, TitleStrategy, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { CoreTranslationLoader } from './shared/i18n/translation-chunks';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { policyRequiredInterceptor } from './shared/interceptors/policy-required.interceptor';
import { paymentRequiredInterceptor } from './shared/interceptors/payment-required.interceptor';
import { readOnlyInterceptor } from './shared/interceptors/read-only.interceptor';
import { MyPreset } from './my-preset';
import { provideMarkdown, MARKED_OPTIONS, MERMAID_OPTIONS } from 'ngx-markdown';
import { CustomTitleStrategy } from './shared/services/custom-title-strategy';
import { adoptIncomingProject } from './shared/services/incoming-project';
import { provideIdemPromotions } from '@idem/shared-promotions/angular';
import { environment } from '../environments/environment';
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
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Avant le routage : un lien entrant d'une autre application IDEM peut
    // désigner le projet à ouvrir, et les pages lisent le cookie dès leur
    // initialisation.
    provideAppInitializer(adoptIncomingProject),
    // Promotions en cours (bêta gratuite, soldes, codes promo) : prix barrés et bandeau.
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    provideRouter(
      routes,
      // Les morceaux des pages suivantes arrivent pendant que
      // l'utilisateur lit — mais jamais en 2G ni en mode économie
      // de données, où ils voleraient la bande passante.
      withPreloading(IdemNetworkAwarePreloading),
    ),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    // `paymentRequiredInterceptor` après l'authentification : un 402 n'a de
    // sens que sur une requête authentifiée, et l'ordre garantit que le jeton
    // a été posé avant que le refus soit interprété.
    // PAS de `withFetch()` ici, contrairement aux autres applications :
    // `ngx-sse-client` fait passer les flux de génération par HttpClient et
    // lit `partialText` des événements de progression. Le transport `fetch`
    // les livre autrement, et ces flux lancent de vraies générations
    // facturées — on ne change pas leur transport sans les avoir rejouées.
    provideHttpClient(withInterceptors([authInterceptor, paymentRequiredInterceptor, policyRequiredInterceptor, readOnlyInterceptor])),
    provideAnimations(),
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
      // Le NOYAU des traductions (`<lang>.core.json`, 43 Ko compressés au lieu
      // de 73) : la Communication et la Finance arrivent avec leur page.
      // Voir shared/i18n/translation-chunks.ts.
      loader: provideTranslateLoader(CoreTranslationLoader),
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
