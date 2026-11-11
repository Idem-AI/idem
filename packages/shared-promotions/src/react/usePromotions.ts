import { useEffect, useMemo, useState } from 'react';
import { createPromotionsClient, type PromotionsClient } from '../client';
import type { PublicPromotion } from '../model';
import { fetchOffers, type OffersCatalog } from '../offers';

const clients = new Map<string, PromotionsClient>();

/** Un client par adresse d'API, partagé par tous les composants de la page. */
export function promotionsClientFor(apiUrl: string): PromotionsClient {
  let client = clients.get(apiUrl);
  if (!client) {
    client = createPromotionsClient({ apiUrl });
    clients.set(apiUrl, client);
  }
  return client;
}

/** Les promotions en cours, tenues à jour (rechargées chaque minute). */
export function usePromotions(apiUrl: string): { promotions: PublicPromotion[]; client: PromotionsClient } {
  const client = useMemo(() => promotionsClientFor(apiUrl), [apiUrl]);
  const [promotions, setPromotions] = useState<PublicPromotion[]>(() => client.current());
  useEffect(() => client.subscribe(setPromotions), [client]);
  return { promotions, client };
}

const offersByApi = new Map<string, Promise<OffersCatalog | null>>();

/** Le catalogue des offres servi par l'API (prix réglés dans le panel), lu une fois par page. */
export function useOffers(apiUrl: string): OffersCatalog | null {
  const [offers, setOffers] = useState<OffersCatalog | null>(null);
  useEffect(() => {
    let alive = true;
    let pending = offersByApi.get(apiUrl);
    if (!pending) {
      pending = fetchOffers(apiUrl);
      offersByApi.set(apiUrl, pending);
    }
    void pending.then((value) => alive && setOffers(value));
    return () => {
      alive = false;
    };
  }, [apiUrl]);
  return offers;
}
