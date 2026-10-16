import { NextFunction, Response } from 'express';
import { envelopeKey, generationBudget } from '../config/generation-budgets';
import { CustomRequest } from '../interfaces/express.interface';
import { QuotaGroup, QuotaRefusal } from '../models/usage-quota.model';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { startGenerationBudget } from '../utils/generation-budget.util';

/**
 * Quotas d'usage sur les routes IA.
 *
 * Les livrables facturés passent par `requireCredits`, qui réserve lui-même la place dans le
 * quota du groupe de l'action. Ce middleware-ci garde les routes IA SANS crédits — aides,
 * suggestions, analyses, assistants — qui n'avaient jusqu'ici que l'ancien compteur global (ou
 * rien) : chacune est rattachée à un groupe et, quand elle en a une, à son enveloppe de coût.
 *
 * À placer après `authenticate` et les validations d'entrée, comme `requireCredits`.
 */

/** Réponse 429 d'un refus de quota, avec l'en-tête `Retry-After` en secondes. */
export function sendQuotaRefusal(res: Response, refusal: QuotaRefusal): void {
  const retryAfter = Math.max(1, Math.ceil((new Date(refusal.resetsAt).getTime() - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json(refusal);
}

/** Rend la place réservée quand la génération répond en erreur. */
export function releaseQuotaOnFailure(req: CustomRequest, res: Response): void {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    void releaseRequestQuota(req);
  });
}

/** Rend explicitement la place de cette requête (flux SSE qui casse après le 200). */
export async function releaseRequestQuota(req: CustomRequest): Promise<void> {
  const reservation = req.usageQuota;
  if (!reservation) return;
  req.usageQuota = undefined;
  await usageQuotaService.release(reservation);
}

/** Ouvre le budget de coût d'une génération, selon le réglage `generationBudget`. */
export async function openGenerationBudget(key: string, level: Parameters<typeof generationBudget>[1], chargedCredits?: number): Promise<void> {
  try {
    const mode = (await billingSettingsService.get()).generationBudget;
    if (mode === 'off') return;
    startGenerationBudget(generationBudget(key, level, chargedCredits), mode === 'enforce');
  } catch {
    // Un budget absent n'empêche pas de générer : il ne fait que l'observer.
  }
}

/**
 * Réserve une place dans le quota du groupe avant une génération IA sans crédits.
 *
 * `envelope` : la clé de l'aide dans `GENERATION_ENVELOPES.free` (`onboarding`, `studio`…), pour
 * borner aussi son coût à l'exécution.
 */
export function requireQuota(group: QuotaGroup, options: { envelope?: string } = {}) {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Connectez-vous pour utiliser cette fonctionnalité.',
      });
      return;
    }

    const decision = await usageQuotaService.reserve(userId, group, { email: req.user?.email });
    if (!decision.allowed) {
      sendQuotaRefusal(res, decision.refusal);
      return;
    }

    req.usageQuota = decision.reservation;
    releaseQuotaOnFailure(req, res);
    if (options.envelope) await openGenerationBudget(envelopeKey('free', options.envelope), 'medium');
    next();
  };
}
