import { Request, Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { paymentRequiredBody } from '../middleware/billing.middleware';
import {
  COMMUNICATION_PRICES,
  DELIVERABLES,
  DOMAIN_PRICES,
  EDIT_PRICE_XAF,
  FINAL_EDIT_WINDOW_DAYS,
  ICODE,
  KIT_CAP_XAF,
  KIT_SUM_XAF,
  METERS,
  METER_OPTIONS,
  MeterOption,
  MeterTier,
  MONTHLY_CAPS,
  PACKS,
  PASSES,
  SIGNATURE_PRICE_XAF,
  SIMULATION_PRICES,
  TOPUP,
  WELCOME_PASS,
  topupBonusXaf,
} from '../models/offer.model';
import { DomainOrder } from '../schemas/offer.schema';
import { deployMeterService } from '../services/billing/deploy-meter.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { idemCodesService } from '../services/billing/idem-codes.service';
import { OfferOutcome, offerService } from '../services/billing/offer.service';
import { ownershipService } from '../services/billing/ownership.service';
import { walletService } from '../services/billing/wallet.service';
import { WALLET_TOPUP_CODE, paymentService } from '../services/payments/payment.service';

/**
 * Surface HTTP du modèle « Créer, Garder, Faire tourner, Grandir » : le portefeuille, les
 * offres qu'on y achète, la propriété des livrables, les codes IDEM, les domaines et les
 * compteurs iDeploy. Le paiement mobile money (billing.controller) ne fait que recharger.
 */

function fail(res: Response, error: unknown, fallback: string): void {
  logger.error(`billing.offer_request_failed: ${(error as Error)?.message ?? fallback}`, {
    event: 'billing.offer_request_failed',
    stack: (error as Error)?.stack,
  });
  res.status(500).json({ error: 'internal_error', message: fallback });
}

/** Réponse d'un achat : 200, 402 avec la recharge qui couvre le manque, ou 400. */
async function sendOutcome(res: Response, outcome: OfferOutcome, label: string): Promise<void> {
  if (outcome.ok) {
    res.json(outcome);
    return;
  }
  if (outcome.error === 'insufficient_balance' && 'missingXaf' in outcome) {
    res.status(402).json(
      await paymentRequiredBody({
        action: 'offer',
        label,
        priceXaf: outcome.dueXaf,
        balanceXaf: outcome.balanceXaf,
        missingXaf: outcome.missingXaf,
      })
    );
    return;
  }
  res.status(400).json(outcome);
}

const METER_TIER_SET = new Set(Object.keys(METERS));
const METER_OPTION_SET = new Set(Object.keys(METER_OPTIONS));

export class OfferController {
  // ============================================
  // CATALOGUE
  // ============================================

  /**
   * Tous les prix du modèle, en francs, et — si un pays est donné — le prix local de 1 000 F.
   * Public : la page d'offres et la landing les affichent avant toute connexion.
   */
  getOffers = async (req: Request, res: Response): Promise<void> => {
    try {
      let local: { amount: number; currency: string; country: string } | null = null;
      const country = typeof req.query.country === 'string' ? req.query.country : undefined;
      if (country) {
        const quote = await paymentService
          .quote({ productCode: WALLET_TOPUP_CODE, amountXaf: 1000, country })
          .catch(() => null);
        if (quote) local = { amount: quote.amount, currency: quote.currency, country: quote.country };
      }

      res.json({
        currency: 'XAF',
        perThousand: local,
        topup: { ...TOPUP, bonusExamples: TOPUP.suggestedXaf.map((amount) => ({ amountXaf: amount, bonusXaf: topupBonusXaf(amount) })) },
        deliverables: Object.values(DELIVERABLES),
        kit: { capXaf: KIT_CAP_XAF, sumXaf: KIT_SUM_XAF },
        signaturePriceXaf: SIGNATURE_PRICE_XAF,
        editPriceXaf: EDIT_PRICE_XAF,
        editWindowDays: FINAL_EDIT_WINDOW_DAYS,
        communication: COMMUNICATION_PRICES,
        passes: Object.values(PASSES),
        monthlyCaps: MONTHLY_CAPS,
        welcomePass: WELCOME_PASS,
        icode: ICODE,
        meters: Object.values(METERS),
        meterOptions: Object.entries(METER_OPTIONS).map(([code, option]) => ({ code, ...option })),
        simulations: SIMULATION_PRICES,
        packs: Object.values(PACKS),
        domains: DOMAIN_PRICES,
      });
    } catch (error) {
      fail(res, error, 'Impossible de charger les offres.');
    }
  };

  // ============================================
  // PORTEFEUILLE
  // ============================================

  /** Solde, forfaits, droits prépayés et relevé. */
  getWallet = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const [entitlements, statement] = await Promise.all([
        entitlementsService.resolve(userId),
        walletService.statement(userId, Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 200) : 50),
      ]);
      res.json({
        ...entitlements.offer,
        balanceXaf: entitlements.offer.walletXaf,
        beta: entitlements.beta,
        statement,
      });
    } catch (error) {
      fail(res, error, 'Impossible de charger votre portefeuille.');
    }
  };

  /** Achète une offre avec le portefeuille (forfait, pack, version finale, Pass Projet…). */
  buy = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const request = offerService.parse(req.body ?? {});
      if (!request) {
        res.status(400).json({ error: 'invalid_offer', message: 'Offre inconnue ou incomplète.' });
        return;
      }
      const outcome = await offerService.buy(req.user!.uid, request);
      await sendOutcome(res, outcome, labelOf(request));
    } catch (error) {
      fail(res, error, 'L’achat n’a pas pu être effectué.');
    }
  };

  // ============================================
  // PROPRIÉTÉ DES LIVRABLES
  // ============================================

  getOwnership = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      res.json(await ownershipService.status(req.user!.uid, String(req.params.projectId)));
    } catch (error) {
      fail(res, error, 'Impossible de lire vos livrables.');
    }
  };

  // ============================================
  // CODES IDEM
  // ============================================

  redeemCode = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!code.trim()) {
        res.status(400).json({ error: 'missing_code', message: 'Saisissez votre code IDEM.' });
        return;
      }
      const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
      const outcome = await offerService.redeemCode(req.user!.uid, code, projectId);
      if (outcome.ok) await entitlementsService.invalidate(req.user!.uid);
      await sendOutcome(res, outcome, 'Code IDEM');
    } catch (error) {
      fail(res, error, 'Le code n’a pas pu être utilisé.');
    }
  };

  /** Codes à distribuer (pack « À plusieurs »). */
  listCodes = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      res.json({ codes: await idemCodesService.listCreatedBy(req.user!.uid) });
    } catch (error) {
      fail(res, error, 'Impossible de charger vos codes.');
    }
  };

  // ============================================
  // DOMAINES
  // ============================================

  orderDomain = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const domain = typeof req.body?.domain === 'string' ? req.body.domain : '';
      const appUuid = typeof req.body?.appUuid === 'string' ? req.body.appUuid : undefined;
      const outcome = await offerService.buy(req.user!.uid, { kind: 'domain', domain, appUuid });
      await sendOutcome(res, outcome, `Domaine ${domain}`);
    } catch (error) {
      fail(res, error, 'La commande du domaine a échoué.');
    }
  };

  listDomains = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const orders = await DomainOrder.find({ userId: req.user!.uid }).sort({ createdAt: -1 }).limit(100).lean();
      res.json({ domains: orders });
    } catch (error) {
      fail(res, error, 'Impossible de charger vos domaines.');
    }
  };

  // ============================================
  // COMPTEURS iDEPLOY
  // ============================================

  listMeters = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      res.json(await deployMeterService.list(req.user!.uid, req.user!.email));
    } catch (error) {
      fail(res, error, 'Impossible de charger vos compteurs.');
    }
  };

  configureMeter = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const tier = typeof body.tier === 'string' && METER_TIER_SET.has(body.tier) ? (body.tier as MeterTier) : undefined;
      if (body.tier !== undefined && !tier) {
        res.status(400).json({ error: 'invalid_tier', message: 'Compteur inconnu.' });
        return;
      }
      const options = Array.isArray(body.options)
        ? (body.options.filter((option: unknown) => typeof option === 'string' && METER_OPTION_SET.has(option)) as MeterOption[])
        : undefined;
      const autoRecharge = typeof body.autoRecharge === 'boolean' ? body.autoRecharge : undefined;

      const result = await deployMeterService.configure(req.user!.uid, String(req.params.appUuid), { tier, options, autoRecharge });
      await this.sendMeterResult(req, res, result, 'Compteur iDeploy');
    } catch (error) {
      fail(res, error, 'Le compteur n’a pas pu être modifié.');
    }
  };

  wakeMeter = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const result = await deployMeterService.wake(req.user!.uid, String(req.params.appUuid));
      await this.sendMeterResult(req, res, result, 'Réveil de l’application');
    } catch (error) {
      fail(res, error, 'L’application n’a pas pu être réveillée.');
    }
  };

  private async sendMeterResult(
    req: CustomRequest,
    res: Response,
    result: Awaited<ReturnType<typeof deployMeterService.wake>>,
    label: string
  ): Promise<void> {
    if (result.ok) {
      res.json(result);
      return;
    }
    if (result.error === 'meter_not_found') {
      res.status(404).json(result);
      return;
    }
    if (result.error === 'insufficient_balance' && result.missingXaf) {
      const balanceXaf = await walletService.balance(req.user!.uid);
      res.status(402).json(
        await paymentRequiredBody({
          action: 'deploy_meter',
          engine: 'ideploy',
          label,
          priceXaf: balanceXaf + result.missingXaf,
          balanceXaf,
          missingXaf: result.missingXaf,
        })
      );
      return;
    }
    res.status(400).json(result);
  }

  // ============================================
  // ADMINISTRATION (clé de service)
  // ============================================

  /** Crée un lot de codes portefeuille ou Pack Lancement (agents, partenaires, cadeaux). */
  internalGenerateCodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const kind = body.kind === 'pack_lancement' ? 'pack_lancement' : 'wallet';
      const count = Math.min(Math.max(Number(body.count) || 0, 1), 500);
      const valueXaf = kind === 'pack_lancement' ? PACKS.lancement.priceXaf : Number(body.valueXaf);
      if (!Number.isInteger(valueXaf) || valueXaf <= 0) {
        res.status(400).json({ error: 'invalid_value', message: 'Valeur du code invalide.' });
        return;
      }
      const batch = await idemCodesService.generate({
        kind,
        valueXaf,
        count,
        createdBy: typeof body.createdBy === 'string' ? body.createdBy : 'admin',
        agentId: typeof body.agentId === 'string' ? body.agentId : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      res.status(201).json(batch);
    } catch (error) {
      fail(res, error, 'Les codes n’ont pas pu être créés.');
    }
  };

  internalAgentReport = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({ agentId: req.params.agentId, batches: await idemCodesService.agentReport(String(req.params.agentId)) });
    } catch (error) {
      fail(res, error, 'Rapport indisponible.');
    }
  };

  /** File des domaines à enregistrer chez le registrar. */
  internalListDomains = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const orders = await DomainOrder.find(status === 'all' ? {} : { status }).sort({ createdAt: 1 }).limit(500).lean();
      res.json({ domains: orders });
    } catch (error) {
      fail(res, error, 'File des domaines indisponible.');
    }
  };

  internalSettleDomain = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = req.body?.status === 'registered' ? 'registered' : req.body?.status === 'failed' ? 'failed' : null;
      if (!status) {
        res.status(400).json({ error: 'invalid_status', message: 'Statut attendu : registered ou failed.' });
        return;
      }
      const order = await offerService.settleDomainOrder(String(req.params.orderId), {
        status,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : undefined,
      });
      if (!order) {
        res.status(404).json({ error: 'not_found', message: 'Commande introuvable.' });
        return;
      }
      res.json({ order });
    } catch (error) {
      fail(res, error, 'La commande n’a pas pu être clôturée.');
    }
  };

  /** Passage des compteurs à la demande (rattrapage après incident). */
  internalRunMeters = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await deployMeterService.runDaily());
    } catch (error) {
      fail(res, error, 'Passage des compteurs impossible.');
    }
  };
}

function labelOf(request: NonNullable<ReturnType<typeof offerService.parse>>): string {
  switch (request.kind) {
    case 'pass':
      return PASSES[request.code].label;
    case 'pack':
      return PACKS[request.code].label;
    case 'icode_project_pass':
      return 'Pass Projet iCode';
    case 'icode_pack_100':
      return 'Pack 100 modifications iCode';
    case 'unlock':
      return request.tier === 'signature' ? `${DELIVERABLES[request.deliverable].label} — Signature` : DELIVERABLES[request.deliverable].label;
    case 'domain':
      return `Domaine ${request.domain}`;
  }
}

export default new OfferController();
