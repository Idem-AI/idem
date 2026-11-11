/**
 * Les prix des offres, lus sur l'API IDEM (`GET /billing/offers`, public) — jamais écrits en dur
 * dans une page. L'API sert la grille effective : valeurs par défaut du fichier de tarification
 * + surcharges réglées dans le panel admin (page « Prix »). Une page qui affiche un prix passe par
 * `offerPriceXaf(offers, source)` ; sans réponse de l'API, elle garde son prix de secours.
 */

/** La partie de `/billing/offers` utile aux pages de prix. */
export interface OffersCatalog {
  deliverables: { key: string; priceXaf: number }[];
  kit: { capXaf: number; sumXaf: number };
  signaturePriceXaf: number;
  editPriceXaf: number;
  communication: Record<string, number>;
  passes: { code: string; monthlyXaf: number; annualXaf: number }[];
  icode: Record<string, number>;
  meters: { tier: string; perDayXaf: number }[];
  meterOptions?: { code: string; perDayXaf: number }[];
  simulations: Record<string, { idemXaf: number; publicXaf: number }>;
  packs: { code: string; priceXaf: number }[];
  domains?: Record<string, { priceXaf: number | null; renewalXaf: number | null; packXaf: number | null }>;
  topup?: { minXaf: number; maxXaf?: number; stepXaf?: number; bonuses?: { fromXaf: number; rate: number }[] };
}

/**
 * Le prix d'une offre, d'après sa source :
 *  - un article des promotions (`deliverable.business_plan`, `pass.croissance`, `pack.lancement`,
 *    `icode.project_pass`, `communication.flyer`, `ivision.export_visual`, `isimulate.run`…) ;
 *  - ou une source précise : `pass.croissance:year`, `meter:vitrine`, `meter-option:waf`,
 *    `domain:africa`, `isimulate.run:public`.
 * `null` : l'API ne connaît pas cette offre (la page garde son prix de secours).
 */
export function offerPriceXaf(offers: OffersCatalog | null | undefined, source: string): number | null {
  if (!offers || !source) return null;
  const [key, variant] = source.split(':');
  const pick = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  if (key === 'meter') return pick(offers.meters?.find((meter) => meter.tier === variant)?.perDayXaf);
  if (key === 'meter-option') return pick(offers.meterOptions?.find((option) => option.code === variant)?.perDayXaf);
  if (key === 'domain') return pick(offers.domains?.[variant]?.priceXaf);

  const [family, item] = key.split('.');
  switch (family) {
    case 'deliverable':
      if (item === 'kit') return pick(offers.kit?.capXaf);
      if (item === 'signature') return pick(offers.signaturePriceXaf);
      if (item === 'edit') return pick(offers.editPriceXaf);
      return pick(offers.deliverables?.find((deliverable) => deliverable.key === item)?.priceXaf);
    case 'communication':
      return pick(offers.communication?.[item]);
    case 'ivision':
      return pick(offers.communication?.[item === 'export_video' ? 'motion_video' : 'flyer']);
    case 'pass': {
      const pass = offers.passes?.find((entry) => entry.code === item);
      return pick(variant === 'year' ? pass?.annualXaf : pass?.monthlyXaf);
    }
    case 'pack':
      return pick(offers.packs?.find((pack) => pack.code === item)?.priceXaf);
    case 'icode': {
      const field = ({ project_pass: 'projectPassXaf', modification: 'modificationXaf', premium: 'premiumModificationXaf', pack_100: 'pack100Xaf' } as Record<string, string>)[item];
      return field ? pick(offers.icode?.[field]) : null;
    }
    case 'isimulate': {
      const offer = offers.simulations?.[item];
      return pick(variant === 'public' ? offer?.publicXaf : offer?.idemXaf);
    }
    default:
      return null;
  }
}

/** Charge le catalogue public des offres (navigateur). `null` si l'API ne répond pas. */
export async function fetchOffers(apiUrl: string, fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined): Promise<OffersCatalog | null> {
  if (!fetchImpl) return null;
  try {
    const response = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/billing/offers`, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as OffersCatalog;
  } catch {
    return null;
  }
}
