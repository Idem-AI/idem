import logger from '../../config/logger';
import {
  BillingSettingsModel,
  DEFAULT_BILLING_SETTINGS,
} from '../../models/billing-settings.model';
import { BillingSettings } from '../../schemas/billingSettings.schema';

/**
 * Lecture et écriture des réglages de facturation.
 *
 * Les réglages sont lus à chaque génération (le mode d'application du barème)
 * et à chaque paiement (l'interrupteur d'encaissement) : une requête MongoDB
 * par appel serait un aller-retour inutile sur le chemin critique. D'où un
 * cache en mémoire de courte durée.
 *
 * Le cache est **local au processus** et volontairement court : plusieurs
 * instances de l'API tournent en parallèle, et un changement fait dans l'admin
 * doit se propager sans redémarrage. Trente secondes d'écart entre deux
 * instances sont sans conséquence pour ces réglages — aucun n'est un contrôle
 * de sécurité — alors qu'une invalidation distribuée ajouterait une dépendance
 * Redis sur un chemin qui doit survivre à sa panne.
 */

const CACHE_TTL_MS = 30_000;

let cached: BillingSettingsModel | null = null;
let cachedAt = 0;

/**
 * Fusionne le document lu avec les valeurs par défaut.
 *
 * Un réglage ajouté au code après la création du document serait absent en
 * base ; sans cette fusion il vaudrait `undefined` et chaque appelant devrait
 * s'en défendre.
 */
function withDefaults(doc: Record<string, any> | null): BillingSettingsModel {
  if (!doc) return { ...DEFAULT_BILLING_SETTINGS };

  return {
    ...DEFAULT_BILLING_SETTINGS,
    ...doc,
    beta: { ...DEFAULT_BILLING_SETTINGS.beta, ...(doc.beta ?? {}) },
    welcomeCredit: {
      ...DEFAULT_BILLING_SETTINGS.welcomeCredit,
      ...(doc.welcomeCredit ?? {}),
    },
    // Mongoose renvoie des tableaux vides pour des champs jamais écrits ; on
    // retombe alors sur la valeur par défaut plutôt que sur « aucun rappel ».
    reminderDays:
      Array.isArray(doc.reminderDays) && doc.reminderDays.length > 0
        ? doc.reminderDays
        : DEFAULT_BILLING_SETTINGS.reminderDays,
    key: 'global',
  };
}

export class BillingSettingsService {
  /** Réglages courants, éventuellement servis depuis le cache. */
  async get(): Promise<BillingSettingsModel> {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

    try {
      const doc = await BillingSettings.findOne({ key: 'global' }).lean();
      cached = withDefaults(doc as Record<string, any> | null);
      cachedAt = Date.now();
      return cached;
    } catch (error: any) {
      // Une base indisponible ne doit pas empêcher l'API de servir : on
      // retombe sur les valeurs par défaut, qui sont conservatrices (mode
      // `log`, donc rien n'est bloqué à tort).
      logger.error(`billing.settings_read_failed: ${error.message}`, {
        event: 'billing.settings_read_failed',
      });
      return cached ?? { ...DEFAULT_BILLING_SETTINGS };
    }
  }

  /** Crée le document s'il n'existe pas. Appelé au démarrage. */
  async ensureExists(): Promise<BillingSettingsModel> {
    await BillingSettings.updateOne(
      { key: 'global' },
      { $setOnInsert: DEFAULT_BILLING_SETTINGS },
      { upsert: true }
    );
    this.invalidate();
    return this.get();
  }

  /**
   * Met à jour les réglages. Les champs absents du patch ne sont pas touchés :
   * deux administrateurs qui modifient des sections différentes ne s'écrasent
   * pas mutuellement.
   */
  async update(
    patch: Partial<BillingSettingsModel>,
    updatedBy?: string
  ): Promise<BillingSettingsModel> {
    const update: Record<string, any> = { updatedBy };

    // Aplatissement des objets imbriqués en chemins pointés : `$set: { beta: … }`
    // remplacerait TOUT l'objet `beta`, effaçant les champs non fournis.
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'key' || value === undefined) continue;

      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        for (const [subKey, subValue] of Object.entries(value as unknown as Record<string, unknown>)) {
          if (subValue !== undefined) update[`${key}.${subKey}`] = subValue;
        }
        continue;
      }

      update[key] = value;
    }

    await BillingSettings.updateOne({ key: 'global' }, { $set: update }, { upsert: true });

    logger.info('billing.settings_updated', {
      event: 'billing.settings_updated',
      updatedBy,
      fields: Object.keys(update).filter((k) => k !== 'updatedBy'),
    });

    this.invalidate();
    return this.get();
  }

  /** Force la relecture au prochain appel (après une écriture locale). */
  invalidate(): void {
    cached = null;
    cachedAt = 0;
  }

  // ============================================
  // RACCOURCIS DE LECTURE
  // ============================================

  /**
   * Vrai si l'encaissement est ouvert.
   *
   * Deux interrupteurs, et ce n'est pas une redondance : le réglage
   * `paymentsEnabled` du panel ferme la caisse sans redéploiement, tandis que
   * `PAYMENTS_ENABLED=false` dans l'environnement la ferme **sans dépendre de
   * la base ni du panel** — c'est-à-dire le jour où ce sont justement eux qui
   * posent problème.
   *
   * Une variable absente ne décide de rien : seul un `false` explicite coupe.
   */
  async isPaymentsEnabled(): Promise<boolean> {
    if (process.env.PAYMENTS_ENABLED === 'false') return false;

    const settings = await this.get();
    return settings.paymentsEnabled;
  }

  /** Mode d'application du barème en crédits. */
  async getEnforcement(): Promise<BillingSettingsModel['enforcement']> {
    return (await this.get()).enforcement;
  }

  /** Vrai tant que la bêta premium court (activée et date non dépassée). */
  async isBetaWindowOpen(now = new Date()): Promise<boolean> {
    const { beta } = await this.get();
    if (!beta.enabled) return false;
    return !beta.endsAt || beta.endsAt.getTime() > now.getTime();
  }
}

export const billingSettingsService = new BillingSettingsService();
export default billingSettingsService;
