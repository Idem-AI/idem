import logger from '../../config/logger';
import {
  DeliverableKey,
  ICODE,
  PACKS,
  PACK_GROUP_SIZE,
  PACK_VITRINE_DAYS,
  PassCode,
  isDeliverable,
} from '../../models/offer.model';
import { BillingPurchase } from '../../schemas/billing.schema';
import { UnlockTier } from '../../schemas/offer.schema';
import { domainExtension, idomainClient } from '../idomain/idomain.client';
import { creditLedgerService } from './credit-ledger.service';
import { deployMeterService } from './deploy-meter.service';
import { entitlementsService } from './entitlements.service';
import { idemCodesService, PACK_CODE_VALUE_XAF } from './idem-codes.service';
import { ownershipService } from './ownership.service';
import { passService } from './pass.service';
import { walletService } from './wallet.service';

/**
 * L'achat d'une offre depuis le portefeuille : forfaits, packs, Pass Projet iCode, modifications,
 * versions finales, domaines. Le paiement mobile money ne fait que RECHARGER le portefeuille ;
 * tout le reste se règle ici, en francs, avec les mêmes règles partout.
 */

export type OfferRequest =
  | { kind: 'pass'; code: PassCode; interval?: 'month' | 'year' }
  | { kind: 'pack'; code: 'lancement' | 'lancement_domaine' | 'a_plusieurs'; projectId?: string; domain?: string }
  | { kind: 'icode_project_pass'; projectId: string }
  | { kind: 'icode_pack_100' }
  | { kind: 'unlock'; projectId: string; deliverable: DeliverableKey; tier?: UnlockTier };

export type OfferOutcome =
  | { ok: true; message: string; chargedXaf: number; balanceXaf: number; details?: Record<string, unknown> }
  | { ok: false; error: 'insufficient_balance'; message: string; missingXaf: number; dueXaf: number; balanceXaf: number }
  | { ok: false; error: string; message: string };

const DAY_MS = 86_400_000;

function insufficient(spend: { missingXaf: number; dueXaf: number; balanceXaf: number }): OfferOutcome {
  return {
    ok: false,
    error: 'insufficient_balance',
    message: `Il vous manque ${spend.missingXaf} F dans votre portefeuille.`,
    missingXaf: spend.missingXaf,
    dueXaf: spend.dueXaf,
    balanceXaf: spend.balanceXaf,
  };
}

export class OfferService {
  /** Valide une demande d'achat reçue du client. */
  parse(body: Record<string, unknown>): OfferRequest | null {
    const kind = String(body?.kind ?? '');
    const projectId = typeof body?.projectId === 'string' && body.projectId ? body.projectId : undefined;
    switch (kind) {
      case 'pass': {
        const code = String(body.code ?? '');
        if (!['croissance', 'entreprise', 'createur'].includes(code)) return null;
        return { kind, code: code as PassCode, interval: body.interval === 'year' ? 'year' : 'month' };
      }
      case 'pack': {
        const code = String(body.code ?? '');
        if (!(code in PACKS)) return null;
        return { kind, code: code as 'lancement' | 'lancement_domaine' | 'a_plusieurs', projectId, domain: typeof body.domain === 'string' ? body.domain : undefined };
      }
      case 'icode_project_pass':
        return projectId ? { kind, projectId } : null;
      case 'icode_pack_100':
        return { kind };
      case 'unlock':
        if (!projectId || !isDeliverable(body.deliverable)) return null;
        return { kind, projectId, deliverable: body.deliverable, tier: body.tier === 'signature' ? 'signature' : 'final' };
      default:
        return null;
    }
  }

  async buy(userId: string, request: OfferRequest): Promise<OfferOutcome> {
    const outcome = await this.dispatch(userId, request);
    if (outcome.ok) await entitlementsService.invalidate(userId);
    return outcome;
  }

