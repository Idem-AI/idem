import os from 'os';
import path from 'path';
import { realpathSync } from 'fs';
import { FunctionDeclaration } from '../types/ai-tools';
import dotenv from 'dotenv';
import * as fs from 'fs-extra';
import logger from '../config/logger';
import restrictionsService from './restrictions.service';
import OpenAI from 'openai';
import { userService } from './user.service';
dotenv.config();

import {
  LLMProvider,
  LLMOptions,
  AI_CONFIG,
  MAX_TEMPERATURE_FOR_THINKING,
  MIN_TOKENS_FOR_THINKING,
  reconcileThinkingBudget,
} from '../config/ai.config';
import {
  canSuppressThinking,
  getProvider,
  providerSupports,
  resolveGlobalOverride,
  translateReasoning,
} from '../config/ai-providers.config';
import { applyAiOverride } from '../config/ai-overrides.config';
import {
  describeError,
  isRateLimited,
  isTransientNetworkError,
  sleep,
  withRetry,
} from '../utils/retry';
import { getRequestLanguage } from '../utils/request-language';
import { logAIEvent, previewValue } from '../utils/ai-trace.util';
import {
  UsageSink,
  estimateUsage,
  extractOpenAIUsage,
  joinMessagesForEstimate,
} from '../utils/ai-usage-extract.util';
import { aiUsageService } from './ai-usage.service';
export { LLMProvider, LLMOptions };

/**
 * Pause entre deux modèles de la chaîne de repli, quand l'échec précédent était
 * une panne réseau. Basculer de modèle ne répare pas une connexion absente: il
 * faut aussi laisser passer quelques instants.
 */
const INTER_MODEL_DELAY_MS = 1000;

/**
 * Attente avant le repli suivant quand le QUOTA est saturé, multipliée par le
 * rang du repli. Volontairement plus longue que le délai réseau : une fenêtre
 * de quota se rouvre à la minute, pas à la seconde.
 */
const RATE_LIMIT_DELAY_MS = Number(process.env.LLM_RATE_LIMIT_DELAY_MS ?? 4000);

/**
 * Résout le couple (fournisseur, modèle) réellement appelé.
 *
 * Trois niveaux, du plus général au plus précis, et le plus précis l'emporte :
 *   1. ce que la feature déclare      (`ai.config.ts`, un rôle)
 *   2. le choix des modèles à chaud   (`platform_settings/ai`, traduit par RÔLE)
 *   3. `AI_OVERRIDES`                 — surcharge ciblée, par `promptType`
 *
 * Regroupé ici pour que les quatre points d'entrée du service (prompt, outils,
 * flux, recherche fondée) appliquent exactement la même règle. Une divergence
 * entre eux se manifesterait par une génération qui part sur un modèle
 * différent des autres, sans que rien ne le dise.
 */
function resolveRouting<T extends PromptConfig>(request: T): T {
  const switched = resolveGlobalOverride(request);
  const { config, applied } = applyAiOverride(switched, request.promptType);

  if (applied) {
    logger.info(`Aiguillage: surcharge "${applied}" (promptType=${request.promptType ?? '—'})`);
  } else if (switched.provider !== request.provider || switched.modelName !== request.modelName) {
    logger.info(
      `Aiguillage: bascule globale ${request.provider}/${request.modelName} → ` +
        `${switched.provider}/${switched.modelName}`
    );
  }

  return config as T;
}

/**
 * Le mode JSON doit-il être demandé au fournisseur pour cet appel ?
 *
 * Deux garde-fous, tous deux nécessaires :
 *
 *  - `LLM_JSON_MODE=off` coupe la fonctionnalité entière sans redéploiement.
 *    Le contrat `response_format` est standard côté OpenAI mais son support
 *    varie d'un modèle à l'autre chez les passerelles compatibles ; un
 *    interrupteur évite d'avoir à repasser sur quarante configurations si un
 *    modèle le refuse.
 *
 *  - le mot « json » doit apparaître dans le prompt. C'est une exigence de
 *    l'API OpenAI (« messages must contain the word 'json' »), reprise par la
 *    plupart des implémentations compatibles : sans elle, la requête est
 *    rejetée. Comme tous nos prompts JSON le mentionnent déjà, la condition est
 *    silencieuse en pratique — mais elle empêche une feature mal étiquetée de
 *    faire échouer sa génération.
 */
function jsonModeFor(
  llmOptions: LLMOptions,
  messages: { content?: unknown }[]
): boolean {
  if (!llmOptions.jsonMode) return false;
  if ((process.env.LLM_JSON_MODE ?? '').toLowerCase() === 'off') return false;
  return messages.some(
    (message) => typeof message.content === 'string' && /json/i.test(message.content)
  );
}

/**
 * Incrémente le quota SANS bloquer la réponse.
 *
 * C'est un compteur, pas une transaction: l'appel modèle a déjà réussi et son
 * résultat est prêt à partir. L'attendre ajoutait une écriture base au chemin
 * critique de chaque génération — sept fois dans ce fichier — pour une valeur
 * que personne ne relit dans la milliseconde. L'échec reste journalisé.
 */
function incrementUsageInBackground(userId: string): void {
  void userService
    .incrementUsage(userId, 1)
    .catch((quotaError) =>
      logger.error(`Failed to increment quota for user ${userId}:`, quotaError)
    );
}

/**
 * Refuse tout chemin hors du répertoire temporaire du système.
 * `realpath` suit les liens symboliques, qui sinon contourneraient la règle.
 */
function assertTemporaryFilePath(localPath: string): void {
  const tmpRoot = realpathSync(os.tmpdir());
  let resolved: string;
  try {
    resolved = realpathSync(path.resolve(localPath));
  } catch {
    throw new Error('Attached file not found.');
  }
  if (resolved !== tmpRoot && !resolved.startsWith(tmpRoot + path.sep)) {
    logger.error('Refused attached file outside the temporary directory', { localPath });
    throw new Error('Attached file path is not allowed.');
  }
}

