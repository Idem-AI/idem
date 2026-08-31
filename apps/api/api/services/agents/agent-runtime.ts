/**
 * AgentRuntime — le point de passage unique de TOUS les appels IA à rôle.
 *
 * Avant: chaque service réimplémentait son orchestration (l'advisor sa boucle
 * d'outils, la research team ses trois configs, GenericService son runPrompt),
 * si bien qu'un garde-fou ajouté à un endroit n'existait nulle part ailleurs.
 *
 * Ici, un agent est une DÉCLARATION (`AgentDefinition`) — un rôle, un étage de
 * modèle, éventuellement des outils, et un budget — que le runtime exécute avec,
 * pour tout le monde et une seule fois:
 *
 *   1. routage par étage       (model-router.ts, XS/M/S)
 *   2. contrôle de sortie      (`validate`, typiquement la quality gate)
 *   3. escalade BORNÉE         (un seul cran, seulement si le contrôle échoue)
 *   4. budget de run           (plafond de tokens estimés, partagé entre agents)
 *   5. repli sans outils       (si la boucle agentique casse, on répond quand même)
 *   6. traçabilité             (ai-trace + ventilation du coût par élément)
 *
 * Le budget est volontairement une ESTIMATION (≈ 4 caractères/token) calculée
 * côté runtime: elle sert de coupe-circuit sur un run qui dérape, pas de source
 * de facturation — la facturation reste `aiUsageService`, alimenté par les
 * compteurs réels du fournisseur.
 */

import { FunctionDeclaration } from '@google/genai';
import logger from '../../config/logger';
import { FeatureAIConfig, LLMOptions } from '../../config/ai.config';
import {
  ModelTier,
  TaskKind,
  nextTier,
  tierConfig,
  tierForTask,
  tierOfModel,
} from '../../config/model-router';
import { AIChatMessage, PromptConfig, promptService } from '../prompt.service';
import { logAIEvent } from '../../utils/ai-trace.util';
import { withAiUsage } from '../../utils/ai-usage-context.util';
import { BudgetExhaustedError, RunBudget, estimateTokens } from './run-budget';

// Réexport de commodité: les appelants d'agents n'ont qu'un module à importer.
export { RunBudget, BudgetExhaustedError, createRunBudget, estimateTokens } from './run-budget';

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** Verdict d'un contrôle de sortie. `reason` est réinjecté lors d'une escalade. */
export interface AgentValidation {
  ok: boolean;
  reason?: string;
}

export interface AgentDefinition {
  /** Rôle lisible, journalisé tel quel: 'section-writer', 'digest', 'verifier'… */
  role: string;
  /** Nature de la tâche → détermine l'étage de départ. */
  task: TaskKind;
  /** Force un étage précis, court-circuitant `task`. */
  tier?: ModelTier;
  /**
   * Modèle imposé par la feature appelante (ex: le business plan tourne sur un
   * modèle « pro » par choix produit assumé). Quand il est fourni, c'est LUI qui
   * sert au premier essai : le routeur ne redescend jamais une décision prise
   * explicitement en configuration. L'étage n'est alors utilisé que pour savoir
   * d'où escalader si le contrôle de sortie échoue.
   */
  baseConfig?: Pick<FeatureAIConfig, 'provider' | 'modelName' | 'fallbackModels' | 'llmOptions'>;
  systemPrompt?: string;
  /** Réglages fins (budget de tokens d'une section lourde, température). */
  llmOptions?: LLMOptions;
  /** Étiquette de suivi côté quotas/restrictions. */
  promptType?: string;
  tools?: FunctionDeclaration[];
  toolExecutor?: ToolExecutor;
  /** Tours d'outils maximum. Au-delà, réponse finale forcée. */
  maxToolTurns?: number;
  /**
   * Contrôle de la sortie. C'est LUI qui déclenche l'escalade: sans contrôle,
   * un agent ne réessaie jamais (on ne paie pas deux fois pour rien).
   */
  validate?: (text: string) => AgentValidation;
  /** Autorise un cran d'escalade si `validate` échoue (défaut: true si validate). */
  escalate?: boolean;
  /**
   * Si la boucle d'outils échoue (fournisseur sans function-calling, erreur
   * réseau), rejouer sans outils plutôt que de perdre la génération.
   */
  fallbackWithoutTools?: boolean;
}

export interface AgentRunInput {
  messages: AIChatMessage[];
  userId?: string;
  projectId?: string;
  /** Élément produit — ventile le coût dans le panel admin (ex: 'Financial Plan'). */
  element?: string;
  /** Budget partagé par tous les agents d'un même livrable. */
  budget?: RunBudget;
  language?: string;
  /** Nom d'un cache de contexte Gemini réutilisé entre appels d'un même run. */
  cachedContent?: string;
  /** Fichier joint à l'appel (analyse de logo, de maquette…). */
  file?: PromptConfig['file'];
  /** Fichiers de contexte additionnels transmis au fournisseur. */
  contextFilePaths?: string[];
  skipQuotaCheck?: boolean;
  /** Exempte cet agent du plafond global de tokens de sortie. */
  bypassOutputTokenCap?: boolean;
}

export interface AgentRunResult {
  text: string;
  /** Étage réellement utilisé pour la sortie retenue. */
  tier: ModelTier;
  escalated: boolean;
  attempts: number;
  durationMs: number;
  /** Verdict du dernier contrôle (absent si l'agent n'en déclare pas). */
  validation?: AgentValidation;
  /** Tokens estimés consommés par l'ensemble des tentatives. */
  estimatedTokens: number;
}

