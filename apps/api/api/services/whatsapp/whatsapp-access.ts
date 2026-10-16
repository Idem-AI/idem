import { BillingPurchase } from '../../schemas/billing.schema';
import { entitlementsService } from '../billing/entitlements.service';

/**
 * « Publier depuis WhatsApp » n'existe pas sur le plan gratuit.
 *
 * Ouverte à : la bêta premium, un ancien abonnement payant en cours (jusqu'à son échéance), et un
 * forfait IDEM Croissance ou Entreprise réellement obtenu — acheté, ou atteint par le plafond du
 * mois. Le **cadeau d'inscription** (7 jours de Croissance, provider `welcome`) n'ouvre PAS cette
 * fonction : elle envoie des messages et publie au nom de l'utilisateur, ce qui se mérite par un
 * premier paiement.
 *
 * Contrôlé côté serveur à chaque action (liaison, proposition du jour, message entrant, publication),
 * jamais seulement dans l'interface : un forfait qui expire coupe les envois le jour même.
 */
export type WhatsappAccess = { allowed: true; via: 'beta' | 'legacy' | 'pass' } | { allowed: false; reason: 'free_plan' | 'welcome_only' };

export async function whatsappAccess(userId: string, at = new Date()): Promise<WhatsappAccess> {
  const entitlements = await entitlementsService.resolve(userId);
  if (entitlements.beta.active) return { allowed: true, via: 'beta' };

  const offer = entitlements.offer;
  if (!offer.croissance) return { allowed: false, reason: 'free_plan' };

  const active = await BillingPurchase.find({
    userId,
    kind: 'day_pass',
    productCode: { $in: ['pass-croissance', 'pass-entreprise'] },
    expiresAt: { $gt: at },
  })
    .select('provider')
    .lean();

  if (active.length === 0) {
    // Croissance sans passe : un ancien abonnement payant (`legacyPlan`).
    return { allowed: true, via: 'legacy' };
  }
  if (active.some((purchase) => (purchase as { provider?: string }).provider !== 'welcome')) {
    return { allowed: true, via: 'pass' };
  }
  return { allowed: false, reason: 'welcome_only' };
}