export interface PromptConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
  fallbackModels?: string[];
  /**
   * User UI language ('en' | 'fr'). When set, a language directive is injected so
   * the model generates content in the requested language. Resolved from the
   * request (query `lang` / body `language` / Accept-Language header) upstream.
   */
  language?: string;
  /** Exempte cet appel du plafond global MAX_OUTPUT_TOKENS. */
  bypassOutputTokenCap?: boolean;
  /**
   * Modèle épinglé (cf. `FeatureAIConfig.pinModel`). Lu par les générations
   * par sections : sans lui, une feature épinglée appelée hors `step.aiConfig`
   * (le logo) perdait son épinglage et partait à l'étage de sa tâche.
   */
  pinModel?: boolean;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PromptRequest {
  provider: LLMProvider;
  modelName: string;
  messages: AIChatMessage[];
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
  fallbackModels?: string[];
  language?: string;
  /** Exempte cet appel du plafond global MAX_OUTPUT_TOKENS. */
  bypassOutputTokenCap?: boolean;
}

/** Une source brute issue de la recherche web (URL toujours réelle). */
export interface GroundedSourceRaw {
  /** Rang de la source — sert d'ancre pour les supports. */
  index: number;
  title: string;
  url: string;
  domain?: string;
}

/** Segment de texte appuyé par une ou plusieurs sources (citation inline). */
export interface GroundedSupport {
  text: string;
  sourceIndexes: number[];
}

/** Résultat d'un appel fondé (recherche web du fournisseur). */
export interface GroundedResult {
  /** Texte produit par le modèle, appuyé sur les résultats de recherche. */
  text: string;
  /** Requêtes réellement exécutées par le moteur de recherche. */
  queries: string[];
  /** Sources réelles retournées par le grounding. */
  sources: GroundedSourceRaw[];
  /** Association segments de texte → sources (pour matérialiser les citations). */
  supports: GroundedSupport[];
}

export class PromptService {
  /** Clients OpenAI-compatible mis en cache par fournisseur. */
  private _openaiClients = new Map<LLMProvider, OpenAI>();

  constructor() {
    logger.info('Initializing PromptService...');
  }

  /**
   * Client OpenAI-compatible pour un fournisseur donné (OpenRouter, ou un futur
   * serveur maison derrière `OPENROUTER_BASE_URL`). La clé, l'URL de base et les en-têtes proviennent du
   * registre `AI_PROVIDERS`. Les clients sont mis en cache par fournisseur.
   */
  private getOpenAICompatibleClient(provider: LLMProvider): OpenAI {
    const cached = this._openaiClients.get(provider);
    if (cached) {
      return cached;
    }

    const def = getProvider(provider);
    const apiKey = process.env[def.apiKeyEnv];
    if (!apiKey) {
      const message = `${def.apiKeyEnv} is not set — cannot use provider ${provider}.`;
      logger.error(message);
      throw new Error(message);
    }

    const client = new OpenAI({
      apiKey,
      ...(def.baseUrl ? { baseURL: def.baseUrl } : {}),
      ...(def.defaultHeaders ? { defaultHeaders: def.defaultHeaders } : {}),
      // Le réessai est géré UNE seule fois, par `withRetry`, qui sait distinguer
      // le transitoire réseau (à rejouer) de la saturation (à basculer de
      // modèle). Le défaut du SDK (2 réessais) s'empilait par-dessus, et
      // par-dessus la chaîne de repli : jusqu'à 3 modèles × 3 tentatives × 3
      // réessais SDK = 27 appels fournisseur pour une seule génération, tous
      // facturés dès qu'ils atteignaient le modèle.
      maxRetries: 0,
      // Le défaut du SDK est de 10 MINUTES. Une génération bloquée retenait donc
      // son créneau de concurrence dix minutes avant de basculer. 180 s couvrent
      // largement la plus lourde des générations (48 000 tokens de sortie).
      timeout: Number(process.env.LLM_TIMEOUT_MS ?? 180_000),
    });
    this._openaiClients.set(provider, client);
    logger.info(
      `OpenAI-compatible client initialized for provider=${provider} (baseURL=${def.baseUrl ?? 'default'}).`
    );
    return client;
  }

