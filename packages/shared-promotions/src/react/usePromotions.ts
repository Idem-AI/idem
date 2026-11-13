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

/** Le catalogue des offres servi par l'API (prix réglés dans le panel), relu chaque minute et
 * toutes les 10 s tant que l'API n'a pas répondu. */
export function useOffers(apiUrl: string): OffersCatalog | null {
  const [offers, setOffers] = useState<OffersCatalog | null>(null);
  useEffect(() => {
    let alive = true;
    let loaded = false;
    const load = () =>
      void fetchOffers(apiUrl).then((value) => {
        if (!alive || !value) return;
        loaded = true;
        setOffers(value);
      });
    load();
    const every = setInterval(load, 60_000);
    const retry = setInterval(() => {
      if (!loaded) load();
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(every);
      clearInterval(retry);
    };
  }, [apiUrl]);
  return offers;
}
