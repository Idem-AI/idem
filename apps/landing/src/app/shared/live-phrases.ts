import { offerPriceXaf, rewriteAmount, type OffersCatalog } from '@idem/shared-promotions';

/**
 * Les montants écrits dans les phrases de la landing (« dès 500 F », « Soit 100 F par jour »…),
 * recalculés depuis les prix servis par l'API (grille réglée dans le panel admin). Sans réponse de
 * l'API, la phrase garde son montant d'origine.
 */
export type LivePhrase = 'minFinal' | 'kitCap' | 'growthMonth' | 'growthPerDay' | 'launchWorth';

export function livePhraseValue(offers: OffersCatalog | null, phrase: LivePhrase): number | null {
  if (!offers) return null;
  switch (phrase) {
    case 'minFinal': {
      const prices = (offers.deliverables ?? []).map((deliverable) => deliverable.priceXaf).filter((value) => value > 0);
      return prices.length ? Math.min(...prices) : null;
    }
    case 'kitCap':
      return offerPriceXaf(offers, 'deliverable.kit');
    case 'growthMonth':
      return offerPriceXaf(offers, 'pass.croissance');
    case 'growthPerDay': {
      const month = offerPriceXaf(offers, 'pass.croissance');
      return month === null ? null : Math.round(month / 30);
    }
    case 'launchWorth': {
      // Ce que coûtent à l'unité les parties du Pack Lancement : le Kit au détail, le Pass Projet,
      // 90 jours de site vitrine allumé.
      const kit = offers.kit?.sumXaf;
      const pass = offerPriceXaf(offers, 'icode.project_pass');
      const vitrine = offerPriceXaf(offers, 'meter:vitrine');
      return kit === undefined || pass === null || vitrine === null ? null : kit + pass + 90 * vitrine;
    }
  }
}

/** La phrase, montant remplacé par la valeur calculée (inchangée si l'API n'a pas répondu). */
export function livePhrase(text: string, offers: OffersCatalog | null, phrase: LivePhrase): string {
  const value = livePhraseValue(offers, phrase);
  if (value === null) return text;
  // « 9,400 F » sur la page anglaise, « 9 400 F » sur la française.
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'fr';
  return rewriteAmount(text, () => value, lang.startsWith('en') ? 'en-US' : 'fr-FR');
}
