/**
 * Tarifs des modèles, en USD par MILLION de tokens.
 *
 * Sert uniquement à estimer un coût pour l'observabilité (dashboard admin,
 * plafonds de dépense) — ce n'est pas une source de facturation. Les tarifs
 * réels des fournisseurs évoluent : `AI_PRICING_OVERRIDES` (JSON en variable
 * d'env) permet de les corriger sans redéploiement de code.
 *
 * La résolution se fait par préfixe le plus long, pour qu'un nouveau
 * `gemini-3-flash-preview-0842` hérite du tarif `gemini-3-flash` au lieu de
 * retomber silencieusement sur le tarif par défaut.
 */

export interface ModelPricing {
  /** USD par million de tokens d'entrée. */
  input: number;
  /** USD par million de tokens de sortie. */
  output: number;
  /** USD par million de tokens d'entrée servis depuis le cache de contexte. */
  cachedInput?: number;
}

const PRICING: Record<string, ModelPricing> = {
  // --- Google Gemini ---
  'gemini-3.1-pro': { input: 2.5, output: 15, cachedInput: 0.625 },
  'gemini-3-pro': { input: 2.5, output: 15, cachedInput: 0.625 },
  'gemini-3.5-flash': { input: 0.3, output: 2.5, cachedInput: 0.075 },
  'gemini-3-flash': { input: 0.3, output: 2.5, cachedInput: 0.075 },
  'gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.31 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cachedInput: 0.075 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cachedInput: 0.025 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  gemini: { input: 0.3, output: 2.5 },

  // --- OpenAI ---
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // --- DeepSeek ---
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'deepseek-chat': { input: 0.27, output: 1.1 },

  // --- Z.ai / GLM ---
  // GLM (Z.ai) — tarifs relevés sur docs.z.ai, août 2026, en $/M tokens.
  'glm-5.3': { input: 1.4, output: 4.4 },
  'glm-5.2': { input: 1.4, output: 4.4 },
  'glm-5.1': { input: 1.4, output: 4.4 },
  'glm-5.3-flash': { input: 0.075, output: 0.25 },
  'glm-5': { input: 1, output: 3.2 },
  'glm-4.7': { input: 0.6, output: 2.2 },
  'glm-4.7-flashx': { input: 0.07, output: 0.4 },
  'glm-4.7-flash': { input: 0, output: 0 },
  'glm-4.6': { input: 0.6, output: 2.2 },
  'glm-4.5': { input: 0.6, output: 2.2 },
  'glm-4.5-air': { input: 0.2, output: 1.1 },
  'glm-4.5-flash': { input: 0, output: 0 },
  'glm-4': { input: 0.6, output: 2.2 },
  // Vision et OCR.
  'glm-4.6v': { input: 0.3, output: 0.9 },
  'glm-4.6v-flashx': { input: 0.04, output: 0.4 },
  'glm-4.6v-flash': { input: 0, output: 0 },
  'glm-4.5v': { input: 0.6, output: 1.8 },
  'glm-ocr': { input: 0.03, output: 0.03 },
  'glm-image': { input: 0, output: 0 },
  'cogview-4-250304': { input: 0, output: 0 },
  glm: { input: 0.6, output: 2.2 },
};

/** Tarif appliqué à un modèle inconnu — volontairement non nul pour rester visible. */
const DEFAULT_PRICING: ModelPricing = { input: 0.5, output: 2 };

let overrides: Record<string, ModelPricing> | null = null;

/**
 * Surcharges via `AI_PRICING_OVERRIDES`, ex :
 * `{"gemini-3-flash":{"input":0.25,"output":2}}`
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

  return best?.pricing ?? DEFAULT_PRICING;
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
 * Les tokens d'entrée servis depuis le cache de contexte Gemini sont facturés à
 * leur tarif réduit et déduits des tokens d'entrée pleins pour ne pas être
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

/** Coût total d'un appel (raccourci sur `computeCost`). */
export function computeCostUsd(params: {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): number {
  return computeCost(params).totalCostUsd;
}
