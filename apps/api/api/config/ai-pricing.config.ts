/**
 * Tarifs des modèles, en USD par MILLION de tokens.
 *
 * Sert uniquement à estimer un coût pour l'observabilité (dashboard admin,
 * plafonds de dépense) — ce n'est pas une source de facturation. Les tarifs
 * réels des fournisseurs évoluent : `AI_PRICING_OVERRIDES` (JSON en variable
 * d'env) permet de les corriger sans redéploiement de code.
 *
 * La résolution se fait par préfixe le plus long, pour qu'une variante datée
 * d'un modèle hérite de son tarif au lieu de retomber silencieusement sur le
 * tarif par défaut.
 */

import { OPENROUTER_MODELS } from './openrouter.config';

export interface ModelPricing {
  /** USD par million de tokens d'entrée. */
  input: number;
  /** USD par million de tokens de sortie. */
  output: number;
  /** USD par million de tokens d'entrée servis depuis un cache (surcharge explicite). */
  cachedInput?: number;
}

/**
 * Dérivé de la liste blanche (`openrouter.config.ts`) : le coût d'un modèle et son
 * autorisation vivent au même endroit, jamais recopiés. Relevé sur le catalogue
 * OpenRouter (`npm run openrouter:matrix` signale tout écart de plus de 25 %).
 */
const PRICING: Record<string, ModelPricing> = Object.fromEntries(
  OPENROUTER_MODELS.filter(
    (model) => model.pricing?.input !== undefined && model.pricing?.output !== undefined
  ).map((model) => [
    model.id,
    { input: model.pricing!.input as number, output: model.pricing!.output as number },
  ])
);

/** Tarif appliqué à un modèle inconnu — volontairement non nul pour rester visible. */
const DEFAULT_PRICING: ModelPricing = { input: 0.5, output: 2 };

let overrides: Record<string, ModelPricing> | null = null;

/**
 * Surcharges via `AI_PRICING_OVERRIDES`, ex :
 * `{"qwen/qwen3.5-122b-a10b":{"input":0.25,"output":2}}`
 * Parsé une seule fois ; un JSON invalide est ignoré (l'observabilité ne doit
 * jamais empêcher une génération d'aboutir).
 */
function getOverrides(): Record<string, ModelPricing> {
  if (overrides !== null) return overrides;

  const raw = process.env.AI_PRICING_OVERRIDES;
  let resolved: Record<string, ModelPricing> = {};

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        resolved = parsed as Record<string, ModelPricing>;
      }
    } catch {
      // JSON invalide : on garde la table par défaut plutôt que de faire
      // échouer le calcul de coût.
    }
  }

  overrides = resolved;
  return resolved;
}

/** Tarif d'un modèle, par correspondance de préfixe la plus longue. */
export function getModelPricing(modelName: string): ModelPricing {
  const normalized = (modelName || '').toLowerCase();
  const table = { ...PRICING, ...getOverrides() };

  let best: { key: string; pricing: ModelPricing } | null = null;
  for (const [key, pricing] of Object.entries(table)) {
    if (!normalized.startsWith(key.toLowerCase())) continue;
    if (!best || key.length > best.key.length) best = { key, pricing };
  }

  const pricing = best?.pricing ?? DEFAULT_PRICING;

  return pricing;
}

/** Vrai si le modèle est inconnu de la table (le coût affiché est alors approximatif). */
export function isPricingEstimated(modelName: string): boolean {
  const normalized = (modelName || '').toLowerCase();
  const table = { ...PRICING, ...getOverrides() };
  return !Object.keys(table).some((key) => normalized.startsWith(key.toLowerCase()));
}

/** 6 décimales : un appel court coûte souvent moins d'un dix-millième de dollar. */
function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Coût ventilé entrée / sortie d'un appel. */
export interface CostBreakdown {
  /** Coût des tokens d'entrée (cache inclus, à son tarif réduit). */
  inputCostUsd: number;
  /** Coût des tokens de sortie. */
  outputCostUsd: number;
  /** Somme des deux. */
  totalCostUsd: number;
}

/**
 * Coût d'un appel, ventilé entrée / sortie.
 *
 * La ventilation est calculée et STOCKÉE ici plutôt que déduite plus tard des
 * totaux de tokens : les tarifs varient d'un modèle à l'autre (et le rapport
 * sortie/entrée va de 3× à 8×), donc un coût recalculé à partir de tokens
 * agrégés tous modèles confondus serait faux.
 *
 * Les tokens d'entrée servis depuis un cache sont facturés à leur tarif réduit
 * (s'il est renseigné) et déduits des tokens d'entrée pleins pour ne pas être
 * comptés deux fois.
 */
export function computeCost(params: {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): CostBreakdown {
  const pricing = getModelPricing(params.modelName);

  const cached = Math.max(params.cachedInputTokens ?? 0, 0);
  const billableInput = Math.max(params.inputTokens - cached, 0);
  const cachedRate = pricing.cachedInput ?? pricing.input;

  const inputCostUsd = round(
    (billableInput / 1_000_000) * pricing.input + (cached / 1_000_000) * cachedRate
  );
  const outputCostUsd = round((params.outputTokens / 1_000_000) * pricing.output);

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: round(inputCostUsd + outputCostUsd),
  };
}
