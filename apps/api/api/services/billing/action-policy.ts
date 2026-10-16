import {
  COMMUNICATION_PRICES,
  CommunicationItem,
  DELIVERABLES,
  DeliverableKey,
  EDIT_PRICE_XAF,
  RELAYOUT_PRICE_XAF,
} from '../../models/offer.model';

/**
 * Ce que coûte chaque action IA dans le nouveau modèle.
 *
 * Les routes de génération déclarent toujours leur action au barème historique
 * (`requireCredits('business', 'business_plan', …)`) ; cette table la traduit :
 *
 *  - `deliverable` : un livrable du Kit. Non possédé → ESQUISSE gratuite ; possédé → version
 *    finale, sans débit (elle a été payée au déblocage). Une régénération complète après la
 *    fenêtre de 30 jours coûte la moitié du prix du livrable.
 *  - `edit` : une retouche. Gratuite sur une esquisse, pendant les 30 jours qui suivent l'achat,
 *    ou avec le forfait Croissance ; sinon son prix, compté dans le plafond Croissance du mois.
 *  - `unit` : un contenu de communication, payé à l'unité, compté dans le plafond Croissance.
 *    `oncePerScope` : le premier payé par projet (ou période), les suivants sont des retouches.
 *  - `free` : une aide IA, bornée par les quotas d'usage.
 */

export type ActionPolicy =
  | { kind: 'deliverable'; deliverable: DeliverableKey }
  | { kind: 'edit'; deliverable: DeliverableKey | null; priceXaf: number }
  | { kind: 'unit'; item: CommunicationItem; priceXaf: number; oncePerScope: boolean }
  | { kind: 'free' };

const DELIVERABLE_ACTIONS: Record<string, DeliverableKey> = {
  business_plan: 'business_plan',
  pitch_deck: 'pitch_deck',
  logo_brand: 'logo_brand',
  logo_variations: 'logo_brand',
  legal_kit: 'legal_kit',
  financial_forecast: 'financial_forecast',
  business_card: 'business_card',
};

/** Le livrable retouché, d'après le segment de route (`/project/businessplans/...`). */
const DELIVERABLE_BY_SEGMENT: Record<string, DeliverableKey> = {
  businessplans: 'business_plan',
  businessplan: 'business_plan',
  pitchdecks: 'pitch_deck',
  pitchdeck: 'pitch_deck',
  brandings: 'logo_brand',
  branding: 'logo_brand',
  legaldocs: 'legal_kit',
  finance: 'financial_forecast',
  'business-card': 'business_card',
  businesscard: 'business_card',
  businesscards: 'business_card',
};

export function deliverableOfPath(path: string): DeliverableKey | null {
  for (const segment of path.split('?')[0].split('/')) {
    const key = DELIVERABLE_BY_SEGMENT[segment.toLowerCase()];
    if (key) return key;
  }
  return null;
}

export function policyFor(engine: string, action: string, path = ''): ActionPolicy {
  if (engine !== 'business') return { kind: 'free' };

  const deliverable = DELIVERABLE_ACTIONS[action];
  if (deliverable) return { kind: 'deliverable', deliverable };

  switch (action) {
    case 'business_plan_relayout':
      return { kind: 'edit', deliverable: 'business_plan', priceXaf: RELAYOUT_PRICE_XAF.business_plan ?? EDIT_PRICE_XAF };
    case 'pitch_deck_relayout':
      return { kind: 'edit', deliverable: 'pitch_deck', priceXaf: RELAYOUT_PRICE_XAF.pitch_deck ?? EDIT_PRICE_XAF };
    case 'logo_relaunch':
    case 'logo_regenerate':
    case 'brand_regenerate':
      return { kind: 'edit', deliverable: 'logo_brand', priceXaf: EDIT_PRICE_XAF };
    case 'revision': {
      // Une retouche d'un livrable du Kit suit les règles du livrable ; ailleurs (conseiller,
      // diagrammes, aides de communication) c'est une aide IA.
      const target = deliverableOfPath(path);
      return target ? { kind: 'edit', deliverable: target, priceXaf: EDIT_PRICE_XAF } : { kind: 'free' };
    }
    case 'communication_strategy':
    case 'editorial_calendar':
    case 'communication_plan':
      return { kind: 'unit', item: action, priceXaf: COMMUNICATION_PRICES[action], oncePerScope: true };
    case 'flyer':
    case 'ai_visual':
    case 'carousel':
    case 'motion_video':
    case 'motion_video_rerender':
    case 'short_video':
      return { kind: 'unit', item: action, priceXaf: COMMUNICATION_PRICES[action], oncePerScope: false };
    default:
      return { kind: 'free' };
  }
}

/** Régénération complète d'un livrable possédé, après la fenêtre de retouches. */
export function regenerationPriceXaf(deliverable: DeliverableKey): number {
  return Math.ceil(DELIVERABLES[deliverable].priceXaf / 2 / 50) * 50;
}