  private async dispatch(userId: string, request: OfferRequest): Promise<OfferOutcome> {
    switch (request.kind) {
      case 'pass': {
        const result = await passService.buy(userId, request.code, request.interval ?? 'month');
        if (!result.allowed) return insufficient(result);
        return { ok: true, message: 'Forfait activé.', chargedXaf: result.chargedXaf, balanceXaf: result.balanceXaf, details: { until: result.until } };
      }

      case 'unlock': {
        const result = await ownershipService.unlock(userId, request.projectId, request.deliverable, request.tier ?? 'final');
        if (!result.ok) return insufficient(result);
        return {
          ok: true,
          message: result.alreadyOwned ? 'Ce livrable est déjà à vous.' : result.kitComplete ? 'Le Kit Entreprise complet est débloqué.' : 'Version finale débloquée.',
          chargedXaf: result.chargedXaf,
          balanceXaf: result.balanceXaf,
          details: { deliverable: result.deliverable, tier: result.tier, kitComplete: result.kitComplete, regenerate: !result.alreadyOwned },
        };
      }

      case 'icode_project_pass':
        return this.buyProjectPass(userId, request.projectId);

      case 'icode_pack_100': {
        const spend = await walletService.spend(userId, { priceXaf: ICODE.pack100Xaf, label: 'Pack 100 modifications iCode', action: 'icode_pack_100' });
        if (!spend.allowed) return insufficient(spend);
        await creditLedgerService.grant(userId, 'appgen', ICODE.pack100Modifications, 'pack_grant', { note: 'Pack 100 modifications' });
        return { ok: true, message: '100 modifications ajoutées.', chargedXaf: spend.chargedXaf, balanceXaf: spend.balanceXaf };
      }

      case 'pack':
        return this.buyPack(userId, request);
    }
  }

  // ── iCode ─────────────────────────────────────────────────────────────────

  /** Le Pass Projet : un Pass prépayé (pack) s'il y en a un, sinon 1 000 F du portefeuille. */
  async buyProjectPass(userId: string, projectId: string): Promise<OfferOutcome> {
    const owned = await BillingPurchase.exists({ userId, projectId, kind: 'project_pass' });
    if (owned) return { ok: true, message: 'Ce projet est déjà débloqué.', chargedXaf: 0, balanceXaf: await walletService.balance(userId) };

    let charged = 0;
    const voucher = await creditLedgerService.debit(userId, 'icode_pass', 1, { action: 'icode_project_pass', projectId, note: 'Pass Projet prépayé' });
    if (!voucher.allowed) {
      const spend = await walletService.spend(userId, { priceXaf: ICODE.projectPassXaf, label: 'Pass Projet iCode', action: 'icode_project_pass', projectId });
      if (!spend.allowed) return insufficient(spend);
      charged = spend.chargedXaf;
    }

    await BillingPurchase.create({
      userId,
      productCode: 'appgen-project-pass',
      kind: 'project_pass',
      engine: 'appgen',
      priceXaf: charged,
      creditsGranted: ICODE.projectPassModifications,
      projectId,
      provider: 'manual',
      day: new Date().toISOString().slice(0, 10),
    });
    await creditLedgerService.grant(userId, 'appgen', ICODE.projectPassModifications, 'pass_grant', {
      projectId,
      note: `Pass Projet : ${ICODE.projectPassModifications} modifications incluses`,
    });
    return { ok: true, message: 'Projet débloqué : code, GitHub et déploiement.', chargedXaf: charged, balanceXaf: await walletService.balance(userId) };
  }

  // ── Packs ─────────────────────────────────────────────────────────────────

