/**
 * Le client des promotions, pour les écrans (navigateur). Une seule lecture partagée par page,
 * rafraîchie toutes les minutes : la fin d'une campagne décidée dans le panel se voit vite, sans
 * marteler l'API.
 *
 * Aucune erreur ne remonte : sans réponse, les prix s'affichent sans remise — jamais l'inverse.
 * Le débit, lui, est toujours recalculé par l'API.
 */
import { priceWithPromotions, type PromoPrice } from './engine';
import type { PromotionsSnapshot, PublicPromotion } from './model';

export interface PromotionsClient {
  /** Dernière liste connue (vide tant que rien n'est chargé). */
  current(): PublicPromotion[];
  /** Charge (ou recharge si périmé) et rend la liste. */
  load(force?: boolean): Promise<PublicPromotion[]>;
  /** Prévenu à chaque changement de liste ; rend la fonction de désabonnement. */
  subscribe(listener: (promotions: PublicPromotion[]) => void): () => void;
  /** Prix remisé d'un article, d'après la dernière liste connue. */
  price(item: string | null, priceXaf: number): PromoPrice;
  /** Saisit un code promo (connecté). */
  claim(code: string): Promise<{ ok: boolean; message: string }>;
}

const TTL_MS = 60_000;

export function createPromotionsClient(options: { apiUrl: string; headers?: () => Record<string, string>; fetchImpl?: typeof fetch }): PromotionsClient {
  const base = options.apiUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  let promotions: PublicPromotion[] = [];
  let loadedAt = 0;
  let pending: Promise<PublicPromotion[]> | null = null;
  const listeners = new Set<(promotions: PublicPromotion[]) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const live = (list: PublicPromotion[], now: number) =>
    list.filter((promotion) => (!promotion.endsAt || Date.parse(promotion.endsAt) > now) && Date.parse(promotion.startsAt) <= now);

  async function fetchSnapshot(): Promise<PublicPromotion[]> {
    if (!doFetch) return promotions;
    try {
      const response = await doFetch(`${base}/billing/promotions`, {
        credentials: 'include',
        headers: { accept: 'application/json', ...(options.headers?.() ?? {}) },
      });
      if (!response.ok) return promotions;
      const snapshot = (await response.json()) as PromotionsSnapshot;
      const serverNow = Date.parse(snapshot.now) || Date.now();
      return live(Array.isArray(snapshot.promotions) ? snapshot.promotions : [], serverNow);
    } catch {
      return promotions;
    }
  }

  function publish(next: PublicPromotion[]): void {
    const changed = JSON.stringify(next) !== JSON.stringify(promotions);
    promotions = next;
    loadedAt = Date.now();
    if (changed) listeners.forEach((listener) => listener(promotions));
  }

  const client: PromotionsClient = {
    current: () => live(promotions, Date.now()),
    async load(force = false) {
      if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return client.current();
      pending ??= fetchSnapshot().then((next) => {
        publish(next);
        pending = null;
        return promotions;
      });
      return pending;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!timer && typeof setInterval !== 'undefined') timer = setInterval(() => void client.load(true), TTL_MS);
      void client.load();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    price: (item, priceXaf) => priceWithPromotions(client.current(), item, priceXaf),
    async claim(code) {
      if (!doFetch) return { ok: false, message: 'Réseau indisponible.' };
      try {
        const response = await doFetch(`${base}/billing/promotions/claim`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...(options.headers?.() ?? {}) },
          body: JSON.stringify({ code }),
        });
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        if (response.ok) await client.load(true);
        return { ok: response.ok, message: body.message ?? (response.ok ? 'Code enregistré.' : 'Ce code ne peut pas être utilisé.') };
      } catch {
        return { ok: false, message: 'Réseau indisponible. Réessayez.' };
      }
    },
  };
  return client;
}

/** La promotion à mettre en avant dans un bandeau : la plus prioritaire de celles qui en demandent un. */
export function bannerPromotion(promotions: readonly PublicPromotion[]): PublicPromotion | null {
  return [...promotions].filter((promotion) => promotion.display?.banner).sort((a, b) => b.priority - a.priority)[0] ?? null;
}

/** Les textes anglais de la campagne bêta, quand la campagne en base n'en porte pas (créée avant leur ajout). */
const BETA_EN = {
  title: 'Free beta: ',
  message: 'during the beta, everything on IDEM is free, packs and plans included. The only limit: your daily credits.',
  badge: 'Beta',
};

/**
 * Les textes d'une promotion dans la langue de la page : le français saisi dans le panel, ou
 * l'anglais (`display.en`), sinon l'anglais par défaut de la bêta, sinon le français.
 */
export function promotionTexts(promotion: PublicPromotion, lang: 'fr' | 'en'): { title: string; message: string; badge: string; until: (endsAt: string) => string; fallbackBadge: string; hide: string } {
  const display = promotion.display;
  const fr = { title: display.title ?? '', message: display.message ?? '', badge: display.badge ?? '' };
  const isBeta = /^beta-gratuite/.test(promotion.slug ?? '');
  const en = {
    title: display.en?.title || (isBeta ? BETA_EN.title : fr.title),
    message: display.en?.message || (isBeta ? BETA_EN.message : fr.message),
    badge: display.en?.badge || (isBeta ? BETA_EN.badge : fr.badge),
  };
  const texts = lang === 'en' ? en : fr;
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const date = (endsAt: string) => new Date(endsAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    ...texts,
    until: (endsAt) => (lang === 'en' ? `Until ${date(endsAt)}` : `Jusqu’au ${date(endsAt)}`),
    fallbackBadge: lang === 'en' ? 'Offer' : 'Offre',
    hide: lang === 'en' ? 'Hide this message' : 'Masquer ce message',
  };
}
