import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AiUsageOperation } from '../models/aiUsage.model';

/**
 * Contexte de consommation IA, propagé par AsyncLocalStorage — même idiome que
 * request-language.ts, trace.util.ts et revision-context.util.ts.
 *
 * Objectif : que `prompt.service.ts` sache, à l'instant de l'appel au modèle,
 * QUEL élément de QUEL projet il est en train de produire, sans avoir à faire
 * descendre 5 paramètres à travers la vingtaine de services de génération.
 *
 * Deux niveaux :
 *  1. le middleware déduit `feature` / `operation` / `source` de la route ;
 *  2. les services affinent (`element`, variantes, projectId) via
 *     `setAiUsageContext()` ou, mieux, `withAiUsage()` qui borne la portée.
 */

export interface AiUsageContext {
  userId?: string;
  projectId?: string;
  feature: string;
  element?: string;
  operation: AiUsageOperation;
  variantCount?: number;
  variantIndex?: number;
  batchId?: string;
  /** Route d'origine, ex. `POST /project/brandings/generate`. */
  source?: string;
}

const storage = new AsyncLocalStorage<AiUsageContext>();

export function runWithAiUsageContext<T>(context: AiUsageContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Contexte courant, ou `undefined` hors requête (tâche planifiée, script). */
export function getAiUsageContext(): AiUsageContext | undefined {
  return storage.getStore();
}

/**
 * Affine le contexte courant. Mute le store en place : l'effet dure jusqu'à la
 * fin de la requête. Pour une portée limitée à un bloc, préférer `withAiUsage`.
 */
export function setAiUsageContext(patch: Partial<AiUsageContext>): void {
  const store = storage.getStore();
  if (!store) return;
  Object.assign(store, patch);
}

/**
 * Exécute `fn` avec un contexte enrichi, sans polluer la suite de la requête.
 *
 * À utiliser dès qu'un service produit un élément identifiable :
 *
 *   return withAiUsage({ element: 'logo', operation: 'variant', variantCount: 4 },
 *     () => this.generateConcepts(project));
 */
export function withAiUsage<T>(patch: Partial<AiUsageContext>, fn: () => T): T {
  const current = storage.getStore();
  const next: AiUsageContext = {
    ...(current ?? { feature: 'unknown', operation: 'other' }),
    ...patch,
  };
  return storage.run(next, fn);
}

/**
 * Ouvre un lot de variantes : toutes les générations effectuées dans `fn`
 * partagent le même `batchId`, ce qui permet d'additionner plus tard le coût
 * réel d'un choix utilisateur (les 4 logos proposés, pas seulement le retenu).
 */
export function withVariantBatch<T>(
  patch: Partial<AiUsageContext> & { variantCount?: number },
  fn: (batchId: string) => T
): T {
  const batchId = randomUUID();
  return withAiUsage({ operation: 'variant', ...patch, batchId }, () => fn(batchId));
}

/**
 * Variante non bornée de `withVariantBatch`, pour être appelée en une ligne en
 * tête d'une méthode de service dont le corps est trop long pour être enveloppé.
 *
 * Mute le contexte de la requête courante : chaque requête HTTP ne servant
 * qu'un geste utilisateur, la portée reste correcte. Renvoie le `batchId` pour
 * les appelants qui veulent le journaliser.
 */
export function openAiUsageBatch(
  patch: Partial<AiUsageContext> & { variantCount?: number }
): string {
  const batchId = randomUUID();
  setAiUsageContext({ operation: 'variant', ...patch, batchId });
  return batchId;
}

// ============================================
// DÉDUCTION DEPUIS LA ROUTE
// ============================================

/**
 * Correspondance segment de route → fonctionnalité. Les clés sont alignées sur
 * `analysisResultModel` quand elles existent, pour pouvoir croiser le coût avec
 * le contenu réellement produit.
 */
const FEATURE_BY_SEGMENT: Record<string, string> = {
  brandings: 'branding',
  branding: 'branding',
  'business-card': 'branding',
  businesscard: 'branding',
  logo: 'branding',
  diagrams: 'design',
  diagram: 'design',
  businessplans: 'businessPlan',
  businessplan: 'businessPlan',
  landings: 'landing',
  landing: 'landing',
  developments: 'development',
  development: 'development',
  communication: 'communication',
  communications: 'communication',
  finance: 'finance',
  finances: 'finance',
  pitchdeck: 'pitchDeck',
  pitchdecks: 'pitchDeck',
  legaldocs: 'legalDocs',
  advisor: 'advisor',
  onboarding: 'onboarding',
  deployments: 'deployment',
  deployment: 'deployment',
  coherence: 'coherence',
  context: 'context',
  appgen: 'appgen',
  prompt: 'prompt',
  archetypes: 'archetype',
};

/** Mots de la route révélant la nature de l'opération. */
const OPERATION_PATTERNS: { pattern: RegExp; operation: AiUsageOperation }[] = [
  { pattern: /regenerat/i, operation: 'regenerate' },
  { pattern: /variation|concepts|variants/i, operation: 'variant' },
  { pattern: /ai-edit|edit|refine|autofill/i, operation: 'edit' },
  { pattern: /analys|interpret|mockup/i, operation: 'analysis' },
  { pattern: /chat|message|advisor/i, operation: 'chat' },
  { pattern: /appgen|handoff/i, operation: 'appgen' },
  { pattern: /generat/i, operation: 'generate' },
];

/** Déduit `feature` du chemin, en prenant le premier segment reconnu. */
export function deriveFeatureFromPath(path: string): string {
  for (const segment of path.split('/')) {
    const key = segment.toLowerCase();
    if (FEATURE_BY_SEGMENT[key]) return FEATURE_BY_SEGMENT[key];
  }
  return 'unknown';
}

/**
 * Déduit l'opération du chemin. L'ordre des motifs compte : `regenerate`
 * contient `generate`, il doit donc être testé d'abord.
 */
export function deriveOperationFromPath(path: string): AiUsageOperation {
  for (const { pattern, operation } of OPERATION_PATTERNS) {
    if (pattern.test(path)) return operation;
  }
  return 'other';
}

/**
 * Middleware d'amorçage. Monté au niveau application, il ne dispose pas encore
 * de `req.params` : `projectId` est donc lu dans le corps / la query, et les
 * services le complètent via `setAiUsageContext()` dès qu'ils l'ont résolu
 * (ils l'ont tous en main puisqu'ils chargent le projet).
 */
export function aiUsageContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = (req.originalUrl || req.url || '').split('?')[0];

  const projectId =
    (typeof req.body?.projectId === 'string' && req.body.projectId) ||
    (typeof req.query?.projectId === 'string' && req.query.projectId) ||
    undefined;

  runWithAiUsageContext(
    {
      projectId,
      feature: deriveFeatureFromPath(path),
      operation: deriveOperationFromPath(path),
      source: `${req.method} ${path}`,
    },
    () => next()
  );
}
