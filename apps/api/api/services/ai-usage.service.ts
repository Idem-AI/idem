import mongoose from 'mongoose';
import logger from '../config/logger';
import { computeCostUsd, isPricingEstimated } from '../config/ai-pricing.config';
import {
  AiUsageEventModel,
  AiUsageOperation,
  AiUsageStatus,
  ProviderTokenUsage,
} from '../models/aiUsage.model';
import { AiUsageEvent } from '../schemas/aiUsage.schema';
import { getAiUsageContext } from '../utils/ai-usage-context.util';
import { getTraceContext } from '../utils/trace.util';

/**
 * Journalisation de la consommation IA.
 *
 * Invariant de conception : **l'observabilité ne casse jamais une génération**.
 * Toute erreur d'écriture est journalisée puis avalée — un incident MongoDB sur
 * cette collection ne doit pas faire échouer un logo que l'utilisateur attend.
 */

export interface RecordAiUsageInput {
  provider: string;
  modelName: string;
  usage: ProviderTokenUsage;
  status?: AiUsageStatus;
  errorMessage?: string;
  durationMs?: number;
  promptType?: string;

  // Surcharges explicites : gagnent toujours sur le contexte déduit.
  userId?: string;
  projectId?: string;
  feature?: string;
  element?: string;
  operation?: AiUsageOperation;
  variantCount?: number;
  variantIndex?: number;
  batchId?: string;
}

/** Jour UTC `YYYY-MM-DD`, clé d'agrégation par période. */
function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Estime un nombre de tokens à partir d'un texte, quand le fournisseur n'a pas
 * renvoyé de métadonnées d'usage. ~4 caractères par token : grossier, mais très
 * préférable à un zéro qui rendrait la consommation invisible. Les événements
 * concernés portent `tokensEstimated: true` et le panel admin le signale.
 */