  /**
   * Convertit un schéma d'outil (`type` en MAJUSCULES, cf. `types/ai-tools.ts`)
   * en JSON Schema OpenAI (`type` en minuscules). Récursif sur
   * `properties` et `items` ; conserve `enum`/`description`/`required`.
   */
  private schemaToJsonSchema(schema: any): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {};
    }
    const out: Record<string, unknown> = {};
    if (schema.type) out.type = String(schema.type).toLowerCase();
    if (schema.description) out.description = schema.description;
    if (Array.isArray(schema.enum)) out.enum = schema.enum;
    if (schema.properties && typeof schema.properties === 'object') {
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        props[key] = this.schemaToJsonSchema(value);
      }
      out.properties = props;
    }
    if (Array.isArray(schema.required)) out.required = schema.required;
    if (schema.items) out.items = this.schemaToJsonSchema(schema.items);
    return out;
  }

  /** Traduit des déclarations d'outils en `tools` OpenAI (function-calling). */
  private toOpenAITools(
    tools: FunctionDeclaration[]
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name ?? '',
        ...(t.description ? { description: t.description } : {}),
        parameters: this.schemaToJsonSchema(
          t.parameters ?? { type: 'OBJECT', properties: {} }
        ),
      },
    }));
  }

  /**
   * Détecte une enveloppe d'erreur renvoyée en HTTP 200 par un gateway
   * openai-compatible (`{code, msg, success:false}`) et lève une
   * erreur lisible. Sans quoi le SDK OpenAI présente un objet sans `choices` et
   * on perd la cause réelle (mauvaise URL, solde insuffisant, modèle inconnu…).
   */
  private assertNoErrorEnvelope(provider: LLMProvider, response: any): void {
    if (
      response &&
      typeof response === 'object' &&
      !Array.isArray(response.choices) &&
      (response.success === false || response.code !== undefined || response.msg)
    ) {
      const detail = response.msg || response.error || JSON.stringify(response).slice(0, 300);
      logger.error(`${provider} API error envelope (HTTP 200): ${JSON.stringify(response).slice(0, 500)}`);
      throw new Error(`${provider} API error: ${detail}`);
    }
  }

  /**
   * Adaptateur du fournisseur `openai-compatible` du registre (OpenRouter, ou un
   * futur serveur maison) : clé, URL, en-têtes et modèle de repli sont portés par
   * `AI_PROVIDERS`.
   */
  private async _runOpenAICompatiblePrompt(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string },
    /** Collecteur des compteurs de tokens réels. */
    usageSink?: UsageSink
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);

    try {
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

      const generationParams = {
        ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
        ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // Pas de topK dans l'API OpenAI.
        ...(jsonModeFor(llmOptions, openaiMessages)
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      };

      // Le SDK n'upload pas de fichier ici : on injecte son contenu comme contexte
      // système (comportement historique).
      if (fileInput && fileInput.localPath) {
        logger.info(`Processing file input for ${provider}: ${fileInput.localPath}`);
        try {
          const fileContent = await fs.readFile(fileInput.localPath, 'utf-8');
          openaiMessages.unshift({
            role: 'system',
            content: `File content for context: ${fileContent}`,
          });
        } catch (fileError) {
          logger.error(`Error reading file for ${provider}: ${fileInput.localPath}`, fileError);
          throw new Error(
            `Failed to read file for ${provider}: ${(fileError as Error).message || fileError}`
          );
        }
      }

      const thinkingRequested =
        ((llmOptions.extraBody as any) ?? (def.extraBody as any))?.thinking?.type === 'enabled';

      const doCreate = (model: string, forceNoThinking = false) =>
        client.chat.completions.create(
          // Les features disent `thinking` ; il est traduit ici en `reasoning`
          // (OpenRouter).
          translateReasoning({
            model,
            messages: openaiMessages,
            ...generationParams,
            // Défaut du provider, puis surcharge éventuelle par-feature (ex: réactiver
            // le raisonnement sur la génération de logo). La feature l'emporte.
            ...(def.extraBody ?? {}),
            ...(llmOptions.extraBody ?? {}),
            ...(forceNoThinking ? { thinking: { type: 'disabled' } } : {}),
            // Un modèle qui raisonne TOUJOURS refuse la coupure par un HTTP 400.
            // Quelle qu'en soit la source — défaut du fournisseur, chemin par
            // gabarit, filet de budget — elle ne part donc jamais vers lui.
            ...(canSuppressThinking(model) ? {} : { thinking: { type: 'enabled' } }),
          }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
        );

      /** Réponse vide alors que le budget a été épuisé — signature du raisonnement qui déborde. */
      const starvedByThinking = (candidate: any): boolean =>
        !candidate?.choices?.[0]?.message?.content &&
        candidate?.choices?.[0]?.finish_reason === 'length';

      // Le repli entre modèles est celui de `runPrompt` (chaîne de repli du fournisseur).
      const usedModel = modelName;
      let response = await doCreate(modelName);

      // Auto-réparation : le modèle a raisonné jusqu'à épuiser l'enveloppe et n'a
      // rien écrit. Changer de MODÈLE ne sert à rien — le repli hérite du même
      // réglage et échoue à l'identique, ce qu'on a observé en production. Ce
      // qu'il faut retirer, c'est le raisonnement, sur le même modèle.
      //
      // Le cas survient même avec un budget confortable : sur un modèle
      // « thinking », une température haute rend la réflexion elle-même diffuse,
      // et elle consomme 24 000 tokens sans converger. Le budget minimal ne
      // suffit donc pas à s'en prémunir, il faut ce rattrapage.
      // Sans objet sur un modèle qui ne sait pas couper son raisonnement : la
      // nouvelle tentative serait refusée, et le repli de `runPrompt` prend le relais.
      if (thinkingRequested && starvedByThinking(response) && canSuppressThinking(usedModel)) {
        logger.warn(
          `${provider}/${usedModel} : raisonnement épuisé sans réponse (finish_reason=length). ` +
            `Nouvelle tentative sur le même modèle, raisonnement désactivé.`
        );
        response = await doCreate(usedModel, true);
      }

      // Relevé de consommation avant les contrôles de validité : une enveloppe
      // d'erreur ou une réponse vide a tout de même été facturée.
      if (usageSink) {
        usageSink.usage = extractOpenAIUsage(response);
        usageSink.modelUsed = (response as any)?.model || modelName;
      }

      // Certains gateways openai-compatible renvoient un HTTP 200
      // dont le corps est en réalité une enveloppe d'erreur ({code, msg, success:
      // false}) SANS `choices`. On la détecte pour remonter un message exploitable
      // au lieu d'un opaque "no choices".
      this.assertNoErrorEnvelope(provider, response);

      if (!response.choices || response.choices.length === 0) {
        const raw = JSON.stringify(response).slice(0, 500);
        logger.error(`${provider} API returned no choices. Raw response: ${raw}`);
        throw new Error(`${provider} API returned no choices. Raw: ${raw}`);
      }

      const textContent = response.choices[0].message.content;
      if (!textContent) {
        // finish_reason='length' ⇒ budget épuisé (souvent par le raisonnement d'un
        // modèle "thinking"): augmenter maxOutputTokens ou désactiver le thinking.
        const finishReason = response.choices[0].finish_reason;
        logger.error(
          `${provider} API returned empty text content (finish_reason=${finishReason}).`
        );
        throw new Error(
          `${provider} API returned empty text content (finish_reason=${finishReason})`
        );
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with ${provider} API: ${(error as Error).message || error}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Boucle agentique (function-calling) pour un fournisseur `openai-compatible`
   * qui supporte les outils. Miroir de la boucle
   * runPromptWithTools, au format OpenAI (`tool_calls` / messages `role:'tool'`).
   */
  private async _runOpenAICompatibleTools(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    tools: FunctionDeclaration[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    maxToolTurns: number
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);
    const openaiTools = this.toOpenAITools(tools);

    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(
      (msg) => ({ role: msg.role, content: msg.content })
    ) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
    };

    let finalText = '';
    for (let turn = 0; turn <= maxToolTurns; turn++) {
      const forceFinal = turn === maxToolTurns;
      const response = await client.chat.completions.create(
        translateReasoning({
          model: modelName,
          messages: conversation,
          ...generationParams,
          ...(def.extraBody ?? {}),
          ...(llmOptions.extraBody ?? {}),
          // Même garde qu'au chemin principal : pas de coupure vers un modèle qui
          // raisonne toujours (HTTP 400).
          ...(canSuppressThinking(modelName) ? {} : { thinking: { type: 'enabled' } }),
          tools: openaiTools,
          tool_choice: forceFinal ? 'none' : 'auto',
        }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
      );

      this.assertNoErrorEnvelope(provider, response);
      const choice = response.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls ?? [];

      if (!choice || toolCalls.length === 0 || forceFinal) {
        finalText = choice?.content ?? '';
        logAIEvent('ai.agentic_turn', {
          turn: turn + 1,
          decision: forceFinal && toolCalls.length > 0 ? 'max_turns_forced' : 'final_answer',
          finalTextLength: finalText.length,
        });
        break;
      }

      // Rejoue le tour: message assistant avec ses tool_calls, puis une réponse
      // par outil.
      conversation.push(choice);
      logAIEvent('ai.agentic_turn', {
        turn: turn + 1,
        decision: 'tool_calls',
        tools: toolCalls.map((c) => ({
          name: c.function?.name,
          args: previewValue(c.function?.arguments),
        })),
      });

      for (const call of toolCalls) {
        const toolName = call.function?.name ?? '';
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          parsedArgs = {};
        }
        let output: unknown;
        try {
          output = await executeTool(toolName, parsedArgs);
        } catch (error: any) {
          output = { error: error.message || String(error) };
        }
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output ?? null),
        });
      }
    }

    return finalText;
  }

  /**
   * Streaming pour un fournisseur `openai-compatible` : diffuse le texte
   * cumulé via `onDelta` et renvoie le texte complet.
   */
  private async _streamOpenAICompatible(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    onDelta: (cumulativeText: string) => void
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);
    const openaiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
      // LE MODE JSON VAUT AUSSI EN FLUX. Il ne passait que par l'appel
      // non-streamé : un `jsonMode: true` était donc accepté sans effet dès
      // que l'appelant voulait un aperçu pendant la rédaction. C'est le cas du
      // rédacteur de l'équipe de recherche — la seule garantie de format de
      // ses sections tombait précisément là où le contenu est le plus long.
      ...(jsonModeFor(llmOptions, openaiMessages)
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    };

    const stream = await client.chat.completions.create(
      translateReasoning({
        model: modelName,
        messages: openaiMessages,
        ...generationParams,
        ...(def.extraBody ?? {}),
        ...(llmOptions.extraBody ?? {}),
        // Même garde qu'au chemin principal : pas de coupure vers un modèle qui
        // raisonne toujours (HTTP 400).
        ...(canSuppressThinking(modelName) ? {} : { thinking: { type: 'enabled' } }),
        stream: true,
      }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
    );

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(full);
      }
    }
    return full;
  }

  /**
   * Build a strong directive that forces the model to answer in the user's language.
   * Returns an empty string when no (or an unknown) language is provided, leaving
   * existing behavior unchanged.
   */
  private buildLanguageDirective(language?: string): string {
    if (!language) {
      return '';
    }
    const normalized = language.toLowerCase();
    const label = normalized.startsWith('fr')
      ? 'French (Français)'
      : normalized.startsWith('en')
        ? 'English'
        : null;
    if (!label) {
      return '';
    }
    return `RESPONSE LANGUAGE (CRITICAL): You MUST write ALL generated content — every section, title, sentence, label and value — in ${label}. Do not mix languages. This instruction overrides any language implied by the examples or prompts below.`;
  }

  /**
   * Journalise la consommation de chaque tentative de modèle d'un appel.
   *
   * Deux règles :
   *  - une tentative sans métadonnées d'usage est estimée par longueur de texte
   *    plutôt qu'ignorée (une consommation invisible fausse tous les totaux) ;
   *  - toute erreur d'écriture est avalée par `aiUsageService.record` :
   *    l'observabilité ne doit jamais faire échouer une génération.
   */
  private async recordUsageAttempts(params: {
    attempts: { model: string; sink: UsageSink; startedAt: number; error?: any }[];
    provider: LLMProvider;
    promptType?: string;
    userId?: string;
    messages: AIChatMessage[];
    resultText?: string;
    error?: any;
  }): Promise<void> {
    const { attempts, provider, promptType, userId, messages, resultText, error } = params;
    if (attempts.length === 0) return;

    const promptText = joinMessagesForEstimate(messages);

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const isLast = i === attempts.length - 1;
      // Seule la dernière tentative peut avoir produit le résultat final ; les
      // précédentes ont nécessairement échoué (la boucle sort au succès).
      const succeeded = isLast && !error && resultText !== undefined;

      // Une tentative refusée par un 429 n'a jamais été traitée : le
      // fournisseur ne la facture pas, l'estimer gonflerait les coûts.
      const rejectedByQuota = !attempt.sink.usage && isRateLimited(attempt.error);
      const usage =
        attempt.sink.usage ??
        (rejectedByQuota
          ? { inputTokens: 0, outputTokens: 0, estimated: true }
          : estimateUsage(promptText, succeeded ? (resultText ?? '') : ''));

      await aiUsageService.record({
        provider,
        modelName: attempt.sink.modelUsed ?? attempt.model,
        usage,
        status: succeeded ? 'success' : 'error',
        errorMessage: succeeded
          ? undefined
          : ((attempt.error ?? error)?.message ?? 'Model attempt failed'),
        durationMs: Date.now() - attempt.startedAt,
        promptType,
        userId,
      });
    }
  }

  public async runPrompt(request: PromptConfig, messages: AIChatMessage[]): Promise<string> {
    logger.info(
      `Running prompt for provider: ${request.provider}, model: ${
        request.modelName
      }, file attached: ${!!request.file}, userId: ${request.userId}`
    );
    // Le modèle est résolu par RÔLE, avec le choix fait à chaud (`ai:models`) puis
    // les surcharges ciblées (`AI_OVERRIDES`).
    const { provider, modelName } = resolveRouting(request);
    const {
      llmOptions = {},
      file,
      userId,
      promptType,
      skipQuotaCheck = false,
      language,
    } = request;

    if (!messages || messages.length === 0) {
      logger.error('Messages array cannot be empty.');
      throw new Error('Messages array cannot be empty.');
    }

    // Un fichier joint est lu sur le disque du serveur : son chemin ne peut
    // désigner qu'un fichier temporaire créé par le serveur lui-même.
    if (file?.localPath) {
      assertTemporaryFilePath(file.localPath);
    }

    // Quota checking for authenticated users (skip for system/internal calls)
    if (userId && !skipQuotaCheck) {
      logger.info(`Checking quota for user: ${userId}`);
      const quotaCheck = await userService.checkQuota(userId);

      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }

      logger.info(
        `Quota check passed for user ${userId}. Remaining: daily=${quotaCheck.remainingDaily}, weekly=${quotaCheck.remainingWeekly}`
      );
    }

    // Restrictions validation
    if (promptType) {
      // Validate and adjust prompt parameters
      const paramValidation = restrictionsService.validatePromptParams(promptType, {
        llmOptions,
        ...request,
      });
      if (!paramValidation.allowed) {
        logger.warn(`Prompt parameters not allowed: ${paramValidation.message}`);
        throw new Error(paramValidation.message || 'Parameters not allowed');
      }

      // Apply adjusted parameters if any
      if (paramValidation.adjustedParams) {
        Object.assign(request, paramValidation.adjustedParams);
        logger.info(`Applied parameter adjustments for ${promptType}`);
      }
    }

    // Apply prompt modifications if needed
    let modifiedMessages = messages;
    if (messages.length > 0) {
      modifiedMessages = messages.map((msg) => {
        if (msg.role === 'user' || msg.role === 'system') {
          return {
            ...msg,
            content: restrictionsService.applyPromptModifications(msg.content),
          };
        }
        return msg;
      });
      logger.info('Applied prompt modifications');
    }

    // Force the output language. This is the single choke point for every AI
    // feature/provider, so one directive here guarantees generated content is in
    // the user's language (prevents wrong-language output). An explicit
    // config.language wins; otherwise fall back to the request-scoped language.
    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);
    if (languageDirective && modifiedMessages.length > 0) {
      // Où poser la directive ? Deux contraintes, et un ordre de priorité.
      //
      // On n'insère JAMAIS un message système supplémentaire : cela casserait
      // l'adjacence des rôles (certains modèles refusent deux tours de même rôle) — d'où la
      // concaténation dans un message existant.
      //
      // Quand le premier message est un message système (c'est le cas de toutes
      // les générations par sections depuis l'introduction du préfixe stable),
      // la directive va à la FIN DE CE PREMIER BLOC. Elle reste ainsi devant le
      // contenu variable — donc lue tard par rapport aux consignes de la
      // feature — tout en laissant le début du prompt strictement identique
      // d'une section à l'autre : la concaténer au dernier message rendait au
      // contraire la fin du prompt différente à chaque appel.
      //
      // Sans message système en tête, on retombe sur le comportement d'origine.
      const headIsSystem = modifiedMessages[0]?.role === 'system';
      const targetIdx = headIsSystem ? 0 : modifiedMessages.length - 1;
      const target = modifiedMessages[targetIdx];
      modifiedMessages = modifiedMessages.map((message, index) =>
        index === targetIdx
          ? { ...target, content: `${target.content}\n\n${languageDirective}` }
          : message
      );
      logger.info(
        `Injected language directive (language=${effectiveLanguage}, position=${headIsSystem ? 'system-head' : 'last-message'}).`
      );
    }

    // Raisonnement et budget de sortie doivent être cohérents, sinon la réponse
    // revient vide sans erreur (cf. reconcileThinkingBudget). Arbitré ICI, au
    // seul point de passage : une quinzaine de services recopient des
    // `llmOptions` depuis ai.config.ts en réduisant le budget pour leur propre
    // usage, sans savoir que la feature a activé la réflexion.
    const reconciled = reconcileThinkingBudget(llmOptions);
    if (reconciled.downgraded) {
      logger.warn(
        `Raisonnement désactivé pour ce${promptType ? ` '${promptType}'` : 't appel'} : ` +
          `budget de ${llmOptions.maxOutputTokens} tokens insuffisant (minimum ${MIN_TOKENS_FOR_THINKING}). ` +
          `La réflexion aurait consommé toute l'enveloppe et renvoyé une réponse vide.`
      );
    }
    if (reconciled.temperatureClamped !== undefined) {
      logger.warn(
        `Température écrêtée de ${reconciled.temperatureClamped} à ${MAX_TEMPERATURE_FOR_THINKING} ` +
          `pour ce${promptType ? ` '${promptType}'` : 't appel'} : le raisonnement est actif, et ` +
          `au-delà de ce seuil la réflexion cesse de converger — elle épuise l'enveloppe et ` +
          `renvoie une réponse vide.`
      );
    }
    const effectiveLlmOptions = reconciled.options;

    // Filet de sécurité: une chaîne de repli absente est presque toujours un
    // OUBLI, pas une décision. Une quinzaine de services recopient
    // `provider`/`modelName`/`llmOptions` depuis ai.config.ts en laissant
    // `fallbackModels` derrière eux — la feature déclarait bien un repli, il
    // n'arrivait simplement jamais jusqu'ici (`fallbacks=0` dans les logs) et
    // le moindre incident réseau faisait échouer la génération sans seconde
    // chance. Le défaut est appliqué ICI, au seul point de passage, plutôt
    // qu'ajouté à chaque appelant — où le prochain l'oublierait à son tour.
    //
    // Le défaut vient du FOURNISSEUR (`defaultFallbackModels`). Cf.
    // ai-providers.config.ts.
    const declaredFallbacks = request.fallbackModels ?? [];
    const effectiveFallbacks =
      declaredFallbacks.length > 0
        ? declaredFallbacks
        : (getProvider(provider).defaultFallbackModels ?? []);

    // Doublons écartés : la chaîne de repli commence souvent par le modèle
    // primaire de la feature — on rejouerait alors celui qui vient d'échouer
    // avant d'en essayer un autre.
    const modelsToTry = [...new Set([modelName, ...effectiveFallbacks])];

    let result: string | undefined;
    let lastError: any;
    // Un relevé par modèle essayé : un repli après échec a consommé des tokens
    // sur les DEUX modèles, et les deux doivent apparaître dans le journal.
    const attempts: { model: string; sink: UsageSink; startedAt: number; error?: any }[] = [];

    /** Un appel, un modèle. */
    const callModel = (model: string, sink: UsageSink): Promise<string> =>
      this._runOpenAICompatiblePrompt(
        provider,
        model,
        modifiedMessages,
        effectiveLlmOptions,
        file,
        sink
      );

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];

      // La panne précédente était réseau : changer de modèle n'y répond pas,
      // c'est la connexion qui manquait. On laisse un instant s'écouler avant
      // de repartir, sinon toute la chaîne s'épuise dans la même seconde.
      if (i > 0 && isTransientNetworkError(lastError)) {
        await sleep(INTER_MODEL_DELAY_MS);
      }

      // QUOTA saturé : sur une offre gratuite, il est partagé par le projet
      // entier, pas par modèle. Basculer immédiatement épuise la chaîne en
      // quelques millisecondes et perd la génération, là où quelques secondes
      // d'attente l'auraient sauvée. L'attente croît avec le rang du repli.
      if (i > 0 && isRateLimited(lastError)) {
        const wait = RATE_LIMIT_DELAY_MS * i;
        logger.warn(
          `Quota saturé sur ${modelsToTry[i - 1]} — attente de ${wait} ms avant ` +
            `${currentModel}. Sur une offre gratuite le quota est partagé : basculer ` +
            `sans attendre ne fait qu'épuiser la chaîne.`
        );
        await sleep(wait);
      }

      const sink: UsageSink = {};
      const attemptStartedAt = Date.now();
      const attempt: (typeof attempts)[number] = {
        model: currentModel,
        sink,
        startedAt: attemptStartedAt,
      };
      attempts.push(attempt);
      try {
        // Chaque modèle a droit à plusieurs essais AVANT qu'on ne bascule : un
        // `fetch failed` est temporel, et le modèle suivant échouerait pareil
        // s'il partait sur la même connexion défaillante. Seul le transitoire
        // réseau est rejoué — une saturation (429/503) bascule immédiatement.
        result = await withRetry(() => callModel(currentModel, sink), {
          label: `${provider}/${currentModel}`,
        });

        lastError = undefined;
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        attempt.error = error;
        if (i < modelsToTry.length - 1) {
          logger.warn(
            `Model ${currentModel} failed, falling back to ${modelsToTry[i + 1]}... Error: ${describeError(error)}`
          );
        } else {
          logger.error(
            `Error in runPrompt for provider ${provider}, model ${currentModel} (exhausted fallbacks): ${describeError(error)}`,
            { stack: error.stack, details: error }
          );
        }
      }
    }

    // Journalisation de la consommation, y compris pour les tentatives en échec :
    // un modèle qui répond puis échoue au parsing a bien été facturé, et le
    // masquer sous-estimerait le coût réel de la plateforme.
    // Journalisation de la consommation, tentatives en échec comprises : un
    // modèle qui répond puis échoue au parsing a bien été facturé.
    //
    // HORS du chemin critique. `record` écrit trois fois en base (événement,
    // agrégat quotidien, compteur de tokens) et avalait déjà ses propres
    // erreurs — mais attendues ici, ces écritures ajoutaient 50 à 300 ms à
    // CHAQUE appel modèle, soit plusieurs secondes sur un projet complet.
    // L'observabilité ne doit ni faire échouer une génération, ni la ralentir.
    void this.recordUsageAttempts({
      attempts,
      provider,
      promptType,
      userId,
      messages: modifiedMessages,
      resultText: result,
      error: lastError,
    }).catch((error) => logger.warn(`Relevé d'usage perdu: ${describeError(error)}`));

    if (lastError) {
      throw lastError;
    }

    if (result === undefined) {
      throw new Error('Unexpected empty result after trying all models.');
    }

    // Increment quota after successful API call
    if (userId && !skipQuotaCheck) {
      incrementUsageInBackground(userId);
    }

    return result;
  }

  /**
   * Boucle agentique avec function calling: le modèle peut appeler des
   * outils (Context Engine, historique de versions…) et recevoir leurs
   * résultats sur plusieurs tours, jusqu'à produire sa réponse finale.
   *
   * Passe par les mêmes garde-fous que runPrompt (quota, langue) — un seul
   * incrément de quota par appel, quel que soit le nombre de tours d'outils.
   */
  public async runPromptWithTools(
    request: PromptConfig,
    messages: AIChatMessage[],
    tools: FunctionDeclaration[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    options: { maxToolTurns?: number } = {}
  ): Promise<string> {
    const { provider, modelName } = resolveRouting(request);
    const { llmOptions = {}, userId, skipQuotaCheck = false, language } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    // Garde-fou par capacité : un fournisseur sans support des outils ne peut pas
    // exécuter la boucle agentique (l'appelant — ex: Advisor — retombe alors sur
    // runPrompt).
    if (!providerSupports(provider, 'tools')) {
      throw new Error(
        `runPromptWithTools: le fournisseur ${provider} ne supporte pas le function-calling.`
      );
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    // Directive de langue: même choke point que runPrompt.
    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);
    const maxToolTurns = options.maxToolTurns ?? 8;

    const toolMessages: AIChatMessage[] = languageDirective
      ? [...messages, { role: 'system', content: languageDirective }]
      : messages;
    const loopStartedAt = Date.now();
    logAIEvent('ai.agentic_loop_start', {
      provider,
      modelName,
      promptType: request.promptType,
      toolCount: tools.length,
      maxToolTurns,
    });
    const text = await this._runOpenAICompatibleTools(
      provider,
      modelName,
      toolMessages,
      llmOptions,
      tools,
      executeTool,
      maxToolTurns
    );
    logAIEvent('ai.agentic_loop_end', {
      provider,
      modelName,
      finalTextLength: text.length,
      durationMs: Date.now() - loopStartedAt,
    });
    if (userId && !skipQuotaCheck) {
      incrementUsageInBackground(userId);
    }
    return text;
  }

  /**
   * Appel FONDÉ (grounded) par la recherche web d'OpenRouter (plugin `web`) : le
   * serveur interroge le web, injecte les résultats, et le modèle répond avec des
   * citations. On extrait des annotations `url_citation` les URLs réelles et la
   * carte segments→sources. C'est le socle anti-invention : aucune donnée n'est
   * acceptée si elle ne provient pas de ces résultats.
   *
   * Sans aucune source en retour, le texte est rendu VIDE : une réponse « fondée »
   * sans source serait du texte inventé qui en a l'air.
   */
  public async runGroundedResearch(
    request: PromptConfig,
    messages: AIChatMessage[]
  ): Promise<GroundedResult> {
    const { provider, modelName } = resolveRouting(request);
    const { llmOptions = {}, userId, skipQuotaCheck = false, language } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }
    if (!providerSupports(provider, 'grounding')) {
      throw new Error(`runGroundedResearch: le fournisseur ${provider} ne fonde pas ses réponses.`);
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    const languageDirective = this.buildLanguageDirective(language ?? getRequestLanguage());
    const brief = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    // Le brief est entier — contexte projet, consignes, liste de points. Les vraies
    // requêtes courtes servent à l'affichage et à la trace ; le plugin web formule
    // les siennes à partir de la conversation.
    const queries = buildSearchQueries(brief);

    const grounded: AIChatMessage[] = [
      ...messages.filter((m) => m.role === 'system'),
      {
        role: 'system',
        content:
          'Use the web search results provided to you. ' +
          'State no figure, no fact and no date that you cannot attribute to a result. ' +
          'Cite the source of every claim.' +
          (languageDirective ? `\n\n${languageDirective}` : ''),
      },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const startedAt = Date.now();
    logAIEvent('ai.grounded_research_start', {
      modelName,
      promptType: request.promptType,
      queryCount: queries.length,
    });

    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);
    const sink: UsageSink = {};
    const response: any = await withRetry(
      () =>
        client.chat.completions.create(
          translateReasoning({
            model: modelName,
            messages: grounded.map((m) => ({ role: m.role, content: m.content })),
            ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
            ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
            ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
            ...(def.extraBody ?? {}),
            ...(llmOptions.extraBody ?? {}),
            plugins: [{ id: 'web', max_results: SEARCH_RESULTS_PER_QUERY * MAX_SEARCH_QUERIES }],
          }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
        ),
      { label: `${provider}/${modelName}` }
    );
    sink.usage = extractOpenAIUsage(response);
    sink.modelUsed = response?.model || modelName;
    this.assertNoErrorEnvelope(provider, response);

    const message = response?.choices?.[0]?.message;
    const text: string = message?.content ?? '';
    const { sources, supports } = extractWebCitations(text, message?.annotations);

    void this.recordUsageAttempts({
      attempts: [{ model: modelName, sink, startedAt }],
      provider,
      promptType: request.promptType,
      userId,
      messages: grounded,
      resultText: text,
    }).catch((error) => logger.warn(`Relevé d'usage perdu: ${describeError(error)}`));

    logAIEvent('ai.grounded_research_end', {
      modelName,
      durationMs: Date.now() - startedAt,
      textLength: text.length,
      sourceCount: sources.length,
      queryCount: queries.length,
    });

    if (sources.length === 0) {
      logger.warn("runGroundedResearch : la recherche web n'a renvoyé aucune source.");
      return { text: '', queries, sources: [], supports: [] };
    }

    if (userId && !skipQuotaCheck) {
      incrementUsageInBackground(userId);
    }

    return { text, queries, sources, supports };
  }

  /**
   * Variante streaming de runPrompt : diffuse le texte au fil
   * de l'eau via `onDelta(textCumulé)` et renvoie le texte complet. Améliore la
   * latence PERÇUE (le contenu s'affiche pendant la génération). Applique les
   * mêmes garde-fous que runPrompt (quota, directive de langue, config sous
   * `config`).
   */
  public async runPromptStream(
    request: PromptConfig,
    messages: AIChatMessage[],
    onDelta: (cumulativeText: string) => void
  ): Promise<string> {
    const { provider, modelName } = resolveRouting(request);
    const {
      llmOptions = {},
      userId,
      skipQuotaCheck = false,
      language,
    } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);

    // Vrai flux via le SDK OpenAI si la capacité est déclarée, sinon repli
    // non-streamé. Le repli passe par runPrompt qui gère lui-même le quota ; le
    // flux réussi incrémente ici (une seule fois).
    if (providerSupports(provider, 'streaming')) {
      const streamMessages: AIChatMessage[] = languageDirective
        ? [...messages, { role: 'system', content: languageDirective }]
        : messages;
      try {
        const full = await this._streamOpenAICompatible(
          provider,
          modelName,
          streamMessages,
          llmOptions,
          onDelta
        );
        if (userId && !skipQuotaCheck) {
          incrementUsageInBackground(userId);
        }
        return full;
      } catch (error: any) {
        logger.warn(
          `runPromptStream (${provider}) failed, falling back to non-streaming: ${error.message}`
        );
      }
    }
    const text = await this.runPrompt(request, messages);
    onDelta(text);
    return text;
  }

  public getCleanAIText(response: any): string {
    logger.debug('Attempting to clean AI text response.');
    if (typeof response === 'string') {
      return this.stripModelFormatting(response);
    }

    if (response && typeof response.text === 'function') {
      try {
        return this.stripModelFormatting(response.text());
      } catch (e: any) {
        logger.warn(
          `Failed to extract text using response.text(). Trying older structure. Error: ${e.message}`,
          { stack: e.stack, responseDetails: typeof response }
        );
      }
    }

    return '';
  }

  /**
   * Retire les artefacts de formatage laissés par les modèles :
   *  - clôtures de bloc de code ouvrantes (```lang) et fermantes ;
   *  - préfixe de langage nu en tête ("html" / "markdown"), qui sinon s'affiche
   *    en texte brut au-dessus des sections (y compris dans le PDF).
   * Sans effet sur du JSON (qui commence par { ou [).
   */
  private stripModelFormatting(text: string): string {
    if (typeof text !== 'string') return text;
    return text
      .replace(/^```[a-zA-Z]*\s*/, '')
      .replace(/```\s*$/g, '')
      .replace(/^(?:html|markdown)\b[ \t]*\r?\n?/i, '')
      .trim();
  }
}

