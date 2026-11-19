import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideIdemPromotions } from '@idem/shared-promotions/angular';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/credentials.interceptor';
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
      routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      // Les morceaux des pages suivantes arrivent pendant que l'utilisateur
      // lit — mais jamais en 2G ni en mode économie de données, où ils
      // voleraient la bande passante.
      withPreloading(IdemNetworkAwarePreloading),
    ),
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor])),
    // Prix des recharges et promotions en cours, lus sur l'API IDEM (section « Payez avec votre téléphone »).
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
      fallbackLang: 'fr',
      lang: 'fr',
    }),
  ],
};