export function estimateTokensFromText(text: string | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

class AiUsageService {
  /**
   * Enregistre un appel de modèle.
   *
   * Ne renvoie jamais d'erreur. La valeur de retour (l'événement ou `null`)
   * n'est utile qu'aux tests et à l'appelant qui veut logguer le coût.
   */
  async record(input: RecordAiUsageInput): Promise<AiUsageEventModel | null> {
    try {
      const context = getAiUsageContext();
      const trace = getTraceContext();

      const inputTokens = Math.max(Math.round(input.usage.inputTokens || 0), 0);
      const outputTokens = Math.max(Math.round(input.usage.outputTokens || 0), 0);
      const cachedInputTokens = Math.max(Math.round(input.usage.cachedInputTokens || 0), 0);

      const estimatedCostUsd = computeCostUsd({
        modelName: input.modelName,
        inputTokens,
        outputTokens,
        cachedInputTokens,
      });

      // Priorité : surcharge explicite > contexte affiné par les services >
      // contexte de trace de la requête.
      const userId = input.userId ?? context?.userId ?? trace?.userId;
      const projectId = input.projectId ?? context?.projectId ?? trace?.projectId;

      const event = await AiUsageEvent.create({
        userId,
        projectId,
        feature: input.feature ?? context?.feature ?? 'unknown',
        element: input.element ?? context?.element,
        operation: input.operation ?? context?.operation ?? 'other',

        variantCount: input.variantCount ?? context?.variantCount,
        variantIndex: input.variantIndex ?? context?.variantIndex,
        batchId: input.batchId ?? context?.batchId,

        provider: input.provider,
        modelName: input.modelName,
        pricingEstimated: isPricingEstimated(input.modelName),

        inputTokens,
        outputTokens,
        cachedInputTokens,
        totalTokens: inputTokens + outputTokens,
        tokensEstimated: !!input.usage.estimated,
        estimatedCostUsd,

        status: input.status ?? 'success',
        errorMessage: input.errorMessage?.slice(0, 1000),
        durationMs: input.durationMs,
        promptType: input.promptType,
        requestId: trace?.requestId,
        source: context?.source ?? (trace ? `${trace.method} ${trace.path}` : undefined),

        day: dayKey(),
      });

      logger.info('ai.usage_recorded', {
        event: 'ai.usage_recorded',
        feature: event.feature,
        element: event.element,
        operation: event.operation,
        model: event.modelName,
        inputTokens,
        outputTokens,
        costUsd: estimatedCostUsd,
        estimated: !!input.usage.estimated,
      });

      // Rollup journalier, best-effort : il alimente les plafonds de
      // token-tracking.service, mais son échec ne doit pas perdre l'événement
      // détaillé déjà écrit.
      if (userId) {
        await this.bumpDailyRollup({
          userId,
          inputTokens,
          outputTokens,
          estimatedCostUsd,
        });
      }

      return event.toObject() as unknown as AiUsageEventModel;
    } catch (error: any) {
      logger.error(`Failed to record AI usage: ${error.message}`, { stack: error.stack });
      return null;
    }
  }

  /**
   * Met à jour le compteur journalier `token_usage` de façon ATOMIQUE.
   *
   * `$inc` + upsert, et non lecture-puis-écriture : une génération de 4
   * variantes de logo lance 4 appels concurrents, dont un read-modify-write
   * perdrait silencieusement des incréments.
   */
  private async bumpDailyRollup(params: {
    userId: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }): Promise<void> {
    try {
      const date = dayKey();
      const now = new Date();
      const totalTokens = params.inputTokens + params.outputTokens;

      await mongoose.connection.collection('token_usage').updateOne(
        { userId: params.userId, date },
        {
          $inc: {
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            totalTokens,
            requestCount: 1,
            estimatedCost: params.estimatedCostUsd,
          },
          $set: { lastUpdated: now, updatedAt: now },
          $setOnInsert: { userId: params.userId, date, createdAt: now },
        },
        { upsert: true }
      );
    } catch (error: any) {
      logger.warn(`Failed to bump daily token rollup for ${params.userId}: ${error.message}`);
    }
  }

  /** Consommation d'un utilisateur sur une fenêtre de jours (inclusive). */
  async getUserUsage(
    userId: string,
    days = 30
  ): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; calls: number }> {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const [row] = await AiUsageEvent.aggregate([
      { $match: { userId, day: { $gte: dayKey(from) } } },
      {
        $group: {
          _id: null,
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          totalTokens: { $sum: '$totalTokens' },
          costUsd: { $sum: '$estimatedCostUsd' },
          calls: { $sum: 1 },
        },
      },
    ]);

    return {
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      totalTokens: row?.totalTokens ?? 0,
      costUsd: row?.costUsd ?? 0,
      calls: row?.calls ?? 0,
    };
  }

  /** Consommation cumulée d'un projet, ventilée par élément. */
  async getProjectUsage(projectId: string): Promise<{
    totals: { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; calls: number };
    byElement: {
      feature: string;
      element?: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      calls: number;
    }[];
  }> {
    const [totalsRow, byElement] = await Promise.all([
      AiUsageEvent.aggregate([
        { $match: { projectId } },
        {
          $group: {
            _id: null,
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            totalTokens: { $sum: '$totalTokens' },
            costUsd: { $sum: '$estimatedCostUsd' },
            calls: { $sum: 1 },
          },
        },
      ]),
      AiUsageEvent.aggregate([
        { $match: { projectId } },
        {
          $group: {
            _id: { feature: '$feature', element: '$element' },
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            costUsd: { $sum: '$estimatedCostUsd' },
            calls: { $sum: 1 },
          },
        },
        { $sort: { costUsd: -1 } },
      ]),
    ]);

    const totals = totalsRow?.[0] ?? {};

    return {
      totals: {
        inputTokens: totals.inputTokens ?? 0,
        outputTokens: totals.outputTokens ?? 0,
        totalTokens: totals.totalTokens ?? 0,
        costUsd: totals.costUsd ?? 0,
        calls: totals.calls ?? 0,
      },
      byElement: byElement.map((row: any) => ({
        feature: row._id?.feature ?? 'unknown',
        element: row._id?.element ?? undefined,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        costUsd: row.costUsd,
        calls: row.calls,
      })),
    };
  }
}

export const aiUsageService = new AiUsageService();
export default aiUsageService;