  private async buyPack(userId: string, request: Extract<OfferRequest, { kind: 'pack' }>): Promise<OfferOutcome> {
    const pack = PACKS[request.code];

    if (request.code !== 'a_plusieurs' && !request.projectId) {
      return { ok: false, error: 'project_required', message: 'Choisissez le projet auquel appliquer le pack.' };
    }
    if (request.code === 'lancement_domaine') {
      // Les extensions proposées dans un pack sont celles qu'iDomain vend au coût (seule source des prix).
      const ext = request.domain ? domainExtension(request.domain) : null;
      const catalog = await idomainClient.catalog();
      if (!ext || !catalog[ext]?.packXaf) {
        const offered = Object.keys(catalog).filter((t) => catalog[t].packXaf).map((t) => `.${t}`).join(' ou ') || '.africa ou .com';
        return { ok: false, error: 'invalid_domain', message: `Indiquez un nom de domaine en ${offered}.` };
      }
    }

    const spend = await walletService.spend(userId, { priceXaf: pack.priceXaf, label: pack.label, action: `pack_${request.code}`, projectId: request.projectId });
    if (!spend.allowed) return insufficient(spend);

    if (request.code === 'a_plusieurs') {
      const { codes } = await idemCodesService.generate({ kind: 'pack_lancement', valueXaf: PACK_CODE_VALUE_XAF, count: PACK_GROUP_SIZE, createdBy: userId });
      return { ok: true, message: `${codes.length} codes Pack Lancement à offrir.`, chargedXaf: spend.chargedXaf, balanceXaf: spend.balanceXaf, details: { codes } };
    }

    await this.applyLancement(userId, request.projectId!, 'pack');
    if (request.code === 'lancement_domaine') {
      // Payé ici avec le pack, enregistré par iDomain. La référence (le débit) rend l'appel rejouable sans double commande.
      const reference = `pack:${spend.ledgerEntryId ?? `${userId}:${Date.now()}`}`;
      try {
        await idomainClient.prepaidOrder({ userId, domain: request.domain!.trim().toLowerCase(), reference, source: 'pack' });
      } catch (error) {
        logger.error('billing.pack_domain_failed', { event: 'billing.pack_domain_failed', alert: 'critical', userId, domain: request.domain, reference, error });
      }
    }
    return { ok: true, message: `${pack.label} activé.`, chargedXaf: spend.chargedXaf, balanceXaf: await walletService.balance(userId) };
  }

  /** Ce que donne un Pack Lancement : le Kit du projet, un Pass Projet iCode, 3 mois de Vitrine. */
  async applyLancement(userId: string, projectId: string, source: 'pack' | 'code'): Promise<void> {
    await ownershipService.unlockAll(userId, projectId, source);
    await creditLedgerService.grant(userId, 'icode_pass', 1, 'pack_grant', { projectId, note: 'Pack Lancement : un Pass Projet iCode' });
    await creditLedgerService.grant(userId, 'vitrine_days', PACK_VITRINE_DAYS, 'pack_grant', {
      projectId,
      note: `Pack Lancement : ${PACK_VITRINE_DAYS} jours de site vitrine allumé`,
      expiresAt: new Date(Date.now() + 365 * DAY_MS),
    });
  }

  /** Utilise un code IDEM (portefeuille ou Pack Lancement). */
  async redeemCode(userId: string, code: string, projectId?: string): Promise<OfferOutcome> {
    const claim = await idemCodesService.claim(userId, code, projectId);
    if (!claim.ok) {
      const messages: Record<string, string> = {
        unknown_code: 'Ce code est introuvable. Vérifiez-le et réessayez.',
        already_redeemed: 'Ce code a déjà été utilisé.',
        expired: 'Ce code a expiré.',
      };
      return { ok: false, error: claim.reason, message: messages[claim.reason] };
    }
    if (claim.kind === 'wallet') {
      await entitlementsService.invalidate(userId);
      await deployMeterService.wakeAfterTopUp(userId).catch(() => 0);
      return { ok: true, message: `${claim.valueXaf} F ajoutés à votre portefeuille.`, chargedXaf: 0, balanceXaf: claim.balanceXaf };
    }
    if (!projectId) {
      await idemCodesService.release(claim.code);
      return { ok: false, error: 'project_required', message: 'Choisissez le projet auquel appliquer le Pack Lancement.' };
    }
    await this.applyLancement(userId, projectId, 'code');
    await entitlementsService.invalidate(userId);
    return { ok: true, message: 'Pack Lancement activé sur votre projet.', chargedXaf: 0, balanceXaf: await walletService.balance(userId) };
  }
}

export const offerService = new OfferService();
export default offerService;
