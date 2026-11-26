import { provideAnimations } from '@angular/platform-browser/animations';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withIncrementalHydration } from '@angular/platform-browser';
import { SeoService } from './shared/services/seo.service';
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
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideAnimations(),
    provideRouter(
      routes,
      // Les morceaux des pages suivantes arrivent pendant que
      // l'utilisateur lit — mais jamais en 2G ni en mode économie
      // de données, où ils voleraient la bande passante.
      withPreloading(IdemNetworkAwarePreloading),
    ),
    // Promotions en cours (bêta gratuite, soldes) : prix barrés et bandeau, lus sur l'API.
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    // Titre, balises de partage et JSON-LD suivent la route (data.seo),
    // y compris au prérendu.
    provideAppInitializer(() => inject(SeoService).init()),
    // Hydratation incrémentale : les sections sous le héros restent dans le HTML
    // prérendu, mais leur JavaScript ne s'exécute qu'en arrivant à l'écran.
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    // Aucun composant PrimeNG sur la landing : son thème (Aura) n'est plus chargé.
  ],
};