/**
 * Exécute un agent. Une seule tentative par étage, une escalade au maximum.
 */
export async function runAgent(
  agent: AgentDefinition,
  input: AgentRunInput
): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const startTier =
    agent.tier ??
    (agent.baseConfig ? tierOfModel(agent.baseConfig.modelName) : tierForTask(agent.task));
  const canEscalate = agent.escalate ?? Boolean(agent.validate);

  if (input.budget?.exhausted) {
    throw new BudgetExhaustedError(input.budget.label);
  }

  const messages: AIChatMessage[] = agent.systemPrompt
    ? [{ role: 'system', content: agent.systemPrompt }, ...input.messages]
    : input.messages;

  const promptTokens = estimateTokens(messages.map((m) => m.content).join('\n'));

  logAIEvent('agent.start', {
    role: agent.role,
    task: agent.task,
    tier: startTier,
    projectId: input.projectId,
    element: input.element,
    toolCount: agent.tools?.length ?? 0,
    promptTokens,
  });

  let tier: ModelTier = startTier;
  let attempts = 0;
  let estimated = 0;
  let text = '';
  let validation: AgentValidation | undefined;

  // Boucle d'escalade: 2 itérations au grand maximum (étage de départ + 1 cran).
  for (;;) {
    attempts += 1;
    const config = buildPromptConfig(agent, tier, input, tier !== startTier);

    text = await withAiUsage(
      {
        userId: input.userId,
        projectId: input.projectId,
        element: input.element,
      },
      () => callModel(agent, config, messages)
    );

    const turnTokens = promptTokens + estimateTokens(text);
    estimated += turnTokens;
    input.budget?.consume(turnTokens);

    validation = agent.validate ? agent.validate(text) : undefined;
    if (!validation || validation.ok) break;

    const upper = canEscalate ? nextTier(tier) : undefined;
    if (!upper || input.budget?.exhausted) {
      logAIEvent('agent.validation_failed', {
        role: agent.role,
        tier,
        reason: validation.reason,
        escalationAvailable: Boolean(upper),
        budgetExhausted: Boolean(input.budget?.exhausted),
      });
      break;
    }

    logger.info(
      `Agent "${agent.role}": contrôle échoué au tier ${tier} (${validation.reason}) → escalade vers ${upper}`
    );
    logAIEvent('agent.escalation', {
      role: agent.role,
      from: tier,
      to: upper,
      reason: validation.reason,
      projectId: input.projectId,
      element: input.element,
    });
    tier = upper;
  }

  const durationMs = Date.now() - startedAt;
  logAIEvent('agent.end', {
    role: agent.role,
    tier,
    attempts,
    escalated: tier !== startTier,
    ok: validation?.ok ?? true,
    outputLength: text.length,
    estimatedTokens: estimated,
    durationMs,
  });

  return {
    text,
    tier,
    escalated: tier !== startTier,
    attempts,
    durationMs,
    validation,
    estimatedTokens: estimated,
  };
}

/** Variante commodité: un agent qui prend un simple prompt utilisateur. */
export async function runAgentPrompt(
  agent: AgentDefinition,
  prompt: string,
  input: Omit<AgentRunInput, 'messages'> = {}
): Promise<AgentRunResult> {
  return runAgent(agent, { ...input, messages: [{ role: 'user', content: prompt }] });
}

function buildPromptConfig(
  agent: AgentDefinition,
  tier: ModelTier,
  input: AgentRunInput,
  escalated: boolean
): PromptConfig {
  // Premier essai avec un modèle imposé : on respecte la configuration métier.
  // Après escalade, c'est le routeur qui décide du modèle, mais les réglages
  // fins de la section (budget de tokens, température) restent ceux d'origine.
  const resolved =
    agent.baseConfig && !escalated
      ? {
          provider: agent.baseConfig.provider,
          modelName: agent.baseConfig.modelName,
          fallbackModels: agent.baseConfig.fallbackModels,
          llmOptions: { ...agent.baseConfig.llmOptions, ...agent.llmOptions },
        }
      : tierConfig(tier, {
          llmOptions: { ...agent.baseConfig?.llmOptions, ...agent.llmOptions },
          promptType: agent.promptType,
        });

  return {
    provider: resolved.provider,
    modelName: resolved.modelName,
    fallbackModels: resolved.fallbackModels,
    llmOptions: resolved.llmOptions,
    promptType: agent.promptType ?? agent.role,
    userId: input.userId,
    language: input.language,
    cachedContent: input.cachedContent,
    file: input.file,
    contextFilePaths: input.contextFilePaths,
    skipQuotaCheck: input.skipQuotaCheck,
    bypassOutputTokenCap: input.bypassOutputTokenCap,
  };
}

async function callModel(
  agent: AgentDefinition,
  config: PromptConfig,
  messages: AIChatMessage[]
): Promise<string> {
  const hasTools = Boolean(agent.tools?.length && agent.toolExecutor);

  if (hasTools) {
    try {
      const raw = await promptService.runPromptWithTools(
        config,
        messages,
        agent.tools!,
        agent.toolExecutor!,
        { maxToolTurns: agent.maxToolTurns ?? 6 }
      );
      return promptService.getCleanAIText(raw);
    } catch (error: any) {
      if (agent.fallbackWithoutTools === false) throw error;
      logger.warn(
        `Agent "${agent.role}": boucle d'outils en échec (${error?.message}) → repli sans outils`
      );
      logAIEvent('agent.tool_loop_fallback', { role: agent.role, reason: error?.message });
    }
  }

  const raw = await promptService.runPrompt(config, messages);
  return promptService.getCleanAIText(raw);
}
