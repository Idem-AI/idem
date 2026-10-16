import logger from '../../config/logger';
import {
  DELIVERABLES,
  DELIVERABLE_KEYS,
  DeliverableKey,
  FINAL_EDIT_WINDOW_DAYS,
  KIT_CAP_XAF,
  KIT_SUM_XAF,
  SIGNATURE_PRICE_XAF,
  kitCapKey,
} from '../../models/offer.model';
import { CreditLedgerEntry } from '../../schemas/billing.schema';
import { DeliverableUnlock, UnlockSource, UnlockTier } from '../../schemas/offer.schema';
import { walletService } from './wallet.service';

/**
 * « Garder » : les versions finales qu'un utilisateur possède, projet par projet.
 *
 * Tant qu'un livrable n'est pas possédé, il se génère en ESQUISSE, gratuitement. Le posséder
 * coûte son prix à l'unité, et le total d'un projet est plafonné au Kit Entreprise : quand les
 * achats d'un projet atteignent 2 500 F, tous les livrables du Kit sont débloqués.
 *
 * Une version finale possédée se retouche gratuitement pendant 30 jours ; au-delà, une retouche
 * se paie, ou s'inclut dans le forfait Croissance.
 */

export interface DeliverableStatus {
  key: DeliverableKey;
  label: string;
  priceXaf: number;
  owned: boolean;
  tier?: UnlockTier;
  source?: UnlockSource;
  unlockedAt?: Date;
  /** Fin des retouches gratuites. */
  editableUntil?: Date;
  /** Vrai quand la version finale a été générée après le déblocage. */
  finalGenerated: boolean;
}

export interface ProjectOwnership {
  projectId: string;
  deliverables: DeliverableStatus[];
  kit: {
    capXaf: number;
    /** Somme des prix à l'unité, pour l'ancrage. */
    sumXaf: number;
    spentXaf: number;
    remainingXaf: number;
    complete: boolean;
  };
  signaturePriceXaf: number;
}

export type UnlockOutcome =
  | { ok: true; deliverable: DeliverableKey; tier: UnlockTier; chargedXaf: number; balanceXaf: number; kitComplete: boolean; alreadyOwned: boolean }
  | { ok: false; reason: 'insufficient_balance'; missingXaf: number; dueXaf: number; balanceXaf: number };

const DAY_MS = 86_400_000;

export class OwnershipService {
  /** L'unlock d'un livrable, en reprenant au besoin un livrable payé en crédits avant la bascule. */
  async get(userId: string, projectId: string, deliverable: DeliverableKey) {
    const unlock = await DeliverableUnlock.findOne({ userId, projectId, deliverable }).lean();
    if (unlock) return unlock;
    return this.adoptLegacy(userId, projectId, deliverable);
  }

  async isOwned(userId: string, projectId: string | undefined, deliverable: DeliverableKey): Promise<boolean> {
    if (!projectId) return false;
    return Boolean(await this.get(userId, projectId, deliverable));
  }

  /** Une retouche est-elle gratuite au titre de la fenêtre de 30 jours ? */
  editWindowOpen(unlockedAt: Date | undefined, at = new Date()): boolean {
    if (!unlockedAt) return false;
    return at.getTime() - new Date(unlockedAt).getTime() < FINAL_EDIT_WINDOW_DAYS * DAY_MS;
  }

  async status(userId: string, projectId: string): Promise<ProjectOwnership> {
    const [unlocks, spentXaf] = await Promise.all([
      Promise.all(DELIVERABLE_KEYS.map((key) => this.get(userId, projectId, key))),
      walletService.spentUnderCap(userId, kitCapKey(projectId)),
    ]);

    const deliverables = DELIVERABLE_KEYS.map((key, index) => {
      const unlock = unlocks[index];
      return {
        key,
        label: DELIVERABLES[key].label,
        priceXaf: DELIVERABLES[key].priceXaf,
        owned: Boolean(unlock),
        tier: unlock?.tier,
        source: unlock?.source,
        unlockedAt: unlock?.unlockedAt,
        editableUntil: unlock ? new Date(new Date(unlock.unlockedAt).getTime() + FINAL_EDIT_WINDOW_DAYS * DAY_MS) : undefined,
        finalGenerated: Boolean(unlock?.finalGeneratedAt),
      };
    });

    const complete = deliverables.every((d) => d.owned);
    return {
      projectId,
      deliverables,
      kit: {
        capXaf: KIT_CAP_XAF,
        sumXaf: KIT_SUM_XAF,
        spentXaf,
        remainingXaf: complete ? 0 : Math.max(0, KIT_CAP_XAF - spentXaf),
        complete,
      },
      signaturePriceXaf: SIGNATURE_PRICE_XAF,
    };
  }