export const promptService = new PromptService();

/** Domaine d'une URL, ou `undefined` si elle est malformée. */
function safeDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Sources et citations d'une réponse fondée, d'après les annotations `url_citation`
 * d'OpenRouter.
 *
 * Une même page citée plusieurs fois ne compte qu'une source. Chaque annotation
 * porte l'intervalle de texte qu'elle appuie : il devient un support, relié à
 * l'index de la source.
 */
function extractWebCitations(
  text: string,
  annotations: unknown
): { sources: GroundedSourceRaw[]; supports: GroundedSupport[] } {
  const sources: GroundedSourceRaw[] = [];
  const indexByUrl = new Map<string, number>();
  const spans = new Map<string, Set<number>>();

  for (const annotation of Array.isArray(annotations) ? annotations : []) {
    const citation = annotation?.type === 'url_citation' ? annotation.url_citation : undefined;
    const url: string | undefined = citation?.url;
    if (!url) continue;

    let index = indexByUrl.get(url);
    if (index === undefined) {
      index = sources.length;
      indexByUrl.set(url, index);
      const domain = safeDomain(url);
      sources.push({ index, title: citation.title?.trim() || domain || url, url, domain });
    }

    const start = Number(citation.start_index);
    const end = Number(citation.end_index);
    if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
      const segment = text.slice(start, end).trim();
      if (segment) {
        const set = spans.get(segment) ?? new Set<number>();
        set.add(index);
        spans.set(segment, set);
      }
    }
  }

  const supports: GroundedSupport[] = [...spans.entries()].map(([segment, indexes]) => ({
    text: segment,
    sourceIndexes: [...indexes],
  }));
  return { sources, supports };
}

