import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { provideIdemPromotions } from '@idem/shared-promotions/angular';
import { environment } from '../environments/environment';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
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
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Les morceaux des pages suivantes arrivent pendant que
      // l'utilisateur lit — mais jamais en 2G ni en mode économie
      // de données, où ils voleraient la bande passante.
      withPreloading(IdemNetworkAwarePreloading),
    ),
    // Promotions en cours (bêta gratuite…) : compteurs barrés et bandeau, lus sur l'API IDEM.
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({}),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
  ],
};