  /**
   * Débloque la version finale d'un livrable (ou sa version Signature).
   *
   * Le prix est débité sous le plafond du projet ; si le plafond est atteint, le Kit entier est
   * débloqué. La Signature est hors plafond (+1 000 F), et suppose la version finale : si elle
   * n'est pas encore possédée, elle est payée dans le même geste.
   */
  async unlock(userId: string, projectId: string, deliverable: DeliverableKey, tier: UnlockTier = 'final'): Promise<UnlockOutcome> {
    const existing = await this.get(userId, projectId, deliverable);
    const offer = DELIVERABLES[deliverable];

    if (existing && (existing.tier === 'signature' || tier === 'final')) {
      return { ok: true, deliverable, tier: existing.tier, chargedXaf: 0, balanceXaf: await walletService.balance(userId), kitComplete: false, alreadyOwned: true };
    }

    let charged = 0;
    let kitComplete = false;

    if (!existing) {
      const spend = await walletService.spend(userId, {
        priceXaf: offer.priceXaf,
        label: `${offer.label} — version finale`,
        action: `unlock_${deliverable}`,
        projectId,
        cap: { key: kitCapKey(projectId), capXaf: KIT_CAP_XAF },
      });
      if (!spend.allowed) return { ok: false, reason: 'insufficient_balance', missingXaf: spend.missingXaf, dueXaf: spend.dueXaf, balanceXaf: spend.balanceXaf };
      charged += spend.chargedXaf;
      await this.record(userId, projectId, deliverable, 'final', spend.chargedXaf > 0 ? 'purchase' : 'kit', spend.chargedXaf);
      if (spend.capReached) {
        await this.unlockAll(userId, projectId, 'kit');
        kitComplete = true;
      }
    }

    if (tier === 'signature') {
      const spend = await walletService.spend(userId, {
        priceXaf: SIGNATURE_PRICE_XAF,
        label: `${offer.label} — version Signature`,
        action: `signature_${deliverable}`,
        projectId,
      });
      if (!spend.allowed) {
        // La version finale reste acquise : seule la Signature manque.
        return { ok: false, reason: 'insufficient_balance', missingXaf: spend.missingXaf, dueXaf: spend.dueXaf, balanceXaf: spend.balanceXaf };
      }
      charged += spend.chargedXaf;
      await DeliverableUnlock.updateOne({ userId, projectId, deliverable }, { $set: { tier: 'signature' }, $inc: { paidXaf: spend.chargedXaf } });
    }

    return { ok: true, deliverable, tier, chargedXaf: charged, balanceXaf: await walletService.balance(userId), kitComplete, alreadyOwned: false };
  }

  /** Débloque tout le Kit d'un projet (plafond atteint, pack, code, bêta). */
  async unlockAll(userId: string, projectId: string, source: UnlockSource): Promise<number> {
    let created = 0;
    for (const key of DELIVERABLE_KEYS) {
      const result = await DeliverableUnlock.updateOne(
        { userId, projectId, deliverable: key },
        { $setOnInsert: { userId, projectId, deliverable: key, tier: 'final', source, paidXaf: 0, unlockedAt: new Date() } },
        { upsert: true }
      );
      created += result.upsertedCount ?? 0;
    }
    logger.info('billing.kit_unlocked', { event: 'billing.kit_unlocked', userId, projectId, source, created });
    return created;
  }

  /** Marque qu'une génération en version finale a abouti. */
  async markFinalGenerated(userId: string, projectId: string, deliverable: DeliverableKey): Promise<void> {
    await DeliverableUnlock.updateOne({ userId, projectId, deliverable }, { $set: { finalGeneratedAt: new Date() } });
  }

  private async record(userId: string, projectId: string, deliverable: DeliverableKey, tier: UnlockTier, source: UnlockSource, paidXaf: number) {
    try {
      await DeliverableUnlock.create({ userId, projectId, deliverable, tier, source, paidXaf, unlockedAt: new Date() });
    } catch (error: any) {
      // Course entre deux déblocages du même livrable : l'index unique garde le premier.
      if (error?.code !== 11000) throw error;
    }
  }

  /**
   * Un livrable payé en crédits avant la bascule reste acquis : on le reprend en version finale
   * la première fois qu'on le consulte.
   */
  private async adoptLegacy(userId: string, projectId: string, deliverable: DeliverableKey) {
    const paid = await CreditLedgerEntry.findOne({
      userId,
      engine: 'business',
      action: deliverable,
      projectId,
      reason: 'consumption',
      delta: { $lt: 0 },
    })
      .select('createdAt')
      .lean();
    if (!paid) return null;

    await DeliverableUnlock.updateOne(
      { userId, projectId, deliverable },
      {
        $setOnInsert: {
          userId,
          projectId,
          deliverable,
          tier: 'final',
          source: 'legacy',
          paidXaf: 0,
          unlockedAt: (paid as { createdAt?: Date }).createdAt ?? new Date(),
          finalGeneratedAt: (paid as { createdAt?: Date }).createdAt ?? new Date(),
        },
      },
      { upsert: true }
    );
    return DeliverableUnlock.findOne({ userId, projectId, deliverable }).lean();
  }
}

export const ownershipService = new OwnershipService();
export default ownershipService;