/**
 * Résultats demandés par requête. Descendu de 5 à 4 : le dossier envoyé au
 * modèle rétrécit d'autant, et c'est lui qui pèse sur la latence de la
 * synthèse — pas la recherche elle-même, qui tient en trois secondes.
 */
const SEARCH_RESULTS_PER_QUERY = 4;

/**
 * Requêtes par section. Descendu de 4 à 3 : au-delà, les résultats se
 * recoupent et l'on paie une recherche de plus pour la même information.
 */
const MAX_SEARCH_QUERIES = 3;

/**
 * Tire de vraies requêtes de recherche d'un brief de recherche.
 *
 * Le brief mêle contexte projet, consignes internes et liste de points à
 * couvrir. Un moteur de recherche n'en fait rien de bon, et l'utilisateur qui
 * verrait passer « N'invente rien » dans l'interface se demanderait à qui on
 * parle. On ne garde donc que les points à couvrir, un par requête, ancrés sur
 * le pays quand le brief le mentionne.
 */
export function buildSearchQueries(brief: string): string[] {
  const mission = /DONNÉES À TROUVER[^:]*:\s*([\s\S]*?)(?:\n\s*\n|$)/i.exec(brief)?.[1] ?? '';
  const country = /Pays:\s*([^\n]+)/i.exec(brief)?.[1]?.trim();

  const points = mission
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 8);

  const queries = points.slice(0, MAX_SEARCH_QUERIES).map((point) => {
    const base = point.replace(/\s+/g, ' ').slice(0, 180);
    // Le pays n'est ajouté que s'il manque : une requête qui le répète perd en
    // précision.
    return country && !base.toLowerCase().includes(country.toLowerCase())
      ? `${base} ${country}`
      : base;
  });

  if (queries.length > 0) {
    return queries;
  }

  // Brief sans liste de points : on retombe sur sa première phrase utile.
  const fallback = brief
    .replace(/CONTEXTE PROJET:|DONNÉES À TROUVER[^:]*:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return fallback ? [fallback] : [];
}
