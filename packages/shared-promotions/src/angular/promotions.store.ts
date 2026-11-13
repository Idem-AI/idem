import { DestroyRef, Injectable, InjectionToken, PLATFORM_ID, inject, makeEnvironmentProviders, signal, type EnvironmentProviders } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createPromotionsClient, type PromotionsClient } from '../client';
import { priceWithPromotions, type PromoPrice } from '../engine';
import type { PublicPromotion } from '../model';
import { fetchOffers, offerPriceXaf, type OffersCatalog } from '../offers';

export interface IdemPromotionsConfig {
  /** Adresse de l'API IDEM (sans `/billing`). */
  apiUrl: string;
}

export const IDEM_PROMOTIONS_CONFIG = new InjectionToken<IdemPromotionsConfig>('IDEM_PROMOTIONS_CONFIG');

/** À ajouter aux `providers` de l'application : `provideIdemPromotions({ apiUrl: environment.services.api.url })`. */
export function provideIdemPromotions(config: IdemPromotionsConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: IDEM_PROMOTIONS_CONFIG, useValue: config }]);
}

/**
 * Les promotions en cours, en signal, pour toute l'application. Lues une fois au démarrage puis
 * chaque minute ; sur le serveur (rendu SSR) la liste reste vide : le prix plein s'affiche, et le
 * navigateur le barre dès qu'il a la réponse.
 */
@Injectable({ providedIn: 'root' })
export class PromotionsStore {
  private readonly config = inject(IDEM_PROMOTIONS_CONFIG, { optional: true });
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly client: PromotionsClient | null = this.config ? createPromotionsClient({ apiUrl: this.config.apiUrl }) : null;

  readonly promotions = signal<PublicPromotion[]>([]);
  /** Le catalogue des offres servi par l'API (prix réglés dans le panel) ; `null` tant qu'il n'est pas lu. */
  readonly offers = signal<OffersCatalog | null>(null);

  constructor() {
    if (!this.config || !this.browser) return;
    // Les prix sont relus chaque minute (un prix changé dans le panel arrive sans recharger la page),
    // et toutes les 10 s tant que l'API n'a jamais répondu (page ouverte pendant qu'elle redémarre).
    const apiUrl = this.config.apiUrl;
    const loadOffers = () => fetchOffers(apiUrl).then((offers) => offers && this.offers.set(offers));
    void loadOffers();
    const timers = [
      setInterval(() => void loadOffers(), 60_000),
      setInterval(() => {
        if (!this.offers()) void loadOffers();
      }, 10_000),
    ];
    inject(DestroyRef).onDestroy(() => timers.forEach((timer) => clearInterval(timer)));
    if (!this.client) return;
    const stop = this.client.subscribe((list) => this.promotions.set(list));
    inject(DestroyRef).onDestroy(stop);
  }

  price(item: string | null, priceXaf: number): PromoPrice {
    return priceWithPromotions(this.promotions(), item, priceXaf);
  }

  /** Le prix d'une offre tel que l'API le sert, sinon `fallback` (prix écrit dans la page). */
  offerPrice(source: string | null | undefined, fallback: number): number {
    return (source ? offerPriceXaf(this.offers(), source) : null) ?? fallback;
  }

  refresh(): Promise<PublicPromotion[]> {
    return this.client ? this.client.load(true) : Promise.resolve([]);
  }

  claim(code: string): Promise<{ ok: boolean; message: string }> {
    return this.client ? this.client.claim(code) : Promise.resolve({ ok: false, message: 'Promotions indisponibles.' });
  }
}
