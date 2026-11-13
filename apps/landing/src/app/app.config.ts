import { provideAnimations } from '@angular/platform-browser/animations';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import { MyPreset } from './my-preset';
import { SeoService } from './shared/services/seo.service';
import { provideIdemPromotions } from '@idem/shared-promotions/angular';
import { environment } from '../environments/environment';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideAnimations(),
    provideRouter(routes),
    // Promotions en cours (bêta gratuite, soldes) : prix barrés et bandeau, lus sur l'API.
    provideIdemPromotions({ apiUrl: environment.services.api.url }),
    // Titre, balises de partage et JSON-LD suivent la route (data.seo),
    // y compris au prérendu.
    provideAppInitializer(() => inject(SeoService).init()),
    provideClientHydration(withEventReplay()),
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          // Dual color scheme driven by the `.dark` class (shared idem_theme cookie)
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
